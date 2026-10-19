// EL CLIENTE FINAL Y SUS CUENTAS: EL ALTA, LA ASIGNACIÓN Y EL FOCO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 6b)
//
//   · el alta de un cliente final: nace limitado, con sus cuentas, en la misma transacción; con pestañas que no son
//     del cliente, sin rol, o con una cuenta de otra empresa, se rechaza — mutación: no exigir las pestañas del
//     cliente, o no comprobar la empresa de las cuentas;
//   · reemplazar sus cuentas: nunca a cero, sólo a un cliente final, sólo cuentas de la empresa — mutación: aceptar
//     la lista vacía;
//   · el foco: la empresa enfoca uno de sus clientes y vuelve a todos; uno de otra empresa es 404; el cliente final
//     elige entre los suyos y no entre los ajenos — mutación: no comprobar que el cliente esté a la vista;
//   · cambiar de empresa vacía el foco: el cliente enfocado era de la anterior — mutación: no vaciarlo;
//   · el alta con más clientes que el tope del ámbito se rechaza con su motivo — mutación: sin el tope;
//   · cambiarle el rol: sólo uno restringido y sólo las pestañas del cliente — mutación: sin la regla en la ruta;
//   · un cliente de baja no traba a los demás: la lista no lo trae — mutación: la lista con los de baja.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { resolverSesion } from '../../lib/autorizacion/sesion.ts';
import { POST as altaDePersona } from '../../app/api/admin/usuarios/route.ts';
import { PUT as cuentasDeLaPersona } from '../../app/api/admin/usuarios/[id]/cuentas/route.ts';
import { POST as rolesDeLaPersona } from '../../app/api/admin/usuarios/[id]/roles/route.ts';
import { GET as personas } from '../../app/api/usuarios/route.ts';
import { randomUUID } from 'node:crypto';
import { MOTIVOS_DEL_CLIENTE } from '../../lib/autorizacion/cliente.ts';
import { MAXIMO_DE_CUENTAS } from '../../lib/datos/contexto.ts';
import { PATCH as cambiarDeCliente } from '../../app/api/auth/cliente/route.ts';
import { PATCH as cambiarDeEmpresa } from '../../app/api/auth/sesion/route.ts';

const SLUG = 'gamma-267';
const CORREO = 'cliente-final-267@ejemplo.test';

