// LOS CLIENTES DE UNA EMPRESA: QUIÉN LOS DA DE ALTA, QUIÉN LOS EDITA, QUIÉN LOS VINCULA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 6)
//
// Ajustes › Clientes, por sus rutas, con sesiones reales:
//
//   · el administrador de una empresa da de alta y edita a SUS clientes; con el nicho confirmado, firma él — y con
//     el `orgId` de otra empresa recibe 404 — mutación: `empresaDestino` que acepte cualquier `orgId`;
//   · un `usuario` no ve la pestaña: le falta `cuentas.ver` — mutación: el reparto sin `cuentas.%`;
//   · ARIA da de alta en otra empresa con `orgId`, y el nicho lo confirma la plataforma, sin persona;
//   · el cliente principal (la cuenta por omisión) no se pausa; otro sí, y su baja lleva fecha;
//   · vincular la subcuenta del CRM es sólo de ARIA; una location que ya es de otro cliente da 409 sin decir de quién
//     — mutación: darle `cuentas.vincular` al administrador, o no traducir el `23505`;
//   · un nicho que no está en el catálogo es 400, no 500;
//   · cada alta queda en la auditoría.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { GET as listar, POST as crear } from '../../app/api/admin/cuentas/route.ts';
import { PATCH as editar } from '../../app/api/admin/cuentas/[id]/route.ts';
import { PATCH as vincular } from '../../app/api/admin/cuentas/[id]/vinculo/route.ts';

const SLUG = 'gamma-268';

let admin: Client;
let org: string;
let porOmision: string;
let nicho: string;
let tokenAdmin: string;
let tokenUsuario: string;
let tokenAria: string;
let adminDeGamma: string;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  // Los clientes antes que las personas: uno con el nicho confirmado apunta a quien lo confirmó.
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function persona(nombre: string, rol: string, secciones: string[]): Promise<string> {
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, $2) returning id`, [org, nombre]);
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`,
    [u.id, rol],
  );
  for (const s of secciones) await admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)`, [u.id, s]);
  return u.id;
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(admin, `insert into identidad.organizaciones (nombre, slug) values ('Gamma 268', $1) returning id`, [SLUG]);
  assert.ok(o);
  org = o.id;
  const c = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1`, [org]);
  const n = await unaFila<{ clave: string }>(admin, `select clave from catalogo.nichos where nivel = 2 order by clave limit 1`);
  const aria = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`);
  assert.ok(c && n && aria, 'falta el sembrado');
  porOmision = c.id;
  nicho = n.clave;
  adminDeGamma = await persona('Admin 268', 'administrador', []);
  tokenAdmin = await sesionDe(adminDeGamma);
  tokenUsuario = await sesionDe(await persona('Usuario 268', 'usuario', ['contacts', 'clientes']));
  tokenAria = await sesionDe(aria.id);
});

after(async () => {
  try {
    await admin.query(
      `delete from identidad.sesiones where usuario_id = (select id from identidad.usuarios where email = 'fundadora@principal.ejemplo')
         and creada_el > now() - interval '1 hour' and cuenta_activa is null and org_activa is null`,
    );
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('el administrador da de alta un cliente de su empresa, con el nicho confirmado por él', async () => {
  const r = await leerRespuesta<{ id: string }>(
    await crear(pedirComo('/api/admin/cuentas', tokenAdmin, { metodo: 'POST', cuerpo: { nombre: 'Clínica Ñandú', nicho, confirmarNicho: true, pais: 'PE' } })),
  );
  assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
  const f = await unaFila<{ slug: string; nicho_confirmado_desde: string; nicho_confirmado_por: string; org_id: string }>(
    admin,
    `select slug, nicho_confirmado_desde, nicho_confirmado_por, org_id from identidad.cuentas where id = $1`,
    [r.cuerpo.id],
  );
  assert.deepEqual(f, { slug: 'clinica-nandu', nicho_confirmado_desde: 'organizacion', nicho_confirmado_por: adminDeGamma, org_id: org });
  const lista = await leerRespuesta<{ clientes: { id: string; esPorOmision: boolean }[]; catalogo: { nichos: unknown[] } }>(
    await listar(pedirComo('/api/admin/cuentas', tokenAdmin)),
  );
  assert.equal(lista.estado, 200);
  assert.deepEqual(lista.cuerpo.clientes.map((x) => x.esPorOmision), [true, false]);
  assert.ok(lista.cuerpo.catalogo.nichos.length > 0, 'el formulario no trae el catálogo de nichos');
  const auditado = await unaFila<{ n: number }>(
    admin,
    `select count(*)::int as n from identidad.auditoria_accesos where accion = 'cuenta_creada' and detalle->>'objetivo' = $1`,
    [r.cuerpo.id],
  );
  assert.equal(auditado?.n, 1, 'el alta no quedó en la auditoría');
});

test('con el orgId de otra empresa, el administrador recibe 404', async () => {
  const beta = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'beta'`);
  const r = await crear(pedirComo('/api/admin/cuentas', tokenAdmin, { metodo: 'POST', cuerpo: { nombre: 'Intruso', orgId: beta!.id } }));
  assert.equal(r.status, 404);
  const l = await listar(pedirComo(`/api/admin/cuentas?orgId=${beta!.id}`, tokenAdmin));
  assert.equal(l.status, 404);
});

