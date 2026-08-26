// Avanzar contra la base, y el Pipeline que sale de él. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS CUATRO HECHOS QUE ESTE ARCHIVO MIDE
//
// **1 · Las cuatro escrituras van JUNTAS.** El resultado, la etapa, la nota y la tarea describen un
// solo hecho: cómo terminó esta conversación. La que falle sola deja a las otras tres afirmando algo
// incompleto — y el caso concreto está documentado: *"una nota que no se guardó y una operación que
// responde éxito es exactamente un éxito que no ocurrió"*.
//
// **2 · La etapa se mueve.** Sin eso el resultado queda registrado y el contacto sigue en la misma
// columna: el síntoma sería «registré y no se movió».
//
// **3 · Los números de Inicio dejan de decir `—`.** Es la mitad visible de todo el bloque: de acá
// salen «cobrado», «ventas» y «acuerdos», que hoy no tienen fuente.
//
// **4 · Y la distinción entre un cero MEDIDO y un cero NO medido se mantiene.** Con un resultado
// registrado y ninguna venta, cero es un hecho. Sin ningún resultado, no lo es.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { registrarResultado } from '../../lib/negocio/avanzar.ts';
import { pipelineDelCloser } from '../../lib/negocio/pipeline.ts';
import { cockpitDelMes } from '../../lib/negocio/inicio.ts';

let admin: Client;
let alfa: string;
let beta: string;
let quien: string;

before(async () => {
  admin = await conectar('admin');
  const orgs = await filas<{ id: string; slug: string }>(
    admin,
    `select id, slug from identidad.organizaciones where slug in ('alfa','beta') order by slug`,
  );
  assert.equal(orgs.length, 2, 'hacen falta las dos organizaciones cliente del sembrado');
  alfa = orgs[0]!.id;
  beta = orgs[1]!.id;

  // Quien registra. Se toma del sembrado y no se inventa: `registrado_por` tiene clave foránea.
  const u = await filas<{ id: string }>(
    admin,
    `select id from identidad.usuarios where org_id = $1 limit 1`,
    [alfa],
  );
  assert.ok(u[0], 'la organización alfa no tiene usuarios: ¿corrió el sembrado?');
  quien = u[0]!.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  for (const org of [alfa, beta]) {
    await conOrganizacion(org, async () => {
      await datos().deleteFrom('resultados').execute();
      await datos().deleteFrom('notas').execute();
      await datos().deleteFrom('tareas').execute();
      await datos().deleteFrom('contactos').execute();
    });
  }
}

/** Un contacto por el camino real. `org_id` NO se escribe: lo inyecta la capa fina. */
async function contactoEn(org: string, extra: Record<string, unknown> = {}): Promise<string> {
  return conOrganizacion(org, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: `ghl-${randomUUID()}`,
        nombre: 'Contacto de Avanzar',
        territorio: 'closer',
        ...extra,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

const BASE = {
  rol: 'closer' as const,
  detalle: null,
  formaPago: null,
  monto: null,
  nota: null,
  volverEl: null,
};

// ═══ 1 · Las cuatro escrituras ══════════════════════════════════════════════

test('una VENTA escribe el resultado, mueve la etapa, y deja el monto en su columna', async () => {
  await limpiar();
  const id = await contactoEn(alfa);

  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, {
      ...BASE,
      salida: 'venta',
      detalle: 'Contado',
      formaPago: 'Contado',
      monto: '1500.00',
      quien,
    }),
  );

  assert.equal(r.etapa, 'ganado');
  const guardado = await conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('resultados')
      .select(['salida', 'monto', 'forma_pago', 'detalle', 'registrado_por'])
      .where('id', '=', r.resultadoId)
      .executeTakeFirst(),
  );
  assert.equal(guardado?.salida, 'venta');
  assert.equal(guardado?.forma_pago, 'Contado');
  // El monto llega como TEXTO desde el controlador: la columna es `numeric(12,2)` y pasarlo por un
  // `double` es exactamente cómo se pierden centavos.
  assert.equal(Number(guardado?.monto), 1500);
  assert.equal(guardado?.registrado_por, quien, 'el resultado quedó sin autor');

  // LA ETAPA, que es lo que mueve el Pipeline. Sin esta línea el resultado queda registrado y el
  // contacto sigue en la misma columna.
  const contacto = await conOrganizacion(alfa, async () =>
    datos().selectFrom('contactos').select('etapa').where('id', '=', id).executeTakeFirst(),
  );
  assert.equal(contacto?.etapa, 'ganado');
});

