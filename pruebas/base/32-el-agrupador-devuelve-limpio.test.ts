// ADR-0213 — Una conexión que vuelve al agrupador con la organización puesta se detecta.
// INNEGOCIABLE.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL INVARIANTE QUE NO VIVE EN LA BASE
//
// Todo el alcance de transacción se apoya en una propiedad: `set_config(…, true)` revierte
// al TERMINAR la transacción. Y eso, a su vez, se apoya en algo que la base no controla:
// que la conexión SIEMPRE vuelva al agrupador con su transacción cerrada.
//
// Si una transacción queda abierta sobre una conexión devuelta al agrupador, la variable
// NO revierte, y el siguiente que tome esa conexión física hereda la organización del
// anterior. Está medido: con `pool.connect()` y un `release()` sin `commit` ni `rollback`,
// el siguiente préstamo devolvió el MISMO backend con la transacción abierta, `app.org_id`
// todavía puesto, y leyó las filas de la organización anterior.
//
// Hoy no es alcanzable por el camino de la aplicación —Kysely siempre cierra la
// transacción antes de devolver la conexión, y no hay ni un `pool.connect()` manual en
// `lib/`—. Pero es el invariante más fácil de romper sin darse cuenta: un agrupador
// externo mal configurado, un manejador que se quede con el cliente, un `release()` en un
// camino de error. Y su modo de fallar es el peor de todos: datos de otro inquilino, sin
// una sola excepción.
//
// La defensa cuesta un viaje de ida y vuelta: `conOrganizacion` LEE la variable antes de
// ponerla, y lanza si la conexión trae estado. Esta prueba envenena una conexión a
// propósito y comprueba que la próxima llamada lo grita en vez de servir datos ajenos.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';

after(async () => {
  await cerrarClientes();
});

async function dosOrganizaciones(): Promise<{ alfa: string; beta: string }> {
  return conIdentidad(async (db) => {
    const f = await db
      .selectFrom('organizaciones')
      .select(['id', 'slug'])
      .where('slug', 'in', ['alfa', 'beta'])
      .execute();
    const alfa = f.find((x) => x.slug === 'alfa')?.id;
    const beta = f.find((x) => x.slug === 'beta')?.id;
    assert.ok(alfa && beta, 'faltan las organizaciones alfa y beta: ¿corrió el sembrado?');
    return { alfa, beta };
  });
}

test('ADR-0213 · una conexión con la organización puesta se detecta y LANZA', async () => {
  const { alfa, beta } = await dosOrganizaciones();

  // ── Envenenar ─────────────────────────────────────────────────────────────────
  //
  // El tercer argumento en `false` es alcance de SESIÓN, así que sobrevive al `commit` y
  // la conexión vuelve al agrupador con la variable puesta. Está prohibido en el código
  // de la aplicación por una búsqueda de la integración continua (`10-migraciones`), y se
  // usa acá porque es la forma más fiel de reproducir lo que hace un agrupador externo mal
  // configurado o un `release()` sin cerrar.
  await conOrganizacion(alfa, async () => {
    await sql`select set_config('app.org_id', ${beta}, false)`.execute(datos());
  });

  // ── Y ahora la próxima llamada tiene que romper ────────────────────────────────
  //
  // El agrupador de `pg` entrega la última conexión devuelta, así que el primer intento
  // suele ser el envenenado. Se prueba varias veces por si el agrupador tiene más de una
  // conexión viva y reparte distinto: lo que se afirma es que la conexión sucia NO PASA
  // DESAPERCIBIDA, no en qué intento aparece.
  let mensaje: string | null = null;
  for (let i = 0; i < 10 && mensaje === null; i++) {
    try {
      await conOrganizacion(alfa, async () => {
        await sql`select 1`.execute(datos());
      });
    } catch (e) {
      mensaje = String((e as Error).message);
    }
  }

  assert.ok(
    mensaje !== null,
    'la conexión envenenada volvió al agrupador y nadie se dio cuenta: ' +
      'la próxima petición pudo haber servido datos de otra organización',
  );
  assert.match(mensaje, /vino del agrupador con una organización ya puesta/);

  // La conexión sigue sucia: el agrupador se tira entero. Sin esto, las pruebas que
  // corran después heredan el problema — y esta prueba dejaría de medir su propio efecto
  // para pasar a romper las de al lado.
  await cerrarClientes();
});

test('ADR-0213 · y con el agrupador limpio, todo vuelve a funcionar', async () => {
  // La otra mitad, sin la que la de arriba pasaría con `conOrganizacion` roto del todo:
  // sobre un agrupador nuevo, el camino normal anda.
  const { alfa } = await dosOrganizaciones();

  const visto = await conOrganizacion(alfa, async () => {
    const r = await sql<{ v: string | null }>`
      select current_setting('app.org_id', true) as v
    `.execute(datos());
    return r.rows[0]?.v ?? null;
  });

  assert.equal(visto, alfa);
});
