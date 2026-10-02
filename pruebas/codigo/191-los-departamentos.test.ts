// Los departamentos reparten el menú y no deciden quién ve qué. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE ROMPE SIN QUE FALLE NADA (docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md, NE-11 a NE-16)
//
// La barra nueva dibuja departamentos, y un departamento es una tabla: qué sección abre cada entrada y
// con qué pestaña (`lib/autorizacion/departamentos.ts`). Hay tres formas de romperla que no fallan:
//
//   · una sección del menú que no está en la tabla: la persona tiene permiso y no la puede abrir. Es
//     lo que pasaría con una sección nueva que alguien agregue a `secciones.ts` sin ubicarla;
//   · una pestaña de Tools o de Analizadores sin entrada: desde que sus barras propias se fueron
//     (E11), queda inalcanzable. Y una entrada que pide una pestaña que no existe abre otra;
//   · una barra que vuelve a decidir quién ve qué, en vez de repartir lo que `menuVisible()` ya dejó
//     pasar (`NE-16`).
//
// Las mutaciones que la ponen en rojo: sacar `conversion` de la tabla; ubicar `closer` dos veces;
// borrar `mis-leads` del modelo o pedir una pestaña que no existe; sacar el filtro que esconde un
// departamento sin nada que abrir; mostrar una entrada cuya sección no está en el menú; cambiar el
// orden o una ceja; y que la ruta de sesión arme la navegación con otro menú, o el rótulo con otra
// cosa que el alcance. Los grupos de la segunda edición (`NE-45`) tienen su prueba, la `196`; acá
// cuentan como lo que son en la tabla: entradas, cada una con su sección y su pestaña.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import {
  DEPARTAMENTOS,
  ENTRADAS,
  FUERA,
  menuPorDepartamentos,
  type Navegacion,
} from '../../lib/autorizacion/departamentos.ts';
import { SECCIONES, menuVisible, type Alcance } from '../../lib/autorizacion/secciones.ts';
import { TOOLS } from '../../lib/fundaciones/herramientas.ts';

const fuente = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const CON_MENU = SECCIONES.filter((s) => s.menu).map((s) => s.clave);
const TODAS = new Set(SECCIONES.map((s) => s.capacidadRequerida));
const SIN_RESTRICCION: Alcance = { restringido: false };

/** La navegación de alguien, armada como la arma la ruta de sesión. */
const navegacion = (permisos: ReadonlySet<string>, alcance: Alcance = SIN_RESTRICCION, principal = true) =>
  menuPorDepartamentos(menuVisible(permisos, alcance, principal));

/** Las secciones que una navegación deja abrir, sin repetir: también las de las sub-pestañas de cada
 *  grupo, que no tienen por qué ser la de la entrada (Leads abre el Leads Portal y Tools). */
const seccionesDe = (n: Navegacion): string[] => [
  ...new Set([
    ...(n.inicio ? [n.inicio.seccion] : []),
    ...n.departamentos.flatMap((d) =>
      d.entradas.flatMap((e) => {
        if ('proximamente' in e) return [];
        return e.subs ? e.subs.flatMap((s) => ('seccion' in s ? [s.seccion] : [])) : [e.seccion];
      }),
    ),
    ...n.engranaje.map((e) => e.seccion),
  ]),
];

/** Lo que se ve, en el orden en que se ve: un grupo, con sus sub-pestañas entre corchetes. */
const forma = (n: Navegacion) => {
  const nombre = (e: { nombre: string; proximamente?: true }) => (e.proximamente ? `${e.nombre} (próximamente)` : e.nombre);
  return {
    inicio: n.inicio?.nombre ?? null,
    departamentos: n.departamentos.map((d) => [
      d.nombre,
      d.entradas.map((e) => ('subs' in e && e.subs ? `${e.nombre} [${e.subs.map(nombre).join(' · ')}]` : nombre(e))),
    ]),
    engranaje: n.engranaje.map((e) => e.nombre),
  };
};

