// La ficha de una persona en Leads Portal. La única respuesta de la pestaña con teléfono y correo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO ES `GET /api/contactos/[id]`, Y LA DIFERENCIA ES QUE ÉSTA NO TOCA NADA
//
// La ficha del closer refresca al contacto contra el CRM: gasta presupuesto del proveedor y puede
// reescribir su territorio. Esta ruta sólo lee (`fichaDelLeadDelPortal`), y por eso no importa nada
// de la sincronización ni cruza al dominio de identidad a buscar credenciales.
//
// ── MISMA CAPACIDAD Y MISMA PANTALLA QUE LA LISTA ───────────────────────────
//
// `ADR-0304`: las operaciones de una pantalla piden lo mismo. Si la ficha pidiera `contactos.ver` y
// la lista `tablero.ver`, alguien con la pestaña vería la rejilla y cada ficha le daría 403 —una
// parte vacía para quien ve el resto, sin forma de darse cuenta mirando—.
//
// ── 404 PARA LO QUE NO ES DE ESTA EMPRESA, Y PARA LO QUE NO EXISTE ──────────
//
// Un id que no es un UUID, uno que no existe y uno de otra empresa dan la misma respuesta. Que sean
// indistinguibles es el requisito (`ADR-0501`): un 403 para el ajeno confirmaría que existe.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { fichaDelLeadDelPortal } from '../../../../lib/negocio/fichaDelLeadDelPortal.ts';

/** A qué pantalla pertenece esta operación. La misma que la lista. */
export const PANTALLA = 'contacts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/leads-portal/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['tablero.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  /* Sin esta guarda, la consulta lanza `invalid input syntax for type uuid` y el 500 dice más que un
     404. */
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const ficha = await conOrganizacion(contexto.orgEfectiva, () => fichaDelLeadDelPortal(id));
  if (ficha === null) return rechazo('no_encontrado');

  return ok({ ficha });
}
