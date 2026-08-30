// El detalle de UNA empresa en el Panel de Monitoreo: qué buscó, y qué leads le quedaron.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA MISMA GARANTÍA QUE LA TABLA, Y CONVIENE DECIRLA OTRA VEZ ACÁ
//
// Estas dos consultas leen los datos de OTRA empresa. Lo que hace que eso sea aceptable no es que
// el manejador se acuerde de filtrar: es que corren dentro de `conOrganizacion(orgId, …)`, o sea
// con la misma política de RLS que correría una petición de esa empresa. **Este archivo no tiene
// un solo `where org_id`**, y no es un descuido — un `where` acá daría la impresión de que el
// filtro es ése, y el día que alguien lo quitara para "simplificar" no se notaría que la
// protección era otra. Es el mismo criterio que `lib/administracion/organizaciones.ts` escribe
// para el listado de empresas.
//
// Quien decide QUÉ organización se abre es `app/api/monitoreo/[orgId]/route.ts`, detrás del
// portero y de la regla de la organización principal.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';
import type { LeadDeLaEmpresa, TrabajoDeScraping } from './fuentes.ts';

/**
 * Cuántos trabajos se traen.
 *
 * Se acota **y se avisa**: `hayMasTrabajos`. Una lista truncada en silencio se lee como «esto es
 * todo lo que hizo esta empresa», que es una afirmación falsa que nadie puede detectar mirando.
 */
export const TRABAJOS_MAXIMO = 60;

/**
 * Cuántos leads por página.
 *
 * El mismo número que «Mis Leads» (`app/api/tools/leads/route.ts`) y por el mismo motivo: el
 * mínimo de una corrida de Google Maps son 72 leads, así que una página de 100 muestra una
 * corrida completa y algo más. Con 25 harían falta tres páginas para ver UNA búsqueda.
 */
export const LEADS_POR_PAGINA = 100;

/**
 * Qué buscó un trabajo, en una línea.
 *
 * Cada fuente llena campos distintos —Maps usa los dos, LinkedIn ninguno— así que se arma con lo
 * que haya en vez de con una plantilla fija. Cuando no hay nada se devuelve una cadena vacía y la
 * pantalla muestra un guion: **no se inventa un texto**. «Búsqueda general» sería una descripción
 * que nadie escribió y que se leería como un hecho.
 */
function queBusco(f: { business_type: string | null; location: string | null }): string {
  return [f.business_type, f.location].map((x) => x?.trim()).filter(Boolean).join(' · ');
}

/**
 * Los trabajos de la organización cuyo contexto está abierto, del más nuevo al más viejo.
 *
 * **Tiene que llamarse dentro de `conOrganizacion(`.** No lo comprueba: `datos()` lanza con un
 * mensaje que dice exactamente eso, y repetir la comprobación sería una segunda respuesta a la
 * misma pregunta.
 */
export async function trabajosDeLaOrganizacion(): Promise<{
  trabajos: TrabajoDeScraping[];
  hayMas: boolean;
}> {
  const filas = await datos()
    .selectFrom('public.aria_cc_scraper_trabajos as t')
    .select(({ selectFrom }) => [
      't.id',
      't.fuente',
      't.status',
      't.business_type',
      't.location',
      't.max_leads',
      't.error_message',
      't.created_at',
      // Cuántos leads dejó ESTE trabajo. Subconsulta y no `left join … group by`: con el join, un
      // trabajo sin leads desaparecería si el `group by` se escribe mal, y un trabajo sin leads es
      // justamente el que hay que ver.
      //
      // El par `(org_id, trabajo_id)` completo, que es la forma de la clave foránea. `org_id` lo
      // fija RLS en las dos tablas, así que es redundante para el aislamiento — y no para el
      // resultado: sin él, el índice que sirve a esta subconsulta no es el mismo.
      selectFrom('public.aria_cc_scraper_leads as l')
        .whereRef('l.trabajo_id', '=', 't.id')
        .whereRef('l.org_id', '=', 't.org_id')
        .select(({ fn }) => fn.countAll<string>().as('n'))
        .as('leads'),
    ])
    .orderBy('t.created_at', 'desc')
    .orderBy('t.id', 'desc') // desempate estable, igual que en el historial de leads
    .limit(TRABAJOS_MAXIMO + 1)
    .execute();

  const visibles = filas.slice(0, TRABAJOS_MAXIMO);
  return {
    trabajos: visibles.map((f) => ({
      id: f.id,
      fuente: f.fuente,
      estado: f.status,
      queBusco: queBusco(f),
      maxLeads: f.max_leads,
      leads: Number(f.leads ?? 0),
      // El texto del fallo SÓLO cuando falló. Mostrarlo en un trabajo que terminó bien sería un
      // resto de una corrida anterior contando algo que ya no pasa.
      error: f.status === 'FAILED' ? f.error_message : null,
      fecha: f.created_at.toISOString(),
    })),
    hayMas: filas.length > TRABAJOS_MAXIMO,
  };
}

/**
 * Una página de leads de la organización cuyo contexto está abierto.
 *
 * `raw_data` NO se selecciona: es el lead entero como lo devolvió el actor, cientos de kilobytes
 * en una página de cien, y la tabla no lo muestra. Misma decisión que en «Mis Leads».
 */
export async function leadsDeLaOrganizacion(
  pagina: number,
  fuente: string,
): Promise<{ leads: LeadDeLaEmpresa[]; hayMas: boolean }> {
  let consulta = datos()
    .selectFrom('public.aria_cc_scraper_leads')
    .select(['id', 'source', 'name', 'email', 'phone', 'website', 'location', 'category', 'created_at'])
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    // Se pide una de más para saber si hay página siguiente sin pagar un `count(*)` sobre toda la
    // tabla. Es el mismo truco que usa el resto del proyecto.
    .limit(LEADS_POR_PAGINA + 1)
    .offset((pagina - 1) * LEADS_POR_PAGINA);

  if (fuente) consulta = consulta.where('source', '=', fuente);

  const filas = await consulta.execute();
  return {
    leads: filas.slice(0, LEADS_POR_PAGINA).map((f) => ({
      id: f.id,
      source: f.source,
      name: f.name,
      email: f.email,
      phone: f.phone,
      website: f.website,
      location: f.location,
      category: f.category,
      created_at: f.created_at.toISOString(),
    })),
    hayMas: filas.length > LEADS_POR_PAGINA,
  };
}
