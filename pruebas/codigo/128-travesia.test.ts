// La travesía de Fundaciones: qué sigue después de cada entregable. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE SALE ESTO
//
// Reclamo de Jorge: *«en su ARIA-brain, los pasos del 2 al 7 se ejecutaban solos o algo así»*. Se
// revisó el hub entero y **no hay ninguna ejecución automática**: `useRunTool` corre UNA herramienta
// y nadie la llama en bucle. Lo que sí hay es esta banda, y su botón lleva el rótulo de EJECUCIÓN de
// la herramienta siguiente aunque solo navegue — con todo heredándose solo, llegar y apretar generar
// se siente como que la cadena siguió andando.
//
// Lo que se persigue acá, entonces:
//
//   · Que la banda NO genere. Una cadena que se dispara sola gastaría nueve generaciones de la
//     llave de la organización porque alguien terminó la primera.
//   · Que la travesía no pierda un paso en silencio. Es una lista literal y los catálogos se
//     mueven: el VSL y la Landing ya cambiaron de pantalla dos veces.
//   · Que cruzar de pantalla abra la herramienta correcta. El destino se anota y se consume UNA
//     vez; si quedara puesto, la próxima visita a esa pantalla saltaría sola a una herramienta que
//     nadie pidió — un defecto que no se atribuye nunca al botón que lo causó.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import { FUNDACIONES, TOOLS, TODAS, tieneAgente } from '../../lib/fundaciones/herramientas.ts';
import {
  TRAVESIA,
  anotarDestino,
  olvidarDestino,
  pantallaDe,
  posicionEnLaTravesia,
  siguienteDeLaTravesia,
  tomarDestino,
} from '../../lib/fundaciones/travesia.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const codigo = (r: string): string =>
  leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('la travesía es el orden del MÉTODO, y son los nueve pasos', () => {
  /* No es el orden de los identificadores ni el de las pestañas. Es la misma lista que
     `FOUNDATIONS_JOURNEY` del hub, literal para que reordenarla sea una decisión. */
  assert.deepEqual(
    TRAVESIA,
    [0, 1, 3, 2, 4, 10, 26, 5, 6],
    'Perfil → Research → ICP → Categoría → Oferta → Pricing → Mapa → VSL → Landing',
  );
  assert.equal(TRAVESIA.length, 9);
});

test('ninguna herramienta del método queda fuera de la travesía, ni al revés', () => {
  /* La comprobación que hace que una mudanza no rompa la cadena en silencio. Toda herramienta que
     genera un entregable del método —las que tienen agente, o sea las genéricas más el Research—
     tiene que estar en la travesía; y todo paso de la travesía tiene que existir en algún catálogo. */
  const conEntregable = [...FUNDACIONES, ...TOOLS].filter(tieneAgente).map((h) => h.id).sort();
  assert.deepEqual(
    [...TRAVESIA].sort(),
    conEntregable,
    'la travesía y las herramientas que producen un entregable dejaron de coincidir',
  );

  for (const id of TRAVESIA) {
    assert.ok(TODAS.some((h) => h.id === id), `la travesía nombra la herramienta ${id}, que no existe`);
  }
});

test('la pantalla de cada paso se DERIVA del catálogo, no está escrita', () => {
  /* El VSL y la Landing se mudaron a `tools`; los siete primeros siguen en `icp`. Si esto estuviera
     escrito a mano, la próxima mudanza dejaría la travesía llevando a la pantalla equivocada — y el
     botón abriría una vista donde esa herramienta no está. */
  for (const h of FUNDACIONES) assert.equal(pantallaDe(h.id), 'icp', `${h.pestania} no cae en icp`);
  for (const h of TOOLS) assert.equal(pantallaDe(h.id), 'tools', `${h.pestania} no cae en tools`);

  // Y las dos claves son secciones de verdad, no cadenas inventadas.
  for (const clave of ['icp', 'tools']) {
    assert.ok(SECCIONES.some((s) => s.clave === clave), `"${clave}" no es una sección del catálogo`);
  }
});