test('un usuario no ve la pestaña: le falta la capacidad', async () => {
  const r = await leerRespuesta<{ codigo: string }>(await listar(pedirComo('/api/admin/cuentas', tokenUsuario)));
  assert.deepEqual({ estado: r.estado, codigo: r.cuerpo.codigo }, { estado: 403, codigo: 'sin_permiso' });
});

test('ARIA da de alta en otra empresa, y el nicho lo confirma la plataforma, sin persona', async () => {
  const r = await leerRespuesta<{ id: string }>(
    await crear(pedirComo('/api/admin/cuentas', tokenAria, { metodo: 'POST', cuerpo: { nombre: 'Desde ARIA', orgId: org, nicho, confirmarNicho: true } })),
  );
  assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
  const f = await unaFila<{ org_id: string; nicho_confirmado_desde: string; nicho_confirmado_por: string | null }>(
    admin,
    `select org_id, nicho_confirmado_desde, nicho_confirmado_por from identidad.cuentas where id = $1`,
    [r.cuerpo.id],
  );
  assert.deepEqual(f, { org_id: org, nicho_confirmado_desde: 'plataforma', nicho_confirmado_por: null });
});

test('el cliente principal no se pausa; otro sí, y su baja lleva fecha', async () => {
  const principal = await leerRespuesta<{ codigo: string }>(
    await editar(pedirComo(`/api/admin/cuentas/${porOmision}`, tokenAdmin, { metodo: 'PATCH', cuerpo: { estado: 'pausada' } }), ctx(porOmision)),
  );
  assert.equal(principal.estado, 400, JSON.stringify(principal.cuerpo));
  const otro = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and not es_por_omision limit 1`, [org]);
  assert.ok(otro);
  const pausa = await editar(pedirComo(`/api/admin/cuentas/${otro.id}`, tokenAdmin, { metodo: 'PATCH', cuerpo: { estado: 'baja' } }), ctx(otro.id));
  assert.equal(pausa.status, 200, await pausa.clone().text());
  const f = await unaFila<{ estado: string; con_fecha: boolean }>(
    admin,
    `select estado, baja_el is not null as con_fecha from identidad.cuentas where id = $1`,
    [otro.id],
  );
  assert.deepEqual(f, { estado: 'baja', con_fecha: true });
  const vuelta = await editar(pedirComo(`/api/admin/cuentas/${otro.id}`, tokenAdmin, { metodo: 'PATCH', cuerpo: { estado: 'activa' } }), ctx(otro.id));
  assert.equal(vuelta.status, 200);
  // Un cliente de otra empresa no se ve: 404.
  const ajena = await unaFila<{ id: string }>(
    admin,
    `select c.id from identidad.cuentas c join identidad.organizaciones o on o.id = c.org_id where o.slug = 'beta'`,
  );
  const r = await editar(pedirComo(`/api/admin/cuentas/${ajena!.id}`, tokenAdmin, { metodo: 'PATCH', cuerpo: { nombre: 'Mío' } }), ctx(ajena!.id));
  assert.equal(r.status, 404);
});

test('vincular la subcuenta del CRM es sólo de ARIA, y una location tomada da 409', async () => {
  const delAdmin = await leerRespuesta<{ codigo: string }>(
    await vincular(
      pedirComo(`/api/admin/cuentas/${porOmision}/vinculo`, tokenAdmin, { metodo: 'PATCH', cuerpo: { crmCuentaId: 'loc268a' } }),
      ctx(porOmision),
    ),
  );
  assert.deepEqual({ estado: delAdmin.estado, codigo: delAdmin.cuerpo.codigo }, { estado: 403, codigo: 'sin_permiso' });

  const otro = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and not es_por_omision limit 1`, [org]);
  assert.ok(otro);
  const ok1 = await vincular(
    pedirComo(`/api/admin/cuentas/${porOmision}/vinculo`, tokenAria, { metodo: 'PATCH', cuerpo: { orgId: org, crmCuentaId: 'loc268a' } }),
    ctx(porOmision),
  );
  assert.equal(ok1.status, 200, await ok1.clone().text());
  const tomada = await leerRespuesta<{ codigo: string; detalle?: string }>(
    await vincular(
      pedirComo(`/api/admin/cuentas/${otro.id}/vinculo`, tokenAria, { metodo: 'PATCH', cuerpo: { orgId: org, crmCuentaId: 'loc268a' } }),
      ctx(otro.id),
    ),
  );
  assert.deepEqual({ estado: tomada.estado, codigo: tomada.cuerpo.codigo }, { estado: 409, codigo: 'subcuenta_en_uso' });
  assert.doesNotMatch(JSON.stringify(tomada.cuerpo), /Gamma|gamma|loc268a/, 'el rechazo dijo de quién es la location');
});

test('un nicho que no está en el catálogo es 400, no 500', async () => {
  const r = await crear(pedirComo('/api/admin/cuentas', tokenAdmin, { metodo: 'POST', cuerpo: { nombre: 'Sin nicho real', nicho: 'no_existe_268' } }));
  assert.equal(r.status, 400, await r.clone().text());
});
