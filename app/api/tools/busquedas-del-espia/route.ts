// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// El historial del Espía a tus competidores (Jorge, 2026-10-03: los resultados desaparecían al
// cambiar de pestaña).
//
//   · sin parámetros → las búsquedas de la organización, de la más nueva a la más vieja;
//   · `?trabajo=<id>` → el último análisis con IA de esa búsqueda, o `null`.
//
// Sólo lee, y sólo de negocio, con la RLS de la organización de la sesión. Los anuncios de una
// búsqueda NO salen de acá: se leen por `/api/tools/scrape?trabajo=`, la misma ruta del sondeo, que ya
// los trae del motor filtrados por organización.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { analisisDe, busquedasDelEspia } from '../../../../lib/tools/historial-del-espia.ts';

export const PANTALLA = 'tools';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const trabajo = new URL(peticion.url).searchParams.get('trabajo');
  if (trabajo) {
    return ok({ analisis: await conOrganizacion(contexto.orgEfectiva, () => analisisDe(trabajo)) });
  }
  return ok({ busquedas: await conOrganizacion(contexto.orgEfectiva, busquedasDelEspia) });
}
