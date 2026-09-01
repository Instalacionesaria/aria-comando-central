// El botón `+` del compositor y su menú de links de cobro. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PERSIGUE: UN CONTROL QUE OFRECE MANDAR ALGO QUE NO SE PUEDE MANDAR
//
// El compositor se apaga fuera de la ventana de 24 horas —el canal no acepta texto libre— y lo dice
// con el motivo a la vista. Un `+` que quede encendido al lado de una caja apagada es una trampa:
// se ve elegible, se elige, y el mensaje vuelve rechazado por un motivo que ya estaba escrito arriba.
//
// La otra mitad es el borrador. Se pidió que el link **se escriba en la caja** y no que salga solo,
// y el motivo es que son diez opciones casi idénticas —los montos se repiten entre Stripe y WHOP— y
// un mensaje que salió a un lead no se recoge. Si el clic PISARA lo escrito, se perdería «Te dejo el
// de 4k» sin forma de recuperarlo, que es la misma clase de pérdida silenciosa.
//
// Nada de esto se puede comprobar renderizando: no hay navegador en esta suite. Se comprueba sobre
// la fuente, que es donde el defecto se introduce.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');

/** Sin comentarios: la lección de `110-monitoreo`, `120-mapa-ejecutivo` y `123-relojes`, ya pagada tres veces. */
const codigo = (r: string): string =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/{\/\*[\s\S]*?\*\/}/g, '');

const FICHA = 'components/negocio/Ficha.jsx';
const PANEL = 'components/closer/EnlacesDePago.jsx';

test('el `+` se apaga con la MISMA condición que la caja de texto', () => {
  /* No se compara contra `ventana.abierta` ni contra `enviando` por separado: el defecto que esto
     persigue es que alguien agregue una condición al compositor —una tercera causa de bloqueo— y se
     olvide de este botón. Con los dos leyendo `bloqueado`, eso es imposible por construcción, y lo
     que hay que vigilar es justamente que el botón siga leyendo esa variable y no una copia. */
  const ficha = codigo(FICHA);

  const boton = ficha.match(/<button[^>]*className="cw-mas"[\s\S]*?>/);
  assert.ok(boton, 'no está el botón `cw-mas` en el compositor');
  assert.match(
    boton[0],
    /disabled=\{bloqueado\}/,
    'el `+` no comparte el bloqueo del compositor: va a ofrecer mandar un link fuera de la ventana ' +
      'de 24 horas, cuando el canal ya no acepta texto libre',
  );

  // Y `bloqueado` sigue siendo la condición ÚNICA del compositor. Si alguien la parte en dos, esta
  // afirmación cae y hay que volver a decidir qué apaga el botón.
  assert.match(ficha, /const bloqueado = sinRespuesta \|\| cerrada \|\| enviando;/);
});

