// Fixture. Falla SIEMPRE, a propósito.
//
// Es el sujeto de la fila ⛔ 1 de la Etapa 0: "una prueba que falla a propósito
// bloquea la integración". La prueba real lo invoca como proceso hijo y verifica
// que el corredor sale con código distinto de cero.
//
// NO termina en `.test.ts`: así el glob de la suite no lo puede levantar nunca, y
// la integración queda VERDE mientras demuestra que el rojo bloquea.

import test from 'node:test';
import assert from 'node:assert/strict';

export const MARCADOR = 'ARIA_FALLA_DELIBERADA';

test('esta prueba falla a propósito', () => {
  assert.fail(MARCADOR);
});
