// El contrato con GoHighLevel: TODOS los literales, en un solo archivo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ TODO EN UN ARCHIVO, Y NO REPARTIDO POR EL CÓDIGO
//
// Es la instrucción del § D.2 de `LISTA-TAGS`, con sus dos razones:
//
//   · que un literal que **todavía no existe en la subcuenta NO SE MANDE** — y que la
//     aplicación funcione igual, con su propia base como fuente de verdad;
//   · que haya **un solo lugar donde mirar** cuando algo no llega.
//
// Y hay una tercera que el documento pone en negrita, y es la que hace que este archivo valga
// más que la comodidad: **un tag mal escrito no da error. No hace nada.** Es el defecto más
// caro de la lista porque es invisible: el contacto simplemente aparece en la cola equivocada,
// o el ícono se queda apagado, y nadie tiene dónde mirar.
//
// Los nombres van EXACTOS: minúsculas, guion bajo, sin acentos ni espacios.
//
// ── LA CONFIANZA NO ES DECORATIVA ───────────────────────────────────────────
//
// `confirmado` = existe y está verificado en la subcuenta.
// `pendiente`  = todavía no existe. La aplicación lo usa internamente y **no lo manda**.
// `sin_confirmar` = existe y nadie confirmó qué significa. **Solo lectura.**
//
// Escribir un tag `pendiente` no falla — no hace nada — así que la única forma de que eso no
// pase es que el código pregunte por esta tabla antes de mandar.
// ═══════════════════════════════════════════════════════════════════════════════

export type Confianza = 'confirmado' | 'pendiente' | 'sin_confirmar';

// ═════════════════════════════════════════════════════════════════════════════
// A.1 · TERRITORIO — la separación más importante de todas
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Las dos etiquetas de zona. Las escribe el CRM; la aplicación solo las lee.
 *
 * ── EL TRASPASO ES UN REEMPLAZO, Y EN LA PRÁCTICA NO SIEMPRE ────────────────
 *
 * El contrato dice: *"al agendar, `zona_setter` sale y entra `zona_closer`"*. O sea que un
 * contacto debería tener UNA sola.
 *
 * **Medido contra la subcuenta real el 2026-08-24: 3 de 238 tienen las dos.** Uno de ellos
 * («marcelo») tiene además `bot_activado_appflow` y `bot_desactivado_postcall` a la vez. Así
 * que la precedencia no es una defensa teórica: es un caso que ocurre.
 *
 * **Gana el closer**, y el orden de este arreglo ES la precedencia. El motivo: un contacto que
 * ya llegó a la agenda del closer no vuelve a la bandeja del setter. Y aparecer en las dos
 * listas sería peor que elegir mal — dos personas trabajando el mismo lead sin saberlo, y
 * atender una no cierra la otra.
 */
export const TERRITORIOS = [
  { etiqueta: 'zona_closer', territorio: 'closer' as const, confianza: 'confirmado' as const },
  { etiqueta: 'zona_setter', territorio: 'setter' as const, confianza: 'confirmado' as const },
];

// ═════════════════════════════════════════════════════════════════════════════
// A.2 · EL ESTADO DEL AGENTE — de acá sale el ícono 🤖
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Qué está haciendo el agente de IA con este contacto.
 *
 * Cinco estados y no dos, porque llevan a cinco lecturas distintas: *"lo está atendiendo un
 * bot"*, *"un humano lo apagó"*, *"ya pasó por la llamada"*, *"el bot falló y lo pausamos"* y
 * *"no hay ningún agente acá"*.
 */
export type EstadoDelAgente =
  | 'atendiendo_pre_agenda'
  | 'atendiendo_post_agenda'
  | 'atendiendo'
  | 'apagado_a_mano'
  | 'ya_paso_la_llamada'
  | 'pausado_por_fallo'
  | 'sin_agente';

/** El texto de cada estado, para la ficha y el título del ícono. */
export const TEXTO_DEL_AGENTE: Readonly<Record<EstadoDelAgente, string>> = {
  atendiendo_pre_agenda: 'El agente pre-agenda está atendiendo',
  atendiendo_post_agenda: 'El agente post-agenda está atendiendo',
  atendiendo: 'El chatbot está atendiendo',
  apagado_a_mano: 'Un humano apagó el bot',
  ya_paso_la_llamada: 'Ya tuvo la llamada de cierre: el bot se apagó',
  pausado_por_fallo: 'El bot se pausó porque el auditor encontró un fallo',
  sin_agente: 'Sin agente',
};

