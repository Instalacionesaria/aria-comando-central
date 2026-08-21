// ADR-0001 — "Las pruebas corren en cada cambio y pueden bloquear."
// Tipo: Código. INNEGOCIABLE (⛔), y el innegociable nº 1 de la lista:
// "Sin esto, nada de lo demás existe. Solo se cree que existe."
//
// La estrategia: el fixture que falla NO termina en `.test.ts`, así que el glob de
// la suite no lo puede levantar nunca. Esta prueba lo invoca como proceso hijo y
// afirma el código de salida. La integración queda VERDE mientras demuestra que el
// rojo bloquea.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

// TRAMPA VERIFICADA, y es de la peor familia — un éxito reportado que no ocurrió.
//
// Node le pone `NODE_TEST_CONTEXT` al entorno de todo archivo de prueba que corre
// como subproceso. Un `node --test` que HEREDA esa variable pasa a modo hijo y
// SALE 0 AUNQUE SUS PRUEBAS FALLEN, porque espera que un corredor padre agregue los
// resultados.
//
// Medido: `node --test <fixture que falla>` sale 1; con `NODE_TEST_CONTEXT=child-v8`
// sale 0. Sin borrarla, esta prueba —la que sostiene el innegociable nº 1— no
// verificaría nada de lo que dice verificar.
function entornoLimpio(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function correr(args: string[]): { codigo: number; salida: string } {
  const r = spawnSync(process.execPath, args, {
    cwd: RAIZ,
    encoding: 'utf8',
    env: entornoLimpio(),
  });
  return { codigo: r.status ?? -1, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

test('NODE_TEST_CONTEXT enmascara el código de salida — por eso se borra', () => {
  // Deja constancia de la trampa como afirmación, no como comentario. Si Node
  // cambiara este comportamiento, esta prueba avisa y `entornoLimpio()` se puede
  // simplificar. Si alguien borra `entornoLimpio()`, las tres pruebas de abajo
  // empiezan a fallar y el motivo está acá.
  const heredado = spawnSync(process.execPath, ['--test', 'pruebas/fixtures/falla-a-proposito.mjs'], {
    cwd: RAIZ,
    encoding: 'utf8',
    env: { ...process.env, NODE_TEST_CONTEXT: 'child-v8' },
  });
  assert.equal(
    heredado.status,
    0,
    'si esto ya no sale 0, Node dejó de enmascarar el código de salida en modo hijo',
  );
});

test('el corredor sale distinto de cero con una prueba que falla', () => {
  const { codigo, salida } = correr(['--test', 'pruebas/fixtures/falla-a-proposito.mjs']);
  assert.equal(codigo, 1, 'una prueba que falla tiene que dar salida 1');
  assert.match(salida, /ARIA_FALLA_DELIBERADA/, 'la salida tiene que nombrar la falla');
});

test('el corredor sale CERO cuando todo pasa', () => {
  // Sin esta afirmación, la de arriba pasaría POR EL MOTIVO EQUIVOCADO: una ruta
  // mal escrita, un error de sintaxis o un módulo que no resuelve también dan
  // salida distinta de cero. Es la misma trampa que el 08 § 5.4 señala para el
  // freno por origen — "la prueba pasa por el motivo equivocado y no verifica nada
  // de lo que dice".
  const { codigo } = correr(['--test', 'pruebas/fixtures/pasa.mjs']);
  assert.equal(codigo, 0, 'una prueba que pasa tiene que dar salida 0');
});

test('el ENVOLTORIO —que es lo que corre la integración— también sale 1', () => {
  const { codigo } = correr(['scripts/pruebas.mjs', 'pruebas/fixtures/falla-a-proposito.mjs']);
  assert.equal(codigo, 1);
});

test('el envoltorio sale 1 cuando el patrón no coincide con nada', () => {
  // ÉSTA es la que tapa el defecto verificado del corredor: `node --test` con un
  // patrón que no coincide con ningún archivo SALE 0. Sin esta afirmación, un glob
  // mal escrito —un directorio renombrado, una extensión cambiada— dejaría la
  // integración VERDE con cero pruebas corridas.
  const { codigo, salida } = correr(['scripts/pruebas.mjs', 'pruebas/fixtures/no-existe.mjs']);
  assert.equal(codigo, 1, 'un objetivo inexistente tiene que abortar, no salir 0');
  assert.match(salida, /no existe/);

  // Y el corredor crudo, para dejar constancia de POR QUÉ existe el envoltorio.
  const crudo = correr(['--test', 'pruebas/no-existe-nada-aca/*.test.ts']);
  assert.equal(
    crudo.codigo,
    0,
    'si esto dejó de salir 0, el corredor se arregló y el envoltorio puede simplificarse',
  );
});

test('el flujo de trabajo corre las pruebas y ningún paso neutraliza el fallo', () => {
  const yml = readFileSync(join(RAIZ, '.github/workflows/verificar.yml'), 'utf8');

  assert.match(yml, /^\s*run:\s*npm test\s*$/m, 'tiene que haber un paso que corra `npm test`');

  // Las cuatro formas de tener una integración que se ve verde y no bloquea.
  assert.doesNotMatch(yml, /continue-on-error/, 'ningún paso puede llevar continue-on-error');
  assert.doesNotMatch(yml, /\|\|\s*true/, 'ningún paso puede tragarse el código de salida con || true');
  assert.doesNotMatch(yml, /;\s*exit\s+0/, 'ningún paso puede forzar exit 0');
  // `if: failure()` en un paso de diagnóstico está bien; `always()` sobre el paso de
  // pruebas es lo que lo volvería informativo en vez de bloqueante.
  assert.doesNotMatch(yml, /if:\s*always\(\)/, 'ningún paso puede llevar if: always()');
});

test('`npm test` apunta al envoltorio, y ningún fixture cae dentro de la suite', () => {
  const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.match(
    pkg.scripts?.test ?? '',
    /scripts\/pruebas\.mjs/,
    '`npm test` tiene que pasar por el envoltorio, no por `node --test` directo',
  );

  // El glob de la suite, replicado: ningún archivo bajo `fixtures/` puede entrar.
  const dir = join(RAIZ, 'pruebas');
  const enLaSuite = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.test.ts'))
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'));

  assert.ok(enLaSuite.length > 0, 'la suite no puede estar vacía');
  assert.deepEqual(
    enLaSuite.filter((r) => r.startsWith('fixtures/')),
    [],
    'un fixture terminado en .test.ts haría fallar la suite para siempre',
  );
});
