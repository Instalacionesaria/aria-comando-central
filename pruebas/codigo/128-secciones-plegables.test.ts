// Las secciones de los cuatro tableros se repliegan, y ninguna dibuja su encabezado a mano. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y QUE YA OCURRIÓ CON OTRO BOTÓN
//
// `.md-sec` + `.md-h` + su conteo es el molde de Mi Día, y el Pipeline lo copió cuando pasó de
// columnas a secciones apiladas. Son CUATRO tableros —Closer y Setter montan los mismos dos
// componentes con distinto camino de API— con el mismo encabezado escrito en dos lugares.
//
// La semana pasada eso costó un defecto real: la cola «Agenda de hoy» de Mi Día dibujaba su propia
// fila y se le olvidó el clic, así que era la única fila de la aplicación que no abría la ficha —y
// no fallaba nada, porque el `:hover` de la clase la iluminaba igual. Un encabezado copiado tiene
// exactamente ese modo de falla: se le agrega algo a uno, el otro queda sin él, y las dos pantallas
// se ven idénticas.
//
// Por eso lo que se afirma no es «que el botón exista» sino **que nadie dibuje un `.md-h` fuera del
// componente compartido**. Escrito así, un quinto tablero no puede estrenar el defecto.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

/** Todos los componentes, recursivamente. */
function componentes(dir = 'components'): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(join(RAIZ, dir))) {
    const ruta = `${dir}/${entrada}`;
    if (statSync(join(RAIZ, ruta)).isDirectory()) salida.push(...componentes(ruta));
    else if (entrada.endsWith('.jsx') || entrada.endsWith('.tsx')) salida.push(ruta);
  }
  return salida.sort();
}

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');

/** Sin comentarios: la lección de `110-monitoreo`, `120`, `123` y `127`, ya pagada cuatro veces. */
const codigo = (r: string): string =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/{\/\*[\s\S]*?\*\/}/g, '');

const PLEGABLE = 'components/negocio/SeccionPlegable.jsx';

/**
 * Los que dibujan un `.md-h` propio, con su motivo.
 *
 * Vacío no es la meta: la meta es que cada entrada tenga una razón que alguien pueda discutir. Una
 * lista de excepciones sin motivos es una lista que crece sola.
 */
const ENCABEZADOS_A_MANO: readonly { archivo: string; porque: string }[] = [
  {
    archivo: 'components/negocio/ListaDeContactos.jsx',
    porque:
      'Su sección «Tus contactos» **es la pantalla entera**, no una de varias: replegarla deja la ' +
      'pantalla en blanco, y el botón serviría para esconder lo único que se vino a ver. Los cuatro ' +
      'tableros que sí lo llevan tienen entre cinco y ocho secciones compitiendo por el alto. ' +
      'Además su encabezado no es el mismo: lleva un «y hay más» cuando la lista está cortada.',
  },
];

test('nadie dibuja un `.md-h` fuera de `SeccionPlegable`', () => {
  /* La regla sistémica. Un tablero nuevo que copie el encabezado hereda el molde sin el botón, y
     eso no falla en ninguna parte: se ve igual que los otros cuatro menos por una flecha que nadie
     echa de menos hasta que la busca. */
  const culpables: string[] = [];

  for (const archivo of componentes()) {
    if (archivo === PLEGABLE) continue;
    if (/className="md-h"/.test(codigo(archivo))) culpables.push(archivo);
  }

  const permitidos = new Set(ENCABEZADOS_A_MANO.map((x) => x.archivo));
  assert.deepEqual(
    culpables.filter((a) => !permitidos.has(a)),
    [],
    'hay un encabezado de sección dibujado a mano: va a quedar sin el botón de replegar y nadie lo ' +
      'va a notar. Usá `SeccionPlegable`, o agregá el archivo a `ENCABEZADOS_A_MANO` con el motivo.',
  );

  // Y la lista no puede tener entradas muertas: una excepción que ya no aplica es una puerta abierta.
  assert.deepEqual(
    [...permitidos].filter((a) => !culpables.includes(a)),
    [],
    'hay entradas muertas en `ENCABEZADOS_A_MANO`: sacalas',
  );
});

test('los CUATRO tableros pasan por el componente compartido', () => {
  /* La otra mitad, y la que el barrido de arriba no puede ver: que los dos componentes que dibujan
     los cuatro tableros lo USEN. Sin esto, borrar `<SeccionPlegable>` de uno lo dejaría sin
     secciones y sin `.md-h`, o sea pasando el barrido.

     Son DOS componentes y CUATRO tableros porque Closer y Setter montan los mismos dos con distinto
     camino de API. Se afirma sobre los dos componentes y sobre las dos vistas que los montan. */
  for (const archivo of ['components/closer/MiDia.jsx', 'components/closer/Pipeline.jsx']) {
    const fuente = codigo(archivo);
    assert.match(fuente, /<SeccionPlegable/, `${archivo} no dibuja secciones plegables`);
    assert.match(
      fuente,
      /import SeccionPlegable from '\.{1,2}\/negocio\/SeccionPlegable\.jsx';/,
      `${archivo} no importa el componente compartido`,
    );
  }

  for (const vista of ['components/views/CloserView.jsx', 'components/views/SetterView.jsx']) {
    const fuente = codigo(vista);
    assert.match(fuente, /<MiDia/, `${vista} dejó de dibujar Mi Día`);
    assert.match(fuente, /<Pipeline/, `${vista} dejó de dibujar el Pipeline`);
  }
});

