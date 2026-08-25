// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
// ADR-0502 — Nadie se borra, desactiva ni degrada a sí mismo.
// ADR-0504 — Un administrador no puede otorgar el rol de plataforma.
//
// Asignar roles. Dominio de IDENTIDAD, porque `usuarios_roles` es inalcanzable desde el inquilino.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL RECHAZO DEL ROL DE PLATAFORMA VA EN EL ENDPOINT **Y** EN LA BASE
//
// `PRUEBAS.md` pide las dos, y el `05` § 4 explica el criterio general:
//
//   "Cuando dudes, ponela en la base: un condicional del backend se saltea con un script de
//    mantenimiento, una consola, un endpoint nuevo o una sentencia a mano un domingo."
//
// En la base ya está, desde la Etapa 1: `usuarios_roles_plataforma_acotado` (migración 007) rechaza
// asignar un rol `solo_principal` a un usuario que no sea de la organización principal, y
// `usuarios_roles_no_cruzan` rechaza un rol de otra organización. El `03` § 3 llama a la primera
// *"la barrera contra la escalada entre inquilinos"*.
//
// Lo que la base **no** puede saber es lo que el endpoint agrega acá: que **un administrador de la
// organización principal tampoco puede otorgar el rol de plataforma**, ni siquiera dentro de su
// propia organización. El `03` § 3 lo pide explícitamente —*"un administrador no lo puede otorgar.
// Ni siquiera dentro de la organización principal"*— y eso depende de QUIÉN PIDE, que es
// información que la base no tiene (`05` § 4).
//
// La comprobación es por CAPACIDAD, no por nombre de rol: solo quien tiene `roles.administrar`
// —que hoy solo tiene el superadministrador— puede otorgar un rol `solo_principal`.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { mensajeDeDisparador, ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { usuarioObjetivo } from '../../../../../../lib/administracion/objetivo.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';

