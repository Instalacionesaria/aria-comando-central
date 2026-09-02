// El Espía de Anuncios. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PERSIGUE ACÁ
//
// Es un port de ARIA-brain que habla con el MISMO backend de scraping, y ahí está el riesgo: el
// backend acepta dos identidades —`org_id` de Comando Central y `cliente_id` de ARIA-brain— y las
// traduce. O sea que **mandar la identidad equivocada no falla**: `resolver_org` la resuelve, el
// actor corre, y la corrida se le carga al monedero de otra organización. Con un actor de Apify
// del otro lado, eso es plata.
//
// Los otros tres modos de falla, todos silenciosos:
//
//   · El análisis con IA armado en el navegador —como en el hub— dejaría que el navegador elija
//     qué anuncios se analizan. Acá viaja el identificador del trabajo y el servidor lee los
//     anuncios él mismo, con el `org_id` de la sesión.
//   · Analizar una búsqueda sin anuncios manda un prompt con la lista vacía: el modelo inventa
//     patrones de la nada, la salida se ve convincente y la inferencia se pagó.
//   · Resolver la llave con `resolverAccesoAFundaciones` haría que una organización sin vínculo con
//     el hub viera `sin_alumno_vinculado` en una pantalla que no tiene nada que ver con el hub. Ese
//     error ya se pagó una vez en el scraper, hasta la migración 006.
//
// No toca la base ni llama a ningún modelo: lee el código y ejercita las funciones puras.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import {
  ANUNCIOS_QUE_SE_ANALIZAN,
  CARACTERES_POR_ANUNCIO,
  TOKENS_DEL_ANALISIS,
  promptDelAnalisis,
  type AnuncioEspiado,
} from '../../lib/tools/espia.ts';
import { PAISES, PREFIJO_DE_BUSQUEDA } from '../../lib/tools/scrapers.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
/** Sin comentarios: la lección de `110-monitoreo`, ya pagada dos veces en este repositorio. */
const codigo = (r: string): string =>
  leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ─── El arranque: la identidad y la ruta del backend ───────────────────────

test('espiar sale por el proxy del motor, contra `/start-ad-spy`', () => {
  const proxy = codigo('app/api/tools/scrape/route.ts');
  assert.match(proxy, /case 'ad-spy':/, 'la fuente no está en el proxy: la pantalla no puede arrancar');
  assert.match(proxy, /camino: '\/start-ad-spy'/);
  // Los tres campos que el modelo `AdSpyRequest` del backend declara. `count` va explícito y no
  // heredado de su valor por omisión: es el tamaño de una corrida que se cobra.
  assert.match(proxy, /query: String\(p\.query \?\? ''\)/);
  assert.match(proxy, /country: String\(p\.country \?\? 'ALL'\)/);
  assert.match(proxy, /count: Number\(p\.count\) \|\| ANUNCIOS_POR_BUSQUEDA/);
});

test('la identidad que viaja es `org_id`, y sale de la sesión', () => {
  /* EL DEFECTO QUE ESTO IMPIDE, Y QUE NO FALLA. El backend acepta `cliente_id` —la identidad de
     ARIA-brain— y la traduce. Mandarla desde acá, o dejar que el `org_id` llegue del cuerpo de la
     petición, hace que el actor corra igual y se le cargue a otra organización. */
  const proxy = codigo('app/api/tools/scrape/route.ts');

  // La base con `org_id` se arma UNA vez y se derrama a todas las fuentes, incluida ésta: una
  // fuente nueva lo hereda sin que nadie se acuerde de ponerlo.
  assert.match(proxy, /const base = \{ org_id: orgId, timestamp: new Date\(\)\.toISOString\(\) \}/);
  assert.match(proxy, /construirArranque\(\s*String\(cuerpo\.fuente \?\? ''\),\s*cuerpo,\s*contexto\.orgEfectiva,\s*\)/);

  // Y no existe la palabra `cliente_id` en toda la ruta: es la identidad del otro hub.
  assert.ok(!/cliente_id/.test(proxy), 'el proxy manda la identidad de ARIA-brain');
});

test('los países viajan como código ISO, no como el nombre que se lee', () => {
  /* La Meta Ad Library espera `PE`, no `Perú`. Un nombre viaja igual, el actor corre igual y
     devuelve otra cosa —o nada— con la corrida ya pagada. */
  for (const pais of PAISES) {
    assert.match(
      pais.codigo,
      /^(ALL|[A-Z]{2})$/,
      `«${pais.etiqueta}» no viaja como código ISO sino como "${pais.codigo}"`,
    );
  }
  assert.equal(PAISES[0]?.codigo, 'ALL', 'la primera opción tiene que ser «todos los países»');
  assert.ok(PAISES.length > 10, 'la lista del hub se recortó');
});