/**
 * Las etiquetas del agente, **EN ORDEN DE PRECEDENCIA**. La primera que aparezca gana.
 *
 * ── POR QUÉ HACE FALTA UN ORDEN, Y POR QUÉ ÉSTE ─────────────────────────────
 *
 * El contrato NO dice qué pasa cuando hay más de una, y en la subcuenta real las hay:
 * «marcelo» tiene `bot_activado_appflow` y `bot_desactivado_postcall` juntas. Sin un orden, el
 * resultado dependería de en qué posición del arreglo de etiquetas vino cada una — o sea, de
 * nada.
 *
 * El orden elegido pone **los apagados antes que los encendidos**, y el motivo es temporal: los
 * `bot_desactivado_*` los aplica la APLICACIÓN al registrar un resultado, o sea después de que
 * el CRM encendió el suyo. El estado más nuevo es el apagado.
 *
 * Y es una **decisión, no una lectura del contrato**. Si resulta equivocada, se cambia acá y
 * en un solo lugar.
 *
 * ── LO QUE NO ESTÁ EN ESTA LISTA, Y NO ES UN OLVIDO ─────────────────────────
 *
 * `bot_reactivar` **no decide estado**: el contrato dice que es una ORDEN de volver a encender.
 * Un contacto con esa etiqueta está en el estado que digan las otras hasta que el CRM la
 * ejecute. Meterla acá haría que una orden pendiente se leyera como un hecho.
 */
export const ETIQUETAS_DEL_AGENTE: readonly {
  etiqueta: string;
  estado: EstadoDelAgente;
  confianza: Confianza;
}[] = [
  // ── Los apagados primero. Ver arriba. ──
  { etiqueta: 'bot_desactivado_postcall', estado: 'ya_paso_la_llamada', confianza: 'confirmado' },
  { etiqueta: 'bot_desactivado_appflow', estado: 'pausado_por_fallo', confianza: 'confirmado' },
  { etiqueta: 'bot_desactivado_leadflow', estado: 'pausado_por_fallo', confianza: 'confirmado' },
  // LEGADO: era el tag único de los dos anteriores. Ya no se aplica, **y se sigue leyendo**
  // porque quedaron contactos con él puesto. No hace falta crearlo en una subcuenta nueva.
  { etiqueta: 'bot_pausado_fallo', estado: 'pausado_por_fallo', confianza: 'confirmado' },
  { etiqueta: 'bot_apagado_manual', estado: 'apagado_a_mano', confianza: 'confirmado' },

  // ── Los encendidos. Dos y no uno: el auditor tiene que saber CUÁL agente atendía, o le
  //    imputaría el fallo al equivocado. ──
  { etiqueta: 'bot_activado_appflow', estado: 'atendiendo_post_agenda', confianza: 'confirmado' },
  { etiqueta: 'bot_activado_leadflow', estado: 'atendiendo_pre_agenda', confianza: 'confirmado' },
  // LEGADO: dice que el chatbot atiende, sin decir cuál. Va último para que las dos anteriores
  // —que sí lo dicen— ganen cuando estén.
  { etiqueta: 'bot_activado', estado: 'atendiendo', confianza: 'confirmado' },
];

// ═════════════════════════════════════════════════════════════════════════════
// A.4 · SEGUIMIENTOS — de acá sale el ícono ⏱
// ═════════════════════════════════════════════════════════════════════════════

/**
 * `seguimiento_recupero` es lo que ENCIENDE el ícono ⏱.
 *
 * Su presencia significa *"hay un seguimiento automático corriendo"*, y por eso ese ícono es de
 * solo lectura: se enciende únicamente al registrar un resultado.
 *
 * `seguimiento_manual` NO enciende nada, y ése es su punto: le dice al CRM que **no** persiga a
 * este contacto porque lo retoma una persona. Su recordatorio vive en nuestra base, no acá.
 */
export const SEGUIMIENTO_AUTOMATICO = 'seguimiento_recupero';

/** Las series de recontacto. Las escribe la aplicación; las lee el CRM. */
export const SERIES_DE_SEGUIMIENTO: readonly { etiqueta: string; serie: string; confianza: Confianza }[] = [
  { etiqueta: 'seguimiento_recupero', serie: 'closer · 3 toques · 7 días', confianza: 'confirmado' },
  { etiqueta: 'seguimiento_para_agendar', serie: 'setter · 3 toques · 5 días', confianza: 'confirmado' },
  { etiqueta: 'seguimiento_decision_lt', serie: 'setter · 2 toques · 3 días', confianza: 'confirmado' },
  { etiqueta: 'seguimiento_manual', serie: 'ninguna: lo retoma un humano', confianza: 'confirmado' },
  // Existe en la subcuenta y **nadie confirmó qué significa**. Por el nombre parece la marca de
  // "serie agotada". SOLO LECTURA hasta confirmarlo: escribirlo podría disparar un flujo que
  // nadie revisó.
  { etiqueta: 'seguimiento_terminado', serie: 'sin confirmar', confianza: 'sin_confirmar' },
];

