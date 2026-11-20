// EL INTERRUPTOR DEL CRON DE CONTACTOS SIN ETIQUETA. Tipo: Código.
//
// `traeTodosLosContactos` decide por cliente si su tarea `contactos` trae los leads nuevos sin etiqueta y si el cron
// saltea sus conversaciones (`lib/negocio/contactosSinEtiqueta.ts`). Apagado por omisión: sin la variable, nada cambia.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traeTodosLosContactos } from '../../lib/negocio/contactosSinEtiqueta.ts';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

test('sin la variable, o vacía, está apagado para todos', () => {
  assert.equal(traeTodosLosContactos('cuenta-a', undefined), false);
  assert.equal(traeTodosLosContactos('cuenta-a', ''), false);
  assert.equal(traeTodosLosContactos('cuenta-a', ' , '), false);
});

test('una lista de cuentas enciende sólo esas, con espacios o sin ellos', () => {
  assert.equal(traeTodosLosContactos('cuenta-a', 'cuenta-a'), true);
  assert.equal(traeTodosLosContactos('cuenta-b', 'cuenta-a, cuenta-b'), true);
  assert.equal(traeTodosLosContactos('cuenta-c', 'cuenta-a,cuenta-b'), false);
  // Sin coincidencias parciales: una cuenta no se enciende por ser prefijo de otra.
  assert.equal(traeTodosLosContactos('cuenta', 'cuenta-a'), false);
});

test('`*` enciende a todos; sin cuenta, nunca', () => {
  assert.equal(traeTodosLosContactos('cualquiera', '*'), true);
  assert.equal(traeTodosLosContactos(null, '*'), false);
});

test('el modo nuevo de la tarea `contactos`: los nuevos, después los avisos y al final las miniaturas, con sus llamadas', () => {
  const barrido = readFileSync(join(RAIZ, 'lib/negocio/barrido.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  // El desvío va primero en `releerContactos`: con el interruptor no se busca por etiqueta ni se congela.
  const i = barrido.indexOf('async function releerContactos(');
  const releer = barrido.slice(i, barrido.indexOf('\n}\n', i));
  const desvio = releer.indexOf('return releerLosNuevos(');
  assert.ok(desvio > 0 && desvio < releer.indexOf('sincronizarContactos('), 'el modo nuevo no se desvía antes de buscar por etiqueta');
  const j = barrido.indexOf('async function releerLosNuevos(');
  const cuerpo = barrido.slice(j, barrido.indexOf('\n}\n', j));
  const nuevos = cuerpo.indexOf('sincronizarLosNuevos(');
  const avisos = cuerpo.indexOf('await reprocesarAvisosDeOportunidad(ambito, acceso, { fin, ahora })');
  const miniaturas = cuerpo.indexOf('await completarMiniaturas(ambito, acceso,');
  assert.ok(nuevos > 0 && nuevos < avisos && avisos < miniaturas, 'el orden no es nuevos → avisos → miniaturas');
  assert.match(cuerpo, /miniaturas\.pedidos \+ avisos\.llamadas/, 'las llamadas de los avisos o las miniaturas no se cuentan');
  assert.ok(!cuerpo.includes('releerLosCongelados('), 'el modo nuevo relee los congelados de a uno');
});
