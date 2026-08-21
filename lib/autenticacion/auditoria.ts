// ADR-0407 — Ninguna ruta de autenticación registra cuerpos. INNEGOCIABLE.
//
// El registro de accesos. UNA sola función lo escribe.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PROPIEDAD ES ESTRUCTURAL, NO UNA DISCIPLINA
//
// La fila ⛔ dice *"ningún archivo de esas rutas pasa el cuerpo a la función de registro"*.
// Acá esa propiedad no depende de que nadie se olvide: **`auditar()` no tiene un parámetro
// donde quepa un cuerpo.** `detalle` es un tipo cerrado con tres campos nombrados, así que
// pasarle el cuerpo de la petición **no compila**.
//
// Por qué importa tanto:
//
//   · una contraseña en claro en un panel de registros **se conserva**, y sobre una tabla
//     inmutable el error es permanente;
//   · *"un registro de contraseñas fallidas es un diccionario de contraseñas reales de tus
//     usuarios, con sus emails al lado"* (comentario de la migración 005);
//   · y el modo de introducirlo no es malicia: es un `console.log(cuerpo)` de una noche de
//     depuración. Por eso la regla es **ni en desarrollo** — el registro de desarrollo es el
//     que termina desplegado.
//
// ── LO QUE SÍ SE GUARDA, Y POR QUÉ CADA CAMPO ────────────────────────────────
//
// El `email` va en `detalle` a propósito, y no es contradictorio con lo de arriba: el correo
// ya está en la tabla `usuarios`, y sin él la señal 4 del `10` § 2 —que cuenta
// `count(distinct detalle->>'email')` por dirección para detectar un barrido de cuentas—
// devuelve cero. Y *"un cero por falta de datos se lee como 'no hay ataque'"* (`07` § 0,
// regla 3).
//
// El `motivo` distingue las tres causas que el mensaje único esconde. El `02` § 4:
// *"el motivo real SÍ se guarda en la auditoría, para poder investigar. La distinción
// existe; lo que no existe es contársela a quien pregunta."*
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad } from '../datos/capa.ts';
import type { Trx } from '../datos/capa.ts';

/**
 * Las acciones que se registran.
 *
 * `freno_por_origen` es una acción **propia** y no `login_fallido`, y ésa es la mitad que
 * el `07` § 3 marca: *"si el rechazo se registra con la misma acción que un intento fallido
 * y el contador cuenta esa acción, el bloqueo se sostiene solo mientras alguien golpee.
 * Como defensa funciona; como diagnóstico confunde, porque el registro no distingue
 * 'intentó y falló' de 'ni lo dejamos intentar'."*
 */
export type Accion =
  | 'login'
  | 'login_fallido'
  | 'freno_por_cuenta'
  | 'freno_por_origen'
  | 'sesion_cerrada'
  | 'password_cambiada'
  | 'organizacion_cambiada';

/**
 * Lo único que puede ir en `detalle`. Tres campos, todos opcionales, **todos nombrados**.
 *
 * No hay `[clave: string]: unknown`, y no es una omisión: ese índice abierto es exactamente
 * por donde entraría el cuerpo de la petición. Un campo nuevo acá es un cambio que alguien
 * revisa.
 */
export interface Detalle {
  /** El correo que se intentó. Lo necesita la señal 4 del 10 § 2. NUNCA la contraseña. */
  email?: string;
  /** Por qué falló, para investigar. Las tres cadenas del 02 § 4. */
  motivo?: 'email_inexistente' | 'cuenta_inactiva' | 'password';
  /** El estado con el que nació la sesión, cuando el login tuvo éxito. */
  estado?: string;
}

/**
 * Escribe una fila de auditoría.
 *
 * `trx` es **obligatorio** cuando hay una transacción en curso: el `07` § 0, regla 1, exige
 * que *"si una escritura falla, la respuesta lo dice"*, y el caso que hay que evitar es
 * "respondí 200 y el acceso no quedó registrado" — un éxito reportado que no ocurrió. Con la
 * auditoría dentro de la misma transacción que el `insert` de la sesión, o van las dos o no
 * va ninguna.
 */
export async function auditar(
  trx: Trx,
  fila: {
    accion: Accion;
    usuarioId?: string | null;
    orgId?: string | null;
    ip?: string | null;
    detalle?: Detalle;
  },
): Promise<void> {
  await trx
    .insertInto('auditoria_accesos')
    .values({
      accion: fila.accion,
      usuario_id: fila.usuarioId ?? null,
      org_id: fila.orgId ?? null,
      ip: fila.ip ?? null,
      detalle: fila.detalle ? JSON.stringify(fila.detalle) : null,
    })
    .execute();
}

/**
 * La misma cosa, en su propia transacción, para cuando no hay una en curso.
 *
 * Se usa en los caminos donde no hay nada más que escribir —un rechazo por freno, un
 * intento contra un correo inexistente— y ahí la falta de atomicidad no importa porque no
 * hay una segunda mitad que pueda confirmar.
 */
export async function auditarSuelto(fila: Parameters<typeof auditar>[1]): Promise<void> {
  await conIdentidad(async (db) => auditar(db, fila));
}