test('la nota va a la MISMA tabla que la pestaña Notas, y con su autor', async () => {
  // El `04` § 4 llama a esto «el defecto que costó más caro de toda la ficha»: la nota se escribía
  // en otra tabla según por qué camino se registrara, así que aparecía en un lado y no en el otro.
  // De trece resultados con nota, solo dos llegaron a la tabla.
  await limpiar();
  const id = await contactoEn(alfa);

  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, salida: 'seguimiento', nota: 'Pidió llamar el lunes', quien }),
  );
  assert.equal(r.nota, true);

  const notas = await conOrganizacion(alfa, async () =>
    datos().selectFrom('notas').select(['cuerpo', 'autor_id', 'origen']).execute(),
  );
  assert.equal(notas.length, 1, 'la nota no llegó a `negocio.notas`');
  assert.equal(notas[0]?.cuerpo, 'Pidió llamar el lunes');
  // `null` en esta columna significa «la importó el sistema», así que dejarla vacía haría pasar la
  // nota de una persona por una importación.
  assert.equal(notas[0]?.autor_id, quien);

  // Y TAMBIÉN queda junto al resultado. No es duplicación por descuido: `resultados.nota` es lo que
  // se dijo AL registrar y viaja con él para siempre; borrar la de `notas` no puede cambiarlo.
  const res = await conOrganizacion(alfa, async () =>
    datos().selectFrom('resultados').select('nota').where('id', '=', r.resultadoId).executeTakeFirst(),
  );
  assert.equal(res?.nota, 'Pidió llamar el lunes');
});

test('sin nota NO se escribe ninguna, y la respuesta lo dice', async () => {
  // `nota: false` no es un detalle: es la diferencia entre «no se pidió» y «se pidió y no se pudo».
  await limpiar();
  const id = await contactoEn(alfa);
  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, salida: 'nurture', quien }),
  );
  assert.equal(r.nota, false);
  const n = await conOrganizacion(alfa, async () =>
    datos().selectFrom('notas').selectAll().execute(),
  );
  assert.deepEqual(n, []);
});

test('el seguimiento crea una tarea MANUAL, que es la que cuenta en Mi Día', async () => {
  // Mi Día *"cuenta lo que necesita una persona, no las series automáticas"*. Una tarea creada
  // desde Avanzar marcada como automática no aparecería en su contador.
  await limpiar();
  const id = await contactoEn(alfa);

  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, salida: 'seguimiento', volverEl: '2026-12-01', quien }),
  );
  assert.equal(r.tarea, true);

  const tareas = await conOrganizacion(alfa, async () =>
    datos().selectFrom('tareas').select(['vence_el', 'modo', 'situacion', 'creada_por']).execute(),
  );
  assert.equal(tareas.length, 1);
  assert.equal(tareas[0]?.modo, 'manual');
  assert.equal(tareas[0]?.creada_por, quien);
  assert.equal(tareas[0]?.situacion, 'seguimiento');
});

