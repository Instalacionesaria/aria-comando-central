// La estética de operación alcanza a las DOS pantallas, y solo a las dos. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NECESITA UN GUARDIA, SI ES «SOLO CSS»
//
// `app/operacion-estetica.css` se llamaba `closer-estetica.css` y colgaba de `#v-closer`. Su propio
// encabezado decía que ese alcance era provisional: *«se empieza por el Closer para verlo en local
// antes de extenderlo… decidir hasta dónde extenderla»*. Se extendió en dos pasos, y los dos casos
// fueron distintos:
//
//   · **el Setter** dibuja los MISMOS componentes —`MiDia`, `Pipeline`, `Fila`, `Ficha`,
//     `SeccionPlegable`, `Comision`, `Avanzar` y `EnlacesRapidos` son literalmente los mismos
//     archivos—, así que alcanzó con el cambio de selector;
//   · **Auditoría de agentes** no comparte ni uno: reimplementó los siete conceptos con su propia
//     familia `aud-*`, así que además hizo falta una sección que los refine (la 8) y tres clases de
//     chrome que le faltaban en el JSX.
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
import { readFileSync, readdirSync } from 'node:fs';
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
const ALCANCE = ':is(#v-closer, .estetica-op)';

/** Las líneas de SELECTOR de la hoja: las que abren una regla, sin los comentarios. */
function selectores(): string[] {
  return sinComentarios(leerCrudo(ESTETICA))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('#v-'));
}

