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

export interface MercadoReal {
  /** Qué se buscó: el rubro (el primer segmento del paso 1) y la ubicación (el sexto criterio). */
  rubro: string;
  ubicacion: string;
  /** Cuándo se miró, ISO. */
  miradoEl: string;
  maps: MiradaAMaps | null;
  anuncios: MiradaAAnuncios | null;
}

/** El tope de negocios por mirada. Kevin: «unos 100 leads de Google Maps como máximo». */
export const TOPE_DE_NEGOCIOS = 100;

/** Cuántos anuncios pide el Espía en la mirada. Igual que la pantalla Tools: una corrida del actor. */
export const ANUNCIOS_DE_LA_MIRADA = 60;

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
  for (const item of lista) {
    const a = objeto(item);
    const pagina = texto(a['page_name']) ?? texto(a['page_id']);
    if (pagina) anunciantes.add(pagina);
    const cuerpo = texto(a['body_text']) ?? texto(a['title']) ?? texto(a['caption']);
    if (cuerpo && muestras.length < 8) {
      const limpio = cuerpo.replace(/\s+/g, ' ');
      muestras.push(limpio.length > LARGO_DE_MUESTRA ? `${limpio.slice(0, LARGO_DE_MUESTRA)}…` : limpio);
    }
  }
  return { trabajo, total: lista.length, anunciantes: anunciantes.size, muestras };
}

/** El mercado guardado en el documento del Research, o `null` si no hay nada aprovechable. */
export function leerMercado(crudo: unknown): MercadoReal | null {
  const o = objeto(crudo);
  const rubro = texto(o['rubro']);
  const ubicacion = texto(o['ubicacion']);
  if (!rubro || !ubicacion) return null;

  const m = objeto(o['maps']);
  const a = objeto(o['anuncios']);
  const maps: MiradaAMaps | null = texto(m['trabajo'])
    ? {
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
      }
    : null;
  const anuncios: MiradaAAnuncios | null = texto(a['trabajo'])
    ? {
        trabajo: texto(a['trabajo']) as string,
        total: entero(a['total']),
        anunciantes: entero(a['anunciantes']),
        muestras: listaDeTextos(a['muestras'], 8),
      }
    : null;

  if (!maps && !anuncios) return null;
  return { rubro, ubicacion, miradoEl: texto(o['miradoEl']) ?? '', maps, anuncios };
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
  return lineas.join('\n');
}
