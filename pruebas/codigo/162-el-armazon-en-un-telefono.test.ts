// El armazón cuando la pantalla es angosta. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA APLICACIÓN NO ENTRABA EN UN TELÉFONO, Y NO FALLABA NADA
//
// Medido en el navegador el 2026-09-20 a 375 px: `.app` es una rejilla de `216px 1fr`
// (`app/aios.css:115` y `:117`), la barra lateral **no colapsaba**, y al cuerpo le quedaban
// **75 px**. La columna del nombre de cualquier tabla se aplastaba a cero y la página desbordaba en
// horizontal.
//
// No era de una pantalla: se comprobó igual en Acquisition, Creative y Conversion. Era del armazón,
// o sea las doce. Y no lo veía ninguna prueba porque **no hay nada que falle**: el CSS no lanza, la
// rejilla no se queja, y todas las cifras son correctas — están a 75 px de ancho.
//
// ── LO QUE ESTE ARCHIVO VIGILA, Y POR QUÉ NO ES LA GEOMETRÍA ───────────────
//
// Una prueba que lea el fuente no puede ver una caja: eso se mide en el navegador y así se midió.
// Lo que sí se puede fijar son las cuatro uniones que, si se rompen, **no se ven hasta que alguien
// abre la aplicación en un teléfono** — que es justo lo que no pasa en el día a día de este
// proyecto, y por eso el defecto duró lo que duró.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

/** El corte donde la barra lateral deja de ocupar una columna. Ver `app/armazon.css`. */
const CORTE_DEL_MENU = 760;

/** Sin comentarios: una regla citada dentro de un `/* … *\/` no viste nada. */
const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** El cuerpo de la consulta de medios de `max-width: N`, con sus llaves balanceadas. */
function bloqueDeMedios(css: string, ancho: number): string {
  const limpio = sinComentarios(css);
  const i = limpio.search(new RegExp(String.raw`@media\s*\(max-width:\s*${ancho}px\)\s*\{`));
  assert.notEqual(i, -1, `no existe la consulta de medios de ${ancho}px en \`app/armazon.css\``);
  let nivel = 0;
  let j = limpio.indexOf('{', i);
  const desde = j;
  for (; j < limpio.length; j += 1) {
    if (limpio[j] === '{') nivel += 1;
    else if (limpio[j] === '}') {
      nivel -= 1;
      if (nivel === 0) return limpio.slice(desde + 1, j);
    }
  }
  assert.fail(`la consulta de medios de ${ancho}px no cierra`);
}

test('el conmutador y el menú se nombran igual, o el `aria-controls` apunta a la nada', () => {
  /* Son DOS archivos: el botón vive en `TopBar.jsx` y el menú en `Nav.jsx`. Un `aria-controls` que
     no resuelve no rompe nada visible —el botón sigue abriendo el cajón— así que quien usa un lector
     de pantalla oye «abrir el menú» y no tiene cómo saber qué abre. Es un defecto que sólo se nota
     desde una tecnología de asistencia, o sea el que menos probable es que alguien encuentre. */
  const top = leer('components/TopBar.jsx');
  const nav = leer('components/Nav.jsx');

  const m = top.match(/aria-controls="([^"]+)"/);
  assert.ok(m, '`TopBar.jsx` perdió el `aria-controls` del conmutador del menú');
  assert.ok(
    nav.includes(`id="${m[1]}"`),
    `el conmutador dice controlar «${m[1]}» y \`Nav.jsx\` no tiene ningún elemento con ese id`,
  );

  /* Y el botón está SIEMPRE en el marcado. Dibujarlo condicionalmente desde React necesitaría saber
     el ancho en el servidor —no se sabe— y el primer pintado saldría con el botón de más o de
     menos. Lo esconde la hoja, y por eso la hoja tiene que esconderlo. */
  assert.match(
    sinComentarios(leer('app/armazon.css')),
    /\.nav-abrir\s*\{[^}]*display:\s*none/,
    '`.nav-abrir` dejó de esconderse por omisión: el conmutador aparece también en el escritorio, ' +
      'donde el menú ya está a la vista y el botón no significa nada',
  );
});

