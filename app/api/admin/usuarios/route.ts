// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
// ADR-0506 — La contraseña temporal nunca queda registrada.
//
// Alta de usuario. Dominio de IDENTIDAD: genera el hash de la contraseña temporal.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL 404 DE UN ALTA, QUE ES EL CASO QUE LA ESPECIFICACIÓN NO CONTEMPLA
//
// La fila ⛔ pide 404 en las cinco operaciones *"con el identificador de un usuario ajeno"* — y en
// un alta **no hay usuario objetivo**. Ningún documento dice cuál es el identificador ajeno del
// alta.
//
// DECISIÓN: el alta acepta un `orgId` opcional, y responde 404 cuando no es una organización sobre
// la que quien pide tenga alcance. Con eso el 404 del alta sale del mismo lugar que los otros
// cuatro —la organización efectiva— y no hace falta un condicional propio. La alternativa que se
// descartó era leer el 404 del `rol_id` ajeno, que choca con el `05` § 3: ahí el rechazo del
// disparador `usuarios_roles_no_cruzan` es un 409 con el mensaje de la base, no un 404.
//
// ── EL ROL DE PLATAFORMA SÍ PUEDE ELEGIR LA EMPRESA, Y ESO CAMBIÓ ────────────
//
// Hasta la Etapa 12 este archivo decía: *"El rol de plataforma no necesita `orgId` para crear en
// otra organización: cambia su organización activa y `orgEfectiva` lo sigue. Un segundo camino
// sería un segundo lugar donde olvidarse el filtro."*
//
// El razonamiento sigue siendo el correcto y **la conclusión se revisó a pedido**: dar de alta a
// alguien de otra empresa obligaba a conmutar la sesión entera —o sea a dejar de mirar la propia—
// para una operación de un minuto. Se pidió elegir la empresa en el formulario.
//
// Lo que se conserva es la parte que importaba: **sigue habiendo un solo lugar que decide**. No es
// un camino paralelo, es un parámetro de éste, y su alcance lo autoriza la MISMA condición que ya
// gobierna el conmutador (`PATCH /api/auth/sesion`) y `puedeCambiarDeEmpresa`:
//
//     contexto.esRolDePlataforma && contexto.permisos.has('organizaciones.listar')
//
// Para todos los demás, un `orgId` distinto del propio sigue siendo 404, exactamente como antes.
// Quien no puede ver otras empresas tampoco puede nombrarlas.
//
// ── Y EL ROL VIAJA EN LA MISMA LLAMADA ──────────────────────────────────────
//
// Antes eran dos peticiones: crear y después asignar. Entre las dos, la persona existía con cero
// capacidades, y si la segunda fallaba quedaba así —la interfaz tenía que avisarlo con un texto
// que empezaba con «PERO NO». Ahora las dos escrituras van en la misma transacción: o queda con su
// rol o no queda.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../lib/autorizacion/secciones.ts';
import { mensajeDeDisparador, ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { hashear } from '../../../../lib/datos/hash.ts';
import { contrasenaTemporal } from '../../../../lib/autenticacion/temporal.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';

/** No valida direcciones de correo del mundo real: valida que tenga forma de correo (05 § 3). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * El texto de cada rechazo de validación, uno por motivo. Ver el mismo comentario en
 * `app/api/admin/organizaciones/route.ts`: `ok({ creado: false, motivo }, 400)` no llegaba a la
 * pantalla, porque el cliente HTTP solo conserva `codigo` y `detalle` de una respuesta no-ok.
 */
const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  falta_nombre: 'La persona necesita un nombre.',
  email_invalido: 'Ese correo no tiene forma de correo.',
  rol_invalido: 'Ese rol no existe.',
} as const;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.crear'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const c = cuerpo as { nombre?: unknown; email?: unknown; orgId?: unknown; rol?: unknown } | null;
  const nombre = c?.nombre;
  const email = c?.email;
  const orgId = c?.orgId;
  const rol = c?.rol;

  // El orden de las validaciones es el de la tabla del `05` § 3.
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return rechazo('peticion_invalida', MOTIVOS['falta_nombre']);
  }
  if (typeof email !== 'string' || !EMAIL.test(email)) {
    return rechazo('peticion_invalida', MOTIVOS['email_invalido']);
  }
  if (rol !== undefined && rol !== null && (typeof rol !== 'string' || rol.length === 0)) {
    return rechazo('peticion_invalida', MOTIVOS['rol_invalido']);
  }

  // EL 404 DEL ALTA, y la elección de empresa. Ver el encabezado.
  //
  // `puedeElegirEmpresa` es la misma condición que comprueba `PATCH /api/auth/sesion` y la misma
  // que el servidor le contesta al conmutador en `puedeCambiarDeEmpresa`. Se escribe otra vez y no
  // se extrae: son tres usos y el día que dejen de coincidir, la prueba que los cruza lo dice.
  const puedeElegirEmpresa =
    contexto.esRolDePlataforma && contexto.permisos.has('organizaciones.listar');
  const orgDestino = typeof orgId === 'string' && orgId.length > 0 ? orgId : contexto.orgEfectiva;

  if (orgDestino !== contexto.orgEfectiva && !puedeElegirEmpresa) {
    return rechazo('no_encontrado');
  }

  // La genera EL SERVIDOR. El `05` § 3: *"nunca la elige quien crea la cuenta, y nunca la manda el
  // cliente."* Si viniera del cuerpo, el alta sería un canal para poner una contraseña conocida.
  const temporal = contrasenaTemporal();

  return conIdentidad(async (db) => {
    // ¿EXISTE la empresa destino? Solo hace falta preguntarlo cuando no es la propia; para la
    // propia lo garantiza la sesión.
    //
    // Se pregunta en vez de dejar que falle la clave foránea, porque los dos errores no son el
    // mismo hecho: un identificador de empresa que no existe es «no lo encontré» (404), y lo que
    // subiría de la base es un `23503` que acaba en `rechazo_de_la_base` (409) nombrando una
    // tabla. `ADR-0501` pide 404, nunca 403 ni un error estructural.
    if (orgDestino !== contexto.orgEfectiva) {
      const existe = await db
        .selectFrom('organizaciones')
        .select('id')
        .where('id', '=', orgDestino)
        .executeTakeFirst();
      if (!existe) return rechazo('no_encontrado');
    }

    // El rol pedido, si hay. Un rol inexistente es 400 y no 404 — el 404 es de la empresa y de la
    // persona, y `05` § 3 lo pone en la tabla de validaciones.
    let rolDestino: { id: string; solo_principal: boolean } | undefined;
    if (typeof rol === 'string' && rol.length > 0) {
      rolDestino = await db
        .selectFrom('roles')
        .select(['id', 'solo_principal'])
        .where('clave', '=', rol)
        .where('org_id', 'is', null)
        .executeTakeFirst();
      if (!rolDestino) return rechazo('peticion_invalida', MOTIVOS['rol_invalido']);

      // ADR-0504 · el mismo rechazo que `POST /api/admin/usuarios/[id]/roles`, y por el mismo
      // motivo: **no se puede otorgar el alcance que uno no tiene.** Hoy nadie llega acá sin la
      // capacidad —solo el rol de plataforma tiene `usuarios.crear`— y va igual: la regla no puede
      // depender de que el reparto no cambie nunca. La base también lo impide fuera de la
      // organización principal, con el disparador `rol_de_plataforma_acotado`.
      if (rolDestino.solo_principal && !contexto.permisos.has('organizaciones.listar')) {
        return rechazo(
          'sin_permiso',
          'Otorgar un rol de plataforma requiere la capacidad organizaciones.listar: ' +
            'no se puede otorgar el alcance que uno no tiene.',
        );
      }
    }

    let creado: { id: string };
    try {
      creado = await db
        .insertInto('usuarios')
        .values({
          org_id: orgDestino,
          nombre: nombre.trim(),
          email,
          password_hash: hashear(temporal),
          // Nace con la marca. El `05` § 3: *"se guarda hasheada y el usuario nace con la marca de
          // 'debe cambiar la contraseña'"*, que es lo que hace que la temporal sea temporal.
          debe_cambiar_password: true,
          // QUIÉN LO HIZO, obligatorio y sin valor por defecto. El `07` § 1: *"si mañana aparece un
          // llamador nuevo, que no compile hasta que diga quién es."* El caso real que documenta
          // ocurrió con un parámetro que tenía valor por defecto —el id de una persona real— y
          // **todo** lo registrado, de cualquier organización, quedó firmado por esa persona.
          creado_por: contexto.usuarioId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    } catch (e) {
      const mensaje = String((e as Error).message);
      // UNICIDAD: código propio, sin el detalle de la base. El `05` § 3 lo nombra literal
      // (`409`, `email_duplicado`) y explica por qué: el mensaje de la base *"es un canal que
      // confirma la existencia de un registro de otra organización, aunque quien pregunta no
      // pueda verlo"*. Acá eso es exacto — el índice de correo es global.
      if (/duplicate key|unique constraint/i.test(mensaje)) {
        return rechazo('email_duplicado');
      }
      // Los DISPARADORES sí devuelven su mensaje: *"están escritos para leerse"* (05 § 3). Y
      // **solo** ésos: el discriminante es el SQLSTATE (`P0001`), no el texto, porque un error
      // estructural nombra la tabla y `ADR-0704` lo prohíbe.
      const deDisparador = mensajeDeDisparador(e);
      return deDisparador
        ? rechazo('rechazo_de_la_base', deDisparador)
        : rechazo('rechazo_de_la_base');
    }

    // EL ROL, EN LA MISMA TRANSACCIÓN. Ver el encabezado: partido en dos llamadas, entre ellas la
    // persona existía sin ninguna capacidad, y un fallo de la segunda la dejaba así. Acá un fallo
    // deshace también el alta.
    if (rolDestino) {
      try {
        await db
          .insertInto('usuarios_roles')
          .values({
            usuario_id: creado.id,
            rol_id: rolDestino.id,
            // QUIÉN LO HIZO. Obligatorio, sin valor por defecto (07 § 1).
            asignado_por: contexto.usuarioId,
          })
          .execute();
      } catch (e) {
        // Los tres disparadores de la migración 007 que miran esta tabla dicen exactamente qué
        // pasó, así que su mensaje se devuelve tal cual. El discriminante es el SQLSTATE, no el
        // texto: un error estructural nombra la tabla y `ADR-0704` lo prohíbe.
        const deDisparador = mensajeDeDisparador(e);
        return deDisparador
          ? rechazo('rechazo_de_la_base', deDisparador)
          : rechazo('rechazo_de_la_base');
      }
    }

    // El correo SÍ va a la auditoría; la contraseña temporal NUNCA, *"ni ahí"*. El tipo `Detalle`
    // no tiene campo para ella, así que esto no depende de que nadie se olvide.
    //
    // `orgId` es la de DESTINO, no la de la sesión: la auditoría tiene que decir en qué empresa
    // apareció la persona. Con la de la sesión, un alta hecha desde ARIA sobre un cliente quedaría
    // registrada en ARIA y el registro del cliente no la mencionaría.
    await auditarAdministracion(db, {
      accion: 'usuario_creado',
      actor: contexto.usuarioId,
      objetivo: creado.id,
      orgId: orgDestino,
      detalle: { email },
    });

    // La temporal, UNA sola vez. El `05` § 3: *"no se puede volver a consultar: para eso está el
    // restablecimiento, que genera otra."*
    return ok(
      { creado: true, id: creado.id, temporal, seMuestraUnaVez: true, rol: rolDestino ? rol : null },
      201,
    );
  });
}
