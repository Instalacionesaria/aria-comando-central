// El historial de leads: qué devuelve la ruta y cómo se llama cada columna en pantalla.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO REUSA `ETIQUETAS_DE_COLUMNA` DE `scrapers.ts`
//
// Parece la misma tabla y no lo es. `scrapers.ts` describe lo que devuelve EL ACTOR: un objeto
// con los campos crudos de cada fuente —`title`, `categoryName`, `page_name`, `jobTitle`—, que
// cambian según de dónde salió el lead, y por eso su mapa de etiquetas es un superset de todas
// las fuentes.
//
// Esto describe lo que devuelve NUESTRA TABLA, donde esos campos ya se normalizaron a seis
// columnas iguales para todas las fuentes (`save_leads_to_table` en el backend hace la
// traducción). Son dos vocabularios distintos que casualmente se ven parecidos, y unificarlos
// obligaría a que uno de los dos mienta.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';

/** Un lead del historial, ya normalizado por el backend. */
export interface LeadGuardado {
  id: string;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  location: string | null;
  category: string | null;
  created_at: string;
}

export interface PaginaDeLeads {
  filas: LeadGuardado[];
  pagina: number;
  hayMas: boolean;
}

/** Las seis columnas normalizadas, en el orden en que se leen. */
export const COLUMNAS: readonly { clave: keyof LeadGuardado; etiqueta: string }[] = [
  { clave: 'name', etiqueta: 'Nombre' },
  { clave: 'category', etiqueta: 'Categoría' },
  { clave: 'location', etiqueta: 'Ubicación' },
  { clave: 'phone', etiqueta: 'Teléfono' },
  { clave: 'email', etiqueta: 'Email' },
  { clave: 'website', etiqueta: 'Sitio web' },
];

/**
 * Cómo se llama cada fuente en pantalla.
 *
 * `facebook` está además de `facebook-ads` y `facebook-pages` porque el backend guarda las dos
 * variantes de Facebook con la etiqueta corta `'facebook'` (ver `save_leads_to_table`), y los
 * leads COPIADOS de la base vieja también la traen. Es un valor real de la columna, no un
 * descuido: se muestra en vez de dejar un hueco.
 */
export const NOMBRE_DE_FUENTE: Readonly<Record<string, string>> = {
  maps: 'Google Maps',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  'facebook-ads': 'Facebook Ads',
  'facebook-pages': 'Facebook Pages',
  'ad-spy': 'Espía de Anuncios',
};

const RUTA = '/api/tools/leads';

export type ResultadoDeLeads =
  | { tipo: 'datos'; pagina: PaginaDeLeads }
  | { tipo: 'fallo'; mensaje: string };

/** Una página del historial. `fuente` vacía = todas; `buscar` vacío = sin filtrar por texto. */
export async function leerLeads(
  pagina: number,
  fuente?: string,
  buscar?: string,
): Promise<ResultadoDeLeads> {
  const parametros = new URLSearchParams({ pagina: String(pagina) });
  if (fuente) parametros.set('fuente', fuente);
  if (buscar) parametros.set('buscar', buscar);

  const r = await pedir<PaginaDeLeads>(`${RUTA}?${parametros.toString()}`);
  if (r.tipo === 'datos') return { tipo: 'datos', pagina: r.datos };
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer el historial de leads.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer el historial.' };
}

/**
 * Los leads de una página como CSV.
 *
 * Existe porque el historial sin exportar sirve para mirar y no para trabajar: los leads se
 * usan en otra herramienta —Outreach, una hoja de cálculo, el CRM— y copiarlos a mano de una
 * tabla de cien filas no es una opción real.
 *
 * Cada campo va entre comillas SIEMPRE, y las comillas internas se duplican. Sin eso, un lead
 * cuyo nombre lleve una coma —"Estudio Jurídico Pérez, Gómez y Asociados"— parte la fila en
 * dos columnas y desplaza todo el resto de la línea.
 */
export function aCsv(filas: readonly LeadGuardado[]): string {
  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecera = ['Fuente', ...COLUMNAS.map((c) => c.etiqueta), 'Fecha'];
  const cuerpo = filas.map((f) => [
    escapar(NOMBRE_DE_FUENTE[f.source] ?? f.source),
    ...COLUMNAS.map((c) => escapar(f[c.clave])),
    escapar(new Date(f.created_at).toLocaleDateString('es-PE')),
  ]);
  return [cabecera.map(escapar).join(','), ...cuerpo.map((l) => l.join(','))].join('\n');
}
