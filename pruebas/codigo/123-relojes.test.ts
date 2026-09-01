// Todo sondeo repetido pasa por `lib/reloj.ts`. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y QUE YA OCURRIÓ DOS VECES
//
// `lib/reloj.ts` existe porque hubo *«ocho `setInterval` sueltos repartidos en cuatro archivos,
// cada uno pegándole al CRM cada 10–30 segundos, incluso con la pestaña oculta»*. Su garantía
// número uno es: **pestaña oculta = cero intervalos corriendo**.
//
// Y volvió a pasar. `components/Nav.jsx` sondeaba «¿hay un scraping corriendo?» cada 20 segundos
// con un bucle de `setTimeout` propio, fuera del módulo. No respetaba la pestaña oculta, así que
// preguntaba **180 veces por hora y por persona conectada**, corrieran o no scrapings, mirara o no
// alguien la aplicación. Nadie lo notó porque no falla: es una petición barata, muchas veces.
//
// El módulo no puede defenderse solo — un componente siempre puede escribir su propio bucle. Esto
// es lo que lo convierte en una regla comprobada.
//
// ── LO QUE NO PROHÍBE, Y POR QUÉ ────────────────────────────────────────────
//
// Un `setTimeout` de UNA vez no es un reloj: apagar el cartel de «copiado» a los dos segundos no
// vuelve a dispararse nunca. Lo que se persigue es el sondeo REPETIDO — el que se reprograma solo o
// usa `setInterval`.
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
/** Sin comentarios: la lección de `110-monitoreo` y `120-mapa-ejecutivo`, ya pagada dos veces. */
const codigo = (r: string): string =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/**
 * Los sondeos repetidos que NO pasan por el reloj, con su motivo.
 *
 * Vacío no es la meta: la meta es que cada entrada tenga una razón que alguien pueda discutir. Una
 * lista de excepciones sin motivos es una lista que crece sola.
 */
const RELOJES_A_MANO: readonly { archivo: string; porque: string }[] = [
  {
    archivo: 'components/tools/Scraper.jsx',
    porque:
      'Sondea el estado de UN scraping cada 5 s y **se apaga solo al terminar**: su vida es la del ' +
      'scraping, no la del día. Además ahí hay alguien esperando el resultado en pantalla, que es ' +
      'justo el caso en el que frenar con la pestaña oculta sería peor — se vuelve a la pestaña y ' +
      'el resultado ya tendría que estar. Es un sondeo acotado, no un reloj de fondo.',
  },
];

