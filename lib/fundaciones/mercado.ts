// La mirada al mercado real del Research: lo que vieron los scrapers, resumido para los pasos 2 al 5.
//
// ═══════════════════════════════════════════════════════════════════════════════
// Pedido de Jorge, transmitido por Kevin (2026-09-10): que el Research «también por dentro ejecute
// los scrapers de Google Maps y Meta, pocos leads, unos 100 como máximo, y que la salida esté como
// contexto del agente conversacional del Research y también se vea en Mis Leads».
//
// ── LO QUE VIAJA AL PROMPT ES EL RESUMEN, NUNCA LOS REGISTROS ───────────────
//
// Cien negocios con nombre, teléfono y dirección son miles de tokens que no le dicen nada al paso 2
// («sus dolores»): lo que le sirve es la FORMA del mercado —cuántos hay, dónde se concentran, cuántos
// no tienen web, qué prometen los anuncios de la competencia—. Los registros completos quedan donde
// siempre, en `aria_cc_scraper_leads`, y «Mis Leads» ya los muestra sin cambios.
//
// ── DE DÓNDE SALEN LOS NÚMEROS, Y POR QUÉ DEL SERVIDOR ──────────────────────
//
// Los leads se leen de la tabla por `trabajo_id`, con el aislamiento por organización que la tabla
// ya tiene; los anuncios, del `results_data` del trabajo del Espía. El navegador manda SOLO los dos
// identificadores de trabajo. Es la misma regla que las salidas del Research: *«se leen del
// ALMACÉN, no del cuerpo de la petición»* — un resumen que viniera del navegador sería un texto
// cualquiera interpolado en cuatro prompts.
// ═══════════════════════════════════════════════════════════════════════════════

/** Lo que Google Maps devolvió, contado. */
export interface MiradaAMaps {
  trabajo: string;
  total: number;
  conWeb: number;
  conEmail: number;
  conTelefono: number;
  /** Las localidades más repetidas, de la más frecuente a la menos. Hasta cinco. */
  ciudades: readonly string[];
  /** Las categorías más repetidas. Hasta cinco. */
  categorias: readonly string[];
  /** Promedio de la calificación de Maps, con un decimal, o `null` si el actor no la trajo. */
  calificacionPromedio: number | null;
}

/** Lo que el Espía de Anuncios devolvió, contado. */
export interface MiradaAAnuncios {
  trabajo: string;
  total: number;
  anunciantes: number;
  /** Textos de anuncios, recortados. Hasta ocho: alcanza para ver qué promete el segmento. */
  muestras: readonly string[];
}

/**
 * Lo que el scraper de páginas de Facebook devolvió, contado. **La misma forma que Maps**, y no por
 * pereza: los dos guardan en `aria_cc_scraper_leads` con las mismas columnas y se cuentan con la
 * misma función. `ciudades` acá suele venir vacío —una página rara vez trae dirección— y la
 * calificación, cuando hay, es la de la página en Facebook.
 */
export type MiradaAPaginas = MiradaAMaps;

export interface MercadoReal {
  /** Qué se buscó: el rubro (el primer segmento del paso 1) y la ubicación (el sexto criterio). */
  rubro: string;
  ubicacion: string;
  /** Cuándo se miró, ISO. */
  miradoEl: string;
  maps: MiradaAMaps | null;
  anuncios: MiradaAAnuncios | null;
  /**
   * Las páginas de Facebook de los anunciantes que el Espía encontró, con sus contactos. Kevin
   * (2026-09-13): *«agregale el scraping de páginas web, también como máximo 100»*. Depende del
   * Espía: sin anuncios no hay páginas, y por eso corre DESPUÉS de él, no en paralelo.
   */
  paginas: MiradaAPaginas | null;
}

/** El tope de negocios por mirada. Kevin: «unos 100 leads de Google Maps como máximo». */
export const TOPE_DE_NEGOCIOS = 100;

/**
 * Cuántos anuncios pide el Espía en la mirada. Eran 60, como en Tools. Son 300 porque de acá salen
 * las páginas de Facebook: medido en SOFIA sobre corridas reales (2026-09-13), de cada diez anuncios
 * salen unas tres páginas distintas, así que con 60 se juntaban unas 20 y con 300 se llega a las
 * 100 del tope. El Espía no descuenta saldo al cliente —solo Apify a la casa—, y Kevin lo aceptó:
 * *«no hay problema si el espía trae 300 anuncios»*.
 */
