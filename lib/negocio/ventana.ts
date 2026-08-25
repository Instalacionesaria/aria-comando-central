// La ventana de 24 horas del canal.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA ES DEL CANAL, NO NUESTRA
//
// Solo se puede mandar **texto libre** dentro de las 24 horas posteriores al **último mensaje que
// escribió el contacto**. Pasada esa ventana, el canal solo acepta plantillas aprobadas.
//
// ── EL DEFECTO QUE LA HIZO VISIBLE ──────────────────────────────────────────
//
// Un mensaje se mandó, la aplicación lo dio por enviado, y nunca llegó. En el CRM estaba en rojo:
// *"pasaron más de 24 horas desde que el cliente respondió"*.
//
// La llamada había devuelto éxito: el CRM acepta el mensaje y **recién después** el canal lo
// rechaza. Ver `lib/ghl/entrega.ts` — ahí está la otra mitad del arreglo.
//
// ── SE RESUELVE CON LAS DOS MITADES, Y HACEN FALTA LAS DOS ──────────────────
//
// **Prevenir** (este archivo): el servidor **corta antes de gastar la llamada**, y el compositor
// queda deshabilitado con el motivo a la vista.
//
// **Reflejar** (`entrega.ts` y la tercera pasada): el estado real se guarda sobre la fila que ya
// existe, y el chat pinta el saliente fallido en rojo con el texto del canal debajo.
//
// La primera cubre el caso conocido sin gastar nada; la segunda cubre **todo lo demás** que el canal
// puede rechazar — un número sin WhatsApp, un dispositivo desconectado.
//
// ── EL RIESGO DEL BLOQUEO PREVENTIVO, Y POR QUÉ SE ACEPTA ───────────────────
//
// La caché puede estar unos segundos vieja. Los dos errores **no son simétricos**, y por eso la
// decisión es fácil:
//
//   · Dice **cerrada** y está abierta → se bloquea un mensaje legítimo, **por segundos**: el aviso
//     del CRM actualiza al instante, la ingesta cada diez, y el chat repregunta cada cinco. **El
//     compositor se rehabilita solo.**
//   · Dice **abierta** y está cerrada → se manda, el canal lo rechaza, y queda marcado como fallido
//     con su motivo. La segunda mitad haciendo su trabajo.
//
// Lo que **no** se hace es preguntarle al CRM antes de cada envío: sería una llamada por mensaje
// para adelantar un dato que ya está en la caché.
//
// Módulo isomorfo: sin base, sin React, sin DOM. Lo usan la ruta del chat y la de envío.
// ═══════════════════════════════════════════════════════════════════════════════

export const VENTANA_MS = 24 * 60 * 60 * 1000;

export interface Ventana {
  /** `true` = se puede mandar texto libre. */
  abierta: boolean;
  /** Cuándo cierra (o cerró). `null` si el contacto nunca escribió. */
  venceEl: string | null;
  /** Cuánto falta. Negativo = hace cuánto que venció. `null` si nunca escribió. */
  restanteMs: number | null;
  /** Por qué no se puede mandar. `null` cuando está abierta. */
  motivo: string | null;
}

/** «3 h 20 min» / «45 min» — para decir cuánto queda o hace cuánto venció. */
export function duracionCorta(ms: number): string {
  const min = Math.max(0, Math.round(Math.abs(ms) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (h < 24) return resto > 0 ? `${h} h ${resto} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} día${d > 1 ? 's' : ''}`;
}

/**
 * ¿Se le puede escribir a este contacto ahora?
 *
 * @param ultimoEntranteEl La fecha del último mensaje del contacto. Es la columna que **solo
 *   avanza** —lo garantiza el disparador `entrante_solo_avanza` de la migración 011— y de la que
 *   dependen tres cosas: esta ventana, el Buzón, y la reapertura de una tarea completada.
 * @param ahoraMs Se inyecta para poder probarlo. El reloj del servidor, no el del navegador: la
 *   decisión de gastar o no la llamada la toma el servidor.
 */
export function ventanaDeRespuesta(
  ultimoEntranteEl: Date | string | null | undefined,
  ahoraMs: number = Date.now(),
): Ventana {
  if (ultimoEntranteEl === null || ultimoEntranteEl === undefined) {
    return {
      abierta: false,
      venceEl: null,
      restanteMs: null,
      motivo:
        'Este contacto todavía no escribió. El canal solo deja iniciar una conversación con una ' +
        'plantilla aprobada, no con un mensaje libre.',
    };
  }

  const ultimoMs =
    ultimoEntranteEl instanceof Date ? ultimoEntranteEl.getTime() : Date.parse(ultimoEntranteEl);

  if (Number.isNaN(ultimoMs)) {
    // Una fecha ilegible NO puede hacerse pasar por ventana abierta: sería exactamente el «parece
    // que salió» que este módulo existe para evitar. Ante la duda, cerrada.
    return {
      abierta: false,
      venceEl: null,
      restanteMs: null,
      motivo: 'No se pudo leer cuándo escribió el contacto por última vez.',
    };
  }

  const venceMs = ultimoMs + VENTANA_MS;
  const restanteMs = venceMs - ahoraMs;
  const abierta = restanteMs > 0;

  return {
    abierta,
    venceEl: new Date(venceMs).toISOString(),
    restanteMs,
    motivo: abierta
      ? null
      : `Pasaron más de 24 horas desde el último mensaje del contacto (venció hace ` +
        `${duracionCorta(restanteMs)}). El canal solo permite escribir texto libre dentro de esa ` +
        `ventana; para reabrirla tiene que escribir él, o hay que mandarle una plantilla aprobada ` +
        `desde GoHighLevel.`,
  };
}
