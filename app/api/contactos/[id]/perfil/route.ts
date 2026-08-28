// La pestaña Perfil de la ficha. Los datos del contacto, agrupados por lo que SIGNIFICAN y no por el formulario del que salieron.
//
// Cero llamadas al CRM: sale de la caché. `contactos.ver`, la MISMA capacidad que las otras cuatro
// pestañas, porque son una sola pantalla y `ADR-0304` lo exige.

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../../lib/datos/contexto.ts';
import { existeElContacto, perfilDeLaFicha } from '../../../../../lib/negocio/ficha.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/perfil'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.ver'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  /* El contacto tiene que existir EN ESTA ORGANIZACIÓN, y las dos consultas van en el MISMO
     contexto de inquilino: comprobar afuera y consultar adentro deja una ventana en la que el
     contexto podría no ser el mismo, y el 404 pasaría a depender de cuál ganó.

     Sin esta guarda la respuesta era `200` con la lista vacía —y con un `falta` que inventaba el
     motivo—. Ver `existeElContacto` en `lib/negocio/ficha.ts`. */
  const r = await conOrganizacion(contexto.orgEfectiva, async () =>
    (await existeElContacto(id)) ? perfilDeLaFicha(id) : null,
  );
  if (r === null) return rechazo('no_encontrado');

  return ok({ campos: r.filas, falta: r.falta });
}
