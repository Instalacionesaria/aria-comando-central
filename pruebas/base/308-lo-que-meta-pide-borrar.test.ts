// LO QUE META PIDE: QUITAR LA APP Y BORRAR LOS DATOS, DE PUNTA A PUNTA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (Meta directo, M6, 2026-10-26)
//
// Las dos rutas que llama Meta, con su firma, contra la base:
//
//   · una firma con otro secreto, o sin el secreto configurado, es 403 y no toca nada — mutación: no comparar;
//   · la desautorización deja `revocada` sólo las conexiones de ese usuario de Meta, y no borra nada;
//   · el borrado borra lo leído con las conexiones de ese usuario —anuncios con sus métricas y su desglose, campañas, gasto
//     por cuenta— y las conexiones con sus cuentas; lo de otra conexión del mismo cliente se queda, y el total diario del
//     cliente se rehace con lo que le queda (de 15 a 5), mientras el del cliente que sólo tenía esa cuenta se queda sin
//     filas — mutaciones: no rehacer el total; borrar por organización y no por cuenta publicitaria;
//   · contesta lo que Meta pide (`url` y `confirmation_code`), la página de estado lo encuentra por el código y dice que
//     terminó, y un pedido de alguien sin conexiones también se contesta y se anota.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { ambitoDeUnCliente, cuentaDe, porOmisionDe } from '../../lib/negocio/ambitoDelCliente.ts';
import { guardarDias } from '../../lib/negocio/recolectarDeMeta.ts';
import { estadoDelBorrado } from '../../lib/meta/borrado.ts';
import { POST as borrado } from '../../app/api/meta/borrado/route.ts';
import { POST as desautorizado } from '../../app/api/meta/desautorizado/route.ts';

const SLUG = 'gamma-308';
const SECRETO = 'secreto-de-prueba-308';
const DOMINIO = 'comando.test';
const USUARIOS = ['3080000081', '3080000082', '3080000089'];
let admin: Client;
let org: string;
let x: string;
let y: string;
const previas: Record<string, string | undefined> = {};

/** Firma como Meta: HMAC-SHA256 de la mitad de los datos, tal como viaja, con el secreto de la app. */
function firmar(usuario: string, secreto = SECRETO): string {
  const carga = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', issued_at: 1_790_000_000, user_id: usuario })).toString('base64url');
  return `${createHmac('sha256', secreto).update(carga).digest('base64url')}.${carga}`;
}

/** El `POST` de Meta: un formulario con `signed_request`. */
const deMeta = (camino: string, firmada: string) =>
  new Request(`https://${DOMINIO}${camino}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `signed_request=${encodeURIComponent(firmada)}`,
  });

async function limpiar(): Promise<void> {
  await admin.query(`delete from identidad.pedidos_de_borrado_de_meta where usuario_de_meta_id = any($1)`, [USUARIOS]);
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['metricas_por_desglose', 'metricas_de_anuncio', 'anuncios', 'campanas', 'gasto_por_cuenta_publicitaria', 'gasto_de_la_cuenta']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.conexiones_de_meta where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Una conexión de la empresa de ese usuario de Meta, con sus cuentas publicitarias asignadas. */
async function conexion(usuario: string, cuentas: [string, string][]): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.conexiones_de_meta (org_id, cuenta_id, token_cifrado, negocio_de_meta_id, usuario_de_meta_id, origen)
     values ($1, null, $2, $3, $3, 'oauth') returning id`,
    [org, cifrar(`token-${usuario}`), usuario],
  );
  assert.ok(c);
  for (const [act, cliente] of cuentas) {
    await admin.query(`insert into identidad.cuentas_publicitarias_de_meta (org_id, act_id, conexion_id, cuenta_id) values ($1, $2, $3, $4)`, [org, act, c.id, cliente]);
  }
  return c.id;
}

/** Dos días de gasto de una cuenta publicitaria de un cliente, por el escritor de Meta (que rehace el total). */
const dias = (cliente: string, act: string, gasto: number) =>
  conOrganizacion(ambitoDeUnCliente(org, cliente), () =>
    guardarDias(
      act,
      'PEN',
      '2026-10-01',
      '2026-10-02',
      ['2026-10-01', '2026-10-02'].map((fecha) => ({ fecha, gasto, impresiones: 100, clics: 1, alcance: 50, frecuencia: 2, cpm: null, moneda: 'PEN' })),
    ),
  );

