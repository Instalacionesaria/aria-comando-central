// El CONTRATO del veredicto: los vocabularios cerrados, y la derivación del nivel.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL NIVEL SE DERIVA, Y NO SE LE CREE AL MODELO
//
// El modelo devuelve un nivel. **No es el que se guarda.**
//
//     1 · Sin auditar          →  null        (no hay veredicto)
//     2 · Con intervención     →  rojo        (es la definición de rojo)
//     3 · Con hallazgos        →  amarillo    (reportó algo observable)
//     4 · Sin hallazgos        →  verde, salvo que el modelo pida amarillo
//
// **No es desconfianza gratuita.** La base tiene la invariante `rojo ⟺ pide intervención` como
// restricción de tabla, así que un modelo que devuelva «amarillo» junto a `intervención: true`
// **tumbaría la escritura entera** y el análisis se perdería — **con la inferencia ya pagada**, que es
// el peor final posible.
//
// Derivar convierte un error del modelo en una fila correcta.
//
// ── Y LA TENSIÓN DE LA REGLA 4, DICHA EN VOZ ALTA ───────────────────────────
//
// La regla 4 **honra** un amarillo pedido por el modelo aunque no haya traído ningún hallazgo. Y otra
// regla del mismo diseño dice que eso no debería pasar: *«si no podés nombrar el hallazgo con su cita
// y su código de patrón, no es amarillo»*.
//
// Las dos conviven, y la división es limpia: **lo que impide ese amarillo es la rúbrica**, no la
// derivación. Si igual llega, se guarda como amarillo y no se pisa a verde, por dos motivos:
//
//   · Pisarlo esconder√≠a una señal que el modelo levantó.
//   · Un amarillo sin patrón **se ve** en la pantalla del técnico —una fila sin nada que ajustar— y
//     eso es un defecto medible de la rúbrica, no un problema silencioso.
//
// El antecedente está medido: con una redacción vieja de la rúbrica, el modelo devolvía amarillo con
// cero hallazgos, y el efecto no era un error visible sino **el contador de verdes bajando sin que
// nada hubiera cambiado en los agentes**.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Territorio } from '../datos/esquema.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LOS AUDITORES, Y CÓMO SE ELIGE CUÁL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Los auditores que existen. **Los dos de chat.**
 *
 * Los dos de voz están fuera de alcance por medición: `negocio.llamadas` tiene cero filas y ninguna
 * columna de transcripción, así que no tienen qué leer. Agregarlos es una migración —la lista vive
 * también en el `check` de la tabla— y eso es deliberado: **encender un auditor que gasta plata tiene
 * que aparecer en un diff que alguien mire.**
 */
export const AGENTES = ['chat_post_agenda', 'chat_pre_agenda'] as const;
export type Agente = (typeof AGENTES)[number];

/**
 * Qué auditor le toca a un contacto. **Lo decide su TERRITORIO.**
 *
 * ── POR QUÉ UN `Record` Y NO UN `if` ────────────────────────────────────────
 *
 * Por lo mismo que en el resto del módulo del Closer y del Setter: `ADR-0302` prohíbe comparar contra
 * un nombre de rol en `app/`, `components/` y `lib/`, y un `Record<Territorio, …>` **no compila** el
 * día que aparezca un tercer territorio. Un `if` se quedaría callado.
 *
 * Y si un contacto no tiene territorio, **no se audita**: no se sabe qué trabajo se está juzgando. Eso
 * lo decide el portón 1, no esta tabla — acá no hay entrada para `null` y no puede haberla.
 */
export const AGENTE_DEL_TERRITORIO: Readonly<Record<Territorio, Agente>> = {
  closer: 'chat_post_agenda',
  setter: 'chat_pre_agenda',
};

