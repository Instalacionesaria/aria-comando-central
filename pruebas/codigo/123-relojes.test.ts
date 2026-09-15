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
  {
    archivo: 'components/tools/EspiaDeAnuncios.jsx',
    porque:
      'El mismo caso que `Scraper.jsx`, con el mismo motor detrás: sondea UNA búsqueda de anuncios ' +
      'cada 5 s y se apaga sola al terminar. Comparte hasta el número, y a propósito — dos cadencias ' +
      'distintas para el mismo backend serían dos comportamientos que nadie eligió.',
  },
  {
    archivo: 'components/fundaciones/PanelResearch.jsx',
    porque:
      'La mirada al mercado real (2026-09-10): entre el paso 1 y el 2 el Research arranca Maps y el ' +
      'Espía y espera a que terminen, cada 5 s como `Scraper.jsx`, con un tope de diez minutos y ' +
      'dentro de una cadena que ya está corriendo con alguien mirándola. Se apaga solo al terminar o ' +
      'al vencer el tope; no es un reloj de fondo, es un `await` con paciencia.',
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

test('TODA pantalla que muestra datos que cambian solos tiene reloj, y cuelga de que esté a la vista', () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * EL DEFECTO INVERSO AL DEL RESTO DEL ARCHIVO, Y COSTÓ MÁS
   *
   * Las otras tres pruebas persiguen relojes de MÁS —sondeos fuera del módulo, que gastan—. Ésta
   * persigue el reloj de MENOS, que no gasta nada y miente.
   *
   * `PanelDeConversation` pedía sus datos UNA vez por carga de página y no volvía a preguntar
   * nunca. Y era peor que «una vez al montar»: `CommandCenter` monta todas las vistas a la vez y
   * cambiar de pantalla es puro CSS, así que tampoco había un remontaje que rescatara la petición.
   * Con el cron escribiendo cada diez minutos, quien dejaba la pestaña abierta a la mañana tomaba
   * decisiones con las cifras de la mañana toda la tarde — sin ninguna señal de que eran viejas.
   *
   * No lo detectaba nada porque un reloj que falta no rompe ninguna prueba: la pantalla dibuja
   * bien, los datos son correctos, y sólo están viejos.
   *
   * ── POR QUÉ ES UNA LISTA A MANO ─────────────────────────────────────────
   *
   * Porque «muestra datos que cambian solos» no se puede derivar del código: Ajustes y Usuarios
   * también leen del servidor y NO deben tener reloj —lo que muestran cambia sólo cuando alguien
   * de este lado lo cambia—. La lista es la declaración de cuáles sí, y agregar una pantalla
   * operativa obliga a pasar por acá, que es el momento de decidirlo.
   * ═══════════════════════════════════════════════════════════════════════════ */
  const CON_RELOJ: readonly { archivo: string; clave: string }[] = [
    { archivo: 'components/views/CloserView.jsx', clave: 'closer' },
    { archivo: 'components/views/SetterView.jsx', clave: 'setter' },
    { archivo: 'components/conversation/PanelDeConversation.jsx', clave: 'conversation' },
  ];

  for (const { archivo, clave } of CON_RELOJ) {
    const fuente = readFileSync(join(RAIZ, archivo), 'utf8');

    assert.match(
      fuente,
      /usarReloj\(/,
      `${archivo} no tiene reloj: muestra datos que el cron cambia solo, así que una pestaña ` +
        'abierta va a mostrar una foto vieja sin decirlo',
    );

    /* Y colgado de `estaALaVista`, no incondicional. Es la otra mitad y la que cuida el bolsillo:
       sin ella el intervalo corre para cualquiera que tenga la sección en su menú, mire o no —
       medido en su momento, 360 llamadas por hora y por empresa sin que nadie abriera la pestaña. */
    assert.match(
      fuente,
      new RegExp(`estaALaVista\\('${clave}'\\)`),
      `${archivo} tiene reloj pero no lo cuelga de \`estaALaVista('${clave}')\`: va a sondear ` +
        'con la pantalla cerrada',
    );

    /* ── Y SE MIRA LA LLAMADA, NO QUE LA CADENA APAREZCA ────────────────────
     *
     * La aserción de arriba comprueba que el archivo CONSULTE la visibilidad, y una mutación la
     * sobrevivió: quitarle la guarda al `usarReloj` deja la constante declarada más arriba, la
     * cadena sigue estando, y la prueba pasa sobre un reloj que ya corre siempre.
     *
     * Lo que de verdad apaga el reloj es que su CLAVE pueda ser nula — `usarReloj` con clave nula
     * no registra nada. Eso es lo que hay que exigir, y sobre la llamada. */
    assert.match(
      fuente,
      /usarReloj\([^,]*\?[^,]*:\s*null\s*,/,
      `${archivo} le pasa a \`usarReloj\` una clave que nunca es nula, así que el reloj corre ` +
        'aunque la pantalla esté cerrada. Es el gasto que `CADENCIA.puntitoDeTools` documenta ' +
        'haber pagado: 180 peticiones por hora desperdiciadas.',
    );

    /* La cadencia sale del catálogo y no de un número escrito al lado. `lib/cadencia.ts` lo dice:
       viven en un solo lugar «para que nadie invente la suya». */
    assert.match(
      fuente,
      /CADENCIA\.[a-zA-Z]+\)/,
      `${archivo} le pasa al reloj un número que no sale de \`CADENCIA\``,
    );
  }
});

test('una RECARGA no vacía la pantalla: el reloj no puede borrar lo que alguien está leyendo', () => {
  /* La trampa de poner un reloj, y es la que convierte el arreglo en un defecto peor.
   *
   * `cargar()` ponía `cargando` y anulaba `pantalla` al fallar. Colgado de un intervalo, eso
   * parpadearía las siete cifras cada minuto y —en un corte de red de un segundo— borraría números
   * correctos mientras alguien los mira. Es la regla que `lib/usarLectura.ts` ya tiene escrita con
   * su factura pagada: *«teniendo datos, la pantalla no se vacía nunca»*.
   *
   * Se comprueba sobre la FORMA de la función, que es lo único que se puede leer estáticamente: la
   * recarga tiene que distinguirse de la primera carga. */
  const fuente = readFileSync(join(RAIZ, 'components/conversation/PanelDeConversation.jsx'), 'utf8');

  assert.match(
    fuente,
    /esRecarga/,
    'la carga no distingue la primera vez de una recarga, así que el reloj va a parpadear la pantalla',
  );
  assert.match(
    fuente,
    /if \(!esRecarga\) setCargando\(true\)/,
    'una recarga pone «cargando» y reemplaza el cuerpo entero, que es el defecto que `usarLectura` ' +
      'documenta haber pagado',
  );
  assert.match(
    fuente,
    /if \(!esRecarga\) setPantalla\(null\)/,
    'una recarga fallida anula la pantalla: un corte de red de un segundo borraría cifras correctas',
  );
});
