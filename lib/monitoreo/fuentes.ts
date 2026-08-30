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

/** Cómo se llama cada scraper en pantalla. */
export const NOMBRE_DE_FUENTE: Readonly<Record<string, string>> = {
  maps: 'Google Maps',
  linkedin: 'LinkedIn',
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
