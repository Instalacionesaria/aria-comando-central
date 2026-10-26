// LO QUE TRAE META: CÓMO SE LEE CADA DATO DE LA MARKETING API. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (Meta directo, M3, 2026-10-26)
//
// La 301 recorre el cron de punta a punta; ésta fija las piezas que deciden QUÉ se guarda de cada respuesta de Meta:
//
//   · las claves de las acciones pasan a la forma que ya leen las pantallas (`link_click` → `linkClick`), y lo que no
//     se puede leer se cuenta — mutación: guardar la clave de Meta tal cual;
//   · el video sale de las listas de Meta, y sin video es nulo, no `{}`;
//   · los presupuestos vienen en la unidad mínima de la moneda;
//   · el uso de la cuota se lee de las cabeceras de Meta, sea cual sea la que lo traiga;
//   · un pedido que Meta rechaza por grande se parte en dos mitades del rango, y sólo ése — mutación: no partirlo;
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { accionesDe, claveDeLaAccion, insightsDeLaCuenta, numero, presupuesto, videoDe } from '../../lib/meta/insights.ts';
import { usoDeLaCuota } from '../../lib/negocio/recolectarDeMeta.ts';

const fetchOriginal = globalThis.fetch;
after(() => {
  globalThis.fetch = fetchOriginal;
});

test('las claves de las acciones quedan en la forma que leen las pantallas', () => {
  assert.equal(claveDeLaAccion('link_click'), 'linkClick');
  assert.equal(claveDeLaAccion('landing_page_view'), 'landingPageView');
  assert.equal(claveDeLaAccion('video_view'), 'videoView');
  assert.equal(claveDeLaAccion('post_engagement'), 'postEngagement');
  assert.equal(claveDeLaAccion('onsite_conversion.messaging_conversation_started_7d'), 'onsiteConversion.messagingConversationStarted7d');
  assert.equal(claveDeLaAccion('lead'), 'lead');

  const r = accionesDe([
    { action_type: 'link_click', value: '7' },
    { action_type: 'video_view', value: 120 },
    { action_type: 'lead', value: 'no-es-numero' },
    { value: '3' },
  ]);
  assert.deepEqual(r.acciones, { linkClick: 7, videoView: 120 });
  assert.equal(r.ilegibles, 2, 'lo que no se pudo leer tiene que contarse');
  assert.deepEqual(accionesDe(undefined), { acciones: null, ilegibles: 0 });
});

test('el video sale de las listas de Meta, y sin video es nulo', () => {
  assert.deepEqual(
    videoDe({
      video_p25_watched_actions: [{ action_type: 'video_view', value: '100' }],
      video_p100_watched_actions: [{ action_type: 'video_view', value: '9' }],
      video_thruplay_watched_actions: [{ action_type: 'video_view', value: '30' }],
      video_avg_time_watched_actions: [{ action_type: 'video_view', value: '4.5' }],
    }),
    { p25: 100, p100: 9, thruplay: 30, segundosEnPromedio: 4.5 },
  );
  assert.equal(videoDe({ spend: '10' }), null);
});

test('los presupuestos vienen en la unidad mínima de la moneda, y los números de Meta llegan como texto', () => {
  assert.equal(presupuesto('5000'), 50);
  assert.equal(presupuesto('5000', 0), 5000);
  assert.equal(presupuesto(undefined), null);
  assert.equal(numero('12.5'), 12.5);
  assert.equal(numero(''), null);
  assert.equal(numero('x'), null);
});

test('el uso de la cuota se lee de cualquiera de las cabeceras de Meta', () => {
  const h = new Headers({
    'x-business-use-case-usage': JSON.stringify({ '123': [{ type: 'ads_insights', call_count: 41, total_cputime: 12, total_time: 77 }] }),
    'x-ad-account-usage': JSON.stringify({ acc_id_util_pct: 33 }),
  });
  assert.equal(usoDeLaCuota(h), 77);
  assert.equal(usoDeLaCuota(new Headers({ 'x-app-usage': 'no es json' })), 0);
  assert.equal(usoDeLaCuota(new Headers()), 0);
});

test('un pedido que Meta rechaza por grande se parte en dos mitades del rango', async () => {
  const rangos: string[] = [];
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const u = new URL(String(entrada));
    const r = JSON.parse(u.searchParams.get('time_range') ?? '{}') as { since: string; until: string };
    rangos.push(`${r.since}..${r.until}`);
    // Más de dos días es «demasiado»: el código 1 con el subcódigo 1487534.
    const dias = (Date.parse(r.until) - Date.parse(r.since)) / 86_400_000 + 1;
    if (dias > 2) {
      return new Response(JSON.stringify({ error: { code: 1, error_subcode: 1487534, message: 'Please reduce the amount of data' } }), { status: 400 });
    }
    return new Response(JSON.stringify({ data: [{ date_start: r.since, spend: '1' }] }), { status: 200 });
  }) as typeof globalThis.fetch;

  const r = await insightsDeLaCuenta('act_1', { token: 't', conPrueba: false }, '2026-10-01', '2026-10-08');
  assert.equal(r.tipo, 'listo');
  assert.deepEqual(rangos, [
    '2026-10-01..2026-10-08',
    '2026-10-01..2026-10-04',
    '2026-10-01..2026-10-02',
    '2026-10-03..2026-10-04',
    '2026-10-05..2026-10-08',
    '2026-10-05..2026-10-06',
    '2026-10-07..2026-10-08',
  ]);

  // Otro rechazo (un permiso) no se parte: se devuelve.
  rangos.length = 0;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: 200 } }), { status: 400 })) as typeof globalThis.fetch;
  const p = await insightsDeLaCuenta('act_1', { token: 't', conPrueba: false }, '2026-10-01', '2026-10-08');
  assert.deepEqual(p.tipo === 'falla' ? p.motivo : p.tipo, 'permiso');
});
