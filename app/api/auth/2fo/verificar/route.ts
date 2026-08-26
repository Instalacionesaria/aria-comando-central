// ADR-0301 — Toda operación llama al portero.
// ADR-0411 — La sesión a medio autenticar no llega a nada real.
//
// Verifica el código del segundo factor en cada inicio de sesión.
//
// Es la única ruta específica del estado `pendiente_2fo`, o sea la única salida de una sesión
// que existe **sin haber probado la identidad completa**.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL CÓDIGO FALLA N VECES Y LA SESIÓN SE DESTRUYE
//
// El `02` § 2 lo pone en la tabla del régimen de la sesión a medio autenticar: *"el código falla
// N veces → SE DESTRUYE. Si no, es un código de seis dígitos con intentos infinitos."*
//
// La especificación no fija N. Se eligen **tres**: con seis dígitos y ±1 ventana de tolerancia
// hay ~3 millones de combinaciones, así que tres intentos por sesión de cinco minutos deja la
// fuerza bruta fuera de escala, y tres alcanza para quien tipeó mal.
//
// El contador no tiene columna, así que se cuenta sobre la auditoría — desde que la sesión se
// creó, para que los fallos de una sesión anterior no cuenten contra ésta. Al llegar al tope la
// fila de sesión se borra y la persona vuelve al login.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir, NINGUNA } from '../../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { descifrar } from '../../../../../lib/credenciales/cifrado.ts';
import { verificar as verificarHash } from '../../../../../lib/datos/hash.ts';
import { codigoValido } from '../../../../../lib/autenticacion/totp.ts';
import { estadoQueCorresponde } from '../../../../../lib/autenticacion/estado.ts';
import { auditar } from '../../../../../lib/autenticacion/auditoria.ts';

/** Cuántos códigos fallidos destruyen la sesión pendiente. */
export const TOPE_DE_CODIGOS = 3;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, NINGUNA, SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return ok({ verificado: false, motivo: 'cuerpo_invalido' }, 400);
  }
  const codigo = (cuerpo as { codigo?: unknown } | null)?.codigo;
  if (typeof codigo !== 'string') {
    return ok({ verificado: false, motivo: 'cuerpo_invalido' }, 400);
  }

  return conIdentidad(async (db) => {
    const fila = await db
      .selectFrom('usuarios_segundo_factor')
      .select(['secreto_cifrado', 'confirmado_el', 'respaldos_hash'])
      .where('usuario_id', '=', contexto.usuarioId)
      .where('confirmado_el', 'is not', null)
      .executeTakeFirst();

    // Sin factor confirmado no hay nada que verificar. Llegar acá significa que el estado y los
    // datos no coinciden, así que se dice en vez de responder algo plausible.
    if (!fila) return ok({ verificado: false, motivo: 'sin_factor_confirmado' }, 409);

    const porCodigo = codigoValido(descifrar(fila.secreto_cifrado), codigo);

    // Un código de respaldo también sirve, y se compara con el hash LENTO porque es un secreto
    // de baja entropía. Se recorren TODOS —no se corta en el primero que coincide— por la misma
    // razón que en el resto del sistema.
    let indiceUsado = -1;
    (fila.respaldos_hash ?? []).forEach((h, i) => {
      if (verificarHash(codigo.replace(/\s/g, '').toUpperCase(), h)) indiceUsado = i;
    });
    const porRespaldo = indiceUsado >= 0;

    if (!porCodigo && !porRespaldo) {
      await auditar(db, {
        accion: 'segundo_factor_fallido',
        usuarioId: contexto.usuarioId,
        orgId: contexto.orgPropia,
      });

      const fallidos = await db
        .selectFrom('auditoria_accesos')
        .select((eb) => eb.fn.countAll<string>().as('n'))
        .where('usuario_id', '=', contexto.usuarioId)
        .where('accion', '=', 'segundo_factor_fallido')
        // Desde que ESTA sesión se creó: los fallos de una sesión anterior no cuentan.
        .where('creado_el', '>=', contexto.creadaEl)
        .executeTakeFirst();

      if (Number(fallidos?.n ?? 0) >= TOPE_DE_CODIGOS) {
        // La sesión se DESTRUYE. Sin esto es un código de seis dígitos con intentos infinitos.
        await db.deleteFrom('sesiones').where('id', '=', contexto.sesionId).execute();
        return rechazo('sin_sesion', 'Demasiados códigos incorrectos. Volvé a iniciar sesión.');
      }
      return rechazo('credenciales_invalidas', 'El código no es válido.');
    }

    // Un código de respaldo se CONSUME: se saca del arreglo.
    if (porRespaldo) {
      const quedan = (fila.respaldos_hash ?? []).filter((_, i) => i !== indiceUsado);
      await db
        .updateTable('usuarios_segundo_factor')
        .set({ respaldos_hash: quedan })
        .where('usuario_id', '=', contexto.usuarioId)
        .execute();
    }

    // "El siguiente estado que corresponda", no `activa`: quien entró con contraseña temporal
    // Y un rol que exige segundo factor pasa por dos estados (02 § 5).
    const estado = await estadoQueCorresponde(db, contexto.usuarioId, { yaProboElFactor: true });

    // Y la sesión pasa al régimen normal. Dejó de ser una sesión sin identidad probada, así que
    // los cinco minutos ya no corresponden — sin esta línea, la sesión se vence a los cinco
    // minutos de haber entrado bien, y el síntoma es "me echa todo el tiempo".
    await db
      .updateTable('sesiones')
      .set({
        estado,
        expira_el: sqlSieteDias(),
        expira_absoluto: sqlTreintaDias(),
      })
      .where('id', '=', contexto.sesionId)
      .execute();

    await auditar(db, {
      accion: 'segundo_factor_verificado',
      usuarioId: contexto.usuarioId,
      orgId: contexto.orgPropia,
      detalle: { estado },
    });

    return ok({ verificado: true, estado, porRespaldo });
  });
}

/**
 * Los plazos del régimen normal.
 *
 * Se calculan con el reloj del PROCESO y no de la base, y es la única vez en todo el sistema.
 * El motivo: los dos valores son plazos *nuevos* que se están estableciendo, no comparaciones
 * —y toda comparación de vencimiento sigue pasando por `now()` de la base, que es donde importa
 * que el reloj sea uno solo—. Un minuto de deriva acá mueve un vencimiento de siete días en un
 * minuto; en una comparación, decidiría si una sesión vencida sigue valiendo.
 */
function sqlSieteDias(): Date {
  return new Date(Date.now() + 7 * 24 * 3600 * 1000);
}
function sqlTreintaDias(): Date {
  return new Date(Date.now() + 30 * 24 * 3600 * 1000);
}
