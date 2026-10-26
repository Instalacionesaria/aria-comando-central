// «CONECTAR CON META»: EL VIAJE, EL CANJE, LAS CUENTAS Y A QUÉ CLIENTE VAN. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (Meta directo, M2, 2026-10-26)
//
// Una empresa con tres clientes —P (el principal), X y Z— conecta Meta por Facebook Login for Business contra un Meta
// falso (el `fetch` de la prueba), con el molde de la GoHighLevel falsa de la 280:
//
//   · sin la app de Meta configurada en el servidor, conectar es un 409 que lo dice; con la app, la respuesta es la URL
//     del diálogo de Meta con la app, la configuración, el retorno y un `state` cuyo hash queda atado a la sesión;
//   · el principal conecta como empresa (409 desde Clientes), un cliente de otra empresa es 404, y sin
//     `credenciales.editar` es 403;
//   · el canje manda el secreto en el CUERPO (nunca en una URL), pide cada dato con su `appsecret_proof`, guarda el
//     token cifrado y las cuentas que Meta dio — mutación: el secreto en la URL;
//   · el `state` es de un solo uso y de esa sesión: repetirlo, usarlo desde otra sesión o vencido es el mismo 409 —
//     mutación: no comparar la sesión;
//   · conectó la EMPRESA con varios clientes: las cuentas quedan sin asignar y se asignan a mano; conectó un CLIENTE:
//     van a ese cliente, y no se pueden mover a otro;
//   · volver a conectar el mismo negocio reemplaza el token sin sumar conexiones, y la cuenta que se desmarcó en Meta se
//     suelta;
//   · Meta rechaza el código: 409 con nuestro texto, sin el mensaje de Meta;
//   · desconectar borra la conexión y sus cuentas; todo queda auditado; ninguna respuesta lleva un token.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { descifrar } from '../../lib/credenciales/cifrado.ts';
import { resolverCuentasDeMeta } from '../../lib/credenciales/resolver.ts';
import { GET as verMeta } from '../../app/api/admin/meta/route.ts';
import { POST as conectarMeta } from '../../app/api/admin/meta/conectar/route.ts';
import { POST as canjear } from '../../app/api/admin/meta/canje/route.ts';
import { PUT as asignar } from '../../app/api/admin/meta/cuentas/[act]/route.ts';
import { DELETE as desconectar } from '../../app/api/admin/meta/conexiones/[id]/route.ts';

const SLUG = 'gamma-304';
const APP = { META_APP_ID: '3040000000001', META_APP_SECRET: 'secreto-de-la-app-304', META_CONFIG_ID: '3040000000002' };
const NEGOCIO_AGENCIA = '3041111111111';
const NEGOCIO_DE_X = '3042222222222';

let admin: Client;
let org: string;
let otraOrg: string;
let deOtra: string;
let p: string;
let x: string;
let z: string;
let tokenAdmin: string;
let otraSesion: string;
let tokenUsuario: string;
const previas: Record<string, string | undefined> = {};
const fetchOriginal = globalThis.fetch;

/** Lo que el Meta falso recibió. */
const llamadas: { url: string; metodo: string; auth: string; cuerpo: string }[] = [];
/** Qué cuentas da cada token, y de qué negocio es. El token es `bisu-<code>`. */
const CUENTAS_POR_CODE: Record<string, { negocio: string; cuentas: string[] }> = {
  agencia: { negocio: NEGOCIO_AGENCIA, cuentas: ['act_3040000000011', 'act_3040000000012'] },
  'agencia-de-nuevo': { negocio: NEGOCIO_AGENCIA, cuentas: ['act_3040000000011'] },
  'de-x': { negocio: NEGOCIO_DE_X, cuentas: ['act_3040000000021'] },
};

const ctxAct = (act: string) => ({ params: Promise.resolve({ act }) });
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });

async function limpiar(): Promise<void> {
  for (const slug of [SLUG, `${SLUG}-otra`]) {
    const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [slug]);
    if (!o) continue;
    await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
    await admin.query(`delete from identidad.conexiones_de_meta where org_id = $1`, [o.id]);
    await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
    await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
    await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
  }
}

