/* Compara la app contra el prototipo original aios-command-center_1.html.
 *
 *   npm run dev            # en otra terminal
 *   npm run paridad
 *
 * Sirve para reactificar vistas sin romper nada: reescribe un módulo de
 * lib/aios/ como componente React y vuelve a pasar esto. Comprueba tres
 * cosas por vista — forma del DOM, texto e geometría — y luego recorre las
 * capas que sólo aparecen al interactuar.
 *
 * Ruido conocido: los `circle.pulse` del mapa ejecutivo se mueven por una
 * animación SVG, así que su posición nunca coincide. Se descuentan más
 * abajo, y de todos modos `executive` ya salió de la comparación.
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

const ORIGINAL = 'aios-command-center_1.html';
// El puerto es 3100, no 3000: tiene que coincidir con `DOMINIO_ESPERADO` de `.env.local`, y el
// guión `dev` lo fija (ver `package.json`).
//
// ── Y AHORA ESTO NECESITA UNA SESIÓN ────────────────────────────────────────
//
// Desde que `app/page.js` envuelve el centro de mando en `app/guardia.tsx`, un navegador sin
// sesión recibe "Verificando la sesión…" y después una redirección a `/entrar`. O sea que
// TODOS los selectores de abajo fallan, con un error que no dice "falta la sesión" sino
// "no encuentro `#v-executive`".
//
// No se debilita la guarda para que esta comparación ande: la guarda es lo que impide que un
// visitante vea la aplicación. Lo que hay que hacer es entrar primero — con el usuario del
// sembrado, que solo existe en local — y recién después comparar. Está anotado como pendiente
// en `docs/DESPLIEGUE.md`.
const DESTINO = process.env.PARIDAD_URL || 'http://localhost:3100/';

// UNA. Fueron diez; salieron `icp` (Etapa 9), `setter` y `closer` (11), `executive` (el mapa de
// áreas) y las cinco de Inteligencia (la estética de operación). Cada una con su motivo, abajo.
//
// Este comentario decía «NUEVE, no diez» encima de una lista de SEIS: se quedó viejo dos salidas
// atrás. Un número escrito a mano al lado de una lista se desincroniza siempre; lo que lo sostiene
// es `pruebas/codigo/90-fundaciones.test.ts`, que cuenta la lista de verdad y falla si no coincide.
//
// Esta compuerta compara el port contra `aios-command-center_1.html` vista por vista: forma del
// DOM, texto y geometría. Su valor entero depende de que un rojo signifique "se rompió algo", y
// para eso lo que compara tiene que ser lo que se portó SIN cambios.
//
// `icp` dejó de serlo a propósito: era el placeholder "Pendiente de construir" y ahora tiene las
// siete herramientas de Fundaciones, con estado en React. Compararla contra el prototipo daría un
// rojo permanente — y un rojo permanente no se arregla, se ignora, y con él se ignoran los otros
// nueve. Esa es la forma en la que una compuerta muere.
//
// Lo que se pierde, dicho con precisión: esta vista ya no tiene red de seguridad automática. Lo que
// se conserva: las otras nueve siguen comparándose, así que el día que se reactifique una segunda,
// la comparación sigue siendo confiable para las que no cambiaron.
//
// La regla al agregar una vista reactificada: sale de acá, y su motivo se escribe en `docs/ETAPA-N`.
// `setter` y `closer` SALIERON en la Etapa 11, por el mismo motivo que `icp` en la 9: dejaron
// de coincidir con el prototipo A PROPÓSITO. Sus datos ya no son los del maquetado —vienen de
// `negocio.*`— y sus dos menús ya no se muestran a todo el mundo. Compararlas daría un rojo
// permanente, y un rojo permanente no se arregla: se ignora, y con él se ignoran los otros.
//
// ── Y `executive` SALIÓ POR EL MAPA DE ÁREAS ────────────────────────────────
//
// Es la cuarta, y es la primera que sale por un cambio de DISEÑO y no de datos. Se pidió pulir
// el organigrama —*«es la primera parte que se ve al ingresar»*— y el prototipo tenía ahí tres
// cosas que se decidió cambiar: dos colores de línea para cinco conexiones que dicen lo mismo,
// CUATRO puntos animados para cinco líneas, y la línea de Creative en una curva que arrancaba
// dentro de su propia tarjeta.
//
// Las tres divergen del maquetado a propósito, y cada una rompe la comparación por un eje
// distinto: el quinto punto agrega un nodo (la `forma()`), y la recta cambia la caja de `#e3`
// (las `cajas()`). O sea que no hay forma de hacer el cambio y seguir comparando: el prototipo
// dejó de ser la autoridad de esta vista.
//
// **Y no se toca `aios-command-center_1.html` para que dé verde**, que era la salida corta y la
// peor: editar el original para que coincida con el port deja la comparación circular — verde
// siempre, porque las dos mitades las escribimos nosotros el mismo día. El archivo sigue siendo
// el maquetado tal como llegó, y eso es lo que hace que las tres vistas que quedan sirvan.
//
// Lo que reemplaza la red: `pruebas/codigo/120-mapa-ejecutivo.test.ts`, que afirma el cableado
// del mapa —las cinco líneas, un punto por cada una, y la recta calculada desde las
// coordenadas reales de las dos tarjetas— y corre en cada `npm test`, no solo cuando alguien
// levanta el navegador. Los dos pasos de `PASOS` que entran a esta vista se quedan: comparan
// interacción, no la forma del mapa.
//
// ── Y SALEN LAS CINCO DE INTELIGENCIA, POR LA ESTÉTICA DE OPERACIÓN ────────
//
// Es la quinta salida, la más grande —cinco de golpe— y la única que deja la lista en UNA. Se
// llevó `app/operacion-estetica.css` a `acquisition`, `creative`, `conversion`, `conversation` y
// `sales`, así que las cinco dejan de coincidir con el maquetado A PROPÓSITO, por el mismo motivo
// que `icp` en la 9, `setter` y `closer` en la 11, y `executive` con el mapa de áreas.
//
// Conviene escribir CUÁL de las tres comparaciones se rompe con qué, porque "es sólo CSS" suena a
// que se movería la geometría y nada más:
//
//   · `cajas()` — el bloque de tokens de la estética declara su propia `font-family` y un
//     `--radio-tarjeta` sobre el alcance, y `.cre-head` pasa a llevar `padding-bottom` con línea.
//     Otra tipografía mueve TODAS las cajas de la vista, no algunas.
//   · `texto` — se compara `innerText`, que es el texto RENDERIZADO y por lo tanto aplica
//     `text-transform`. La regla `.cre-head h2 { text-transform: uppercase }` hace que el
//     original diga `Creative` y el port diga `CREATIVE`. La divergencia arranca en el carácter
//     CERO de las cinco, por una regla de estilos.
//   · `forma()` — es la única que podría sobrevivir a un cambio de puro CSS, y tampoco: las cinco
//     necesitaron `.stack`, `.ch-title` y `.cl-page` AGREGADAS al marcado para entrar en la hoja,
//     que es lo mismo que necesitó Auditoría.
//
// ── LO QUE SE PIERDE, DICHO CON PRECISIÓN ──────────────────────────────────
//
// Más que en las cuatro salidas anteriores, y no conviene maquillarlo:
//
//   1. `sales` NO tiene módulo en `lib/aios/index.js`: es marcado estático con sus rótulos y sus
//      cifras escritos a mano en el JSX. Esta comparación era lo ÚNICO que leía ese archivo.
//      Desde hoy, borrarle una tarjeta o cambiarle un número no lo nota nadie.
//   2. Las otras cuatro las pintan `acquisition.js`, `creative.js`, `conversion.js` y
//      `conversation.js` con los datos de ejemplo del maquetado. El eje de `texto` era lo único
//      que comprobaba que ese port imperativo siguiera dando los mismos números que el `<script>`
//      original. Queda una rendija: los pasos que miran `#drawer` y `#recoModal` siguen, porque
//      esos nodos viven en `Overlays.jsx` —fuera de toda vista— y no los toca la estética.
//   3. El eje de GEOMETRÍA no se puede reemplazar. Una prueba que lee el fuente no ve una caja.
//      Se pierde y no vuelve.
//
// ── QUEDA UNA, Y ESO PONE A TIRO EL PLAN DE LA ETAPA 0 ─────────────────────
//
// `contacts` sigue porque NO recibe la estética: es del grupo AIOS, no de Inteligencia, y su
// Leads Portal sigue siendo el port literal que pinta `leads-portal.js`.
//
// Y hay que decir lo que ya era cierto antes de este cambio, para que nadie lea esta lista de UNA
// como la pérdida: **esta compuerta hace tiempo que no corre.** No está en
// `.github/workflows/verificar.yml` —que corre `build`, `tipos`, `db:reset` y `test`—, necesita
// los navegadores de Playwright instalados a mano, y desde `app/guardia.tsx` además necesita una
// sesión. Sacar cinco vistas de una compuerta dormida no es perder cobertura: es registrar una
// pérdida que ya había ocurrido.
//
// El día que `contacts` también se reactifique, `VISTAS` queda vacía, y para ese día ya hay
// decisión escrita en `docs/ETAPA-0.md` § «Decisiones registradas ahora»: la compuerta no se
// retira a mano — imprime «retirada» y sale 0. Está implementado abajo.
const VISTAS = ['contacts'];

/* Cada paso deja la página lista para el siguiente, así que el orden importa. */
const PASOS = [
  /* El testigo `.dp` es un nodo de `<body>` que crea `datepicker.js`, así que la estética no lo
   * toca; pero el disparador estaba en `#v-creative`. Se mueve a `contacts` por el mismo motivo
   * que el de abajo: el clic tiene que caer en una vista que no cambió de forma. */
  ['calendario',           p => p.click('#v-contacts [data-datepick]'),          '.dp.on'],
  /* EL TESTIGO DE ESTE PASO SE MUDÓ A `contacts`, y es el único al que la estética obligó.
   * Miraba `#v-creative .cre-stats`, o sea el interior de una vista que acaba de cambiar de
   * forma y de tipografía a propósito: su `innerText` y sus cajas divergen del maquetado desde
   * hoy, así que el paso sería rojo permanente.
   *
   * Lo que afirma —«elegir un rango rápido RECALCULA lo que se muestra»— sigue siendo verdad y
   * sigue siendo comprobable: es el mismo `datepicker.js` y el mismo `period-controls.js`, y
   * `contacts` no recibe la estética. Se mueve ahí en vez de borrarse. */
  ['calendario · 7 días',  async p => { await p.click('.dp-side button[data-q="2"]');
                                        await p.click('.dp-f .go'); },           '#v-contacts .lp-wrap'],
  /* Éste SÍ se queda mirando Creative, y a propósito: `#drawer` vive en `components/Overlays.jsx`
   * —hermano de las vistas, no hijo—, así que la estética no lo alcanza y su contenido se puede
   * seguir comparando contra el maquetado. Es la única rendija que queda para comprobar que
   * `creative.js` sigue dando los mismos datos que el `<script>` original. Ahora hay que navegar
   * a la vista antes de clicar, porque el recorrido ya no empieza ahí. */
  ['drawer de contenido',  async p => { await p.click('.nav-item[data-view="creative"]');
                                        await p.click('#v-creative .cc[data-cre]'); }, '#drawer.on'],
  ['plan de Creative',     async p => { await p.click('#dwClose');
                                        await p.click('#recoBtn'); },            '#recoModal.on'],
  ['plan de Acquisition',  async p => { await p.click('#recoClose');
                                        await p.click('.nav-item[data-view="acquisition"]');
                                        await p.click('#acqPlanBtn'); },         '#recoModal.on'],
  ['ficha de lead',        async p => { await p.click('#recoClose');
                                        await p.click('.nav-item[data-view="contacts"]');
                                        await p.click('#v-contacts .lc'); },     '#drawer.on'],
  ['grupo de contactos',   async p => { await p.click('#dwClose');
                                        await p.click('#v-contacts [data-leads]'); }, '.lg.on'],
  /* LOS TRES PASOS DEL CLOSER SALIERON, y conviene decir por qué en vez de dejarlos rotos.
   *
   * Apuntaban a `#clDia`, `#clNav` y `#cwTabs`: ids del módulo imperativo que se borró en la Etapa
   * 11 por pintar datos inventados. Ninguno de los tres existe desde entonces, o sea que estos
   * pasos venían fallando —o habrían fallado la primera vez que alguien pudiera correr esto— y
   * afirmaban lo contrario de lo que pasaba.
   *
   * No se reescriben contra el DOM nuevo, y es una decisión: la ficha se abre desde una FILA, y una
   * fila existe solo si la organización tiene contactos sincronizados. La base local no los tiene,
   * así que el paso sería rojo en cualquier máquina recién reconstruida — y un rojo permanente no
   * se arregla, se ignora, y con él se ignoran los otros trece.
   *
   * Lo que cubre a la ficha en su lugar: `pruebas/codigo/95-ficha.test.ts` y la verificación en el
   * navegador contra los contactos reales. Y `closer` ya estaba fuera de `VISTAS`, así que su forma
   * nunca se comparó con el prototipo. */
  ['Ask Executive',        async p => { await p.keyboard.press('Escape');
                                        await p.click('#askTrigger'); },         '.ask-panel.on'],
  /* ── DOS PASOS SALEN ACÁ, Y NINGUNO POR LA ESTÉTICA ──────────────────────
   *
   * **EL MENÚ DE USUARIO** era el CUARTO de la tanda de la Etapa 11: a los tres del Closer se les
   * escapó éste. Apuntaba a `#userBtn` y `#userWrap.open`; los dos siguen en el maquetado y
   * ninguno existe en la aplicación desde que el desplegable pasó a `components/MenuDeUsuario.jsx`,
   * que renderiza `.menu-wrap.arriba.open` y maneja su propio estado. `lib/aios/shell.js` cuenta
   * el defecto que obligó a sacarlo de ahí. O sea: el original abre, el port lanza — rojo
   * garantizado, y llevaba así desde la Etapa 11.
   * Lo cubren `12-destino-de-entrada` y `140-boton-de-mi-password`.
   *
   * **EL NODO DEL ORGANIGRAMA** sale por el motivo CONTRARIO, y es el más difícil de defender
   * porque estaba en verde: estaba en verde pase lo que pase. `#deptGraph .node-card` toma el
   * primero en orden de documento, que es `<g className="node-card core">` — el núcleo, que NO
   * lleva `data-node`. El manejador de `lib/aios/executive.js` está enganchado a
   * `#deptGraph [data-node]`, así que ese clic no navega a ninguna parte, y el testigo `.view.on`
   * sigue siendo la vista en la que ya estabas. Un paso llamado «el organigrama navega» que pasa
   * igual si la navegación no existe.
   *
   * No se re-apunta a un `[data-node]`: las cinco áreas del mapa SON las cinco vistas que acaban
   * de salir de `VISTAS`, así que el testigo caería en una pantalla rediseñada. Lo que sí afirma
   * esa navegación, y en `npm test`, es `pruebas/codigo/120-mapa-ejecutivo.test.ts`. */
  ['funnel ejecutivo',     async p => { await p.keyboard.press('Escape');
                                        await p.click('.nav-item[data-view="executive"]');
                                        await p.click('#exMode button[data-m="funnel"]'); }, '#exFunnel'],
];

