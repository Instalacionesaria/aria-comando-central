// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// El historial de leads de la organización.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTA RUTA CIERRA UN AGUJERO QUE NO SE VEÍA COMO AGUJERO
//
// Hasta la migración `006_aria_cc_scraper.sql`, los leads de un scraping vivían en la memoria
// del navegador y nada más: `Scraper.jsx` los guardaba en `useState([])` y no había ninguna
// ruta para volver a pedirlos. **Recargar la pantalla perdía la vista de leads que la
// organización acababa de pagar.**
//
// Los datos no se destruían —el backend siempre los guardó en su tabla— pero desde el hub no
// había forma de volver a verlos. El endpoint existía del otro lado (`GET /mis-leads`) y nadie
// lo consumía.
//
// ── POR QUÉ SE LEE DE LA BASE Y NO DEL BACKEND ──────────────────────────────
//
// Podría haber sido un proxy más, como `scrape/route.ts`. Se lee directo, y las tres razones
// importan en ese orden:
//
//   1. **El aislamiento lo hace la base, no esta ruta.** `public.aria_cc_scraper_leads` tiene
//      RLS forzada con la política que filtra por `app.org_id`, y `conOrganizacion(` la fija.
//      Si mañana alguien escribe mal un `where`, la base sigue devolviendo sólo lo de esta
//      organización. En un proxy con llave de servicio, el `where` ES la única defensa.
//
//   2. **Ya no depende de que el backend esté vivo.** Ver el historial de leads pagados no
//      tiene por qué caerse porque EasyPanel esté reiniciando. Scrapear sí necesita el
//      backend; mirar lo scrapeado, no.
//
//   3. Es una consulta menos y un salto de red menos.
//
// Esto sólo es posible porque las tablas se mudaron a esta base. Antes vivían en otro proyecto
// Supabase y no había alternativa al proxy.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';

export const PANTALLA = 'tools';

/**
 * Cuántos leads devuelve una página.
 *
 * No es un número redondo por gusto: el mínimo de una corrida de Google Maps son 72 leads
 * (`MINIMO_LEADS_MAPS`), así que una página de 100 muestra una corrida completa y algo más.
 * Con 25 —el paginado habitual del proyecto— haría falta pasar tres páginas para ver UNA
 * búsqueda, y la pantalla existe justamente para revisar lo que trajo una búsqueda.
 */
const POR_PAGINA = 100;

/**
 * Leer el historial. Pide `tools.ver` y NO `tools.editar`: mirar leads ya pagados no gasta
 * nada. Es la misma distinción que hace el sondeo en `scrape/route.ts`.
 */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const parametros = new URL(peticion.url).searchParams;

  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);

  // Filtro opcional por fuente. Se valida contra la lista en vez de pasarlo tal cual: la
  // columna tiene un `check` con estos valores, y un valor inventado devolvería cero filas
  // —que en pantalla se lee como "no tenés leads", no como "el filtro está mal"—.
  const FUENTES = ['maps', 'linkedin', 'facebook', 'facebook-ads', 'facebook-pages', 'ad-spy'];
  const fuentePedida = parametros.get('fuente');
  if (fuentePedida && !FUENTES.includes(fuentePedida)) {
    return rechazo('peticion_invalida', 'Fuente desconocida.');
  }

  /**
   * Búsqueda por nombre o correo.
   *
   * ── LOS DOS ESCAPES, Y POR QUÉ NO SON LO MISMO ─────────────────────────────
   *
   * El valor va a un `ilike`, y ahí `%` y `_` son COMODINES. No es un problema de inyección
   * —el constructor de consultas parametriza igual— sino de resultado: quien busque `100%`
   * recibiría todo lo que empieza con `100`, y `_` haría de comodín de un carácter. Se
   * escapan, y la barra invertida primero, o escaparía a los escapes que vienen después.
   *
   * El tope de largo es aparte: sin él, un texto de un megabyte se convierte en un `ilike`
   * que recorre la tabla entera. 80 caracteres cubren cualquier nombre o correo real.
   */
  const crudo = (parametros.get('buscar') ?? '').trim().slice(0, 80);
  const buscar = crudo ? `%${crudo.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : '';

  const { filas, hayMas } = await conOrganizacion(contexto.orgEfectiva, async () => {
    // Se piden POR_PAGINA + 1 para saber si hay página siguiente sin pagar un `count(*)`
    // sobre toda la tabla. Es el mismo truco que usa el resto del proyecto.
    let consulta = datos()
      .selectFrom('public.aria_cc_scraper_leads')
      .select([
        'id',
        'source',
        'name',
        'email',
        'phone',
        'website',
        'location',
        'category',
        'created_at',
      ])
      // `raw_data` NO se selecciona a propósito: es el lead entero como lo devolvió el actor,
      // y en una página de 100 son cientos de kilobytes que la tabla no muestra. Quien
      // necesite un campo raro, se promueve a columna.
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc') // desempate estable: sin esto dos leads del mismo instante pueden alternar entre páginas
      .limit(POR_PAGINA + 1)
      .offset((pagina - 1) * POR_PAGINA);

    if (fuentePedida) consulta = consulta.where('source', '=', fuentePedida);

    // `ilike` y no `like`: nadie escribe respetando mayúsculas al buscar un negocio. El `or`
    // va agrupado —`eb.or`— porque suelto se mezclaría con el filtro de fuente de arriba y
    // `A and (B or C)` pasaría a ser `(A and B) or C`: buscar dentro de LinkedIn devolvería
    // también los de Maps que coincidan por correo.
    if (buscar) {
      consulta = consulta.where((eb) =>
        eb.or([eb('name', 'ilike', buscar), eb('email', 'ilike', buscar)]),
      );
    }

    const resultado = await consulta.execute();
    return {
      filas: resultado.slice(0, POR_PAGINA),
      hayMas: resultado.length > POR_PAGINA,
    };
  });

  return ok({ filas, pagina, hayMas });
}
