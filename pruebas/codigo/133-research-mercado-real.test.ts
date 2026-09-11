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
  contextoDeMercado,
  leerMercado,
  localidadDe,
  resumirAnuncios,
  resumirLeads,
  type MercadoReal,
} from '../../lib/fundaciones/mercado.ts';
import { estadoVacio } from '../../lib/fundaciones/estado.ts';
import { armarPromptResearch, datosDe } from '../../lib/fundaciones/prompts.ts';
import { contextoHeredado } from '../../lib/fundaciones/relleno.ts';
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

function conMercado(): ReturnType<typeof estadoVacio> {
  const estado = estadoVacio();
  estado.researchMercado = {
    rubro: 'clínicas dentales',
    ubicacion: 'Puerto Rico',
    miradoEl: '2026-09-10T18:00:00Z',
    maps: resumirLeads('t-maps', LEADS),
    anuncios: resumirAnuncios('t-espia', ANUNCIOS),
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

test('las dos puntas del servidor: preparar pide el rubro al modelo; resumir cuenta desde la BASE', () => {
  const operaciones = sinComentarios(codigo('lib/fundaciones/operaciones.ts'));
  // Preparar: la ubicación es el sexto criterio; el rubro sale del paso 1 y cae al nicho.
  assert.match(operaciones, /motivo: 'sin_ubicacion'/);
  assert.match(operaciones, /motivo: 'sin_paso_1'/);
  assert.match(operaciones, /rubroDelSegmento\(acceso\.claveIa, paso1/);
  assert.equal(TOPE_DE_NEGOCIOS, 100, 'Kevin: «unos 100 leads como máximo»');
  assert.ok(ANUNCIOS_DE_LA_MIRADA > 0);

  // Resumir: los números salen de las tablas por identificador, dentro del contexto de la organización.
  assert.match(operaciones, /selectFrom\('public\.aria_cc_scraper_leads'\)[\s\S]*?where\('trabajo_id', '=', trabajoMaps\)/);
  assert.match(operaciones, /selectFrom\('public\.aria_cc_scraper_trabajos'\)[\s\S]*?select\(\['id', 'results_data'\]\)/);
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
  assert.match(panel, /Sí, buscar \{mirada\.tope\} negocios/);
  assert.match(panel, /Seguir sin datos reales/);
  // Los dos scrapers con las funciones de Tools, Maps con el tope y el Espía sin saldo.
  assert.match(limpio, /iniciarScraping\('maps', \{ businessType: rubro, location: ubicacion, maxLeads: topeDeNegocios/);
  assert.match(limpio, /iniciarScraping\('ad-spy', \{ query: rubro/);
  // Si ninguno arrancó (sin saldo, sin permiso), la cadena SIGUE: `omitida`, no `return` de la cadena.
  assert.match(limpio, /motivo: 'sin_saldo'/);
  assert.match(panel, /El Research sigue con lo que el modelo sabe/);
  // La mirada se dibuja pegada al paso 2 (índice 1), con su propio componente.
  assert.match(limpio, /paso === 1 && mirada \? <Mirada/);
  assert.match(panel, /Los \{x\.total\} negocios están en Tools → Mis Leads/);
  // Y solo ICP & Oferta pasa las rutas.
  assert.match(codigo('components/fundaciones/Fundaciones.jsx'), /rutaMercadoPreparar: '\/api\/fundaciones\/mercado\/preparar'/);
  assert.ok(!/rutaMercado/.test(codigo('components/views/ToolsView.jsx')));
});
