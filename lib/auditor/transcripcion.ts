// EL TRANSCRIPT y LOS HECHOS MEDIDOS: lo que el modelo ve de una conversación.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL TRANSCRIPT **ETIQUETA, NO FILTRA**
//
// Sacar del transcript a los que no son el agente parece más limpio y produce cinco defectos
// concretos:
//
//   1 · La bronca del contacto suele responder a **una plantilla automática**. Sin verla, el auditor
//       le atribuye el enojo al agente.
//   2 · Un **asesor humano posterior** convierte «dejó de responder» en un **traspaso**.
//   3 · Si la promesa incorrecta la hizo una plantilla, **la corrección va al flujo, no al prompt**.
//   4 · «Insiste y no entiende» se juzga **contando turnos**; sacar mensajes cambia la cuenta.
//   5 · La evidencia que se guarda tiene que poder **recortarse del mismo transcript** que vio el
//       modelo. Si el modelo vio una conversación filtrada, la cita que devuelve no se puede ubicar.
//
// Así que van todas las líneas, cada una con su etiqueta, y la etiqueta lleva adentro la instrucción
// de no imputar nada de esa línea. Quién dice cada una lo decide `lib/auditor/atribucion.ts`, que es
// el único lugar del módulo que lo sabe.
//
// ── LO TEMPORAL SE MIDE EN CÓDIGO, Y EL MODELO TIENE PROHIBIDO RECALCULARLO ──
//
// > **«Dejó de responder» es una afirmación temporal, y los modelos calculan mal el tiempo.**
//
// El criterio de abandono pide **tres condiciones a la vez** —el último mensaje es del contacto,
// nadie respondió después, y el silencio supera el umbral— y las tres son hechos estructurales, no
// interpretaciones. Se miden acá y viajan como datos, con la instrucción de no contradecirlos.
//
// La tercera es la que más se equivoca sola: contar horas entre dos sellos de tiempo escritos en un
// texto es exactamente lo que un modelo hace mal, y el resultado sería un abandono inventado o uno
// que no se ve.
// ═══════════════════════════════════════════════════════════════════════════════

import { atribuir, type AutorDeLaLinea, type LineaAAtribuir } from './atribucion.ts';

/** Un mensaje, con lo mínimo que hacen falta para el transcript y los hechos. */
export interface MensajeParaAuditar extends LineaAAtribuir {
  cuerpo: string | null;
  enviado_el: Date;
}

/**
 * Cuántos mensajes se le manda al modelo. **Solo la cola de la conversación.**
 *
 * Lo viejo no explica el fallo de hoy, y el transcript es lo que domina el costo: **el costo de una
 * conversación crece con el CUADRADO de su longitud**, porque se re-manda entero en cada análisis.
 *
 * Y cuando se recortó, **el transcript lo dice en su primera línea**: sin eso, el modelo lee la
 * conversación como si empezara ahí y puede reportar que el agente nunca saludó.
 */
export const TOPE_DE_LINEAS = 40;

/**
 * El silencio que define «dejó de responder», en minutos.
 *
 * Viaja al modelo como un hecho para que no lo invente. Es un número de producto: más corto marcaría
 * como abandono una pausa normal de una conversación por mensajería.
 */
export const UMBRAL_DE_SILENCIO_MIN = 60;

/**
 * Un mensaje sin texto —un audio, una imagen— **existió, y su contenido no lo tenemos.**
 *
 * Va entre corchetes y la rúbrica dice explícitamente que no se suponga qué decía. Borrar la línea
 * sería peor: el turno anterior parecería sin respuesta.
 */
const SIN_TEXTO = '[mensaje sin texto: audio o imagen]';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL SELLO DE TIEMPO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * `03/08 14:02` — la fecha y la hora de una línea, **en la zona de la EMPRESA**.
 *
 * ── LOS DOS DEFECTOS QUE ESTA FUNCIÓN CIERRA ────────────────────────────────
 *
 * **1 · La zona era una constante del módulo.** Y el módulo se carga una vez y audita conversaciones
 * de varias empresas, así que la zona de la primera quedaba congelada para todas. **El modelo lee
 * estos sellos para comparar horas entre líneas**, así que una empresa en otro huso recibía la
 * conversación con los horarios corridos y el veredicto se calculaba sobre eso.
 *
 * **2 · El ancho es FIJO, con relleno de ceros.** No es prolijidad: un ancho variable es exactamente
 * lo que confunde a un modelo que tiene que comparar horas. `3/8 9:02` y `03/08 14:02` en la misma
 * columna se leen como formatos distintos.
 *
 * Se arma con `formatToParts` y no con un `toLocaleString` que dé el formato por casualidad: el
 * formato de salida de una configuración regional **no es un contrato**.
 *
 * ── Y EL RELLENO SE HACE A MANO, PORQUE `Intl` NO LO GARANTIZA ─────────────
 *
 * Medido: con `day: '2-digit'` y la configuración `es`, `formatToParts` devuelve **`3`** y no `03`.
 * `Intl` puede resolver el ancho pedido a `numeric` según la combinación de campos, y eso no es un
 * error suyo: `2-digit` es una preferencia, no una promesa.
 *
 * O sea que pedir el ancho y confiar en él produce exactamente el defecto que este bloque dice
 * evitar — y de la peor forma, porque el sello **se ve bien** y el modelo compara mal en silencio.
 * Se rellena acá, sobre lo que `Intl` devuelva.
 */
