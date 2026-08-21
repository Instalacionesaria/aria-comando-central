// ADR-0704 — Las respuestas de error no revelan estructura.
// Tipo: Base — necesita errores REALES de PostgreSQL, no imitaciones.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS FAMILIAS DE ERROR, MEDIDAS
//
// El `05` § 3 pide devolver el mensaje de un disparador *"tal cual"*, porque *"si los mensajes están
// escritos para leerse, traducirlos en el backend sería mantener dos textos que dicen lo mismo y que
// van a divergir"*. Y `ADR-0704` prohíbe que un cuerpo de error revele estructura.
//
// Las dos cosas son compatibles solo si se distingue qué error es — y el texto no sirve para eso.
// Esta prueba genera **los dos errores de verdad** y comprueba que el filtro los separa. Imitar los
// objetos de error con literales probaría el filtro contra mi propia idea de cómo se ven, que es
// exactamente lo que no hay que hacer.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo } from '../apoyo/conexiones.ts';
import { mensajeDeDisparador } from '../../lib/autorizacion/respuesta.ts';

let admin: Client;

before(async () => {
  admin = await conectar('admin');
});

after(async () => {
  await cerrarTodo();
});

/** Corre algo que falla y devuelve el error tal como lo entrega el controlador. */
async function errorDe(sql: string): Promise<unknown> {
  await admin.query('begin');
  try {
    await admin.query(sql);
    assert.fail(`no falló: ${sql}`);
  } catch (e) {
    return e;
  } finally {
    await admin.query('rollback');
  }
}

test('ADR-0704 · el mensaje de un DISPARADOR sí pasa', async () => {
  const e = await errorDe(
    `update identidad.usuarios set es_admin_principal = false where es_admin_principal`,
  );
  assert.equal((e as { code?: string }).code, 'P0001', 'el disparador no usó `raise exception`');

  const mensaje = mensajeDeDisparador(e);
  assert.ok(mensaje, 'el mensaje del disparador no pasó, y el 05 § 3 dice que tiene que pasar');
  assert.match(mensaje, /no se puede degradar/i);
  // Y sin el `CONTEXT:` de plpgsql, que nombra la función y su número de línea.
  assert.ok(!mensaje.includes('PL/pgSQL'), 'el CONTEXT de plpgsql llegó al mensaje');
  assert.ok(!mensaje.includes('\n'), 'el mensaje tiene más de una línea');
});

test('ADR-0704 · un error ESTRUCTURAL no pasa, y nombraba la tabla', async () => {
  const e = await errorDe(
    `insert into identidad.usuarios (org_id, nombre, columna_que_no_existe) values (null, 'x', 'y')`,
  );

  // Primero: el error de verdad **sí** nombra la tabla. Sin esta afirmación, la de abajo pasaría
  // aunque el filtro no sirviera de nada.
  const crudo = String((e as Error).message);
  assert.match(crudo, /relation "usuarios"/, 'el error estructural cambió de forma');

  // Y el filtro lo corta.
  assert.equal(
    mensajeDeDisparador(e),
    null,
    'un error que nombra la tabla llegó al cuerpo de la respuesta',
  );
});

test('ADR-0704 · unicidad y clave foránea tampoco pasan', async () => {
  // El `05` § 3 los excluye por su cuenta, y con un motivo distinto del de arriba: *"las
  // verificaciones de unicidad y de integridad referencial NO PASAN por la seguridad a nivel de
  // fila… un mensaje de 'ya existe una fila con ese valor' es un canal que CONFIRMA LA EXISTENCIA
  // DE UN REGISTRO DE OTRA ORGANIZACIÓN"*.
  //
  // Filtrar por SQLSTATE los excluye solo: `23505` y `23503` no son `P0001`.
  const unicidad = await errorDe(
    `insert into identidad.organizaciones (nombre, slug) select nombre, slug
       from identidad.organizaciones limit 1`,
  );
  assert.equal((unicidad as { code?: string }).code, '23505');
  assert.equal(mensajeDeDisparador(unicidad), null);

  const foranea = await errorDe(
    `insert into identidad.usuarios (org_id, nombre)
       values ('00000000-0000-4000-8000-000000000000', 'x')`,
  );
  assert.equal((foranea as { code?: string }).code, '23503');
  assert.equal(mensajeDeDisparador(foranea), null);
});

test('ADR-0704 · y nada que no sea un error de la base pasa', async () => {
  // Las formas con las que esto se puede llamar por accidente. Ninguna puede devolver un mensaje.
  for (const raro of [null, undefined, 'una cadena', new Error('un Error normal'), {}, { code: 'P0001' }]) {
    assert.equal(mensajeDeDisparador(raro), null, `pasó: ${JSON.stringify(raro)}`);
  }
  // `{ code: 'P0001' }` sin mensaje devuelve null, no una cadena vacía: un detalle vacío en el
  // cuerpo es peor que ningún detalle, porque parece un mensaje que se perdió.
});