test('sin links cargados el `+` no se dibuja', () => {
  /* Un botón que abre un menú vacío es un control muerto para siempre en toda empresa que no cobre
     con links — y quien lo aprieta no puede hacer nada al respecto desde el chat: se cargan en
     Closer → Inicio, que es una pantalla de quien administra.

     Es lo contrario de lo que se hace con un DATO vacío (un día sin citas se dibuja igual, con su
     cero) y la diferencia es que esto no es un dato: es un atajo. */
  assert.match(
    codigo(FICHA),
    /\{enlaces\.length > 0 \? \(/,
    'el `+` se dibuja siempre: una empresa sin links de cobro tiene un botón que no hace nada',
  );
});

test('elegir un link AGREGA al borrador; no lo reemplaza', () => {
  /* El defecto concreto: escribir «Te dejo el de 4k», elegir el link, y que el texto desaparezca.
     No falla nada y no hay deshacer.

     Se afirma sobre la forma de la función y no sobre el resultado porque no hay navegador acá. Las
     dos mitades que importan: que el valor previo entre en el cálculo (`antes`), y que el caso de la
     caja vacía no deje un espacio delante del link. */
  const ficha = codigo(FICHA);
  const fn = ficha.match(/const elegirEnlace = useCallback\([\s\S]*?\, \[\]\);/);
  assert.ok(fn, 'no está `elegirEnlace`');

  assert.match(
    fn[0],
    /setBorrador\(\(antes\) =>/,
    'el borrador se escribe sin mirar lo que había: lo que estaba escrito se pierde',
  );
  assert.match(fn[0], /antes\.trim\(\) === ''/, 'no distingue la caja vacía: el link entraría con un espacio delante');
  assert.match(fn[0], /antes\.trimEnd\(\)\} \$\{url\}/, 'no se separa el link de lo escrito con un espacio');

  /* Y lo que se pega es la URL sola. El nombre y el monto son etiquetas nuestras para elegir bien;
     mandarlas sería mandarle al lead un texto que nadie escribió. */
  assert.match(
    ficha,
    /alElegirEnlace\(e\.url\)/,
    'el menú manda a la caja algo que no es la dirección sola',
  );
});

test('los links se leen UNA vez y no entran al reloj del chat', () => {
  /* `lib/reloj.ts` existe porque hubo ocho sondeos sueltos pegándole al servidor con la pestaña
     oculta, y el puntito de Tools acaba de costar 180 peticiones por hora y por persona conectada.

     Los links cambian cuando alguien edita la lista en Closer → Inicio, o sea casi nunca. Meterlos en
     el ciclo de cinco segundos del chat sería repetir el mismo error con el mismo disfraz: peticiones
     baratas, muchas veces, que nadie nota.

     Y el efecto no lleva `contactoId`: son de la EMPRESA, iguales en todas las fichas. Con esa
     dependencia se pediría una vez por apertura de ficha sin un dato nuevo. */
  const ficha = codigo(FICHA);

  const efecto = ficha.match(/useEffect\(\(\) => \{[^]*?enlaces-de-pago[^]*?\}, \[[^\]]*\]\);/);
  assert.ok(efecto, 'no está el efecto que lee los links');
  assert.match(efecto[0], /\}, \[\]\);$/, 'la lectura de los links depende de algo: se repite sin necesidad');

  // Y ninguna llamada al reloj los nombra.
  for (const m of ficha.matchAll(/usarReloj\([^;]*\);/g)) {
    assert.doesNotMatch(
      m[0],
      /enlace/i,
      'los links de cobro entraron a un reloj: son configuración, no un dato que cambie solo',
    );
  }
});

test('el CSS del menú NO está en `aios.css`', () => {
  /* `app/aios.css` es el port literal de `aios-command-center_1.html` y `scripts/paridad.mjs` lo
     compara contra él. Su propio encabezado —y el de `closer.css`— lo dicen: *«Arreglar ahí adentro
     rompe esa propiedad para siempre»*.

     Este botón no existe en el prototipo, así que su estilo va en la capa `components`, que le gana
     sin un solo `!important`. Escribirlo en `aios.css` no falla nada hoy: rompe en silencio la
     comparación que hace que un diff de esa hoja signifique algo. */
  const aios = leer('app/aios.css');
  for (const clase of ['cw-mas', 'cw-pago', 'cw-pagos']) {
    assert.equal(
      aios.includes(`.${clase}`),
      false,
      `\`.${clase}\` se escribió en \`aios.css\`, que es el port literal del prototipo`,
    );
  }
});