async function organizacion(nombre: string, slug: string): Promise<{ id: string; principal: string }> {
  const o = await unaFila<{ id: string }>(admin, `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ($1, $2, 'America/Lima') returning id`, [nombre, slug]);
  assert.ok(o);
  const c = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [o.id]);
  assert.ok(c);
  return { id: o.id, principal: c.id };
}

async function cliente(nombre: string, slug: string, enOrg = org): Promise<string> {
  const c = await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, $2, $3) returning id`, [enOrg, nombre, slug]);
  assert.ok(c);
  return c.id;
}

async function persona(nombre: string, rol: string): Promise<string> {
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, $2) returning id`, [org, nombre]);
  assert.ok(u);
  await admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = $2 and org_id is null`, [u.id, rol]);
  return u.id;
}

/** El `state` de la URL del diálogo. */
function stateDe(url: string): string {
  const s = new URL(url).searchParams.get('state');
  assert.ok(s, 'la URL del diálogo no trae state');
  return s;
}

/** Un viaje completo: conectar (para un cliente o la empresa) y canjear el code. */
async function viaje(code: string, cuentaId: string | null, token = tokenAdmin) {
  const c = await leerRespuesta<{ url: string }>(await conectarMeta(pedirComo('/api/admin/meta/conectar', token, { metodo: 'POST', cuerpo: { cuentaId } })));
  assert.equal(c.estado, 200, JSON.stringify(c.cuerpo));
  return leerRespuesta<Record<string, unknown>>(
    await canjear(pedirComo('/api/admin/meta/canje', token, { metodo: 'POST', cuerpo: { code, state: stateDe(c.cuerpo.url) } })),
  );
}

async function cuentasDeLaOrg(): Promise<Record<string, { cliente: string | null; negocio: string | null }>> {
  const r = await filas<{ act_id: string; cuenta_id: string | null; negocio_de_meta_id: string | null }>(
    admin,
    `select p.act_id, p.cuenta_id, c.negocio_de_meta_id from identidad.cuentas_publicitarias_de_meta p
       join identidad.conexiones_de_meta c on c.org_id = p.org_id and c.id = p.conexion_id where p.org_id = $1`,
    [org],
  );
  return Object.fromEntries(r.map((f) => [f.act_id, { cliente: f.cuenta_id, negocio: f.negocio_de_meta_id }]));
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  for (const k of Object.keys(APP)) previas[k] = process.env[k];
  // Meta falso: canjea `code` por `bisu-<code>`, y responde `me` y `me/adaccounts` según el token.
  globalThis.fetch = (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = String(entrada);
    const auth = (new Headers(opciones?.headers).get('authorization') ?? '').replace(/^Bearer /, '');
    const cuerpo = typeof opciones?.body === 'string' ? opciones.body : '';
    llamadas.push({ url, metodo: opciones?.method ?? 'GET', auth, cuerpo });
    const u = new URL(url);
    const responder = (datos: unknown, estado = 200) => new Response(JSON.stringify(datos), { status: estado });
    if (u.pathname.endsWith('/oauth/access_token')) {
      const code = new URLSearchParams(cuerpo).get('code') ?? '';
      if (!CUENTAS_POR_CODE[code]) return responder({ error: { message: 'Invalid verification code format.', code: 100 } }, 400);
      return responder({ access_token: `bisu-${code}`, token_type: 'bearer' });
    }
    const code = auth.replace(/^bisu-/, '');
    const datos = CUENTAS_POR_CODE[code];
    if (!datos) return responder({ error: { code: 190 } }, 400);
    const prueba = createHmac('sha256', APP.META_APP_SECRET).update(auth).digest('hex');
    if (u.searchParams.get('appsecret_proof') !== prueba) return responder({ error: { code: 100, message: 'Invalid appsecret_proof' } }, 400);
    if (u.pathname.endsWith('/me')) return responder({ id: '1', client_business_id: datos.negocio });
    if (u.pathname.endsWith('/me/adaccounts')) {
      return responder({
        data: datos.cuentas.map((id) => ({ id, name: `Cuenta ${id}`, currency: 'PEN', timezone_name: 'America/Lima', account_status: 1 })),
        paging: { cursors: { after: 'x' } },
      });
    }
    return responder({ error: { code: 100 } }, 400);
  }) as typeof globalThis.fetch;

  admin = await conectar('admin');
  await limpiar();
  const g = await organizacion('Gamma 304', SLUG);
  org = g.id;
  p = g.principal;
  x = await cliente('Segunda 304', 'segunda-304');
  z = await cliente('Tercera 304', 'tercera-304');
  const o = await organizacion('Otra 304', `${SLUG}-otra`);
  otraOrg = o.id;
  deOtra = await cliente('De otra 304', 'de-otra-304', otraOrg);
  const a = await persona('Admin 304', 'administrador');
  tokenAdmin = await sesionDe(a);
  otraSesion = await sesionDe(a);
  tokenUsuario = await sesionDe(await persona('Usuario 304', 'usuario'));
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  for (const [k, v] of Object.entries(previas)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('sin la app de Meta configurada, conectar dice que falta; con ella, devuelve el diálogo de Meta', async () => {
  for (const k of Object.keys(APP)) delete process.env[k];
  const sin = await leerRespuesta<{ codigo: string }>(await conectarMeta(pedirComo('/api/admin/meta/conectar', tokenAdmin, { metodo: 'POST', cuerpo: {} })));
  assert.equal(sin.estado, 409);
  assert.equal(sin.cuerpo.codigo, 'meta_sin_configurar');

  Object.assign(process.env, APP);
  const r = await leerRespuesta<{ url: string }>(await conectarMeta(pedirComo('/api/admin/meta/conectar', tokenAdmin, { metodo: 'POST', cuerpo: {} })));
  assert.equal(r.estado, 200);
  const u = new URL(r.cuerpo.url);
  assert.equal(u.host, 'www.facebook.com');
  assert.match(u.pathname, /^\/v\d+\.\d+\/dialog\/oauth$/);
  assert.equal(u.searchParams.get('client_id'), APP.META_APP_ID);
  assert.equal(u.searchParams.get('config_id'), APP.META_CONFIG_ID);
  assert.equal(u.searchParams.get('redirect_uri'), `https://${DOMINIO}/meta/retorno`);
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.ok(!r.cuerpo.url.includes(APP.META_APP_SECRET), 'el secreto de la app viajó en la URL del diálogo');
  // Sólo el hash del state, atado a la sesión de quien conectó.
  const hash = createHash('sha256').update(stateDe(r.cuerpo.url)).digest('hex');
  const fila = await unaFila<{ n: number }>(
    admin,
    `select count(*)::int as n from identidad.estados_de_oauth e join identidad.sesiones s on s.id = e.sesion_id where e.hash = $1 and e.org_id = $2 and e.cuenta_id is null`,
    [hash, org],
  );
  assert.equal(fila?.n, 1);
});

