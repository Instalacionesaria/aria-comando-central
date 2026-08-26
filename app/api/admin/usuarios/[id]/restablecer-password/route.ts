// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
// ADR-0505 — Restablecer una contraseña cierra las sesiones.
// ADR-0506 — La contraseña temporal nunca queda registrada.
//
// Restablecer una contraseña. **El único camino literal de toda la Etapa 5.**
//
//     POST /admin/usuarios/{id}/restablecer-password     requiere: usuarios.editar
//
// Es la única aparición de un camino de administración en los catorce documentos (`05` § 5). Los
// otros cuatro se inventaron siguiendo su forma, y eso está declarado en `docs/ETAPA-5.md`.
//
// Nótese que **comparte capacidad con editar** —`usuarios.editar`, no una propia— y eso es del
// documento, no una simplificación. Inventar `usuarios.restablecer` rompería la prueba que cruza
// `CAPACIDADES` contra `identidad.permisos` en las dos direcciones.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS CINCO PASOS DEL `05` § 5, EN ORDEN
//
//   1. Genera una temporal nueva (§ 3).
//   2. La guarda hasheada y marca "debe cambiar la contraseña".
//   3. **Cierra todas las sesiones de ese usuario.** *"Si el motivo del restablecimiento es que le
//      robaron la cuenta, dejar las sesiones vivas no arregla nada."*
//   4. La devuelve **una sola vez** en la respuesta.
//   5. Audita la acción, con quién la pidió. **Sin la contraseña.**
//
// Los cinco pasos van en UNA transacción de identidad, y ahí se ve por qué esta operación quedó en
// ese dominio y no en el del inquilino: el paso 3 toca `identidad.sesiones`, que el rol del
// inquilino no puede ni leer. Partirla sería la falta de atomicidad del `09` § 6 en su peor forma
// —contraseña cambiada, sesiones vivas— y el `05` § 5 dice que eso *"no arregla nada"*.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { hashear } from '../../../../../../lib/datos/hash.ts';
import { contrasenaTemporal } from '../../../../../../lib/autenticacion/temporal.ts';
import { usuarioObjetivo } from '../../../../../../lib/administracion/objetivo.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';

export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/admin/usuarios/[id]/restablecer-password'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.editar'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;

  // Restablecerse la propia contraseña **no** es esta operación: para eso está
  // `POST /api/auth/sesion`, que pide la actual. Dejarlo pasar acá sería un camino para cambiarse
  // la contraseña sin saber la vieja, desde una sesión robada.
  if (id === contexto.usuarioId) return rechazo('sobre_si_mismo');

  const temporal = contrasenaTemporal();

  return conIdentidad(async (db) => {
    // EL FILTRO POR ORGANIZACIÓN, por la única función que lo tiene. La política de identidad es
    // `using (true)`: acá no hay red abajo.
    const objetivo = await usuarioObjetivo(db, id, contexto.orgEfectiva);
    if (!objetivo) return rechazo('no_encontrado');

    // La contraseña del administrador fundador SÍ se puede restablecer. El `05` § 4 lo dice
    // aparte y con su motivo: *"lo inmutable es QUIÉN ES y QUÉ PUEDE HACER, no su credencial: si
    // no se pudiera rotar, una filtración sería permanente."*

    await db
      .updateTable('usuarios')
      .set({
        password_hash: hashear(temporal),
        debe_cambiar_password: true,
        // Y el freno se limpia: si la cuenta estaba bloqueada por intentos, el restablecimiento es
        // justamente lo que la desbloquea. Sin esto, se le da una contraseña nueva a alguien que
        // no puede usarla hasta que venza el bloqueo.
        intentos_fallidos: 0,
        bloqueado_hasta: null,
      })
      .where('id', '=', objetivo.id)
      .execute();

    // Paso 3 · TODAS las sesiones. Sin excepción para la actual: quien restablece es otra persona,
    // así que no hay sesión propia que preservar.
    const cerradas = await db
      .deleteFrom('sesiones')
      .where('usuario_id', '=', objetivo.id)
      .executeTakeFirst();

    await auditarAdministracion(db, {
      accion: 'password_restablecida',
      actor: contexto.usuarioId,
      objetivo: objetivo.id,
      orgId: contexto.orgEfectiva,
      // SIN la contraseña. El tipo `Detalle` no tiene campo donde quepa.
    });

    return ok({
      restablecida: true,
      temporal,
      seMuestraUnaVez: true,
      sesionesCerradas: Number(cerradas.numDeletedRows),
    });
  });
}
