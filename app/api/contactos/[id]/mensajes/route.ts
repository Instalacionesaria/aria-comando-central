// La pestaña Chat de la ficha. Lee de la caché: **cero llamadas al CRM**.
//
// El `03` § 1 lo pone como propiedad del diseño, no como optimización: los mensajes los mantienen
// el aviso del CRM y la ingesta periódica, y el chat solo los lee. Todo el presupuesto de llamadas
// se gasta en TRAER los datos cuando cambian; mostrarlos no cuesta nada.
//
// Hoy la tabla está vacía y la respuesta lo dice con `falta` — ver `lib/negocio/ficha.ts`.

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../../lib/datos/contexto.ts';
import { mensajesDeLaFicha } from '../../../../../lib/negocio/ficha.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/mensajes'>,
): Promise<Response> {
  // `contactos.ver`, la capacidad de la ficha. Las cinco pestañas piden la MISMA: son una sola
  // pantalla, y `ADR-0304` lo exige — si una pidiera algo distinto, esa pestaña se vería vacía
  // para alguien que ve las otras cuatro, y no habría forma de darse cuenta mirando.
  const contexto = await exigir(peticion, ['contactos.ver']);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const r = await conOrganizacion(contexto.orgEfectiva, () => mensajesDeLaFicha(id));
  return ok({ mensajes: r.filas, falta: r.falta });
}
