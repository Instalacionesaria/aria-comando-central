// La fila muestra el nombre, los iconos son del sprite, y el Closer no tiene acento propio.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// TRES PEDIDOS QUE LLEGARON JUNTOS, Y TRES FORMAS DE QUE VUELVAN SIN QUE NADIE LO NOTE
//
// **1 · La fila decía demasiado.** Al lado del nombre colgaban hasta tres chips y debajo una línea
// con lo último que dijo el contacto — y en el Buzón, ese mismo texto **otra vez** en cursiva. Se
// pidió *«que solo aparezca el nombre»*. Devolver un chip es un `<span>` de una línea que pasa
// cualquier revisión: se ve prolijo y nadie recuerda que se había sacado a propósito.
//
// **2 · Los seis iconos no eran iconos.** Eran glifos Unicode (`▢ ▤ ✆ ◈ ◷ $`) heredados del
// prototipo, metidos como texto. Ahora vienen del sprite, y el modo de falla es peor que un
// glifo feo: un `<use href="#i-f-…">` que apunta a un id que no existe **no falla** — dibuja un
// hueco del tamaño correcto, y la fila se ve como si ese contacto no tuviera nada medido.
//
// **3 · El Closer tenía su propio acento.** Un violeta que redefinía seis tokens dentro de
// `#v-closer` y pintaba mucho más que las sub-pestañas. Se unificó con el verde de la plataforma.
// Volver a declarar `--accent` ahí **en un solo tema** es el defecto más caro de los tres: se ve
// bien en el tema en el que se prueba y mal en el otro, y nadie mira los dos.
//
// ── LO QUE NO SE PERDIÓ, Y POR QUÉ ESTE ARCHIVO NO LO CUIDA ────────────────
//
// La fuente sigue en la ficha (pestaña Perfil, grupo «Origen») y la píldora en su encabezado; eso
// lo cuidan `pruebas/base/95-closer-ficha` y `pruebas/codigo/95-ficha`. «Estancado» sigue en el
// borde ámbar de la fila y el congelado en su atenuación. Acá se cuida que no VUELVAN a la lista.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const leerCrudo = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

/**
 * El archivo sin sus comentarios.
 *
 * Obligatorio en este repositorio, y van once veces: los comentarios de estos archivos **citan** lo
 * que se quitó —los glifos viejos, el `+{v}`, la palabra «violeta»— así que una prueba que lea el
 * fuente crudo encuentra la cita y falla sobre código correcto. Pasó hace dos días en
 * `101-alcance`, del otro lado: ahí el comentario satisfacía la prohibición en vez de romperla.
 */
const sinComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const leer = (r: string) => sinComentarios(leerCrudo(r));

const FILA = 'components/negocio/Fila.jsx';
const MIDIA = 'components/closer/MiDia.jsx';
const SPRITE = 'components/IconSprite.jsx';
const ESTETICA = 'app/operacion-estetica.css';
const TEMAS = 'app/temas.css';

