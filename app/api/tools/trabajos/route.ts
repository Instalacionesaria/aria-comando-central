// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Los scrapings que esta organización tiene EN VUELO.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL SONDEO VIVÍA EN LA MEMORIA DEL COMPONENTE, Y AHÍ SE MORÍA
//
// `Scraper.jsx` guardaba el identificador del trabajo en `useState` y lo sondeaba con un
// `setTimeout` propio. Mientras esa pestaña estuviera montada funcionaba; en cuanto se cambiaba
// de herramienta —a Mis Leads, al VSL— React la desmontaba, el `clearTimeout` del `useEffect`
// mataba el reloj, y **el trabajo seguía corriendo en Apify sin que nadie lo mirara**.
//
// El síntoma que reportó Kevin: *"si yo me muevo a otra pestaña se pierde el avance"*. No se
// perdía el scraping —se pagó y terminó igual— se perdía la única referencia que teníamos para
// preguntar por él. Los leads quedaban en la base y la pantalla decía que no había pasado nada.
//
// ── LA BASE YA SABÍA LA RESPUESTA ───────────────────────────────────────────
//
// `aria_cc_scraper_trabajos` tiene `status`, y desde la migración 006 tiene `org_id`. O sea que
// "qué está corriendo para esta empresa" es una consulta, no un dato que haya que recordar. Esta
// ruta la hace, y con eso el sondeo deja de depender de que una pestaña siga abierta: al montar,
// el componente pregunta y retoma.
//
// Es la misma lección que «Mis Leads»: lo que sólo existe en `useState` se pierde, y lo que está
// en la base se puede volver a pedir.
//
// ── SE LEE DE LA BASE Y NO DEL BACKEND, A PROPÓSITO ─────────────────────────
//
// El backend de scraping no tiene un endpoint de "qué tengo corriendo" —hay que preguntarle
// trabajo por trabajo— y además esto tiene que poder responder aunque EasyPanel esté
// reiniciando. Saber si algo está en vuelo no debería depender del sistema que puede estar caído.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';

export const PANTALLA = 'tools';

/**
 * Los dos estados que significan "todavía no terminó".
 *
 * `PENDING` es "el trabajo existe y el actor no arrancó"; `RUNNING` es "el actor está
 * trabajando". Los otros tres —`COMPLETED`, `FAILED`, `CANCELLED`— son finales y no se
 * devuelven: un trabajo terminado no tiene nada que sondear.
 */
const EN_VUELO = ['PENDING', 'RUNNING'] as const;

/**
 * Cuántos se devuelven.
 *
 * Una organización con más de unos pocos scrapings simultáneos es un problema distinto —o alguien
 * apretando el botón muchas veces— y no algo que esta pantalla deba pintar. El tope está para que
 * la respuesta no crezca sin techo si eso pasa.
 */
const TOPE = 20;

/**
 * Pide `tools.ver` y no `tools.editar`: mirar qué está corriendo no gasta nada ni dispara nada.
 * Es la misma distinción que hace el sondeo en `scrape/route.ts`.
 */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const enCurso = await conOrganizacion(contexto.orgEfectiva, async () =>
    datos()
      .selectFrom('public.aria_cc_scraper_trabajos')
      .select(['id', 'fuente', 'status', 'business_type', 'location', 'created_at'])
      /* ── EL TOPE PEDIDO, Y POR QUÉ SALE DE UN JSON EN VEZ DE SU COLUMNA ──────
       *
       * `max_leads` existe como columna y **el backend nunca la escribe**: guarda el tope dentro de
       * `results_data` (`{"max_leads": N}`) para recortar los resultados en el webhook. Leer la
       * columna devolvería `null` siempre, que en la pantalla se vería como «el alumno no pidió un
       * tope» — y el formulario volvería al mínimo sin decir que perdió el número.
       *
       * Se extrae SOLO ese campo con `->>` en vez de seleccionar `results_data` entero, aunque para
       * un trabajo en vuelo ese documento sea diminuto: el día que alguien afloje el filtro de
       * estado, seleccionarlo traería los cientos de kilobytes de resultados de cada trabajo
       * terminado. Pedir un campo no puede volverse pedir la tabla.
       */
      .select(
        sql<number | null>`(results_data ->> 'max_leads')::int`.as('max_leads'),
      )
      // `raw`/`results_data` NO se seleccionan enteros: acá sólo interesa QUÉ está corriendo, y
      // `results_data` de un trabajo terminado son cientos de kilobytes por fila.
      .where('status', 'in', [...EN_VUELO])
      .orderBy('created_at', 'desc')
      .limit(TOPE)
      .execute(),
  );

  return ok({ enCurso });
}
