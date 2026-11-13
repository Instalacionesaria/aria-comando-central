// EL TÍTULO DE VENTA DE FATHOM. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/fathom/clasificar.ts` decide si una grabación es una LLAMADA DE VENTA, y sólo por el título: las de venta se
// titulan «HT_<lead> - ARIA» (decisión del usuario, 2026-11-13). Un falso negativo pierde la transcripción de una venta
// sin avisar (queda `no_es_venta`); un falso positivo guarda como venta una charla interna. Lo que se cuida:
//
//   · las formas reales de escribirlo: guion bajo, espacio, guion, raya, corchetes, emoji delante, minúsculas, ancho
//     completo;
//   · lo que NO es venta aunque tenga «HT»: «HTML», «HT2», «WhatsApp», «Onboarding HT», «Llamada HT_…»;
//   · el orden: el título del calendario manda sobre el de la grabación, que se puede editar en Fathom.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { esVentaPorTitulo, tituloDeVenta } from '../../lib/fathom/clasificar.ts';

test('el formato acordado es venta: «HT_<lead> - ARIA»', () => {
  assert.equal(tituloDeVenta('HT_Juan Pérez - ARIA'), true);
});

test('las variantes con que se escribe a mano también', () => {
  for (const t of [
    'HT Juan',
    'ht - Juan',
    'Ht_juan',
    'HT-Juan',
    'HT–Juan',
    'HT—Juan',
    'HT: Juan',
    'HT/Juan',
    'HT, Juan',
    'HT#1 Juan',
    '[HT] Juan',
    '(HT) Juan',
    '"HT_Juan"',
    '«HT_Juan»',
    '  HT_Juan',
    '🔥 HT_Juan',
    '❤️ HT_Juan',
    '​HT_Juan',
    'ＨＴ Juan',
    'HT',
  ]) {
    assert.equal(tituloDeVenta(t), true, `«${t}» debería ser venta`);
  }
});

test('lo que tiene HT pero no es venta, no', () => {
  for (const t of [
    'HTML para la landing',
    'HT2 Juan',
    'HTJuan',
    'WhatsApp con Juan',
    'Onboarding HT',
    'Llamada HT_Juan',
    'Kickoff - Juan',
    'H T Juan',
    '',
    '   ',
  ]) {
    assert.equal(tituloDeVenta(t), false, `«${t}» no debería ser venta`);
  }
  assert.equal(tituloDeVenta(null), false);
  assert.equal(tituloDeVenta(undefined), false);
});

test('el título del calendario manda; el de la grabación sólo si el del calendario no es de venta', () => {
  assert.deepEqual(esVentaPorTitulo('HT_Juan - ARIA', 'Reunión con Juan'), { esVenta: true, porTitulo: 'calendario' });
  assert.deepEqual(esVentaPorTitulo('Reunión', 'HT_Juan - ARIA'), { esVenta: true, porTitulo: 'grabacion' });
  assert.deepEqual(esVentaPorTitulo(null, 'HT_Juan - ARIA'), { esVenta: true, porTitulo: 'grabacion' });
  assert.deepEqual(esVentaPorTitulo('Onboarding Juan', 'Onboarding Juan'), { esVenta: false, porTitulo: null });
  assert.deepEqual(esVentaPorTitulo(null, null), { esVenta: false, porTitulo: null });
});