/** Las pestañas que cada pantalla con pestañas tiene de verdad, leídas de donde se definen. */
function pestanasReales(): Record<string, string[]> {
  const vistas = /vistas:\s*\[([\s\S]*?)\n\s*\],/.exec(fuente('components/views/ToolsView.jsx'));
  assert.ok(vistas, 'no se pudieron leer las vistas de Tools');
  const analizadores = /const PESTANAS = \[([\s\S]*?)\];/.exec(fuente('components/analizadores/PanelDeAnalizadores.jsx'));
  assert.ok(analizadores, 'no se pudieron leer las pestañas de Analizadores');
  const claves = (t: string) => [...sinComentarios(t).matchAll(/clave: '([\w-]+)'/g)].map((m) => m[1]!);
  return {
    tools: [...TOOLS.map((h) => h.clave), ...claves(vistas[1]!)],
    analizadores: claves(analizadores[1]!),
  };
}

test('toda sección del menú está ubicada, y una sola vez', () => {
  const lugares = new Map<string, string[]>();
  const anotar = (clave: string, donde: string) => lugares.set(clave, [...(lugares.get(clave) ?? []), donde]);
  anotar(FUERA.inicio, 'el Inicio');
  for (const c of FUERA.engranaje) anotar(c, 'el engranaje');
  for (const e of ENTRADAS) {
    if ('proximamente' in e) continue;
    anotar(e.seccion, e.pestana ? `pestaña ${e.pestana}` : `una entrada de ${e.departamento}`);
  }
  for (const c of CON_MENU) {
    assert.ok(lugares.has(c), `\`${c}\` está en el menú y en ningún departamento: quien la ve no la puede abrir`);
  }
  for (const c of lugares.keys()) {
    assert.ok(CON_MENU.includes(c), `la tabla ubica \`${c}\`, que no es una sección del menú`);
  }
  // Una sola vez: o un lugar entero, o sólo pestañas, y cada pestaña una vez.
  for (const [c, ls] of lugares) {
    const pestanas = ls.filter((l) => l.startsWith('pestaña '));
    const enteros = ls.length - pestanas.length;
    assert.equal(enteros + (pestanas.length > 0 ? 1 : 0), 1, `\`${c}\` está ubicada más de una vez: ${ls.join(', ')}`);
    assert.equal(new Set(pestanas).size, pestanas.length, `\`${c}\` repite una pestaña: ${ls.join(', ')}`);
  }
});

test('toda pestaña que pide una entrada existe, y toda pestaña tiene su entrada', () => {
  const reales = pestanasReales();
  assert.ok(reales.tools!.length >= 5 && reales.analizadores!.length >= 2, 'se leyeron menos pestañas de las que hay');
  for (const e of ENTRADAS) {
    if ('proximamente' in e) continue;
    if (e.pestana === undefined) {
      /* Tools y Analizadores se reparten en varios departamentos (`NE-19`): una entrada que los abra
         sin pestaña abriría la que quedó elegida la última vez. */
      assert.ok(!(e.seccion in reales), `una entrada abre \`${e.seccion}\` sin decir qué pestaña`);
      continue;
    }
    assert.ok(e.seccion in reales, `\`${e.seccion}\` no tiene pestañas que la navegación elija, y una entrada le pide \`${e.pestana}\``);
    assert.ok(reales[e.seccion]!.includes(e.pestana), `la entrada «${e.nombre}» pide la pestaña \`${e.pestana}\`, que \`${e.seccion}\` no tiene: abriría otra`);
  }
  /* Y al revés: desde que las barras propias de Tools y Analizadores se fueron (E11), una pestaña sin
     entrada queda inalcanzable sin un solo error. */
  for (const [seccion, pestanas] of Object.entries(reales)) {
    for (const p of pestanas) {
      const entradas = ENTRADAS.filter((e) => 'seccion' in e && e.seccion === seccion && e.pestana === p);
      assert.equal(entradas.length, 1, `la pestaña \`${p}\` de \`${seccion}\` tiene ${entradas.length} entradas, y es una`);
    }
  }
});

