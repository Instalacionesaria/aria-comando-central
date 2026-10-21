// EL CLIENTE FINAL LEE SÓLO LOS CLOSERS DE SUS CLIENTES, Y NO RECIBE A LAS PERSONAS DE LA EMPRESA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6, la `100`)
//
// La designación de los closers es de la empresa: la empresa la lee entera, con o sin foco en un cliente (la `093`).
// El cliente final (`app.toda_la_organizacion = 'no'`) la leía igual —desde el ámbito de su cliente, las filas de
// todos, con el usuario del CRM de cada closer en las otras subcuentas—, y su Sales le devolvía el uuid de cada persona.
//
//   · en la base, el cliente final lee sólo las filas de SUS clientes — mutación: la política de la `093` de vuelta;
//   · la empresa, enfocada en un cliente o entera, sigue leyendo todas — mutación: la política sólo para la lista;
//   · su `/api/sales` no trae el uuid de ninguna persona de la empresa: cada closer va con su rótulo, `closer-N`, el
//     mismo en la tabla y en la pantalla, y el mismo en dos lecturas — mutaciones: la ruta sin
//     `sinLasPersonasDeLaEmpresa`, y la función sin la pantalla;
//   · la empresa recibe lo de siempre — mutación: el rótulo también para ella.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos, type Ambito } from '../../lib/datos/contexto.ts';
import { GET as sales } from '../../app/api/sales/route.ts';
import { sinLasPersonasDeLaEmpresa, type LecturaDeSales } from '../../lib/negocio/lecturaDeSales.ts';

const SLUG = 'gamma-302';

let admin: Client;
let org: string;
let p: string;
let y: string;
/** X trabaja los dos clientes; W está designado sólo en el principal. */
let x: string;
let w: string;
let jefe: string;
let tokenDeY: string;
let tokenDeLaEmpresa: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from negocio.closer_asignado where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Una persona de la empresa con un rol de sistema; con cuentas, es un cliente final. */
async function persona(nombre: string, rol: string, cuentas: string[], secciones: string[]): Promise<string> {
  const u = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre, limitado_a_cuentas) values ($1, $2, $3) returning id`,
    [org, nombre, cuentas.length > 0],
  );
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`,
    [u.id, rol],
  );
  for (const s of secciones) await admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)`, [u.id, s]);
  for (const c of cuentas) {
    await admin.query(`insert into identidad.usuarios_cuentas (org_id, usuario_id, cuenta_id) values ($1, $2, $3)`, [org, u.id, c]);
  }
  return u.id;
}

/** Las filas de `closer_asignado` que la base deja leer desde un ámbito, como «persona@cliente:usuario del CRM». */
async function filasDesde(ambito: Ambito): Promise<string[]> {
  const f = await conOrganizacion(ambito, () =>
    datos().selectFrom('closer_asignado').select(['usuario_id', 'cuenta_id', 'crm_usuario_id']).execute(),
  );
  const quien = (u: string) => (u === x ? 'X' : u === w ? 'W' : u);
  const donde = (c: string) => (c === p ? 'P' : c === y ? 'Y' : c);
  return f.map((r) => `${quien(r.usuario_id)}@${donde(r.cuenta_id)}:${r.crm_usuario_id}`).sort();
}

type CuerpoDeSales = {
  closers: { filas: { usuarioId: string; nombre: string }[] };
  pantalla: { closers: { filas: { usuarioId: string; nombre: string }[] } };
};

async function salesDe(token: string): Promise<{ cuerpo: CuerpoDeSales; texto: string }> {
  const r = await leerRespuesta<CuerpoDeSales>(await sales(pedirComo('/api/sales?periodo=30d', token)));
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  return { cuerpo: r.cuerpo, texto: JSON.stringify(r.cuerpo) };
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 302', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  const segunda = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, zona_horaria) values ($1, 'Y 302', 'y-302', 'America/Lima') returning id`,
    [org],
  );
  assert.ok(principal && segunda);
  p = principal.id;
  y = segunda.id;

  jefe = await persona('Empresa 302', 'administrador', [], []);
  x = await persona('Closer X 302', 'usuario', [], ['closer']);
  w = await persona('Closer W 302', 'usuario', [], ['closer']);
  const clienteDeY = await persona('Cliente final de Y 302', 'usuario', [y], ['contacts', 'sales']);
  // X, designado primero, está vinculado en los dos clientes; W, después, sólo en el principal.
  await admin.query(
    `insert into negocio.closer_asignado (org_id, cuenta_id, usuario_id, crm_usuario_id, actualizado_el, actualizado_por) values
       ($1, $2, $4, 'uP', now() - interval '3 hours', $6),
       ($1, $3, $4, 'uY', now() - interval '2 hours', $6),
       ($1, $2, $5, 'uW', now() - interval '1 hour', $6)`,
    [org, p, y, x, w, jefe],
  );
  tokenDeY = await sesionDe(clienteDeY);
  tokenDeLaEmpresa = await sesionDe(jefe);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('en la base, el cliente final lee sólo los closers de sus clientes', async () => {
  assert.deepEqual(
    await filasDesde({ orgId: org, todaLaOrganizacion: false, cuentas: [y] }),
    ['X@Y:uY'],
    'el cliente final de Y leyó la designación de otro cliente, con el usuario del CRM de otra subcuenta',
  );
  assert.deepEqual(await filasDesde({ orgId: org, todaLaOrganizacion: false, cuentas: [p] }), ['W@P:uW', 'X@P:uP']);
});

