// ADR-0301 — Toda operación llama al portero.
// ADR-0413 — Un usuario con un rol que exige segundo factor no obtiene sesión habilitada.
//
// Confirma el alta del segundo factor con el primer código válido.
//
// Es la transición `debe_configurar_2fo` → `activa` de la tabla del `02` § 5. Y acá gana la
// TABLA sobre la regla del recálculo, que es una contradicción del propio § 5: recalcular con
// las cuatro ramas devolvería `pendiente_2fo` —el factor acaba de quedar confirmado— y la
// cuenta entraría en un bucle donde quien acaba de probar el código tendría que probarlo otra
// vez. Por eso `yaProboElFactor`.
//
// Los códigos de respaldo se devuelven UNA vez, en claro, y se guardan hasheados con el
// algoritmo LENTO: son secretos de baja entropía escritos por una persona, al contrario que el
// token de sesión.

import { exigir, NINGUNA } from '../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { descifrar } from '../../../../../lib/credenciales/cifrado.ts';
import { hashear } from '../../../../../lib/datos/hash.ts';
import { codigoValido, respaldosNuevos } from '../../../../../lib/autenticacion/totp.ts';
import { estadoQueCorresponde } from '../../../../../lib/autenticacion/estado.ts';
import { auditar } from '../../../../../lib/autenticacion/auditoria.ts';

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, NINGUNA, SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ confirmado: false, motivo: 'cuerpo_invalido' }, 400);
  }
  const codigo = (cuerpo as { codigo?: unknown } | null)?.codigo;
  if (typeof codigo !== 'string') {
    return ok({ confirmado: false, motivo: 'cuerpo_invalido' }, 400);
  }

  return conIdentidad(async (db) => {
    const fila = await db
      .selectFrom('usuarios_segundo_factor')
      .select(['secreto_cifrado', 'confirmado_el'])
      .where('usuario_id', '=', contexto.usuarioId)
      .executeTakeFirst();

    if (!fila) return ok({ confirmado: false, motivo: 'sin_alta_empezada' }, 409);
    // Una segunda confirmación sobre un factor ya confirmado no es un error del usuario, pero
    // tampoco puede rehacer nada: el secreto ya está inscripto en un dispositivo.
    if (fila.confirmado_el) return ok({ confirmado: false, motivo: 'ya_confirmado' }, 409);

    // `descifrar` LANZA si la clave maestra cambió, con un mensaje que dice qué hacer. No
    // devuelve vacío: un secreto vacío haría que ningún código coincidiera nunca y el síntoma
    // sería "el código no funciona".
    if (!codigoValido(descifrar(fila.secreto_cifrado), codigo)) {
      return rechazo('credenciales_invalidas', 'El código no es válido.');
    }

    const respaldos = respaldosNuevos();

    await db
      .updateTable('usuarios_segundo_factor')
      .set({
        confirmado_el: new Date(),
        // Hasheados con el algoritmo lento, y guardados como arreglo de texto.
        respaldos_hash: respaldos.map((r) => hashear(r)),
      })
      .where('usuario_id', '=', contexto.usuarioId)
      .execute();

    // `yaProboElFactor`: la rama 1 no aplica. Ver el encabezado.
    const estado = await estadoQueCorresponde(db, contexto.usuarioId, { yaProboElFactor: true });
    await db.updateTable('sesiones').set({ estado }).where('id', '=', contexto.sesionId).execute();

    await auditar(db, {
      accion: 'segundo_factor_confirmado',
      usuarioId: contexto.usuarioId,
      orgId: contexto.orgPropia,
      detalle: { estado },
    });

    // Los códigos de respaldo, una sola vez. No hay operación que los vuelva a mostrar.
    return ok({ confirmado: true, estado, respaldos });
  });
}
