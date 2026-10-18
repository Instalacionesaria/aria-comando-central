// EL ÁMBITO DE LA TRANSACCIÓN: QUÉ CUENTAS VE Y SI VE LA ORGANIZACIÓN ENTERA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 2)
//
// `conOrganizacion` recibe, además de una organización, un ámbito: las cuentas que ve la transacción (`'*'` o una
// lista) y si ve lo de la organización entera (`app.toda_la_organizacion`). Es lo que hace que la empresa enfocada en
// un cliente, o el cliente final, vean sólo lo suyo SIN tocar una consulta: el filtro lo pone la base.
//
//   · con una cuenta en el ámbito, sólo se ven los contactos de esa cuenta — mutación: poner siempre `'*'`;
//   · una cuenta de otra organización en el ámbito lanza, no se ignora — mutación: quitar el conteo de las cuentas;
//   · las tres variables quedan puestas, y la de la organización entera dice `si` o `no` — mutación: no ponerla;
//   · las combinaciones imposibles lanzan antes de abrir nada: `'*'` para el cliente final, un foco de dos cuentas,
//     un cliente final sin cuentas, una cuenta repetida o que no es un uuid — mutación: quitar una comprobación.
//
// La organización de estas pruebas se crea y se borra acá, con dos cuentas.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { sql } from 'kysely';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

const SLUG = 'gamma-261';

let admin: Client;
let org: string;
let cuentaA: string;
let cuentaB: string;
let otraCuenta: string;

async function contactosVisibles(donde: Parameters<typeof conOrganizacion>[0]): Promise<string[]> {
  return conOrganizacion(donde, async () =>
    (
      await datos()
        .selectFrom('contactos')
        .select('ghl_contact_id')
        .where('ghl_contact_id', 'like', 'ambito-261-%')
        .orderBy('ghl_contact_id')
        .execute()
    ).map((f) => f.ghl_contact_id),
  );
}

async function limpiar(): Promise<void> {
  await admin.query(`delete from negocio.contactos where ghl_contact_id like 'ambito-261-%'`);
  await admin.query(`delete from identidad.organizaciones where slug = $1`, [SLUG]);
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug) values ('Gamma 261', $1) returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1`, [org]);
  const b = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'B 261', 'b-261') returning id`,
    [org],
  );
  const otra = await unaFila<{ id: string }>(
    admin,
    `select c.id from identidad.cuentas c join identidad.organizaciones o on o.id = c.org_id where o.slug = 'beta'`,
  );
  assert.ok(a && b && otra, 'falta el sembrado');
  cuentaA = a.id;
  cuentaB = b.id;
  otraCuenta = otra.id;
  await admin.query(
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre)
       values ($1, $2, 'ambito-261-a', 'Uno'), ($1, $3, 'ambito-261-b', 'Dos')`,
    [org, cuentaA, cuentaB],
  );
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

test('con la organización como texto se ven todas sus cuentas, como antes del nivel 3', async () => {
  assert.deepEqual(await contactosVisibles(org), ['ambito-261-a', 'ambito-261-b']);
});

test('con el foco en una cuenta, sólo se ven los contactos de esa cuenta', async () => {
  assert.deepEqual(await contactosVisibles({ orgId: org, todaLaOrganizacion: true, cuentas: [cuentaB] }), ['ambito-261-b']);
});

test('el cliente final ve sólo sus cuentas', async () => {
  assert.deepEqual(await contactosVisibles({ orgId: org, todaLaOrganizacion: false, cuentas: [cuentaA] }), ['ambito-261-a']);
  assert.deepEqual(
    await contactosVisibles({ orgId: org, todaLaOrganizacion: false, cuentas: [cuentaA, cuentaB] }),
    ['ambito-261-a', 'ambito-261-b'],
  );
});

test('una cuenta de otra organización en el ámbito lanza, no se ignora', async () => {
  await assert.rejects(
    contactosVisibles({ orgId: org, todaLaOrganizacion: false, cuentas: [cuentaA, otraCuenta] }),
    /no es de esta organización/,
  );
});

test('las tres variables quedan puestas', async () => {
  const leer = () =>
    sql<{ o: string; c: string; t: string }>`
      select current_setting('app.org_id', true) as o, current_setting('app.cuentas', true) as c,
             current_setting('app.toda_la_organizacion', true) as t`.execute(datos());
  const empresa = await conOrganizacion(org, leer);
  assert.deepEqual(empresa.rows[0], { o: org, c: '*', t: 'si' });
  const cliente = await conOrganizacion({ orgId: org, todaLaOrganizacion: false, cuentas: [cuentaA, cuentaB] }, leer);
  assert.deepEqual(cliente.rows[0], { o: org, c: `${cuentaA},${cuentaB}`, t: 'no' });
});

test('las combinaciones imposibles lanzan antes de abrir nada', async () => {
  const nada = async () => undefined;
  await assert.rejects(conOrganizacion({ orgId: org, todaLaOrganizacion: false, cuentas: '*' }, nada), /no ve «todas las cuentas»/);
  await assert.rejects(
    conOrganizacion({ orgId: org, todaLaOrganizacion: true, cuentas: [cuentaA, cuentaB] }, nada),
    /el foco es una sola cuenta/,
  );
  await assert.rejects(conOrganizacion({ orgId: org, todaLaOrganizacion: false, cuentas: [] }, nada), /ve entre 1 y/);
  await assert.rejects(
    conOrganizacion({ orgId: org, todaLaOrganizacion: false, cuentas: [cuentaA, cuentaA] }, nada),
    /cuenta repetida/,
  );
  await assert.rejects(
    conOrganizacion({ orgId: org, todaLaOrganizacion: false, cuentas: ["x' or true --"] }, nada),
    /no es un uuid/,
  );
});