test('el corte pisa `.app` Y `.app.solo`, que es el error fácil', () => {
  /* `shell.js:133` pone `.solo` en las once pantallas que no son Executive, y `.app.solo` pesa más
     que `.app` a secas. Pisar sólo `.app` deja **Executive arreglada y las otras once rotas**, que
     es peor que no arreglar nada: quien lo pruebe va a abrir la primera pantalla, verla bien, y dar
     el trabajo por terminado. */
  const bloque = bloqueDeMedios(leer('app/armazon.css'), CORTE_DEL_MENU);

  const rejilla = bloque.match(/([^{}]*)\{[^}]*grid-template-columns[^}]*\}/);
  assert.ok(rejilla, `la consulta de ${CORTE_DEL_MENU}px no redefine ninguna rejilla`);
  const selector = rejilla[1]!;
  assert.match(selector, /\.app\b/, 'la rejilla del corte no nombra `.app`');
  assert.match(
    selector,
    /\.app\.solo\b/,
    'la rejilla del corte no nombra `.app.solo`. `shell.js` le pone esa clase a las once pantallas ' +
      'que no son Executive y gana por especificidad: sin ella, once de las doce siguen con la ' +
      'barra ocupando 216 px de un teléfono',
  );
});

test('la barra sale del flujo y el panel derecho se va: las dos mitades del ancho', () => {
  const css = leer('app/armazon.css');
  const angosto = bloqueDeMedios(css, CORTE_DEL_MENU);

  assert.match(
    angosto,
    /\.nav\s*\{[^}]*position:\s*fixed/,
    'la barra lateral no sale del flujo en el corte: sacarla de la rejilla sin fijarla la deja ' +
      'apilada arriba del cuerpo, empujando la pantalla entera hacia abajo',
  );
  assert.match(
    angosto,
    /\.side\s*\{[^}]*display:\s*none/,
    'el panel derecho sigue en la rejilla angosta. Su `grid-area: side` ya no existe en la ' +
      'plantilla nueva, así que la rejilla le inventa una fila propia debajo del cuerpo',
  );

  /* Y el corte ANCHO, que es el mismo defecto un escalón arriba: en Executive —la única sin
     `.solo`— el panel derecho de 312 px dejaba el cuerpo en 234 px a 762 px de ventana. */
  assert.match(
    bloqueDeMedios(css, 1080),
    /\.side\s*\{[^}]*display:\s*none/,
    'el corte ancho dejó de esconder el panel derecho: Executive vuelve a quedar con el cuerpo ' +
      'aplastado entre las dos barras en cualquier portátil chico',
  );
});

test('el cajón se cierra AL NAVEGAR y con `Escape`, y las dos viven donde se navega', () => {
  /* ── LA MITAD QUE SE ROMPE SOLA ────────────────────────────────────────────
   *
   * Un cajón que se abre y no se cierra al elegir una pantalla deja el menú tapando justo lo que
   * se acaba de abrir. Y no falla: la navegación funciona, la vista cambia detrás del velo.
   *
   * El cierre va dentro de `irALaVista` y no en el oyente del clic porque esa función es el único
   * paso por el que pasan las DOS puertas: la fila del menú y el desplegable de la cuenta. Colgado
   * del clic, abrir Ajustes desde el desplegable dejaría el cajón puesto. */
  const shell = leer('lib/aios/shell.js');
  const limpio = shell.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

  const irALaVista = limpio.slice(limpio.indexOf('export function irALaVista'));
  const cuerpo = irALaVista.slice(0, irALaVista.indexOf('\n}'));
  assert.match(
    cuerpo,
    /cerrarElMenu\(\)/,
    '`irALaVista` dejó de cerrar el cajón del menú: en un teléfono, elegir una pantalla la abre ' +
      'detrás del menú que la tapa',
  );

  /* Y `Escape`, junto a los otros dos overlays. Los tres en el mismo sitio: una tecla que cierra
     dos de tres se siente peor que una que no cierra ninguno, porque enseña que funciona. */
  const teclado = limpio.slice(limpio.indexOf("addEventListener('keydown'"));
  const bloqueTeclado = teclado.slice(0, teclado.indexOf('});'));
  for (const cierre of ['cerrarElCajon', 'cerrarElModal', 'cerrarElMenu']) {
    assert.match(
      bloqueTeclado,
      new RegExp(String.raw`${cierre}\(\)`),
      `\`Escape\` dejó de llamar a \`${cierre}()\`: queda una cosa abierta encima que la tecla no cierra`,
    );
  }
});