export const ANUNCIOS_DE_LA_MIRADA = 300;
/**
 * La respuesta explícita de «no quiero buscar negocios reales». La persona la elige en el chat y el
 * agente la anota tal cual; `prepararMercado` la lee como «no quiso» y la mirada se omite sin gasto.
 * Existe para que la ciudad pueda ser exigible ANTES de arrancar sin trabar a quien no la quiere.
 */
export const SIN_DATOS_REALES = /^sin datos reales$/i;

/**
 * Si una ubicación es una REGIÓN y no un lugar buscable.
 *
 * Medido con Allpa (2026-09-13): el agente propuso «Latinoamérica (México, Colombia, Perú, Ecuador,
 * Argentina)» desde el onboarding, Maps la recibió tal cual y Apify contestó `LOCATION NOT FOUND`.
 * Peor: el trabajo quedó en RUNNING y la mirada esperando. Es el mismo actor y la misma llamada que
 * en Tools —ahí funciona porque la persona escribe una ciudad—. Acá la ubicación la propone un
 * modelo, así que se revisa antes de gastar: un paréntesis, dos o más comas, o una palabra de región
 * es «esto no es un lugar», y la mirada se omite diciendo qué poner.
 */
export function esUbicacionAmplia(ubicacion: string): boolean {
  const u = ubicacion.trim().toLowerCase();
  if (u === '') return true;
  if (/[()]/.test(u)) return true;
  // Cuatro partes o más es una lista, no un lugar. Tres pueden ser «Cayma, Arequipa, Perú».
  if (partesDeUbicacion(u).length >= 4) return true;
  if (/\b(y|e|o|u)\b/.test(u) && /,/.test(u)) return true;
  return /latinoam|latam|sudam|suram|centroam|norteam|iberoam|hispanoam|en general|varios pa|toda |todo el|internacional|global|mundial|europa|caribe|regi[oó]n andina/.test(u);
}

/** Las partes de una ubicación separadas por coma, sin vacías. */
export function partesDeUbicacion(ubicacion: string): string[] {
  return ubicacion.split(',').map((p) => p.trim()).filter((p) => p !== '');
}

/**
 * Si una ubicación SIRVE para buscar en Google Maps: concreta y con tres partes —zona o distrito,
 * ciudad, país—, que es lo que el backend exige (`La localización debe tener al menos 3 partes`),
 * igual que en Tools. «Arequipa, Perú» a secas fue el 400 de Allpa (2026-09-13): el actor con una
 * ciudad entera trae lo que quiere de donde quiere, y la regla existe para que los 100 negocios
 * salgan de una zona que la persona eligió.
 */
export function esUbicacionBuscable(ubicacion: string): boolean {
  return !esUbicacionAmplia(ubicacion) && partesDeUbicacion(ubicacion).length >= 3;
}

/**
 * El tope de páginas de Facebook por mirada. Es lo que SÍ gasta: cada página es un lead. Con Maps
 * suman 200, y ésa es la regla de Jorge: *«desgastar como mucho 200 leads en Research»*, para que de
 * los 500 de regalo le queden al menos 300 al cliente. Vale solo acá: en Tools el usuario decide.
 */
export const TOPE_DE_PAGINAS = 100;

/** Cuántos caracteres de cada anuncio entran al resumen. */
const LARGO_DE_MUESTRA = 160;

// ── Lectores tolerantes ──────────────────────────────────────────────────────

function objeto(x: unknown): Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

function texto(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t === '' ? null : t;
}

function entero(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0;
}

function listaDeTextos(x: unknown, tope: number): string[] {
  return Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(0, tope) : [];
}

/** Los N valores más repetidos de una lista, de mayor a menor. */
function masRepetidos(valores: readonly (string | null)[], tope: number): string[] {
  const cuenta = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, tope)
    .map(([v]) => v);
}

