// El ICP no se construye sobre un segmento que nadie vio.
//
// El paso 5 del Research elige el segmento ganador y el ICP se arma encima. Hasta el 2026-10-02 esa
// elección no se le mostraba a nadie: «Continuar al paso 3» y «Construir» (la cadena de los pasos 3
// al 7) arrancaban el avatar sobre lo que el modelo hubiera decidido. Ahora el paso 5 abre con un
// `<veredicto>` que nombra el segmento y la razón, la pantalla lo muestra y pregunta «¿Construyo tu
// ICP sobre este segmento o prefieres otro?», y si la persona prefiere otro, el paso 5 se rehace
// dándolo por ganador — que es donde el ICP lo lee.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { armarPromptResearch } from '../../lib/fundaciones/prompts.ts';
import { segmentoGanador } from '../../lib/fundaciones/documento.ts';

const codigo = (ruta: string): string => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

const INPUTS = { niche: 'agencias', buyers: '50,000+', ltv: '$3,000+', experience: 'consultor' };
const PREVIAS = ['SALIDA UNO', 'SALIDA DOS', 'SALIDA TRES', 'SALIDA CUATRO'];

test('el paso 5 pide abrir con el segmento ganador y su razón, en un veredicto que se puede leer', () => {
  const prompt = armarPromptResearch(4, INPUTS, PREVIAS);
  assert.match(prompt, /<item titulo="Segmento ganador">/);
  assert.match(prompt, /<item titulo="Por qué">UNA sola línea/);

  // Y la pantalla lo lee de ese bloque, sin las negritas del Markdown.
  const paso5 =
    '<veredicto>\n<item titulo="Segmento ganador">**Clínicas dentales** con 3+ sillones</item>\n' +
    '<item titulo="Por qué">Son las más fáciles de encontrar y pueden pagar el ROI</item>\n</veredicto>\n\n# Evaluación';
  assert.deepEqual(segmentoGanador(paso5), {
    segmento: 'Clínicas dentales con 3+ sillones',
    motivo: 'Son las más fáciles de encontrar y pueden pagar el ROI',
  });
});

test('un paso 5 sin veredicto (de antes del cambio) NO se adivina leyendo la prosa', () => {
  assert.equal(segmentoGanador('# Recomendación\n\nEl segmento ganador es el de clínicas.'), null);
  assert.equal(segmentoGanador(''), null);
  assert.equal(segmentoGanador(undefined), null);
  // Un veredicto sin el item del segmento tampoco cuenta.
  assert.equal(segmentoGanador('<veredicto><item titulo="Por qué">razón</item></veredicto>'), null);
});

test('el segmento que elige la persona entra al paso 5 como decisión suya, y solo al paso 5', () => {
  const elegido = armarPromptResearch(4, INPUTS, PREVIAS, undefined, 'clínicas dentales');
  assert.match(elegido, /ELIGIÓ enfocarse en este segmento: «clínicas dentales»/);
  assert.match(elegido, /NO cambies la elección/);

  // Sin elección, el paso 5 elige solo, como siempre: ni el rótulo queda.
  assert.doesNotMatch(armarPromptResearch(4, INPUTS, PREVIAS), /DECISIÓN DEL ALUMNO/);
  assert.doesNotMatch(armarPromptResearch(4, INPUTS, PREVIAS, undefined, '   '), /DECISIÓN DEL ALUMNO/);

  // El servidor rechaza una elección fuera del paso 5, vacía o demasiado larga, en vez de ignorarla.
  const operaciones = codigo('lib/fundaciones/operaciones.ts');
  assert.match(
    operaciones,
    /if \(paso !== PASOS_RESEARCH - 1 \|\| elegido === '' \|\| elegido\.length > TOPE_DEL_SEGMENTO_ELEGIDO\) \{\s*return rechazo\('peticion_invalida'/,
  );
  assert.match(operaciones, /armarPromptResearch\(paso, inputs, previas, estado\.datos, segmentoElegido\)/);
});

test('«Continuar al paso 3» y «Construir» pasan por la confirmación antes de construir el ICP', () => {
  const panel = codigo('components/fundaciones/PanelResearch.jsx');

  // La pregunta, con esas palabras.
  assert.match(panel, /¿Construyo tu ICP sobre este segmento o prefieres otro\?/);

  // «Construir» ya no llama a la cadena directo: pide la confirmación, y la cadena se dispara con el sí.
  assert.doesNotMatch(panel, /onClick=\{onConstruirElMetodo\}/, '«Construir» volvió a arrancar la cadena sin confirmar');
  assert.match(panel, /onClick=\{\(\) => pedirConfirmacion\('construir'\)\}/);
  assert.match(panel, /if \(accion === 'construir'\) \{\s*if \(onConstruirElMetodo\) onConstruirElMetodo\(\);/);

  // La barra del método no recibe `onIr` crudo: «Continuar al paso 3» con el ICP por armar pregunta antes.
  assert.match(panel, /<BarraDePasos[\s\S]*?onIr=\{irDesdeLaBarra\}/);
  assert.match(
    panel,
    /if \(id === 3 && opciones\?\.rellenar && hechos >= PASOS_RESEARCH && !icpHecho && puedeEditar\) \{\s*pedirConfirmacion\('continuar'\);\s*return;/,
  );

  // Y al terminar los cinco pasos, la tarjeta aparece sola si el ICP todavía no existe.
  assert.match(panel, /if \(!icpHecho\) pedirConfirmacion\('continuar'\);/);
  // «Prefiero otro» rehace el paso 5 con el segmento elegido.
  assert.match(panel, /correrPaso\(PASOS_RESEARCH - 1, valores, segmento\)/);
});
