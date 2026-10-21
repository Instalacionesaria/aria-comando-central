// DE PUNTA A PUNTA: EL GASTO DE CADA CLIENTE SALE DE SU GOHIGHLEVEL, POR EL CRON DE VERDAD. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6)
//
// La decisión del usuario del 2026-10-20: los costos de cada cliente salen de SU GoHighLevel con Meta vinculado. La 280
// recorre el cron con dos clientes para los contactos y los mensajes; ésta, para el GASTO: la tarea `anuncios`, por la
// ruta del cron (`GET /api/cron`) con su horario (`17 6 * * *`), contra un Ad Manager de GoHighLevel falso que se
// comporta como el de verdad en lo que importa acá: cada token ve sólo su subcuenta y sus campañas. Un pedido con el
// token de un cliente a la location o a la campaña de otro es un 403, y uno con un token desconocido, un 401.
//
// Una empresa con P (el principal, con las credenciales de la empresa), Y (con su subcuenta y su token, y Meta
// vinculado en su GoHighLevel) y Z (con su subcuenta y su token, SIN Meta vinculado):
//
//   · las campañas, los anuncios, las métricas por anuncio y la serie de la cuenta de P y de Y quedan cada una en SU
//     cliente, con SUS cifras — mutaciones: el acceso de la empresa para todos los clientes, y la serie escrita con la
//     empresa entera (el puente la deja en el principal);
//   · Z no tiene nada escrito: sin vínculo la pasada no escribe (un vacío del proveedor no es un cero);
//   · el sello de `anuncios` de Z dice «Meta no está vinculado en GoHighLevel», con el texto que leen la lista de
//     chequeo y los avisos (`MOTIVO_SIN_META_EN_GHL`), y el de P y el de Y no — mutaciones: otro texto en el sello, y
//     sin la línea del vínculo;
//   · ningún pedido cruzó tokens.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO } from '../apoyo/closer.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { GET as cron } from '../../app/api/cron/route.ts';
import { MOTIVO_SIN_META_EN_GHL } from '../../lib/negocio/faltaDeLosClientes.ts';

const SLUG = 'gamma-301';
const GHL = 'https://services.leadconnectorhq.com';
type Cliente = 'p' | 'y' | 'z';
const TOKEN = { p: 'tok-p-301', y: 'tok-y-301', z: 'tok-z-301' } as const;
const LOCATION = { p: 'locP301', y: 'locY301', z: 'locZ301' } as const;
/** La campaña y el anuncio de cada subcuenta: identificadores de Meta, distintos en cada cuenta publicitaria. */
const CAMPANA = { p: '120301000000000001', y: '120301000000000002', z: '120301000000000003' } as const;
const ANUNCIO = { p: '120301000000000101', y: '120301000000000102', z: '120301000000000103' } as const;
/** Lo que gasta por día la cuenta de cada uno, y su único anuncio: así el día cuadra. */
const GASTO = { p: 10, y: 25, z: 40 } as const;

let admin: Client;
let org: string;
let cuenta: Record<Cliente, string>;
let secretoPrevio: string | undefined;
const fetchOriginal = globalThis.fetch;
/** Lo que el Ad Manager falso vio: el token, la location y la campaña de cada pedido, y lo que rechazó. */
const vistos: { token: string; location: string | null; campana: string | null; rechazo: number | null }[] = [];

const quien = (token: string): Cliente | null =>
  token === TOKEN.p ? 'p' : token === TOKEN.y ? 'y' : token === TOKEN.z ? 'z' : null;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

/** Los días de `desde` a `hasta`, los dos incluidos, en `YYYY-MM-DD`. */
function dias(desde: string, hasta: string): string[] {
  const salida: string[] = [];
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) {
    salida.push(new Date(t).toISOString().slice(0, 10));
  }
  return salida;
}

