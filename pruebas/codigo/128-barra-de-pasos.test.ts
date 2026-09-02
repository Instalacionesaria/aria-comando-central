// La barra del método: paso anterior, progreso y «Continuar al paso N». Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE SALE
//
// Reportado por Kevin: se terminan los cinco pasos del Research y no hay ningún «Continuar al paso
// 3». En ARIA-brain esa barra (`StepNav`) acompaña a todas las herramientas del método y este port
// se la había dejado.
//
// Lo que se persigue acá:
//
//   · Que la barra NAVEGUE y no genere. Cada generación gasta la llave de IA de la organización:
//     una cadena que se dispara sola gastaría nueve porque alguien terminó la primera.
//   · Que el orden sea el del MÉTODO. No es el de los identificadores ni el de las pestañas, y
//     equivocarlo manda al alumno a construir sobre algo que todavía no existe.
//   · Que no ofrezca un botón que no puede cumplir. El VSL y la Landing viven en `tools`: desde
//     «ICP & Oferta» no se los puede abrir con un cambio de subpestaña, así que la barra lo DICE en
//     vez de llevar a la pantalla equivocada.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import { FUNDACIONES, TOOLS, TODAS, tieneAgente } from '../../lib/fundaciones/herramientas.ts';
import {
  TRAVESIA,
  pantallaDe,
  pasoAnterior,
  pasoSiguiente,
  posicionEnLaTravesia,
} from '../../lib/fundaciones/travesia.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const codigo = (r: string): string =>
  leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('la travesía es el orden del MÉTODO, y son los nueve pasos', () => {
  assert.deepEqual(
    TRAVESIA,
    [0, 1, 3, 2, 4, 10, 26, 5, 6],
    'Perfil → Research → ICP → Categoría → Oferta → Pricing → Mapa → VSL → Landing',
  );
});

test('ninguna herramienta del método queda fuera de la travesía, ni al revés', () => {
  /* La comprobación que impide que una mudanza rompa la barra en silencio. Toda herramienta que
     produce un entregable del método tiene que ser un paso, y todo paso tiene que existir. */
  const conEntregable = [...FUNDACIONES, ...TOOLS].filter(tieneAgente).map((h) => h.id).sort();
  assert.deepEqual([...TRAVESIA].sort(), conEntregable);
  for (const id of TRAVESIA) {
    assert.ok(TODAS.some((h) => h.id === id), `la travesía nombra ${id}, que no existe`);
  }
});

test('después del Research viene el ICP, y es el paso 3', () => {
  /* El caso del reporte, literal: los cinco pasos del Research terminados y el botón que faltaba. */
  assert.equal(posicionEnLaTravesia(1), 2, 'el Research es el paso 2 del método');

  const siguiente = pasoSiguiente(1);
  assert.ok(siguiente);
  assert.equal(siguiente.herramienta.id, 3, 'después del Research viene el ICP');
  assert.equal(siguiente.posicion, 3, 'el botón dice «Continuar al paso 3»');
  // Y está en la MISMA pantalla, así que el botón se puede dibujar de verdad.
  assert.equal(siguiente.pantalla, 'icp');

  const anterior = pasoAnterior(1);
  assert.equal(anterior?.herramienta.id, 0, 'antes del Research está Tu ficha');
});

test('los extremos no ofrecen lo que no hay', () => {
  assert.equal(pasoAnterior(0), null, 'el primer paso ofrece un «anterior»');
  assert.equal(pasoSiguiente(6), null, 'el último paso ofrece un «siguiente»');
  // Prospección y el Espía no son pasos del método: la barra no se dibuja para ellos.
  assert.equal(posicionEnLaTravesia(20), 0);
  assert.equal(pasoSiguiente(20), null);
});

test('la pantalla de cada paso se DERIVA del catálogo', () => {
  for (const h of FUNDACIONES) assert.equal(pantallaDe(h.id), 'icp');
  for (const h of TOOLS) assert.equal(pantallaDe(h.id), 'tools');
  // Y el cruce que la barra no puede resolver con un cambio de subpestaña: Mapa(26) → VSL(5).
  assert.equal(pasoSiguiente(26)?.pantalla, 'tools');
});

test('la barra NAVEGA y no genera', () => {
  /* La afirmación central. Lo que faltaba era la guía, no el gasto. */
  const barra = codigo('components/fundaciones/BarraDePasos.jsx');
  assert.ok(!/pedir\(/.test(barra), 'la barra hace una petición: está generando');
  assert.ok(!/rutaGenerar|correrTodo|generar\(/.test(barra), 'la barra dispara una generación');
  assert.match(barra, /onIr\(siguiente\.herramienta\.id\)/);
});

test('no se dibuja un botón que no puede cumplir', () => {
  /* El `07` § 4. Cuando el paso siguiente vive en la otra pantalla, la barra dice dónde está en vez
     de ofrecer un botón que abriría la herramienta equivocada. */
  const barra = codigo('components/fundaciones/BarraDePasos.jsx');
  assert.match(barra, /const puedeIr = \(vecino\) => !!vecino && vecino\.pantalla === pantalla;/);
  assert.match(barra, /puedeIr\(siguiente\) \?/);
});

test('la barra está en los dos paneles del método', () => {
  /* En el del Research —que es donde se reportó— y en el genérico, que sirve a las otras ocho. Una
     barra que existiera en una sola dejaría la travesía cortada en la primera herramienta que no la
     tenga, sin que nada falle. */
  for (const panel of [
    'components/fundaciones/PanelResearch.jsx',
    'components/fundaciones/PanelHerramienta.jsx',
  ]) {
    const fuente = codigo(panel);
    assert.match(fuente, /<BarraDePasos/, `${panel} no dibuja la barra del método`);
    assert.match(fuente, /pantalla=\{pantalla\}/, `${panel} no le pasa su pantalla`);
  }

  // Y el armazón le pasa a cada panel su pantalla, que es lo que decide si el botón se puede dibujar.
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(armazon, /pantalla: 'icp'/);
  assert.match(codigo('components/views/ToolsView.jsx'), /pantalla: 'tools'/);
});
