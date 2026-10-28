// UNA CUENTA DE META CON DATOS EN UN CLIENTE NO SE ASIGNA A OTRO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (M10 de `docs/_privado/modelo-de-datos/23-REVISION-PARA-PRODUCCION.md`, 2026-10-27)
//
// Las claves de lo que trae Meta no llevan el cliente: `campanas (org_id, meta_campana_id)`, `gasto_por_cuenta_publicitaria
// (org_id, act_id, fecha)`… Si el `act_` ya tiene filas leídas en el cliente X y se asigna a Z, la pasada de Z choca en
// cada `upsert` con la fila de X —la política de UPDATE de Z no la ve— y falla en todas las pasadas. La ruta
// `PUT /api/admin/meta/cuentas/[act]` responde 409 ANTES de tocar la asignación. Cada afirmación dice la mutación que
// la pone en rojo:
//
//   · con campañas leídas en X, asignarla a Z es 409 `cuenta_de_meta_con_datos` y la asignación sigue en X — mutación:
//     sin la comprobación, o la comprobación sin el `cuenta_id <>`;
//   · lo mismo con sólo el gasto por cuenta, sólo conjuntos o sólo anuncios — mutación: quitar cualquiera de las cuatro
//     tablas de la comprobación;
//   · reasignarla al MISMO cliente de sus datos, y soltarla (null), sí se puede; soltada, a Z sigue siendo 409 —
//     mutación: comparar contra la asignación actual en vez de contra los datos;
//   · una cuenta sin datos se asigna a cualquiera; un cliente de otra empresa sigue siendo 404 aunque haya datos —
//     mutación: responder el 409 antes de comprobar el cliente;
//   · la comprobación se hace CON la fila bloqueada: si mientras el PUT espera el candado aparecen datos en X, el PUT
//     los ve y responde 409 — mutaciones: sin el `for update`, o comprobar antes de tomar el candado;
//   · conectar por OAuth desde Z un portfolio con una cuenta que ya tiene datos en X no la mueve: queda en X con su
//     conexión, la respuesta la nombra en `cuentasRetenidas`, y una cuenta nueva con datos en X entra sin asignar; la que
//     no tiene datos va a Z — mutaciones: sin la comprobación en `guardarConexionDeMeta`, o el canje sin lo leído;
//   · UNA PASADA YA EN CURSO (el cierre de la revisión): si el `act_` pasa de X a Z mientras la pasada de X lee Meta,
//     la pasada no escribe nada en X y deja la cuenta `reasignada` — mutación: escribir con el ámbito sin releer la
//     asignación; y si la pasada está escribiendo cuando llega el PUT, el PUT espera a que confirme, ve lo escrito y
//     responde 409 — mutación: releer sin el `for share`.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { PUT as asignar } from '../../app/api/admin/meta/cuentas/[act]/route.ts';
import { POST as conectarMeta } from '../../app/api/admin/meta/conectar/route.ts';
import { POST as canjear } from '../../app/api/admin/meta/canje/route.ts';
import { datos } from '../../lib/datos/contexto.ts';
import { escribirSiSigueAsignada } from '../../lib/meta/loLeidoDeMeta.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { recolectarDeMeta } from '../../lib/negocio/recolectarDeMeta.ts';

const SLUG = 'meta-331';
const CON_CAMPANAS = 'act_3310000000011';
const SIN_DATOS = 'act_3310000000012';
const CON_GASTO = 'act_3310000000013';
const CON_CONJUNTOS = 'act_3310000000014';
const CON_ANUNCIOS = 'act_3310000000015';
// La carrera del candado y el canje por OAuth.
const CARRERA = 'act_3310000000031';
const MOVIDA = 'act_3310000000041';
const LIBRE = 'act_3310000000042';
const HUERFANA = 'act_3310000000043';
// La pasada que ya estaba corriendo.
const EN_CURSO = 'act_3310000000051';
const ESCRIBIENDO = 'act_3310000000052';
const NEGOCIO_DE_Z = '3310000000099';
const APP = { META_APP_ID: '3310000000001', META_APP_SECRET: 'secreto-de-la-app-331', META_CONFIG_ID: '3310000000002' };
const previas: Record<string, string | undefined> = {};
const fetchOriginal = globalThis.fetch;

let admin: Client;
let org: string;
let x: string;
let z: string;
let deOtra: string;
let tokenAdmin: string;
let dominioPrevio: string | undefined;