test('EL DÍA DE LA TAREA NO SE CORRE, y por eso viaja como texto', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIDO, Y ERA UN DEFECTO
  //
  // `tareas.vence_el` es una columna `date`. Pasando un `Date`, PostgreSQL lo convierte usando la
  // zona del servidor: un `2026-12-01T12:00:00Z` volvía como `2026-12-01T05:00:00Z`, y con una hora
  // cercana a la medianoche **el día habría cambiado**. Una tarea que aparece vencida el día que se
  // creó, sin que nada falle.
  //
  // Se afirma sobre el DÍA que la base guardó, leído en UTC, porque es lo único que la columna
  // contiene. Y se prueban los dos bordes del mes, que es donde un corrimiento de un día se ve.
  // ═══════════════════════════════════════════════════════════════════════════
  for (const dia of ['2026-12-01', '2026-12-31', '2027-01-01']) {
    await limpiar();
    const id = await contactoEn(alfa);
    await conOrganizacion(alfa, () =>
      registrarResultado(id, { ...BASE, salida: 'seguimiento', volverEl: dia, quien }),
    );
    const guardado = await filas<{ dia: string }>(
      admin,
      `select to_char(vence_el, 'YYYY-MM-DD') as dia from negocio.tareas`,
    );
    assert.equal(guardado[0]?.dia, dia, `el día se corrió: se pidió ${dia}`);
  }
});

test('LAS CUATRO ESCRITURAS SON ATÓMICAS: si una falla, no queda ninguna', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ES EL HECHO MÁS IMPORTANTE DE ESTE ARCHIVO
  //
  // Describen un solo hecho. Sueltas, la que falle deja a las otras afirmando algo que no pasó: un
  // resultado registrado con la etapa vieja, o una etapa movida sin resultado que la explique.
  //
  // Se provoca con una fecha imposible en la tarea —la última de las cuatro—: si la transacción no
  // envolviera todo, el resultado, la etapa y la nota ya estarían escritos cuando la cuarta falla.
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();
  const id = await contactoEn(alfa);

  await assert.rejects(
    conOrganizacion(alfa, () =>
      registrarResultado(id, {
        ...BASE,
        salida: 'seguimiento',
        nota: 'esta nota no debería quedar',
        // Un 31 de febrero. Tiene la forma correcta —el endpoint lo rechaza antes de llegar acá—
        // así que sirve justo para lo que se quiere medir: **que la base sea la última línea**. La
        // tarea es la CUARTA escritura, así que sin transacción las tres anteriores ya estarían.
        volverEl: '2026-02-31',
        quien,
      }),
    ),
  );

  const quedo = await conOrganizacion(alfa, async () => ({
    resultados: await datos().selectFrom('resultados').selectAll().execute(),
    notas: await datos().selectFrom('notas').selectAll().execute(),
    tareas: await datos().selectFrom('tareas').selectAll().execute(),
    contacto: await datos()
      .selectFrom('contactos')
      .select('etapa')
      .where('id', '=', id)
      .executeTakeFirst(),
  }));

  assert.deepEqual(quedo.resultados, [], 'quedó el resultado de una transacción que falló');
  assert.deepEqual(quedo.notas, [], 'quedó la nota de una transacción que falló');
  assert.deepEqual(quedo.tareas, []);
  assert.equal(quedo.contacto?.etapa, null, 'la etapa se movió en una transacción que falló');
});

// ═══ 2 · Los números de Inicio ══════════════════════════════════════════════

test('los números de Inicio dejan de decir `—` en cuanto hay un resultado', async () => {
  await limpiar();
  const a = await contactoEn(alfa);
  const b = await contactoEn(alfa);

  // Antes: sin ningún resultado, «cobrado» NO es cero — es que nadie registró nada.
  const antes = await conOrganizacion(alfa, () => cockpitDelMes('UTC', 0));
  assert.equal(antes.cobrado.valor, null, 'sin resultados, cobrado tiene que ser un cero NO medido');
  assert.ok(antes.cobrado.falta, 'y tiene que decir por qué');

  await conOrganizacion(alfa, () =>
    registrarResultado(a, { ...BASE, salida: 'venta', monto: '1000.00', formaPago: 'Contado', quien }),
  );
  await conOrganizacion(alfa, () =>
    registrarResultado(b, { ...BASE, salida: 'acuerdo_sin_pago', monto: '500.00', quien }),
  );

  const despues = await conOrganizacion(alfa, () => cockpitDelMes('UTC', 0));
  assert.equal(despues.cobrado.valor, 1000, 'el cobrado no cuenta la venta');
  assert.equal(despues.ventas.valor, 1);
  assert.equal(despues.acuerdos.valor, 1);
  // Y ya no hace falta explicar nada: el número es un hecho.
  assert.equal(despues.cobrado.falta, undefined);
});