export function selloDeTiempo(instante: Date, zona: string): string {
  const partes = (z: string): Record<string, string> => {
    const salida: Record<string, string> = {};
    for (const p of new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      /* `hourCycle: 'h23'` y NO `hour12: false`, y la diferencia es medianoche.
       *
       * `hour12: false` no elige un ciclo: lo deja a la configuración regional, que puede resolverlo a
       * `h23` —medianoche es `00`— o a `h24` —medianoche es `24`—. Con `es` en este entorno da `00`,
       * medido; en otro entorno o con otra versión de ICU puede dar `24`, y el modelo leería una hora
       * que no existe.
       *
       * La primera versión manejaba el `24` con un `if`, y ese `if` era **inalcanzable acá**: una
       * mutación que lo borraba sobrevivía a la suite entera. Pedir el ciclo hace que el estado no
       * pueda ocurrir, que es mejor que atenderlo. */
      hourCycle: 'h23',
      timeZone: z,
    }).formatToParts(instante)) {
      if (p.type !== 'literal') salida[p.type] = p.value;
    }
    return salida;
  };

  let p: Record<string, string>;
  try {
    p = partes(zona);
  } catch {
    /* Una zona inválida no puede dejar al modelo sin sellos: sin ellos no puede juzgar nada temporal
       y el veredicto sale peor. Se cae a tiempo universal y se sigue — y `UTC` es lo que la base
       tiene por omisión, así que el caso ya está cubierto por el flujo normal. */
    p = partes('UTC');
  }

  /** Dos dígitos, siempre. Ver el bloque del encabezado: `Intl` no lo garantiza. */
  const dos = (valor: string | undefined): string => (valor ?? '0').padStart(2, '0');

  return `${dos(p['day'])}/${dos(p['month'])} ${dos(p['hour'])}:${dos(p['minute'])}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL TRANSCRIPT
// ═══════════════════════════════════════════════════════════════════════════════

export interface Transcript {
  /** El texto que va en el mensaje al modelo. Con su primera línea de aviso si se recortó. */
  texto: string;
  /** Cuántas líneas quedaron. */
  lineas: number;
  /** Si se dejaron mensajes afuera, y cuántos. `0` = entró la conversación completa. */
  recortados: number;
}

/**
 * Arma el transcript etiquetado.
 *
 * @param mensajes La conversación **en orden cronológico**. No se ordena acá: quien la trae la pide
 *   ordenada, y ordenarla dos veces es dos criterios que un día difieren.
 * @param zona La zona de la EMPRESA. Ver `selloDeTiempo`.
 * @param idDelAgente El identificador del agente en el CRM de esa empresa, o `null`.
 */
export function armarTranscript(
  mensajes: readonly MensajeParaAuditar[],
  zona: string,
  idDelAgente: string | null,
): Transcript {
  const recortados = Math.max(0, mensajes.length - TOPE_DE_LINEAS);
  const cola = recortados > 0 ? mensajes.slice(-TOPE_DE_LINEAS) : mensajes;

  const lineas = cola.map((m) => {
    const quien = atribuir(m, idDelAgente);
    const texto = m.cuerpo === null || m.cuerpo.trim() === '' ? SIN_TEXTO : m.cuerpo.trim();
    return `[${selloDeTiempo(m.enviado_el, zona)}] ${quien}: ${texto}`;
  });

  /* El aviso va PRIMERO y no al final, porque es lo que el modelo tiene que saber antes de leer la
     primera línea: sin él, una conversación recortada se lee como una que empezó ahí — y el auditor
     puede reportar que el agente nunca se presentó. */
  const aviso =
    recortados > 0
      ? [
          `[la conversación tiene ${mensajes.length} mensajes y acá van los últimos ` +
            `${TOPE_DE_LINEAS}: hay ${recortados} anteriores que NO estás viendo. No supongas qué ` +
            `decían ni reportes lo que falte de ellos.]`,
        ]
      : [];

  return {
    texto: [...aviso, ...lineas].join('\n'),
    lineas: lineas.length,
    recortados,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS HECHOS MEDIDOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Los hechos que el código mide y el modelo **no puede recalcular**.
 *
 * Viajan como datos junto al transcript, con la instrucción de no contradecirlos.
 */
export interface HechosDeLaConversacion {
  /** Cuántos mensajes hay **por autor**, con las cinco etiquetas de la atribución. */
  porAutor: Readonly<Record<AutorDeLaLinea, number>>;
  /** De quién es el último mensaje. `null` si no hay ninguno. */
  ultimoEsDe: AutorDeLaLinea | null;
  /** Hace cuántos minutos fue el último mensaje, de cualquiera. */
  minutosDesdeElUltimo: number | null;
  /**
   * Hace cuántos minutos fue el último **del agente**. `null` = **nunca escribió**.
   *
   * Y esa distinción es la que sostiene la precondición: sin ninguna línea del agente no hay nada
   * que auditar, y **bajo ninguna circunstancia eso es una falla del agente**.
   */
  minutosDesdeElAgente: number | null;
  /**
   * **¿Alguien respondió después del último mensaje del contacto?**
   *
   * Es la condición (b) del criterio de abandono, y es un **hecho estructural del arreglo**, no una
   * interpretación. Y «alguien» incluye una plantilla automática: eso es un traspaso o un
   * seguimiento, no un abandono.
   *
   * `null` cuando el contacto no escribió nunca: ahí la pregunta no tiene sujeto, y responder `false`
   * afirmaría que nadie le contestó a alguien que no habló.
   */
  respondieronAlContacto: boolean | null;
  /** Cuántos mensajes llegaron **sin texto** (audio o imagen). */
  sinTexto: number;
  /** El umbral que define «dejó de responder». Viaja para que el modelo no lo invente. */
  umbralDeSilencioMin: number;
}

/** Todas las etiquetas en cero, para que el conteo tenga las cinco claves siempre presentes. */
function enCero(): Record<AutorDeLaLinea, number> {
  return {
    CONTACTO: 0,
    'AGENTE IA': 0,
    'ASESOR HUMANO': 0,
    'AUTOMATIZACIÓN': 0,
    'ORIGEN NO IDENTIFICADO': 0,
  };
}

/**
 * Mide los hechos de una conversación.
 *
 * **Se miden sobre la conversación COMPLETA, no sobre el transcript recortado.** Los dos son
 * distintos a propósito: el transcript se recorta por costo, y un conteo sobre 40 de 120 mensajes
 * diría que el agente mandó 12 cuando mandó 40 — y el debounce, que resta contra ese número, se
 * volvería loco.
 *
 * @param ahora El instante contra el que se mide. **Se pasa, no se lee de `Date.now()`**: el reloj
 *   tiene que ser el mismo que el de la consulta que trajo los mensajes, o la misma conversación
 *   puede caer de un lado en una medición y del otro en la siguiente.
 */
export function medirHechos(
  mensajes: readonly MensajeParaAuditar[],
  idDelAgente: string | null,
  ahora: Date,
): HechosDeLaConversacion {
  const porAutor = enCero();
  let sinTexto = 0;
  let ultimo: { quien: AutorDeLaLinea; el: Date } | null = null;
  let ultimoDelAgente: Date | null = null;
  let ultimoDelContacto: Date | null = null;

  for (const m of mensajes) {
    const quien = atribuir(m, idDelAgente);
    porAutor[quien]++;
    if (m.cuerpo === null || m.cuerpo.trim() === '') sinTexto++;

    if (ultimo === null || m.enviado_el.getTime() >= ultimo.el.getTime()) {
      ultimo = { quien, el: m.enviado_el };
    }
    if (quien === 'AGENTE IA') {
      if (ultimoDelAgente === null || m.enviado_el > ultimoDelAgente) ultimoDelAgente = m.enviado_el;
    }
    if (quien === 'CONTACTO') {
      if (ultimoDelContacto === null || m.enviado_el > ultimoDelContacto) {
        ultimoDelContacto = m.enviado_el;
      }
    }
  }

  const minutosDesde = (d: Date | null): number | null =>
    d === null ? null : Math.max(0, Math.floor((ahora.getTime() - d.getTime()) / 60_000));

  /* ── LA CONDICIÓN (b) DEL ABANDONO ────────────────────────────────────────
   *
   * ¿Hay alguna línea POSTERIOR a la última del contacto? Se pregunta por el instante y no por «el
   * último es del contacto», y la diferencia importa: dos mensajes del contacto seguidos al final
   * son una frase partida en dos, y con la otra forma el segundo taparía al primero.
   *
   * Y se cuenta **cualquiera**, incluida una plantilla: eso es un traspaso o un seguimiento, no un
   * abandono. Es el descarte que el criterio lleva escrito.
   *
   * ── UNA MUTACIÓN DE ESTA LÍNEA SOBREVIVE, Y HAY QUE DECIR POR QUÉ ──────────
   *
   * Preguntar `ultimo.quien !== 'CONTACTO'` da **exactamente lo mismo**, y no solo «casi»: si el
   * mensaje de instante máximo no es del contacto, entonces es posterior al último del contacto —y
   * las dos formas dicen «sí»—; y si SÍ es del contacto, entonces nada hay después —y las dos dicen
   * «no»—. Con instantes distintos son la misma proposición, y en producción hay **cero instantes
   * repetidos**, medido.
   *
   * Así que la mutación es equivalente y ninguna prueba la puede matar. Se escribe escaneando igual
   * por un motivo que no es técnico: **esta línea es la transcripción literal de la condición (b)**
   * —«¿alguien respondió después del último mensaje del contacto?»— y la otra forma obliga a quien
   * lea a rederivar la equivalencia para saber si dice lo mismo que la regla.
   *
   * Lo que SÍ dependa del orden sería un defecto, y eso sí está fijado: los dos «últimos» salen del
   * INSTANTE y no de la posición en el arreglo, y una prueba pasa la lista desordenada. */
  const respondieronAlContacto =
    ultimoDelContacto === null
      ? null
      : mensajes.some(
          (m) =>
            m.enviado_el.getTime() > (ultimoDelContacto as Date).getTime() &&
            atribuir(m, idDelAgente) !== 'CONTACTO',
        );

  return {
    porAutor,
    ultimoEsDe: ultimo === null ? null : ultimo.quien,
    minutosDesdeElUltimo: minutosDesde(ultimo === null ? null : ultimo.el),
    minutosDesdeElAgente: minutosDesde(ultimoDelAgente),
    respondieronAlContacto,
    sinTexto,
    umbralDeSilencioMin: UMBRAL_DE_SILENCIO_MIN,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA PRECONDICIÓN
// ═══════════════════════════════════════════════════════════════════════════════

/** Por qué no se puede auditar. `null` = sí se puede. */
export type PorQueNoSeAudita =
  | 'sin_lineas_del_agente'
  | 'menos_de_dos_intercambios'
  | 'mayoria_sin_texto';

/** El texto de cada motivo, que va a la fila y a la pantalla. */
export const MOTIVOS_DE_NO_AUDITABLE: Readonly<Record<PorQueNoSeAudita, string>> = {
  sin_lineas_del_agente:
    'No hay ninguna línea del agente en esta conversación. Sin agente no hay nada que auditar, y eso ' +
    'no es una falla del agente: es su ausencia.',
  menos_de_dos_intercambios:
    'Menos de dos intercambios reales: la conversación no llegó a desarrollarse lo suficiente para ' +
    'juzgar cómo se atendió.',
  mayoria_sin_texto:
    'Más de la mitad de los mensajes son audio o imagen sin transcripción: lo que se dijo no lo ' +
    'tenemos, así que no se puede juzgar.',
};

/**
 * ¿Se puede auditar esta conversación? **Corta ANTES de evaluar nada y antes de gastar.**
 *
 * ── LA PRIMERA CONDICIÓN ES LA QUE CIERRA EL FALSO POSITIVO ORIGINAL ────────
 *
 * Sin ninguna línea del agente, el criterio **«la IA dejó de responder» se cumple SIEMPRE** — y le
 * imputaba al agente su propia ausencia. Por eso esta comprobación es sobre **los hechos** y no sobre
 * las etiquetas del contacto: **una etiqueta puede mentir**. Quedó puesta, el automatismo no corrió,
 * alguien la editó a mano.
 *
 * Y cuando corta, el análisis **igual se escribe**: con «no auditable», su motivo, el resumen, sin
 * hallazgos y sin intervención. No se fuerza un veredicto, y tampoco se pierde el registro de que el
 * auditor miró.
 */
export function porQueNoSeAudita(hechos: HechosDeLaConversacion): PorQueNoSeAudita | null {
  if (hechos.porAutor['AGENTE IA'] === 0) return 'sin_lineas_del_agente';

  /* Dos intercambios REALES: al menos dos de cada lado. No es «cuatro mensajes»: cuatro del contacto
     y cero del agente no son dos intercambios, y ya lo cortó la condición de arriba — pero cuatro del
     agente y uno del contacto tampoco, y ésa es la que cierra acá. */
  if (hechos.porAutor['CONTACTO'] < 2 || hechos.porAutor['AGENTE IA'] < 2) {
    return 'menos_de_dos_intercambios';
  }

  /* Más de la MITAD sin texto. Se cuenta sobre el total de la conversación, y con `>` estricto: la
     mitad exacta todavía deja la mitad legible. */
  const total = Object.values(hechos.porAutor).reduce((n, x) => n + x, 0);
  if (total > 0 && hechos.sinTexto * 2 > total) return 'mayoria_sin_texto';

  return null;
}