const ctxAct = (act: string) => ({ params: Promise.resolve({ act }) });

async function limpiar(): Promise<void> {
  for (const slug of [SLUG, `${SLUG}-otra`]) {
    const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [slug]);
    if (!o) continue;
    for (const t of ['anuncios', 'conjuntos_de_anuncios', 'campanas', 'gasto_por_cuenta_publicitaria']) {
      await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
    }
    await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
    await admin.query(`delete from identidad.conexiones_de_meta where org_id = $1`, [o.id]);
    await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
    await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
    await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
  }
}

async function organizacion(nombre: string, slug: string): Promise<string> {
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ($1, $2, 'America/Lima') returning id`,
    [nombre, slug],
  );
  assert.ok(o);
  return o.id;
}

async function cliente(nombre: string, slug: string, enOrg = org): Promise<string> {
  const c = await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug) values ($1, $2, $3) returning id`, [enOrg, nombre, slug]);
  assert.ok(c);
  return c.id;
}

/** Asigna por la ruta y devuelve el estado y el código. */
async function pedirAsignar(act: string, cuentaId: string | null): Promise<{ estado: number; codigo: unknown }> {
  const r = await leerRespuesta<{ codigo?: string }>(
    await asignar(pedirComo(`/api/admin/meta/cuentas/${act}`, tokenAdmin, { metodo: 'PUT', cuerpo: { cuentaId } }), ctxAct(act)),
  );
  return { estado: r.estado, codigo: r.cuerpo.codigo };
}

async function asignadaA(act: string): Promise<string | null> {
  return (await unaFila<{ cuenta_id: string | null }>(admin, `select cuenta_id from identidad.cuentas_publicitarias_de_meta where org_id = $1 and act_id = $2`, [org, act]))!
    .cuenta_id;
}

