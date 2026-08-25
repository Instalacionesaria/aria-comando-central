// La pestaña Perfil de la ficha. Los datos del contacto, agrupados por lo que SIGNIFICAN y no por el formulario del que salieron.
//
// Cero llamadas al CRM: sale de la caché. `contactos.ver`, la MISMA capacidad que las otras cuatro
// pestañas, porque son una sola pantalla y `ADR-0304` lo exige.

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../../lib/datos/contexto.ts';
import { perfilDeLaFicha } from '../../../../../lib/negocio/ficha.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/perfil'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.ver']);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const r = await conOrganizacion(contexto.orgEfectiva, () => perfilDeLaFicha(id));
  return ok({ campos: r.filas, falta: r.falta });
}
