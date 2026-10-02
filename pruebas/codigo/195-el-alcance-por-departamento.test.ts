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
//   · esconder lo que abre una casilla que abre varias cosas, o escribirlo a mano.
//
// Lo que se EJECUTA: `alcancePorDepartamento` sobre `alcanceOfrecible`, con todas las capacidades y con
// pedazos. La ruta y la pantalla se leen del fuente.
//
// Las mutaciones que la ponen en rojo: ubicar una sección en todos los departamentos de sus entradas;
// perder las que no son de ningún departamento, o un campo de una sección; dejar grupos vacíos; otro orden; un `abre` sin el
// departamento o sin las entradas con pestaña; que la ruta mande el agrupado viejo; y que la pantalla no
// diga lo que abre, o lo diga también con una sola entrada.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { alcancePorDepartamento } from '../../lib/autorizacion/departamentos.ts';
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
  assert.deepEqual(abre.get('tools'), [
    'Research › Espía a tus competidores',
    'Research › Scraper',
    'Research › Mis Leads',
    'Marketing › Tu página',
    'Marketing › Tu video de ventas',
    'Sales › Prospección en frío',
  ]);
  assert.deepEqual(abre.get('analizadores'), ['Sales › Analizador HT', 'Client Success › Analizador OB']);
  assert.deepEqual(abre.get('acquisition'), ['Systems › Acquisition']);
  assert.deepEqual(abre.get('executive'), []);
  assert.deepEqual(abre.get('usuarios'), []);
});

test('la ruta manda el agrupado por departamento, y la pantalla dice lo que abre', () => {
  const ruta = sinComentarios(fuente('app/api/admin/roles/route.ts'));
  assert.match(ruta, /alcance: alcancePorDepartamento\(alcanceOfrecible\(capacidades\)\)/, 'la ruta manda el agrupado del menú viejo');
  const pantalla = sinComentarios(fuente('components/ajustes/Usuarios.jsx'));
  // Sólo cuando abre más de una: con una, el nombre de la casilla ya lo dice.
  assert.match(pantalla, /\{sec\.abre\?\.length > 1 \? \(\s*<span className="aj-abre" id=\{`\$\{id\}-\$\{sec\.clave\}-abre`\}>\s*abre \{sec\.abre\.join\(' · '\)\}/, 'la casilla no dice lo que abre');
  assert.match(pantalla, /aria-describedby=\{sec\.abre\?\.length > 1 \? `\$\{id\}-\$\{sec\.clave\}-abre` : undefined\}/, 'el lector de pantalla no oye lo que abre la casilla');
  assert.doesNotMatch(pantalla, /Research ›|Marketing ›|Sales ›/, 'la pantalla escribe a mano dónde vive una pestaña');
});