test('toda clase de esta función existe en alguna hoja de estilo', () => {
  /* ── LO QUE PERSIGUE ──────────────────────────────────────────────────────
   *
   * La auditoría de CSS de la semana pasada encontró SEIS tokens que no existían. Una hoja no falla
   * cuando nombra algo inexistente: simplemente no aplica nada, y eso se ve como un control a medio
   * hacer que nadie sabe si está roto.
   *
   * ── Y POR QUÉ SE COMPARAN CLASES ENTERAS ────────────────────────────────
   *
   * La primera versión preguntaba `jsx.includes('ck-enlace-u')`, y una mutación pasó por delante:
   * renombrar la clase del JSX a `ck-enlace-url` —dejándola sin ninguna regla— **no ponía esto
   * rojo**, porque el nombre viejo sigue siendo una subcadena del nuevo. Comparar nombres por
   * subcadena es exactamente cómo una clase huérfana pasa desapercibida.
   *
   * Ahora se leen los `className` y se parten en palabras. */
  const css = readdirSync(join(RAIZ, 'app'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => leer(`app/${f}`))
    .join('\n');

  /** Las clases que un componente ESCRIBE, como palabras sueltas. */
  function clasesDe(ruta: string): Set<string> {
    const fuente = codigo(ruta);
    const palabras = new Set<string>();
    // `className="a b c"` y `className={`a b${x ? ' d' : ''}`}`: de las dos sale lo mismo, porque
    // lo que se parte es el texto literal y las expresiones no dejan palabras enteras.
    for (const m of fuente.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      for (const p of (m[1] ?? m[2] ?? '').split(/[\s${}?:'"]+/)) {
        if (p) palabras.add(p);
      }
    }
    return palabras;
  }

  /* Solo las familias de esta función. Un barrido de TODAS las clases encontraría además
     `aj-tarjeta`, que ya estaba sin definir antes de esto y que arreglar acá cambiaría el aspecto de
     dos pantallas que nadie pidió tocar. */
  const mias = [...clasesDe(FICHA), ...clasesDe(PANEL)].filter(
    (c) => /^(cw-mas|cw-pago|ck-enlace|ck-alta-enlace|ck-alta-url)/.test(c),
  );

  assert.ok(mias.length >= 10, `se leyeron muy pocas clases (${mias.length}): el barrido no está mirando el JSX`);

  const sinEstilo = [...new Set(mias)].filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css)).sort();
  assert.deepEqual(
    sinEstilo,
    [],
    'hay clases que ninguna hoja define: se dibujan sin estilo, y nada falla',
  );

  /* Y al revés: una regla de CSS que ya nadie escribe es una regla muerta. Se compara con la misma
     frontera de palabra, que es lo que hace que renombrar una clase en el JSX se note en los dos
     sentidos. */
  const enCss = [
    ...css.matchAll(/\.((?:cw-mas|cw-pago|ck-enlace|ck-alta-enlace|ck-alta-url)[\w-]*)/g),
  ].map((m) => m[1]!);
  const escritas = new Set(mias);
  const muertas = [...new Set(enCss)].filter((c) => !escritas.has(c)).sort();
  assert.deepEqual(muertas, [], 'hay reglas de CSS que ningún componente usa ya');
});

test('`listarEnlaces` ordena en la CONSULTA, y no confía en el orden que devuelva la base', () => {
  /* ── UNA MUTACIÓN QUE SOBREVIVIÓ A LA PRUEBA DE COMPORTAMIENTO ───────────
   *
   * Sacar los dos `orderBy` del `select` y correr la prueba que compara el orden del menú: **pasó**.
   * PostgreSQL devolvió las filas en el orden en que se insertaron porque la tabla es chica y recién
   * escrita, y eso coincidía con lo que se esperaba.
   *
   * Ese orden no está garantizado por nada: cambia con un `update` de por medio, con la tabla más
   * grande, o con un plan distinto. El día que cambie, el menú sale en otro orden que la pantalla
   * que lo administra, y elegir mal un link de cobro es lo que este botón vino a evitar.
   *
   * Por eso se afirma sobre la CONSULTA. Es una prueba de forma y no de resultado, a propósito: el
   * resultado no puede distinguir «ordenado» de «casualmente en orden». */
  const lib = codigo('lib/negocio/enlacesDePago.ts');
  const fn = lib.match(/export async function listarEnlaces\([\s\S]*?\n\}/);
  assert.ok(fn, 'no está `listarEnlaces`');
  assert.match(fn[0], /\.orderBy\('orden'\)/, 'la lista no ordena por `orden`');
  assert.match(
    fn[0],
    /\.orderBy\('nombre'\)/,
    'falta el desempate: con dos filas del mismo `orden` la base puede devolverlas al revés entre ' +
      'dos aperturas del menú, y un menú que se reordena solo hace elegir mal',
  );
});