// ═════════════════════════════════════════════════════════════════════════════
// A.6 · SOLO LECTURA — las escribe el CRM y nosotros solo las miramos
// ═════════════════════════════════════════════════════════════════════════════

/**
 * `cita_agendada` la pone el detector post-call. **Nunca la escribimos ni la quitamos.**
 *
 * Es la fuente del ícono 📅 mientras no haya calendario leído: dice que hay una cita, aunque no
 * diga cuándo.
 */
export const CITA_AGENDADA = 'cita_agendada';

/** `estancado` lo pone el barrido de inactividad del CRM. Pinta la cola de estancadas. */
export const ESTANCADO = 'estancado';

// ═════════════════════════════════════════════════════════════════════════════
// A.3 · LOS RESULTADOS DE AVANZAR — los escribe la APLICACIÓN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Qué etiqueta manda cada salida de Avanzar. **El CRM no debe aplicarlas nunca.**
 *
 * Todavía no se escriben: Avanzar es el paso siguiente. Están acá porque el § D.2 pide que los
 * literales vivan en un solo archivo desde el principio, no cuando se usan.
 *
 * `apagaElBot` es la nota que el contrato subraya: **el No-show es la única salida que deja el
 * bot vivo**, porque dispara un flujo de recuperación que necesita al agente trabajando. Las
 * otras cinco lo apagan con `bot_desactivado_postcall`.
 */
interface ResultadoEnElCrm {
  salida: string;
  /** `null` = esta salida **no avisa a nadie, a propósito**. Ver `agendo`. */
  etiqueta: string | null;
  confianza: Confianza;
}

export const RESULTADOS: readonly (ResultadoEnElCrm & { apagaElBot: boolean })[] = [
  { salida: 'venta', etiqueta: 'venta_ganada', apagaElBot: true, confianza: 'confirmado' },
  { salida: 'acuerdo_sin_pago', etiqueta: 'adelanto_ganado', apagaElBot: true, confianza: 'confirmado' },
  { salida: 'seguimiento', etiqueta: 'seguimiento', apagaElBot: true, confianza: 'confirmado' },
  { salida: 'no_interesa', etiqueta: 'descalificado', apagaElBot: true, confianza: 'confirmado' },
  { salida: 'no_show', etiqueta: 'noshow', apagaElBot: false, confianza: 'confirmado' },
  { salida: 'nurture', etiqueta: 'nurture_appflow', apagaElBot: true, confianza: 'confirmado' },
];

/** La etiqueta que apaga el bot tras la llamada. La aplica Avanzar, no el CRM. */
export const BOT_DESACTIVADO_POSTCALL = 'bot_desactivado_postcall';