// ─── El análisis con IA ────────────────────────────────────────────────────

const ANUNCIO = (n: number): AnuncioEspiado => ({
  ad_archive_id: String(n),
  page_name: `Página ${n}`,
  days_active: 100 - n,
  media_type: 'video',
  body_text: `copy del anuncio ${n} `.repeat(80),
});

test('el prompt lleva los PRIMEROS anuncios, que son los más longevos', () => {
  /* No es un recorte arbitrario: el backend los devuelve ordenados por `days_active` descendente,
     así que los primeros son los que llevan más tiempo corriendo — la señal por la que esta
     herramienta existe. Recortar por el otro extremo tiraría justo los que importan. */
  const muchos = Array.from({ length: ANUNCIOS_QUE_SE_ANALIZAN + 15 }, (_, i) => ANUNCIO(i + 1));
  const prompt = promptDelAnalisis(muchos);

  assert.ok(prompt.includes('#1 '), 'el primero no entró');
  assert.ok(prompt.includes(`#${ANUNCIOS_QUE_SE_ANALIZAN} `), 'el último admitido no entró');
  assert.ok(
    !prompt.includes(`#${ANUNCIOS_QUE_SE_ANALIZAN + 1} `),
    'entraron más anuncios de los que el tope permite',
  );
  assert.ok(!prompt.includes(`Página ${ANUNCIOS_QUE_SE_ANALIZAN + 5}`), 'entró uno de más');

  /* Y el copy de cada uno va recortado: un anuncio largo por sesenta es un prompt de decenas de
     miles de tokens por cada clic. Se mide el BLOQUE del primer anuncio —después de la cabecera de
     instrucciones, hasta el segundo— y no el prompt entero, que incluye lo que se le pide al
     modelo. La primera versión de esta prueba medía el prompt entero y fallaba sobre código
     correcto: exactamente la clase de prueba que se termina ignorando. */
  const bloques = (prompt.split('ANUNCIOS:\n')[1] ?? '').split('#2 ');
  assert.ok(
    (bloques[0] ?? '').length < CARACTERES_POR_ANUNCIO + 120,
    'el copy de un anuncio entra entero: el prompt crece sin techo',
  );
});

test('el prompt dice qué se pide y en qué orden llegan los anuncios', () => {
  const prompt = promptDelAnalisis([ANUNCIO(1)]);
  // Lo que el hub pide, palabra por palabra en lo que importa: sin esto el modelo devuelve un
  // resumen genérico en vez de las cuatro secciones que la pantalla espera.
  for (const parte of ['Hooks/ganchos', 'Ofertas y ángulos', 'Estructuras', 'ideas accionables']) {
    assert.ok(prompt.includes(parte), `el prompt no pide «${parte}»`);
  }
  assert.ok(
    prompt.includes('longevidad'),
    'el prompt no le dice al modelo que la lista viene ordenada por longevidad, que es la señal',
  );
  assert.ok(prompt.includes('días activo'), 'los días activos no llegan al modelo');
  assert.ok(TOKENS_DEL_ANALISIS > 0);
});

test('el navegador manda el TRABAJO, no los anuncios', () => {
  /* La regla que `operaciones.ts` ya nombra para Fundaciones: mandarle los datos al navegador para
     que los devuelva es dejar que el navegador elija con qué contexto se genera. El hub arma el
     prompt en el navegador; este port no. */
  const cliente = codigo('lib/tools/scrapers.ts');
  assert.match(cliente, /cuerpo: \{ trabajo \}/, 'el cliente sube algo más que el identificador');
  assert.ok(
    !/anuncios/.test(cliente.split('export async function analizarAnuncios')[1] ?? ''),
    'la función de análisis recibe o manda la lista de anuncios',
  );

  const servidor = codigo('lib/tools/espia.ts');
  // El servidor los lee del backend, con el `org_id` de la sesión: un trabajo de otra organización
  // responde 404 del otro lado, así que conocer el identificador no alcanza.
  assert.match(servidor, /\/job\/\$\{encodeURIComponent\(trabajo\)\}\?org_id=/);
});

test('la pantalla espera el análisis lo que la ruta puede tardar', () => {
  /* La queja ya pagada en Fundaciones: el navegador abortaba a los quince segundos una generación
     que el servidor estaba haciendo bien, y el cartel decía «no se pudo llegar al servidor». Esta
     ruta declara `maxDuration = 300` como las otras, así que su llamador declara la espera larga. */
  const cliente = codigo('lib/tools/scrapers.ts');
  const analisis = cliente.split('export async function analizarAnuncios')[1] ?? '';
  assert.match(analisis, /espera: ESPERA_DE_RUTA_LARGA_MS/);
});