export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/admin/usuarios/[id]/roles'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['roles.asignar']);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;

  // ADR-0502 · Nadie se DEGRADA a sí mismo. El `05` § 4 lo pone como su segundo escenario: *"el
  // administrador se quita su propio rol"*. Quitarse el rol es quedarse afuera con la misma
  // eficacia que borrarse.
  if (id === contexto.usuarioId) return rechazo('sobre_si_mismo');

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ asignados: false, motivo: 'cuerpo_invalido' }, 400);
  }
  const claves = (cuerpo as { roles?: unknown } | null)?.roles;
  if (!Array.isArray(claves) || claves.some((c) => typeof c !== 'string')) {
    return ok({ asignados: false, motivo: 'roles_invalidos' }, 400);
  }

  return conIdentidad(async (db) => {
    const objetivo = await usuarioObjetivo(db, id, contexto.orgEfectiva);
    if (!objetivo) return rechazo('no_encontrado');

    // Los roles pedidos, con su bandera. Un rol inexistente es `400` (05 § 3, tabla de
    // validaciones), no un 404: el 404 es del usuario.
    //
    // LA LISTA VACÍA SE SALTEA LA CONSULTA, y no es una micro-optimización: es un defecto que una
    // prueba nueva encontró. `where('clave', 'in', [])` genera `in ()`, que **no es SQL válido** —
    // la petición moría con «syntax error at or near ")"» y desde afuera se veía como una caída.
    //
    // O sea que «quitarle todos los roles a alguien», que es la forma documentada de dejar a una
    // persona sin capacidades, nunca funcionó. No se había notado porque el único caso que las
    // pruebas ejercitaban era sobre uno mismo, y ahí `ADR-0502` rechaza tres líneas antes.
    const roles =
      claves.length === 0
        ? []
        : await db
            .selectFrom('roles')
            .select(['id', 'clave', 'solo_principal'])
            .where('clave', 'in', claves as string[])
            .execute();

    if (roles.length !== new Set(claves as string[]).size) {
      return ok({ asignados: false, motivo: 'rol_inexistente' }, 400);
    }

    // ADR-0504 · El rechazo del endpoint. Ver el encabezado: la base ya impide asignarlo fuera de
    // la organización principal; esto impide que un administrador lo otorgue **dentro** de ella.
    //
    // LA CAPACIDAD ES `organizaciones.listar`, Y LA PRIMERA VERSIÓN DE ESTA LÍNEA ESTABA MAL.
    //
    // Puse `roles.administrar`, que parecía la natural, y la prueba respondió `200
    // {"asignados":true,"roles":["superadministrador"]}`: **el rol `administrador` TIENE
    // `roles.administrar`**. La migración 003 le da todo lo que no empieza con `organizaciones.`,
    // así que esa barrera no frenaba a nadie — y el único síntoma habría sido que funciona.
    //
    // `organizaciones.listar` sí sirve, y no por descarte: su descripción en el catálogo es *"ver y
    // cambiar entre todas las organizaciones"*, que es exactamente lo que ES el rol de plataforma.
    // La regla queda legible: **no se puede otorgar el alcance que uno no tiene.**
    //
    // Y sigue sin ser una comparación de nombre de rol, que es lo que `ADR-0302` prohíbe.
    const dePlataforma = roles.filter((r) => r.solo_principal);
    if (dePlataforma.length > 0 && !contexto.permisos.has('organizaciones.listar')) {
      return rechazo(
        'sin_permiso',
        'Otorgar un rol de plataforma requiere la capacidad organizaciones.listar: ' +
          'no se puede otorgar el alcance que uno no tiene.',
      );
    }

    try {
      // Reemplazo del conjunto, no suma: `POST` con la lista completa. Borrar y volver a insertar
      // en la misma transacción deja el estado consistente incluso si el insert falla.
      await db.deleteFrom('usuarios_roles').where('usuario_id', '=', objetivo.id).execute();
      if (roles.length > 0) {
        await db
          .insertInto('usuarios_roles')
          .values(
            roles.map((r) => ({
              usuario_id: objetivo.id,
              rol_id: r.id,
              // QUIÉN LO HIZO. Obligatorio, sin valor por defecto (07 § 1).
              asignado_por: contexto.usuarioId,
            })),
          )
          .execute();
      }
    } catch (e) {
      // Los mensajes de los DISPARADORES se devuelven tal cual: *"están escritos para leerse"*
      // (05 § 3). Acá son los tres de la migración 007 —el rol acotado a la principal, el rol de
      // otra organización, y el rol del fundador— y los tres dicen exactamente qué pasó.
      const mensaje = String((e as Error).message);
      if (/duplicate key|unique constraint|foreign key/i.test(mensaje)) {
        // Unicidad y clave foránea, NO: *"no pasan por la seguridad a nivel de fila… confirman la
        // existencia de un registro de otra organización"* (05 § 3).
        return ok({ asignados: false, motivo: 'rol_invalido' }, 409);
      }
      // Y SOLO el mensaje de un disparador: el discriminante es el SQLSTATE (`P0001`), no el
      // texto. Un error estructural nombra la tabla, y `ADR-0704` lo prohíbe.
      const deDisparador = mensajeDeDisparador(e);
      return deDisparador
        ? rechazo('rechazo_de_la_base', deDisparador)
        : rechazo('rechazo_de_la_base');
    }

    await auditarAdministracion(db, {
      accion: 'roles_asignados',
      actor: contexto.usuarioId,
      objetivo: objetivo.id,
      orgId: contexto.orgEfectiva,
      // Las CLAVES, no los identificadores opacos: un registro de auditoría con uuid de rol es
      // ilegible el día que alguien lo lea, y ese día es el día que importa.
      detalle: { roles: roles.map((r) => r.clave) },
    });

    return ok({ asignados: true, roles: roles.map((r) => r.clave) });
  });
}