test('ningún componente sondea en bucle fuera de `lib/reloj.ts`', () => {
  /* ── QUÉ CUENTA COMO SONDEO REPETIDO ──────────────────────────────────────
   *
   * Dos formas, y las dos se buscan:
   *
   *   · `setInterval(` — repite por definición.
   *   · `setTimeout(nombreDeFuncion, ms)` — la forma que toma un bucle que se reprograma solo: el
   *     `setTimeout` recibe la MISMA función que lo programó. Es literalmente lo que tenía
   *     `Nav.jsx` (`setTimeout(mirar, …)`) y lo que tiene el scraper (`setTimeout(tic, …)`).
   *
   * ── LA PRIMERA VERSIÓN DE ESTE PATRÓN ERA DEMASIADO ANCHA ───────────────
   *
   * Buscaba cualquier `= setTimeout(`, o sea «un temporizador que se guarda para cancelarlo», y eso
   * también es la forma de un **debounce**: `MisLeads.jsx` espera 350 ms desde la última tecla
   * antes de buscar, y se cancela en cada tecla. Un debounce dispara UNA vez por pausa y no se
   * reprograma solo — no tiene nada que ver con lo que este archivo persigue.
   *
   * La diferencia que los separa es el ARGUMENTO: un bucle pasa una función con nombre —porque
   * necesita volver a llamarse— y un debounce pasa una flecha en el lugar. */
  const culpables: string[] = [];

  for (const archivo of componentes()) {
    const c = codigo(archivo);
    const conInterval = /\bsetInterval\s*\(/.test(c);
    // `setTimeout(algo, …)` con un identificador en vez de una flecha: se reprograma solo.
    const seReprograma = /\bsetTimeout\s*\(\s*[A-Za-z_$][\w$]*\s*,/.test(c);
    if (conInterval || seReprograma) culpables.push(archivo);
  }

  const permitidos = new Set(RELOJES_A_MANO.map((x) => x.archivo));
  assert.deepEqual(
    culpables.filter((a) => !permitidos.has(a)),
    [],
    'hay un sondeo repetido fuera de `lib/reloj.ts`. Ese módulo es lo único que garantiza que la ' +
      'pestaña oculta no gaste peticiones, y un bucle propio se la salta sin fallar: son peticiones ' +
      'baratas, muchas veces, y nadie lo nota. Usá `usarReloj(clave, fn, CADENCIA.x)`, o agregá el ' +
      'archivo a `RELOJES_A_MANO` con el motivo.',
  );

  // Y la lista no puede tener entradas muertas: una excepción que ya no aplica es una puerta abierta.
  assert.deepEqual(
    [...permitidos].filter((a) => !culpables.includes(a)),
    [],
    'hay entradas muertas en `RELOJES_A_MANO`: sacalas',
  );
});

test('el puntito de Tools usa el reloj compartido, y no pregunta sin Tools', () => {
  /* La instancia concreta que este archivo vino a arreglar, convertida en prueba. Se afirma sobre
     `Nav.jsx` y no solo por el barrido de arriba porque son dos cosas distintas: aquél dice «no hay
     bucles a mano» y esto dice «este sondeo pasa por el reloj y con la clave apagada cuando no hay
     nada que vigilar». Un `usarReloj('tools:enVuelo', …)` sin condición pasaría el barrido perfecto
     y le cobraría el punto a quien ni siquiera tiene la sección. */
  const nav = codigo('components/Nav.jsx');

  assert.match(
    nav,
    /usarReloj\(\s*puedeVerTools \? '[\w:]+' : null,/,
    'el puntito no pasa por el reloj, o pregunta también sin la sección Tools',
  );
  assert.match(nav, /CADENCIA\.puntitoDeTools/, 'la cadencia volvió a escribirse en el componente');

  /* Y la PRIMERA lectura la hace el componente. `registrarReloj` no dispara al registrarse —lo
     documenta y lo aprendió fallando— así que sin esto, montar con la pestaña oculta dejaría el
     punto apagado hasta volver, y un punto apagado no se distingue de «no hay ningún scraping». */
  assert.match(nav, /void mirar\(\);/, 'nadie hace la primera lectura: el punto arranca en blanco');
});

test('las cadencias de sondeo viven en UN archivo', () => {
  /* `lib/cadencia.ts` dice que están juntas *«para que nadie invente la suya»*, y la del puntito se
     inventó igual dentro del componente. Que estén todas ahí es lo que hace que la próxima se
     escriba al lado de las otras — y de paso, junto al recordatorio de que el reloj las frena.

     Se afirman las TRES por nombre y no un conteo: agregar una cuarta es legítimo y no tiene por
     qué poner esto rojo; perder una de éstas significa que alguien se la llevó al componente. */
  const cadencia = codigo('lib/cadencia.ts');
  for (const clave of ['chat', 'operacion', 'puntitoDeTools']) {
    assert.match(cadencia, new RegExp(`\\b${clave}:\\s*\\d`), `falta la cadencia \`${clave}\``);
  }

  /* Y `Nav.jsx` no vuelve a declarar la suya. Acotado a ese archivo a propósito: un barrido de
     «ninguna constante de milisegundos en components/» suena mejor y sería falso — `MisLeads`
     declara su pausa de tecleo y `Agenda` el tope de espera de una petición que tarda cinco
     minutos, y ninguna de las dos es una cadencia de sondeo. */
  assert.equal(
    /ESPERA_DEL_PUNTITO/.test(codigo('components/Nav.jsx')),
    false,
    'volvió la cadencia del puntito al componente, fuera del archivo de cadencias',
  );
});
