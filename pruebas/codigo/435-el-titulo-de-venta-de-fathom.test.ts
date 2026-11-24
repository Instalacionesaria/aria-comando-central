// EL TÍTULO DE VENTA DE FATHOM. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/fathom/clasificar.ts` decide si una grabación es una LLAMADA DE VENTA, y sólo por el título: GHL titula las de
// venta «{{contact.name}} - ARIA» y las de onboarding «Fase 0: Onboarding Quantum - {{contact.name}}» (decisión del
// usuario, 2026-11-24). Sólo la primera es venta. Un falso negativo pierde la transcripción de una venta sin avisar
// (queda `no_es_venta`); un falso positivo guarda como venta un onboarding o una charla interna. Lo que se cuida:
//
//   · la plantilla de venta y sus variantes reales: minúsculas, tildes, raya, sin espacios, blancos al final;
//   · lo que NO es venta: el onboarding (aunque termine en «- ARIA»), «- MARIA», «ARIA» al comienzo, la regla vieja
//     del «HT_» al comienzo;
//   · el orden: el título del calendario manda sobre el de la grabación, que se puede editar en Fathom.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { esVentaPorTitulo, tituloDeVenta } from '../../lib/fathom/clasificar.ts';

test('la plantilla de venta es venta: «{{contact.name}} - ARIA»', () => {
  assert.equal(tituloDeVenta('Juan Pérez - ARIA'), true);
});

test('sus variantes también', () => {
  for (const t of [
    'juan pérez - aria',
    'Juan - Aria',
    'María José Díaz - ARIA',
    'Juan-ARIA',
    'Juan – ARIA',
    'Juan — ARIA',
    'Juan  -  ARIA',
    'Juan - ARIA ',
    '  Juan - ARIA',
    'Juan - ＡＲＩＡ',
    'HT_Juan - ARIA',
    'J - ARIA',
    'Juan Pérez (Clínica Sol) - ARIA',
  ]) {
    assert.equal(tituloDeVenta(t), true, `«${t}» debería ser venta`);
  }
});

test('el onboarding y todo lo demás, no', () => {
  for (const t of [
    'Fase 0: Onboarding Quantum - Juan Pérez',
    'Fase 0: Onboarding Quantum - ARIA',
    'Onboarding - ARIA',
    'Juan - ARIA onboarding',
    '- ARIA',
    ' - ARIA',
    'ARIA',
    '123 - ARIA',
    'Juan - MARIA',
    'Juan María',
    'ARIA - Juan',
    'Reunión ARIA',
    'Juan - ARIA IA',
    'Juan - ARIA.',
    'Juan ARIA',
    'HT_Juan',
    'HT_Moises Ruiz',
    'Impromptu Google Meet Meeting',
    'prueba',
    '',
    '   ',
  ]) {
    assert.equal(tituloDeVenta(t), false, `«${t}» no debería ser venta`);
  }
  assert.equal(tituloDeVenta(null), false);
  assert.equal(tituloDeVenta(undefined), false);
});

test('el título del calendario manda; el de la grabación sólo si el del calendario no es de venta', () => {
  assert.deepEqual(esVentaPorTitulo('Juan - ARIA', 'Reunión con Juan'), { esVenta: true, porTitulo: 'calendario' });
  assert.deepEqual(esVentaPorTitulo('Reunión', 'Juan - ARIA'), { esVenta: true, porTitulo: 'grabacion' });
  assert.deepEqual(esVentaPorTitulo(null, 'Juan - ARIA'), { esVenta: true, porTitulo: 'grabacion' });
  assert.deepEqual(
    esVentaPorTitulo('Fase 0: Onboarding Quantum - Juan', 'Fase 0: Onboarding Quantum - Juan'),
    { esVenta: false, porTitulo: null },
  );
  assert.deepEqual(esVentaPorTitulo(null, null), { esVenta: false, porTitulo: null });
});
