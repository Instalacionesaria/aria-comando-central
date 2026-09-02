// TODA fila de contacto abre su ficha. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y QUE YA OCURRIÓ
//
// La cola «Agenda de hoy» de Closer → Mi Día era la ÚNICA fila de la aplicación que no se podía
// abrir. Las otras cuatro colas dibujan `Fila`, que recibe `onAbrir`; ésa dibuja su propio
// componente —necesita la hora en la primera columna y el botón de la sala— y al escribirlo se le
// olvidó la mitad clicable.
//
// Y no fallaba en ninguna parte. Peor: **`.md-r:hover` ilumina toda fila con esa clase**, así que
// la de agenda se encendía al pasar el ratón igual que las demás y no hacía nada al hacer clic. El
// comentario de `Fila` ya nombraba el costo: *«un elemento que parece clicable y no responde es la
// forma más rápida de que alguien deje de confiar en la pantalla»*. Le pasaba justo en la cola que
// un closer abre primero cada mañana, con la gente a la que va a llamar en un rato.
//
// ── LO QUE SE AFIRMA, Y POR QUÉ NO ES «QUE `Fila` TENGA `onAbrir`» ─────────
//
// La regla no es sobre un componente: es sobre la CLASE. `md-r` trae un `:hover` que promete que
// la fila responde, así que cualquier elemento que la lleve tiene que responder. Escrito así, una
// sexta cola con su propio componente —que es exactamente cómo apareció este defecto— no puede
// repetirlo.
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

/**
 * Sin comentarios **y sin flechas**.
 *
 * ── EL `>` DE UNA FLECHA CORTA LA ETIQUETA A MITAD ──────────────────
 *
 * Un `onClick={(e) => e.stopPropagation()}` lleva un `>` adentro, así que cualquier patrón que
 * termine la etiqueta en el primer `>` la corta ahí — y lo que viene después queda invisible para
 * la comprobación. Medido: la primera versión de este archivo reportaba que el enlace de la sala
 * no cortaba la propagación **teniéndolo escrito**.
 *
 * Las flechas se vuelven `@@` antes de mirar. No se pierde nada: acá solo se busca qué atributos
 * tiene una etiqueta, no qué hacen.
 */
const codigo = (r: string): string =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/{\/\*[\s\S]*?\*\/}/g, '')
    .replace(/=>/g, '@@');

/**
 * Las etiquetas JSX que llevan la clase `md-r`, con su contenido hasta el `>` de apertura.
 *
 * Se busca la etiqueta ENTERA y no la línea de la clase, porque `onClick` casi nunca está en la
 * misma línea: en `Fila` hay un `style` de cinco renglones en el medio.
 */
