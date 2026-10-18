// LO DE LA ORGANIZACIÓN SÓLO LO VE QUIEN LA VE ENTERA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 3, `086`)
//
// La tercera variable, `app.toda_la_organizacion`, separa a la EMPRESA (o el sistema), que ve la organización entera,
// del CLIENTE FINAL, que sólo ve sus cuentas. La base lo hace cumplir, no el código:
//
//   · el cliente final ve los contactos de su cuenta y nada de lo que es de la organización: ni una tabla de la
//     organización, ni la fila sin cuenta de una opcional, ni las personas, ni la auditoría — mutaciones: la política
//     de `aplicar_aislamiento` sin `'si'`; `politica_de_cuenta` sin la condición de la fila nula; las políticas de
//     identidad de antes;
//   · la empresa enfocada en un cliente ve sólo ese cliente, y sigue viendo y escribiendo lo de la organización —
//     mutación: quitar la cláusula de la fila nula (el `with check` rechaza el insert);
//   · `'*'` sin la organización entera no ve nada, aunque alguien arme así la variable a mano — mutación: una política
//     que acepte `'*'` sola;
//   · las cuentas: el cliente final ve sólo las suyas; el foco no alcanza para dar de alta otra; la empresa entera sí,
//     pero no puede escribir la subcuenta del CRM ni la marca de prueba — mutación: un `grant` de esas columnas;
//   · quién confirmó el nicho: la plataforma sin persona, la organización con persona — mutación: la regla vieja.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { sql } from 'kysely';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos, type Ambito } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

const SLUG = 'gamma-262';

