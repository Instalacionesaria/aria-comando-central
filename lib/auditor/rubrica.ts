// LA RÚBRICA: el texto que el modelo lee. **Un molde compartido y dos listas de criterios.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL MOLDE ES UNO, Y ES LA DECISIÓN CENTRAL DE ESTE ARCHIVO
//
// Los dos auditores comparten TODO menos los criterios: la regla de atribución, la separación entre
// intervención y hallazgo, la exigencia de la cita textual, cómo se lee un transcript recortado.
//
// **Duplicar el molde garantizaría que la regla de atribución divergiera**, y es justo la que no
// puede: es la que decide a quién se le imputa una línea. El día que una copia dijera «el agente» y la
// otra «el agente o una automatización», el segundo auditor empezaría a producir hallazgos correctos
// sobre un culpable equivocado — y se verían idénticos a los buenos.
//
// Así que el molde se arma UNA vez y lo único que se le enchufa por agente son su misión y sus siete
// criterios.
//
// ── POR QUÉ ESTO ES TypeScript Y NO ARCHIVOS `.md`, QUE CORRIGE EL PLAN ─────
//
// El plan de este módulo decía que la rúbrica iría en archivos, con el precedente de
// `lib/fundaciones/skills/`. **Se revisó ese precedente y no aplica**, por tres motivos medidos:
//
//   1 · Esos archivos existen porque son **copias byte a byte** de otro repositorio: cuando Jorge
//       corrige un framework allá, el diff entre los dos árboles tiene que ser legible. La rúbrica no
//       tiene un árbol de origen contra el que diferenciarse — es nuestra.
//
//   2 · Leer del disco arrastra dos trampas que ese archivo documenta en carne propia: la entrada en
//       `outputFileTracingIncludes` de `next.config.mjs` —sin ella *«la lectura falla en producción y
//       funciona en desarrollo, que es la peor combinación posible»*— y el frontmatter con `\r\n`, que
//       durante un tiempo metió el bloque YAML entero dentro del prompt **solo en la máquina donde se
//       mide**. Dos modos de fallo silenciosos a cambio de nada.
//
//   3 · Y el decisivo: acá la rúbrica **se construye desde el vocabulario**. `RUBRICA_POST_AGENDA` es
//       un `Record` sobre el enumerado de criterios de ese agente, así que **agregar un criterio a la
//       lista sin escribir su rúbrica no compila**. En un `.md` nada lo comprobaría: el criterio
//       existiría en el esquema, el modelo podría devolverlo, y el texto no diría nunca cuándo
//       dispara. Un criterio sin disparo escrito es un criterio que dispara por parecido semántico.
//
// Lo que **sí** se edita desde la plataforma es otra cosa: el prompt de cada agente por empresa. Eso
// es un dato de la empresa. La rúbrica es cómo juzga el sistema, y cambiarla cambia el veredicto de
// todos los agentes de todas las empresas: va en un diff que alguien mira.
//
// ── Y LOS DESCARTES SON LA MITAD QUE IMPORTA ────────────────────────────────
//
// Cada criterio lleva su condición de disparo **y su lista de descartes**, y los segundos no son
// adorno: son los que evitan que el modelo confirme un criterio **por parecido semántico**. Sin
// descartes, «frustración no manejada» dispara con un contacto que contestó «ok» seco, y a partir de
// ahí el técnico deja de mirar la pantalla — que es la única forma real de perder este módulo.
//
// Una prueba afirma que **ningún criterio tiene la lista de descartes vacía**.
// ═══════════════════════════════════════════════════════════════════════════════

import { COMO_LEER_LOS_AUTORES, IMPUTABLE } from './atribucion.ts';
import type { HechosDeLaConversacion } from './transcripcion.ts';
import {
  SIN_CRITERIO,
  TOPE_DE_HALLAZGOS,
  type Agente,
  type CriterioPostAgenda,
  type CriterioPreAgenda,
} from './veredicto.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA FORMA DE UN CRITERIO
// ═══════════════════════════════════════════════════════════════════════════════

