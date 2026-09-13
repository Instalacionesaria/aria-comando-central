// El Research sale a mirar el mercado real: Google Maps y el Espía entre el paso 1 y el 2.
//
// ═══════════════════════════════════════════════════════════════════════════════
// Pedido de Jorge, transmitido por Kevin (2026-09-10), aprobado sobre mockup con cuatro decisiones:
// se dispara DESPUÉS del paso 1, pide confirmación una vez porque gasta saldo, Facebook páginas
// queda para después, y sin saldo o sin ubicación el Research sigue y lo dice.
//
// Cada tramo se rompe en silencio: un resumen que no llega al prompt deja los pasos 2 al 5 igual que
// antes; un `guardarResearch` que olvide `mercado` lo borra en el paso siguiente; una ruta que lea
// los números del cuerpo deja que el navegador escriba cuatro prompts.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { ARCHIVOS_AUTORIZADOS } from '../apoyo/autorizados.ts';
import {
  ANUNCIOS_DE_LA_MIRADA,
  TOPE_DE_NEGOCIOS,
  TOPE_DE_PAGINAS,
  esUbicacionAmplia,
  contextoDeMercado,
  leerMercado,
  localidadDe,
  resumirAnuncios,
  resumirLeads,
  type MercadoReal,
} from '../../lib/fundaciones/mercado.ts';
import { estadoVacio } from '../../lib/fundaciones/estado.ts';
import { armarPromptResearch, datosDe } from '../../lib/fundaciones/prompts.ts';
import { contextoHeredado, instruccionesDeRelleno } from '../../lib/fundaciones/relleno.ts';
import { arranca, faltanAntesDeArrancar, instruccionesDeEntrevista, mensajeDeAperturaConPropuesta } from '../../lib/fundaciones/conversacion.ts';
import { FUNDACIONES } from '../../lib/fundaciones/herramientas.ts';
import { camposDe } from '../../lib/fundaciones/campos.ts';

const codigo = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

const LEADS = [
  { name: 'Dental Sonrisa', email: 'hola@sonrisa.pr', phone: '787-1', website: 'https://sonrisa.pr', location: 'Calle 5 #12, Bayamón, 00961, Puerto Rico', category: 'Clínica dental', raw_data: { totalScore: 4.6 } },
  { name: 'Clínica Norte', email: null, phone: '787-2', website: null, location: 'Av. Ponce de León, San Juan, 00907, Puerto Rico', category: 'Dentista', raw_data: { totalScore: 4.0 } },
  { name: 'Odonto Plus', email: null, phone: null, website: 'https://odonto.pr', location: 'Carr. 2, Bayamón, Puerto Rico', category: 'Clínica dental', raw_data: {} },
];

const ANUNCIOS = {
  data: [
    { page_name: 'Dental Sonrisa', body_text: 'Blanqueamiento con financiamiento en 12 cuotas. ' + 'x'.repeat(200) },
    { page_name: 'Dental Sonrisa', title: 'Primera consulta gratis' },
    { page_id: '99', caption: 'Implantes en un día' },
    { page_name: 'Sin texto' },
  ],
};

/* Páginas de Facebook: lo que el backend guarda en la misma tabla que Maps, con `source: facebook`.
   Una página rara vez trae dirección, así que `location` va vacío. */
const PAGINAS = [
  { name: 'Estética Bella', email: 'info@bella.pe', phone: '+51 9', website: 'https://bella.pe', location: null, category: 'Clínica estética', raw_data: { rating: 4.8 } },
  { name: 'Derma Lima', email: null, phone: '+51 8', website: null, location: null, category: 'Clínica estética', raw_data: { rating: 4.4 } },
];

function conMercado(): ReturnType<typeof estadoVacio> {
  const estado = estadoVacio();
  estado.researchMercado = {
    rubro: 'clínicas dentales',
    ubicacion: 'Puerto Rico',
    miradoEl: '2026-09-10T18:00:00Z',
    maps: resumirLeads('t-maps', LEADS),
    anuncios: resumirAnuncios('t-espia', ANUNCIOS),
    paginas: resumirLeads('t-paginas', PAGINAS),
  };
  return estado;
}

