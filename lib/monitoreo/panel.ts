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
  | { tipo: 'datos'; empresas: readonly FilaDelPanel[] }
  | { tipo: 'fallo'; mensaje: string };

/** La foto entera: todas las empresas con su consumo. */
export async function leerPanel(): Promise<ResultadoDelPanel> {
  const r = await pedir<{ empresas: FilaDelPanel[] }>(RUTA);
  if (r.tipo === 'datos') return { tipo: 'datos', empresas: r.datos.empresas };
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
  return {
    empresas: empresas.length,
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