/** Un criterio, en el texto que el modelo lee. */
export interface TextoDelCriterio {
  /** **Cuándo dispara.** Una condición, no una descripción del tema. */
  disparo: string;
  /**
   * **Cuándo NO dispara**, aunque se parezca.
   *
   * Nunca vacía, y una prueba lo afirma. El caso que hay que descartar es siempre el vecino más
   * cercano: el que un lector apurado confundiría con el criterio.
   */
  descartes: readonly string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA MISIÓN, QUE ES LO QUE HACE QUE UN CRITERIO SIGNIFIQUE ALGO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Qué está tratando de hacer el agente que se juzga.
 *
 * ── NO ES CONTEXTO DE CORTESÍA: SIN ESTO NO HAY FALLA ───────────────────────
 *
 * «El agente no preguntó el presupuesto» es una falla grave en pre-agenda y **no es nada** en
 * post-agenda, donde la calificación ya ocurrió. La misma línea del transcript, el mismo agente, y dos
 * veredictos opuestos: lo único que los separa es la misión.
 *
 * Y el daño caro también es otro en cada etapa. Allá es perder a alguien que ya iba a comprar; acá es
 * **agendarle una hora a un vendedor con alguien que no puede comprar**.
 */
export const MISION_DEL_AGENTE: Readonly<Record<Agente, string>> = {
  chat_post_agenda:
    'El contacto YA AGENDÓ una llamada con un vendedor. La misión del agente es que LLEGUE a esa ' +
    'llamada: confirmar, resolver dudas, sostener el interés hasta la hora. No es vender —eso pasa en ' +
    'la llamada— y no es calificar: eso ya ocurrió. El daño caro de esta etapa es perder a alguien que ' +
    'ya iba a comprar.',
  chat_pre_agenda:
    'El contacto TODAVÍA NO AGENDÓ. La misión del agente es doble y en este orden: primero averiguar ' +
    'si el contacto puede comprar, y solo entonces conseguir la cita. El daño caro de esta etapa es al ' +
    'revés que en la otra: es AGENDAR A QUIEN NO PUEDE COMPRAR, porque le quema una hora a un vendedor ' +
    'y le da a la empresa un número de citas que no significa nada.',
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LOS SIETE DE POST-AGENDA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * La rúbrica de post-agenda. **Un `Record` sobre el enumerado**, no un array de objetos.
 *
 * Es lo que hace que agregar un criterio a `CRITERIOS_POST_AGENDA` sin escribir su disparo y sus
 * descartes **no compile**. Un array no lo detectaría: tendría seis entradas y el séptimo criterio
 * seguiría existiendo en el esquema, disponible para que el modelo lo devuelva sin que nada le haya
 * dicho cuándo.
 */
export const RUBRICA_POST_AGENDA: Readonly<Record<CriterioPostAgenda, TextoDelCriterio>> = {
  frustracion_no_manejada: {
    disparo:
      'El contacto expresa fastidio, decepción o enojo de forma inequívoca, y la respuesta SIGUIENTE ' +
      `del ${IMPUTABLE} lo ignora, sigue el guion, o repite lo que ya había dicho.`,
    descartes: [
      'Un contacto seco no es un contacto frustrado. «ok», «dale», «ya vi», una respuesta de dos ' +
        'palabras: nada de eso es fastidio.',
      'Si el fastidio fue LA ÚLTIMA línea de la conversación, el agente no tuvo ninguna oportunidad de ' +
        'responderlo. No dispara: no se le imputa una respuesta que no existe.',
      'Si la línea que provocó el fastidio es de AUTOMATIZACIÓN, la corrección va al flujo del CRM y ' +
        'no al prompt del agente.',
      'Si después del fastidio escribió un ASESOR HUMANO, hubo traspaso y el caso está atendido.',
    ],
  },

  abandono_de_conversacion: {
    disparo:
      'Las TRES a la vez, y las tres vienen medidas en los HECHOS: (a) la última línea es del ' +
      'CONTACTO, (b) nadie escribió después de ella, y (c) el silencio pasó del umbral que los hechos ' +
      'declaran.',
    descartes: [
      'Las tres son hechos ya medidos. NO las estimes leyendo los sellos de tiempo del transcript: si ' +
        'los hechos dicen que alguien respondió, alguien respondió.',
      '«Alguien» de la condición (b) incluye una AUTOMATIZACIÓN y un ASESOR HUMANO. Una plantilla de ' +
        'seguimiento o un traspaso a una persona no son un abandono.',
      'Si el contacto no escribió nunca, la condición (b) no tiene sujeto y el criterio no aplica.',
      'Un silencio más corto que el umbral no es abandono, por más inconclusa que se sienta la ' +
        'conversación. El umbral es el umbral.',
    ],
  },

  promesa_incorrecta: {
    disparo:
      `El ${IMPUTABLE} se contradice con algo que él mismo dijo antes, o promete un precio, una fecha, ` +
      'un descuento o una condición que no le corresponde ofrecer.',
    descartes: [
      'Si no tenés el dato correcto, NO SABÉS que una afirmación aislada es falsa. Una contradicción ' +
        'interna sí se ve sin saber la verdad; una afirmación suelta, no. Ante la duda no dispara.',
      'Repetir un dato que el prompt del agente sí respalda no es una promesa incorrecta, aunque a vos ' +
        'te parezca una mala idea comercial.',
      'Confirmar la cita que ya estaba agendada no es prometer una fecha: la fecha ya existía.',
    ],
  },

  no_es_lo_que_busca: {
    disparo:
      'El contacto dice —con sus palabras— que lo ofrecido no le sirve, y el agente sigue empujando el ' +
      'MISMO camino en vez de reconocerlo.',
    descartes: [
      'Una objeción no es un rechazo. «es caro», «lo tengo que pensar», «no sé si es para mí» son ' +
        'objeciones, y responderlas es exactamente el trabajo del agente.',
      'Preguntar una vez más para entender POR QUÉ no le sirve no es seguir empujando.',
    ],
  },

  insiste_sin_entender: {
    disparo: 'El contacto pide LO MISMO tres veces o más y no lo obtiene.',
    descartes: [
      'Tres, contadas en el transcript. Dos veces no es este criterio.',
      'Tiene que ser lo mismo. Tres preguntas DISTINTAS sin responder son otro problema y otro ' +
        'criterio.',
      'Si lo obtuvo a la tercera, no dispara: llegó tarde, no nunca. Eso puede ser una observación.',
    ],
  },

  fuera_de_alcance_sin_salida: {
    disparo:
      'El contacto pide algo que el agente no puede resolver, y el agente NI deriva a una persona NI ' +
      'dice qué va a pasar.',
    descartes: [
      'Lo que dispara es la ausencia de SALIDA, no la ausencia de respuesta. «Eso lo vas a ver con tu ' +
        'asesor en la llamada» es una salida.',
      'Si derivó, no dispara, aunque la derivación haya sido tosca. Que sea tosca es una observación.',
    ],
  },

  dato_faltante: {
    disparo:
      'El contacto hace una pregunta razonable —de las que hace cualquier interesado— y el agente no ' +
      'la sabe contestar.',
    descartes: [
      'Si el agente SÍ contestó y contestó mal, esto no es lo que pasó: es `promesa_incorrecta`. Acá ' +
        'falta el dato; allá el dato está equivocado.',
      'Una pregunta que ninguna empresa contestaría por chat —datos de otra persona, algo legal, algo ' +
        'que exige ver un caso— no es un dato faltante.',
      'Su categoría es `base_conocimiento` y su corrección AGREGA EL DATO. Si lo que hay que cambiar ' +
        'es cómo se comporta el agente, es otro criterio.',
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LOS SIETE DE PRE-AGENDA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * La rúbrica de pre-agenda.
 *
 * ── SU EVIDENCIA REAL ES CERO, Y ESO SE DICE ────────────────────────────────
 *
 * De los 59 análisis de la plataforma anterior, **ninguno fue de un agente de pre-agenda**: corrieron
 * dos auditores de cuatro, los dos de post-agenda. Así que estos siete criterios están escritos y
 * **no están validados con datos reales**, al revés que los de arriba.
 *
 * No cambia el diseño —se construye igual— pero cambia qué esperar: los descartes de acá son los que
 * más probablemente haya que ajustar después de la primera semana, y ese ajuste **es un diff en este
 * archivo**, que es exactamente por qué la rúbrica no es un dato de la base.
 *
 * ── Y `dato_faltante` APARECE EN LAS DOS LISTAS, CON TEXTO DISTINTO ─────────
 *
 * El código es el mismo porque significa lo mismo: falta un dato. Lo que cambia es **contra qué se
 * mide si faltaba**. Un `Record` por lista es lo que permite que el mismo código tenga dos textos sin
 * que ninguno pise al otro.
 */
export const RUBRICA_PRE_AGENDA: Readonly<Record<CriterioPreAgenda, TextoDelCriterio>> = {
  calificacion_saltada: {
    disparo:
      'El agente empuja a agendar SIN HABER PREGUNTADO NADA que permita saber si el contacto puede ' +
      'comprar.',
    descartes: [
      'Es sobre CERO preguntas de calificación, no sobre pocas. Una pregunta hecha y respondida no ' +
        'dispara, por más que vos hubieras preguntado tres.',
      'Si el contacto llegó diciendo por su cuenta lo que hacía falta saber, la pregunta ya está ' +
        'contestada.',
      'Si la conversación se cortó antes de que el agente llegara a empujar la cita, no hay empuje. ' +
        'Eso es una observación de `ritmo`, no un hallazgo.',
    ],
  },

  presiono_a_quien_no_califica: {
    disparo:
      'El contacto dijo que no puede —no tiene el presupuesto, no es para él, no es el momento— y el ' +
      'agente SIGUIÓ empujando la cita.',
    descartes: [
      '«No puedo esta semana» es una restricción de HORARIO, no de calificación. Reagendar es el ' +
        'trabajo del agente.',
      'Ofrecer algo DISTINTO no es presionar. Presionar es insistir con lo mismo que el contacto ya ' +
        'rechazó.',
      'Una sola pregunta para confirmar que entendió bien no es presión.',
    ],
  },

  sin_salida_alternativa: {
    disparo:
      'El contacto NO CALIFICA pero MOSTRÓ INTERÉS, y el agente cerró la conversación sin ofrecerle ' +
      'nada.',
    descartes: [
      'Hacen falta las dos: no califica Y está interesado. Sin interés, cerrar la conversación es ' +
        'correcto y no hay nada que reportar.',
      'Si en el prompt del agente no hay ninguna alternativa que ofrecer, el agente no puede ofrecer ' +
        'lo que no tiene: la falla es que falta en el prompt (categoría `informacion_adicional`), no ' +
        'que se comportó mal.',
    ],
  },

  informacion_falsa: {
    disparo:
      'El agente afirma algo que CONTRADICE el prompt cargado, o algo que el prompt no respalda y él ' +
      'presenta como confirmado.',
    descartes: [
      'SIN PROMPT CARGADO este criterio casi no se sostiene: sin él no sabés qué respalda la empresa. ' +
        'Ahí solo dispara con una contradicción interna del propio agente.',
      'Un dato que el prompt no menciona no es necesariamente falso. Lo que dispara es presentarlo ' +
        'como cierto y confirmado.',
    ],
  },

  abandono_de_lead_calificado: {
    disparo:
      'El contacto mostró que califica, y la conversación terminó SIN PRÓXIMO PASO: sin cita, sin un ' +
      '«te escribo», sin nada.',
    descartes: [
      'Esto NO son las tres condiciones del abandono de post-agenda. Acá lo que falta es el próximo ' +
        'paso, y eso se ve en las últimas líneas, no en el reloj.',
      'Si el agente PROPUSO un próximo paso y el contacto no contestó, el agente hizo su trabajo.',
      'Si el contacto no mostró que califica, no hay lead calificado que abandonar.',
    ],
  },

  objecion_no_entendida: {
    disparo:
      'El contacto plantea una objeción concreta y el agente responde algo que NO LA TOCA, o la repite ' +
      'con otras palabras.',
    descartes: [
      'Una respuesta que sí toca la objeción y no convence NO dispara. El agente no controla el ' +
        'resultado, solo la respuesta.',
      'Si la objeción vino en un mensaje sin texto, no sabés qué decía: no dispara.',
    ],
  },

  dato_faltante: {
    disparo:
      'El contacto pregunta algo QUE EL PROMPT DEL AGENTE SÍ CONTESTA, y el agente derivó o dijo que ' +
      'no sabía.',
    descartes: [
      'SIN PROMPT CARGADO no podés saber si el dato estaba. Ahí es una observación de ' +
        '`cobertura_prompt`, no un hallazgo.',
      'Si el prompt NO lo contesta, la falla es que el dato falta en el prompt (categoría ' +
        '`informacion_adicional`), no que el agente no lo usó.',
    ],
  },
};

/**
 * La rúbrica de cada auditor. **Lo único que el molde recibe distinto.**
 *
 * ── ESTE `Record` ES TAMBIÉN LA RESPUESTA A «QUÉ AGENTES TIENEN AUDITOR» ────
 *
 * En el diseño de origen eso era una lista escrita a mano en otro archivo, y quedó desfasada:
 * declaraba a los dos auditores de voz como «sin auditor» **cuando ya lo tenían**. Su propia
 * documentación lo anota — *«la causa es una lista escrita a mano»*— y es su defecto `4.1`.
 *
 * Acá no hay segunda lista que pueda desfasarse. Al ser un `Record<Agente, …>`, **todo agente que
 * exista tiene rúbrica o el archivo no compila**, así que la pregunta se contesta recorriendo
 * `AGENTES`. Encender un auditor nuevo obliga a escribir sus criterios en el mismo cambio.
 */
export const RUBRICA_DEL_AGENTE: Readonly<
  Record<Agente, Readonly<Record<string, TextoDelCriterio>>>
> = {
  chat_post_agenda: RUBRICA_POST_AGENDA,
  chat_pre_agenda: RUBRICA_PRE_AGENDA,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · EL MOLDE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Lo que separa las secciones del molde. **Exportado porque es estructura, no adorno.**
 *
 * Una prueba parte los dos moldes por acá y exige que todas las secciones coincidan byte a byte salvo
 * dos: la misión y los criterios. Con el separador escrito dos veces —una acá y una en la prueba— esa
 * comprobación se rompería el día que alguien cambie el ancho, y una prueba que se rompe por un cambio
 * cosmético es una que se termina borrando.
 */
export const SEPARADOR = '\n\n════════════════════════════════════════\n\n';

/**
 * **La regla que manda sobre todas.** Constante con nombre, y no una frase suelta dentro del molde.
 *
 * ── POR QUÉ TIENE NOMBRE PROPIO ─────────────────────────────────────────────
 *
 * Es la regla de la que dependen las dos tablas: un hallazgo imputado a una línea que el agente no
 * escribió manda a corregir un prompt que no tiene la culpa, y encima **se ve igual que uno bueno**.
 *
 * Escrita adentro de la función, borrarla era invisible: una mutación la borró y **las veintiuna
 * pruebas siguieron pasando**, porque la comprobación de las cinco etiquetas mira las etiquetas y no
 * la regla que va abajo. Con nombre, la prueba afirma que está puesta sin copiarse su texto.
 *
 * Y lo que eso fija es **el cableado, no la redacción**: cambiarle las palabras a esta constante pasa
 * las pruebas, y así tiene que ser. Una prueba que congela la prosa de un prompt es una prueba que
 * alguien borra la primera vez que mejora una frase.
 */
export const REGLA_DE_IMPUTACION =
  `LA REGLA QUE MANDA SOBRE TODAS: solo se le imputa al agente lo que dice una línea «${IMPUTABLE}». ` +
  'Si el problema está en una línea de otra etiqueta, no es un hallazgo del agente — decilo en una ' +
  'observación de `contexto` y seguí.';

/**
 * **Las dos salidas, y por qué no se mezclan.** También con nombre, y por el mismo motivo.
 *
 * Que fueran una sola cosa es el defecto que este módulo entero existe para arreglar: hacía que un
 * «podría ser más breve» le apagara el agente a una persona real y le encendiera una urgencia a un
 * vendedor. No puede vivir en la descripción de un campo porque es **la relación entre dos**.
 */
export const LAS_DOS_SALIDAS =
  'LAS DOS SALIDAS, Y NO SE MEZCLAN:\n' +
  '  1 · INTERVENCIÓN — hay daño EN CURSO y un humano tiene que tomar ESTA conversación ahora. ' +
  'Interrumpe a un vendedor: cada intervención de más es una que se va a ignorar, y la de al lado ' +
  'también.\n' +
  '  2 · HALLAZGO — algo que se corrige EN EL PROMPT del agente. No interrumpe a nadie: es la lista ' +
  'de un técnico.\n\n' +
  'Un agente verboso, formal, repetitivo o poco cálido produce HALLAZGOS y JAMÁS una intervención. Y ' +
  'al revés: un daño en curso puede no tener ninguna corrección de prompt.';

/** Las cinco etiquetas del transcript con su explicación, armadas desde la atribución. */
function comoLeerElTranscript(): string {
  const filas = Object.entries(COMO_LEER_LOS_AUTORES).map(([etiqueta, que]) => `  · ${etiqueta} — ${que}`);
  return (
    'CADA LÍNEA DEL TRANSCRIPT DICE DE QUIÉN ES. Las etiquetas posibles son cinco:\n' +
    filas.join('\n') +
    '\n\n' +
    REGLA_DE_IMPUTACION
  );
}

/** Un criterio, con su disparo y sus descartes. */
function textoDeUnCriterio(codigo: string, t: TextoDelCriterio): string {
  return (
    `▸ ${codigo}\n` +
    `  DISPARA cuando: ${t.disparo}\n` +
    '  NO dispara:\n' +
    t.descartes.map((d) => `    – ${d}`).join('\n')
  );
}

/**
 * El bloque del prompt del agente. **La ausencia es un estado normal y se dice como tal.**
 *
 * ── LA RAMA VACÍA ES LA QUE VA A CORRER, POR MEDICIÓN ───────────────────────
 *
 * En la plataforma anterior los cuatro espacios de prompt estaban **vacíos**: `length(prompt_*) = 0`
 * en las dos organizaciones. Los 59 análisis salieron **sin prompt de referencia**, así que la rama
 * *«con prompt → reemplazo citado»* **nunca corrió en producción**.
 *
 * De ahí que la rama sin prompt no sea un caso de borde escrito por completitud: es la primera que va
 * a ejecutarse acá también, hasta que alguien cargue un prompt. Y lo que tiene que hacer es **prohibir
 * la cita inventada**: un `fragmento_prompt` con un texto que no está en ningún prompt es una
 * corrección que nadie puede aplicar, y se ve exactamente igual que una buena.
 */
function bloqueDelPrompt(promptDelAgente: string | null): string {
  const vacio = promptDelAgente === null || promptDelAgente.trim() === '';
  if (vacio) {
    return (
      'EL PROMPT DE ESTE AGENTE NO ESTÁ CARGADO.\n\n' +
      'No es un error y se audita igual: lo que hizo el agente está en el transcript. Lo que cambia es ' +
      'qué podés afirmar:\n' +
      '  · `fragmento_prompt` va en null SIEMPRE. No inventes una cita de un prompt que no tenés: una ' +
      'corrección que reemplaza un texto inexistente no se puede aplicar y se ve igual que una buena.\n' +
      '  · Cada `correccion` es una INSTRUCCIÓN AUTÓNOMA para agregar, y empieza diciendo a qué ' +
      'sección va.\n' +
      '  · Los criterios que se miden CONTRA el prompt casi no se pueden sostener acá. Sus descartes ' +
      'lo dicen.'
    );
  }
  return (
    'EL PROMPT DE ESTE AGENTE, TAL CUAL ESTÁ CARGADO:\n\n' +
    '<<<PROMPT\n' +
    promptDelAgente.trim() +
    '\nPROMPT>>>\n\n' +
    'Cuando un hallazgo tenga su causa en este texto, copiá en `fragmento_prompt` el fragmento EXACTO ' +
    'Y LITERAL —tal cual, sin reescribirlo— y poné en `correccion` el reemplazo listo para pegar, en el ' +
    'mismo idioma, tono y formato que el resto. Si no encontrás ningún fragmento que explique la falla, ' +
    '`fragmento_prompt` va en null y la corrección es una instrucción para agregar: no fuerces una cita.'
  );
}

/**
 * El bloque estable de `system`: **la rúbrica completa de un auditor**.
 *
 * ── QUÉ VA ACÁ Y QUÉ VA PEGADO AL CAMPO ─────────────────────────────────────
 *
 * Las reglas de un campo puntual viven en su `description` del esquema, porque *«una regla escrita
 * solo en el texto de la rúbrica se pierde entre cincuenta líneas de transcript»*. Acá va lo que
 * **atraviesa varios campos** y no tiene un campo donde vivir: la atribución, la misión del agente, la
 * separación entre las dos salidas, el prompt, y los criterios con sus descartes.
 *
 * Es duplicación deliberada de ninguna: si una regla aparece dos veces, un día difieren.
 *
 * @param promptDelAgente El prompt de ESA empresa para ESE agente, o `null`. Ver `bloqueDelPrompt`.
 */
export function instruccionesDelAuditor(de: {
  agente: Agente;
  promptDelAgente: string | null;
}): string {
  const criterios = Object.entries(RUBRICA_DEL_AGENTE[de.agente])
    .map(([codigo, t]) => textoDeUnCriterio(codigo, t))
    .join('\n\n');

  return [
    'Sos un auditor de calidad. Leés una conversación entre un agente automático de ventas y una ' +
      'persona, y decidís dos cosas que NO son la misma.',

    comoLeerElTranscript(),

    `LA MISIÓN DEL AGENTE QUE ESTÁS JUZGANDO (${de.agente}):\n${MISION_DEL_AGENTE[de.agente]}`,

    LAS_DOS_SALIDAS,

    bloqueDelPrompt(de.promptDelAgente),

    `LOS CRITERIOS DE ESTE AGENTE. Son estos y ningún otro: si lo que ves no encaja en ninguno, el ` +
      `criterio es «${SIN_CRITERIO}» y lo que tengas va en una observación.\n\n${criterios}`,

    /* El tope se le PIDE al modelo y además se recorta en código. No es redundancia: el esquema no
       lleva máximo de items a propósito —un máximo hace que el modelo trunque en vez de elegir— así
       que pedirlo en palabras es lo único que lo hace elegir. El recorte es la red. */
    'LO QUE NO SE HACE, Y CADA UNA COSTÓ ALGO:\n' +
      `  · No reportes más de ${TOPE_DE_HALLAZGOS} hallazgos. Traé los más importantes: una lista de ` +
      'diez es una lista que nadie lee.\n' +
      '  · No infles el nivel «por las dudas». Un amarillo de más no es prudencia: es la razón por la ' +
      'que el técnico deja de mirar la pantalla.\n' +
      '  · No supongas lo que no ves. Si el transcript avisa que está recortado, lo anterior NO ' +
      'EXISTE para vos. Si un mensaje dice que no tiene texto, no adivines qué decía.\n' +
      '  · No repitas en la corrección el caso puntual. La corrección arregla EL PATRÓN: sin nombres, ' +
      'sin citas de esta conversación.',
  ].join(SEPARADOR);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · EL MENSAJE: LOS HECHOS MEDIDOS, Y DESPUÉS EL TRANSCRIPT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Los hechos, en palabras. **Van ANTES del transcript y se declaran como medidos.**
 *
 * ── POR QUÉ SE LE DAN MEDIDOS EN VEZ DE DEJARLO CONTAR ──────────────────────
 *
 * Tres de los catorce criterios dependen de una cuenta —«tres veces o más», «pasaron más minutos que
 * el umbral», «nadie respondió después»— y un modelo contando líneas de un transcript recortado se
 * equivoca de una forma particularmente mala: **produce un veredicto convincente sobre una cuenta
 * falsa**.
 *
 * Y encima los hechos se miden sobre la conversación **completa**, mientras el transcript puede venir
 * recortado a las últimas cuarenta líneas. O sea que en una conversación larga el modelo **no tiene**
 * los datos para contar bien, ni siquiera esforzándose.
 *
 * De ahí la frase que encabeza el bloque: son hechos, no estimaciones, y no se recalculan.
 */
function textoDeLosHechos(h: HechosDeLaConversacion): string {
  const porAutor = Object.entries(h.porAutor)
    .filter(([, n]) => n > 0)
    .map(([quien, n]) => `  · ${quien}: ${n}`)
    .join('\n');

  /* Los tres tri-estados se escriben en palabras, uno por uno. Un `null` renderizado como «0» o como
     «no» es una afirmación distinta de la que el dato hace: «el agente escribió hace 0 minutos» dice
     que escribió, y «nadie le respondió» dice que alguien habló. Los dos son falsos, y los dos
     sostendrían un criterio. */
  const desdeElAgente =
    h.minutosDesdeElAgente === null
      ? 'El agente NUNCA escribió en esta conversación.'
      : `Última línea del agente: hace ${h.minutosDesdeElAgente} minutos.`;

  const desdeElUltimo =
    h.minutosDesdeElUltimo === null
      ? 'No hay ningún mensaje.'
      : `Última línea de cualquiera: hace ${h.minutosDesdeElUltimo} minutos.`;

  const respondieron =
    h.respondieronAlContacto === null
      ? 'El contacto no escribió nunca, así que la pregunta «¿le respondieron?» no tiene sujeto.'
      : h.respondieronAlContacto
        ? 'SÍ hubo al menos una línea después del último mensaje del contacto.'
        : 'NO hubo ninguna línea después del último mensaje del contacto.';

  return (
    'HECHOS MEDIDOS DE ESTA CONVERSACIÓN. Están contados sobre la conversación COMPLETA y son ' +
    'exactos: no los recalcules leyendo el transcript, que puede venir recortado.\n\n' +
    `Mensajes por autor:\n${porAutor}\n\n` +
    `${desdeElUltimo}\n` +
    `${desdeElAgente}\n` +
    `Última línea de: ${h.ultimoEsDe ?? 'nadie'}.\n` +
    `${respondieron}\n` +
    `Mensajes sin texto (audio o imagen): ${h.sinTexto}.\n` +
    `Umbral de silencio para «dejó de responder»: ${h.umbralDeSilencioMin} minutos.`
  );
}

/**
 * El mensaje del usuario: los hechos y el transcript.
 *
 * El umbral aparece **una sola vez en todo el prompt** y es acá, donde se mide. Escribirlo también en
 * el texto del criterio de abandono habría puesto el mismo número en dos lugares que un día difieren
 * — y el criterio remite a «el umbral que los hechos declaran» justamente para no repetirlo.
 */
export function textoDeLaConversacion(de: {
  hechos: HechosDeLaConversacion;
  transcript: string;
}): string {
  return [
    textoDeLosHechos(de.hechos),
    `TRANSCRIPT:\n\n${de.transcript}`,
    'Registrá el veredicto con la herramienta.',
  ].join(SEPARADOR);
}
