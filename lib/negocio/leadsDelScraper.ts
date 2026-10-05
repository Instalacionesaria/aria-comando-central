// Los leads que trajo el scraper de Tools, contados: por fuente, con y sin correo, teléfono y sitio, y de
// cuántas búsquedas salieron. Para el cerebro (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-42).
//
// ═══════════════════════════════════════════════════════════════════════════════
// SÓLO AGREGADOS, Y POR QUÉ ES UNA FUNCIÓN NUEVA
//
// La pantalla (`app/api/tools/leads/route.ts`) devuelve las filas con su nombre, su correo y su teléfono:
// es una lista para trabajar a mano. El cerebro no ve personas, así que no puede consumir esa ruta, y
// esto cuenta las mismas filas sin traer ninguna.
//
// ── LO QUE NO SE PUEDE DECIR ─────────────────────────────────────────────────
//
// **Cuántos se enviaron al CRM no está guardado en ninguna parte**: la tabla no tiene esa columna, y el
// envío no deja rastro de este lado. Viaja como `null` con el motivo, y no como cero: cero sería afirmar
// que no se envió ninguno.
//
// La ventana es la de las demás cifras del sistema: móvil, `now() - make_interval(days => N)` sobre el
// alta del lead (`created_at`). La tabla vive en `public` y tiene la RLS forzada por organización, así que
// se corre dentro de `conOrganizacion(` y no se filtra a mano.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';

export interface LeadsDeUnaFuente {
  fuente: string;
  leads: number;
  conCorreo: number;
  conTelefono: number;
  conSitio: number;
  /** Ni correo ni teléfono: un lead que no se puede contactar sin buscarlo de nuevo. */
  sinContacto: number;
  /** De cuántas búsquedas distintas salieron. */
  busquedas: number;
}

export interface LeadsDelScraper {
  dias: number;
  /** El primer y el último lead de la ventana. `null` sin leads. */
  desde: string | null;
  hasta: string | null;
  total: number;
  porFuente: LeadsDeUnaFuente[];
  /** Siempre `null`: no se registra. Ver el encabezado. */
  enviadosAlCrm: null;
  porQueNoHayEnviados: string;
}

export const SIN_REGISTRO_DE_ENVIOS =
  'Cuántos se enviaron al CRM no se registra: la tabla de leads no lo guarda, así que no se puede contar.';

/** Los leads del scraper de la ventana, contados por fuente. **Corre dentro de `conOrganizacion(`.** */
export async function leadsDelScraper(dias: number): Promise<LeadsDelScraper> {
  const lleno = (columna: string) => sql<boolean>`nullif(btrim(${sql.ref(columna)}), '') is not null`;
  const filas = await datos()
    .selectFrom('public.aria_cc_scraper_leads')
    .where('created_at', '>=', sql<Date>`now() - make_interval(days => ${dias})`)
    .select([
      'source',
      sql<string>`count(*)`.as('leads'),
      sql<string>`count(*) filter (where ${lleno('email')})`.as('con_correo'),
      sql<string>`count(*) filter (where ${lleno('phone')})`.as('con_telefono'),
      sql<string>`count(*) filter (where ${lleno('website')})`.as('con_sitio'),
      sql<string>`count(*) filter (where not ${lleno('email')} and not ${lleno('phone')})`.as('sin_contacto'),
      sql<string>`count(distinct trabajo_id)`.as('busquedas'),
      sql<Date>`min(created_at)`.as('desde'),
      sql<Date>`max(created_at)`.as('hasta'),
    ])
    .groupBy('source')
    .orderBy(sql`count(*)`, 'desc')
    .orderBy('source')
    .execute();

  const porFuente = filas.map((f) => ({
    fuente: f.source,
    leads: Number(f.leads),
    conCorreo: Number(f.con_correo),
    conTelefono: Number(f.con_telefono),
    conSitio: Number(f.con_sitio),
    sinContacto: Number(f.sin_contacto),
    busquedas: Number(f.busquedas),
  }));
  const fechas = filas.flatMap((f) => [new Date(f.desde).getTime(), new Date(f.hasta).getTime()]);
  return {
    dias,
    desde: fechas.length === 0 ? null : new Date(Math.min(...fechas)).toISOString(),
    hasta: fechas.length === 0 ? null : new Date(Math.max(...fechas)).toISOString(),
    total: porFuente.reduce((s, f) => s + f.leads, 0),
    porFuente,
    enviadosAlCrm: null,
    porQueNoHayEnviados: SIN_REGISTRO_DE_ENVIOS,
  };
}
