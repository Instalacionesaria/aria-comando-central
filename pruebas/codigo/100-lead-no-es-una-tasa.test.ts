// `lead` no puede entrar en las tasas del creativo: cuenta dos veces. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTA PRUEBA NO DEFIENDE UN CÁLCULO: DEFIENDE UNA AUSENCIA
//
// `lead` viene en el 48 % de las filas del desglose y es el candidato obvio para una «tasa de leads»
// por pieza. Medido el 2026-09-19 sobre **las 64 filas** guardadas que lo traen, en las 64:
//
//     lead = onsiteWebLead                 + onsiteConversion.leadGrouped
//     lead = offsiteConversion.fbPixelLead + offsiteSearchAddMetaLeads
//
// Las dos igualdades a la vez, exactas, en todas. `lead` es un AGREGADO de dos hechos que ocurren en
// los mismos anuncios —287 y 215 en la ventana, 502 sumados— y nuestros contactos de esos anuncios
// (197) están al 90 % de UNO de los dos y al 45 % de la suma.
//
// O sea que una tasa construida sobre `lead` publicaría aproximadamente el doble de lo real. Y no
// fallaría: daría un número más grande y perfectamente creíble, que es exactamente el defecto de
// grano que `costoDelAnuncio.ts:157-164` documenta para este mismo par de tablas.
//
// El comentario que lo explica está en `rendimientoDelCreativo.ts`, al lado de la lista. **Un
// comentario no impide una línea**: esta prueba sí, y muere en el momento en que alguien agregue
// `lead` —o cualquiera de sus siete alias— a `ACCIONES_QUE_LEEMOS`.
//
// El conteo de leads de la pantalla sale de `calidadDelCreativo`, que cuenta contactos de nuestra
// base y sabe cuáles son. Ver `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md` § C14-15.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCIONES_QUE_LEEMOS } from '../../lib/negocio/rendimientoDelCreativo.ts';

/** Los ocho nombres medidos: dos hechos con cuatro alias cada uno, más el agregado que los suma. */
const LOS_QUE_CUENTAN_DOBLE = [
  'lead',
  'onsiteWebLead',
  'offsiteConversion.fbPixelLead',
  'offsiteLeadAdd_20SCalls',
  'onsiteConversion.leadGrouped',
  'offsiteSearchAddMetaLeads',
  'offsiteCompleteRegistrationAddMetaLeads',
  'offsiteContentViewAddMetaLeads',
];

test('ninguna tasa del creativo se construye sobre `lead` ni sobre sus alias', () => {
  const claves = Object.keys(ACCIONES_QUE_LEEMOS);
  const intrusos = claves.filter((c) => LOS_QUE_CUENTAN_DOBLE.includes(c));

  assert.deepEqual(
    intrusos,
    [],
    `${intrusos.join(', ')} está en ACCIONES_QUE_LEEMOS. Es un agregado de dos hechos que ocurren ` +
      'en los mismos anuncios: la tasa saldría al doble y nadie podría notarlo mirándola. El conteo ' +
      'de leads es de `calidadDelCreativo`, que cuenta contactos nuestros.',
  );
});

test('y la lista no está vacía, que haría pasar la de arriba sin medir nada', () => {
  /* Sin esto, borrar ACCIONES_QUE_LEEMOS entera dejaría la primera prueba en verde. */
  assert.ok(Object.keys(ACCIONES_QUE_LEEMOS).length >= 4);
  assert.ok('videoView' in ACCIONES_QUE_LEEMOS, 'se perdió el hook rate');
});