/** Y la vuelta, para leer un análisis y saber de qué territorio hablaba. */
export const TERRITORIO_DEL_AGENTE: Readonly<Record<Agente, Territorio>> = {
  chat_post_agenda: 'closer',
  chat_pre_agenda: 'setter',
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS CRITERIOS, QUE SON DOS LISTAS Y NO UNA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El valor neutro. **No es un criterio: es la ausencia de uno.**
 *
 * Lo devuelve el modelo cuando no disparó ninguno —un verde, o un amarillo de observación— y también
 * es donde cae un criterio que no reconocemos. Estaba en los datos reales de la plataforma anterior:
 * los 16 verdes y buena parte de los amarillos lo traían.
 */
export const SIN_CRITERIO = 'ninguno';

/**
 * Los siete de **post-agenda** — confirmar y acompañar la cita hasta la llamada.
 *
 * Cada uno tiene su condición de disparo y su lista de descartes, y eso vive en el texto de la
 * rúbrica. Acá está solo el vocabulario: lo que la fila puede guardar.
 */
export const CRITERIOS_POST_AGENDA = [
  /** El contacto expresa fastidio y la respuesta siguiente del agente lo ignora o sigue el guion. */
  'frustracion_no_manejada',
  /** Los TRES a la vez: el último es del contacto, nadie respondió, y el silencio supera el umbral. */
  'abandono_de_conversacion',
  /** Afirma algo falso, se contradice, o promete precio/fecha/descuento que no le corresponde. */
  'promesa_incorrecta',
  /** El contacto dice que no le sirve y el agente sigue empujando el mismo camino. */
  'no_es_lo_que_busca',
  /** El contacto pide lo mismo tres veces o más sin obtenerlo. */
  'insiste_sin_entender',
  /** No puede resolverlo y **ni deriva ni dice qué va a pasar**. */
  'fuera_de_alcance_sin_salida',
  /** Pregunta razonable que debería estar en su base de conocimiento. */
  'dato_faltante',
] as const;
export type CriterioPostAgenda = (typeof CRITERIOS_POST_AGENDA)[number];

/**
 * Los siete de **pre-agenda** — calificar y conseguir la cita.
 *
 * ── NO ES LA MISMA LISTA CON OTRO CONTEXTO, Y ES LA DECISIÓN QUE MÁS SE COPIA MAL ──
 *
 * La misión del agente es otra, así que **lo que cuenta como falla también**:
 *
 *   · «Abandonó la conversación» en post-agenda es dejar colgada una cita. Acá el contacto **todavía
 *     no agendó**: es otra cosa.
 *   · «Prometió algo incorrecto sobre el programa» **no aplica** a quien nunca habló del programa.
 *   · El daño caro allá es perder a alguien que ya iba a comprar. Acá es **agendar a quien no puede
 *     comprar**.
 *
 * Auditar pre-agenda con la rúbrica de post-agenda no da un resultado peor: **da uno convincente y
 * falso** sobre un trabajo distinto, y encima gastando.
 *
 * **Tres no tienen equivalente** —los de calificación— y **uno se comparte tal cual**:
 * `dato_faltante`, porque significa lo mismo en las dos etapas.
 */
export const CRITERIOS_PRE_AGENDA = [
  /** Empujó a agendar **sin preguntar nada que permita calificar**. */
  'calificacion_saltada',
  /** El contacto dijo que no puede, y el agente **siguió empujando la cita**. */
  'presiono_a_quien_no_califica',
  /** No califica pero mostró interés, y el agente **cerró sin ofrecer nada**. */
  'sin_salida_alternativa',
  /** Afirmó algo que **contradice el prompt** o que el prompt no respalda. */
  'informacion_falsa',
  /** Mostró que califica y la conversación se cortó **sin próximo paso**. */
  'abandono_de_lead_calificado',
  /** Respondió algo que no toca la objeción, o la repitió con otras palabras. */
  'objecion_no_entendida',
  /** El compartido. Preguntó algo **que el prompt sí contesta** y el agente derivó sin necesidad. */
  'dato_faltante',
] as const;
export type CriterioPreAgenda = (typeof CRITERIOS_PRE_AGENDA)[number];

/** Los criterios de cada auditor. **Indexado por agente**, que es lo que la fila guarda. */
export const CRITERIOS_DEL_AGENTE: Readonly<Record<Agente, readonly string[]>> = {
  chat_post_agenda: CRITERIOS_POST_AGENDA,
  chat_pre_agenda: CRITERIOS_PRE_AGENDA,
};

/**
 * El criterio que devolvió el modelo, validado **contra la lista de SU auditor**.
 *
 * ── ESTA FUNCIÓN EXISTE POR UNA MEDICIÓN, NO POR PRUDENCIA ──────────────────
 *
 * En los 59 análisis reales de la plataforma anterior apareció **`calificacion_saltada` —un criterio
 * de pre-agenda— en análisis de agentes de POST-agenda**. O su enumerado era compartido, o el modelo
 * no estaba acotado a la lista de su territorio.
 *
 * El daño no es un error: es un veredicto que juzga el trabajo equivocado y se ve igual que uno bueno.
 * Por eso la validación es **por agente** y no contra las catorce juntas — que es exactamente el
 * atajo que produce ese cruce.
 *
 * Lo desconocido **cae al valor neutro**, no tira el análisis: perder la inferencia por un criterio
 * mal escrito sería el peor cambio posible.
 */
export function criterioValido(agente: Agente, criterio: string | null | undefined): string {
  if (criterio === null || criterio === undefined) return SIN_CRITERIO;
  const normalizado = criterio.trim().toLowerCase();
  if (normalizado === SIN_CRITERIO) return SIN_CRITERIO;
  return CRITERIOS_DEL_AGENTE[agente].includes(normalizado) ? normalizado : SIN_CRITERIO;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS VOCABULARIOS DE LA FILA
// ═══════════════════════════════════════════════════════════════════════════════

/** Los tres niveles. `null` es la **ausencia** de veredicto, no un cuarto. */
export const NIVELES = ['verde', 'amarillo', 'rojo'] as const;
export type Nivel = (typeof NIVELES)[number];

/**
 * La severidad de un hallazgo. **No es lo mismo que la intervención.**
 *
 * `rojo` le cuesta clientes o le da información falsa a la gente; `amarillo` le baja la conversión o
 * la calidad **sin daño directo**. Y un hallazgo puede ser rojo **sin que la conversación requiera
 * intervención** —el daño ya ocurrió y el contacto se fue tranquilo—.
 */
export const SEVERIDADES = ['rojo', 'amarillo'] as const;
export type Severidad = (typeof SEVERIDADES)[number];

export const CATEGORIAS = ['comportamiento', 'base_conocimiento', 'informacion_adicional'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Del CONTACTO, no del agente, e independiente de todo lo demás. */
export const SENTIMIENTOS = ['positivo', 'neutral', 'molesto'] as const;
export type Sentimiento = (typeof SENTIMIENTOS)[number];

/**
 * Las cuatro etiquetas de observación. Una observación **DESCRIBE**; un hallazgo **IMPUTA**.
 *
 * *«No hizo las dos preguntas porque la llamada duró 19 segundos»* es una observación.
 * *«No hace las preguntas de calificación nunca»* es un hallazgo, y lleva su corrección.
 *
 * Una observación no tiene código de patrón, no tiene corrección, y **no mueve el nivel**.
 */
export const ETIQUETAS_DE_OBSERVACION = [
  /** El prompt pide algo que en **esta** conversación no ocurrió. */
  'cobertura_prompt',
  /** Se cortó o se abandonó antes de que la conversación se desarrollara. */
  'ritmo',
  /** Algo que el agente podía aprovechar y no aprovechó, sin llegar a fallo. */
  'oportunidad',
  /** Algo que conviene saber y que **no** es responsabilidad del agente. */
  'contexto',
] as const;
export type EtiquetaDeObservacion = (typeof ETIQUETAS_DE_OBSERVACION)[number];

/** Qué hizo que este análisis corriera. `siembra` **no es un análisis**: es una marca de línea base. */
export const DISPAROS = ['debounce', 'alarma', 'manual', 'siembra'] as const;
export type Disparo = (typeof DISPAROS)[number];

/**
 * El tope de hallazgos por análisis. **Se recorta en código, no en el esquema del modelo.**
 *
 * El esquema de salida no lleva topes de items a propósito: un esquema estricto con un máximo hace que
 * el modelo trunque en vez de elegir. Se le pide que traiga los más importantes y se recorta acá.
 */
export const TOPE_DE_HALLAZGOS = 3;

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA DERIVACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

/** Lo que hace falta para derivar un nivel. Nada más, y nada del modelo salvo lo declarado. */
export interface ParaDerivarElNivel {
  /** ¿La conversación se pudo juzgar? Lo decide la precondición, antes de evaluar nada. */
  auditable: boolean;
  /** ¿Pide que un humano tome esta conversación ahora? */
  intervencion: boolean;
  /** Cuántos hallazgos quedaron **después** de descartar los inválidos. */
  hallazgos: number;
  /** El nivel que pidió el modelo. Solo se honra en un caso: ver la regla 4. */
  pidioElModelo: Nivel | null;
}

/**
 * El nivel que se guarda. **Las cuatro reglas del encabezado, en orden.**
 *
 * Devuelve `null` cuando no hay veredicto, que es un valor legítimo y no un fallo.
 */
export function nivelDerivado(de: ParaDerivarElNivel): Nivel | null {
  /* 1 · Sin auditar no hay veredicto. Corta primero porque es la precondición: se decidió ANTES de
     evaluar, y no se fuerza un veredicto sobre una conversación que el propio auditor declaró
     imposible de juzgar. */
  if (!de.auditable) return null;

  /* 2 · La intervención ES la definición de rojo, y la base lo hace cumplir con
     `check ((coalesce(nivel,'') = 'rojo') = intervencion)`. Este `return` y esa restricción son la
     misma afirmación escrita dos veces a propósito: acá para que la fila salga bien, allá para que no
     pueda salir mal. */
  if (de.intervencion) return 'rojo';

  /* 3 · Reportó algo observable con su cita y su patrón. */
  if (de.hallazgos > 0) return 'amarillo';

  /* 4 · Sin hallazgos es verde, salvo que el modelo haya pedido amarillo. Ver la tensión en el
     encabezado: lo que impide ese amarillo es la rúbrica, y si igual llega no se pisa. */
  return de.pidioElModelo === 'amarillo' ? 'amarillo' : 'verde';
}

/**
 * El código de patrón, normalizado. `null` si no sobrevive.
 *
 * ── QUÉ SE HACE CON UN CÓDIGO QUE NO SOBREVIVE ──────────────────────────────
 *
 * **Se descarta el HALLAZGO, no el análisis.** El formato lo hace cumplir la base con un `check`, así
 * que un código inválido tumbaría la escritura entera y se perdería la inferencia con todo lo demás
 * que el veredicto traía. Tirar un hallazgo es mejor que tirar un análisis.
 *
 * Y por eso el esquema de salida del modelo **no lleva patrones de texto**: pedirle el formato ahí
 * haría que un código mal escrito rompiera la respuesta completa en vez de una de sus partes.
 */
export function normalizarPatron(patron: string | null | undefined): string | null {
  if (typeof patron !== 'string') return null;
  const limpio = patron
    .trim()
    .toLowerCase()
    // Los espacios y los guiones se vuelven guiones bajos: es el error de tipeo esperable.
    .replace(/[\s-]+/g, '_')
    // Y se quitan los acentos, que es el otro. `NFD` los separa de su letra y el rango los borra.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Lo que quede fuera del alfabeto no se traduce: se va.
    .replace(/[^a-z0-9_]/g, '')
    // Y los guiones bajos repetidos que las dos pasadas anteriores pudieron dejar.
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  // El mismo rango que el `check` de la base, escrito una vez acá y una allá porque son dos capas.
  return /^[a-z0-9_]{3,48}$/.test(limpio) ? limpio : null;
}
