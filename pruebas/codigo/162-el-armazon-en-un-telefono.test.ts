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

/** Cuántas pistas tiene un valor de rejilla. Los `minmax(…)` y `repeat(…)` cuentan como una. */
const pistas = (valor: string): number =>
  valor.replace(/(minmax|repeat|fit-content)\([^)]*\)/g, 'X').trim().split(/\s+/).length;

/** Las reglas de una hoja ya sin medios: selector y cuerpo. */
const reglas = (css: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!, cuerpo: m[2]! }));

/** Las hojas de la capa `components`, como las importa `app/globals.css`: todas ganan sobre `aios.css`. */
function hojasDeComponentes(): string[] {
  const globales = leer('app/globals.css');
  const hojas = [...globales.matchAll(/@import\s+"\.\/([\w./-]+\.css)"\s+layer\(components\)/g)].map((m) => `app/${m[1]}`);
  assert.ok(hojas.includes('app/armazon.css') && hojas.includes('app/temas.css'), 'no se pudieron leer las hojas de la capa `components`');
  return hojas;
}

/** La hoja sin comentarios y sin ninguna consulta de medios: las reglas que valen en todo ancho. */
function sinMedios(css: string): string {
  let limpio = sinComentarios(css);
  for (;;) {
    const i = limpio.search(/@media[^{]*\{/);
    if (i === -1) return limpio;
    let nivel = 0;
    let j = limpio.indexOf('{', i);
    for (; j < limpio.length; j += 1) {
      if (limpio[j] === '{') nivel += 1;
      else if (limpio[j] === '}' && --nivel === 0) break;
    }
    limpio = limpio.slice(0, i) + limpio.slice(j + 1);
  }
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

test('la rejilla del armazón: la barra de 260 px y el cuerpo, y nadie pone `.solo`', () => {
  /* La del prototipo (`aios.css`) tiene tres filas y tres columnas: el panel lateral y la barra «Pregúntale
     a Executive sobre …» de la maqueta del Executive, que se fueron el 2026-10-01 (`NE-30`). La regla base de
     `armazon.css` la pisa por capa, y tiene que pisar las TRES propiedades: sin las filas queda una
     franja vacía de 64 px abajo en todas las pantallas, y sin las columnas, una de 312 px a la derecha.
     No falla nada: se ve.

     Desde la etapa E10, en la computadora la barra lateral va de arriba abajo, como en el lienzo:
     `260px` y el cuerpo. Desde la E11, a la derecha de la barra hay dos filas: la cabecera del
     departamento, `auto` —sin departamento no se dibuja y mide 0—, y el cuerpo; la barra ocupa las
     dos. Desde la segunda edición, una tercera, `auto`, debajo del cuerpo: la caja «Pregúntale al
     cerebro sobre …» (`NE-50`), que también mide 0 sin departamento y no existe en el teléfono. No es
     la barra de la maqueta que volvió: es otra área, con otro nombre, y la de abajo de este archivo
     sigue prohibiendo `ask` y `side`. La barra de arriba sólo existe en el teléfono, donde lleva el
     conmutador del cajón, y la rejilla del corte le devuelve su fila. */
  const css = leer('app/armazon.css');
  const base = sinMedios(css).match(/(?:^|\})\s*\.app\s*\{([^}]*)\}/);
  assert.ok(base, '`app/armazon.css` no tiene una regla `.app` fuera de las consultas de medios');
  const decl = (prop: string) => new RegExp(`${prop}:\\s*([^;]+);`).exec(base[1]!)?.[1]?.replace(/\s+/g, ' ').trim();
  const filas = decl('grid-template-rows');
  assert.ok(filas, 'la rejilla base no redefine las filas: queda la tercera, de 64 px, vacía abajo');
  assert.equal(filas, 'auto minmax(0, 1fr) auto', `la rejilla base tiene filas \`${filas}\`: son la cabecera, el cuerpo y la caja del cerebro`);
  const columnas = decl('grid-template-columns');
  assert.ok(columnas, 'la rejilla base no redefine las columnas: queda la tercera, de 312 px, vacía a la derecha');
  assert.match(columnas, /^260px minmax\(0, 1fr\)$/, `la rejilla base tiene columnas \`${columnas}\``);
  assert.equal(decl('grid-template-areas'), '"nav cabecera" "nav main" "nav consulta"', 'las áreas de la rejilla base no son la barra, la cabecera, el cuerpo y la caja del cerebro');
  // La barra de arriba, escondida en la computadora y de vuelta en el corte.
  const topbar = sinMedios(css).match(/(?:^|\})\s*\.topbar\s*\{([^}]*)\}/);
  assert.ok(topbar && /(^|[\s;])display:\s*none\s*;/.test(topbar[1]!), 'la barra de arriba se ve en la computadora: ocupa una fila que la rejilla no tiene');
  assert.match(bloqueDeMedios(css, CORTE_DEL_MENU), /\.topbar\s*\{[^}]*display:\s*flex\s*;/, 'en el teléfono no vuelve la barra de arriba: el cajón queda sin conmutador');

  // El corte: una columna, sin el área de la barra lateral, con la barra de arriba y la cabecera.
  const angosto = bloqueDeMedios(css, CORTE_DEL_MENU).match(/([^{}]*)\{([^}]*grid-template-areas[^}]*)\}/);
  assert.ok(angosto, `la consulta de ${CORTE_DEL_MENU}px no redefine la rejilla`);
  assert.match(angosto[1]!, /\.app\b/, 'la rejilla del corte no nombra `.app`');
  assert.equal(/grid-template-areas:\s*([^;]+);/.exec(angosto[2]!)?.[1]?.replace(/\s+/g, ' ').trim(), '"top" "cabecera" "main"');
  assert.equal(/grid-template-rows:\s*([^;]+);/.exec(angosto[2]!)?.[1]?.replace(/\s+/g, ' ').trim(), '50px auto minmax(0, 1fr)', 'las filas del corte no son la barra de arriba, la cabecera y el cuerpo');

  /* Y ninguna OTRA regla de `.app` en las hojas de la capa `components` —la de `armazon.css` y las que
     entran después, como `temas.css`— devuelve una pista de más: ganaría por orden sobre la base, y
     mirar sólo la primera regla la dejaba pasar. En la computadora son la cabecera (`auto`), el cuerpo
     y la caja del cerebro (`auto`), y nunca el área de la barra de arriba: una fila fija de más es una
     franja vacía arriba de todo. Tampoco la forma abreviada, que no se cuenta. Ni una regla que vuelva a mostrar la barra de
     arriba. */
  for (const hoja of hojasDeComponentes()) {
    for (const { selector, cuerpo } of reglas(sinMedios(leer(hoja)))) {
      const selectores = selector.split(',').map((s) => s.trim());
      if (selectores.some((s) => /\.topbar$/.test(s))) {
        const display = /(^|[\s;])display:\s*([^;]+);/.exec(cuerpo)?.[2]?.trim();
        if (display) assert.equal(display, 'none', `\`${hoja}\` muestra la barra de arriba en la computadora (\`${selector.trim()}\`)`);
      }
      if (!selectores.some((s) => /\.app$/.test(s))) continue;
      assert.doesNotMatch(cuerpo, /(^|[\s;])grid(-template)?\s*:/, `\`${hoja}\` define la rejilla de \`${selector.trim()}\` con la forma abreviada`);
      const filas = /grid-template-rows:\s*([^;]+);/.exec(cuerpo)?.[1];
      if (filas) assert.equal(filas.replace(/\s+/g, ' ').trim(), 'auto minmax(0, 1fr) auto', `\`${hoja}\` le da a \`${selector.trim()}\` las filas \`${filas.trim()}\`: en la computadora son la cabecera, el cuerpo y la caja del cerebro`);
      const columnas = /grid-template-columns:\s*([^;]+);/.exec(cuerpo)?.[1];
      if (columnas) assert.ok(pistas(columnas) <= 2, `\`${hoja}\` le da a \`${selector.trim()}\` las columnas \`${columnas.trim()}\`: vuelve una tercera`);
      const areas = /grid-template-areas:\s*([^;]+);/.exec(cuerpo)?.[1];
      if (areas) assert.doesNotMatch(areas, /\btop\b/, `\`${hoja}\` le da a \`${selector.trim()}\` el área de la barra de arriba en la computadora`);
    }
  }

  /* Y `.solo` no vuelve: la ponía `shell.js` para esconder el panel lateral en las pantallas que no
     eran Executive, y sin panel es una clase sin propósito que una regla de `aios.css` todavía lee. */
  assert.doesNotMatch(sinComentarios(css), /\.solo\b/, '`app/armazon.css` vuelve a nombrar `.solo`');
  assert.doesNotMatch(
    leer('lib/aios/shell.js').replace(/\/\*[\s\S]*?\*\//g, ' '),
    /classList\.(toggle|add)\(\s*'solo'/,
    '`shell.js` vuelve a poner `.solo`',
  );
});

