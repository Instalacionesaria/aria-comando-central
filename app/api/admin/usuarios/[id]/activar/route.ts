// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
//
// Reactivar un usuario. Es la inversa exacta de `desactivar`, y no existía.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES UN DEFECTO Y NO UNA FUNCIÓN NUEVA
//
// Medido: el único `set({ activo: … })` de todo el código ponía `false`. No había ninguna ruta que
// pusiera `true`, ni un `activar/`, ni una bandera en el `PATCH`. **Un usuario desactivado no se
// podía volver a activar por la aplicación** — solo con una sentencia a mano contra la base.
//
// Y la base ya estaba lista: `grant update (nombre, activo)` incluye `activo` en las dos
// direcciones desde la migración 002. Lo que faltaba era la puerta.
//
// El `03` § 5 lo llama por su nombre: **un estado sin salida es un defecto.** Desactivar a alguien
// por error dejaba a esa persona fuera para siempre desde el punto de vista del producto.
//
// ── LA MISMA CAPACIDAD, Y NO UNA NUEVA ──────────────────────────────────────
//
// `usuarios.desactivar`. Es la misma autoridad —*"puede decidir quién trabaja acá"*— aplicada en el
// otro sentido, y partirla en dos daría un rol capaz de sacar gente y no de devolverla, que es
// precisamente el estado sin salida que esto viene a cerrar.
//
// ── LAS DOS GUARDAS DE `desactivar` QUE ACÁ NO VAN, Y POR QUÉ ────────────────
//
// **`ADR-0502` (nadie sobre sí mismo)** no aplica: para pedir esto hace falta una sesión, y
// `resolverSesion()` filtra por `u.activo = true`. Quien está inactivo no tiene sesión con la que
// pedir nada, así que «reactivarse a sí mismo» no es un caso alcanzable — y si lo pide sobre sí
// mismo estando activo, la operación es un no-op honesto.
//
// **`ADR-0503` (no dejar la organización sin administrador)** tampoco: activar a alguien no puede
// dejar a nadie afuera. Contar administradores acá sería una comprobación que nunca rechaza.
//
// Que las dos falten es una decisión, no un olvido, y por eso está escrito.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../../../lib/datos/contexto.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/admin/usuarios/[id]/activar'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.desactivar']);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  // Por el DOMINIO DEL INQUILINO, igual que editar y desactivar. Sin `where org_id`: lo pone la
  // política `usuarios_edita_inquilino`, y el 404 sale de que se tocan cero filas. Es la red que
  // el `09` § 7.16 pide para estas operaciones, y la que hace que no exista una línea de la que
  // alguien pueda olvidarse.
  const tocadas = await conOrganizacion(contexto.orgEfectiva, async () => {
    const r = await datos()
      .updateTable('usuarios')
      .set({ activo: true })
      .where('id', '=', id)
      .executeTakeFirst();
    if (r.numUpdatedRows === 0n) return 0n;

    await auditarAdministracion(datos(), {
      accion: 'usuario_activado',
      actor: contexto.usuarioId,
      objetivo: id,
      orgId: contexto.orgEfectiva,
    });
    return r.numUpdatedRows;
  });

  if (tocadas === 0n) return rechazo('no_encontrado');

  // No se dice nada de sesiones, y es correcto: activar no crea ninguna. La persona vuelve a poder
  // entrar con su contraseña, que es lo que tenía. Si no la recuerda, el camino es restablecerla.
  return ok({ activado: true });
}
