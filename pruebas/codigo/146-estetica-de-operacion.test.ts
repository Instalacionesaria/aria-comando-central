// La estética de operación alcanza a las DOS pantallas, y solo a las dos. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NECESITA UN GUARDIA, SI ES «SOLO CSS»
//
// `app/operacion-estetica.css` se llamaba `closer-estetica.css` y colgaba de `#v-closer`. Su propio
// encabezado decía que ese alcance era provisional: *«se empieza por el Closer para verlo en local
// antes de extenderlo… decidir hasta dónde extenderla»*. Se extendió al Setter, que es la otra
// pantalla de operación y **dibuja los mismos componentes**: `MiDia`, `Pipeline`, `Fila`, `Ficha`,
// `SeccionPlegable`, `Comision`, `Avanzar` y `EnlacesRapidos` son literalmente los mismos archivos.
//
// Lo que hace falta cuidar no es que el CSS «funcione» —una hoja de estilos no falla— sino las tres
// formas en que este alcance se deshace sin que nada avise:
//
// **1 · Una regla nueva se escribe con `#v-closer` a secas.** Es lo que uno teclea por costumbre, y
// el resultado es un componente compartido con dos aires según en qué pestaña se lo mire. No hay
// error, no hay consola, no hay prueba que falle: hay que abrir las dos pantallas y acordarse de
// comparar.
//
// **2 · El bloque de tokens se queda con una sola vista.** Lo cuida `145-fila-limpia`, y es el peor
// de los tres: la pantalla que queda afuera vuelve a la paleta VIEJA entera —otro lienzo, otro
// texto, otras señales— y sigue viéndose perfectamente bien, solo que distinta.
//
// **3 · El nombre vuelve a mentir.** Una hoja llamada «closer» que pinta `#v-setter` es media hora
// de alguien buscando por qué el Setter cambió al tocar «lo del Closer».
//
// ── Y LO QUE **NO** SE EXTIENDE, QUE TAMBIÉN SE AFIRMA ─────────────────────
//
// La Agenda es la cuarta sub-pestaña del Closer; la del Setter es Contactos. Sus reglas siguen
// colgadas de `#v-closer` solo. Extenderlas no rompería nada —una regla que no coincide no pinta—
// pero acotarlas dice de quién es cada cosa, y esta prueba lo mantiene dicho.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const leerCrudo = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

/**
 * El archivo sin comentarios.
 *
 * Obligatorio en este repositorio, y van doce veces: los comentarios de estos archivos CITAN el
 * nombre viejo y el alcance viejo al contar de dónde viene la hoja, así que una prueba que lea el
 * fuente crudo señala la explicación en vez del código. Me pasó escribiendo esta misma prueba.
 */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const leer = (r: string) => sinComentarios(leerCrudo(r));

const ESTETICA = 'app/operacion-estetica.css';
const ALCANCE = ':is(#v-closer, #v-setter)';

/** Las líneas de SELECTOR de la hoja: las que abren una regla, sin los comentarios. */
function selectores(): string[] {
  return sinComentarios(leerCrudo(ESTETICA))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('#v-'));
}

test('la hoja de operación alcanza a las dos pantallas, y no queda nada suelto', () => {
  const conAlcance = selectores();
  assert.ok(conAlcance.length > 100, `solo ${conAlcance.length} selectores: la hoja cambió de forma`);

  /* Toda línea de selector nombra las dos vistas, o es una de las dos excepciones declaradas. Se
     mide por LÍNEA y no por regla porque los selectores agrupados van uno por línea en esta hoja. */
  const sueltos = conAlcance.filter(
    (l) => !l.includes(ALCANCE) && !esDeLaAgenda(l) && !esDelCloserSolo(l),
  );
  assert.deepEqual(
    sueltos,
    [],
    'hay selectores que alcanzan a una sola pantalla. Si la regla es de un componente compartido, ' +
      `usá \`${ALCANCE}\`: con \`#v-closer\` a secas, el Setter dibuja el mismo componente con la ` +
      'forma vieja y no falla nada',
  );
});