/**
 * La localidad de una dirección de Maps: el anteúltimo tramo separado por comas, que es donde el
 * actor pone la ciudad («Calle 5 #12, Bayamón, 00961, Puerto Rico» → «Bayamón»). Con menos de dos
 * tramos se toma el único que hay. Es una heurística y se comporta como tal: devuelve `null` antes
 * que inventar.
 */
export function localidadDe(direccion: string | null): string | null {
  if (!direccion) return null;
  const tramos = direccion
    .split(',')
    .map((t) => t.replace(/\b\d{4,6}\b/g, '').trim())
    .filter(Boolean);
  if (tramos.length === 0) return null;
  if (tramos.length === 1) return tramos[0] ?? null;
  return tramos[tramos.length - 2] ?? null;
}

/** Una fila de `aria_cc_scraper_leads`, con lo que el resumen necesita. */
export interface FilaDeLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  location: string | null;
  category: string | null;
  raw_data: unknown;
}

/** Cuenta los leads de Maps. No lee nombres ni teléfonos: cuenta. */
export function resumirLeads(trabajo: string, filas: readonly FilaDeLead[]): MiradaAMaps {
  const calificaciones: number[] = [];
  for (const f of filas) {
    const crudo = objeto(f.raw_data);
    const c = crudo['totalScore'] ?? crudo['rating'] ?? crudo['score'];
    if (typeof c === 'number' && Number.isFinite(c) && c > 0 && c <= 5) calificaciones.push(c);
  }
  const promedio =
    calificaciones.length > 0
      ? Math.round((calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length) * 10) / 10
      : null;

  return {
    trabajo,
    total: filas.length,
    conWeb: filas.filter((f) => texto(f.website) !== null).length,
    conEmail: filas.filter((f) => texto(f.email) !== null).length,
    conTelefono: filas.filter((f) => texto(f.phone) !== null).length,
    ciudades: masRepetidos(filas.map((f) => localidadDe(texto(f.location))), 5),
    categorias: masRepetidos(filas.map((f) => texto(f.category)), 5),
    calificacionPromedio: promedio,
  };
}

/**
 * Cuenta los anuncios del Espía. `resultados` es lo que quedó en `results_data` del trabajo, y el
 * backend lo ha guardado de tres formas —la lista, `{data: [...]}` y `{results: {data: [...]}}`—,
 * así que se aceptan las tres.
 */
export function resumirAnuncios(trabajo: string, resultados: unknown): MiradaAAnuncios {
  const o = objeto(resultados);
  const lista: unknown[] = Array.isArray(resultados)
    ? resultados
    : Array.isArray(o['data'])
      ? (o['data'] as unknown[])
      : Array.isArray(objeto(o['results'])['data'])
        ? (objeto(o['results'])['data'] as unknown[])
        : [];

  const anunciantes = new Set<string>();
  const muestras: string[] = [];
  let total = 0;
  for (const item of lista) {
    const a = objeto(item);
    const pagina = texto(a['page_name']) ?? texto(a['page_id']);
    /* Una búsqueda sin resultados NO vuelve vacía: el actor devuelve UN ítem con todo en blanco y la
       URL de la búsqueda (Allpa, 2026-09-13: «agencias inmobiliarias franquiciadas» → 1 ítem sin
       página ni texto). Contarlo como anuncio diría «1 anuncio activo» donde hubo cero. */
    const cuerpoCrudo = texto(a['body_text']) ?? texto(a['title']) ?? texto(a['caption']);
    if (!pagina && !cuerpoCrudo && !texto(a['ad_archive_id'])) continue;
    total += 1;
    if (pagina) anunciantes.add(pagina);
    const cuerpo = texto(a['body_text']) ?? texto(a['title']) ?? texto(a['caption']);
    if (cuerpo && muestras.length < 8) {
      const limpio = cuerpo.replace(/\s+/g, ' ');
      muestras.push(limpio.length > LARGO_DE_MUESTRA ? `${limpio.slice(0, LARGO_DE_MUESTRA)}…` : limpio);
    }
  }
  return { trabajo, total, anunciantes: anunciantes.size, muestras };
}