function etiquetasConLaClase(fuente: string): string[] {
  const salida: string[] = [];
  // `<div` … `>` sin `<` adentro: una etiqueta de apertura no puede contener otra.
  for (const m of fuente.matchAll(/<[a-zA-Z][^<>]*?>/gs)) {
    const etiqueta = m[0];
    /* La clase se compara con frontera de palabra, y eso importa: sin ella, `md-raro` contaría
       como `md-r`. Es la misma lección que la prueba de los links rápidos pagó con una mutación
       que sobrevivió comparando por subcadena. */
    if (/className=(?:"|\{`)[^"`]*\bmd-r\b/.test(etiqueta)) salida.push(etiqueta);
  }
  return salida;
}

test('toda fila `md-r` responde al clic', () => {
  /* `.md-r:hover` la ilumina, así que una que no responda es una promesa incumplida. Y las filas de
     contacto son la puerta a la ficha: sin clic, el dato está en la base, se dibuja en pantalla, y
     no hay forma de llegar a él desde donde uno lo está mirando. */
  const mudas: string[] = [];

  for (const archivo of componentes()) {
    for (const etiqueta of etiquetasConLaClase(codigo(archivo))) {
      if (!/\bonClick=/.test(etiqueta)) mudas.push(archivo);
    }
  }

  assert.deepEqual(
    [...new Set(mudas)],
    [],
    'hay una fila `md-r` sin `onClick`: se ilumina al pasar el ratón y no abre nada, que es la ' +
      'forma más rápida de que alguien deje de creerle a la pantalla',
  );

  /* Y que el barrido esté MIRANDO algo. Sin esta línea, un cambio de nombre de clase dejaría cero
     etiquetas encontradas y la prueba pasaría en verde sobre nada — el mismo cero indistinguible
     que este repositorio persigue en las pantallas. */
  const cuantas = componentes().reduce(
    (n, a) => n + etiquetasConLaClase(codigo(a)).length,
    0,
  );
  assert.ok(cuantas >= 2, `solo se encontraron ${cuantas} filas \`md-r\`: el barrido no está mirando el JSX`);
});

test('la fila de la Agenda de hoy abre la ficha del CONTACTO', () => {
  /* La instancia concreta, y con la mitad que el barrido de arriba no puede ver: **con qué
     identificador** la abre. `item` trae dos —el de la cita y el del contacto— y la ficha es del
     contacto. Con el de la cita, el clic respondería y la ficha diría «no encontrado». */
  const midia = codigo('components/closer/MiDia.jsx');

  const llamada = midia.match(/<FilaDeAgenda[\s\S]*?\/>/);
  assert.ok(llamada, 'no está el llamador de `FilaDeAgenda`');
  assert.match(
    llamada[0],
    /onAbrir=\{\(fila\) @@ setAbierta\(fila\.id\)\}/,
    'la fila de agenda no recibe el mismo manejador que las otras cuatro colas',
  );

  // Y adentro, el clic pasa `item.fila` — la fila del contacto — y no `item.cita`.
  assert.match(
    midia,
    /onClick=\{\(\) @@ onAbrir\(item\.fila\)\}/,
    'la fila de agenda abre con algo que no es el contacto',
  );
});

test('el enlace de la sala NO abre la ficha detrás', () => {
  /* El defecto que estrena el arreglo si se hace a medias: la fila entera es clicable y «Unirse» es
     un `<a>` adentro, así que un clic ahí abre la videollamada en otra pestaña **y** la ficha acá
     detrás. Quien vuelve de la llamada se encuentra un panel que no pidió, encima de la lista.

     Es el defecto clásico de anidar algo interactivo dentro de algo interactivo, y no lo puede ver
     el barrido de arriba: para él la fila está perfecta. */
  const midia = codigo('components/closer/MiDia.jsx');

  const enlace = midia.match(/<a[^<>]*className="md-join"[^<>]*>/);
  assert.ok(enlace, 'no está el enlace de la sala');
  assert.match(
    enlace[0],
    /onClick=\{\(e\) @@ e\.stopPropagation\(\)\}/,
    'el enlace de la sala no corta la propagación: unirse a la llamada abre además la ficha',
  );
});

test('el Setter no tiene cola de agenda, y por eso no tenía este defecto', () => {
  /* Se comprobó y hay que dejarlo comprobado, porque es la pregunta que se hizo al reportar el
     defecto: ¿le pasa también al setter?

     No, y no por casualidad: **el setter trabaja por definición antes de que haya cita**, así que no
     tiene esa cola. `lib/negocio/miDiaDelSetter.ts` lo dice y además tiene su propio tipo de retorno
     —sin `agenda`— para que olvidarse de dibujar una cola no compile.

     Sus seis colas dibujan `Fila`, que sí abre. Esta prueba fija esa propiedad: el día que alguien
     le agregue una agenda al setter, va a tener que decidir a propósito cómo se abre esa fila en vez
     de heredar el defecto. */
  const vista = codigo('components/views/SetterView.jsx');
  const colas = vista.match(/const COLAS_DEL_SETTER = \[[\s\S]*?\n\];/);
  assert.ok(colas, 'no se pudo leer el catálogo de colas del setter');
  assert.doesNotMatch(
    colas[0],
    /clave: 'agenda'/,
    'el setter estrenó una cola de agenda: hay que decidir cómo se abre esa fila',
  );

  // Y su tipo del servidor tampoco la tiene, que es lo que lo hace imposible y no solo ausente.
  const tipo = codigo('lib/negocio/miDiaDelSetter.ts').match(
    /export interface MiDiaDelSetter \{[\s\S]*?\n\}/,
  );
  assert.ok(tipo, 'no se pudo leer `MiDiaDelSetter`');
  assert.doesNotMatch(tipo[0], /\bagenda\b/, 'el tipo del setter estrenó una agenda');
});
