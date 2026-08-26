// La pestaña Llamada de la ficha. Todas las llamadas, la más reciente primero, y **nunca se borra ninguna**.
//
// Cero llamadas al CRM: sale de la caché. `contactos.ver`, la MISMA capacidad que las otras cuatro
// pestañas, porque son una sola pantalla y `ADR-0304` lo exige.

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../../lib/datos/contexto.ts';
import { llamadasDeLaFicha } from '../../../../../lib/negocio/ficha.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/llamadas'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.ver'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const r = await conOrganizacion(contexto.orgEfectiva, () => llamadasDeLaFicha(id));
  return ok({ llamadas: r.filas, falta: r.falta });
}