test('una búsqueda sin anuncios NO se manda al modelo', () => {
  /* El prompt saldría con la lista vacía, el modelo inventaría patrones de la nada y el resultado se
     vería igual de convincente — con la inferencia pagada. Misma decisión que `pasoDeResearchListo`:
     la comprobación es del servidor, porque el navegador no es quien decide si hay con qué generar. */
  const servidor = codigo('lib/tools/espia.ts');
  const i = servidor.indexOf('if (leidos.anuncios.length === 0)');
  const j = servidor.indexOf('await generar(');
  assert.ok(i > 0, 'no se comprueba que haya anuncios');
  assert.ok(j > i, 'se llama al modelo antes de comprobar que haya anuncios que analizar');
});

// ─── La ruta ───────────────────────────────────────────────────────────────

test('analizar pide `tools.editar`: gasta tokens de la organización', () => {
  const ruta = codigo('app/api/tools/espia/route.ts');
  assert.match(ruta, /exigir\(peticion, \['tools\.editar'\], PANTALLA\)/);
  assert.match(ruta, /export const PANTALLA = 'tools'/);
  // Y sin backend configurado lo dice, en vez de apuntar en silencio a otro entorno.
  assert.match(ruta, /motor_no_configurado/);
  assert.ok(
    !/SCRAPER_BACKEND_URL\s*\|\|/.test(ruta),
    'la ruta tiene una URL de reserva: un despliegue mal configurado apuntaría a otro backend',
  );
});

test('la llave se resuelve SIN exigir el vínculo con el hub', () => {
  /* `resolverAccesoAFundaciones` exige además `fundaciones_cliente_id`. Reusarla acá haría que una
     organización sin ese vínculo —un cliente High Ticket recién creado— viera `sin_alumno_vinculado`
     al apretar un botón de `tools`. El scraper ya pagó ese error hasta la migración 006. */
  const ruta = codigo('app/api/tools/espia/route.ts');
  assert.match(ruta, /resolverLlaveDeIa\(db, contexto\.orgEfectiva\)/);
  assert.ok(
    !/resolverAccesoAFundaciones/.test(ruta),
    'el Espía exige el vínculo con el hub para analizar',
  );

  const resolver = codigo('lib/credenciales/resolver.ts');
  const i = resolver.indexOf('export async function resolverLlaveDeIa');
  const cuerpo = resolver.slice(i, resolver.indexOf('export', i + 10));
  assert.ok(
    !/fundaciones_cliente_id/.test(cuerpo),
    '`resolverLlaveDeIa` volvió a leer el vínculo con el hub',
  );
  // Y las dos faltas siguen separadas: cargar la llave y revisar la clave maestra son dos acciones.
  assert.ok(cuerpo.includes('sin_llave_de_ia') && cuerpo.includes('llave_de_ia_ilegible'));
});

// ─── La pantalla ───────────────────────────────────────────────────────────

test('el sondeo se retoma al montar: cambiar de pestaña no pierde la búsqueda', () => {
  /* El síntoma que Kevin reportó para el scraper —«si yo me muevo a otra pestaña se pierde el
     avance»— y que se arregló leyendo de la BASE qué hay en vuelo. Esta pantalla nace con esa
     lección aplicada en vez de volver a pagarla. */
  const panel = codigo('components/tools/EspiaDeAnuncios.jsx');
  assert.match(panel, /leerTrabajosEnVuelo\(\)/);
  assert.match(panel, /enVuelo\.find\(\(t\) => t\.fuente === 'ad-spy'\)/, 'retoma trabajos de otra fuente');
  // Y recupera qué se estaba espiando, que el backend guarda con este prefijo.
  assert.match(panel, /PREFIJO_DE_BUSQUEDA/);
  assert.equal(PREFIJO_DE_BUSQUEDA, 'AdSpy: ');
});

test('los dos gastos son dos botones, y sin permiso no se dibujan', () => {
  /* Espiar cuesta una corrida de Apify; analizar cuesta tokens. Encadenarlos haría que cada búsqueda
     pagara las dos cosas. Y el `07` § 4: un control que no puede cumplir no se muestra. */
  const panel = codigo('components/tools/EspiaDeAnuncios.jsx');
  assert.match(panel, /espiarAnuncios\(texto, pais \|\| 'ALL'\)/);
  assert.match(panel, /analizarAnuncios\(trabajo\)/);
  assert.ok(
    (panel.match(/puedeEditar \?/g) || []).length >= 2,
    'algún botón que gasta se dibuja sin comprobar el permiso',
  );

  // La vista recibe el permiso del mismo lugar que los paneles: los permisos de la sesión.
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(armazon, /vistaActiva\.render\(\{ puedeEditar \}\)/);
  const tools = codigo('components/views/ToolsView.jsx');
  assert.match(tools, /clave: 'espia'/);
  assert.match(tools, /<EspiaDeAnuncios puedeEditar=\{puedeEditar\} \/>/);
});
