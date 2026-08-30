// El lado del navegador del Panel de Monitoreo: pedir la foto y bajarla como CSV.

import { pedir } from '../http/cliente.ts';
import {
  FUENTES,
  NOMBRE_DE_FUENTE,
  type DetalleDeEmpresa,
  type FilaDelPanel,
  type LeadDeLaEmpresa,
} from './fuentes.ts';

const RUTA = '/api/monitoreo';

export type ResultadoDelPanel =
  | { tipo: 'datos'; empresas: readonly FilaDelPanel[]; sinTokenDeApify: boolean }
  | { tipo: 'fallo'; mensaje: string };

/** La foto entera: todas las empresas con su consumo. */
export async function leerPanel(): Promise<ResultadoDelPanel> {
  const r = await pedir<{ empresas: FilaDelPanel[]; sinTokenDeApify: boolean }>(RUTA);
  if (r.tipo === 'datos') {
    return {
      tipo: 'datos',
      empresas: r.datos.empresas,
      sinTokenDeApify: r.datos.sinTokenDeApify === true,
    };
  }
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer el Panel de Monitoreo.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer el Panel de Monitoreo.' };
}

/** Los totales de la tabla, calculados una vez para el encabezado y el pie. */
export function totales(empresas: readonly FilaDelPanel[]) {
  const porFuente: Record<string, number> = Object.fromEntries(FUENTES.map((f) => [f, 0]));
  let scrapeos = 0;
  let leads = 0;
  for (const e of empresas) {
    scrapeos += e.scrapeos;
    leads += e.leads;
    for (const f of FUENTES) porFuente[f] = (porFuente[f] ?? 0) + (e.porFuente[f] ?? 0);
  }
  /* ── LOS TRES NÚMEROS DE PLATA, Y LO QUE CADA `null` PROTEGE ───────────────
   *
   * Los tres se suman IGNORANDO los nulos, y cada uno tiene una razón distinta para hacerlo:
   *
   *   · `ingreso` — un `null` es «nadie cargó el precio de esta empresa». Contarlo como cero
   *     afirmaría un ingreso medido sobre empresas que nadie miró, y el número se vería bien.
   *   · `costo`   — un `null` es «no se midió» (falta el token de Apify, o la corrida todavía no
   *     se consultó). Cero significaría «no nos costó nada», que es la conclusión opuesta.
   *
   * Y por eso viajan además `empresasSinPrecio` y `scrapeosSinCosto`: sin ellos, un total parcial
   * es indistinguible de un total completo. */
  const conPrecio = empresas.filter((e) => e.precioMensual !== null);
  const conCosto = empresas.filter((e) => e.costoUsd !== null);

  return {
    empresas: empresas.length,
    ingreso: conPrecio.length > 0 ? conPrecio.reduce((s, e) => s + (e.precioMensual ?? 0), 0) : null,
    empresasSinPrecio: empresas.length - conPrecio.length,
    costo: conCosto.length > 0 ? conCosto.reduce((s, e) => s + (e.costoUsd ?? 0), 0) : null,
    scrapeosSinCosto: empresas.reduce((s, e) => s + e.scrapeosSinCosto, 0),
    /* Las que scrapearon alguna vez. Es el número que dice si la herramienta se está usando —
       «diez empresas» y «tres empresas que scrapearon» son dos hechos distintos, y el segundo es
       el que hace falta para decidir a quién llamar. */
    activas: empresas.filter((e) => e.scrapeos > 0).length,
    /* Las que no se pudieron leer. Si es mayor que cero, ninguno de los otros números de arriba
       es un total: le faltan esas empresas. La pantalla lo dice en vez de mostrarlos a secas. */
    ilegibles: empresas.filter((e) => e.ilegible).length,
    scrapeos,
    leads,
    porFuente,
  };
}

/** Un número como se lee en Perú, o un guion cuando no hay dato. */
export function num(n: number | null | undefined): string {
  return typeof n === 'number' ? n.toLocaleString('es-PE') : '—';
}

/**
 * Un monto en dólares. `null` **no** se dibuja como `$0`.
 *
 * Dos decimales para los precios y hasta cuatro para los costos: una corrida de Apify cuesta
 * centavos, y con dos decimales toda la columna de costos sería `$0.00` — un número que se ve
 * medido y no dice nada. `maximumFractionDigits` mayor que `minimumFractionDigits` deja que cada
 * valor use lo que necesita.
 */