test('el sexto criterio existe, es opcional, y el Research corre igual sin él', () => {
  const research = FUNDACIONES.find((h) => h.id === 1);
  assert.ok(research);
  const campo = camposDe(research).find((c) => c.id === 'mr-location');
  assert.ok(campo, 'falta el criterio de ubicación');
  assert.equal(campo.opcional, true, 'la ubicación bloquea el Research: tiene que ser opcional');
  assert.match(campo.etiqueta, /\(opcional\)/);
  // Y los pasos siguen siendo cinco: la mirada NO es un paso del método.
  assert.equal(codigo('components/fundaciones/PanelResearch.jsx').match(/^const TITULOS = \[[\s\S]*?\];/m)?.[0].split('\n').length, 7);
});

test('los leads se CUENTAN: web, correo, teléfono, ciudades, categorías y calificación', () => {
  const m = resumirLeads('t-maps', LEADS);
  assert.equal(m.total, 3);
  assert.equal(m.conWeb, 2);
  assert.equal(m.conEmail, 1);
  assert.equal(m.conTelefono, 2);
  assert.deepEqual(m.ciudades, ['Bayamón', 'San Juan']);
  assert.deepEqual(m.categorias, ['Clínica dental', 'Dentista']);
  assert.equal(m.calificacionPromedio, 4.3);
  // Nada del lead viaja: ni nombre, ni teléfono, ni correo.
  assert.ok(!JSON.stringify(m).includes('787-1') && !JSON.stringify(m).includes('hola@sonrisa.pr'));

  assert.equal(localidadDe('Calle 5 #12, Bayamón, 00961, Puerto Rico'), 'Bayamón');
  assert.equal(localidadDe('Lima'), 'Lima');
  assert.equal(localidadDe(null), null);
});

test('los anuncios se cuentan en sus tres formas de guardado, con muestras recortadas', () => {
  for (const forma of [ANUNCIOS, ANUNCIOS.data, { results: ANUNCIOS }]) {
    const a = resumirAnuncios('t-espia', forma);
    assert.equal(a.total, 4, 'no reconoció esta forma de results_data');
    assert.equal(a.anunciantes, 3);
    assert.equal(a.muestras.length, 3, 'el anuncio sin texto entró como muestra');
    assert.ok((a.muestras[0]?.length ?? 0) <= 161 && a.muestras[0]?.endsWith('…'), 'la muestra larga no se recortó');
  }
  assert.equal(resumirAnuncios('t', null).total, 0);
});