let admin: Client;
let org: string;
let cuentaA: string;
let cuentaB: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['contactos', 'uso_de_ia', 'control_aislamiento']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  // La auditoría es de sólo agregar (un disparador lo exige): su fila queda, con la organización borrada. No tiene
  // clave foránea, así que no impide el borrado, y la próxima corrida crea otra organización con otro id.
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Lo que ve un ámbito: cuántas filas de cada cosa. */
async function loQueVe(ambito: Ambito): Promise<Record<string, number>> {
  return conOrganizacion(ambito, async () => {
    const r = await sql<Record<string, number>>`
      select (select count(*)::int from negocio.contactos) as contactos_a_y_b,
             (select count(*)::int from negocio.contactos c join identidad.cuentas k on k.id = c.cuenta_id
               where k.slug = 'b-262') as contactos_b,
             (select count(*)::int from negocio.uso_de_ia where cuenta_id is null) as uso_de_la_organizacion,
             (select count(*)::int from negocio.control_aislamiento) as de_la_organizacion,
             (select count(*)::int from identidad.usuarios) as personas,
             (select count(*)::int from identidad.auditoria_accesos) as auditoria,
             (select count(*)::int from identidad.cuentas) as cuentas`.execute(datos());
    return r.rows[0]!;
  });
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug) values ('Gamma 262', $1) returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1`, [org]);
  const b = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'B 262', 'b-262') returning id`,
    [org],
  );
  assert.ok(a && b);
  cuentaA = a.id;
  cuentaB = b.id;
  await admin.query(
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre)
       values ($1, $2, 'entera-262-a', 'Uno'), ($1, $3, 'entera-262-b', 'Dos')`,
    [org, cuentaA, cuentaB],
  );
  await admin.query(
    `insert into negocio.uso_de_ia (org_id, cuenta_id, agente, modelo, duracion_ms, resultado)
       values ($1, null, 'plan', 'entera-262', 1, 'ok')`,
    [org],
  );
  await admin.query(`insert into negocio.control_aislamiento (org_id, marca) values ($1, 'entera-262')`, [org]);
  await admin.query(`insert into identidad.usuarios (org_id, nombre) values ($1, 'Persona 262')`, [org]);
  await admin.query(`insert into identidad.auditoria_accesos (org_id, accion) values ($1, 'login')`, [org]);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('el cliente final ve los contactos de su cuenta y nada de lo que es de la organización', async () => {
  assert.deepEqual(await loQueVe({ orgId: org, todaLaOrganizacion: false, cuentas: [cuentaA] }), {
    contactos_a_y_b: 1,
    contactos_b: 0,
    uso_de_la_organizacion: 0,
    de_la_organizacion: 0,
    personas: 0,
    auditoria: 0,
    cuentas: 1,
  });
});

test('la empresa enfocada en un cliente ve ese cliente, y todo lo de la organización', async () => {
  assert.deepEqual(await loQueVe({ orgId: org, todaLaOrganizacion: true, cuentas: [cuentaB] }), {
    contactos_a_y_b: 1,
    contactos_b: 1,
    uso_de_la_organizacion: 1,
    de_la_organizacion: 1,
    personas: 1,
    auditoria: 1,
    cuentas: 1,
  });
  assert.deepEqual(await loQueVe({ orgId: org, todaLaOrganizacion: true, cuentas: '*' }), {
    contactos_a_y_b: 2,
    contactos_b: 1,
    uso_de_la_organizacion: 1,
    de_la_organizacion: 1,
    personas: 1,
    auditoria: 1,
    cuentas: 2,
  });
});

test('la empresa enfocada escribe lo de la organización; el cliente final no', async () => {
  const escribir = (ambito: Ambito) =>
    conOrganizacion(ambito, () =>
      sql`insert into negocio.uso_de_ia (org_id, agente, modelo, duracion_ms, resultado)
            values (${org}, 'plan', 'entera-262-escrita', 1, 'ok')`.execute(datos()),
    );
  await escribir({ orgId: org, todaLaOrganizacion: true, cuentas: [cuentaB] });
  await assert.rejects(
    escribir({ orgId: org, todaLaOrganizacion: false, cuentas: [cuentaB] }),
    /row-level security/,
    'el cliente final escribió una fila de la organización',
  );
});

test('`*` sin la organización entera no ve nada, aunque la variable se arme a mano', async () => {
  const inq = await conectar('inquilino');
  try {
    await inq.query('begin');
    await inq.query(
      `select set_config('app.org_id', $1, true), set_config('app.cuentas', '*', true),
              set_config('app.toda_la_organizacion', 'no', true)`,
      [org],
    );
    const f = await unaFila<{ n: number; k: number }>(
      inq,
      `select (select count(*)::int from negocio.contactos) as n, (select count(*)::int from identidad.cuentas) as k`,
    );
    assert.deepEqual(f, { n: 0, k: 0 }, 'con «todas» y sin la organización entera se vio algo');
  } finally {
    await inq.query('rollback');
    await inq.end();
  }
});

test('el foco no alcanza para dar de alta un cliente; la empresa entera sí, sin la subcuenta ni la marca de prueba', async () => {
  const alta = (ambito: Ambito, columnas: string, valores: string) =>
    conOrganizacion(ambito, () =>
      sql
        .raw(`insert into identidad.cuentas (org_id, nombre, slug${columnas}) values ('${org}', 'C 262', 'c-262'${valores})`)
        .execute(datos()),
    );
  await assert.rejects(
    alta({ orgId: org, todaLaOrganizacion: true, cuentas: [cuentaB] }, '', ''),
    /row-level security/,
    'una empresa enfocada en un cliente dio de alta otro',
  );
  await assert.rejects(
    alta({ orgId: org, todaLaOrganizacion: true, cuentas: '*' }, ', crm_cuenta_id', `, 'location-262'`),
    /permission denied|permiso denegado/,
    'la empresa escribió la subcuenta del CRM',
  );
  await assert.rejects(
    alta({ orgId: org, todaLaOrganizacion: true, cuentas: '*' }, ', es_prueba', ', true'),
    /permission denied|permiso denegado/,
    'la empresa marcó un cliente como de prueba',
  );
  // Sin `returning`: el inquilino no lee la fila antes del commit con otra política, y no hace falta.
  await alta({ orgId: org, todaLaOrganizacion: true, cuentas: '*' }, '', '');
  const c = await unaFila<{ n: number }>(admin, `select count(*)::int as n from identidad.cuentas where org_id = $1 and slug = 'c-262'`, [
    org,
  ]);
  assert.equal(c?.n, 1);
});

test('quién confirmó el nicho: la plataforma sin persona, la organización con persona', async () => {
  const nicho = await unaFila<{ clave: string }>(admin, `select clave from catalogo.nichos where nivel = 2 order by clave limit 1`);
  assert.ok(nicho);
  await admin.query('begin');
  try {
    await admin.query(
      `update identidad.cuentas set nicho = $2, nicho_confirmado_el = now(), nicho_confirmado_desde = 'plataforma' where id = $1`,
      [cuentaA, nicho.clave],
    );
    await admin.query('savepoint s');
    await assert.rejects(
      admin.query(`update identidad.cuentas set nicho_confirmado_desde = 'organizacion' where id = $1`, [cuentaA]),
      (e: { code?: string }) => e.code === '23514',
      'la organización confirmó un nicho sin decir quién',
    );
    await admin.query('rollback to savepoint s');
    await assert.rejects(
      admin.query(`update identidad.cuentas set nicho_confirmado_desde = null where id = $1`, [cuentaA]),
      (e: { code?: string }) => e.code === '23514',
      'un nicho quedó confirmado sin decir desde dónde',
    );
  } finally {
    await admin.query('rollback');
  }
});
