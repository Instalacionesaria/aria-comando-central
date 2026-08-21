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
// DECISIÓN: el alta acepta un `orgId` opcional, y responde 404 cuando no es `contexto.orgEfectiva`.
// Con eso el 404 del alta sale del mismo lugar que los otros cuatro —la organización efectiva— y
// no hace falta un condicional propio. La alternativa que se descartó era leer el 404 del `rol_id`
// ajeno, que choca con el `05` § 3: ahí el rechazo del disparador `usuarios_roles_no_cruzan` es un
// 409 con el mensaje de la base, no un 404.
//
// El rol de plataforma no necesita `orgId` para crear en otra organización: cambia su organización
// activa con `PATCH /api/auth/sesion` y `orgEfectiva` lo sigue. Un segundo camino sería un segundo
// lugar donde olvidarse el filtro.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { hashear } from '../../../../lib/datos/hash.ts';
import { contrasenaTemporal } from '../../../../lib/autenticacion/temporal.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';

/** No valida direcciones de correo del mundo real: valida que tenga forma de correo (05 § 3). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['usuarios.crear']);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ creado: false, motivo: 'cuerpo_invalido' }, 400);
  }
  const c = cuerpo as { nombre?: unknown; email?: unknown; orgId?: unknown } | null;
  const nombre = c?.nombre;
  const email = c?.email;
  const orgId = c?.orgId;

  // El orden de las validaciones es el de la tabla del `05` § 3.
  if (typeof nombre !== 'string' || nombre.trim().length === 0) {
    return ok({ creado: false, motivo: 'falta_nombre' }, 400);
  }
  if (typeof email !== 'string' || !EMAIL.test(email)) {
    return ok({ creado: false, motivo: 'email_invalido' }, 400);
  }
  // EL 404 DEL ALTA. Ver el encabezado.
  if (orgId !== undefined && orgId !== contexto.orgEfectiva) {
    return rechazo('no_encontrado');
  }

  // La genera EL SERVIDOR. El `05` § 3: *"nunca la elige quien crea la cuenta, y nunca la manda el
  // cliente."* Si viniera del cuerpo, el alta sería un canal para poner una contraseña conocida.
  const temporal = contrasenaTemporal();

  return conIdentidad(async (db) => {
    let creado: { id: string };
    try {
      creado = await db
        .insertInto('usuarios')
        .values({
          org_id: contexto.orgEfectiva,
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
      // Los DISPARADORES sí devuelven su mensaje: *"están escritos para leerse"* (05 § 3).
      return rechazo('rechazo_de_la_base', mensaje.split('\n')[0]);
    }

    // El correo SÍ va a la auditoría; la contraseña temporal NUNCA, *"ni ahí"*. El tipo `Detalle`
    // no tiene campo para ella, así que esto no depende de que nadie se olvide.
    await auditarAdministracion(db, {
      accion: 'usuario_creado',
      actor: contexto.usuarioId,
      objetivo: creado.id,
      orgId: contexto.orgEfectiva,
      detalle: { email },
    });

    // La temporal, UNA sola vez. El `05` § 3: *"no se puede volver a consultar: para eso está el
    // restablecimiento, que genera otra."*
    return ok({ creado: true, id: creado.id, temporal, seMuestraUnaVez: true }, 201);
  });
}
