// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
// ADR-0502 — Nadie se borra, desactiva ni degrada a sí mismo.
//
// Editar y BORRAR un usuario. **Dominio del INQUILINO**, y ahí está todo el punto de este archivo.
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
//
// ── EL CORREO SE EDITA ACÁ, Y ESO OBLIGÓ A ELEGIR ───────────────────────────
//
// Hasta la Etapa 12 esta ruta editaba **solo el nombre**, porque `email` no estaba entre las
// columnas otorgadas al inquilino. Y un correo mal escrito no es cosmético: la persona no puede
// entrar, y la única salida era borrarla y crearla de nuevo.
//
// La salida fácil era mover la ruta a `conIdentidad()`, donde se puede tocar cualquier columna. Se
// descartó: perdería la red descrita arriba. Se otorgó la columna en su lugar
// (`012_borrar_y_editar.sql`), así que el correo se edita con la política puesta.
//
// ── Y EL BORRADO ────────────────────────────────────────────────────────────
//
// Mismo dominio y por el mismo motivo, que acá pesa más: el peor fallo posible de un borrado es
// borrar a alguien de otra empresa, y con la política eso es inalcanzable — la fila no se ve, el
// `delete` toca cero, sale 404.
//
// Lo que la base permite borrar es poco a propósito: todas las claves foráneas del negocio hacia
// `usuarios` son `no action`, así que quien escribió una nota, registró un resultado, tiene un
// contacto a su nombre o dio de alta a otra persona **no se puede borrar**. Eso no es una
// limitación a sortear: es la trazabilidad, y la operación que corresponde ahí es desactivar.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../lib/autorizacion/secciones.ts';
import { mensajeDeDisparador, ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../../lib/datos/contexto.ts';
import { auditarAdministracion } from '../../../../../lib/autenticacion/auditoria.ts';
import { QUE_LO_IMPIDE, loQueImpideBorrar } from '../../../../../lib/administracion/borrado.ts';

/** No valida direcciones del mundo real: valida que tenga forma de correo. Igual que el alta. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  peticion: Request,
  ctx: RouteContext<'/api/admin/usuarios/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.editar'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ editado: false, motivo: 'cuerpo_invalido' }, 400);
  }
  const c = cuerpo as { nombre?: unknown; email?: unknown } | null;
  const nombre = c?.nombre;
  const email = c?.email;
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return ok({ editado: false, motivo: 'falta_nombre' }, 400);
  }
  // El correo es OPCIONAL: ausente significa «no lo toques», no «vacialo». Es la misma semántica
  // de presencia que usa `PUT /api/admin/credenciales`, y por el mismo motivo — con la otra, un
  // formulario que no incluya el campo lo borraría sin que nadie lo pidiera.
  if (email !== undefined && (typeof email !== 'string' || !EMAIL.test(email))) {
    return ok({ editado: false, motivo: 'email_invalido' }, 400);
  }

  // Un id mal formado se responde como no encontrado, no como 400: distinguirlos es un oráculo
  // débil pero gratis de cerrar, y sin esta guarda la consulta lanza `invalid input syntax for
  // type uuid` y el 500 que sale dice más que un 404.
  if (!UUID.test(id)) {
    return rechazo('no_encontrado');
  }

  let tocadas: bigint;
  try {
    tocadas = await conOrganizacion(contexto.orgEfectiva, async () => {
    const r = await datos()
      .updateTable('usuarios')
      .set({
        nombre: nombre.trim(),
        // Solo si vino. Un `email: undefined` en el objeto haría que kysely lo omita igual, pero
        // decirlo con el condicional deja la intención escrita en vez de depender de eso.
        ...(typeof email === 'string' ? { email } : {}),
      })
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
  } catch (e) {
    const mensaje = String((e as Error).message);
    // UNICIDAD: código propio, sin el detalle de la base. El índice de correo es GLOBAL, así que
    // el mensaje confirmaría la existencia de una fila de otra organización a quien no puede
    // verla. Mismo tratamiento que en el alta, y por la misma razón.
    if (/duplicate key|unique constraint/i.test(mensaje)) return rechazo('email_duplicado');
    // Y el disparador del fundador, que rechaza cambiarle el correo. Su mensaje está escrito para
    // leerse, así que sube tal cual — discriminado por SQLSTATE, no por texto.
    const deDisparador = mensajeDeDisparador(e);
    return deDisparador ? rechazo('rechazo_de_la_base', deDisparador) : rechazo('rechazo_de_la_base');
  }

  // Cero filas es 404, y cubre los dos casos con la misma respuesta: no existe, o es de otra
  // organización. Que sean indistinguibles ES el requisito (*"un 403 confirma que ese
  // identificador existe"*).
  if (tocadas === 0n) return rechazo('no_encontrado');

  return ok({ editado: true });
}

/**
 * Borrar un usuario. Irreversible, y por eso la base lo permite en muy pocos casos.
 *
 * Capacidad propia, `usuarios.borrar`, y no la de desactivar: conceder «puede sacar a alguien de
 * circulación» no puede conceder de paso «puede hacer desaparecer su rastro».
 */
export async function DELETE(
  peticion: Request,
  ctx: RouteContext<'/api/admin/usuarios/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.borrar'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  // ADR-0502 · Nadie se borra a sí mismo. Va primero, igual que en desactivar: es la comprobación
  // más barata y la que más se agradece. Y acá es peor que quedarse afuera — es irreversible.
  if (id === contexto.usuarioId) return rechazo('sobre_si_mismo');

  let tocadas: bigint;
  try {
    tocadas = await conOrganizacion(contexto.orgEfectiva, async () => {
      // La auditoría va ANTES del borrado, y en la misma transacción. Al revés no se puede: la
      // fila de auditoría no referencia al usuario con clave foránea, pero el orden importa por
      // otra cosa — si el borrado falla, la transacción entera se deshace y no queda un registro
      // de algo que no ocurrió. Y si sale bien, queda el rastro de lo único irreversible que el
      // sistema permite, después de que la fila ya no exista.
      await auditarAdministracion(datos(), {
        accion: 'usuario_borrado',
        actor: contexto.usuarioId,
        objetivo: id,
        orgId: contexto.orgEfectiva,
      });

      const r = await datos()
        // SIN `where org_id`, igual que arriba: lo pone la política `usuarios_borra_inquilino` de
        // la migración 012. Es lo que hace imposible borrar a alguien de otra empresa.
        .deleteFrom('usuarios')
        .where('id', '=', id)
        .executeTakeFirst();
      return r.numDeletedRows;
    });
  } catch (e) {
    // Lo que lo impide, en palabras. Ver `lib/administracion/borrado.ts`: el error trae el nombre
    // de la restricción y se traduce a negocio, en vez de subir un mensaje que nombra tablas.
    const porque = loQueImpideBorrar(e, 'persona');
    if (porque) return rechazo('rechazo_de_la_base', porque);
    // El disparador del fundador: *"El administrador principal no se puede eliminar"*. Sube tal
    // cual, porque está escrito para leerse.
    const deDisparador = mensajeDeDisparador(e);
    return deDisparador ? rechazo('rechazo_de_la_base', deDisparador) : rechazo('rechazo_de_la_base');
  }

  if (tocadas === 0n) return rechazo('no_encontrado');

  return ok({ borrado: true });
}
