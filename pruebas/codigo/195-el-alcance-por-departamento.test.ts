// Ajustes › Usuarios ofrece las pestañas agrupadas por departamento, cada una una sola vez. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/OTROS/nueva-estructura/02-DONDE-VA-CADA-PANTALLA.md, NE-21)
//
// Las casillas de pestañas de una persona se agrupan desde la etapa E12 por departamento, con la lista de
// lo que abre cada una. Tres formas de romperlo no fallan:
//
//   · repetir una sección en varios grupos —Tools en Research, Marketing y Sales—: tres casillas que se
//     tildan y se destildan juntas sin que se vea por qué, con su descripción repetida;
//   · perder o agregar una sección al reagrupar, o perderle un campo: el reparto de `alcanceOfrecible`
//     (que vigila `pruebas/codigo/101-alcance.test.ts`) dejaría de ser lo que se ofrece, y sin
//     `soloDesdeLaPrincipal` la pantalla ofrecería Monitoreo a una empresa cliente;
//   · esconder lo que abre una casilla que abre varias cosas, o una sola que la barra llama de otra
//     forma (el Leads Portal es Sales › Leads › De GHL desde la segunda edición), o escribirlo a mano.
//
// Lo que se EJECUTA: `alcancePorDepartamento` sobre `alcanceOfrecible`, con todas las capacidades y con
// pedazos. La ruta y la pantalla se leen del fuente.
//
// Las mutaciones que la ponen en rojo: ubicar una sección en todos los departamentos de sus entradas;
// perder las que no son de ningún departamento, o un campo de una sección; dejar grupos vacíos; otro orden; un `abre` sin el
// departamento, sin el grupo o sin las entradas con pestaña; que la ruta mande el agrupado viejo; y que la
// pantalla no diga lo que abre, lo diga con una sola entrada que la barra llama igual, o lo calle con una
// que la barra llama de otra forma.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { alcancePorDepartamento, diceLoQueAbre } from '../../lib/autorizacion/departamentos.ts';
import { SECCIONES, alcanceOfrecible } from '../../lib/autorizacion/secciones.ts';

const fuente = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const TODAS = new Set(SECCIONES.map((s) => s.capacidadRequerida));
const claves = (grupos: readonly { secciones: readonly { clave: string }[] }[]) => grupos.flatMap((g) => g.secciones.map((s) => s.clave));

test('cada sección que el rol alcanza, una vez y en un solo grupo', () => {
  for (const permisos of [TODAS, new Set(['tools.ver']), new Set(['closer.ver', 'analizadores.ver']), new Set<string>()]) {
    const ofrecidas = alcanceOfrecible(permisos);
    const agrupadas = alcancePorDepartamento(ofrecidas);
    assert.deepEqual([...claves(agrupadas)].sort(), [...claves(ofrecidas)].sort(), 'al reagrupar entró o salió una sección');
    assert.equal(new Set(claves(agrupadas)).size, claves(agrupadas).length, 'una sección está en más de un grupo: sus casillas se tildarían y destildarían juntas');
    for (const g of agrupadas) assert.ok(g.secciones.length > 0, `el grupo «${g.grupo.etiqueta}» quedó vacío`);
    // Cada sección con TODOS sus campos, más `abre`: la pantalla lee `soloDesdeLaPrincipal`.
    const originales = new Map(ofrecidas.flatMap((g) => g.secciones.map((s) => [s.clave, s] as const)));
    for (const g of agrupadas) {
      for (const { abre, ...resto } of g.secciones) {
        assert.ok(Array.isArray(abre));
        assert.deepEqual(resto, originales.get(resto.clave), `la sección \`${resto.clave}\` perdió un campo al reagrupar`);
      }
    }
  }
});

test('el orden es el de la barra: el Inicio, los departamentos, el engranaje y lo demás', () => {
  const agrupadas = alcancePorDepartamento(alcanceOfrecible(TODAS));
  assert.deepEqual(
    agrupadas.map((g) => [g.grupo.etiqueta, g.secciones.map((s) => s.clave)]),
    [
      [null, ['executive']],
      ['Research', ['icp', 'tools']],
      ['Systems', ['acquisition', 'conversion', 'conversation']],
      ['Marketing', ['creative']],
      ['Sales', ['sales', 'contacts', 'setter', 'closer', 'analizadores']],
      ['Menú de la cuenta', ['credenciales', 'monitoreo', 'incidentes']],
      ['Ajustes', ['usuarios', 'empresas']],
    ],
  );
});