/** La Agenda: `ag-*`, y las filas de la cola `agenda` de Mi Día. Es del Closer. */
function esDeLaAgenda(linea: string): boolean {
  return /#v-closer \.ag[- ]|#v-closer \.ag\b|data-cola='agenda'/.test(linea);
}

/** `QuienEsElCloser` y el selector «ver como». No tienen equivalente en el Setter. */
function esDelCloserSolo(linea: string): boolean {
  return /#v-closer \.ck-closer|#v-closer \.ck-vercomo/.test(linea);
}

test('lo que NO se comparte sigue acotado al Closer, y es solo lo que se decidió', () => {
  /* La otra dirección. Sin esto, «extender el alcance» se puede hacer con un reemplazo global que
     también se lleva la Agenda — y entonces la hoja deja de decir de quién es cada cosa. */
  const soloCloser = selectores().filter((l) => !l.includes(ALCANCE));
  assert.ok(soloCloser.length > 0, 'ya no queda nada acotado al Closer: se extendió también la Agenda');
  for (const l of soloCloser) {
    assert.ok(
      esDeLaAgenda(l) || esDelCloserSolo(l),
      `\`${l}\` quedó acotado al Closer y no es ni de la Agenda ni de «ver como». Si es de un ` +
        'componente compartido, tiene que alcanzar a las dos pantallas',
    );
  }
});

test('el nombre del archivo no nombra una sola pantalla', () => {
  /* El archivo se renombró con el alcance. Que la hoja exista con este nombre lo comprueban las
     lecturas de arriba; acá se comprueba que NADIE haya dejado el nombre viejo colgando — un
     `@import` a un archivo que no existe no rompe el build de Next, deja la pantalla sin estilos. */
  for (const ruta of [
    'app/globals.css',
    'pruebas/codigo/104-temas.test.ts',
    'pruebas/codigo/107-sin-sombras.test.ts',
  ]) {
    assert.ok(
      !leer(ruta).includes('closer-estetica.css'),
      `\`${ruta}\` sigue nombrando \`closer-estetica.css\`, que ya no existe. (Los comentarios sí ` +
        'pueden nombrarlo: cuentan de dónde viene la hoja, y esta comprobación los saca antes.)',
    );
  }
  assert.match(
    leer('app/globals.css'),
    /@import "\.\/operacion-estetica\.css" layer\(components\)/,
    'la hoja de la estética no se importa, o no entra en la capa `components` — y esa capa es lo ' +
      'que la hace ganarle a `aios.css` sin un solo `!important`',
  );
});

test('el hero de DOS anillos conserva su columna', () => {
  /* El único choque real de extender el alcance, y no se ve mirando el selector: la regla del hero
     fija `230px`, calibrada para el anillo único del Closer. El Setter apila DOS anillos de
     comisión y sus `260px` vienen de `aios.css` con especificidad de clase, así que la regla nueva
     —que lleva un `#id`— le ganaba y los dejaba apretados y centrados en vez de alineados arriba. */
  const hoja = sinComentarios(leerCrudo(ESTETICA));
  const i = hoja.indexOf(`${ALCANCE} .ck-hero.ck-hero-dos {`);
  assert.ok(i > 0, 'se fue la regla que le devuelve su columna al hero de dos anillos');
  const regla = hoja.slice(i, hoja.indexOf('}', i));
  assert.match(regla, /grid-template-columns:\s*minmax\(0, 1fr\) 260px/, 'la columna dejó de ser 260px');
  assert.match(regla, /align-items:\s*start/, 'los dos anillos volvieron a centrarse');

  /* Y va DESPUÉS de la regla del hero de uno: con la misma especificidad, gana la última. */
  assert.ok(
    hoja.indexOf(`${ALCANCE} .ck-hero {`) < i,
    'la regla del hero de dos anillos quedó ANTES que la general, así que no la pisa',
  );
});