test('la empresa, entera o enfocada en un cliente, sigue leyendo todos los closers', async () => {
  const todas = ['W@P:uW', 'X@P:uP', 'X@Y:uY'];
  assert.deepEqual(await filasDesde({ orgId: org, todaLaOrganizacion: true, cuentas: '*' }), todas);
  assert.deepEqual(
    await filasDesde({ orgId: org, todaLaOrganizacion: true, cuentas: [y] }),
    todas,
    'con el foco en Y, la empresa dejó de ver la designación de los closers de otro cliente',
  );
});

test('el Sales del cliente final no trae el uuid de ninguna persona: cada closer va con su rótulo, siempre el mismo', async () => {
  const primera = await salesDe(tokenDeY);
  for (const [quien, id] of [['X', x], ['W', w], ['la empresa', jefe]] as const) {
    assert.ok(!primera.texto.includes(id), `el Sales del cliente final trae el uuid de ${quien}`);
  }
  assert.deepEqual(primera.cuerpo.closers.filas.map((f) => [f.usuarioId, f.nombre]), [['closer-1', 'Closer 1']]);
  assert.deepEqual(primera.cuerpo.pantalla.closers.filas.map((f) => [f.usuarioId, f.nombre]), [['closer-1', 'Closer 1']]);
  const segunda = await salesDe(tokenDeY);
  assert.deepEqual(
    segunda.cuerpo.pantalla.closers.filas.map((f) => f.usuarioId),
    primera.cuerpo.pantalla.closers.filas.map((f) => f.usuarioId),
    'el rótulo cambió entre dos lecturas',
  );
});

test('la empresa recibe a sus closers como siempre, con su id', async () => {
  const { cuerpo } = await salesDe(tokenDeLaEmpresa);
  assert.deepEqual(cuerpo.closers.filas.map((f) => f.usuarioId), [x, w]);
  assert.deepEqual(cuerpo.pantalla.closers.filas.map((f) => [f.usuarioId, f.nombre]), [[x, 'Closer X 302'], [w, 'Closer W 302']]);
});

test('el rótulo es el número de la fila, el mismo en la tabla y en la pantalla, y nada más cambia', () => {
  const fila = (usuarioId: string, nombre: string) => ({ usuarioId, nombre, ventas: 1 });
  const lectura = {
    dinero: { mes: '2026-10' },
    closers: { filas: [fila('u-a', 'Closer 1'), fila('u-b', 'Closer 2')], aviso: null },
    pantalla: { closers: { filas: [fila('u-a', 'Closer 1'), fila('u-b', 'Closer 2')], aviso: 'nota' }, cifras: { n: 3 } },
  } as unknown as LecturaDeSales;
  const r = sinLasPersonasDeLaEmpresa(lectura) as unknown as {
    dinero: unknown;
    closers: { filas: { usuarioId: string; ventas: number }[] };
    pantalla: { closers: { filas: { usuarioId: string }[]; aviso: string }; cifras: unknown };
  };
  assert.deepEqual(r.closers.filas.map((f) => f.usuarioId), ['closer-1', 'closer-2']);
  assert.deepEqual(r.pantalla.closers.filas.map((f) => f.usuarioId), ['closer-1', 'closer-2']);
  assert.deepEqual(r.closers.filas.map((f) => f.ventas), [1, 1]);
  assert.equal(r.pantalla.closers.aviso, 'nota');
  assert.deepEqual(r.pantalla.cifras, { n: 3 });
  assert.deepEqual(r.dinero, { mes: '2026-10' });
  // La lectura de quien llama no se toca: la empresa sigue con la suya.
  assert.equal((lectura as unknown as { closers: { filas: { usuarioId: string }[] } }).closers.filas[0]!.usuarioId, 'u-a');
});
