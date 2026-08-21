// Fixture. Pasa SIEMPRE.
//
// Sin esto, la afirmación "el fixture que falla sale 1" pasaría por el motivo
// equivocado: una ruta mal escrita, un error de sintaxis o un módulo que no
// resuelve también dan salida distinta de cero. Este fixture prueba que el
// corredor sale 0 cuando de verdad todo pasa, así que la otra afirmación mide lo
// que dice medir.
//
// Es la misma trampa que el 08-ENDURECIMIENTO § 5.4 señala para el freno por
// origen: "si el freno por CUENTA salta antes que el por ORIGEN, la prueba pasa
// por el motivo equivocado y no verifica nada de lo que dice".

import test from 'node:test';
import assert from 'node:assert/strict';

test('esta prueba pasa siempre', () => {
  assert.equal(1, 1);
});