export function usd(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

/**
 * El margen de una empresa: lo que paga menos lo que cuesta.
 *
 * `null` si falta CUALQUIERA de los dos, y no se rellena con cero el que falte. Una resta con un
 * lado inventado no es un margen parcial: es un número equivocado con forma de margen — y en la
 * dirección peligrosa, porque sin costo medido toda empresa se vería rentable.
 */
export function margen(fila: { precioMensual: number | null; costoUsd: number | null }): number | null {
  if (fila.precioMensual === null || fila.costoUsd === null) return null;
  return fila.precioMensual - fila.costoUsd;
}

/**
 * La tabla como CSV.
 *
 * Cada campo va entre comillas SIEMPRE y las comillas internas se duplican, por el mismo motivo
 * que en `lib/tools/leads.ts`: un nombre de empresa con una coma parte la fila en dos columnas y
 * desplaza todo el resto de la línea.
 *
 * Una empresa `ilegible` NO sale con ceros: sale con la palabra «sin leer» en cada número. Un CSV
 * es justo donde el cero silencioso hace más daño — se abre en una hoja de cálculo, se suma, y el
 * total afirma algo que nadie midió.
 */
export function aCsv(empresas: readonly FilaDelPanel[]): string {
  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecera = [
    'Empresa',
    'Identificador',
    'Activa',
    'Scrapeos',
    'Completados',
    ...FUENTES.map((f) => NOMBRE_DE_FUENTE[f] ?? f),
    'Leads guardados',
    'Leads disponibles',
    'Ingreso mensual USD',
    'Costo Apify USD',
    'Corridas sin costo medido',
    'Margen USD',
  ];
  const cuerpo = empresas.map((e) => {
    const dato = (n: number | null) => escapar(e.ilegible ? 'sin leer' : (n ?? '—'));
    return [
      escapar(e.nombre),
      escapar(e.slug),
      escapar(e.activa ? 'sí' : 'no'),
      dato(e.scrapeos),
      dato(e.completados),
      ...FUENTES.map((f) => dato(e.porFuente[f] ?? 0)),
      dato(e.leads),
      dato(e.saldo?.disponibles ?? null),
      /* «sin cargar» y «sin medir» en vez de vacío o cero. Un CSV es justo donde el cero
         silencioso hace más daño: se abre en una hoja de cálculo, se suma, y el total afirma algo
         que nadie midió. */
      escapar(e.ilegible ? 'sin leer' : e.precioMensual === null ? 'sin cargar' : e.precioMensual),
      escapar(e.ilegible ? 'sin leer' : e.costoUsd === null ? 'sin medir' : e.costoUsd),
      dato(e.scrapeosSinCosto),
      escapar(e.ilegible ? 'sin leer' : (margen(e) ?? 'sin dato')),
    ].join(',');
  });
  return [cabecera.map(escapar).join(','), ...cuerpo].join('\n');
}

// ─── El detalle de UNA empresa ──────────────────────────────────────────────

export type ResultadoDelDetalle =
  | { tipo: 'datos'; detalle: DetalleDeEmpresa }
  | { tipo: 'fallo'; mensaje: string };

/** Qué scrapeó una empresa y qué leads le quedaron. `fuente` vacía = todas. */
export async function leerDetalle(
  orgId: string,
  pagina: number,
  fuente: string,
): Promise<ResultadoDelDetalle> {
  const parametros = new URLSearchParams({ pagina: String(pagina) });
  if (fuente) parametros.set('fuente', fuente);

  const r = await pedir<DetalleDeEmpresa>(`${RUTA}/${orgId}?${parametros.toString()}`);
  if (r.tipo === 'datos') return { tipo: 'datos', detalle: r.datos };
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo abrir el detalle de esta empresa.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para abrir el detalle.' };
}

/** Cómo se lee cada estado de un trabajo. Los cinco del `check` de la tabla. */
export const NOMBRE_DE_ESTADO: Readonly<Record<string, string>> = {
  PENDING: 'En cola',
  RUNNING: 'Corriendo',
  COMPLETED: 'Completado',
  FAILED: 'Falló',
  CANCELLED: 'Cancelado',
};

/** Las seis columnas normalizadas de un lead, en el orden en que se leen. */
export const COLUMNAS_DE_LEAD: readonly { clave: keyof LeadDeLaEmpresa; etiqueta: string }[] = [
  { clave: 'name', etiqueta: 'Nombre' },
  { clave: 'category', etiqueta: 'Categoría' },
  { clave: 'location', etiqueta: 'Ubicación' },
  { clave: 'phone', etiqueta: 'Teléfono' },
  { clave: 'email', etiqueta: 'Email' },
  { clave: 'website', etiqueta: 'Sitio web' },
];

/**
 * Los leads de una empresa como CSV.
 *
 * Mismo escape que el resto del proyecto: cada campo entre comillas SIEMPRE y las internas
 * duplicadas. Sin eso, un negocio llamado "Estudio Pérez, Gómez y Asociados" parte la fila en dos
 * columnas y desplaza el resto de la línea.
 */
export function leadsACsv(leads: readonly LeadDeLaEmpresa[]): string {
  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecera = ['Fuente', ...COLUMNAS_DE_LEAD.map((c) => c.etiqueta), 'Fecha'];
  const cuerpo = leads.map((l) =>
    [
      escapar(NOMBRE_DE_FUENTE[l.source] ?? l.source),
      ...COLUMNAS_DE_LEAD.map((c) => escapar(l[c.clave])),
      escapar(new Date(l.created_at).toLocaleDateString('es-PE')),
    ].join(','),
  );
  return [cabecera.map(escapar).join(','), ...cuerpo].join('\n');
}