test('el contexto dice que son datos OBSERVADOS, y llega a los pasos 2 al 5 y al agente, no al 1', () => {
  const estado = conMercado();
  const texto = contextoDeMercado(estado.researchMercado);
  assert.ok(texto);
  assert.match(texto, /MERCADO REAL/);
  assert.match(texto, /datos observados, no estimados/);
  assert.match(texto, /3 negocios encontrados · 2 con sitio web · 1 con correo/);
  assert.match(texto, /Concentrados en: Bayamón, San Juan/);
  assert.match(texto, /Sin sitio web propio: 1 de 3 \(33%\)/);
  assert.match(texto, /Mis Leads/);
  assert.match(texto, /Anuncios activos del segmento .*: 4, de 3 anunciantes/);
  // Y las páginas de Facebook, contadas igual que Maps y con su propia línea.
  assert.match(texto, /Páginas de Facebook de esos anunciantes .*: 2 · 2 con teléfono · 1 con correo · 1 con sitio web · calificación promedio en Facebook 4\.6/);

  const inputs = { niche: 'salud', buyers: '50,000+', ltv: '$3,000+', contract: '', experience: 'x', location: 'Puerto Rico' };
  const previas = ['P1', 'P2', 'P3', 'P4'];
  // Paso 1 NO: la mirada ocurre después de él.
  assert.doesNotMatch(armarPromptResearch(0, inputs, [], estado), /MERCADO REAL/);
  for (const paso of [1, 2, 3, 4]) {
    const prompt = armarPromptResearch(paso, inputs, previas.slice(0, paso), estado);
    assert.match(prompt, /MERCADO REAL/, `el paso ${paso + 1} no recibió la mirada`);
    assert.match(prompt, /USA ESOS DATOS OBSERVADOS/);
    assert.doesNotMatch(prompt, /\{\{[\w.#^/]+\}\}/);
  }
  // Sin mirada, ni el rótulo ni un hueco.
  const sin = armarPromptResearch(1, inputs, ['P1'], estadoVacio());
  assert.doesNotMatch(sin, /MERCADO REAL|USA ESOS DATOS/);
  assert.doesNotMatch(sin, /\{\{[\w.#^/]+\}\}/);

  // El agente lee lo mismo que los prompts.
  const research = FUNDACIONES.find((h) => h.id === 1)!;
  assert.match(contextoHeredado(research, estado), /MERCADO REAL/);
  assert.equal(typeof datosDe(1, {}, estado)['_mercadoContext'], 'string');
});

test('la mirada se lee tolerante y se conserva al guardar los pasos', () => {
  const m: MercadoReal = conMercado().researchMercado!;
  const vuelta = leerMercado(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(vuelta, m);
  for (const basura of [null, {}, { rubro: 'x' }, { rubro: 'x', ubicacion: 'y' }, 'texto']) {
    assert.equal(leerMercado(basura), null);
  }

  const almacen = sinComentarios(codigo('lib/fundaciones/almacen.ts'));
  assert.match(almacen, /estado\.researchMercado = leerMercado\(research\['mercado'\]\)/);
  // `guardarResearch` escribe `mercado` SIEMPRE: si lo omitiera, cada paso borraría la mirada.
  assert.match(almacen, /outputs: salidas, mercado \}/, 'guardarResearch dejó de escribir la mirada');
  const operaciones = sinComentarios(codigo('lib/fundaciones/operaciones.ts'));
  const llamadas = operaciones.match(/guardarResearch\([\s\S]*?\);/g) ?? [];
  assert.ok(llamadas.length >= 2);
  for (const l of llamadas) assert.match(l, /researchMercado/, `una llamada a guardarResearch no pasa la mirada: ${l}`);
});

test('una región no es un lugar: la mirada se omite ANTES de gastar y dice qué poner', () => {
  /* Allpa (2026-09-13): el agente propuso «Latinoamérica (México, Colombia, Perú, Ecuador, Argentina)»,
     Maps la recibió tal cual y Apify contestó LOCATION NOT FOUND. Es el mismo actor que en Tools;
     la diferencia es que acá la ubicación la propone un modelo, así que se revisa. */
  for (const amplia of [
    'Latinoamérica (México, Colombia, Perú, Ecuador, Argentina)',
    'Latinoamérica en general',
    'LATAM',
    'México, Colombia y Perú',
    'Perú, Chile, Argentina',
    'Toda Europa',
    '',
  ]) {
    assert.equal(esUbicacionAmplia(amplia), true, `«${amplia}» tendría que ser amplia`);
  }
  for (const concreta of ['Lima, Perú', 'Puerto Rico', 'Ciudad de México', 'San Juan, Puerto Rico', 'Bogotá', 'Miami, FL']) {
    assert.equal(esUbicacionAmplia(concreta), false, `«${concreta}» tendría que servir`);
  }
  const operaciones = sinComentarios(codigo('lib/fundaciones/operaciones.ts'));
  assert.match(operaciones, /if \(esUbicacionAmplia\(ubicacion\)\)[\s\S]*?motivo: 'ubicacion_amplia', ubicacion/);
  // El rubro se pide como CATEGORÍA, sin los adjetivos que lo vuelven un desierto para buscar.
  assert.match(operaciones, /SIN los adjetivos que acotan el segmento/);
  assert.match(operaciones, /«agencias inmobiliarias franquiciadas» se devuelve como/);
  assert.match(operaciones, /nada de «franquiciadas», «premium», «boutique»/);
  // El panel lo explica y dice qué criterio cambiar; el criterio pide una CIUDAD.
  const panel = codigo('components/fundaciones/PanelResearch.jsx');
  assert.match(panel, /ubicacion_amplia: `«\$\{mirada\.ubicacion \|\| 'la ubicación'\}» es una región/);
  const research = FUNDACIONES.find((h) => h.id === 1)!;
  const criterio = camposDe(research).find((c) => c.id === 'mr-location')!;
  assert.match(criterio.etiqueta, /ciudad/i);

  // Y una búsqueda del Espía sin resultados es CERO anuncios, no uno: el actor devuelve un ítem vacío.
  const vacio = resumirAnuncios('t', { data: [{ title: '', page_name: '', page_id: null, body_text: '', ad_library_url: 'https://…' }] });
  assert.equal(vacio.total, 0);
  assert.equal(vacio.anunciantes, 0);
});

test('la ciudad se resuelve EN EL CHAT antes de arrancar: recomienda el país de la persona y dice dónde quedan los leads', () => {
  /* Kevin (2026-09-13): «eso de la región debería aparecer previamente, en el chat, y recomendarle
     comenzar haciendo scrapeo desde su país… si no lo tenemos claro, que nos diga por cuál país le
     gustaría empezar… y luego le indicas dónde podrá encontrar los leads (Mis Leads)». */
  const research = FUNDACIONES.find((h) => h.id === 1)!;
  const ciudad = camposDe(research).find((c) => c.id === 'mr-location')!;
  assert.equal(ciudad.pedirAntesDeGenerar, true);
  assert.ok(ciudad.guia);
  assert.match(ciudad.guia, /NUNCA una región de varios países ni «Latinoamérica»/);
  assert.match(ciudad.guia, /empezar por SU país/);
  assert.match(ciudad.guia, /con qué país quiere empezar a extraer leads/);
  assert.match(ciudad.guia, /hasta 100 negocios, que quedan en Tools → Mis Leads/);
  assert.match(ciudad.guia, /en esta misma pestaña cuando termine el Research/);

  // La guía llega al agente Y al relleno: los dos la leen del catálogo.
  const entrevista = instruccionesDeEntrevista(research, {}, '');
  assert.match(entrevista, /CÓMO TRATARLA: Tiene que ser un lugar concreto/);
  assert.match(entrevista, /OPCIONAL, PERO SE PREGUNTA/);
  assert.match(instruccionesDeRelleno(research, 'contexto'), /Cómo tratarla: Tiene que ser un lugar concreto/);

  // Sin ciudad, «Continuar al paso 2» NO arranca solo: la apertura la pide. Con ciudad, sí.
  const sinCiudad = { niche: 'inmobiliarias', ltv: '$3,000+', experience: 'x' };
  assert.equal(faltanAntesDeArrancar(research, sinCiudad), true);
  assert.equal(faltanAntesDeArrancar(research, { ...sinCiudad, location: 'Lima, Perú' }), false);
  assert.match(mensajeDeAperturaConPropuesta(research, sinCiudad, {}), /Me falta: .*¿En qué ciudad buscar negocios reales\? \(opcional\)/);
  const operaciones = sinComentarios(codigo('lib/fundaciones/operaciones.ts'));
  assert.match(operaciones, /!faltanObligatorias\(h, chat\.answers\) &&\s*!faltanAntesDeArrancar\(h, chat\.answers\)/);
  // Pero sigue siendo opcional para GENERAR: si la persona dice «seguí sin ciudad», se genera.
  assert.equal(ciudad.opcional, true);

  /* Y una región GUARDADA cuenta como vacía. Allpa, segunda vez: la ubicación «Latinoamérica (…)»
     venía de la conversación anterior, la regla solo miraba las vacías, y el Research arrancó sin
     preguntar nada. Ahora el agente la ve marcada, la apertura la pide, y el arranque no la cuenta. */
  const conRegion = { ...sinCiudad, location: 'Latinoamérica (México, Colombia, Perú, Ecuador, Argentina)' };
  assert.equal(faltanAntesDeArrancar(research, conRegion), true);
  assert.match(instruccionesDeEntrevista(research, conRegion, ''), /Latinoamérica \(México[^\n]*← NO VALE como respuesta/);
  const apertura = mensajeDeAperturaConPropuesta(research, conRegion, {});
  assert.match(apertura, /Me falta: .*¿En qué ciudad buscar negocios reales\?/);
  assert.doesNotMatch(apertura, /· ¿En qué ciudad buscar negocios reales\? \(opcional\) Latinoamérica/);

  /* Tercera vez: «ejecuta de nuevo el research por favor» → el modelo puso `listo` con la región y el
     Research corrió. Ahora el SERVIDOR no arranca sin ciudad válida, aunque el modelo diga listo; la
     salida explícita es «sin datos reales», que sí arranca y la mirada lee como «no quiso». */
  const turno = (respuestas: Record<string, string>) => ({ mensaje: 'Dale, arranco.', respuestas, listo: true });
  assert.equal(arranca(research, turno(conRegion), conRegion), false, 'arrancó con una región como ciudad');
  assert.equal(arranca(research, turno(sinCiudad), sinCiudad), false, 'arrancó sin ciudad, sin que la persona lo decidiera');
  const sinDatos = { ...sinCiudad, location: 'sin datos reales' };
  assert.equal(arranca(research, turno(sinDatos), sinDatos), true, 'la salida explícita no arranca');
  const conLima = { ...sinCiudad, location: 'Lima, Perú' };
  assert.equal(arranca(research, turno(conLima), conLima), true);
  assert.match(instruccionesDeEntrevista(research, conRegion, ''), /0\. Si una pregunta marcada «OPCIONAL, PERO SE PREGUNTA» está vacía o NO VALE, todavía no se termina/);
  assert.match(ciudad.guia!, /anotá exactamente «sin datos reales»/);
  const operacionesB = sinComentarios(codigo('lib/fundaciones/operaciones.ts'));
  assert.match(operacionesB, /if \(SIN_DATOS_REALES\.test\(ubicacion\)\)[\s\S]*?motivo: 'no_quiso'/);
});

test('las dos puntas del servidor: preparar pide el rubro al modelo; resumir cuenta desde la BASE', () => {
  const operaciones = sinComentarios(codigo('lib/fundaciones/operaciones.ts'));
  // Preparar: la ubicación es el sexto criterio; el rubro sale del paso 1 y cae al nicho.
  assert.match(operaciones, /motivo: 'sin_ubicacion'/);
  assert.match(operaciones, /motivo: 'sin_paso_1'/);
  assert.match(operaciones, /rubroDelSegmento\(acceso\.claveIa, paso1/);
  assert.equal(TOPE_DE_NEGOCIOS, 100, 'Kevin: «unos 100 leads como máximo»');
  /* Jorge, vía Kevin (2026-09-13): Research gasta como mucho 200 leads —100 de Maps y 100 de
     páginas de Facebook— para que de los 500 de regalo queden al menos 300. Y el Espía pide 300
     anuncios porque de cada diez salen unas tres páginas: con 60 no se llegaba a 100. */
  assert.equal(TOPE_DE_PAGINAS, 100, 'Jorge: como mucho 100 leads de páginas de Facebook en Research');
  assert.equal(TOPE_DE_NEGOCIOS + TOPE_DE_PAGINAS, 200, 'Jorge: Research gasta como mucho 200 leads');
  assert.equal(ANUNCIOS_DE_LA_MIRADA, 300, 'con menos anuncios no se juntan 100 anunciantes con página');
  assert.match(operaciones, /topeDePaginas: TOPE_DE_PAGINAS/);

  // Resumir: los números salen de las tablas por identificador, dentro del contexto de la organización.
  assert.match(operaciones, /selectFrom\('public\.aria_cc_scraper_leads'\)[\s\S]*?where\('trabajo_id', '=', trabajoMaps\)/);
  assert.match(operaciones, /selectFrom\('public\.aria_cc_scraper_trabajos'\)[\s\S]*?select\(\['id', 'results_data'\]\)/);
  assert.match(operaciones, /selectFrom\('public\.aria_cc_scraper_leads'\)[\s\S]*?where\('trabajo_id', '=', trabajoPaginas\)/);
  assert.ok(!/cuerpo\.(total|conWeb|muestras|leads)/.test(operaciones), 'el resumen viene del navegador');

  const preparar = sinComentarios(codigo('app/api/fundaciones/mercado/preparar/route.ts'));
  assert.match(preparar, /exigir\(peticion, \['fundaciones\.editar'\], PANTALLA\)/);
  assert.match(preparar, /resolverAccesoAFundaciones\(db, contexto\.orgEfectiva\)/);
  assert.match(preparar, /maxDuration = 300/);
  assert.ok(ARCHIVOS_AUTORIZADOS.includes('app/api/fundaciones/mercado/preparar/route.ts'));

  const resumir = sinComentarios(codigo('app/api/fundaciones/mercado/route.ts'));
  assert.match(resumir, /exigir\(peticion, \['fundaciones\.editar'\], PANTALLA\)/);
  assert.match(resumir, /conOrganizacion\(contexto\.orgEfectiva, \(\) => resumirMercado\(peticion, alumno\)\)/);
  assert.ok(!/conIdentidad/.test(resumir));
});

test('el panel: después del paso 1, confirma una vez, arranca los dos scrapers y sigue aunque no haya saldo', () => {
  const panel = codigo('components/fundaciones/PanelResearch.jsx');
  const limpio = sinComentarios(panel);
  // Entre el 1 y el 2, no antes ni después.
  assert.match(limpio, /if \(paso === 0\) await mirarElMercado\(v\);/);
  // Sin ubicación no se mira. Sin rutas (Tools) tampoco.
  assert.match(limpio, /if \(!rutaMercado \|\| !rutaMercadoPreparar \|\| ubicacion === ''\) return;/);
  // La confirmación es un `await`: la cadena espera al botón.
  assert.match(limpio, /const si = await esperarDecision\(\);/);
  assert.match(panel, /Sí, buscar hasta \{mirada\.tope \+ mirada\.topePaginas\} negocios/);
  assert.match(panel, /Descuenta hasta \{mirada\.tope \+ mirada\.topePaginas\} leads de tu saldo/);
  assert.match(panel, /Seguir sin datos reales/);
  // Los dos scrapers con las funciones de Tools, Maps con el tope y el Espía sin saldo.
  assert.match(limpio, /iniciarScraping\('maps', \{ businessType: rubro, location: ubicacion, maxLeads: topeDeNegocios/);
  assert.match(limpio, /iniciarScraping\('ad-spy', \{ query: rubro/);
  /* Las páginas de Facebook, DESPUÉS del Espía y con el tope: el scraper de páginas recibe URLs,
     y las URLs son las de los anunciantes que el Espía trajo. Es lo que gasta, y por eso se recorta
     al tope antes de arrancar. En Tools no hay tope: ahí el usuario decide. */
  assert.match(limpio, /anunciantesDe\([\s\S]*?\.filter\(\(a\) => a\.page_profile_uri\)[\s\S]*?\.slice\(0, topeDePaginas\)/);
  assert.match(limpio, /iniciarScraping\('facebook-pages', \{[\s\S]*?pages: conPagina\.map/);
  assert.match(limpio, /trabajoPaginas: paginas\.tipo === 'trabajo' \? paginas\.id : null/);
  assert.match(panel, /Páginas de Facebook/);
  assert.ok(!/TOPE_DE_PAGINAS|topeDePaginas/.test(codigo('components/tools/Scraper.jsx')), 'el tope de Research se metió en Tools');
  // Si ninguno arrancó (sin saldo, sin permiso), la cadena SIGUE: `omitida`, no `return` de la cadena.
  assert.match(limpio, /motivo: 'sin_saldo'/);
  assert.match(panel, /El Research sigue con lo que el modelo sabe/);
  // La mirada se dibuja pegada al paso 2 (índice 1), con su propio componente.
  assert.match(limpio, /paso === 1 && mirada \? <Mirada/);
  assert.match(panel, /Los \$\{x\.total\} negocios y las \$\{p\.total\} páginas están en Tools → Mis Leads/);
  // Y solo ICP & Oferta pasa las rutas.
  assert.match(codigo('components/fundaciones/Fundaciones.jsx'), /rutaMercadoPreparar: '\/api\/fundaciones\/mercado\/preparar'/);
  assert.ok(!/rutaMercado/.test(codigo('components/views/ToolsView.jsx')));
});
