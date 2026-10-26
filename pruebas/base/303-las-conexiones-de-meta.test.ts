// LAS CONEXIONES DE META: QUIÉN CONECTÓ, QUÉ CUENTAS Y A QUÉ CLIENTE VAN. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (Meta directo, M1, 2026-10-26)
//
// La `101` crea las conexiones con Meta de «Conectar con Meta»: cada negocio conectado, sus cuentas publicitarias y a qué
// cliente va cada una. Una empresa con tres clientes: P (el principal), X y Z.
//
//   · las tres tablas son sólo de identidad: el inquilino no las puede leer —un token no sale de identidad— y la RLS
//     está forzada;
//   · la fase `meta-manual-a-conexiones` copia el token pegado de la empresa a una conexión manual del cliente
//     PRINCIPAL y el de X a una de X, cada una con su cuenta asignada; correrla dos veces deja lo mismo; un `act_` mal
//     escrito no se copia — mutación: asignar la de la empresa a la empresa (`cuenta_id` nulo);
//   · una cuenta que conectó un cliente con su propio portfolio no se asigna a otro cliente: la base lo rechaza —
//     mutación: sacar el disparador;
//   · `resolverCuentasDeMeta` devuelve las cuentas asignadas a cada cliente con el token de SU conexión, descifrado;
//     `'la_de_la_empresa'` es el principal; un cliente sin cuentas falta; con su conexión revocada falta con otro
//     motivo — mutación: no filtrar por `estado = 'activa'`;
//   · cambiar el token o la cuenta pegados en Ajustes (empresa y cliente) llega a las conexiones; quitarlos borra la
//     conexión manual; una cuenta tomada por una conexión OAuth no se pisa.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { RAIZ } from '../apoyo/fuente.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { resolverCuentasDeMeta } from '../../lib/credenciales/resolver.ts';
import { PUT as cargarConexion } from '../../app/api/admin/cuentas/[id]/conexion/route.ts';
import { PUT as cargarDeLaEmpresa } from '../../app/api/admin/credenciales/route.ts';

const SLUG = 'gamma-303';
const ACT_EMPRESA = 'act_3030000001';
const ACT_X = 'act_3030000002';
const ACT_OAUTH = 'act_3030000003';