let admin: Client;
let org: string;
let cuentaA: string;
let cuentaB: string;
let ajena: string;
let tokenAdmin: string;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  // Las asignaciones antes que las personas: el rol, las pestañas y las cuentas del cliente final dicen quién las dio.
  for (const t of ['usuarios_roles', 'usuarios_secciones', 'usuarios_cuentas']) {
    await admin.query(`delete from identidad.${t} where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  }
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(admin, `insert into identidad.organizaciones (nombre, slug) values ('Gamma 267', $1) returning id`, [SLUG]);
  assert.ok(o);
  org = o.id;
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1`, [org]);
  const b = await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'B 267', 'b-267') returning id`, [org]);
  const x = await unaFila<{ id: string }>(
    admin,
    `select c.id from identidad.cuentas c join identidad.organizaciones o on o.id = c.org_id where o.slug = 'beta'`,
  );
  assert.ok(a && b && x);
  cuentaA = a.id;
  cuentaB = b.id;
  ajena = x.id;
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, 'Admin 267') returning id`, [org]);
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'administrador' and org_id is null`,
    [u.id],
  );
  tokenAdmin = await sesionDe(u.id);
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

const alta = (cuerpo: Record<string, unknown>) =>
  altaDePersona(pedirComo('/api/admin/usuarios', tokenAdmin, { metodo: 'POST', cuerpo: { nombre: 'Cliente final 267', email: CORREO, ...cuerpo } }));

test('el alta de un cliente final: con pestañas ajenas, sin rol o con una cuenta de otra empresa, se rechaza', async () => {
  const ajenas = await leerRespuesta<{ detalle: string }>(await alta({ rol: 'usuario', secciones: ['tools'], cuentas: [cuentaA] }));
  assert.equal(ajenas.estado, 400);
  const sinRol = await alta({ secciones: ['contacts'], cuentas: [cuentaA] });
  assert.equal(sinRol.status, 400);
  const deOtra = await alta({ rol: 'usuario', secciones: ['contacts'], cuentas: [ajena] });
  assert.equal(deOtra.status, 404);
  const n = await unaFila<{ n: number }>(admin, `select count(*)::int as n from identidad.usuarios where email = $1`, [CORREO]);
  assert.equal(n?.n, 0, 'un alta rechazada dejó a la persona creada');
});

test('el alta de un cliente final: nace limitado, con sus cuentas', async () => {
  const r = await leerRespuesta<{ id: string; cuentas: string[] }>(await alta({ rol: 'usuario', secciones: ['contacts', 'sales'], cuentas: [cuentaA] }));
  assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
  const f = await unaFila<{ limitado: boolean; cuentas: string[] }>(
    admin,
    `select u.limitado_a_cuentas as limitado, array(select cuenta_id::text from identidad.usuarios_cuentas where usuario_id = u.id) as cuentas
       from identidad.usuarios u where u.id = $1`,
    [r.cuerpo.id],
  );
  assert.deepEqual(f, { limitado: true, cuentas: [cuentaA] });
});

test('reemplazar sus cuentas: nunca a cero, sólo a un cliente final, sólo cuentas de la empresa', async () => {
  const cliente = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = $1`, [CORREO]);
  const admin267 = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where org_id = $1 and nombre = 'Admin 267'`, [org]);
  assert.ok(cliente && admin267);
  const pedir = (id: string, cuentas: unknown) =>
    cuentasDeLaPersona(pedirComo(`/api/admin/usuarios/${id}/cuentas`, tokenAdmin, { metodo: 'PUT', cuerpo: { cuentas } }), ctx(id));
  assert.equal((await pedir(cliente.id, [])).status, 400, 'un cliente final quedó sin cuentas');
  assert.equal((await pedir(admin267.id, [cuentaA])).status, 400, 'una persona sin el límite recibió cuentas');
  assert.equal((await pedir(cliente.id, [cuentaA, ajena])).status, 404, 'una cuenta de otra empresa se asignó');
  const ok = await pedir(cliente.id, [cuentaA, cuentaB]);
  assert.equal(ok.status, 200, await ok.clone().text());
  const f = await unaFila<{ n: number }>(admin, `select count(*)::int as n from identidad.usuarios_cuentas where usuario_id = $1`, [cliente.id]);
  assert.equal(f?.n, 2);
});

test('el foco: la empresa enfoca un cliente suyo y vuelve a todos; uno ajeno es 404', async () => {
  const enfocar = (token: string, cuentaId: string | null) =>
    cambiarDeCliente(pedirComo('/api/auth/cliente', token, { metodo: 'PATCH', cuerpo: { cuentaId } }));
  assert.equal((await enfocar(tokenAdmin, ajena)).status, 404);
  assert.equal((await enfocar(tokenAdmin, cuentaB)).status, 200);
  assert.equal((await resolverSesion(tokenAdmin))?.cuentas.activa, cuentaB);
  assert.equal((await enfocar(tokenAdmin, null)).status, 200);
  assert.equal((await resolverSesion(tokenAdmin))?.cuentas.activa, null);

  // El cliente final elige entre las suyas (tiene A y B desde la prueba anterior), y no entre las ajenas.
  const cliente = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = $1`, [CORREO]);
  await admin.query(`update identidad.usuarios set debe_cambiar_password = false where id = $1`, [cliente!.id]);
  const tokenCliente = await sesionDe(cliente!.id);
  assert.equal((await enfocar(tokenCliente, cuentaB)).status, 200, 'el cliente final no pudo elegir entre sus cuentas');
  assert.equal((await enfocar(tokenCliente, ajena)).status, 404);
});

