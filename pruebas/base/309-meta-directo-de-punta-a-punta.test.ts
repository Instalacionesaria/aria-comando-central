// META DIRECTO DE PUNTA A PUNTA: UNA AGENCIA CONECTA, ASIGNA, EL CRON LEE Y CADA CLIENTE VE LO SUYO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (Meta directo, M7, 2026-10-26)
//
// La 304 prueba el viaje a Meta y la asignación; la 301, el cron contra cuentas ya conectadas. Ésta las encadena con
// las rutas de verdad y termina en las pantallas, que es lo que el plan pide de M7:
//
//   1. la administradora de una empresa con tres clientes —P (el principal), X y Z— aprieta «Conectar con Meta» como
//      empresa (`POST /api/admin/meta/conectar`), vuelve de Meta con el código (`POST /api/admin/meta/canje`) y su
//      negocio trae dos cuentas publicitarias;
//   2. asigna una a X y otra a P (`PUT /api/admin/meta/cuentas/[act]`); Z queda sin Meta;
//   3. corre la pasada diaria del cron (`GET /api/cron`, `17 6 * * *`) contra el mismo Meta falso;
//   4. Acquisition, con el ámbito de cada cliente, muestra SU campaña y SU gasto —el de su cuenta, día por día, con los
//      días sin entrega en 0— y nada del otro; y la falta de Z es «no tiene Meta conectado».
//
// Mutaciones: asignar la cuenta al cliente equivocado (el gasto de X sería el de P); no rehacer el total del cliente.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import { lecturaDeAcquisition } from '../../lib/negocio/embudosDeAcquisition.ts';
import { faltaDelGastoDe } from '../../lib/negocio/faltaDeLosClientes.ts';
import { POST as conectarMeta } from '../../app/api/admin/meta/conectar/route.ts';
import { POST as canjear } from '../../app/api/admin/meta/canje/route.ts';
import { PUT as asignar } from '../../app/api/admin/meta/cuentas/[act]/route.ts';
import { GET as cron } from '../../app/api/cron/route.ts';

const SLUG = 'gamma-309';
const APP = { META_APP_ID: '3090000000001', META_APP_SECRET: 'secreto-de-la-app-309', META_CONFIG_ID: '3090000000002' };
const CODE = 'agencia-309';
const TOKEN = `bisu-${CODE}`;
const ACT = { p: 'act_3090000000011', x: 'act_3090000000012' } as const;
const CAMPANA = { p: '3090000000000101', x: '3090000000000102' } as const;
const ANUNCIO = { p: '3090000000000301', x: '3090000000000302' } as const;
/** Lo que gasta por día cada cuenta. Los domingos no entrega: Meta no los devuelve, y se guardan en 0. */
const GASTO = { p: 30, x: 12 } as const;
type Cuenta = 'p' | 'x';

let admin: Client;
let org: string;
let p: string;
let x: string;
let z: string;
let token: string;
const previas: Record<string, string | undefined> = {};
const fetchOriginal = globalThis.fetch;

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const deAct = (act: string | undefined): Cuenta | null => (act === ACT.p ? 'p' : act === ACT.x ? 'x' : null);
const esDomingo = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0;
function dias(desde: string, hasta: string): string[] {
  const salida: string[] = [];
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) salida.push(new Date(t).toISOString().slice(0, 10));
  return salida;
}