test('todo selector de la hoja usa el alcance, y no queda nada suelto', () => {
  const conAlcance = selectores();
  assert.ok(conAlcance.length > 100, `solo ${conAlcance.length} selectores: la hoja cambió de forma`);

  /* Toda línea de selector nombra las dos vistas, o es una de las dos excepciones declaradas. Se
     mide por LÍNEA y no por regla porque los selectores agrupados van uno por línea en esta hoja. */
  const sueltos = conAlcance.filter(
    (l) =>
      !l.includes(ALCANCE) &&
      !esDeLaAgenda(l) &&
      !esDelCloserSolo(l) &&
      !esCompensacionDeUnaPantalla(l),
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

/** `QuienEsElCloser` y el selector «ver como». No tienen equivalente en las otras dos. */
function esDelCloserSolo(linea: string): boolean {
  return /#v-closer \.ck-closer|#v-closer \.ck-vercomo/.test(linea);
}

/**
 * Las compensaciones de UNA pantalla: las secciones 8 y 9.
 *
 * Es la tercera excepción, y por el motivo CONTRARIO a las otras dos. Aquellas son cosas del
 * Closer que las demás no tienen; ésta es al revés — o son piezas que sólo esa pantalla dibuja
 * (las siete familias `aud-*` de la sección 8), o son choques que sólo ahí ocurren (la sección 9:
 * el botón de borrar de Ajustes, la cápsula que ICP y Tools emiten fuera del encabezado).
 * Aplicarlas en todas sería declarar reglas para clases que en la mayoría no existen.
 *
 * ── Y POR QUÉ ES UNA LISTA Y NO `^#v-\w+ ` ────────────────────────────────
 *
 * Porque con el comodín esta prueba deja de tener filo. Su trabajo es cazar la regla escrita con
 * UNA pantalla cuando debería alcanzar a todas —el defecto de «lo probé en el Closer y lo dejé
 * ahí»— y un `^#v-` que acepta cualquier id no distingue eso de una compensación deliberada.
 *
 * Con la lista, sumar una pantalla cuesta venir acá y escribir su nombre. Es barato, y es
 * exactamente el momento en que conviene preguntarse si la regla es de verdad de esa sola.
 */
const CON_COMPENSACION_PROPIA = ['auditoria', 'credenciales', 'icp', 'tools'];

function esCompensacionDeUnaPantalla(linea: string): boolean {
  return CON_COMPENSACION_PROPIA.some((v) => linea.startsWith(`#v-${v} `));
}

test('lo que NO se comparte sigue acotado al Closer, y es solo lo que se decidió', () => {
  /* La otra dirección. Sin esto, «extender el alcance» se puede hacer con un reemplazo global que
     también se lleva la Agenda — y entonces la hoja deja de decir de quién es cada cosa. */
  const acotados = selectores().filter((l) => !l.includes(ALCANCE));
  assert.ok(acotados.length > 0, 'ya no queda nada acotado: se extendió también la Agenda');
  for (const l of acotados) {
    assert.ok(
      esDeLaAgenda(l) || esDelCloserSolo(l) || esCompensacionDeUnaPantalla(l),
      `\`${l}\` quedó acotado a una pantalla y no es de la Agenda, ni de «ver como», ni una de ` +
        'las compensaciones declaradas en `CON_COMPENSACION_PROPIA`. Si es de un componente ' +
        'compartido, tiene que alcanzar a todas; y si de verdad es de una sola, decilo en esa lista',
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

// ═══════════════════════════════════════════════════════════════════════════════
// AUDITORÍA: LOS TRES CHOQUES, Y EL CHROME QUE LE FALTABA
// ═══════════════════════════════════════════════════════════════════════════════

test('toda vista que se anota en la estética trae el chrome entero', () => {
  /* Auditoría llegó sin tres clases, y cada una tenía consecuencia:
       · `.stack` y `.ch-title` — la estética INVIERTE el encabezado (el `h2` pasa a rótulo chico y
         la descripción a titular de 24 px) y esas dos son las que lo apilan;
       · `.cl-page` — sin el envoltorio, el `gap: 24px` del scroller se aplicaba entre TODOS los
         bloques en vez de separar la cabecera del cuerpo una vez.
     Se agregaron en el JSX en vez de compensarlas con reglas: dos de los tres choques
     desaparecieron solos.

     La prueba miraba `AuditoriaView` por su nombre. Ahora recorre TODA vista que lleve
     `estetica-op`, porque anotarse a la estética pasó a ser una clase en el `<section>` — o sea
     que entrar es de una línea, y entrar a medias también. Sin esto, la pantalla número diez se
     suma al alcance, hereda la paleta y la tipografía, y se queda con el encabezado sin invertir:
     no falla nada, se ve distinta.

     Ojo: se lee el JSX **crudo** para encontrar las vistas, y **sin comentarios** para afirmar.
     Un `estetica-op` nombrado en un comentario no anota a nadie, pero tampoco tiene que hacer
     fallar a nadie. */
  const vistas = readdirSync(join(RAIZ, 'components/views'))
    .filter((f) => f.endsWith('.jsx'))
    .filter((f) => leer(`components/views/${f}`).includes('estetica-op'));

  /* El conteo es EXACTO, y es un trinquete —el mismo que `90-fundaciones` le pone a la lista de
     paridad—. Con un piso (`>= 3`), quitarle la clase a una pantalla cuando haya doce pasaría en
     verde, y el síntoma de eso es una pestaña que vuelve sola a la estética vieja. Con el número
     exacto, sumar o sacar una obliga a venir acá y decirlo. */
  assert.equal(
    vistas.length,
    7,
    `hay ${vistas.length} vistas con \`estetica-op\` y la cuenta dice 3: si entró una pantalla ` +
      'nueva, subí el número; si salió, decí por qué. No se toca para que la prueba pase',
  );

  for (const archivo of vistas) {
    const vista = leer(`components/views/${archivo}`);
    for (const clase of ['ch-l stack', 'ch-title', 'cl-page']) {
      assert.ok(
        vista.includes(`className="${clase}"`),
        `\`${archivo}\` se anotó en la estética con \`estetica-op\` pero le falta \`${clase}\`: ` +
          'hereda la paleta y la tipografía, y el encabezado se le queda sin invertir',
      );
    }
  }
});

test('el alcance conserva su ancla de especificidad: un `#id` Y una clase', () => {
  /* LA PIEZA DE LA QUE CUELGA TODA LA HOJA, Y LA QUE MÁS SE PARECE A CÓDIGO MUERTO.

     El alcance es `:is(#v-closer, .estetica-op)`, y las tres vistas de operación llevan la clase
     —el Closer incluido—. O sea que `#v-closer` no hace falta para que ninguna regla COINCIDA, y
     ahí está la trampa: parece repetido y se borra en un minuto.

     Hace otra cosa. `:is()` toma la especificidad de su argumento MÁS específico, sin importar
     cuál coincidió, así que el `#id` es lo que mantiene las 210 reglas en `1-x-0`. Sin él caen a
     `0-x+1-0` **todas a la vez**, y las pisan `closer.css` y `aios.css`, que declaran varias de
     estas mismas clases. No hay error, no hay consola: se despintan pedazos sueltos en pantallas
     distintas.

     Se afirma la FORMA —hay un `#id` y hay una clase—, no la cadena exacta, para que sumar o
     quitar un id anclado no rompa la prueba por algo que no es lo que cuida. */
  assert.match(ALCANCE, /^:is\(/, 'el alcance dejó de ser un `:is()`');
  assert.match(
    ALCANCE,
    /#[\w-]+/,
    'el alcance se quedó SIN `#id`: las 210 reglas de esta hoja acaban de bajar un escalón de ' +
      'especificidad todas juntas, y las pisan `closer.css` y `aios.css` sin decir una palabra',
  );
  assert.match(
    ALCANCE,
    /\.[\w-]+/,
    'el alcance se quedó sin clase: volvió a ser una lista de ids, que es lo que hay que editar ' +
      'línea por línea cada vez que entra una pantalla',
  );

  /* Y que la hoja diga eso mismo. La constante de acá es una copia; la fuente es el archivo. */
  const primera = /^(:is\([^)]*\))/m.exec(sinComentarios(leerCrudo(ESTETICA)))?.[1];
  assert.equal(primera, ALCANCE, 'la hoja y esta prueba dejaron de hablar del mismo alcance');
});

test('el contador de prompts que faltan sigue en ámbar, no en el acento', () => {
  /* El choque que sí necesitaba regla. `app/auditoria.css` lo pinta con `.cl-sub .aud-cnt-falta`
     —dos clases— y la regla de la estética lleva un `#id`, así que le ganaba y lo devolvía al
     acento. Su comentario dice por qué importa: `cnt` en acento es «tenés tareas», y este número es
     «te falta cargar esto». Dos significados con el mismo color se leen como el mismo aviso. */
  const hoja = sinComentarios(leerCrudo(ESTETICA));
  const i = hoja.indexOf('#v-auditoria .cl-sub .aud-cnt-falta {');
  assert.ok(i > 0, 'se fue la regla que le devuelve el ámbar al contador de prompts que faltan');
  const regla = hoja.slice(i, hoja.indexOf('}', i));
  assert.match(regla, /var\(--warn\)/, 'el contador dejó de usar el token de advertencia');

  /* Y va DESPUÉS de la regla general del contador, porque con la misma especificidad gana la
     última. Acá además la gana por el `#id`, pero el orden es lo que la hace legible. */
  assert.ok(
    hoja.indexOf(`${ALCANCE} .cl-sub .cnt`) < i,
    'la regla del contador de Auditoría quedó ANTES que la general, así que no la pisa',
  );
});

test('la barra de pestañas de Auditoría no queda centrada', () => {
  /* El tercer choque, y el que menos se ve venir: `align-self: center` centra la cápsula dentro de
     la fila del encabezado, que es donde vive en las otras dos. En Auditoría la barra la emite el
     panel —componente de cliente contra vista de servidor— y cuelga de `.cl-page`, un flex en
     columna: ahí `center` la deja centrada HORIZONTALMENTE, sola en medio de la pantalla. */
  const hoja = sinComentarios(leerCrudo(ESTETICA));
  const i = hoja.indexOf('#v-auditoria .cl-sub {');
  assert.ok(i > 0, 'se fue la regla que alinea la barra de Auditoría a la izquierda');
  assert.match(hoja.slice(i, hoja.indexOf('}', i)), /align-self:\s*flex-start/);
});

test('los botones de Auditoría usan el botón de la aplicación, no una clase sin forma', () => {
  /* `.pr-btn` NUNCA tuvo regla en ninguna hoja: los dos botones de esta pantalla —«Reintentar» y
     «Guardar»— se dibujaban nativos del navegador, grises y cuadrados, en medio de un tablero. Lo
     único que existía era `.aud-error .pr-btn { margin-top: 8px }`, un margen sobre algo sin forma.
     No es una regresión de este trabajo: es un defecto que salió a la luz al mirar la pantalla. */
  const panel = leer('components/auditoria/PanelDeAuditoria.jsx');
  assert.ok(
    !panel.includes('className="pr-btn"'),
    'volvió `pr-btn` al panel de Auditoría, y esa clase no tiene forma en ninguna hoja: el botón ' +
      'se dibuja nativo',
  );
  assert.match(panel, /className="fd-btn sec"/, 'el botón de reintentar dejó de ser el de la aplicación');
  assert.match(panel, /className="fd-btn"/, 'el botón de guardar dejó de ser el de la aplicación');
});