test('el principal conecta como empresa, un cliente de otra empresa no existe, y sin la capacidad no se conecta', async () => {
  const principal = await conectarMeta(pedirComo('/api/admin/meta/conectar', tokenAdmin, { metodo: 'POST', cuerpo: { cuentaId: p } }));
  assert.equal(principal.status, 409);
  const ajeno = await conectarMeta(pedirComo('/api/admin/meta/conectar', tokenAdmin, { metodo: 'POST', cuerpo: { cuentaId: deOtra } }));
  assert.equal(ajeno.status, 404);
  const sinPermiso = await conectarMeta(pedirComo('/api/admin/meta/conectar', tokenUsuario, { metodo: 'POST', cuerpo: {} }));
  assert.equal(sinPermiso.status, 403);
});

test('la empresa conecta: el secreto va en el cuerpo, todo con su prueba, y con varios clientes las cuentas quedan sin asignar', async () => {
  llamadas.length = 0;
  const r = await viaje('agencia', null);
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.cuentasConectadas, 2);

  const canje = llamadas.find((l) => l.url.includes('/oauth/access_token'));
  assert.ok(canje && canje.metodo === 'POST', 'el canje no fue un POST');
  assert.ok(!canje.url.includes(APP.META_APP_SECRET) && !canje.url.includes('client_secret'), 'el secreto de la app viajó en la URL');
  assert.equal(new URLSearchParams(canje.cuerpo).get('client_secret'), APP.META_APP_SECRET);
  for (const l of llamadas.filter((l) => !l.url.includes('/oauth/'))) {
    assert.ok(!l.url.includes('bisu-'), 'el token viajó en la URL');
    assert.ok(new URL(l.url).searchParams.get('appsecret_proof'), `${l.url} sin appsecret_proof`);
  }

  const conexion = await unaFila<{ token_cifrado: string; negocio_de_meta_id: string; cuenta_id: string | null; origen: string; usuario_de_meta_id: string | null }>(
    admin,
    `select token_cifrado, negocio_de_meta_id, cuenta_id, origen, usuario_de_meta_id from identidad.conexiones_de_meta where org_id = $1`,
    [org],
  );
  assert.ok(conexion);
  assert.equal(descifrar(conexion.token_cifrado), 'bisu-agencia');
  assert.deepEqual([conexion.negocio_de_meta_id, conexion.cuenta_id, conexion.origen], [NEGOCIO_AGENCIA, null, 'oauth']);
  // El id en la app del dueño del token (`104`): con él la encuentran los avisos de Meta (M6).
  assert.equal(conexion.usuario_de_meta_id, '1', 'la conexión no guardó a quién pertenece el token');
  assert.deepEqual(await cuentasDeLaOrg(), {
    act_3040000000011: { cliente: null, negocio: NEGOCIO_AGENCIA },
    act_3040000000012: { cliente: null, negocio: NEGOCIO_AGENCIA },
  });
  assert.ok(!JSON.stringify(r.cuerpo).includes('bisu-'), 'la respuesta del canje lleva el token');
});

