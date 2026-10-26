// DE PUNTA A PUNTA: LAS CAMPAÑAS Y EL GASTO DE CADA CLIENTE SALEN DE SU META, POR EL CRON DE VERDAD. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (Meta directo, M3; antes, el nivel 3 C6 con el Ad Manager de GoHighLevel)
//
// Desde Meta directo (2026-10-26) los anuncios, las campañas y el gasto de cada cliente se leen de la Marketing API de
// Meta con la conexión de su cliente, y no del Ad Manager de GoHighLevel («sólo Meta»). Ésta recorre la tarea
// `anuncios` por la ruta del cron (`GET /api/cron`, horario `17 6 * * *`) contra un Meta falso que se comporta como el
// de verdad en lo que importa acá: cada token ve sólo sus cuentas publicitarias, y uno de nuestra app exige su
// `appsecret_proof`. Una empresa con:
//
//   · P (el principal): su cuenta `act_…01`, en PEN, leída con la conexión de la EMPRESA (una agencia que conectó);
//   · Y: su cuenta `act_…02`, en USD, leída con SU propia conexión (conectó su portfolio);
//   · Z: sin Meta.
//
// Lo que se comprueba:
//
//   · cada cuenta se pidió con el token de su conexión, con su prueba, y ningún pedido cruzó tokens — mutación: el
//     cliente con las cuentas de la empresa;
//   · campañas (con presupuesto y estado efectivo), conjuntos, anuncios, métricas por día (28 días, con el video y las
//     acciones en la forma que leen las pantallas) y desgloses quedan en SU cliente — mutación: escribir con la
//     empresa entera (el puente lo deja en el principal);
//   · el total de cada cuenta y el del cliente por día, con su moneda, incluidos los días sin entrega en 0;
//   · el sello de Z dice que Meta no está conectado, y queda `saltada`; P e Y, `corrio`;
//   · la historia (`anuncios_relleno`) trae 30 días más hacia atrás de cada cuenta;
//   · un token que Meta rechaza (190) deja su conexión `revocada`, y desde ahí el cliente «falta» con otro motivo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO } from '../apoyo/closer.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { resolverCuentasDeMeta, TEXTO_DE_FALTA_CUENTAS_DE_META } from '../../lib/credenciales/resolver.ts';
import { GET as cron } from '../../app/api/cron/route.ts';
import { DIAS_QUE_SE_RELEEN, TRAMO_DE_HISTORIA } from '../../lib/negocio/recolectarDeMeta.ts';

const SLUG = 'gamma-301';
const SECRETO = 'secreto-de-la-app-301';
const ACT = { p: 'act_3010000000001', y: 'act_3010000000002' } as const;
const MONEDA = { p: 'PEN', y: 'USD' } as const;
const TOKEN = { empresa: 'bisu-empresa-301', y: 'bisu-y-301' } as const;
/** Qué cuentas ve cada token. */
const VE: Record<string, readonly string[]> = { [TOKEN.empresa]: [ACT.p], [TOKEN.y]: [ACT.y] };
const CAMPANA = { p: '3010000000000101', y: '3010000000000102' } as const;
const CONJUNTO = { p: '3010000000000201', y: '3010000000000202' } as const;
const ANUNCIO = { p: '3010000000000301', y: '3010000000000302' } as const;
/** Lo que gasta por día cada cuenta. Los domingos no entrega: Meta no los devuelve, y se guardan en 0. */
const GASTO = { p: 10, y: 25 } as const;

type Cliente = 'p' | 'y';
let admin: Client;
let org: string;
let cuenta: { p: string; y: string; z: string };
let conexionDeY: string;
let previas: Record<string, string | undefined> = {};
const fetchOriginal = globalThis.fetch;
/** Lo que el Meta falso vio: el token, la cuenta pedida, y si la prueba del secreto estaba bien. */
const vistos: { token: string; act: string | null; prueba: boolean; rechazo: number | null }[] = [];
/** Los tokens que Meta da por revocados (190). */
const revocados = new Set<string>();

const actDe = (c: Cliente) => ACT[c];
const deAct = (act: string): Cliente | null => (act === ACT.p ? 'p' : act === ACT.y ? 'y' : null);
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