function adManagerFalso(): typeof globalThis.fetch {
  return (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = new URL(typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada));
    if (!url.href.startsWith(GHL)) return json({}, 404);
    const token = new Headers(opciones?.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
    const location = url.searchParams.get('locationId');
    const campana = url.searchParams.get('campaignId');
    const de = quien(token);
    const rechazo =
      de === null ? 401 : location !== LOCATION[de] || (campana !== null && campana !== CAMPANA[de]) ? 403 : null;
    vistos.push({ token, location, campana, rechazo });
    if (rechazo !== null) return json({ message: 'no' }, rechazo);
    const c = de!;

    if (url.pathname === '/ad-publishing/facebook/integration') {
      return c === 'z'
        ? json({ status: 'disconnected', pages: [] })
        : json({ status: 'connected', fbAdAccountId: `act_${c}301`, pages: [{ id: `pagina-${c}` }] });
    }
    if (url.pathname === '/ad-publishing/facebook/entity') {
      return json({ data: [{ campaignId: CAMPANA[c], name: `Campaña ${c} 301`, status: 'ACTIVE', adAccountId: `act_${c}301` }], next: null });
    }
    if (url.pathname === '/ad-publishing/facebook/reporting/list') {
      return json([
        {
          adId: ANUNCIO[c],
          adsetId: `${CAMPANA[c]}9`,
          campaignId: CAMPANA[c],
          name: `Anuncio ${c} 301`,
          objective: 'OUTCOME_LEADS',
          spend: String(GASTO[c]),
          impressions: GASTO[c] * 40,
          clicks: GASTO[c] / 5,
        },
      ]);
    }
    if (url.pathname === '/ad-publishing/facebook/reporting') {
      const rango = dias(url.searchParams.get('startDate')!, url.searchParams.get('endDate')!);
      return json({ grouped: rango.map((dateStart) => ({ dateStart, spend: GASTO[c], impressions: GASTO[c] * 40, clicks: GASTO[c] / 5 })) });
    }
    return json({});
  }) as typeof globalThis.fetch;
}

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['metricas_de_anuncio', 'lecturas_de_gasto', 'anuncios', 'campanas', 'gasto_de_la_cuenta', 'tareas_programadas', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.cuentas_credenciales where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.organizaciones_credenciales where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

const deCuenta = (c: string | null): string => (c === cuenta.p ? 'P' : c === cuenta.y ? 'Y' : c === cuenta.z ? 'Z' : String(c));

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  secretoPrevio = process.env.CRON_SECRET;
  process.env.CRON_SECRET = randomBytes(24).toString('hex');
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 301', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  const otro = async (c: 'y' | 'z') =>
    (
      await unaFila<{ id: string }>(
        admin,
        `insert into identidad.cuentas (org_id, nombre, slug, zona_horaria, crm_cuenta_id) values ($1, $2, $3, 'America/Lima', $4) returning id`,
        [org, `Cliente ${c.toUpperCase()} 301`, `cliente-${c}-301`, LOCATION[c]],
      )
    )?.id;
  const y = await otro('y');
  const z = await otro('z');
  assert.ok(principal && y && z);
  cuenta = { p: principal.id, y, z };
  // La empresa (o sea su principal) con su token y su subcuenta; Y y Z con los suyos.
  await conIdentidad(async (db) => {
    await db
      .insertInto('organizaciones_credenciales')
      .values({ org_id: org, crm_token_cifrado: cifrar(TOKEN.p), crm_estado: 'activa', crm_cuenta_id: LOCATION.p } as never)
      .execute();
    for (const c of ['y', 'z'] as const) {
      await db
        .insertInto('cuentas_credenciales')
        .values({ org_id: org, cuenta_id: cuenta[c], crm_token_cifrado: cifrar(TOKEN[c]), crm_estado: 'activa' } as never)
        .execute();
    }
  });
  globalThis.fetch = adManagerFalso();

  // La pasada diaria del gasto, por la ruta del cron y con su horario.
  const r = await cron(
    new Request('https://ejemplo.test/api/cron', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-vercel-cron-schedule': '17 6 * * *' },
    }),
  );
  assert.equal(r.status, 200, await r.clone().text());
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  if (secretoPrevio === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secretoPrevio;
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('el cron pidió el gasto de cada cliente con SU token y SU subcuenta, y ningún pedido cruzó tokens', () => {
  const deEstaEmpresa = vistos.filter((v) => quien(v.token) !== null);
  assert.deepEqual(
    [...new Set(deEstaEmpresa.map((v) => quien(v.token)))].sort(),
    ['p', 'y', 'z'],
    'no se le preguntó a la subcuenta de cada cliente',
  );
  assert.deepEqual(
    deEstaEmpresa.filter((v) => v.rechazo !== null),
    [],
    'un pedido usó el token de un cliente con la subcuenta o la campaña de otro',
  );
  // Sin Meta vinculado, la pasada de Z pregunta por el vínculo y no sigue.
  assert.deepEqual(
    deEstaEmpresa.filter((v) => v.token === TOKEN.z).length,
    1,
    'sin Meta vinculado, la pasada de Z siguió pidiendo después del vínculo',
  );
});

test('las campañas, los anuncios y las métricas por anuncio quedan en SU cliente', async () => {
  const campanas = await filas<{ id: string; cuenta: string }>(
    admin,
    `select meta_campana_id as id, cuenta_id as cuenta from negocio.campanas where org_id = $1 order by 1`,
    [org],
  );
  assert.deepEqual(campanas.map((c) => `${c.id}:${deCuenta(c.cuenta)}`), [`${CAMPANA.p}:P`, `${CAMPANA.y}:Y`]);
  const anuncios = await filas<{ id: string; cuenta: string }>(
    admin,
    `select meta_anuncio_id as id, cuenta_id as cuenta from negocio.anuncios where org_id = $1 order by 1`,
    [org],
  );
  assert.deepEqual(anuncios.map((a) => `${a.id}:${deCuenta(a.cuenta)}`), [`${ANUNCIO.p}:P`, `${ANUNCIO.y}:Y`]);
  const metricas = await filas<{ id: string; cuenta: string; dias: number; gasto: string }>(
    admin,
    `select meta_anuncio_id as id, cuenta_id as cuenta, count(*)::int as dias, sum(gasto)::text as gasto
       from negocio.metricas_de_anuncio where org_id = $1 group by 1, 2 order by 1`,
    [org],
  );
  // Hoy, ayer y anteayer de su única campaña activa, con SU gasto.
  assert.deepEqual(
    metricas.map((m) => `${m.id}:${deCuenta(m.cuenta)}:${m.dias}:${Number(m.gasto)}`),
    [`${ANUNCIO.p}:P:3:${GASTO.p * 3}`, `${ANUNCIO.y}:Y:3:${GASTO.y * 3}`],
  );
});

test('la serie de la cuenta de cada cliente queda en SU cliente, con SUS cifras, y la de Z no existe', async () => {
  const serie = await filas<{ cuenta: string; dias: number; minimo: string; maximo: string }>(
    admin,
    `select cuenta_id as cuenta, count(*)::int as dias, min(gasto)::text as minimo, max(gasto)::text as maximo
       from negocio.gasto_de_la_cuenta where org_id = $1 group by 1`,
    [org],
  );
  assert.deepEqual(
    serie.map((s) => `${deCuenta(s.cuenta)}:${s.dias}:${Number(s.minimo)}-${Number(s.maximo)}`).sort(),
    [`P:30:${GASTO.p}-${GASTO.p}`, `Y:30:${GASTO.y}-${GASTO.y}`],
    'la serie de un cliente quedó en otro, o pisó la suya',
  );
});

test('el sello del gasto de Z dice que Meta no está vinculado en GoHighLevel; el de P y el de Y, no', async () => {
  const sellos = await filas<{ cuenta: string; estado: string; motivo: string | null }>(
    admin,
    `select cuenta_id as cuenta, ultimo_estado as estado, ultimo_motivo as motivo
       from negocio.tareas_programadas where org_id = $1 and tarea = 'anuncios'`,
    [org],
  );
  const de = (c: string) => sellos.find((s) => deCuenta(s.cuenta) === c);
  assert.deepEqual(sellos.map((s) => `${deCuenta(s.cuenta)}:${s.estado}`).sort(), ['P:corrio', 'Y:corrio', 'Z:corrio']);
  assert.ok(
    (de('Z')?.motivo ?? '').includes(MOTIVO_SIN_META_EN_GHL),
    `el sello de Z no dice que Meta no está vinculado, con el texto que leen la lista de chequeo y los avisos: ${de('Z')?.motivo}`,
  );
  for (const c of ['P', 'Y']) {
    assert.ok(!(de(c)?.motivo ?? '').includes(MOTIVO_SIN_META_EN_GHL), `el sello de ${c} dice que Meta no está vinculado`);
  }
});