/** El mercado guardado en el documento del Research, o `null` si no hay nada aprovechable. */
export function leerMercado(crudo: unknown): MercadoReal | null {
  const o = objeto(crudo);
  const rubro = texto(o['rubro']);
  const ubicacion = texto(o['ubicacion']);
  if (!rubro || !ubicacion) return null;

  const a = objeto(o['anuncios']);
  const maps = miradaALeads(objeto(o['maps']));
  const paginas = miradaALeads(objeto(o['paginas']));
  const anuncios: MiradaAAnuncios | null = texto(a['trabajo'])
    ? {
        trabajo: texto(a['trabajo']) as string,
        total: entero(a['total']),
        anunciantes: entero(a['anunciantes']),
        muestras: listaDeTextos(a['muestras'], 8),
      }
    : null;

  if (!maps && !anuncios && !paginas) return null;
  return { rubro, ubicacion, miradoEl: texto(o['miradoEl']) ?? '', maps, anuncios, paginas };
}

/** Una mirada contada sobre leads (Maps o páginas de Facebook), leída tolerante. */
function miradaALeads(m: Record<string, unknown>): MiradaAMaps | null {
  if (!texto(m['trabajo'])) return null;
  return {
    trabajo: texto(m['trabajo']) as string,
    total: entero(m['total']),
    conWeb: entero(m['conWeb']),
    conEmail: entero(m['conEmail']),
    conTelefono: entero(m['conTelefono']),
    ciudades: listaDeTextos(m['ciudades'], 5),
    categorias: listaDeTextos(m['categorias'], 5),
    calificacionPromedio:
      typeof m['calificacionPromedio'] === 'number' && Number.isFinite(m['calificacionPromedio'])
        ? m['calificacionPromedio']
        : null,
  };
}

/**
 * El mercado como texto para los pasos 2 al 5 y para el agente. Dice de dónde sale cada número para
 * que el agente lo pueda citar («lo saqué de la mirada al mercado real de tu Research»).
 */
export function contextoDeMercado(m: MercadoReal | null): string | null {
  if (!m) return null;
  const lineas: string[] = [
    `LO QUE SE VIO EN EL MERCADO REAL (scrapers de Comando Central, sobre «${m.rubro}» en ${m.ubicacion}; ` +
      'son datos observados, no estimados — usalos y citalos como tales):',
  ];
  if (m.maps) {
    const x = m.maps;
    lineas.push(
      `Google Maps: ${x.total} negocios encontrados · ${x.conWeb} con sitio web · ${x.conEmail} con correo visible · ` +
        `${x.conTelefono} con teléfono` +
        (x.calificacionPromedio !== null ? ` · calificación promedio ${x.calificacionPromedio}` : ''),
    );
    if (x.ciudades.length > 0) lineas.push(`Concentrados en: ${x.ciudades.join(', ')}`);
    if (x.categorias.length > 0) lineas.push(`Categorías más frecuentes: ${x.categorias.join(', ')}`);
    if (x.total > 0) {
      const sinWeb = x.total - x.conWeb;
      lineas.push(`Sin sitio web propio: ${sinWeb} de ${x.total} (${Math.round((sinWeb / x.total) * 100)}%)`);
    }
    lineas.push('Los negocios completos están en Tools → Mis Leads.');
  }
  if (m.anuncios) {
    const a = m.anuncios;
    lineas.push(`Anuncios activos del segmento (Espía de Anuncios): ${a.total}, de ${a.anunciantes} anunciantes.`);
    if (a.muestras.length > 0) {
      lineas.push('Qué prometen (muestras):');
      for (const s of a.muestras) lineas.push(`  · ${s}`);
    }
  }
  if (m.paginas) {
    const p = m.paginas;
    lineas.push(
      `Páginas de Facebook de esos anunciantes (con sus contactos): ${p.total} · ${p.conTelefono} con teléfono · ` +
        `${p.conEmail} con correo · ${p.conWeb} con sitio web` +
        (p.calificacionPromedio !== null ? ` · calificación promedio en Facebook ${p.calificacionPromedio}` : ''),
    );
    if (p.categorias.length > 0) lineas.push(`Cómo se describen: ${p.categorias.join(', ')}`);
    lineas.push('Las páginas completas están en Tools → Mis Leads.');
  }
  return lineas.join('\n');
}
