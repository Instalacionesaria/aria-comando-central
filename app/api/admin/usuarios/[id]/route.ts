// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
// ADR-0502 — Nadie se borra, desactiva ni degrada a sí mismo.
//
// Editar un usuario. **Dominio del INQUILINO**, y ahí está todo el punto de este archivo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTA OPERACIÓN NO USA `conIdentidad(`
//
// El `09` § 2 —que `EJECUCION` § 4 llama *"el más importante"*— lo dice después del bloque de
// credenciales:
//
//   "Con los permisos y la política de arriba, **editar y desactivar recuperan la red de la
//    base.** Quedan en el dominio de identidad solo las tres operaciones que tocan credenciales:
//    el alta, el restablecimiento y la asignación de roles."
//
// La migración 002 ya puso lo que hace falta: `grant update (nombre, activo) on identidad.usuarios
// to app_inquilino` y la política `usuarios_edita_inquilino`.
//
// Consecuencia concreta y verificable: **la consulta de abajo NO lleva `where org_id`**, y no es un
// olvido. Lo pone la política. El 404 sale de que la actualización toca **cero filas** — no de un
// condicional que alguien puede quitar.
//
// Y por eso este archivo **no está** en `ARCHIVOS_AUTORIZADOS`. Agregarlo por costumbre rompe la
// prueba de la Etapa 2, que es exactamente lo que tiene que pasar.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../../lib/datos/contexto.ts';
import { auditarAdministracion } from '../../../../../lib/autenticacion/auditoria.ts';

export async function PATCH(
  peticion: Request,
  ctx: RouteContext<'/api/admin/usuarios/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.editar']);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ editado: false, motivo: 'cuerpo_invalido' }, 400);
  }
  const nombre = (cuerpo as { nombre?: unknown } | null)?.nombre;
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return ok({ editado: false, motivo: 'falta_nombre' }, 400);
  }

  // Un id mal formado se responde como no encontrado, no como 400: distinguirlos es un oráculo
  // débil pero gratis de cerrar, y sin esta guarda la consulta lanza `invalid input syntax for
  // type uuid` y el 500 que sale dice más que un 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return rechazo('no_encontrado');
  }

  const tocadas = await conOrganizacion(contexto.orgEfectiva, async () => {
    const r = await datos()
      .updateTable('usuarios')
      .set({ nombre: nombre.trim() })
      // SIN `where org_id`. Lo pone la política `usuarios_edita_inquilino`, y por eso este 404 no
      // depende de que nadie borre una línea.
      .where('id', '=', id)
      .executeTakeFirst();

    if (r.numUpdatedRows === 0n) return 0n;

    // La auditoría va en LA MISMA TRANSACCIÓN, por el mismo rol. `app_inquilino` tiene `insert`
    // sobre `auditoria_accesos` (migración 005) y su política exige `org_id = app.org_id`, que acá
    // se cumple por construcción.
    //
    // Que sea la misma transacción no es comodidad: si fuera una segunda llamada por
    // `conIdentidad`, existiría el caso "la edición ocurrió y no quedó registrada", que es la
    // falta de atomicidad entre dominios del `09` § 6. Acá o van las dos o no va ninguna.
    await auditarAdministracion(datos(), {
      accion: 'usuario_editado',
      actor: contexto.usuarioId,
      objetivo: id,
      orgId: contexto.orgEfectiva,
    });
    return r.numUpdatedRows;
  });

  // Cero filas es 404, y cubre los dos casos con la misma respuesta: no existe, o es de otra
  // organización. Que sean indistinguibles ES el requisito (*"un 403 confirma que ese
  // identificador existe"*).
  if (tocadas === 0n) return rechazo('no_encontrado');

  return ok({ editado: true });
}