let admin: Client;
let identidad: Client;
let org: string;
let p: string;
let x: string;
let z: string;
let tokenAdmin: string;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const FASE = readFileSync(join(RAIZ, 'db/arranque/007_meta_manual_a_conexiones.sql'), 'utf8').replace(/\r\n/g, '\n');

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.conexiones_de_meta where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function cliente(nombre: string, slug: string): Promise<string> {
  const c = await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, $2, $3) returning id`, [org, nombre, slug]);
  assert.ok(c);
  return c.id;
}

/** Las cuentas publicitarias de la organización: act → (cliente, origen de su conexión). */
async function cuentas(): Promise<Record<string, { cliente: string | null; origen: string; deQuien: string | null }>> {
  const r = await filas<{ act_id: string; cuenta_id: string | null; origen: string; de_quien: string | null }>(
    admin,
    `select p.act_id, p.cuenta_id, c.origen, c.cuenta_id as de_quien
       from identidad.cuentas_publicitarias_de_meta p join identidad.conexiones_de_meta c on c.org_id = p.org_id and c.id = p.conexion_id
      where p.org_id = $1`,
    [org],
  );
  return Object.fromEntries(r.map((f) => [f.act_id, { cliente: f.cuenta_id, origen: f.origen, deQuien: f.de_quien }]));
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  identidad = await conectar('identidad');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 303', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(principal);
  p = principal.id;
  x = await cliente('Segunda 303', 'segunda-303');
  z = await cliente('Tercera 303', 'tercera-303');
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, 'Admin 303') returning id`, [org]);
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'administrador' and org_id is null`,
    [u.id],
  );
  tokenAdmin = await sesionDe(u.id);

  // Lo que había antes de la `101`: el token pegado de la empresa y el de X, más uno de Z mal escrito.
  await admin.query(
    `insert into identidad.organizaciones_credenciales (org_id, meta_token_cifrado, meta_cuenta_id) values ($1, $2, $3)`,
    [org, cifrar('meta-empresa-303'), ACT_EMPRESA.replace('act_', '')],
  );
  await admin.query(
    `insert into identidad.cuentas_credenciales (org_id, cuenta_id, meta_token_cifrado, meta_cuenta_id) values ($1, $2, $3, $4), ($1, $5, $6, 'no-es-una-cuenta')`,
    [org, x, cifrar('meta-x-303'), ACT_X, z, cifrar('meta-z-303')],
  );
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('las tres tablas son sólo de identidad, con la RLS forzada', async () => {
  for (const tabla of ['conexiones_de_meta', 'cuentas_publicitarias_de_meta', 'estados_de_oauth']) {
    const r = await unaFila<{ forzada: boolean; ve: boolean; identidad_ve: boolean }>(
      admin,
      `select c.relforcerowsecurity as forzada,
              has_table_privilege('app_inquilino', 'identidad.' || $1, 'select') as ve,
              has_table_privilege('app_identidad', 'identidad.' || $1, 'select') as identidad_ve
         from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'identidad' and c.relname = $1`,
      [tabla],
    );
    assert.ok(r, `no existe identidad.${tabla}`);
    assert.equal(r.forzada, true, `${tabla} sin la RLS forzada`);
    assert.equal(r.ve, false, `el inquilino lee identidad.${tabla}`);
    assert.equal(r.identidad_ve, true);
  }
});

test('la fase copia cada token pegado a su cliente, dos veces da lo mismo, y no copia una cuenta mal escrita', async () => {
  await identidad.query(FASE);
  await identidad.query(FASE);
  const c = await cuentas();
  assert.deepEqual(Object.keys(c).sort(), [ACT_EMPRESA, ACT_X]);
  // El de la empresa es del cliente PRINCIPAL, no de la empresa entera: no se puede reasignar a otro cliente.
  assert.deepEqual(c[ACT_EMPRESA], { cliente: p, origen: 'manual', deQuien: p });
  assert.deepEqual(c[ACT_X], { cliente: x, origen: 'manual', deQuien: x });
  const n = await unaFila<{ n: number }>(admin, `select count(*)::int as n from identidad.conexiones_de_meta where org_id = $1`, [org]);
  assert.equal(n?.n, 2, 'la segunda corrida sumó conexiones');
});

test('una cuenta que conectó un cliente no se asigna a otro cliente', async () => {
  await assert.rejects(
    admin.query(`update identidad.cuentas_publicitarias_de_meta set cuenta_id = $2 where org_id = $1 and act_id = $3`, [org, z, ACT_X]),
    /sólo se asigna a ese cliente/,
  );
  // Una conexión de la EMPRESA sí reparte sus cuentas entre los clientes.
  const conexion = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.conexiones_de_meta (org_id, cuenta_id, token_cifrado, negocio_de_meta_id, origen)
     values ($1, null, $2, '3030303030', 'oauth') returning id`,
    [org, cifrar('meta-agencia-303')],
  );
  assert.ok(conexion);
  await admin.query(
    `insert into identidad.cuentas_publicitarias_de_meta (org_id, act_id, conexion_id, cuenta_id, moneda, zona_horaria) values ($1, $2, $3, $4, 'PEN', 'America/Lima')`,
    [org, ACT_OAUTH, conexion.id, z],
  );
  assert.equal((await cuentas())[ACT_OAUTH]?.cliente, z);
});

