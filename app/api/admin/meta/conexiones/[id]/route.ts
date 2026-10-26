// `DELETE /api/admin/meta/conexiones/[id]` — desconecta un negocio de Meta.
//
// Borra la conexión, y con ella su token y sus cuentas (la clave foránea es en cascada): desde la próxima pasada esas
// cuentas no se leen. Lo ya traído de Meta (campañas, gasto) se queda en la base: era del cliente y sigue siéndolo. Para
// que Meta tampoco le dé más acceso a la app, el negocio quita la integración en su Business Manager (Integraciones ›
// Apps conectadas); el aviso de desautorización de Meta llega después y no encuentra nada que borrar.
import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { vistaDeMeta } from '../../../../../../lib/meta/conexiones.ts';

export const PANTALLA = 'credenciales';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(peticion: Request, ctx: RouteContext<'/api/admin/meta/conexiones/[id]'>): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  return conIdentidad(async (db) => {
    const borrada = await db
      .deleteFrom('conexiones_de_meta')
      .where('org_id', '=', contexto.orgEfectiva)
      .where('id', '=', id)
      .returning('cuenta_id')
      .executeTakeFirst();
    if (!borrada) return rechazo('no_encontrado');
    await auditarAdministracion(db, {
      accion: 'meta_desconectada',
      actor: contexto.usuarioId,
      objetivo: borrada.cuenta_id ?? contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
    });
    return ok(await vistaDeMeta(db, contexto.orgEfectiva));
  });
}