/* tag + id + clases de cada descendiente, en orden de documento */
function forma(raiz) {
  const out = [];
  (function walk(n) {
    for (const c of n.children) {
      const tag = c.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'link') continue;
      const cls = typeof c.className === 'string' ? c.className : (c.className.baseVal || '');
      out.push(tag + (c.id ? '#' + c.id : '') +
        (cls.trim() ? '.' + cls.trim().split(/\s+/).sort().join('.') : ''));
      walk(c);
    }
  })(raiz);
  return out;
}

function cajas(raiz) {
  const out = [];
  (function walk(n) {
    for (const c of n.children) {
      const r = c.getBoundingClientRect();
      out.push([c.tagName, Math.round(r.x), Math.round(r.y),
                Math.round(r.width), Math.round(r.height)].join(','));
      walk(c);
    }
  })(raiz);
  return out;
}

async function recorrer(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(6000);
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const vistas = {};
  for (const v of VISTAS) {
    await page.click(`.nav-item[data-view="${v}"]`);
    await page.waitForTimeout(450);
    vistas[v] = {
      forma: await page.$eval(`#v-${v}`, forma),
      texto: await page.$eval(`#v-${v}`, e => e.innerText.replace(/\s+/g, ' ').trim()),
      cajas: await page.$eval(`#v-${v}`, cajas),
    };
  }

  /* Se arranca en `contacts` y no en `creative`: los dos primeros pasos se mudaron ahí cuando la
     estética sacó a las cinco de Inteligencia de la comparación. */
  await page.click('.nav-item[data-view="contacts"]');
  await page.waitForTimeout(450);

  const pasos = {};
  for (const [nombre, accion, testigo] of PASOS) {
    try {
      await accion(page);
      await page.waitForTimeout(550);
      pasos[nombre] = {
        abre: await page.$eval(testigo, e => getComputedStyle(e).display !== 'none'),
        texto: await page.$eval(testigo, e => e.innerText.replace(/\s+/g, ' ').trim()),
      };
    } catch (e) {
      pasos[nombre] = { abre: false, error: e.message.split('\n')[0].slice(0, 90) };
    }
  }

  await page.close();
  return { vistas, pasos, errores: [...new Set(errores)] };
}