before(async () => {
  dominioPrevio = process.env.DOMINIO_ESPERADO;
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  org = await organizacion('Meta 331', SLUG);
  x = await cliente('Equis 331', 'equis-331');
  z = await cliente('Zeta 331', 'zeta-331');
  deOtra = await cliente('De otra 331', 'de-otra-331', await organizacion('Otra 331', `${SLUG}-otra`));
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, 'Admin 331') returning id`, [org]);
  assert.ok(u);
  await admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'administrador' and org_id is null`,
    [u.id],
  );
  tokenAdmin = await sesionDe(u.id);

  // La empresa conectó su portfolio (cuenta_id nulo): sus cuentas se asignan a mano a cualquiera de sus clientes.
  const conexion = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.conexiones_de_meta (org_id, cuenta_id, token_cifrado, negocio_de_meta_id, origen)
     values ($1, null, 'no-se-usa', '3310000000001', 'oauth') returning id`,
    [org],
  );
  assert.ok(conexion);
  for (const act of [CON_CAMPANAS, SIN_DATOS, CON_GASTO, CON_CONJUNTOS, CON_ANUNCIOS]) {
    await admin.query(
      `insert into identidad.cuentas_publicitarias_de_meta (org_id, act_id, conexion_id, nombre, moneda, cuenta_id)
       values ($1, $2, $3, $4, 'PEN', $5)`,
      [org, act, conexion.id, `Cuenta ${act}`, x],
    );
  }

  // Lo leído de Meta, en el cliente X: una tabla por cuenta, para que cada una de las cuatro tenga su caso.
  await admin.query(
    `insert into negocio.campanas (org_id, cuenta_id, meta_campana_id, nombre, act_id) values ($1, $2, '3310000000101', 'Campaña 331', $3)`,
    [org, x, CON_CAMPANAS],
  );
  await admin.query(
    `insert into negocio.gasto_por_cuenta_publicitaria (org_id, cuenta_id, act_id, fecha, gasto, moneda)
     values ($1, $2, $3, current_date - 1, 12.5, 'PEN')`,
    [org, x, CON_GASTO],
  );
  await admin.query(
    `insert into negocio.conjuntos_de_anuncios (org_id, cuenta_id, meta_conjunto_id, act_id, nombre) values ($1, $2, '3310000000201', $3, 'Conjunto 331')`,
    [org, x, CON_CONJUNTOS],
  );
  await admin.query(
    `insert into negocio.anuncios (org_id, cuenta_id, meta_anuncio_id, nombre, act_id) values ($1, $2, '3310000000301', 'Anuncio 331', $3)`,
    [org, x, CON_ANUNCIOS],
  );
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  for (const [k, v] of Object.entries(previas)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  if (dominioPrevio === undefined) delete process.env.DOMINIO_ESPERADO;
  else process.env.DOMINIO_ESPERADO = dominioPrevio;
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('con campañas leídas en X, asignarla a Z es 409 y la asignación sigue en X', async () => {
  const r = await pedirAsignar(CON_CAMPANAS, z);
  assert.equal(r.estado, 409, 'una cuenta con campañas de X se movió a Z: el recolector de Z va a fallar en cada pasada');
  assert.equal(r.codigo, 'cuenta_de_meta_con_datos');
  assert.equal(await asignadaA(CON_CAMPANAS), x, 'el 409 llegó después de mover la cuenta');
});

test('cada una de las cuatro tablas de Meta cuenta: el gasto, los conjuntos y los anuncios', async () => {
  for (const act of [CON_GASTO, CON_CONJUNTOS, CON_ANUNCIOS]) {
    const r = await pedirAsignar(act, z);
    assert.equal(r.estado, 409, `${act} tiene datos en X y se movió a Z`);
    assert.equal(await asignadaA(act), x);
  }
});

test('al mismo cliente de sus datos sí, y soltarla también; soltada, a Z sigue siendo 409', async () => {
  assert.equal((await pedirAsignar(CON_CAMPANAS, x)).estado, 200, 'reasignarla al cliente de sus datos se rechazó');
  assert.equal((await pedirAsignar(CON_CAMPANAS, null)).estado, 200, 'soltar una cuenta con datos se rechazó');
  assert.equal(await asignadaA(CON_CAMPANAS), null);
  const r = await pedirAsignar(CON_CAMPANAS, z);
  assert.equal(r.estado, 409, 'soltada y sin cliente, la cuenta se asignó a otro cliente que el de sus datos');
  assert.equal(await asignadaA(CON_CAMPANAS), null);
});

test('una cuenta sin datos se asigna a cualquiera; un cliente de otra empresa sigue siendo 404', async () => {
  assert.equal((await pedirAsignar(SIN_DATOS, z)).estado, 200, 'una cuenta sin nada leído no se pudo asignar');
  assert.equal(await asignadaA(SIN_DATOS), z);
  assert.equal((await pedirAsignar(CON_CAMPANAS, deOtra)).estado, 404, 'un cliente de otra empresa no es un 404');
});

/** Espera a que `cuantas` transacciones estén esperando un candado sobre `tabla`. */
async function esperarBloqueadas(cuantas: number, tabla: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    const r = await admin.query<{ n: number }>(
      `select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query ilike $1`,
      [`%${tabla}%`],
    );
    if ((r.rows[0]?.n ?? 0) >= cuantas) return;
    await new Promise((listo) => setTimeout(listo, 25));
  }
  assert.fail(`no llegaron ${cuantas} transacciones a esperar el candado de ${tabla}`);
}

/** La conexión de la empresa, la de las cuentas del principio. */
const conexionDeLaEmpresa = async () =>
  (await unaFila<{ conexion_id: string }>(
    admin,
    `select conexion_id from identidad.cuentas_publicitarias_de_meta where org_id = $1 and act_id = $2`,
    [org, SIN_DATOS],
  ))!.conexion_id;

test('la comprobación va con la fila bloqueada: lo que se lee mientras el PUT espera, el PUT lo ve', async () => {
  await admin.query(
    `insert into identidad.cuentas_publicitarias_de_meta (org_id, act_id, conexion_id, nombre, moneda, cuenta_id) values ($1, $2, $3, 'Carrera 331', 'PEN', $4)`,
    [org, CARRERA, await conexionDeLaEmpresa(), x],
  );
  // Otra transacción tiene la fila (un canje, otro PUT). El PUT a Z espera; mientras, la pasada de X escribe una campaña.
  const candado = await conectar('admin');
  let pedido: Promise<{ estado: number; codigo: unknown }>;
  try {
    await candado.query('begin');
    await candado.query(`select act_id from identidad.cuentas_publicitarias_de_meta where org_id = $1 and act_id = $2 for update`, [org, CARRERA]);
    pedido = pedirAsignar(CARRERA, z);
    await esperarBloqueadas(1, 'cuentas_publicitarias_de_meta');
    await admin.query(
      `insert into negocio.campanas (org_id, cuenta_id, meta_campana_id, nombre, act_id) values ($1, $2, '3310000000131', 'Campaña de la carrera', $3)`,
      [org, x, CARRERA],
    );
  } finally {
    await candado.query('commit');
    await candado.end();
  }
  const r = await pedido;
  assert.equal(r.estado, 409, 'el PUT comprobó antes de tener la fila: movió una cuenta que ya tenía campañas en X');
  assert.equal(await asignadaA(CARRERA), x);
});

/** Un Meta falso: canjea el `code` y da las cuentas del portfolio de Z. */
function metaFalso(): void {
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const u = new URL(String(entrada));
    const responder = (datos: unknown, estado = 200) => new Response(JSON.stringify(datos), { status: estado });
    if (u.pathname.endsWith('/oauth/access_token')) return responder({ access_token: 'bisu-331', token_type: 'bearer' });
    if (u.pathname.endsWith('/me')) return responder({ id: '1', client_business_id: NEGOCIO_DE_Z });
    if (u.pathname.endsWith('/me/adaccounts')) {
      return responder({
        data: [MOVIDA, LIBRE, HUERFANA].map((id) => ({ id, name: `Cuenta ${id}`, currency: 'PEN', timezone_name: 'America/Lima', account_status: 1 })),
        paging: { cursors: { after: 'x' } },
      });
    }
    return responder({ error: { code: 100 } }, 400);
  }) as typeof globalThis.fetch;
}

test('conectar por OAuth desde Z no mueve una cuenta con datos en X: queda en X y el canje lo dice', async () => {
  for (const [k, v] of Object.entries(APP)) {
    previas[k] = process.env[k];
    process.env[k] = v;
  }
  metaFalso();
  // MOVIDA: de la empresa, asignada a X, con campañas en X. HUERFANA: no está en la tabla, con gasto en X.
  const deLaEmpresa = await conexionDeLaEmpresa();
  await admin.query(
    `insert into identidad.cuentas_publicitarias_de_meta (org_id, act_id, conexion_id, nombre, moneda, cuenta_id) values ($1, $2, $3, 'Movida 331', 'PEN', $4)`,
    [org, MOVIDA, deLaEmpresa, x],
  );
  await admin.query(
    `insert into negocio.campanas (org_id, cuenta_id, meta_campana_id, nombre, act_id) values ($1, $2, '3310000000141', 'Campaña de X', $3)`,
    [org, x, MOVIDA],
  );
  await admin.query(
    `insert into negocio.gasto_por_cuenta_publicitaria (org_id, cuenta_id, act_id, fecha, gasto, moneda) values ($1, $2, $3, current_date - 2, 3.5, 'PEN')`,
    [org, x, HUERFANA],
  );

  const c = await leerRespuesta<{ url: string }>(await conectarMeta(pedirComo('/api/admin/meta/conectar', tokenAdmin, { metodo: 'POST', cuerpo: { cuentaId: z } })));
  assert.equal(c.estado, 200, JSON.stringify(c.cuerpo));
  const state = new URL(c.cuerpo.url).searchParams.get('state');
  assert.ok(state);
  const r = await leerRespuesta<{ cuentasConectadas: number; cuentasRetenidas: string[] }>(
    await canjear(pedirComo('/api/admin/meta/canje', tokenAdmin, { metodo: 'POST', cuerpo: { code: 'de-z', state } })),
  );
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.cuentasConectadas, 3);
  assert.deepEqual(r.cuerpo.cuentasRetenidas, [MOVIDA, HUERFANA], 'el canje no dice qué cuentas quedaron en su cliente');

  const filaDe = async (act: string) =>
    unaFila<{ cuenta_id: string | null; conexion_id: string }>(
      admin,
      `select cuenta_id, conexion_id from identidad.cuentas_publicitarias_de_meta where org_id = $1 and act_id = $2`,
      [org, act],
    );
  const movida = await filaDe(MOVIDA);
  assert.equal(movida?.cuenta_id, x, 'conectar por OAuth desde Z movió una cuenta con campañas en X: la pasada de Z va a fallar');
  assert.equal(movida?.conexion_id, deLaEmpresa, 'la cuenta retenida pasó a la conexión de Z');
  assert.equal((await filaDe(HUERFANA))?.cuenta_id, null, 'una cuenta nueva con gasto en X entró asignada a Z');
  assert.equal((await filaDe(LIBRE))?.cuenta_id, z, 'la cuenta sin datos no fue al cliente que la conectó');
});

/** Una cuenta de la conexión de la empresa, asignada a X y sin nada leído. */
async function cuentaDeX(act: string): Promise<string> {
  const conexion = await conexionDeLaEmpresa();
  await admin.query(
    `insert into identidad.cuentas_publicitarias_de_meta (org_id, act_id, conexion_id, nombre, moneda, cuenta_id) values ($1, $2, $3, $4, 'PEN', $5)`,
    [org, act, conexion, `Cuenta ${act}`, x],
  );
  return conexion;
}

const loLeidoEn = async (act: string) =>
  (await unaFila<{ n: number }>(
    admin,
    `select ((select count(*) from negocio.campanas where org_id = $1 and act_id = $2)
           + (select count(*) from negocio.anuncios where org_id = $1 and act_id = $2)
           + (select count(*) from negocio.gasto_por_cuenta_publicitaria where org_id = $1 and act_id = $2))::int as n`,
    [org, act],
  ))!.n;

test('una pasada ya en curso no escribe un act_ que se reasignó mientras leía Meta', async () => {
  const conexion = await cuentaDeX(EN_CURSO);
  const hoy = new Date().toISOString().slice(0, 10);
  let reasignada = null as { estado: number; codigo: unknown } | null;
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const u = new URL(String(entrada));
    const recurso = u.pathname.split('/').filter(Boolean)[2];
    // Mientras la pasada de X lee Meta, la cuenta pasa a Z: X todavía no tiene nada leído, así que el PUT puede.
    if (reasignada === null) reasignada = await pedirAsignar(EN_CURSO, z);
    const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200 });
    if (recurso === 'campaigns') return json({ data: [{ id: '3310000000551', name: 'Campaña en curso', status: 'ACTIVE', effective_status: 'ACTIVE' }] });
    if (recurso === 'adsets') return json({ data: [] });
    if (recurso === 'ads') return json({ data: [] });
    if (recurso === 'insights') {
      return json({ data: [{ date_start: hoy, spend: '3', impressions: '100', clicks: '1', reach: '80', account_currency: 'PEN', ad_id: '3310000000552', campaign_id: '3310000000551' }] });
    }
    return new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 });
  }) as typeof globalThis.fetch;
  try {
    const r = await recolectarDeMeta(
      ambitoDeUnCliente(org, x),
      [{ act: EN_CURSO, token: 'no-se-usa', conexionId: conexion, moneda: 'PEN', zonaHoraria: 'America/Lima', conPrueba: false }],
      'diario',
      Date.now() + 60_000,
    );
    assert.equal(reasignada?.estado, 200, JSON.stringify(reasignada));
    assert.equal(await asignadaA(EN_CURSO), z);
    assert.equal(await loLeidoEn(EN_CURSO), 0, 'la pasada de X escribió un act_ que ya era de Z: desde ahí Z choca en todas sus pasadas');
    assert.equal(r.resultado.cuentas[0]?.reasignada, true, 'la pasada no dice que la cuenta se reasignó');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('si la pasada está escribiendo cuando llega el PUT, el PUT espera, ve lo escrito y responde 409', async () => {
  await cuentaDeX(ESCRIBIENDO);
  let pedido: Promise<{ estado: number; codigo: unknown }> | null = null;
  const e = await escribirSiSigueAsignada(ambitoDeUnCliente(org, x), ESCRIBIENDO, async () => {
    // La escritura de X está abierta (con la asignación en `for share`): el PUT a Z tiene que esperarla.
    pedido = pedirAsignar(ESCRIBIENDO, z);
    await esperarBloqueadas(1, 'cuentas_publicitarias_de_meta');
    await datos()
      .insertInto('campanas')
      .values({ meta_campana_id: '3310000000561', nombre: 'Campaña escribiéndose', act_id: ESCRIBIENDO } as never)
      .execute();
  });
  assert.equal(e.escrito, true);
  assert.ok(pedido);
  const r = await (pedido as Promise<{ estado: number; codigo: unknown }>);
  assert.equal(r.estado, 409, 'el PUT no esperó a la escritura de la pasada: movió una cuenta que ya tenía campañas en X');
  assert.equal(await asignadaA(ESCRIBIENDO), x);
});
