// La tasa de cancelación, y sobre qué citas se cuenta. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA CIFRA QUE ESTAS PRUEBAS EXISTEN PARA NO DAR
//
// El 2026-09-13 se reportó «160 de 316 citas canceladas, el 50,6 %». Estaba sesgado a la baja, y el
// modo en que apareció es lo que hay que fijar: la tasa subía hacia el presente —61,9 % a siete
// días, 60,1 % a catorce, 52,9 % a treinta, 50,6 % en total— y eso se parece a una tendencia.
//
// No lo era. Partiendo la población:
//
//     con calendario (el barrido las alcanza)   199 citas   120 canceladas   60,3 %
//     congeladas (anteriores a la 038)          101 citas    31 canceladas   30,7 %
//
// Las congeladas tienen `ghl_calendario_id` nulo y el CRM ya no devuelve sus eventos, así que su
// estado quedó detenido. Mezclarlas produce un número más bajo, estable y falso.
//
// Por eso la prueba que más importa de este archivo **no es la que comprueba la tasa**: es la que
// mete una congelada CANCELADA dentro de la ventana y exige que no cuente. Con las dos poblaciones
// del mismo signo, cualquier implementación pasaría.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { DIAS_DE_LA_TASA, tasaDeCancelacion } from '../../lib/negocio/cancelacion.ts';

let admin: Client;
let alfa: string;
let contacto: string;

const MARCA = 'tasa-cancel';

before(async () => {
  admin = await conectar('admin');
  const o = await filas<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  assert.equal(o.length, 1, 'falta la organización cliente del sembrado');
  alfa = o[0]!.id;
  await limpiarTodo();
  contacto = await conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: `${MARCA}-c`, nombre: 'Contacto de la tasa', territorio: 'closer' } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
});

after(async () => {
  await limpiarTodo();
  await cerrarTodo();
  await cerrarClientes();
});

/** Entre pruebas se van las CITAS y no el contacto: del contacto cuelga la clave foránea. */
async function limpiar(): Promise<void> {
  await conOrganizacion(alfa, () => datos().deleteFrom('citas').execute());
}

/** Al final sí, todo. Va en el `after` y no entre pruebas, por el mismo motivo. */
async function limpiarTodo(): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('citas').execute();
    await datos().deleteFrom('contactos').where('ghl_contact_id', 'like', `${MARCA}%`).execute();
  });
}

/**
 * Una cita en la tabla. `calendario: null` la vuelve **congelada** — el estado que tienen las 101
 * anteriores a la `038`, cuyos eventos el CRM ya no devuelve.
 */
async function cita(haceDias: number, estado: string | null, calendario: string | null = 'cal1'): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('citas')
      .values({
        ghl_evento_id: `${MARCA}-${randomUUID().slice(0, 8)}`,
        contacto_id: contacto,
        inicio_el: new Date(Date.now() - haceDias * 86_400_000),
        estado_ghl: estado,
        ghl_calendario_id: calendario,
      } as never)
      .execute();
  });
}

const leer = (dias?: number) => conOrganizacion(alfa, () => tasaDeCancelacion(dias));

// ─── La tasa ────────────────────────────────────────────────────────────────

test('la tasa se calcula sobre las citas de la ventana, y redondea a un decimal', async () => {
  await limpiar();
  await cita(1, 'cancelled');
  await cita(2, 'cancelled');
  await cita(3, 'confirmed');

  const t = await leer();
  assert.equal(t.citas, 3);
  assert.equal(t.canceladas, 2);
  assert.equal(t.tasa, 66.7, 'la tasa no es la de las citas de la ventana');
  assert.equal(t.aviso, null, 'avisó sin tener nada que advertir: un cartel que aparece siempre se ignora');
});