test('un acuerdo sin pago NO suma al cobrado: es plata comprometida, no cobrada', async () => {
  // Confundirlos infla el número del que dependen las comisiones.
  await limpiar();
  const id = await contactoEn(alfa);
  await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, salida: 'acuerdo_sin_pago', monto: '900.00', quien }),
  );

  const c = await conOrganizacion(alfa, () => cockpitDelMes('UTC', 0));
  assert.equal(c.cobrado.valor, 0, 'un acuerdo sin pago entró al cobrado');
  assert.equal(c.acuerdos.valor, 1);
  // Y el cero de arriba es MEDIDO: hubo un resultado, no hubo ventas. Sin `falta`.
  assert.equal(c.cobrado.falta, undefined);
});

// ═══ 3 · El Pipeline ════════════════════════════════════════════════════════

test('el Pipeline devuelve las SIETE columnas, con las vacías en cero', async () => {
  await limpiar();
  const id = await contactoEn(alfa);
  await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, salida: 'no_show', quien }),
  );

  const p = await conOrganizacion(alfa, () => pipelineDelCloser());
  assert.equal(p.columnas.length, 7);
  assert.equal(p.total, 1);
  const noShow = p.columnas.find((c) => c.clave === 'no_show');
  assert.equal(noShow?.cuantos, 1);
  assert.equal(noShow?.filas.length, 1);
  // Las vacías se dibujan igual: una columna que desaparece hace que nadie note que está vacía.
  for (const c of p.columnas) {
    assert.equal(typeof c.cuantos, 'number', `${c.clave} sin conteo`);
    assert.ok(c.nombre.length > 0);
  }
  assert.equal(p.columnas.find((c) => c.clave === 'ganado')?.cuantos, 0);
});

test('un contacto SIN Avanzar cae en la entrada, y el Pipeline dice de dónde salió cada uno', async () => {
  // Mientras la mayoría esté clasificada por etiquetas, las columnas describen lo que el CRM
  // etiquetó y no lo que alguien registró. La pantalla lo puede decir porque esto lo cuenta.
  await limpiar();
  await contactoEn(alfa);
  const conEtiqueta = await contactoEn(alfa, { etiquetas: ['noshow'] });
  const conResultado = await contactoEn(alfa);
  await conOrganizacion(alfa, () =>
    registrarResultado(conResultado, { ...BASE, salida: 'venta', monto: '1.00', quien }),
  );

  const p = await conOrganizacion(alfa, () => pipelineDelCloser());
  assert.equal(p.total, 3);
  assert.equal(p.clasificados.porResultado, 1);
  assert.equal(p.clasificados.porEtiqueta, 1);
  assert.equal(p.clasificados.sinNada, 1);
  assert.equal(p.columnas.find((c) => c.clave === 'agendado')?.cuantos, 1);
  assert.equal(p.columnas.find((c) => c.clave === 'no_show')?.cuantos, 1);
  assert.equal(p.columnas.find((c) => c.clave === 'ganado')?.cuantos, 1);
  assert.ok(
    p.columnas.find((c) => c.clave === 'no_show')?.filas.some((f) => f.id === conEtiqueta),
  );
});

test('el Pipeline de una empresa no ve los contactos de la otra', async () => {
  await limpiar();
  await contactoEn(beta);
  const p = await conOrganizacion(alfa, () => pipelineDelCloser());
  assert.equal(p.total, 0);
  const q = await conOrganizacion(beta, () => pipelineDelCloser());
  assert.equal(q.total, 1);
});