/* ── EL RETIRO, DECIDIDO EN LA ETAPA 0 Y ESCRITO ACÁ ────────────────────────
 *
 * `docs/ETAPA-0.md` § «Decisiones registradas ahora, implementadas después», punto 1: esta
 * compuerta **no se retira a mano**. Se le van sacando vistas a medida que cada una se
 * reactifica, y el día que no quede ninguna **imprime «retirada» y sale 0**.
 *
 * El motivo de que sea así y no un `rm`: retirar la única compuerta en la misma etapa que
 * construye su reemplazo deja una ventana sin compuerta. Con el guardián, el retiro ocurre solo,
 * en el momento exacto en que la última vista deja de ser comparable, y sin que nadie tenga que
 * acordarse.
 *
 * Y sale 0, no 1: una compuerta agotada no es un fallo. Si saliera 1, el primero que la corra la
 * saca del guión de despliegue por ruidosa, y con ella se va el archivo. */
if (VISTAS.length === 0 && PASOS.length === 0) {
  console.log('paridad: retirada. No queda ninguna vista ni paso que comparar contra ' +
              `${ORIGINAL} — todas se reactificaron, y cada una dejó su motivo en este archivo.`);
  process.exit(0);
}

if (!existsSync(ORIGINAL)) {
  console.error(`No encuentro ${ORIGINAL}: es la referencia contra la que se compara.`);
  process.exit(1);
}