test('el state es de un solo uso, de esa sesión y no vencido', async () => {
  const c = await leerRespuesta<{ url: string }>(await conectarMeta(pedirComo('/api/admin/meta/conectar', tokenAdmin, { metodo: 'POST', cuerpo: {} })));
  const state = stateDe(c.cuerpo.url);
  // Desde otra sesión de la misma persona: no vale (y lo consume).
  const ajena = await canjear(pedirComo('/api/admin/meta/canje', otraSesion, { metodo: 'POST', cuerpo: { code: 'agencia', state } }));
  assert.equal(ajena.status, 409);
  const repetida = await canjear(pedirComo('/api/admin/meta/canje', tokenAdmin, { metodo: 'POST', cuerpo: { code: 'agencia', state } }));
  assert.equal(repetida.status, 409);

  const d = await leerRespuesta<{ url: string }>(await conectarMeta(pedirComo('/api/admin/meta/conectar', tokenAdmin, { metodo: 'POST', cuerpo: {} })));
  const otro = stateDe(d.cuerpo.url);
  await admin.query(`update identidad.estados_de_oauth set creado_el = now() - interval '1 hour', vence_el = now() - interval '1 minute' where hash = $1`, [
    createHash('sha256').update(otro).digest('hex'),
  ]);
  const vencido = await leerRespuesta<{ codigo: string }>(await canjear(pedirComo('/api/admin/meta/canje', tokenAdmin, { metodo: 'POST', cuerpo: { code: 'agencia', state: otro } })));
  assert.equal(vencido.estado, 409);
  assert.equal(vencido.cuerpo.codigo, 'viaje_a_meta_vencido');
});

test('la empresa asigna sus cuentas a sus clientes, y el cliente las lee con el token de la empresa', async () => {
  const r = await asignar(pedirComo('/api/admin/meta/cuentas/act_3040000000011', tokenAdmin, { metodo: 'PUT', cuerpo: { cuentaId: x } }), ctxAct('act_3040000000011'));
  assert.equal(r.status, 200, await r.clone().text());
  const deX = await conIdentidad((db) => resolverCuentasDeMeta(db, org, { id: x, esPorOmision: false }));
  assert.ok(deX.tipo === 'listo' && deX.cuentas.length === 1 && deX.cuentas[0]!.token === 'bisu-agencia');
  // Un cliente de otra empresa no se puede asignar.
  const ajeno = await asignar(pedirComo('/api/admin/meta/cuentas/act_3040000000012', tokenAdmin, { metodo: 'PUT', cuerpo: { cuentaId: deOtra } }), ctxAct('act_3040000000012'));
  assert.equal(ajeno.status, 404);
  const sinPermiso = await asignar(pedirComo('/api/admin/meta/cuentas/act_3040000000012', tokenUsuario, { metodo: 'PUT', cuerpo: { cuentaId: z } }), ctxAct('act_3040000000012'));
  assert.equal(sinPermiso.status, 403);
});

