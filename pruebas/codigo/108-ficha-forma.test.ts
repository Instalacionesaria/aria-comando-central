// La FORMA de la ficha del contacto. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTOS CUATRO DEFECTOS NECESITAN UNA GUARDA DE CÓDIGO Y NO UNA DE COMPORTAMIENTO
//
// Los cuatro que fija este archivo tienen la misma propiedad incómoda: **la aplicación funciona con
// ellos puestos**. No hay respuesta que cambie, ni consulta que falle, ni pantalla que se rompa. Se
// ven leyendo el archivo, o usándolo con las manos durante un rato largo. Así que la única guarda
// posible es leer la fuente.
//
// **1 · `Cuerpo` declarada DENTRO de `Ficha`.** React compara el tipo de un elemento por identidad
// de referencia, y una función declarada dentro de un componente es una función nueva en cada
// render. Estuvo así, y el efecto medido fue: cada tecla en el campo de notas remontaba el
// `<textarea>` y **se perdía el foco y el cursor**. Escribir una nota era escribir una letra y
// volver a hacer clic — el síntoma que se reportó como «las notas no se guardan», cuando se
// guardaban perfecto. Y el reloj de 5 s del chat remontaba las 200 burbujas cada cinco segundos.
//
// Nada falla. `npm run build` compila, `tipos` pasa, la suite entera queda verde, y la única forma
// de notarlo es escribir en el campo.
//
// **2 · Los dos botones que salen de la aplicación.** «↗ Ver en GHL» y «◷ Agendar» se quitaron a
// pedido, y con ellos los dos campos que solo ellos leían. Un campo que se sigue calculando y ya
// nadie dibuja cuesta: `enlaceAgendar` era una consulta a `identidad.organizaciones_credenciales`
// por cada apertura de ficha.
//
// **3 · Un `cursor: pointer` sobre algo inerte.** Los seis íconos no son clicables —`SeisIconos` los
// dibuja como `<i>` sin `onClick`— y el prototipo los dibujaba con cursor de mano y `:hover`. Se
// hace clic, no pasa nada, y se hace clic otra vez creyendo que falló.
//
// **4 · `hace()` en dos archivos con dos comportamientos.** La copia de la ficha maneja el futuro y
// la de la fila no, así que con un instante futuro la lista decía `hace -120 min` y la ficha
// `en 2 h`, sobre el mismo dato. Es el defecto que `lib/negocio/tiempo.ts` existe para cortar: su
// encabezado nombra a `Ficha.jsx` como el ofensor de la vez anterior, con `hora(iso, zona)`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { archivosFuente } from '../apoyo/fuente.ts';
import { haceCuanto } from '../../lib/negocio/tiempo.ts';

const RAIZ = new URL('../../', import.meta.url);