test('la sección nace ABIERTA', () => {
  /* Se pidió con todas las letras. Y no es un detalle de gusto: nace cerrada y la pantalla arranca
     mostrando siete renglones de títulos donde antes estaba el trabajo del día — se vería como que
     no hay datos. */
  assert.match(
    codigo(PLEGABLE),
    /const \[abierta, setAbierta\] = useState\(true\);/,
    'la sección no nace abierta',
  );
});

test('el conteo queda FUERA de lo que se pliega', () => {
  /* Es la mitad que hace que replegar sirva. Las dos pantallas ya tenían escrita la regla —*«el
     conteo va SIEMPRE, incluido el cero»*— y plegar el número con la lista la habría roto: una
     sección cerrada sin conteo no dice si adentro hay doce o ninguno, y entonces nadie la cierra.

     Se comprueba por POSICIÓN: el conteo tiene que estar antes del condicional que pliega. */
  const fuente = codigo(PLEGABLE);
  const conteo = fuente.indexOf('className="b"');
  const pliegue = fuente.indexOf('{abierta ? children : null}');

  assert.ok(conteo > 0, 'no está el conteo en el encabezado');
  assert.ok(pliegue > 0, 'no está el condicional que pliega');
  assert.ok(
    conteo < pliegue,
    'el conteo quedó adentro de lo que se pliega: una sección cerrada no diría cuántos hay',
  );
});

test('los hijos NO van envueltos en otro elemento', () => {
  /* ── DOS REGLAS DE CSS DEPENDEN DE ESTO, Y SE ROMPEN EN SILENCIO ─────────
   *
   * `app/closer.css` tiene `.md-sec > .pipe-vacia` —el aire del vacío de una etapa— y
   * `.md-sec > .md-r:first-of-type` —el borde de la primera fila—. Las dos son de hijo DIRECTO.
   *
   * Un `<div>{children}</div>` no falla en ninguna parte: el vacío de una etapa pierde su margen y
   * queda pegado a los bordes, y la primera fila del Pipeline se dibuja con doble línea. Se ve como
   * un descuido de diseño, no como lo que es.
   *
   * Se afirma la forma exacta, `{abierta ? children : null}`, porque es la única que mantiene las
   * filas donde el CSS las espera. */
  const fuente = codigo(PLEGABLE);

  assert.match(fuente, /\{abierta \? children : null\}/, 'cambió la forma de plegar');
  /* DOS veces y no una: la propiedad en la firma, y el condicional que la dibuja. Una tercera
     aparición es alguien envolviéndola —`<div>{children}</div>`, un `.map` alrededor, un
     `Fragment` con clase— y es justo lo que rompe las dos reglas de `> hijo`. */
  assert.equal(
    (fuente.match(/\bchildren\b/g) ?? []).length,
    2,
    '`children` no aparece las dos veces esperadas —la firma y el condicional—: si son más, ' +
      'alguien lo envolvió, y eso rompe dos reglas de `> hijo` de `closer.css` sin que nada falle',
  );

  // Y las dos reglas que dependen de esto siguen escritas como de hijo directo.
  const css = leer('app/closer.css');
  assert.match(css, /\.md-sec > \.pipe-vacia/, 'se fue la regla del vacío de una etapa');
  assert.match(css, /\.md-sec > \.md-r:first-of-type/, 'se fue la regla del borde de la primera fila');
});

test('el control es un `button` de verdad, y dice si está abierta', () => {
  /* Un `<div onClick>` no se alcanza con el tabulador ni responde a Enter, y no hay forma de que un
     lector de pantalla sepa si la lista está abierta: la flecha es un glifo, no un estado.

     `aria-expanded` es lo que lo dice, y va atado a la MISMA variable que dibuja la lista — no a una
     copia que pueda quedar desfasada. */
  const boton = codigo(PLEGABLE).match(/<button[\s\S]*?\n\s*>/);
  assert.ok(boton, 'no está el botón');
  assert.match(boton[0], /type="button"/, 'sin `type` un botón dentro de un formulario lo manda');
  assert.match(boton[0], /className="sec-plegar"/);
  assert.match(boton[0], /aria-expanded=\{abierta\}/, 'el botón no dice si la lista está abierta');
  assert.match(boton[0], /aria-label=/, 'el botón no tiene nombre: un lector de pantalla lee la flecha');
});

test('el botón va TODO a la derecha, y su estilo no está en `aios.css`', () => {
  /* «Todo a la derecha del título» fue el pedido, y en un `.md-h` que ya es flex eso es
     `margin-left:auto` — se va al borde sin mover el título ni el conteo, y sin depender de cuántas
     cosas haya en el medio.

     Y el estilo va en `closer.css`: `app/aios.css` es el port literal del prototipo y
     `scripts/paridad.mjs` lo compara contra él. Este botón no existe en el prototipo. */
  const css = leer('app/closer.css');
  const regla = css.match(/\.sec-plegar \{[^}]*\}/);
  assert.ok(regla, '`.sec-plegar` no está definida: el botón se dibuja sin estilo');
  assert.match(regla[0], /margin-left: auto;/, 'el botón no se va al borde derecho');

  assert.equal(
    leer('app/aios.css').includes('.sec-plegar'),
    false,
    '`.sec-plegar` se escribió en `aios.css`, que es el port literal del prototipo',
  );

  /* Y el giro de la flecha sale de la clase de la sección, no de un segundo glifo: con dos glifos
     hay dos fuentes de verdad para el mismo estado, y el día que una se olvide la flecha apunta
     para donde la lista no está. */
  assert.match(css, /\.md-sec\.plegada \.sec-plegar/, 'la flecha no gira al plegarse');
  assert.match(
    css,
    /\.md-sec\.plegada \.md-h {[^}]*border-bottom: 0;/,
    'el encabezado plegado deja su borde de abajo: queda una línea pegada al borde redondeado',
  );
});