test('cada casilla dice lo que abre, con el departamento', () => {
  const abre = new Map(alcancePorDepartamento(alcanceOfrecible(TODAS)).flatMap((g) => g.secciones.map((s) => [s.clave, s.abre] as const)));
  // Con el grupo en el medio, como lo dice la barra (`NE-45`).
  assert.deepEqual(abre.get('tools'), [
    'Research › Radar › Espía a tus competidores',
    'Research › Radar › Scraper',
    'Marketing › Funnel › Tu landing',
    'Marketing › Funnel › Tu VSL',
    'Sales › Leads › De Radar',
    'Sales › Leads › Plan de prospección',
  ]);
  assert.deepEqual(abre.get('analizadores'), ['Sales › Llamadas de venta', 'Client Success › Llamadas de onboarding']);
  assert.deepEqual(abre.get('contacts'), ['Sales › Leads › De GHL']);
  assert.deepEqual(abre.get('sales'), ['Sales › Closing']);
  assert.deepEqual(abre.get('acquisition'), ['Systems › Acquisition']);
  assert.deepEqual(abre.get('executive'), []);
  assert.deepEqual(abre.get('usuarios'), []);
});

test('la casilla dice lo que abre cuando abre más de una, o una que la barra llama de otra forma', () => {
  const secciones = new Map(alcancePorDepartamento(alcanceOfrecible(TODAS)).flatMap((g) => g.secciones.map((s) => [s.clave, s] as const)));
  const dice = (clave: string) => diceLoQueAbre(secciones.get(clave)!);
  assert.equal(dice('tools'), true, '«Tools» abre seis entradas y no lo dice');
  assert.equal(dice('analizadores'), true);
  // El Leads Portal es Sales › Leads › De GHL: sin decirlo, la casilla nombra un lugar que la barra no muestra.
  assert.equal(dice('contacts'), true, 'la casilla del Leads Portal no dice dónde está');
  // Cuando la barra la llama como a la sección, el nombre ya lo dice.
  for (const clave of ['sales', 'creative', 'acquisition', 'closer', 'icp']) assert.equal(dice(clave), false, `«${clave}» repite su nombre al lado`);
  assert.equal(dice('executive'), false, 'el Inicio dice que abre algo');
  assert.equal(diceLoQueAbre({ nombre: 'Algo' }), false, 'sin `abre`, la casilla promete algo');
});

test('la ruta manda el agrupado por departamento, y la pantalla dice lo que abre', () => {
  const ruta = sinComentarios(fuente('app/api/admin/roles/route.ts'));
  assert.match(ruta, /alcance: alcancePorDepartamento\(alcanceOfrecible\(capacidades\)\)/, 'la ruta manda el agrupado del menú viejo');
  const pantalla = sinComentarios(fuente('components/ajustes/Usuarios.jsx'));
  // Cuando `diceLoQueAbre`: con una sola que la barra llama igual, el nombre de la casilla ya lo dice.
  assert.match(pantalla, /\{diceLoQueAbre\(sec\) \? \(\s*<span className="aj-abre" id=\{`\$\{id\}-\$\{sec\.clave\}-abre`\}>\s*abre \{sec\.abre\.join\(' · '\)\}/, 'la casilla no dice lo que abre');
  assert.match(pantalla, /aria-describedby=\{diceLoQueAbre\(sec\) \? `\$\{id\}-\$\{sec\.clave\}-abre` : undefined\}/, 'el lector de pantalla no oye lo que abre la casilla');
  assert.equal((pantalla.match(/diceLoQueAbre\(sec\)/g) ?? []).length, 2, 'la pantalla decide en otro lugar si dice lo que abre');
  assert.doesNotMatch(pantalla, /Research ›|Marketing ›|Sales ›/, 'la pantalla escribe a mano dónde vive una pestaña');
});