/** La fuente SIN comentarios. Es lo que evita el error de buscar una cadena que un comentario cita. */
function limpio(ruta: string): string {
  const a = archivosFuente(['app', 'components', 'lib']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se encontró ${ruta}`);
  return a.limpio;
}

/** El CSS, que `archivosFuente` no enumera: sus extensiones son de código. */
const css = (ruta: string) =>
  readFileSync(new URL(ruta, RAIZ), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · `Cuerpo` VIVE AFUERA
// ═══════════════════════════════════════════════════════════════════════════════

test('`Cuerpo` está declarada al nivel del módulo y NO dentro de `Ficha`', () => {
  const src = limpio('components/negocio/Ficha.jsx');

  /* La declaración empieza en la columna CERO. No es una preferencia de estilo: una función anidada
     en `Ficha` está indentada, y la indentación es el rastro más simple y directo de la anidación.
     Se comprueba sobre la fuente sin comentarios, así que el párrafo que explica todo esto —y que
     nombra la palabra `Cuerpo` varias veces— no puede hacer pasar la prueba por accidente. */
  const declaraciones = src
    .split('\n')
    .filter((l) => /^\s*function Cuerpo\s*\(/.test(l));
  assert.equal(declaraciones.length, 1, 'hay más de una declaración de `Cuerpo`, o ninguna');
  assert.equal(
    declaraciones[0]?.startsWith('function Cuerpo'),
    true,
    'la declaración de `Cuerpo` está indentada, o sea que volvió a estar DENTRO de otra función: ' +
      'React la ve como un tipo nuevo en cada render y remonta el cuerpo entero de la pestaña ' +
      'activa — el campo de notas pierde el foco en cada tecla',
  );

  // Y va ANTES de `Ficha`, que es lo que hace imposible que tome algo de su cierre.
  const iCuerpo = src.indexOf('function Cuerpo');
  const iFicha = src.indexOf('export default function Ficha');
  assert.ok(iCuerpo >= 0 && iFicha >= 0);
  assert.ok(iCuerpo < iFicha, '`Cuerpo` quedó después de `Ficha`');
});

test('`Cuerpo` recibe por propiedades todo lo que antes tomaba del cierre', () => {
  // La mitad complementaria de la prueba anterior: `Cuerpo` podría estar afuera y seguir esperando
  // variables que ya no existen ahí, y entonces la pestaña activa se dibujaría vacía o rota. Estas
  // nueve son exactamente las que usaba del cierre de `Ficha`.
  const src = limpio('components/negocio/Ficha.jsx');
  const firma = src.slice(src.indexOf('function Cuerpo'), src.indexOf('const p = pestanas['));
  for (const prop of [
    'activa',
    'pestanas',
    'contacto',
    'zona',
    'nota',
    'setNota',
    'agregarNota',
    'guardandoNota',
    'avisoNota',
  ]) {
    assert.match(
      firma,
      new RegExp(`\\b${prop}\\b`),
      `\`Cuerpo\` no recibe \`${prop}\`: si lo usa adentro, es una variable libre y la pestaña rompe`,
    );
  }

  /* Y el USO le pasa las nueve. Sin esto, la firma podría declararlas y el sitio de uso mandarlas
     todas en `undefined` — el caso en el que la pestaña se dibuja vacía sin ningún error. */
  const uso = src.slice(src.indexOf('<Cuerpo'), src.indexOf('<Cuerpo') + 600);
  for (const prop of ['activa', 'pestanas', 'contacto', 'zona', 'nota', 'setNota', 'agregarNota']) {
    assert.match(uso, new RegExp(`${prop}=\\{`), `el uso de \`Cuerpo\` no pasa \`${prop}\``);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS DOS BOTONES, Y SUS DATOS, NO VUELVEN
// ═══════════════════════════════════════════════════════════════════════════════

test('los botones «Ver en GHL» y «Agendar» no están, y tampoco los campos que leían', () => {
  const ficha = limpio('components/negocio/Ficha.jsx');
  assert.doesNotMatch(ficha, /Ver en GHL/, 'volvió el botón «Ver en GHL»');
  assert.doesNotMatch(ficha, /Agendar</, 'volvió el botón «Agendar»');
  /* `cw-pin` es la clase de los dos, y era la única que los dibujaba en este panel. Buscarla es más
     robusto que buscar el texto: un botón renombrado a «Abrir en el CRM» seguiría llevándose al
     closer fuera de la pantalla, y esta línea lo atraparía igual. */
  assert.doesNotMatch(ficha, /cw-pin/, 'volvió un botón secundario al encabezado de la ficha');
  assert.doesNotMatch(ficha, /enlaceAgendar/, 'volvió el estado del enlace de agendamiento');

  const ruta = limpio('app/api/contactos/[id]/route.ts');
  assert.doesNotMatch(
    ruta,
    /enlaceCrm/,
    'volvió `refresco.enlaceCrm`: un campo que ninguna pantalla lee es un campo del que dentro de ' +
      'seis meses nadie sabe si se puede tocar',
  );
  assert.doesNotMatch(
    ruta,
    /enlaceDeAgendamiento|enlaceAgendar/,
    'volvió `enlaceAgendar`: es una consulta a las credenciales por cada apertura de ficha, para un ' +
      'enlace que nadie dibuja',
  );
  /* Y la regla de estilo se fue con ellos. Una regla huérfana no rompe nada, y es lo que hace que
     seis meses después nadie se anime a borrar `.cw-pin` de `aios.css` por si acaso. */
  assert.doesNotMatch(css('app/closer.css'), /\.cw-acciones \.cw-pin/, 'quedó la regla del botón');
});

test('el calendario de agendamiento sigue configurándose, aunque el botón ya no esté', () => {
  /* La otra cara de la prueba anterior, y hace falta: quitar el botón NO significa quitar el dato.
     `crm_calendario_id` se pidió explícitamente y se sigue guardando; `lib/ghl/agendar.ts` sigue
     siendo la única definición de la forma de esa URL, con la medición de las tres formas probadas
     contra la subcuenta real. Sin esta prueba, «limpiar código muerto» se lleva por delante una
     tarde de mediciones y una columna que alguien está llenando. */
  assert.match(
    limpio('lib/credenciales/resolver.ts'),
    /crm_calendario_id/,
    'se borró el calendario de agendamiento de las credenciales',
  );
  assert.match(
    limpio('lib/ghl/agendar.ts'),
    /export function enlaceDeAgendamiento/,
    'se borró `enlaceDeAgendamiento`: lo que vale de ese archivo es la medición de su encabezado',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LO QUE NO ES CLICABLE NO PARECE CLICABLE
// ═══════════════════════════════════════════════════════════════════════════════

test('los seis íconos no prometen un clic que no existe', () => {
  // Primero el hecho: no hay manejador. Si algún día lo hay, esta prueba tiene que ponerse roja
  // entera y no solo la mitad del cursor.
  const fila = limpio('components/negocio/Fila.jsx');
  /* SOLO la funcion de los iconos, y el corte importa: hasta el final del archivo se lleva el
     `onClick` de la FILA, que si es clicable y debe serlo. Un `doesNotMatch` sobre el archivo entero
     habria estado rojo desde el primer dia por el motivo equivocado. */
  const seis = fila.slice(
    fila.indexOf('export function SeisIconos'),
    fila.indexOf('export default function Fila'),
  );
  assert.doesNotMatch(
    seis,
    /onClick/,
    'los íconos ganaron un manejador: entonces el cursor de mano hay que devolverlo, no quitarlo',
  );

  /* Y el estilo lo dice. `aios.css` trae `.md-acts i { cursor: pointer }` con su `:hover` y NO se
     toca —es el port literal del prototipo y `scripts/paridad.mjs` lo compara contra el HTML—, así
     que la anulación vive en `closer.css`, que está en la capa `components` y le gana sin un solo
     `!important`. */
  const closer = css('app/closer.css');
  assert.match(closer, /\.md-acts i\s*\{[^}]*cursor:\s*default/, 'volvió el cursor de mano');
  assert.match(closer, /\.md-acts i:hover\s*\{[^}]*color:\s*inherit/, 'volvió el `:hover`');

  // Y el prototipo sigue intacto, que es la propiedad que permite comparar contra el HTML.
  assert.match(
    css('app/aios.css'),
    /\.md-acts i\{[^}]*cursor:pointer/,
    '`aios.css` dejó de ser el port literal del prototipo: la anulación va en `closer.css`',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · `hace()` TIENE UNA SOLA DEFINICIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('la distancia en palabras se calcula en un solo lugar, y maneja el futuro', () => {
  // El comportamiento, primero: es lo que divergía entre las dos copias.
  const ahora = new Date('2026-08-27T12:00:00Z').getTime();
  const en = (ms: number) => haceCuanto(new Date(ahora + ms), ahora);
  assert.equal(en(-3 * 60_000), 'hace 3 min');
  assert.equal(en(-3 * 3600_000), 'hace 3 h');
  assert.equal(en(-3 * 24 * 3600_000), 'hace 3 d');
  assert.equal(en(0), 'ahora');
  /* EL FUTURO, que es la mitad que la copia de la fila no tenía: decía `hace -120 min`. Y no es un
     caso inventado — la fila dibuja `ultimoEntranteEl`, que llega del CRM, y un teléfono con el
     reloj adelantado o una subcuenta con la zona mal puesta produce un instante futuro. */
  assert.equal(en(2 * 3600_000), 'en 2 h', 'un instante futuro vuelve a dar una cantidad negativa');
  assert.equal(en(30 * 60_000), 'en 30 min');
  // Y un valor ausente no da `NaN`: las dos copias hacían `Date.now() - new Date(null)`.
  assert.equal(haceCuanto(null), '—');
  assert.equal(haceCuanto(undefined), '—');

  /* Y la forma: ni un solo componente vuelve a declararla. Se busca la DECLARACIÓN y no el nombre,
     porque los dos archivos siguen usando `hace(...)` en sus plantillas — el alias local es
     deliberado, para no tocar los usos. */
  for (const ruta of ['components/negocio/Ficha.jsx', 'components/negocio/Fila.jsx']) {
    assert.doesNotMatch(
      limpio(ruta),
      /function hace\s*\(/,
      `${ruta} volvió a declarar su propia \`hace()\`: es como la lista y la ficha llegaron a decir ` +
        'dos cosas distintas del mismo instante',
    );
    assert.match(limpio(ruta), /haceCuanto/, `${ruta} no usa la definición compartida`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LAS CUATRO PESTAÑAS COMPRUEBAN QUE EL CONTACTO EXISTE
// ═══════════════════════════════════════════════════════════════════════════════

test('las cuatro pestañas de lectura pasan por la MISMA guarda de existencia', () => {
  /* El comportamiento —404 y no 200 vacío— lo prueba `pruebas/base/95-closer-ficha.test.ts`. Esto
     fija que las cuatro usen la misma función y no cuatro comprobaciones parecidas: cuatro copias de
     un `select` de existencia son cuatro oportunidades de que una se quede sin el `where`, y el
     síntoma sería UNA pestaña filtrando mientras las otras tres se ven bien. */
  for (const pestana of ['perfil', 'historial', 'llamadas', 'notas']) {
    const src = limpio(`app/api/contactos/[id]/${pestana}/route.ts`);
    assert.match(
      src,
      /existeElContacto/,
      `la pestaña «${pestana}» no comprueba que el contacto exista: responde 200 con la lista vacía ` +
        'sobre un contacto de otra organización, que es una tercera respuesta además de 200 y 404',
    );
    assert.match(
      src,
      /rechazo\('no_encontrado'\)/,
      `la pestaña «${pestana}» comprueba y no rechaza`,
    );
  }
  // Y la definición está una sola vez.
  assert.match(limpio('lib/negocio/ficha.ts'), /export async function existeElContacto/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · UN CERO NO MEDIDO NO SE DEVUELVE COMO CERO
// ═══════════════════════════════════════════════════════════════════════════════

test('los dos conteos de los seis íconos pueden decir «no medido»', () => {
  /* El comportamiento lo prueban `90-negocio-closer-setter` y `93-closer-listas` contra la base. Acá
     se fija el TIPO, que es lo que hace que la distinción no se pueda perder por descuido: mientras
     `llamadasContestadas` sea `number` a secas, el único valor posible para «no hay de dónde
     medirlo» es un `0`, y `Number(x ?? 0)` vuelve solo la primera vez que alguien toque el mapeo. */
  const src = limpio('lib/negocio/fila.ts');
  for (const campo of ['reunionesTenidas', 'llamadasContestadas']) {
    assert.match(
      src,
      new RegExp(`${campo}: number \\| null`),
      `\`${campo}\` volvió a ser \`number\` a secas: el «no medido» queda inalcanzable y un cero ` +
        'afirma un hecho que nadie midió',
    );
  }
  // Y las dos banderas por empresa, que son las que producen el `null`.
  assert.match(src, /hay_citas/, 'se fue la bandera de «¿hay citas leídas en esta empresa?»');
  assert.match(src, /hay_llamadas/, 'se fue la bandera de «¿hay llamadas en esta empresa?»');
});