test('la visibilidad sale sólo del menú', () => {
  // La función recibe el menú y nada más: no tiene con qué volver a decidir permisos.
  assert.equal(menuPorDepartamentos.length, 1, '`menuPorDepartamentos` recibe algo más que el menú');
  const modelo = sinComentarios(fuente('lib/autorizacion/departamentos.ts'));
  assert.doesNotMatch(modelo, /\bimport\b/, 'el modelo de departamentos importa algo: la visibilidad tiene que llegarle hecha');

  // Para cada sección del menú, quien sólo tiene ésa ve sólo ésa: ni más, ni menos.
  for (const c of CON_MENU) {
    const n = navegacion(TODAS, { restringido: true, concedidas: new Set([c]) });
    assert.deepEqual(seccionesDe(n), [c], `con sólo \`${c}\` la barra deja abrir ${JSON.stringify(seccionesDe(n))}`);
  }

  // Un closer ve Sales › Closer, y nada más: ni el Inicio, ni el engranaje, ni Marketing por sus «Próximamente».
  assert.deepEqual(forma(navegacion(new Set(['closer.ver']))), {
    inicio: null,
    departamentos: [['Sales', ['Closer']]],
    engranaje: [],
  });
  /* Quien tiene Tools ve sus seis sub-pestañas en tres grupos de tres departamentos, y Marketing con
     sus «Próximamente». Leads, sin el Leads Portal: «De GHL» se ve por su sección y no por la del grupo. */
  assert.deepEqual(forma(navegacion(new Set(['tools.ver']))).departamentos, [
    ['Research', ['Radar [Espía a tus competidores · Scraper]']],
    ['Marketing', ['Copywriter (próximamente)', 'Funnel [Tu landing · Tu VSL]', 'Content Studio (próximamente)']],
    ['Sales', ['Leads [Todos (próximamente) · De Radar · Plan de prospección]']],
  ]);
  // Un departamento con sólo «Próximamente» no se dibuja (`NE-13`).
  assert.deepEqual(forma(navegacion(new Set(['analizadores.ver']))).departamentos, [
    ['Sales', ['Llamadas de venta']],
    ['Client Success', ['Llamadas de onboarding', 'Seguimiento de clientes (próximamente)']],
  ]);
  assert.deepEqual(navegacion(new Set()).departamentos, [], 'sin ninguna sección aparece un departamento');
});

test('el orden es el de `NE-45`, y cada ceja la del documento', () => {
  assert.deepEqual(forma(navegacion(TODAS)), {
    inicio: 'Inicio',
    departamentos: [
      ['Research', ['ICP & Oferta', 'Radar [Espía a tus competidores · Scraper]']],
      ['Systems', ['Acquisition', 'Conversion', 'Conversation']],
      ['Marketing', ['Creative Insights', 'Copywriter (próximamente)', 'Funnel [Tu landing · Tu VSL]', 'Content Studio (próximamente)']],
      ['Sales', ['Closing', 'Leads [Todos (próximamente) · De GHL · De Radar · Plan de prospección]', 'Setter', 'Closer', 'Llamadas de venta']],
      ['Client Success', ['Llamadas de onboarding', 'Seguimiento de clientes (próximamente)']],
    ],
    engranaje: ['Ajustes', 'Panel de Monitoreo', 'Incidentes'],
  });
  // Desde una empresa que no es la principal, el engranaje pierde lo que mira a todas (`NE-14`).
  assert.deepEqual(navegacion(TODAS, SIN_RESTRICCION, false).engranaje.map((e) => e.nombre), ['Ajustes']);

  const tabla = [...fuente('docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md').matchAll(/^\| \*\*([^*|]+)\*\* \| `([^`]+)` \|/gm)]
    .map((m) => [m[1]!, m[2]!]);
  assert.deepEqual(DEPARTAMENTOS.map((d) => [d.nombre, d.ceja]), tabla, 'los departamentos o sus cejas no son los de `NE-12`');
  // La ceja es el departamento, nada más (`NE-48`): la de «· SE INSTALA EN …» se fue con la segunda edición.
  for (const d of DEPARTAMENTOS) assert.equal(d.ceja, d.nombre.toUpperCase(), `la ceja de ${d.nombre} dice otra cosa que su nombre`);
});

test('la sesión arma la navegación con el mismo menú, y el rótulo sale del alcance', () => {
  const ruta = sinComentarios(fuente('app/api/auth/sesion/route.ts'));
  /* El menú se arma UNA vez y de él salen las dos cosas: llamar dos veces a `menuVisible` es la forma
     de que mañana la barra y el menú no coincidan. */
  assert.equal((ruta.match(/\bmenuVisible\(/g) ?? []).length, 1, 'la ruta de sesión arma el menú más de una vez');
  assert.match(ruta, /navegacion: menuPorDepartamentos\(menu\),/, 'la navegación no sale del mismo menú');
  /* Un booleano del alcance, y nunca el nombre del rol (`pruebas/codigo/30-portero.test.ts`). */
  assert.match(ruta, /restringido: contexto\.alcance\.restringido,/, 'el rótulo ADMIN/USUARIO no sale del alcance');
});