test('LA QUE DECIDE: una congelada CANCELADA dentro de la ventana no cuenta, y se declara', async () => {
  /* ── POR QUÉ ÉSTA ES LA PRUEBA DEL ARCHIVO ────────────────────────────────
   *
   * Las 101 citas congeladas tienen una tasa de cancelación MUY distinta de las vivas —30,7 % contra
   * 60,3 %— así que mezclarlas mueve el número. Pero el defecto no se ve con poblaciones parecidas:
   * acá la congelada es cancelada y las vivas no, para que incluirla cambie la tasa de 0 a 50 y
   * cualquier implementación que las sume falle.
   *
   * Y la segunda mitad importa igual: la cifra vale, pero **hay que decir sobre cuántas no se
   * contó**. Una tasa correcta con una exclusión callada es una tasa que nadie puede auditar. */
  await limpiar();
  await cita(1, 'confirmed');
  await cita(2, 'confirmed');
  await cita(3, 'cancelled', null); // congelada Y cancelada

  const t = await leer();
  assert.equal(t.citas, 2, 'la congelada entró al conteo');
  assert.equal(t.canceladas, 0, 'se contó como cancelada una cita cuyo estado quedó detenido');
  assert.equal(t.tasa, 0);
  assert.equal(t.congeladas, 1, 'no se contaron las congeladas de la ventana');
  assert.ok(t.aviso, 'se excluyó una cita y no se dijo: la tasa no se puede auditar');
  assert.match(t.aviso, /congelad/i);
});

test('fuera de la ventana no cuenta, ni siquiera una cancelada', async () => {
  /* Catorce días y no treinta, y el motivo es el mismo sesgo: más atrás, mayor es la proporción de
     citas que el sistema dejó de mirar. Una ventana más vieja no es una muestra más grande. */
  await limpiar();
  await cita(1, 'confirmed');
  await cita(DIAS_DE_LA_TASA + 2, 'cancelled');

  const t = await leer();
  assert.equal(t.citas, 1, 'entró una cita de fuera de la ventana');
  assert.equal(t.tasa, 0);
});

test('una cita FUTURA no cuenta: todavía no pudo cancelarse ni ocurrir', async () => {
  /* Sin el tope de arriba, las citas de los próximos 45 días —que el barrido trae— entrarían al
     denominador como si ya hubieran pasado, y la tasa saldría diluida por citas que no tuvieron
     oportunidad de cancelarse. */
  await limpiar();
  await cita(1, 'cancelled');
  await cita(-5, 'confirmed'); // dentro de cinco días

  const t = await leer();
  assert.equal(t.citas, 1, 'una cita futura entró al denominador');
  assert.equal(t.tasa, 100);
});

// ─── El silencio, y los dos ceros ───────────────────────────────────────────

test('sin citas alcanzables la tasa es NULA, nunca 0 %', async () => {
  /* Un `0 %` con cero citas se lee como «no se cancela ninguna»: una afirmación sobre el negocio
     hecha con cero datos. Es el cero indistinguible que este proyecto persigue en todas partes. */
  await limpiar();
  const t = await leer();
  assert.equal(t.citas, 0);
  assert.equal(t.tasa, null, 'con cero citas se devolvió una tasa: eso afirma algo que nadie midió');
  assert.ok(t.aviso, 'el vacío sin explicación se lee como un cero');
});

test('sin citas vivas pero CON congeladas, el vacío dice cuál de los dos ceros es', async () => {
  /* Los dos ceros: «no hubo citas» y «las que hubo ya no se pueden seguir». Se ven igual en pantalla
     y significan cosas opuestas — uno es una semana tranquila, el otro es un agujero de datos. */
  await limpiar();
  await cita(2, 'cancelled', null);

  const t = await leer();
  assert.equal(t.citas, 0);
  assert.equal(t.tasa, null);
  assert.equal(t.congeladas, 1);
  assert.match(t.aviso ?? '', /congelad/i, 'el cero no distingue «no hubo citas» de «no se pueden seguir»');
  assert.doesNotMatch(t.aviso ?? '', /No hubo citas/i);
});

test('el estado cancelado se reconoce sin distinguir caja', async () => {
  // El CRM manda `cancelled` y también `CANCELLED`, medido. Un `=` desnudo perdería la mitad.
  await limpiar();
  await cita(1, 'CANCELLED');
  await cita(2, 'confirmed');

  assert.equal((await leer()).tasa, 50, 'un estado en mayúsculas no se reconoció como cancelada');
});
