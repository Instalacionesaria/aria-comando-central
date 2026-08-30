// El vocabulario del Panel de Monitoreo. **Puro: no importa nada.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES UN ARCHIVO APARTE DE `consumo.ts`
//
// Porque lo leen las DOS mitades. `consumo.ts` abre `lib/datos/contexto.ts` para consultar la
// base, y el panel es un componente `'use client'`: si los nombres de los scrapers vivieran ahí,
// importarlos desde el navegador arrastraría la capa de datos —`pg`, el agrupador de conexiones,
// las cadenas de conexión— al paquete del cliente.
//
// Ese es el motivo real, y hay uno más chico que también vale: una lista de nombres para mostrar
// no tiene por qué depender de que haya base.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Las cinco fuentes, en el orden en que se muestran.
 *
 * Son las del `check` de `aria_cc_scraper_trabajos.fuente`, y esa precisión importa: **no son las
 * mismas que las de `lib/tools/leads.ts`**. Aquéllas describen la columna `source` de la tabla de
 * leads, que además admite el valor corto `'facebook'` que escribe el backend al guardar las dos
 * variantes de Facebook. Son dos columnas de dos tablas distintas; unificar las listas obligaría
 * a que una de las dos mienta sobre qué valores puede tener su columna.
 */
export const FUENTES = ['maps', 'linkedin', 'facebook-ads', 'facebook-pages', 'ad-spy'] as const;

export type Fuente = (typeof FUENTES)[number];

/**
 * Cómo se llama cada scraper en pantalla.
 *
 * Tiene UNA clave más que `FUENTES`, y es a propósito: `facebook`. No es un valor válido de
 * `aria_cc_scraper_trabajos.fuente` —su `check` no lo acepta— pero **sí es un valor real de
 * `aria_cc_scraper_leads.source`**: el backend guarda las dos variantes de Facebook con esa
 * etiqueta corta, y los leads copiados de la base vieja también la traen.
 *
 * O sea que `FUENTES` es «las columnas de la tabla de scrapeos» y esto es «cómo se muestra
 * cualquier fuente que aparezca». Unificarlas obligaría a que una de las dos mienta: o la tabla
 * gana una columna que nunca puede tener un número, o el historial de leads muestra la clave
 * cruda `facebook` donde va un nombre.
 */
export const NOMBRE_DE_FUENTE: Readonly<Record<string, string>> = {
  maps: 'Google Maps',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  'facebook-ads': 'Facebook Ads',
  'facebook-pages': 'Facebook Pages',
  'ad-spy': 'Espía de Anuncios',
};

/** Lo que el panel muestra del scraping de una empresa. */
export interface ConsumoDeUnaOrganizacion {
  /**
   * Cuántos scrapeos disparó, en total. Es el conteo de FILAS de trabajos, sin filtrar por
   * estado: un trabajo que falló también se disparó, también costó una corrida de Apify, y
   * esconderlo haría que una empresa cuyo scraper se rompe se vea igual que una que no lo usa.
   */
  scrapeos: number;
  /** Cuántos de esos scrapeos terminaron bien. La diferencia con el total son los que no. */
  completados: number;
  /** Los scrapeos por scraper. Siempre las cinco claves, en cero si no hubo ninguno. */
  porFuente: Record<string, number>;
  /** Cuántos leads quedaron guardados en el historial. */
  leads: number;
  /**
   * Lo que estas corridas gastaron en Apify, en USD. `null` = **no se midió ninguna**.
   *
   * `null` y `0` son hechos distintos y no se colapsan: sin token de Apify, o con las corridas
   * todavía sin consultar, el costo es desconocido — y un cero en una columna de gastos se lee
   * como «esta empresa no nos cuesta nada», que es la conclusión opuesta a la verdadera.
   */
  costoUsd: number | null;
  /** Cuántas corridas todavía no tienen costo medido. Si es > 0, `costoUsd` es un PARCIAL. */
  scrapeosSinCosto: number;
  /**
   * El saldo, o `null` si esta empresa **no tiene monedero**.
   *
   * `null` y cero son dos hechos distintos: sin fila, esta organización nunca fue provisionada
   * en el scraper; con cero, gastó todo lo que tenía. Colapsarlos haría que una empresa recién
   * dada de alta se vea igual que una que se quedó sin leads, y las dos piden acciones opuestas.
   */
  saldo: { historico: number; gratuitos: number; pagados: number; disponibles: number } | null;
}