test('cambiar de empresa vacía el foco en un cliente', async () => {
  const aria = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`);
  const suya = await unaFila<{ id: string }>(
    admin,
    `select c.id from identidad.cuentas c join identidad.organizaciones o on o.id = c.org_id where o.es_principal`,
  );
  assert.ok(aria && suya);
  const token = await sesionDe(aria.id);
  try {
    await admin.query(`update identidad.sesiones set cuenta_activa = $1 where usuario_id = $2 and cuenta_activa is null`, [suya.id, aria.id]);
    assert.equal((await resolverSesion(token))?.cuentas.activa, suya.id);
    const r = await cambiarDeEmpresa(pedirComo('/api/auth/sesion', token, { metodo: 'PATCH', cuerpo: { orgId: org } }));
    assert.equal(r.status, 200, await r.clone().text());
    const f = await unaFila<{ cuenta_activa: string | null }>(
      admin,
      `select cuenta_activa from identidad.sesiones where usuario_id = $1 and org_activa = $2`,
      [aria.id, org],
    );
    assert.equal(f?.cuenta_activa, null, 'el foco de la empresa anterior siguió puesto');
  } finally {
    await admin.query(`delete from identidad.sesiones where usuario_id = $1 and (org_activa = $2 or cuenta_activa = $3)`, [aria.id, org, suya.id]);
  }
});

test('el alta con más clientes que el tope del ámbito se rechaza con su motivo, no con un 404', async () => {
  const muchas = Array.from({ length: MAXIMO_DE_CUENTAS + 1 }, () => randomUUID());
  const r = await leerRespuesta<{ detalle: string }>(
    await alta({ email: 'tope-267@ejemplo.test', rol: 'usuario', secciones: ['contacts'], cuentas: muchas }),
  );
  assert.equal(r.estado, 400, JSON.stringify(r.cuerpo));
  assert.match(String(r.cuerpo.detalle), new RegExp(`${MAXIMO_DE_CUENTAS}`));
});

test('cambiarle el rol a un cliente final: sólo uno restringido, y sólo las pestañas del cliente', async () => {
  const cliente = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = $1`, [CORREO]);
  assert.ok(cliente);
  const pedir = (cuerpo: Record<string, unknown>) =>
    rolesDeLaPersona(pedirComo(`/api/admin/usuarios/${cliente.id}/roles`, tokenAdmin, { metodo: 'POST', cuerpo }), ctx(cliente.id));
  const administrador = await leerRespuesta<{ detalle: string }>(await pedir({ roles: ['administrador'] }));
  assert.deepEqual({ estado: administrador.estado, detalle: administrador.cuerpo.detalle }, { estado: 400, detalle: MOTIVOS_DEL_CLIENTE.rol });
  const ajenas = await leerRespuesta<{ detalle: string }>(await pedir({ roles: ['usuario'], secciones: ['contacts', 'tools'] }));
  assert.deepEqual({ estado: ajenas.estado, detalle: ajenas.cuerpo.detalle }, { estado: 400, detalle: MOTIVOS_DEL_CLIENTE.secciones });
  const bien = await pedir({ roles: ['usuario'], secciones: ['contacts'] });
  assert.equal(bien.status, 200, await bien.clone().text());
});

test('un cliente de baja no traba a los demás: la lista no lo trae, y el reemplazo funciona', async () => {
  const cliente = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = $1`, [CORREO]);
  assert.ok(cliente);
  await admin.query(`delete from identidad.usuarios_cuentas where usuario_id = $1`, [cliente.id]);
  await admin.query(
    `insert into identidad.usuarios_cuentas (org_id, usuario_id, cuenta_id) values ($1, $2, $3), ($1, $2, $4)`,
    [org, cliente.id, cuentaA, cuentaB],
  );
  await admin.query(`update identidad.cuentas set estado = 'baja', baja_el = now() where id = $1`, [cuentaB]);
  try {
    const r = await leerRespuesta<{ usuarios: { id: string; cuentas: string[] }[] }>(await personas(pedirComo('/api/usuarios', tokenAdmin)));
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    const suyo = r.cuerpo.usuarios.find((u) => u.id === cliente.id);
    assert.deepEqual(suyo?.cuentas, [cuentaA], 'la lista trae el cliente de baja: la pantalla lo manda de vuelta y el PUT lo rechaza');
    const reemplazo = await cuentasDeLaPersona(
      pedirComo(`/api/admin/usuarios/${cliente.id}/cuentas`, tokenAdmin, { metodo: 'PUT', cuerpo: { cuentas: suyo?.cuentas } }),
      ctx(cliente.id),
    );
    assert.equal(reemplazo.status, 200, await reemplazo.clone().text());
  } finally {
    await admin.query(`update identidad.cuentas set estado = 'activa', baja_el = null where id = $1`, [cuentaB]);
  }
});
