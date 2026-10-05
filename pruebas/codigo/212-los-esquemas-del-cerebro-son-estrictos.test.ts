// LOS ESQUEMAS DEL CEREBRO CUMPLEN EL MODO ESTRICTO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// Lo que AG1 dejó anotado (`lib/agentes/llamada.ts`): las herramientas salen con `strict: true` y el formato
// de la salida es estricto, y los dos modos no admiten parte del JSON Schema —`minLength`, `maximum`,
// `minItems`…—. Por HTTP directo no hay un SDK que las quite: un esquema que las use es un 400 en cada
// pregunta, con todas las pruebas de la red falseada en verde. Y todo objeto lleva
// `additionalProperties: false` y todas sus claves en `required`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { HERRAMIENTAS } from '../../lib/agentes/executive/herramientas.ts';
import { RESPONDER } from '../../lib/agentes/executive/respuesta.ts';

const NO_ADMITIDAS = [
  'minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minItems', 'maxItems', 'uniqueItems', 'minProperties', 'maxProperties', 'patternProperties', '$ref', 'oneOf', 'allOf', 'not',
];

/** Los defectos de un esquema, con la ruta adentro del esquema. */
function defectos(esquema: unknown, ruta = '$'): string[] {
  if (esquema === null || typeof esquema !== 'object') return [];
  const e = esquema as Record<string, unknown>;
  const salida: string[] = [];
  for (const k of NO_ADMITIDAS) if (k in e) salida.push(`${ruta}: ${k}`);
  if (e.type === 'object') {
    const propiedades = Object.keys((e.properties ?? {}) as object);
    if (e.additionalProperties !== false) salida.push(`${ruta}: sin additionalProperties: false`);
    const requeridas = Array.isArray(e.required) ? [...(e.required as string[])].sort() : null;
    if (JSON.stringify(requeridas) !== JSON.stringify([...propiedades].sort())) salida.push(`${ruta}: required no son todas las claves`);
    for (const [k, v] of Object.entries((e.properties ?? {}) as object)) salida.push(...defectos(v, `${ruta}.${k}`));
  }
  if ('items' in e) salida.push(...defectos(e.items, `${ruta}[]`));
  return salida;
}

test('`responder` y cada herramienta del catálogo cumplen el modo estricto', () => {
  const todas = [{ nombre: RESPONDER.nombre, esquema: RESPONDER.esquema }, ...HERRAMIENTAS];
  assert.ok(todas.length >= 8, 'el catálogo está vacío: esta prueba no miraría nada');
  const culpables = todas.flatMap((h) => defectos(h.esquema).map((d) => `${h.nombre} ${d}`));
  assert.deepEqual(culpables, []);
});

test('el detector ve lo que tiene que ver', () => {
  assert.deepEqual(defectos({ type: 'object', additionalProperties: false, required: ['a'], properties: { a: { type: 'string', maxLength: 3 } } }), ['$.a: maxLength']);
  assert.deepEqual(defectos({ type: 'object', required: [], properties: {} }), ['$: sin additionalProperties: false']);
  assert.deepEqual(defectos({ type: 'object', additionalProperties: false, required: [], properties: { a: { type: 'string' } } }), ['$: required no son todas las claves']);
});

test('los nombres son únicos y ninguno choca con `responder`', () => {
  const nombres = [RESPONDER.nombre, ...HERRAMIENTAS.map((h) => h.nombre)];
  assert.equal(new Set(nombres).size, nombres.length);
});