/** Una campaña con un anuncio, un día de métricas y su desglose, de una cuenta publicitaria del cliente X. */
async function anuncio(act: string, id: string): Promise<void> {
  await admin.query(`insert into negocio.campanas (org_id, cuenta_id, meta_campana_id, nombre, act_id) values ($1, $2, $3, 'Campaña 308', $4)`, [org, x, `${id}0`, act]);
  await admin.query(`insert into negocio.anuncios (org_id, cuenta_id, meta_anuncio_id, meta_campana_id, nombre, act_id) values ($1, $2, $3, $4, 'Anuncio 308', $5)`, [
    org,
    x,
    id,
    `${id}0`,
    act,
  ]);
  await admin.query(`insert into negocio.metricas_de_anuncio (org_id, cuenta_id, meta_anuncio_id, fecha, gasto, impresiones, clics, fuente) values ($1, $2, $3, '2026-10-01', 5, 100, 1, 'meta')`, [
    org,
    x,
    id,
  ]);
  await admin.query(
    `insert into negocio.metricas_por_desglose (org_id, cuenta_id, meta_anuncio_id, fecha, desglose, valor, gasto) values ($1, $2, $3, '2026-10-01', 'plataforma', 'facebook', 5)`,
    [org, x, id],
  );
}

const totales = async (cliente: string) =>
  (await filas<{ gasto: string }>(admin, `select gasto::text from negocio.gasto_de_la_cuenta where org_id = $1 and cuenta_id = $2 order by fecha`, [org, cliente])).map((f) =>
    Number(f.gasto),
  );