const browser = await chromium.launch();
const orig = await recorrer(browser, pathToFileURL(ORIGINAL).href);
const port = await recorrer(browser, DESTINO);
await browser.close();

let fallos = 0;

console.log('\nVISTAS');
for (const v of VISTAS) {
  const a = orig.vistas[v], b = port.vistas[v];
  const mal = [];
  if (a.forma.join('\n') !== b.forma.join('\n')) mal.push('DOM');
  if (a.texto !== b.texto) mal.push('texto');
  /* los puntos animados del mapa no pueden coincidir: se descuentan.
     ojo, tagName en SVG llega en minúscula, al revés que en HTML */
  const cajasMal = a.cajas.filter((x, i) => x !== b.cajas[i] && !/^circle,/i.test(x));
  if (cajasMal.length) mal.push(`geometría (${cajasMal.length})`);

  if (!mal.length) { console.log(`  ✓ ${v.padEnd(13)} ${a.forma.length} nodos`); continue; }
  fallos++;
  console.log(`  ✗ ${v.padEnd(13)} ${mal.join(' · ')}`);
  const i = a.forma.findIndex((x, k) => x !== b.forma[k]);
  if (i >= 0) console.log(`      nodo #${i}\n        original: ${a.forma[i]}\n        app:      ${b.forma[i]}`);
  if (a.texto !== b.texto) {
    let j = 0; while (j < a.texto.length && a.texto[j] === b.texto[j]) j++;
    console.log(`      texto diverge en ${j}\n        original: …${a.texto.slice(j, j + 110)}\n        app:      …${b.texto.slice(j, j + 110)}`);
  }
  cajasMal.slice(0, 3).forEach(x => {
    const k = a.cajas.indexOf(x);
    console.log(`      caja #${k}\n        original: ${x}\n        app:      ${b.cajas[k]}`);
  });
}

console.log('\nINTERACCIONES');
for (const [nombre] of PASOS) {
  const a = orig.pasos[nombre], b = port.pasos[nombre];
  const igual = a.abre === b.abre && a.texto === b.texto;
  if (!igual) fallos++;
  const nota = x => x.abre ? 'abre' : (x.error ? `NO — ${x.error}` : 'NO');
  console.log(`  ${igual ? '✓' : '✗'} ${nombre.padEnd(22)} original: ${nota(a).padEnd(28)} app: ${nota(b)}`);
  if (!igual && a.texto !== b.texto) {
    console.log(`      original: ${(a.texto || '').slice(0, 130)}`);
    console.log(`      app:      ${(b.texto || '').slice(0, 130)}`);
  }
}

for (const [etq, r] of [['original', orig], ['app', port]]) {
  if (r.errores.length) {
    console.log(`\nERRORES DE CONSOLA (${etq})`);
    r.errores.slice(0, 10).forEach(e => console.log('  ' + e));
  }
}

console.log(fallos ? `\n${fallos} diferencia(s).` : '\nParidad completa con el prototipo.');
process.exit(fallos ? 1 : 0);