/**
 * Qué etiqueta manda cada salida del SETTER.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NO TIENE `apagaElBot`, Y ÉSE ES TODO EL PUNTO
 *
 * El Closer apaga el agente en seis de sus siete salidas, porque cualquier resultado suyo demuestra
 * que el contacto **ya tuvo su llamada de venta**. El Setter es pre-agenda por definición: ninguna
 * de sus cinco lo prueba. Apagar el agente desde acá mataría al que todavía tiene que calificar al
 * lead — y peor en `seguimiento`, que es justo la salida que lo deja en manos del agente por días.
 *
 * Por eso el campo **no existe en este tipo**: escribir `apagaElBot: true` en esta tabla es un error
 * de compilación. No es un `if` que alguien pueda invertir ni una bandera en `false` que alguien
 * pueda cambiar de opinión: la diferencia es **inexpresable**.
 *
 * ── Y `no_califica` VENÍA DE LA TABLA DEL CLOSER, CON EL APAGADO ENCENDIDO ─
 *
 * Estaba en `RESULTADOS` con `apagaElBot: true`. Lo único que lo contenía era que la ruta rechazaba
 * esa salida con un 400. El día que el setter pudiera registrarla —o sea hoy— le habría puesto a un
 * lead `bot_desactivado_postcall`, que significa literalmente *«ya pasó la llamada de cierre»*, a
 * alguien que nunca tuvo una. Y esa etiqueta la aplicación no la sabe quitar.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const RESULTADOS_DEL_SETTER: readonly ResultadoEnElCrm[] = [
  /* ── `agendo` NO MANDA NADA, Y ES DELIBERADO ────────────────────────────
   *
   * La intuición dice que agendar debería mover al contacto al territorio del closer. **El traspaso
   * lo hace un automatismo del CRM cuando la cita se crea de verdad**, y esta aplicación no crea
   * citas: el contacto reserva por su propio enlace.
   *
   * Aplicar `zona_closer` desde acá sería PEOR que no hacerlo: movería el contacto al territorio
   * del closer **sin que exista ninguna cita**, y el closer se encontraría con un lead en su cola
   * sin nada agendado.
   *
   * Consecuencia que hay que saber: la columna «Agendado» del setter **no se vacía sola** salvo que
   * el lead reserve de verdad. Un setter que agenda por teléfono deja el contacto en su territorio
   * hasta que la cita exista. */
  { salida: 'agendo', etiqueta: null, confianza: 'confirmado' },
  /* Y `venta_chica` tampoco: **no existe ninguna etiqueta que signifique «vendió el producto
     chico»**. El único candidato es `derivado_lt`, y significa otra cosa —*derivado* a producto
     chico es un ruteo, no un cobro—: usarla marcaría como venta a todo el que recibió la oferta. */
  { salida: 'venta_chica', etiqueta: null, confianza: 'confirmado' },
  { salida: 'seguimiento', etiqueta: 'seguimiento', confianza: 'confirmado' },
  { salida: 'no_califica', etiqueta: 'descalificado', confianza: 'confirmado' },
  { salida: 'nurture', etiqueta: 'nurture_appflow', confianza: 'confirmado' },
];

// ═════════════════════════════════════════════════════════════════════════════
// A.5 · LAS ETAPAS DEL SETTER — las tres PENDIENTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * **Las tres todavía NO existen en la subcuenta, y por eso no se mandan.**
 *
 * La aplicación las usa igual para su propio pipeline, porque —§ D.3— **la fuente de verdad de
 * la etapa es nuestra base, nunca el CRM**. El tag es un aviso para que el CRM dispare sus
 * automatismos, no el lugar donde vive el estado.
 *
 * Consecuencia práctica: las columnas del pipeline funcionan desde el día uno, y la escritura
 * al CRM **se enciende sola** el día que estas tres pasen a `confirmado`.
 *
 * Son tres y no siete porque cuatro etapas ya tienen etiqueta y crear duplicados sería un
 * error: «Producto chico ofrecido» es `derivado_lt`, «Agendado» es el traspaso de zona,
 * «Nurture» es `nurture_appflow` y «Descalificado» es `descalificado`.
 */
export const ETAPAS_DEL_SETTER: readonly { etiqueta: string; etapa: string; confianza: Confianza }[] = [
  { etiqueta: 'setter_nuevo', etapa: 'Nuevo', confianza: 'pendiente' },
  { etiqueta: 'setter_en_calificacion', etapa: 'En calificación', confianza: 'pendiente' },
  { etiqueta: 'setter_calificado', etapa: 'Calificado', confianza: 'pendiente' },
];

/**
 * ¿Se puede MANDAR esta etiqueta al CRM?
 *
 * La única defensa contra el defecto invisible del encabezado: escribir una etiqueta que no
 * existe devuelve éxito y no hace nada. Preguntando acá antes de mandar, lo que no existe se
 * queda en nuestra base —donde sí sirve— en vez de perderse.
 */
/**
 * Qué etiquetas le corresponden a un resultado, ya filtradas por lo que se puede mandar.
 *
 * ── POR QUÉ ES UNA FUNCIÓN PURA Y NO CÓDIGO DENTRO DE LA RUTA ───────────────
 *
 * Estaba dentro de `avisarAlCrm`, y ahí **no se puede probar**: esa función resuelve credenciales y
 * habla con el CRM, así que en una base de pruebas sin token devuelve `etiquetas: []` antes de
 * llegar a decidir nada. La decisión de qué mandar es una regla de negocio —y la más fácil de
 * romper en silencio, porque una etiqueta que falta no da error: el CRM simplemente no dispara su
 * automatismo— así que vive donde se la puede interrogar sin red.
 *
 * Tres cosas, en orden:
 *
 *   1 · la etiqueta del resultado;
 *   2 · la que apaga el bot, salvo en No-show —la única salida que lo deja vivo, porque dispara un
 *       flujo de recuperación que necesita al agente trabajando—;
 *   3 · la del MODO, cuando la salida tiene modos. Es la que hace que «automático» signifique algo
 *       del otro lado.
 *
 * Y el filtro final no es opcional: una etiqueta que no existe en la subcuenta se responde con un
 * 200 y no hace nada, así que mandarla es peor que no mandarla — queda la impresión de que se hizo.
 */