test('la barra sale del flujo hasta el borde de abajo, y no queda panel ni barra de preguntas', () => {
  const css = leer('app/armazon.css');
  const angosto = bloqueDeMedios(css, CORTE_DEL_MENU);

  const nav = angosto.match(/\.nav\s*\{([^}]*)\}/);
  assert.ok(nav && /position:\s*fixed/.test(nav[1]!),
    'la barra lateral no sale del flujo en el corte: sacarla de la rejilla sin fijarla la deja ' +
      'apilada arriba del cuerpo, empujando la pantalla entera hacia abajo');
  /* `bottom: 0` y no los 64 px de antes, que eran el hueco de la barra de preguntas: sin ella, el
     cajón terminaría 64 px antes del borde y debajo se vería el velo. */
  assert.match(nav[1]!, /bottom:\s*0\s*;/, 'el cajón del menú no llega al borde de abajo');
  /* Cerrado, el cajón se esconde además de correrse: con `transform` solo, sus filas —botones desde
     la etapa E9— eran paradas del tabulador fuera de la pantalla. Se esconde al TERMINAR de cerrarse,
     y al abrir se muestra al instante: si no, `shell.js` enfocaría un botón de la barra todavía oculto. */
  assert.match(nav[1]!, /visibility:\s*hidden\s*;/, 'el cajón cerrado sigue en el orden del tabulador');
  assert.match(nav[1]!, /transition:[^;]*visibility 0s linear \.22s/, 'el cajón se esconde antes de terminar de cerrarse');
  const abierto = angosto.match(/\.app\.menu-abierto \.nav\s*\{([^}]*)\}/);
  assert.ok(abierto && /visibility:\s*visible\s*;/.test(abierto[1]!), 'el cajón abierto no vuelve a ser visible');
  assert.doesNotMatch(abierto[1]!, /visibility\s+[\d.]+s/, 'el cajón abierto se muestra con retraso: el foco caería en un elemento oculto');

  /* El velo empieza donde empieza el cajón, DEBAJO de la barra de arriba: tapada, el botón que cierra
     el cajón quedaba oscurecido y desenfocado. */
  const alto = /top:\s*(\d+px)\s*;/.exec(nav[1]!)?.[1];
  assert.ok(alto, 'el cajón no dice dónde empieza');
  const velo = angosto.match(/\.app\.menu-abierto::after\s*\{([^}]*)\}/);
  assert.ok(velo, 'no se encontró el velo del cajón');
  assert.ok(
    new RegExp(`inset:\\s*${alto} 0 0 0\\s*;|top:\\s*${alto}\\s*;`).test(velo[1]!),
    'el velo del cajón tapa la barra de arriba, con el botón que lo cierra',
  );

  // Ninguna regla del panel lateral ni de la barra de preguntas: se fueron con la maqueta.
  assert.doesNotMatch(sinComentarios(css), /\.side\b|\.ask\b|\.ask-trigger|\.at-[tk]\b/, '`app/armazon.css` vuelve a tener reglas del panel lateral o de la barra de preguntas');
  for (const m of sinComentarios(css).matchAll(/grid-template-areas:\s*([^;]+);/g)) {
    assert.doesNotMatch(m[1]!, /\b(side|ask)\b/, `un área de la rejilla vuelve a nombrar el panel o la barra: ${m[1]}`);
  }
});