/** El cuerpo de `SeisIconos`, que es donde viven el dibujo y el contador. */
function bloqueDeLosIconos(): string {
  const fila = leer(FILA);
  const desde = fila.indexOf('export function SeisIconos');
  const hasta = fila.indexOf('export default function Fila');
  assert.ok(desde > 0 && hasta > desde, 'no se encontró `SeisIconos`: esta prueba ya no lo mide');
  return fila.slice(desde, hasta);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA FILA MUESTRA EL NOMBRE
// ═══════════════════════════════════════════════════════════════════════════════

test('la fila no dibuja chips ni el texto del último mensaje', () => {
  const fila = leer(FILA);

  /* `tagx` es la clase de TODOS los chips —la fuente, la situación, «fuera de zona»— así que una
     sola afirmación cubre los tres y también el que alguien invente mañana. */
  assert.doesNotMatch(
    fila,
    /tagx/,
    'volvió un chip a la fila. Se pidió el nombre y nada más: la fuente está en la ficha → Perfil ' +
      '→ Origen, y la situación en el encabezado de la ficha',
  );
  assert.doesNotMatch(
    fila,
    /md-sub/,
    'volvió el microtexto debajo del nombre. Era «respondió hace 2 d: “…”», y se pidió sacarlo',
  );
  assert.doesNotMatch(
    fila,
    /ultimoEntranteTexto/,
    'la fila volvió a leer el texto del último mensaje: es el dato que se pidió no mostrar',
  );

  // Y la guarda de que la prueba mide algo: la fila sigue dibujando el nombre.
  assert.match(fila, /md-nm/, 'la fila dejó de dibujar el bloque del nombre');
  assert.match(fila, /fila\.nombre/, 'la fila dejó de dibujar el nombre');
});

test('Mi Día no repite el mensaje debajo de la fila, ni marca las citas con chips', () => {
  const midia = leer(MIDIA);

  /* El bloque en cursiva del Buzón era el peor de los dos textos: **duplicaba** el microtexto de la
     fila, así que el mismo mensaje se leía dos veces en la misma pantalla. */
  assert.doesNotMatch(midia, /md-quote/, 'volvió el bloque en cursiva con lo que dijo el contacto');
  assert.doesNotMatch(
    midia,
    /\bitem\.fragmento\b/,
    'Mi Día volvió a leer `fragmento`, que se quitó de `lib/negocio/colas.ts` justo por esto',
  );

  /* Y los chips de la cola Agenda —«Vencida» y el estado crudo de la cita—. La marca de vencida no
     se perdió: la hora se pinta con `--crit`, y eso sí se exige abajo para que quitar el chip no
     haya sido quitar la señal. */
  assert.doesNotMatch(midia, /tagx venc/, 'volvió el chip «Vencida» a la cola de la Agenda');
  assert.match(
    midia,
    /vencida \? \{ color: 'var\(--crit\)' \}/,
    'la hora de una cita vencida dejó de pintarse: el chip se quitó porque esto lo decía, y sin ' +
      'los dos la lista no distingue una cita que ya pasó',
  );
});

test('el campo `fragmento` no volvió al servidor', () => {
  /* Se calculaba en `colas.ts` y lo leía solo el bloque en cursiva. Un campo que el servidor
     computa y nadie lee es el que alguien encuentra en seis meses y cree vigente. */
  assert.doesNotMatch(
    sinComentarios(leerCrudo('lib/negocio/colas.ts')),
    /fragmento/,
    'volvió `fragmento` a las colas y no lo dibuja nadie',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS SEIS ICONOS VIENEN DEL SPRITE
// ═══════════════════════════════════════════════════════════════════════════════

test('los seis iconos apuntan al sprite, y los seis símbolos existen', () => {
  /* ══════════════════════════════════════════════════════════════════════════
   * LA AFIRMACIÓN QUE NO SE PUEDE COMPROBAR MIRANDO
   *
   * Un `<use href="#i-f-cita">` con el id mal escrito **no falla**: no hay error de consola, no
   * hay excepción, no hay nada en rojo. El navegador dibuja un `<svg>` vacío del tamaño correcto,
   * y la fila se ve exactamente como la de un contacto sin ese dato medido.
   *
   * O sea que el modo de falla de este cambio es indistinguible del estado normal de la pantalla.
   * Por eso los ids se cruzan contra el sprite acá y no se confía en la revisión.
   * ══════════════════════════════════════════════════════════════════════════ */
  const fila = leer(FILA);
  const bloque = fila.slice(fila.indexOf('const ICONOS = ['), fila.indexOf('];', fila.indexOf('const ICONOS = [')));
  const ids = [...bloque.matchAll(/icono: '([^']+)'/g)].map((m) => m[1]!);

  assert.equal(ids.length, 6, `los seis iconos tienen que declarar su símbolo; se hallaron ${ids.length}`);

  const sprite = leerCrudo(SPRITE);
  const declarados = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]!));
  for (const id of ids) {
    assert.match(id, /^#i-/, `\`${id}\` no es una referencia al sprite`);
    assert.ok(
      declarados.has(id.slice(1)),
      `\`${id}\` no existe en el sprite: el navegador va a dibujar un hueco y la fila se va a ver ` +
        'como si ese dato no estuviera medido',
    );
  }

  // Y no quedó ningún glifo del juego viejo.
  for (const glifo of ['▢', '▤', '✆', '◈', '◷']) {
    assert.ok(
      !bloqueDeLosIconos().includes(glifo),
      `volvió el glifo \`${glifo}\`: eran caracteres de texto, no dibujos, y cada tipografía los ` +
        'resuelve distinto',
    );
  }
});

test('el sprite no tiene dos símbolos con el mismo id', () => {
  /* Nada lo cuidaba, y el fallo es silencioso: con dos `<symbol>` del mismo id gana el primero, así
     que el segundo icono dibuja el primero — dos filas distintas diciendo lo mismo. Se vuelve
     posible ahora que el sprite dejó de ser solo el menú y tiene veinte símbolos. */
  const ids = [...leerCrudo(SPRITE).matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(ids.length >= 20, `el sprite tiene ${ids.length} símbolos: esta prueba ya no mide lo que dice`);
  assert.deepEqual(
    ids.filter((id, i) => ids.indexOf(id) !== i),
    [],
    'hay ids repetidos en el sprite: gana el primero y el segundo dibuja el equivocado, sin fallar',
  );
});

test('el contador va sin `+`, y el uno se dibuja', () => {
  const bloque = bloqueDeLosIconos();

  /* Se pidió *«no debe salir +1, simplemente el icono y al costado el 1»*. Y el `+` no era solo
     feo: obligaba a esconder el uno, porque «+1» se lee «uno más» y era falso. */
  assert.doesNotMatch(bloque, /\+\{v\}/, 'volvió el `+` delante del número');
  assert.match(bloque, /v > 0/, 'el contador volvió a esconder el uno');
  assert.doesNotMatch(bloque, /v > 1/, 'el contador volvió a exigir más de uno para dibujarse');
});

test('el estado del icono va por CLASE, no en un `style`', () => {
  /* Es lo que permitió retirar el secuestro `--txt: var(--icono)` de la hoja: una hoja no puede
     pisar un estilo en línea, así que mientras el color viniera de acá, el CSS tenía que redefinir
     el token que el componente leía — y `--txt` pasaba a significar dos cosas según dónde se mire.
     El único `style` que sobrevive es el color del agente, que son tres colores por estado. */
  const bloque = bloqueDeLosIconos();
  for (const clase of ['sin-medir', 'apagado', 'on']) {
    assert.ok(bloque.includes(`'${clase}'`), `el icono dejó de marcar el estado \`${clase}\` con una clase`);
  }
  assert.doesNotMatch(bloque, /opacity:/, 'volvió la opacidad a un estilo en línea');

  /* Y el CSS también SIN comentarios: la regla nueva explica el secuestro que se retiró, y lo cita
     textualmente. Leyendo el crudo, esta prueba falla sobre la explicación de su propio arreglo —
     que es exactamente el modo de falla que el encabezado de este archivo dice evitar, y en el que
     caí escribiéndolo. */
  const css = leer(ESTETICA);
  assert.doesNotMatch(
    css,
    /--txt:\s*var\(--icono\)/,
    'volvió el secuestro de `--txt` en `.md-acts`: existía solo para ganarle a un estilo en línea, ' +
      'y con las clases ya no hace falta',
  );
  assert.match(
    css,
    /\.md-acts i\.on\s*\{[^}]*var\(--accent\)/,
    'el icono encendido dejó de usar el acento: era gris sobre gris y no se leía como encendido',
  );
  assert.match(css, /\.md-acts svg\s*\{[^}]*width:/, 'los iconos no tienen tamaño: un `<svg>` no lee `font-size`');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · UN SOLO ACENTO
// ═══════════════════════════════════════════════════════════════════════════════

test('las pantallas de operación NO redefinen el acento: usan el de la plataforma', () => {
  /* ══════════════════════════════════════════════════════════════════════════
   * Y SE COMPRUEBA EN LOS DOS TEMAS, QUE ES DONDE ESTÁ EL DEFECTO CARO
   *
   * Los bloques `#v-closer` de `temas.css` son dos, uno por tema. Devolver el violeta en **uno
   * solo** compila, no rompe `104-temas` —esa prueba lee el PRIMER bloque de cada tema, no
   * éstos— y se ve perfecto en el tema en el que uno prueba. El otro queda con dos acentos.
   *
   * Nadie mira los dos temas en cada cambio. Esta prueba sí.
   * ══════════════════════════════════════════════════════════════════════════ */
  const temas = leerCrudo(TEMAS);

  for (const tema of ['oscuro', 'claro']) {
    /* El bloque se busca por el TEMA y por el arranque del `:is()`, no por el nombre de una vista:
       el selector pasó de `#v-closer` a `:is(#v-closer, #v-setter)` cuando la estética se extendió
       al Setter, y con la cadena literal esta prueba se caía por el cambio de alcance en vez de por
       lo que mide. Que el bloque cubra las DOS pantallas se afirma aparte, abajo. */
    const desde = temas.indexOf(`:root[data-tema='${tema}'] :is(`);
    assert.ok(desde > 0, `no se encontró el bloque de operación del tema ${tema}`);
    const bloque = sinComentarios(temas.slice(desde, temas.indexOf('\n}', desde)));

    /* Y alcanza a las dos. Sin esto, sacar una vista del selector la devuelve a la paleta vieja
       —tokens de otro lienzo, otro texto, otras señales— y no falla nada: se ve. */
    const selector = bloque.slice(0, bloque.indexOf('{'));
    for (const vista of ['#v-closer', '#v-setter']) {
      assert.ok(
        selector.includes(vista),
        `el bloque de tokens del tema ${tema} no alcanza a ${vista}: las dos pantallas de ` +
          'operación comparten la estética, y con una afuera se queda con la paleta vieja',
      );
    }

    for (const token of ['--accent', '--accent-hondo', '--accent-alto', '--accent-dim', '--c-acento', '--sobre-acento']) {
      assert.ok(
        !new RegExp(`^\\s*${token}\\s*:`, 'm').test(bloque),
        `el tema ${tema} vuelve a declarar \`${token}\` dentro de \`#v-closer\`. El Closer usa el ` +
          'acento de la plataforma — el mismo verde del logo y del menú lateral',
      );
    }

    /* Lo que SÍ tiene que seguir: el canal del compañero de contraste. El acento global no lo
       declara y `#v-closer .cl-sub button.on .cnt` lo referencia, así que borrarlo deja una `var()`
       huérfana — que es lo que cuenta `121-tokens-de-css`. */
    assert.match(
      bloque,
      /--c-sobre-acento\s*:/,
      `el tema ${tema} perdió \`--c-sobre-acento\`, que el contador de las sub-pestañas referencia`,
    );
  }
});

/* ── LA PRUEBA QUE NO SE ESCRIBIÓ, Y POR QUÉ ────────────────────────────────
 *
 * Acá había una que barría `operacion-estetica.css` y `temas.css` buscando la palabra «violeta», para
 * que ningún comentario siguiera describiendo como violeta un color que ahora es verde. Se escribió,
 * falló, y lo que encontró la condena: `no_show` **es** violeta —`#a396f8`, la etapa «no se
 * presentó»— y dos notas de contraste comparan el verde con el violeta de esa etapa. Las tres son
 * correctas y no tienen nada que ver con el acento del Closer.
 *
 * Una búsqueda de texto no puede distinguir «este comentario describe el acento» de «este comentario
 * habla de la etapa que sí es violeta». Y una prueba que falla sobre código correcto se termina
 * borrando o llenando de excepciones hasta que no mide nada.
 *
 * Los nueve comentarios que quedaron falsos se corrigieron a mano. Lo que sí es mecánico —que el
 * Closer no vuelva a declarar su propio acento— lo cuida la prueba de arriba, en los dos temas.
 */