test('el paso siguiente es el del método, con su posición y su pantalla', () => {
  const desdeElMapa = siguienteDeLaTravesia(26);
  assert.equal(desdeElMapa.tipo, 'paso');
  if (desdeElMapa.tipo !== 'paso') return;
  assert.equal(desdeElMapa.herramienta.id, 5, 'después del Mapa viene el VSL');
  assert.equal(desdeElMapa.posicion, 8);
  // Y cruza de pantalla: es el caso que obliga a existir al destino pendiente.
  assert.equal(desdeElMapa.pantalla, 'tools');

  // El último cierra en vez de ofrecer otro paso.
  assert.equal(siguienteDeLaTravesia(6).tipo, 'final');
  // Y lo que no es del método no encadena con nada: Prospección y el Espía no están.
  assert.equal(siguienteDeLaTravesia(20).tipo, 'fuera');
  assert.equal(posicionEnLaTravesia(20), 0);
  assert.equal(posicionEnLaTravesia(0), 1);
});

test('el destino pendiente se consume UNA vez, y solo lo levanta su pantalla', () => {
  olvidarDestino();
  anotarDestino('tools', 5);

  // La otra pantalla no se lo lleva: si lo hiciera, abriría una herramienta que no tiene.
  assert.equal(tomarDestino('icp'), null);
  assert.equal(tomarDestino('tools'), 5);
  /* Y no queda puesto. Un destino que sobrevive hace que la próxima visita a esa pantalla salte sola
     a una herramienta que nadie pidió, sin que nada lo explique. */
  assert.equal(tomarDestino('tools'), null);
});

// ─── La banda ──────────────────────────────────────────────────────────────

test('la banda NAVEGA y no genera', () => {
  /* La afirmación central. Generar cuesta tokens de la llave de la organización: una cadena que se
     dispara sola gastaría nueve generaciones porque alguien terminó la primera. Lo que el reclamo
     pedía era la guía, no el gasto. */
  const banda = codigo('components/fundaciones/BandaDeMomento.jsx');
  assert.ok(!/pedir\(/.test(banda), 'la banda hace una petición: está generando');
  assert.ok(!/rutaGenerar|correrTodo|generar\(/.test(banda), 'la banda dispara una generación');
  assert.match(banda, /onClick=\{\(\) => onIr\(siguiente\)\}/);

  // El rótulo del botón sale del catálogo, no está escrito acá: si se escribiera, prometería una
  // cosa distinta de la que dice el botón real al llegar.
  assert.match(banda, /\{proxima\.etiquetaBoton\}/);
});

test('la banda aparece cuando hay algo terminado, no antes', () => {
  const generica = codigo('components/fundaciones/PanelHerramienta.jsx');
  // Con documento: sin él no hay nada completo que desbloquee un paso.
  assert.match(generica, /\{documento && onSiguientePaso \? \(\s*<BandaDeMomento/);

  const research = codigo('components/fundaciones/PanelResearch.jsx');
  /* Y en el Research con los CINCO pasos: con cuatro, la banda estaría invitando a generar el ICP
     sobre un research que todavía no eligió su segmento ganador. */
  const i = research.indexOf('hechos >= PASOS_RESEARCH');
  const j = research.indexOf('<BandaDeMomento');
  assert.ok(i > 0 && j > i, 'la banda del Research no está dentro de la condición de los cinco pasos');
});

test('cruzar de pantalla anota el destino ANTES de abrir la vista', () => {
  /* Al revés no funciona y no falla: la otra pantalla se abre, su `Fundaciones` levanta el destino
     —que todavía no está— y se queda en su primera herramienta. El síntoma sería «el botón me lleva
     a Tools pero a Prospección». */
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  const anota = armazon.indexOf('anotarDestino(siguiente.pantalla');
  const abre = armazon.indexOf('irALaVista(siguiente.pantalla');
  assert.ok(anota > 0 && abre > anota, 'se abre la vista antes de anotar a dónde hay que ir');

  // Y dentro de la misma pantalla no se navega de vista: es cambiar de subpestaña.
  assert.match(armazon, /if \(siguiente\.pantalla === pantalla\) \{\s*setActiva\(siguiente\.herramienta\.id\);/);
});