before(async () => {
  for (const k of ['META_APP_SECRET', 'DOMINIO_ESPERADO']) previas[k] = process.env[k];
  process.env.META_APP_SECRET = SECRETO;
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(admin, `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 308', $1, 'America/Lima') returning id`, [SLUG]);
  assert.ok(o);
  org = o.id;
  x = cuentaDe(await porOmisionDe(org));
  const segunda = await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, 'Segunda 308', 'segunda-308') returning id`, [org]);
  assert.ok(segunda);
  y = segunda.id;

  // El usuario 81 conectó dos cuentas, una para cada cliente; el 82, otra cuenta de X.
  await conexion(USUARIOS[0]!, [
    ['act_3080001', x],
    ['act_3080002', y],
  ]);
  await conexion(USUARIOS[1]!, [['act_3080003', x]]);
  await dias(x, 'act_3080001', 10);
  await dias(x, 'act_3080003', 5);
  await dias(y, 'act_3080002', 7);
  await anuncio('act_3080001', '3080000101');
  await anuncio('act_3080003', '3080000103');
});

after(async () => {
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

test('el escenario: X suma sus dos cuentas, Y la suya', async () => {
  assert.deepEqual(await totales(x), [15, 15]);
  assert.deepEqual(await totales(y), [7, 7]);
});

test('una firma con otro secreto, o sin el secreto configurado, es 403 y no toca nada', async () => {
  assert.equal((await borrado(deMeta('/api/meta/borrado', firmar(USUARIOS[0]!, 'otro-secreto')))).status, 403);
  assert.equal((await desautorizado(deMeta('/api/meta/desautorizado', firmar(USUARIOS[0]!, 'otro-secreto')))).status, 403);
  delete process.env.META_APP_SECRET;
  try {
    assert.equal((await borrado(deMeta('/api/meta/borrado', firmar(USUARIOS[0]!)))).status, 403);
  } finally {
    process.env.META_APP_SECRET = SECRETO;
  }
  const n = await unaFila<{ n: number }>(admin, `select count(*)::int as n from identidad.conexiones_de_meta where org_id = $1 and estado = 'activa'`, [org]);
  assert.equal(n?.n, 2);
  assert.deepEqual(await totales(x), [15, 15]);
});

test('desautorizar revoca sólo las conexiones de ese usuario, y no borra nada', async () => {
  const r = await desautorizado(deMeta('/api/meta/desautorizado', firmar(USUARIOS[1]!)));
  assert.equal(r.status, 200);
  const estados = await filas<{ usuario_de_meta_id: string; estado: string }>(
    admin,
    `select usuario_de_meta_id, estado from identidad.conexiones_de_meta where org_id = $1 order by usuario_de_meta_id`,
    [org],
  );
  assert.deepEqual(
    estados.map((e) => [e.usuario_de_meta_id, e.estado]),
    [
      [USUARIOS[0], 'activa'],
      [USUARIOS[1], 'revocada'],
    ],
  );
  assert.deepEqual(await totales(x), [15, 15], 'desautorizar borró gasto');
});

test('el borrado borra lo leído con sus conexiones, deja lo de otra, y rehace el total del cliente', async () => {
  const r = await borrado(deMeta('/api/meta/borrado', firmar(USUARIOS[0]!)));
  assert.equal(r.status, 200);
  const cuerpo = (await r.json()) as { url: string; confirmation_code: string };
  assert.match(cuerpo.confirmation_code, /^[0-9a-f]{32}$/);
  assert.equal(cuerpo.url, `https://${DOMINIO}/meta/borrado/${cuerpo.confirmation_code}`);

  // Identidad: se fue la conexión del 81 con sus dos cuentas; la del 82 y su cuenta se quedan.
  const cuentas = await filas<{ act_id: string }>(admin, `select act_id from identidad.cuentas_publicitarias_de_meta where org_id = $1 order by act_id`, [org]);
  assert.deepEqual(
    cuentas.map((c) => c.act_id),
    ['act_3080003'],
  );
  // Negocio: lo de act_3080001 y act_3080002 se fue; lo de act_3080003, no.
  for (const [tabla, columna] of [
    ['anuncios', 'act_id'],
    ['campanas', 'act_id'],
    ['gasto_por_cuenta_publicitaria', 'act_id'],
  ] as const) {
    const quedan = await filas<{ act_id: string }>(admin, `select distinct ${columna} as act_id from negocio.${tabla} where org_id = $1 order by 1`, [org]);
    assert.deepEqual(
      quedan.map((q) => q.act_id),
      ['act_3080003'],
      `${tabla} conserva lo borrado o perdió lo ajeno`,
    );
  }
  for (const tabla of ['metricas_de_anuncio', 'metricas_por_desglose']) {
    const quedan = await filas<{ id: string }>(admin, `select distinct meta_anuncio_id as id from negocio.${tabla} where org_id = $1`, [org]);
    assert.deepEqual(
      quedan.map((q) => q.id),
      ['3080000103'],
      `${tabla} conserva lo borrado o perdió lo ajeno`,
    );
  }
  // El total de X se rehace con la cuenta que le queda; Y se queda sin días leídos (no en cero).
  assert.deepEqual(await totales(x), [5, 5]);
  assert.deepEqual(await totales(y), []);

  // La constancia, y la página de estado que la encuentra por el código.
  const pedido = await unaFila<{ conexiones: number; cuentas: number; hecho: boolean }>(
    admin,
    `select conexiones, cuentas, borrado_el is not null as hecho from identidad.pedidos_de_borrado_de_meta where usuario_de_meta_id = $1`,
    [USUARIOS[0]],
  );
  assert.deepEqual(pedido, { conexiones: 1, cuentas: 2, hecho: true });
  const estado = await conIdentidad((db) => estadoDelBorrado(db, cuerpo.confirmation_code));
  assert.ok(estado?.borradoEl, 'la página de estado no encuentra el pedido');
  assert.equal(await conIdentidad((db) => estadoDelBorrado(db, '0'.repeat(32))), null);
  assert.equal(await conIdentidad((db) => estadoDelBorrado(db, 'no-es-un-codigo')), null);
});

test('un pedido de alguien sin conexiones también se contesta y se anota', async () => {
  const r = await borrado(deMeta('/api/meta/borrado', firmar(USUARIOS[2]!)));
  assert.equal(r.status, 200);
  const pedido = await unaFila<{ conexiones: number; hecho: boolean }>(
    admin,
    `select conexiones, borrado_el is not null as hecho from identidad.pedidos_de_borrado_de_meta where usuario_de_meta_id = $1`,
    [USUARIOS[2]],
  );
  assert.deepEqual(pedido, { conexiones: 0, hecho: true });
  assert.deepEqual(await totales(x), [5, 5], 'el pedido de otro tocó lo de X');
});