/** Una empresa con su consumo, tal como la dibuja la tabla. */
export interface FilaDelPanel extends ConsumoDeUnaOrganizacion {
  orgId: string;
  nombre: string;
  slug: string;
  activa: boolean;
  esPrincipal: boolean;
  /**
   * Cuánto paga esta empresa por mes, en USD. `null` = **nadie lo cargó** (no «no paga»).
   *
   * Se carga a mano en Ajustes → Empresas: no hay tabla de facturación en este sistema, y el panel
   * de ARIA-brain ya tenía anotado ese hueco como su deuda más cara.
   */
  precioMensual: number | null;
  /**
   * `true` = **no se pudo leer el consumo de esta empresa**, y los ceros de la fila no son
   * ceros: son la ausencia de un dato.
   *
   * Existe porque un cero silencioso en un tablero de consumo se lee como *"esta empresa no
   * scrapeó"*, que es lo contrario de lo que pasó. Es el mismo modo de falla que persigue la
   * comprobación final de `migraciones/006_aria_cc_scraper.sql`: *"en la pantalla eso se lee
   * como «esta organización nunca scrapeó», que es el peor modo de falla posible: el que no se
   * reporta"*.
   */
  ilegible: boolean;
}

// ─── El detalle de UNA empresa ──────────────────────────────────────────────
//
// Lo que se ve al hacer clic en una fila del panel: qué buscó esa empresa y qué leads le quedaron.

/**
 * Un scraping disparado, tal como se lee en el detalle.
 *
 * ── POR QUÉ VIAJAN LOS PARÁMETROS DE BÚSQUEDA Y NO SÓLO EL CONTEO ─────────
 *
 * Porque son lo único que dice **qué se buscó** en un trabajo que falló y no dejó ni un lead. Sin
 * `queBusco`, una corrida que reventó y una que no encontró nada se ven exactamente igual: cero
 * leads, la misma fila. Y son dos problemas distintos —uno es del scraper, el otro del criterio
 * de búsqueda— que se atienden de forma opuesta.
 */
export interface TrabajoDeScraping {
  id: string;
  fuente: string;
  estado: string;
  /** `"Peluquería · Cayma, Arequipa, Perú"`, armado con lo que la fuente haya llenado. */
  queBusco: string;
  /** El tope que se pidió. `null` cuando la fuente no lo usa. */
  maxLeads: number | null;
  /** Cuántos leads dejó ESTE trabajo. Sale de contar `aria_cc_scraper_leads` por `trabajo_id`. */
  leads: number;
  /** El texto del fallo, sólo si el trabajo falló. */
  error: string | null;
  fecha: string;
}

/** Un lead del historial de una empresa. Las seis columnas ya normalizadas por el backend. */
export interface LeadDeLaEmpresa {
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

/** Lo que devuelve `GET /api/monitoreo/[orgId]`. */
export interface DetalleDeEmpresa {
  empresa: { orgId: string; nombre: string; slug: string; esPrincipal: boolean };
  /**
   * Los trabajos, del más nuevo al más viejo, **acotados**. `hayMasTrabajos` dice si se cortó.
   *
   * Se acota y se AVISA en vez de traerlos todos: una empresa con mil corridas convertiría esta
   * respuesta en megabytes por una tabla que nadie va a leer entera. Y avisar importa más que
   * acotar — una lista truncada en silencio se lee como «esto es todo lo que hizo».
   */
  trabajos: TrabajoDeScraping[];
  hayMasTrabajos: boolean;
  /** Una página de leads, con el mismo tamaño y el mismo criterio que «Mis Leads». */
  leads: LeadDeLaEmpresa[];
  pagina: number;
  hayMasLeads: boolean;
}