function dias(desde: string, hasta: string): string[] {
  const salida: string[] = [];
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) salida.push(new Date(t).toISOString().slice(0, 10));
  return salida;
}
const esDomingo = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0;

function metaFalso(): typeof globalThis.fetch {
  return (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = new URL(String(entrada));
    if (url.host !== 'graph.facebook.com') return json({}, 404);
    const token = (new Headers(opciones?.headers).get('authorization') ?? '').replace(/^Bearer /, '');
    const prueba = url.searchParams.get('appsecret_proof') === createHmac('sha256', SECRETO).update(token).digest('hex');
    const tramos = url.pathname.split('/').filter(Boolean); // ['v23.0', 'act_…', 'insights']
    const act = tramos[1] ?? null;
    const c = act ? deAct(act) : null;
    const rechazo = revocados.has(token) ? 190 : !VE[token] ? 401 : !prueba ? 100 : !act || !VE[token]!.includes(act) || !c ? 403 : null;
    vistos.push({ token, act, prueba, rechazo });
    if (rechazo === 190) return json({ error: { code: 190, message: 'Error validating access token' } }, 400);
    if (rechazo !== null) return json({ error: { code: rechazo === 403 ? 200 : 100 } }, 400);
    const k = c!;
    const recurso = tramos[2];
    if (recurso === 'campaigns') {
      return json({ data: [{ id: CAMPANA[k], name: `Campaña ${k} 301`, status: 'ACTIVE', effective_status: 'ACTIVE', objective: 'OUTCOME_LEADS', daily_budget: '5000' }] });
    }
    if (recurso === 'adsets') {
      return json({ data: [{ id: CONJUNTO[k], name: `Conjunto ${k} 301`, campaign_id: CAMPANA[k], status: 'ACTIVE', effective_status: 'ACTIVE', optimization_goal: 'LEAD_GENERATION' }] });
    }
    if (recurso === 'ads') {
      return json({ data: [{ id: ANUNCIO[k], name: `Anuncio ${k} 301`, adset_id: CONJUNTO[k], campaign_id: CAMPANA[k], status: 'ACTIVE', effective_status: 'ACTIVE' }] });
    }
    if (recurso === 'insights') {
      const rango = JSON.parse(url.searchParams.get('time_range') ?? '{}') as { since: string; until: string };
      const desglose = url.searchParams.get('breakdowns');
      const nivel = url.searchParams.get('level');
      const data = dias(rango.since, rango.until)
        .filter((d) => !esDomingo(d))
        .map((d) => {
          const base = { date_start: d, spend: String(GASTO[k]), impressions: String(GASTO[k] * 40), clicks: String(GASTO[k] / 5), reach: String(GASTO[k] * 30), account_currency: MONEDA[k] };
          if (nivel === 'account') return { ...base, frequency: '1.33', cpm: '250' };
          const deAnuncio = { ...base, ad_id: ANUNCIO[k], ad_name: `Anuncio ${k} 301`, adset_id: CONJUNTO[k], campaign_id: CAMPANA[k] };
          if (desglose) return { ...deAnuncio, publisher_platform: 'instagram', platform_position: 'feed', age: '25-34', gender: 'female', device_platform: 'mobile_app', country: 'PE' };
          return {
            ...deAnuncio,
            actions: [{ action_type: 'link_click', value: '4' }, { action_type: 'onsite_conversion.lead_grouped', value: '1' }],
            video_p25_watched_actions: [{ action_type: 'video_view', value: '90' }],
            video_p100_watched_actions: [{ action_type: 'video_view', value: '12' }],
          };
        });
      return json({ data });
    }
    return json({ error: { code: 100 } }, 400);
  }) as typeof globalThis.fetch;
}

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['metricas_por_desglose', 'metricas_de_anuncio', 'anuncios', 'conjuntos_de_anuncios', 'campanas', 'gasto_por_cuenta_publicitaria', 'gasto_de_la_cuenta', 'tareas_programadas', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.conexiones_de_meta where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

const deCuenta = (c: string | null): string => (c === cuenta.p ? 'P' : c === cuenta.y ? 'Y' : c === cuenta.z ? 'Z' : String(c));

async function correrElCron(horario: string): Promise<void> {
  const r = await cron(new Request('https://ejemplo.test/api/cron', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-vercel-cron-schedule': horario } }));
  assert.equal(r.status, 200, await r.clone().text());
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  previas = { CRON_SECRET: process.env.CRON_SECRET, META_APP_SECRET: process.env.META_APP_SECRET, META_APP_ID: process.env.META_APP_ID, META_CONFIG_ID: process.env.META_CONFIG_ID };
  process.env.CRON_SECRET = randomBytes(24).toString('hex');
  Object.assign(process.env, { META_APP_SECRET: SECRETO, META_APP_ID: '3010000000009', META_CONFIG_ID: '3010000000008' });
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(admin, `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 301', $1, 'America/Lima') returning id`, [SLUG]);
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  const otro = async (c: 'y' | 'z') =>
    (await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug, zona_horaria) values ($1, $2, $3, 'America/Lima') returning id`, [org, `Cliente ${c.toUpperCase()} 301`, `cliente-${c}-301`]))?.id;
  const y = await otro('y');
  const z = await otro('z');
  assert.ok(principal && y && z);
  cuenta = { p: principal.id, y, z };

  // La conexión de la EMPRESA ve la cuenta de P; la de Y es de Y. Z no conectó.
  await conIdentidad(async (db) => {
    const deLaEmpresa = await db
      .insertInto('conexiones_de_meta')
      .values({ org_id: org, cuenta_id: null, token_cifrado: cifrar(TOKEN.empresa), negocio_de_meta_id: '3019999999991', origen: 'oauth' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const deY = await db
      .insertInto('conexiones_de_meta')
      .values({ org_id: org, cuenta_id: y, token_cifrado: cifrar(TOKEN.y), negocio_de_meta_id: '3019999999992', origen: 'oauth', conectada_el: new Date(Date.now() - 3_600_000) })
      .returning('id')
      .executeTakeFirstOrThrow();
    conexionDeY = deY.id;
    await db
      .insertInto('cuentas_publicitarias_de_meta')
      .values([
        { org_id: org, act_id: ACT.p, conexion_id: deLaEmpresa.id, cuenta_id: principal.id, moneda: MONEDA.p, zona_horaria: 'America/Lima' },
        { org_id: org, act_id: ACT.y, conexion_id: deY.id, cuenta_id: y, moneda: MONEDA.y, zona_horaria: 'America/Lima' },
      ])
      .execute();
  });
  globalThis.fetch = metaFalso();
  await correrElCron('17 6 * * *');
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

test('el cron pidió cada cuenta con el token de SU conexión, con su prueba, y ningún pedido cruzó tokens', () => {
  const deEsta = vistos.filter((v) => VE[v.token]);
  assert.deepEqual([...new Set(deEsta.map((v) => v.act))].sort(), [ACT.p, ACT.y]);
  assert.deepEqual(deEsta.filter((v) => v.rechazo !== null), [], 'un pedido usó el token de una conexión con la cuenta de otra, o sin su prueba');
  assert.ok(deEsta.filter((v) => v.act === ACT.p).every((v) => v.token === TOKEN.empresa));
  assert.ok(deEsta.filter((v) => v.act === ACT.y).every((v) => v.token === TOKEN.y));
});

test('las campañas, los conjuntos y los anuncios quedan en SU cliente, con lo que GoHighLevel no daba', async () => {
  const campanas = await filas<{ id: string; cuenta: string; presupuesto: string; estado: string; moneda: string }>(
    admin,
    `select meta_campana_id as id, cuenta_id as cuenta, presupuesto_diario::text as presupuesto, estado_efectivo as estado, moneda from negocio.campanas where org_id = $1 order by 1`,
    [org],
  );
  // 5000 en la unidad mínima de la moneda = 50.
  assert.deepEqual(
    campanas.map((c) => `${c.id}:${deCuenta(c.cuenta)}:${Number(c.presupuesto)}:${c.estado}:${c.moneda}`),
    [`${CAMPANA.p}:P:50:ACTIVE:PEN`, `${CAMPANA.y}:Y:50:ACTIVE:USD`],
  );
  const conjuntos = await filas<{ id: string; cuenta: string; optimizacion: string }>(admin, `select meta_conjunto_id as id, cuenta_id as cuenta, optimizacion from negocio.conjuntos_de_anuncios where org_id = $1 order by 1`, [org]);
  assert.deepEqual(conjuntos.map((c) => `${c.id}:${deCuenta(c.cuenta)}:${c.optimizacion}`), [`${CONJUNTO.p}:P:LEAD_GENERATION`, `${CONJUNTO.y}:Y:LEAD_GENERATION`]);
  const anuncios = await filas<{ id: string; cuenta: string; act: string; estado: string }>(admin, `select meta_anuncio_id as id, cuenta_id as cuenta, act_id as act, estado_efectivo as estado from negocio.anuncios where org_id = $1 order by 1`, [org]);
  assert.deepEqual(anuncios.map((a) => `${a.id}:${deCuenta(a.cuenta)}:${a.act}:${a.estado}`), [`${ANUNCIO.p}:P:${ACT.p}:ACTIVE`, `${ANUNCIO.y}:Y:${ACT.y}:ACTIVE`]);
});

test('las métricas de cada anuncio: 28 días, en SU cliente, con el video y las acciones en la forma de las pantallas', async () => {
  const hoy = new Date().toISOString().slice(0, 10);
  const conEntrega = dias(new Date(Date.now() - (DIAS_QUE_SE_RELEEN - 1) * 86_400_000).toISOString().slice(0, 10), hoy).filter((d) => !esDomingo(d)).length;
  const m = await filas<{ id: string; cuenta: string; dias: number; gasto: string; fuente: string; moneda: string }>(
    admin,
    `select meta_anuncio_id as id, cuenta_id as cuenta, count(*)::int as dias, sum(gasto)::text as gasto, min(fuente) as fuente, min(moneda) as moneda
       from negocio.metricas_de_anuncio where org_id = $1 group by 1, 2 order by 1`,
    [org],
  );
  assert.deepEqual(
    m.map((x) => `${x.id}:${deCuenta(x.cuenta)}:${x.dias}:${Number(x.gasto)}:${x.fuente}:${x.moneda}`),
    [`${ANUNCIO.p}:P:${conEntrega}:${GASTO.p * conEntrega}:meta:PEN`, `${ANUNCIO.y}:Y:${conEntrega}:${GASTO.y * conEntrega}:meta:USD`],
  );
  const una = await unaFila<{ acciones: Record<string, number>; video: Record<string, number>; gasto_usd: string | null }>(
    admin,
    `select acciones, video, gasto_usd::text as gasto_usd from negocio.metricas_de_anuncio where org_id = $1 and meta_anuncio_id = $2 limit 1`,
    [org, ANUNCIO.y],
  );
  assert.equal(una?.acciones.linkClick, 4, 'la acción link_click no quedó como linkClick, la clave que leen las pantallas');
  assert.equal(una?.acciones['onsiteConversion.leadGrouped'], 1);
  assert.deepEqual(una?.video, { p25: 90, p100: 12 });
  assert.equal(Number(una?.gasto_usd), GASTO.y, 'en USD el gasto en USD es el gasto');
});

test('el total de cada cuenta y el del cliente por día, con su moneda, y los días sin entrega en 0', async () => {
  const total = await filas<{ cuenta: string; dias: number; ceros: number; moneda: string; maximo: string }>(
    admin,
    `select cuenta_id as cuenta, count(*)::int as dias, count(*) filter (where gasto = 0)::int as ceros, min(moneda) as moneda, max(gasto)::text as maximo
       from negocio.gasto_de_la_cuenta where org_id = $1 group by 1`,
    [org],
  );
  const domingos = dias(new Date(Date.now() - (DIAS_QUE_SE_RELEEN - 1) * 86_400_000).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)).filter(esDomingo).length;
  assert.deepEqual(
    total.map((t) => `${deCuenta(t.cuenta)}:${t.dias}:${t.ceros}:${t.moneda}:${Number(t.maximo)}`).sort(),
    [`P:${DIAS_QUE_SE_RELEEN}:${domingos}:PEN:${GASTO.p}`, `Y:${DIAS_QUE_SE_RELEEN}:${domingos}:USD:${GASTO.y}`],
    'el total de un cliente quedó en otro, o le faltan días',
  );
  const porCuenta = await filas<{ act: string; cuenta: string; dias: number }>(admin, `select act_id as act, cuenta_id as cuenta, count(*)::int as dias from negocio.gasto_por_cuenta_publicitaria where org_id = $1 group by 1, 2 order by 1`, [org]);
  assert.deepEqual(porCuenta.map((g) => `${g.act}:${deCuenta(g.cuenta)}:${g.dias}`), [`${ACT.p}:P:${DIAS_QUE_SE_RELEEN}`, `${ACT.y}:Y:${DIAS_QUE_SE_RELEEN}`]);
});

test('los desgloses de los últimos días quedan en SU cliente, uno por cada desglose', async () => {
  const d = await filas<{ cuenta: string; desglose: string; valor: string }>(
    admin,
    `select distinct cuenta_id as cuenta, desglose, valor from negocio.metricas_por_desglose where org_id = $1 order by 2, 1`,
    [org],
  );
  assert.deepEqual(
    [...new Set(d.map((x) => `${x.desglose}:${x.valor}`))].sort(),
    ['dispositivo:mobile_app', 'edad_genero:25-34 · female', 'pais:PE', 'plataforma:instagram', 'ubicacion:instagram · feed'],
  );
  assert.deepEqual([...new Set(d.map((x) => deCuenta(x.cuenta)))].sort(), ['P', 'Y']);
});

test('el sello de Z dice que Meta no está conectado y queda saltada; el de P y el de Y corrieron', async () => {
  const sellos = await filas<{ cuenta: string; estado: string; motivo: string | null }>(
    admin,
    `select cuenta_id as cuenta, ultimo_estado as estado, ultimo_motivo as motivo from negocio.tareas_programadas where org_id = $1 and tarea = 'anuncios'`,
    [org],
  );
  assert.deepEqual(sellos.map((s) => `${deCuenta(s.cuenta)}:${s.estado}`).sort(), ['P:corrio', 'Y:corrio', 'Z:saltada']);
  assert.equal(sellos.find((s) => deCuenta(s.cuenta) === 'Z')?.motivo, TEXTO_DE_FALTA_CUENTAS_DE_META.sin_cuentas_de_meta);
});

test('la historia trae 30 días más hacia atrás de cada cuenta', async () => {
  await correrElCron('53 * * * *');
  const porCuenta = await filas<{ act: string; dias: number }>(admin, `select act_id as act, count(*)::int as dias from negocio.gasto_por_cuenta_publicitaria where org_id = $1 group by 1 order by 1`, [org]);
  assert.deepEqual(porCuenta.map((g) => `${g.act}:${g.dias}`), [`${ACT.p}:${DIAS_QUE_SE_RELEEN + TRAMO_DE_HISTORIA}`, `${ACT.y}:${DIAS_QUE_SE_RELEEN + TRAMO_DE_HISTORIA}`]);
});

test('un token que Meta rechaza deja su conexión revocada, y el cliente falta con otro motivo', async () => {
  revocados.add(TOKEN.y);
  await correrElCron('17 6 * * *');
  const c = await unaFila<{ estado: string; ultimo_error: string | null }>(admin, `select estado, ultimo_error from identidad.conexiones_de_meta where id = $1`, [conexionDeY]);
  assert.equal(c?.estado, 'revocada');
  assert.ok(c?.ultimo_error);
  const deY = await conIdentidad((db) => resolverCuentasDeMeta(db, org, { id: cuenta.y, esPorOmision: false }));
  assert.deepEqual(deY, { tipo: 'falta', que: 'conexion_de_meta_caida' });
  // La de la empresa sigue: P no se cayó con Y.
  const deP = await conIdentidad((db) => resolverCuentasDeMeta(db, org, 'la_de_la_empresa'));
  assert.equal(deP.tipo, 'listo');
});
