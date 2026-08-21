// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
// ADR-0502 — Nadie se borra, desactiva ni degrada a sí mismo.
// ADR-0503 — No se puede dejar una organización sin administrador activo.
//
// Desactivar un usuario. **Se desactiva, no se borra.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// TRES COSAS QUE ESTA OPERACIÓN RESUELVE, Y NINGUNA ES OBVIA
//
// **1 · Por qué no es un `DELETE`.** El `05` § 6: *"lo que hicieron sigue referenciado desde los
// datos de negocio, y borrarlos deja registros huérfanos o fuerza una cascada que destruye
// historia."* Un usuario inactivo *"sigue apareciendo como autor de lo que hizo"*.
//
// **2 · Por qué el conteo de administradores va en el ENDPOINT y no en un disparador.** El `05` § 4
// lo pone en su tabla, literal: *"se borra el último administrador de una organización → **verificación
// en el endpoint**: contar los administradores activos antes de desactivar"*. Y explica el criterio:
//
//   "Las de la base son las que NUNCA deben ocurrir, por ninguna vía: son invariantes del sistema.
//    Las del endpoint son reglas de operación que dependen del contexto (quién está pidiendo qué),
//    y esa información la base no la tiene."
//
// Además, escrito como disparador **no funcionaría**: contar administradores exige leer
// `usuarios_roles`, y `app_inquilino` no tiene ningún acceso a esa tabla. Un disparador
// `security invoker` fallaría con *permission denied*; uno `security definer` propiedad de
// `migrador` devolvería **cero filas**, porque `force row level security` sujeta también al
// propietario y ninguna política nombra a `migrador` — o sea que rechazaría **todas** las
// desactivaciones. Es la trampa del `09` § 2 reapareciendo dentro de un disparador.
//
// **3 · Las sesiones.** El `05` § 6 dice que *"sus sesiones abiertas se cierran al desactivarlo — si
// no, sigue trabajando hasta que venza"*. Y esta operación **no borra ni una fila de `sesiones`**,
// a propósito: `app_inquilino` no puede tocar esa tabla, y hacerlo desde identidad convertiría esto
// en una escritura que cruza los dos dominios, que `EJECUCION` § 2 prohíbe.
//
// La propiedad se cumple igual, y por un camino mejor: `resolverSesion()` filtra con
// `.where('u.activo', '=', true)`. La sesión **deja de valer en la petición siguiente**, sin
// depender de una escritura que puede fallar. Hay una prueba que lo demuestra de punta a punta.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../../../lib/datos/contexto.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { auditarAdministracion } from '../../../../../../lib/autenticacion/auditoria.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/admin/usuarios/[id]/desactivar'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.desactivar']);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  // ADR-0502 · Nadie se desactiva a sí mismo. Va ANTES de todo lo demás: es la comprobación más
  // barata y la que más se agradece. El `05` § 4 la pone primera en su tabla de *"protecciones
  // contra quedarse afuera"*, y el motivo es el nombre de la sección.
  if (id === contexto.usuarioId) return rechazo('sobre_si_mismo');

  // ADR-0503 · Contar los administradores activos ANTES de desactivar.
  //
  // Esta lectura va por identidad porque `usuarios_roles` es inalcanzable desde el inquilino. Es
  // una LECTURA en otro dominio, no una escritura: `EJECUCION` § 2 prohíbe las escrituras que
  // cruzan, por la falta de atomicidad, y acá no hay una segunda mitad que pueda confirmar.
  //
  // La carrera existe y hay que decirla: entre este conteo y la escritura de abajo, otra petición
  // podría desactivar al otro administrador y dejar la organización sin ninguno. A la escala del
  // `EJECUCION` § 1 —*"hasta 3 usuarios por organización, decenas de peticiones simultáneas"*— eso
  // exige dos administradores desactivándose mutuamente en el mismo instante. Se acepta a la
  // vista; cerrarla pediría un bloqueo sobre la organización, que es la clase de solución que
  // `EJECUCION` § 1 dice que no se implementa.
  const esAdministrador = await conIdentidad(async (db) => {
    const suyos = await db
      .selectFrom('usuarios_roles as ur')
      .innerJoin('roles as r', 'r.id', 'ur.rol_id')
      .select('r.clave')
      .where('ur.usuario_id', '=', id)
      .execute();
    if (suyos.length === 0) return false;

    // "Administrador" para esta regla = **alguien con `usuarios.crear`**, no un nombre de rol.
    //
    // DECISIÓN: ningún documento define qué es "un administrador activo" para esta regla. Se usa la
    // CAPACIDAD y no la clave del rol, porque comparar `clave === 'administrador'` es exactamente
    // lo que `ADR-0302` prohíbe —*"si de verdad es un caso especial, es una capacidad nueva"*— y
    // porque el día que exista un rol "supervisor" con `usuarios.crear`, la regla lo cuenta solo.
    const conLaCapacidad = await db
      .selectFrom('usuarios as u')
      .innerJoin('usuarios_permisos as up', 'up.usuario_id', 'u.id')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('u.org_id', '=', contexto.orgEfectiva)
      .where('u.activo', '=', true)
      .where('u.id', '!=', id)
      .where('up.permiso', '=', 'usuarios.crear')
      .executeTakeFirst();

    const quedan = Number(conLaCapacidad?.n ?? 0);
    // ¿El objetivo es administrador? Solo entonces importa cuántos quedan.
    const objetivoEsAdmin = await db
      .selectFrom('usuarios_permisos')
      .select('permiso')
      .where('usuario_id', '=', id)
      .where('permiso', '=', 'usuarios.crear')
      .executeTakeFirst();

    return objetivoEsAdmin !== undefined && quedan === 0;
  });

  if (esAdministrador) return rechazo('ultimo_administrador');

  // Y la escritura, por el DOMINIO DEL INQUILINO. Sin `where org_id`: lo pone la política
  // `usuarios_edita_inquilino`, y el 404 sale de que se tocan cero filas. Ver
  // `lib/administracion/objetivo.ts` para el mapa de los dos mecanismos.
  const tocadas = await conOrganizacion(contexto.orgEfectiva, async () => {
    const r = await datos()
      .updateTable('usuarios')
      .set({ activo: false })
      .where('id', '=', id)
      .executeTakeFirst();
    if (r.numUpdatedRows === 0n) return 0n;

    await auditarAdministracion(datos(), {
      accion: 'usuario_desactivado',
      actor: contexto.usuarioId,
      objetivo: id,
      orgId: contexto.orgEfectiva,
    });
    return r.numUpdatedRows;
  });

  if (tocadas === 0n) return rechazo('no_encontrado');

  return ok({
    desactivado: true,
    // Se dice explícitamente, porque es la parte que no es obvia leyendo el código: la sesión del
    // usuario desactivado deja de valer en la petición siguiente, sin que nadie borre nada.
    sesionesInvalidadas: true,
  });
}