test('cada cliente lee sus cuentas con el token de su conexión; el principal es el de la empresa', async () => {
  const deX = await conIdentidad((db) => resolverCuentasDeMeta(db, org, { id: x, esPorOmision: false }));
  assert.equal(deX.tipo, 'listo');
  if (deX.tipo === 'listo') assert.deepEqual(deX.cuentas.map((c) => [c.act, c.token]), [[ACT_X, 'meta-x-303']]);

  for (const quien of [{ id: p, esPorOmision: true }, 'la_de_la_empresa'] as const) {
    const r = await conIdentidad((db) => resolverCuentasDeMeta(db, org, quien));
    assert.equal(r.tipo, 'listo');
    if (r.tipo === 'listo') assert.deepEqual(r.cuentas.map((c) => [c.act, c.token]), [[ACT_EMPRESA, 'meta-empresa-303']]);
  }

  const deZ = await conIdentidad((db) => resolverCuentasDeMeta(db, org, { id: z, esPorOmision: false }));
  assert.equal(deZ.tipo, 'listo');
  if (deZ.tipo === 'listo') {
    assert.deepEqual(deZ.cuentas.map((c) => [c.act, c.token, c.moneda, c.zonaHoraria]), [[ACT_OAUTH, 'meta-agencia-303', 'PEN', 'America/Lima']]);
  }
});

test('sin cuentas falta; con la conexión revocada falta con otro motivo', async () => {
  const otro = await cliente('Cuarta 303', 'cuarta-303');
  const sin = await conIdentidad((db) => resolverCuentasDeMeta(db, org, { id: otro, esPorOmision: false }));
  assert.deepEqual(sin, { tipo: 'falta', que: 'sin_cuentas_de_meta' });

  await admin.query(`update identidad.conexiones_de_meta set estado = 'revocada' where org_id = $1 and origen = 'oauth'`, [org]);
  const caida = await conIdentidad((db) => resolverCuentasDeMeta(db, org, { id: z, esPorOmision: false }));
  assert.deepEqual(caida, { tipo: 'falta', que: 'conexion_de_meta_caida' });
  await admin.query(`update identidad.conexiones_de_meta set estado = 'activa' where org_id = $1 and origen = 'oauth'`, [org]);
});

test('lo que se pega en Ajustes llega a las conexiones, y quitarlo las borra', async () => {
  // La empresa cambia su cuenta: la conexión manual del principal suelta la vieja y toma la nueva.
  const nueva = 'act_3030000009';
  let r = await cargarDeLaEmpresa(pedirComo('/api/admin/credenciales', tokenAdmin, { metodo: 'PUT', cuerpo: { metaCuentaId: nueva } }));
  assert.equal(r.status, 200, await r.clone().text());
  let c = await cuentas();
  assert.equal(c[ACT_EMPRESA], undefined, 'la cuenta vieja de la empresa quedó');
  assert.deepEqual(c[nueva], { cliente: p, origen: 'manual', deQuien: p });

  // X pega un token nuevo: la conexión manual de X lo lee.
  r = await cargarConexion(pedirComo(`/api/admin/cuentas/${x}/conexion`, tokenAdmin, { metodo: 'PUT', cuerpo: { metaToken: 'meta-x-nuevo-303' } }), ctx(x));
  assert.equal(r.status, 200, await r.clone().text());
  const deX = await conIdentidad((db) => resolverCuentasDeMeta(db, org, { id: x, esPorOmision: false }));
  assert.ok(deX.tipo === 'listo' && deX.cuentas[0]?.token === 'meta-x-nuevo-303', 'el token nuevo de X no llegó');

  // Z pega una cuenta que ya tomó la conexión OAuth: no la pisa.
  r = await cargarConexion(pedirComo(`/api/admin/cuentas/${z}/conexion`, tokenAdmin, { metodo: 'PUT', cuerpo: { metaCuentaId: ACT_OAUTH } }), ctx(z));
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await cuentas())[ACT_OAUTH]?.origen, 'oauth', 'el token pegado pisó la cuenta conectada por el botón');

  // X quita su token: su conexión manual se va, y con ella su cuenta.
  r = await cargarConexion(pedirComo(`/api/admin/cuentas/${x}/conexion`, tokenAdmin, { metodo: 'PUT', cuerpo: { metaToken: null } }), ctx(x));
  assert.equal(r.status, 200, await r.clone().text());
  c = await cuentas();
  assert.equal(c[ACT_X], undefined, 'quitar el token dejó la cuenta de X');
  const deXAhora = await conIdentidad((db) => resolverCuentasDeMeta(db, org, { id: x, esPorOmision: false }));
  assert.deepEqual(deXAhora, { tipo: 'falta', que: 'sin_cuentas_de_meta' });
});