test('un cliente conecta su propio Meta: sus cuentas van a él y no se mueven a otro cliente', async () => {
  const r = await viaje('de-x', x);
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.deepEqual((await cuentasDeLaOrg())['act_3040000000021'], { cliente: x, negocio: NEGOCIO_DE_X });
  const mover = await asignar(pedirComo('/api/admin/meta/cuentas/act_3040000000021', tokenAdmin, { metodo: 'PUT', cuerpo: { cuentaId: z } }), ctxAct('act_3040000000021'));
  assert.equal(mover.status, 409);
});

test('volver a conectar el mismo negocio reemplaza el token y suelta lo que se desmarcó', async () => {
  const antes = await unaFila<{ n: number }>(admin, `select count(*)::int as n from identidad.conexiones_de_meta where org_id = $1`, [org]);
  const r = await viaje('agencia-de-nuevo', null);
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  const despues = await unaFila<{ n: number }>(admin, `select count(*)::int as n from identidad.conexiones_de_meta where org_id = $1`, [org]);
  assert.equal(despues?.n, antes?.n, 'volver a conectar sumó una conexión');
  const c = await cuentasDeLaOrg();
  assert.equal(c['act_3040000000012'], undefined, 'la cuenta desmarcada en Meta sigue conectada');
  assert.deepEqual(c['act_3040000000011'], { cliente: x, negocio: NEGOCIO_AGENCIA }, 'volver a conectar perdió la asignación');
  const deX = await conIdentidad((db) => resolverCuentasDeMeta(db, org, { id: x, esPorOmision: false }));
  assert.ok(deX.tipo === 'listo' && deX.cuentas.some((k) => k.token === 'bisu-agencia-de-nuevo'), 'el token nuevo no reemplazó al viejo');
});

test('Meta rechaza el código: 409 con nuestro texto, sin el mensaje de Meta', async () => {
  const r = await viaje('codigo-que-meta-no-conoce', null);
  assert.equal(r.estado, 409);
  assert.ok(!JSON.stringify(r.cuerpo).includes('Invalid verification'), 'el mensaje de Meta llegó al navegador');
});

test('Ajustes ve las conexiones sin tokens; desconectar borra la conexión y sus cuentas; todo auditado', async () => {
  const v = await leerRespuesta<{ appConfigurada: boolean; conexiones: { id: string; negocio: string }[]; cuentas: unknown[] }>(
    await verMeta(pedirComo('/api/admin/meta', tokenAdmin)),
  );
  assert.equal(v.estado, 200);
  assert.equal(v.cuerpo.appConfigurada, true);
  assert.ok(!JSON.stringify(v.cuerpo).includes('bisu-'), 'la vista de Ajustes lleva un token');
  const deX = v.cuerpo.conexiones.find((c) => c.negocio === NEGOCIO_DE_X);
  assert.ok(deX);

  const r = await desconectar(pedirComo(`/api/admin/meta/conexiones/${deX.id}`, tokenAdmin, { metodo: 'DELETE' }), ctxId(deX.id));
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await cuentasDeLaOrg())['act_3040000000021'], undefined);
  const otraVez = await desconectar(pedirComo(`/api/admin/meta/conexiones/${deX.id}`, tokenAdmin, { metodo: 'DELETE' }), ctxId(deX.id));
  assert.equal(otraVez.status, 404);

  const auditadas = await filas<{ accion: string }>(admin, `select accion from identidad.auditoria_accesos where org_id = $1`, [org]);
  const acciones = new Set(auditadas.map((a) => a.accion));
  for (const a of ['meta_conectada', 'meta_cuenta_asignada', 'meta_desconectada']) assert.ok(acciones.has(a), `no se auditó ${a}`);
});