/** El Meta falso: el canje, `me`, las cuentas del token, y la estructura y los insights de cada cuenta. */
function metaFalso(): typeof globalThis.fetch {
  return (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = new URL(String(entrada));
    if (url.host !== 'graph.facebook.com') return json({}, 404);
    if (url.pathname.endsWith('/oauth/access_token')) {
      const code = new URLSearchParams(typeof opciones?.body === 'string' ? opciones.body : '').get('code');
      return code === CODE ? json({ access_token: TOKEN, token_type: 'bearer' }) : json({ error: { code: 100 } }, 400);
    }
    const auth = (new Headers(opciones?.headers).get('authorization') ?? '').replace(/^Bearer /, '');
    if (auth !== TOKEN) return json({ error: { code: 190 } }, 400);
    if (url.searchParams.get('appsecret_proof') !== createHmac('sha256', APP.META_APP_SECRET).update(auth).digest('hex')) return json({ error: { code: 100 } }, 400);
    if (url.pathname.endsWith('/me')) return json({ id: '3090000000777', client_business_id: '3091111111111' });
    if (url.pathname.endsWith('/me/adaccounts')) {
      return json({ data: [ACT.p, ACT.x].map((id) => ({ id, name: `Cuenta ${id}`, currency: 'PEN', timezone_name: 'America/Lima', account_status: 1 })) });
    }
    const [, act, recurso] = url.pathname.split('/').filter(Boolean);
    const k = deAct(act);
    if (!k) return json({ error: { code: 100 } }, 400);
    if (recurso === 'campaigns') return json({ data: [{ id: CAMPANA[k], name: `Campaña ${k} 309`, status: 'ACTIVE', effective_status: 'ACTIVE', objective: 'OUTCOME_LEADS', daily_budget: '5000' }] });
    if (recurso === 'adsets') return json({ data: [] });
    if (recurso === 'ads') return json({ data: [{ id: ANUNCIO[k], name: `Anuncio ${k} 309`, campaign_id: CAMPANA[k], status: 'ACTIVE', effective_status: 'ACTIVE' }] });
    if (recurso === 'insights') {
      const rango = JSON.parse(url.searchParams.get('time_range') ?? '{}') as { since: string; until: string };
      if (url.searchParams.get('breakdowns')) return json({ data: [] });
      const nivel = url.searchParams.get('level');
      const data = dias(rango.since, rango.until)
        .filter((d) => !esDomingo(d))
        .map((d) => {
          const base = { date_start: d, spend: String(GASTO[k]), impressions: '1000', clicks: '10', reach: '800', account_currency: 'PEN' };
          return nivel === 'account' ? base : { ...base, ad_id: ANUNCIO[k], campaign_id: CAMPANA[k], actions: [{ action_type: 'link_click', value: '4' }] };
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
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.conexiones_de_meta where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Lo que Acquisition muestra en «7 días» con el ámbito de un cliente. */
const acquisitionDe = (cliente: string) =>
  conOrganizacion(ambitoDeUnCliente(org, cliente), () => lecturaDeAcquisition({ clave: '7d', dias: 7 }, 'America/Lima'));

/** Lo que tendría que gastar una cuenta en una ventana: su gasto por día, menos los domingos. */
const esperado = (k: Cuenta, ventana: { desde: string; hasta: string }) => GASTO[k] * dias(ventana.desde, ventana.hasta).filter((d) => !esDomingo(d)).length;

before(async () => {
  for (const k of ['CRON_SECRET', 'DOMINIO_ESPERADO', ...Object.keys(APP)]) previas[k] = process.env[k];
  Object.assign(process.env, APP, { DOMINIO_ESPERADO: DOMINIO, CRON_SECRET: randomBytes(24).toString('hex') });
  globalThis.fetch = metaFalso();
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(admin, `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 309', $1, 'America/Lima') returning id`, [SLUG]);
  assert.ok(o);
  org = o.id;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(principal);
  p = principal.id;
  const otro = async (n: string) =>
    (await unaFila<{ id: string }>(admin, `insert into identidad.cuentas (org_id, nombre, slug, zona_horaria) values ($1, $2, $3, 'America/Lima') returning id`, [org, `Cliente ${n} 309`, `cliente-${n}-309`]))!.id;
  x = await otro('x');
  z = await otro('z');
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, 'Admin 309') returning id`, [org]);
  assert.ok(u);
  await admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'administrador' and org_id is null`, [u.id]);
  token = await sesionDe(u.id);

  // 1. Conectar como empresa y volver de Meta con el código.
  const c = await leerRespuesta<{ url: string }>(await conectarMeta(pedirComo('/api/admin/meta/conectar', token, { metodo: 'POST', cuerpo: { cuentaId: null } })));
  assert.equal(c.estado, 200, JSON.stringify(c.cuerpo));
  const state = new URL(c.cuerpo.url).searchParams.get('state');
  const canje = await leerRespuesta<{ cuentasConectadas: number }>(await canjear(pedirComo('/api/admin/meta/canje', token, { metodo: 'POST', cuerpo: { code: CODE, state } })));
  assert.equal(canje.estado, 200, JSON.stringify(canje.cuerpo));
  assert.equal(canje.cuerpo.cuentasConectadas, 2);

  // 2. Asignar una cuenta a X y otra al principal.
  for (const [act, cuentaId] of [
    [ACT.x, x],
    [ACT.p, p],
  ] as const) {
    const r = await asignar(pedirComo(`/api/admin/meta/cuentas/${act}`, token, { metodo: 'PUT', cuerpo: { cuentaId } }), { params: Promise.resolve({ act }) });
    assert.equal(r.status, 200, await r.clone().text());
  }

  // 3. La pasada diaria del cron.
  const r = await cron(new Request('https://ejemplo.test/api/cron', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-vercel-cron-schedule': '17 6 * * *' } }));
  assert.equal(r.status, 200, await r.clone().text());
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

test('X ve su campaña y el gasto de su cuenta, día por día, y nada de P', async () => {
  const l = await acquisitionDe(x);
  assert.deepEqual([...l.actual.keys()], [CAMPANA.x], 'X ve campañas que no son suyas, o no ve la suya');
  assert.equal(l.embudos.gasto.motivo, null, `el gasto de X no está entero: ${l.embudos.gasto.motivo}`);
  assert.equal(l.embudos.gasto.deLaCuenta, esperado('x', l.embudos.ventana));
  assert.equal(l.actual.get(CAMPANA.x)?.inversion, esperado('x', l.embudos.ventana));
});

test('P ve lo suyo, con su gasto, y nada de X', async () => {
  const l = await acquisitionDe(p);
  assert.deepEqual([...l.actual.keys()], [CAMPANA.p]);
  assert.equal(l.embudos.gasto.deLaCuenta, esperado('p', l.embudos.ventana));
});

test('Z no tiene Meta conectado, y su aviso lo dice', async () => {
  const falta = await conOrganizacion(org, () => faltaDelGastoDe([z]));
  assert.deepEqual(
    falta.map((f) => f.falta),
    ['meta_sin_conectar'],
  );
  const l = await acquisitionDe(z);
  assert.equal(l.actual.size, 0, 'Z ve campañas de otro cliente');
});
