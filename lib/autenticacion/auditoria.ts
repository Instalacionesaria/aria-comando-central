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
  | 'organizacion_cambiada'
  | 'segundo_factor_confirmado'
  | 'segundo_factor_verificado'
  | 'segundo_factor_fallido'
  // ── Etapa 5 · el 05 § 7 pide registrar "alta y baja de usuario, cambio de roles" ──
  | 'organizacion_creada'
  | 'usuario_creado'
  | 'usuario_editado'
  | 'usuario_desactivado'
  | 'password_restablecida'
  | 'roles_asignados'
  // ── Etapa 12 · las tres que faltaban del ciclo de vida ────────────────────────
  //
  // `usuario_activado` es la inversa de `usuario_desactivado`, y su ausencia dejaba el registro
  // contando una sola mitad: se veía a quién se sacó de circulación y no a quién se devolvió.
  //
  // `usuario_borrado` y `organizacion_borrada` registran lo único irreversible que el sistema
  // permite hacer. Registrarlas es lo que hace que quedar sin rastro en el negocio no signifique
  // quedar sin rastro en ningún lado: la fila de auditoría sobrevive a la fila borrada.
  | 'usuario_activado'
  | 'usuario_borrado'
  | 'organizacion_editada'
  | 'organizacion_borrada'
  // ── Etapa 13 · la comisión ────────────────────────────────────────────────────
  //
  // Es un número que decide cuánto cobra una persona, y lo fija OTRA persona. Sin esta fila, un
  // porcentaje cambiado no deja ningún rastro de quién lo cambió — y es exactamente la clase de dato
  // sobre la que después alguien pregunta.
  | 'comision_configurada'
  // ── Etapa 14 · el alcance por sección ─────────────────────────────────────────
  //
  // NO se reusa `permiso_denegado`, y el motivo es la señal: esa agrupa por
  // `detalle->>'capacidad'` y acá **no hay capacidad que culpar** —la persona la tiene—. Meterlo ahí
  // contaminaría *"la señal más subestimada"* con filas cuyo problema no es una capacidad.
  | 'seccion_denegada'
  // ── Etapa 6 ──
  | 'credenciales_cargadas'
  // ── Etapa 8 · las TRES que el `10` § 1 dice que faltan ────────────────────────
  //
  // *"La auditoría suele registrar acceso, intento fallido, alta y baja de usuario, cambio de roles,
  // cambio de credenciales y alta de organización. **Faltan tres**, y son las que dan tres de las
  // cinco señales."*
  //
  // `organizacion_cambiada` ya estaba en este tipo desde la Etapa 3 y **no se emitía en ningún
  // lado** — que es exactamente el defecto que `ADR-0809` existe para atrapar: *"un cero en la
  // vigilancia es indistinguible de 'nadie cableó el punto de emisión'"*.
  | 'permiso_denegado'
  | 'credencial_ilegible';

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
  /**
   * El usuario SOBRE EL QUE se operó, en las acciones de administración.
   *
   * `auditoria_accesos.usuario_id` guarda **quién hizo la operación**, no sobre quién. Sin este
   * campo, una fila de `usuario_desactivado` dice quién desactivó y no a quién — y el registro de
   * una baja sin la baja es peor que no tenerlo.
   */
  objetivo?: string;
  /** Las claves de rol asignadas, en `roles_asignados`. Nunca identificadores opacos. */
  roles?: string[];
  /** El slug de la organización creada. */
  slug?: string;
  /**
   * La capacidad que faltaba, en `permiso_denegado`.
   *
   * La señal 3 del `10` § 1 agrupa por `detalle->>'capacidad'`, y sin este campo la consulta
   * devuelve una sola fila con la capacidad en nulo: se pierde justo lo que la señal quería decir,
   * que es **qué** permiso le falta a qué rol.
   */
  capacidad?: string;
  /**
   * La sección que se negó, en `seccion_denegada`.
   *
   * Campo propio por lo mismo que la acción es propia: una señal que agrupe por sección contesta
   * «¿a quién le falta qué pestaña?», que es otra pregunta que «¿a qué rol le falta qué capacidad?».
   */
  seccion?: string;
  /**
   * La organización a la que se cambió, en `organizacion_cambiada`.
   *
   * La señal 5 cuenta `count(distinct detalle->>'org_destino')` para detectar *"uso indebido de una
   * cuenta con acceso a todo"*. Sin este campo cuenta cero organizaciones distintas por usuario, y
   * un cero por falta de datos se lee como "nadie miró nada".
   */
  org_destino?: string | null;
}

/**
 * Audita una operación de ADMINISTRACIÓN. `actor` y `objetivo` son **obligatorios**.
 *
 * El `07` § 1 lo pide con esas palabras, y trae el caso real: *"los parámetros que dicen QUIÉN
 * HIZO ESTO van obligatorios y SIN VALOR POR DEFECTO: si mañana aparece un llamador nuevo, que no
 * compile hasta que diga quién es."* El defecto que documenta ocurrió con un parámetro que tenía
 * valor por defecto —el identificador de una persona real— y **todo** lo registrado, de cualquier
 * organización, quedó firmado por esa persona.
 *
 * Acá eso es un error de compilación: no hay valor por omisión que tapar.
 */
export async function auditarAdministracion(
  trx: Trx,
  fila: {
    accion: Extract<
      Accion,
      | 'organizacion_creada'
      | 'usuario_creado'
      | 'usuario_editado'
      | 'usuario_desactivado'
      | 'password_restablecida'
      | 'roles_asignados'
      | 'credenciales_cargadas'
      // Etapa 12 · el resto del ciclo de vida. El `Extract` es deliberadamente una lista y no
      // `Accion` entera: así una acción de autenticación —un `login_fallido`, por ejemplo— no se
      // puede registrar por esta puerta, que exige un actor y un objetivo que ahí no existen.
      | 'usuario_activado'
      | 'usuario_borrado'
      | 'organizacion_editada'
      | 'organizacion_borrada'
      | 'comision_configurada'
    >;
    actor: string;
    objetivo: string;
    orgId: string;
    detalle?: Omit<Detalle, 'objetivo'>;
  },
): Promise<void> {
  await auditar(trx, {
    accion: fila.accion,
    usuarioId: fila.actor,
    orgId: fila.orgId,
    detalle: { ...fila.detalle, objetivo: fila.objetivo },
  });
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