test('las rejillas del corte llevan `minmax(0, …)`, o el contenido ancho las estira', () => {
  /* ── LA TRAMPA DE CSS QUE COSTÓ DOS MEDICIONES ─────────────────────────────
   *
   * `1fr` es `minmax(auto, 1fr)`, y con `auto` de mínimo un hijo ancho **estira la columna** en vez
   * de encogerse dentro de ella. Medido con `1fr` a secas: en Panel de Monitoreo —una tabla de doce
   * columnas y 1.209 px— la rejilla del armazón se abría a 417 px sobre una ventana de 375, y la
   * barra superior, el cuerpo y la barra de preguntas se iban los tres con ella.
   *
   * Lo que lo vuelve traicionero es que esa tabla **ya tenía** su `overflow-x: auto`: el defecto no
   * estaba donde se veía. Y no lo ve ninguna prueba de las otras, porque la aplicación sigue
   * funcionando — sólo hay que arrastrarla de costado para leerla. */
  const css = leer('app/armazon.css');
  /* La rejilla base y la del corte. Había otra, la de 1080 px, que existía sólo para esconder el
     panel lateral de la maqueta: se fue con él. */
  for (const [ancho, bloque] of [['todo ancho', sinMedios(css)], [CORTE_DEL_MENU, bloqueDeMedios(css, CORTE_DEL_MENU)]] as const) {
    for (const m of bloque.matchAll(/grid-template-columns:\s*([^;]+);/g)) {
      const valor = m[1]!.trim();
      /* Se quitan los `minmax(…)` ANTES de buscar: dentro de uno, el `1fr` es el máximo y está
         perfecto — el que importa es el mínimo. Buscar `1fr` a secas marcaba `minmax(0, 1fr)` como
         defecto, que es exactamente la forma correcta. */
      const pelado = valor.replace(/minmax\([^)]*\)/g, 'X');
      assert.doesNotMatch(
        pelado,
        /(^|\s)1fr/,
        `la rejilla \`${valor}\` (${ancho}) usa \`1fr\` pelado. Es \`minmax(auto, 1fr)\`: ` +
          'un hijo ancho —una tabla, un nombre largo— estira la columna y se lleva la pantalla entera ' +
          'con ella. Va `minmax(0, 1fr)`',
      );
    }
  }
});

