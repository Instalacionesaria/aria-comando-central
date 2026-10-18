// LA CUENTA POR OMISIÓN: UN SEGUNDO CLIENTE NO CORTA LA INGESTA DE SU EMPRESA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 1, `085`)
//
// El puente `negocio.completar_cuenta` pone la cuenta de cada fila de negocio que no la trae. Hasta la `085`, con dos
// cuentas activas en una organización fallaba: dar de alta el segundo cliente de una empresa cortaba su ingesta. Desde
// la `085` cae en la cuenta por omisión, y las cuentas que mira son las de la sesión:
//
//   · toda organización nueva nace con su cuenta, y ésa es la por omisión — mutación: `crear_cuenta_inicial` sin
//     `es_por_omision`;
//   · con todas las cuentas a la vista (`'*'`) y dos activas, un contacto sin cuenta cae en la por omisión — mutación:
//     el puente de la `082`, que falla con dos activas;
//   · con la sesión en una sola cuenta (el foco), cae en ésa — mutación: un puente que elija siempre la por omisión;
//   · con dos cuentas a la vista, la por omisión entre ellas — el mismo puente de la `082` falla;
//   · con dos cuentas a la vista y la por omisión fuera de la sesión, falla: nada mal archivado queda en silencio —
//     mutación: un puente que busque la por omisión sin mirar la sesión (sólo se ve con un rol que la respete);
//   · la fase `cuenta-por-omision` marca la cuenta de una organización que no tiene por omisión, y le iguala la zona
//     a la de la organización — mutación: sacarle a la fase el primer `update`, o el segundo;
//   · la por omisión no se pausa, y hay una sola por organización — mutación: quitar el `check` o el índice.
//
// La organización de estas pruebas se crea y se borra acá: el sembrado tiene una cuenta por organización, y la fase
// `cuenta-en-negocio` aborta si encuentra otra cantidad.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { RAIZ } from '../apoyo/fuente.ts';

const SLUG = 'gamma-260';

let admin: Client;
let org: string;
let porOmision: string;
let segunda: string;
let tercera: string;

/** Un contacto insertado como el inquilino, con la sesión que se le pase; devuelve su cuenta. Siempre se deshace. */
async function cuentaDeUnContactoNuevo(cuentas: string): Promise<string> {
  const inq = await conectar('inquilino');
  try {
    await inq.query('begin');
    // La empresa (o el sistema): ve la organización entera. El puente cuenta las cuentas que ve la sesión.
    await inq.query(
      `select set_config('app.org_id', $1, true), set_config('app.cuentas', $2, true), set_config('app.toda_la_organizacion', 'si', true)`,
      [org, cuentas],
    );
    const fila = await unaFila<{ cuenta_id: string }>(
      inq,
      `insert into negocio.contactos (org_id, ghl_contact_id, nombre) values ($1, 'contacto-260', 'Contacto 260') returning cuenta_id`,
      [org],
    );
    assert.ok(fila);
    return fila.cuenta_id;
  } finally {
    await inq.query('rollback').catch(() => undefined);
    await inq.end();
  }
}

before(async () => {
  admin = await conectar('admin');
  await admin.query(`delete from identidad.organizaciones where slug = $1`, [SLUG]);
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 260', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const c = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1`, [org]);
  assert.ok(c, 'la organización nació sin cuenta');
  porOmision = c.id;
  const s = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 260', 'segunda') returning id`,
    [org],
  );
  const t = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Tercera 260', 'tercera') returning id`,
    [org],
  );
  assert.ok(s && t);
  segunda = s.id;
  tercera = t.id;
});

after(async () => {
  await admin.query(`delete from identidad.organizaciones where slug = $1`, [SLUG]);
  await cerrarTodo();
});

test('toda organización nueva nace con su cuenta, y ésa es la por omisión', async () => {
  const f = await unaFila<{ es_por_omision: boolean }>(admin, `select es_por_omision from identidad.cuentas where id = $1`, [
    porOmision,
  ]);
  assert.equal(f?.es_por_omision, true);
});

test('con todas las cuentas a la vista y tres activas, un contacto sin cuenta cae en la por omisión', async () => {
  assert.equal(await cuentaDeUnContactoNuevo('*'), porOmision);
});

test('con la sesión en una sola cuenta, el contacto es de esa cuenta', async () => {
  assert.equal(await cuentaDeUnContactoNuevo(segunda), segunda);
});

test('con varias cuentas a la vista, la por omisión entre ellas', async () => {
  assert.equal(await cuentaDeUnContactoNuevo(`${segunda},${porOmision}`), porOmision);
});

test('con varias cuentas a la vista y la por omisión fuera de la sesión, falla', async () => {
  await assert.rejects(
    cuentaDeUnContactoNuevo(`${segunda},${tercera}`),
    /ninguna por omisión a la vista/,
    'el puente archivó un contacto en una cuenta que la sesión no pidió',
  );
});

test('la fase `cuenta-por-omision` marca la de una organización que no la tiene, y le iguala la zona', async () => {
  // Una organización «de antes de la 085»: su cuenta sin marcar y con la zona que copió al nacer.
  await admin.query(`update identidad.cuentas set es_por_omision = false, zona_horaria = 'UTC' where id = $1`, [porOmision]);
  const ident = await conectar('identidad');
  try {
    await ident.query(readFileSync(join(RAIZ, 'db/arranque/006_la_cuenta_por_omision.sql'), 'utf8'));
  } finally {
    await ident.end();
  }
  const f = await unaFila<{ es_por_omision: boolean; zona_horaria: string }>(
    admin,
    `select es_por_omision, zona_horaria from identidad.cuentas where id = $1`,
    [porOmision],
  );
  assert.deepEqual(f, { es_por_omision: true, zona_horaria: 'America/Lima' }, 'la fase no marcó la cuenta más vieja');
});

test('la por omisión no se pausa, y hay una sola por organización', async () => {
  await admin.query('begin');
  try {
    await admin.query('savepoint a');
    await assert.rejects(
      admin.query(`update identidad.cuentas set estado = 'pausada' where id = $1`, [porOmision]),
      (e: { code?: string }) => e.code === '23514',
      'se pausó la cuenta por omisión',
    );
    await admin.query('rollback to savepoint a');
    await assert.rejects(
      admin.query(`update identidad.cuentas set es_por_omision = true where id = $1`, [segunda]),
      (e: { code?: string }) => e.code === '23505',
      'una organización quedó con dos cuentas por omisión',
    );
  } finally {
    await admin.query('rollback');
  }
});