export function etiquetasDelResultado(salida: string, etiquetaDelModo?: string): readonly string[] {
  const def = RESULTADOS.find((r) => r.salida === salida);
  if (!def) return [];
  const candidatas = def.apagaElBot ? [def.etiqueta, BOT_DESACTIVADO_POSTCALL] : [def.etiqueta];
  return soloLasMandables(candidatas, etiquetaDelModo);
}

/**
 * Las etiquetas de un resultado del SETTER.
 *
 * Es otra función y no un parámetro de la de arriba porque **la diferencia es de negocio, no de
 * valor**: acá `BOT_DESACTIVADO_POSTCALL` no se nombra nunca. Un `if (rol === 'setter')` adentro de
 * la del closer dejaría dos reglas trenzadas donde ninguna se lee, y una bandera se puede cambiar.
 */
export function etiquetasDelResultadoDelSetter(
  salida: string,
  etiquetaDelModo?: string,
): readonly string[] {
  const def = RESULTADOS_DEL_SETTER.find((r) => r.salida === salida);
  if (!def) return [];
  return soloLasMandables([def.etiqueta], etiquetaDelModo);
}

/**
 * La parte que SÍ es la misma acción sobre el mismo dato: quitar lo que no hay que mandar.
 *
 * Un `null` es una salida que **a propósito** no avisa a nadie; lo que no está confirmado en la
 * subcuenta se cae por `sePuedeMandar`. Las dos exclusiones terminan en una lista vacía, y por eso
 * la respuesta de la ruta necesita distinguirlas — ver `AvisoAlCrm`.
 */
function soloLasMandables(
  candidatas: readonly (string | null)[],
  etiquetaDelModo?: string,
): readonly string[] {
  const todas = [...candidatas];
  if (etiquetaDelModo) todas.push(etiquetaDelModo);
  return todas.filter((e): e is string => e !== null && sePuedeMandar(e));
}

/**
 * ¿Esta salida declara que **no avisa a nadie**, a propósito?
 *
 * Es el tercer estado que la respuesta de Avanzar necesitaba. Sin él, `agendo` y `venta_chica`
 * —que no mandan nada porque no hay etiqueta que signifique eso— se reportaban con el texto
 * *«ninguna de las etiquetas de esta salida está confirmada en la subcuenta»*, que es **falso**: no
 * es que estén sin confirmar, es que no existen. Un mensaje que afirma un problema que no existe
 * manda a alguien a buscar en la subcuenta una etiqueta que nadie tiene que crear.
 */
export function noAvisaAPropositoDelSetter(salida: string): boolean {
  const def = RESULTADOS_DEL_SETTER.find((r) => r.salida === salida);
  return def !== undefined && def.etiqueta === null;
}

export function sePuedeMandar(etiqueta: string): boolean {
  const todas = [
    ...TERRITORIOS.map((t) => ({ etiqueta: t.etiqueta, confianza: t.confianza })),
    ...ETIQUETAS_DEL_AGENTE,
    ...SERIES_DE_SEGUIMIENTO,
    ...RESULTADOS.map((r) => ({ etiqueta: r.etiqueta, confianza: r.confianza })),
    ...RESULTADOS_DEL_SETTER.map((r) => ({ etiqueta: r.etiqueta, confianza: r.confianza })),
    ...ETAPAS_DEL_SETTER,
  ];
  const fila = todas.find((t) => t.etiqueta === etiqueta);
  // Una etiqueta que no está en el contrato NO se manda. Es el lado correcto del que fallar:
  // el contrato es la lista de lo que existe, y lo que no está en ella no existe.
  if (!fila) return false;
  return fila.confianza === 'confirmado';
}

/**
 * El estado del agente que dicen estas etiquetas.
 *
 * Devuelve `'sin_agente'` cuando ninguna aparece, y eso **no es lo mismo que no saber**: el
 * contacto tiene sus etiquetas leídas y ninguna es del agente, o sea que no hay ningún agente
 * puesto. Es un cero medido.
 */
export function estadoDelAgente(etiquetas: readonly string[]): EstadoDelAgente {
  const puestas = new Set(etiquetas);
  for (const { etiqueta, estado } of ETIQUETAS_DEL_AGENTE) {
    if (puestas.has(etiqueta)) return estado;
  }
  return 'sin_agente';
}