test('la tira de pestañas se ata al padre Y se desliza: las dos mitades', () => {
  /* Se midió dos veces porque la primera corrección no alcanzó. `.cl-sub` es hijo de un flex en
     COLUMNA, así que su ancho lo fija su CONTENIDO y no su padre: medido, 350 px dentro de un padre
     de 291. Con sólo `overflow-x: auto`, la caja seguía sobresaliendo y lo que se deslizaba era la
     vista entera — o sea que había que arrastrar la pantalla para llegar a la última pestaña.
     *
     Las dos declaraciones van juntas o no sirve ninguna: el ancho la mete en el padre y el
     desbordamiento le devuelve el gesto. Afecta a Closer, Setter y Conversation. */
  const bloque = bloqueDeMedios(leer('app/armazon.css'), CORTE_DEL_MENU);
  const regla = bloque.match(/\.cl-sub\s*\{([^}]*)\}/);
  assert.ok(regla, '`.cl-sub` perdió su regla en el corte: la tira de pestañas vuelve a arrastrar la vista');
  /* `(^|[\s;])` y no `width:` a secas: sin el borde, la aserción la satisface el `max-width: 100%`
     de la línea de al lado, y quitar el `width` real no la mataba. Lo detectó la mutación. */
  assert.match(
    regla[1]!,
    /(^|[\s;])width:\s*100%/,
    '`.cl-sub` no se ata al ancho del padre: su caja sobresale igual. `max-width` no alcanza — es ' +
      'hijo de un flex en columna, así que sin `width` su ancho lo fija el contenido',
  );
  assert.match(regla[1]!, /overflow-x:\s*auto/, '`.cl-sub` no se desliza: la última pestaña queda sin alcanzar');
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

  /* Y `Escape`. Compartía oyente con los overlays de la maqueta, que se fueron el 2026-10-01: borrar
     aquel oyente entero, como sobraba, dejaba el cajón sin tecla en silencio. */
  const i = limpio.indexOf("addEventListener('keydown'");
  assert.ok(i >= 0, 'el armazón ya no escucha el teclado: `Escape` no cierra el cajón del menú');
  const teclado = limpio.slice(i);
  const bloqueTeclado = teclado.slice(0, teclado.indexOf('});'));
  assert.match(bloqueTeclado, /cerrarElMenu\(\)/, '`Escape` dejó de cerrar el cajón del menú');
  assert.doesNotMatch(bloqueTeclado, /cerrarEl(Cajon|Modal)\(\)/, '`Escape` vuelve a llamar a los cierres de los overlays de la maqueta');
});
