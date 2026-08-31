// EL ESQUEMA DE SALIDA. **Es el contrato: el modelo no puede devolver otra forma.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS CUATRO RESTRICCIONES PRÁCTICAS, Y CADA UNA POR UN DEFECTO
//
// **1 · No hay tope de items.** El máximo de hallazgos se recorta en código. Un esquema estricto con
// un máximo hace que el modelo **trunque** en vez de elegir: se le pide que traiga los más
// importantes y se recorta después.
//
// **2 · `additionalProperties: false` es obligatorio en CADA objeto, incluidos los anidados.** Sin él
// en un objeto de segundo nivel, el modelo agrega campos ahí adentro y la validación estricta del
// nivel de arriba no los ve.
//
// **3 · Nada de largos mínimos ni patrones de texto.** El formato del código de patrón **lo valida la
// base** y lo normaliza el código. Si estuviera acá, un código mal escrito rompería **la respuesta
// entera** en vez de un hallazgo — y perder la inferencia completa por un guion es el peor cambio
// posible. Un enumerado no es un patrón de texto: es la forma estándar de cerrar un vocabulario, y
// hace inexpresable lo que después habría que descartar.
//
// **4 · Todo campo es OBLIGATORIO y anulable, nunca opcional.** *Una clave opcional en un esquema
// estricto es más frágil que una obligatoria que puede ser nula:* con la opcional, el modelo decide
// si la manda y el consumidor tiene que distinguir «no vino» de «vino nula» sin saber cuál quiso
// decir. Con la obligatoria anulable, `null` es una respuesta y no una ausencia.
//
// ── Y UNA MEJORA SOBRE EL DISEÑO DE ORIGEN, QUE SALE DE UNA MEDICIÓN ────────
//
// El esquema **se arma por agente**, con los siete criterios de ESE territorio como enumerado.
//
// En los 59 análisis reales de la plataforma anterior apareció `calificacion_saltada` —un criterio de
// pre-agenda— en análisis de agentes de **post-agenda**. Con el enumerado por agente, el modelo **no
// puede** devolverlo: el cruce deja de ser algo que hay que descartar y pasa a ser inexpresable.
//
// `criterioValido()` sigue existiendo como segunda capa. No es redundancia por gusto: el esquema lo
// hace cumplir el proveedor, y si un día su validación estricta cambia o se relaja, la capa de acá es
// la que queda.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  CATEGORIAS,
  CRITERIOS_DEL_AGENTE,
  ETIQUETAS_DE_OBSERVACION,
  NIVELES,
  SENTIMIENTOS,
  SEVERIDADES,
  SIN_CRITERIO,
  type Agente,
} from './veredicto.ts';

/** El nombre de la herramienta. El modelo tiene que llamarla, y es la única que se le ofrece. */
export const NOMBRE_DE_LA_HERRAMIENTA = 'registrar_veredicto';

/** Un objeto del esquema. Se arma con este ayudante para no olvidarse la restricción 2. */
function objeto(propiedades: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'object',
    /* La restricción 2, en el único lugar donde se construye un objeto del esquema. Olvidársela en un
       anidado es el defecto que no se ve: el objeto de arriba valida estricto y el de adentro acepta
       lo que venga. */
    additionalProperties: false,
    // Y todas las claves son obligatorias, siempre. Ver la restricción 4.
    required: Object.keys(propiedades),
    properties: propiedades,
  };
}

/** Un texto que puede venir nulo. **Obligatorio y anulable**, nunca opcional. */
const textoONulo = (descripcion: string): Record<string, unknown> => ({
  type: ['string', 'null'],
  description: descripcion,
});

const texto = (descripcion: string): Record<string, unknown> => ({ type: 'string', description: descripcion });

const deLaLista = (valores: readonly string[], descripcion: string): Record<string, unknown> => ({
  type: 'string',
  enum: [...valores],
  description: descripcion,
});

/**
 * El esquema del veredicto, **para un agente**.
 *
 * Las descripciones no son documentación: **el modelo las lee**, y son donde vive la mitad de la
 * rúbrica que tiene que estar pegada al campo. Una regla escrita solo en el texto de la rúbrica se
 * pierde entre cincuenta líneas de transcript; escrita en el campo, está donde se decide.
 */
export function esquemaDelVeredicto(agente: Agente): Record<string, unknown> {
  return objeto({
    // ── LA PRECONDICIÓN, PRIMERO ────────────────────────────────────────────
    auditable: {
      type: 'boolean',
      description:
        'false si NO se puede juzgar esta conversación: no hay ninguna línea del AGENTE IA, hay menos ' +
        'de dos intercambios reales, o más de la mitad de los mensajes no tienen texto. Sin agente no ' +
        'hay nada que auditar, y eso NO es una falla del agente: es su ausencia. Si es false, dejá ' +
        'hallazgos y observaciones vacíos y no pidas intervención.',
    },
    no_auditable_motivo: textoONulo(
      'Por qué no se puede juzgar, en una frase. null si `auditable` es true.',
    ),

    // ── EL RESUMEN, QUE SE ESCRIBE SIEMPRE ──────────────────────────────────
    resumen: texto(
      'Dos a cuatro frases contando QUÉ PASÓ: quién habló, qué pidió el contacto, hasta dónde llegó y ' +
        'cómo terminó. Descripción, no juicio. SE ESCRIBE SIEMPRE, incluso cuando la conversación no ' +
        'es auditable — ahí es lo único que se puede decir, y es exactamente lo que hay que decir.',
    ),

    // ── SALIDA 1 · LA INTERVENCIÓN ──────────────────────────────────────────
    intervencion: objeto({
      requerida: {
        type: 'boolean',
        description:
          'true SOLO si se cumple una de estas cuatro: (1) el contacto está claramente enojado o a ' +
          'punto de irse y el agente no lo maneja; (2) el agente dio información incorrecta SOBRE ' +
          'DINERO, FECHAS O CONDICIONES y el contacto la está tomando por buena; (3) el contacto pidió ' +
          'algo concreto TRES O MÁS VECES sin obtenerlo; (4) el contacto pidió expresamente hablar con ' +
          'una persona. NO es intervención que el agente sea verboso, formal, repetitivo, poco cálido, ' +
          'ni que se le escape una oportunidad de venta: todo eso son hallazgos.',
      },
      motivo: textoONulo(
        'Una frase CONCRETA DE ESTA CONVERSACIÓN diciendo qué pasó — nunca «requiere revisión». La va ' +
          'a leer un vendedor en su cola de urgencias y tiene que saber qué pasó sin abrir el chat. ' +
          'null si no se requiere intervención.',
      ),
    }),

    // ── SALIDA 2 · EL VEREDICTO ─────────────────────────────────────────────
    nivel: deLaLista(
      NIVELES,
      'verde = el agente trabajó bien. amarillo = al menos un hallazgo observable, CON su cita y su ' +
        'código de patrón. rojo = fallo crítico que pide intervención. Si no podés nombrar el hallazgo ' +
        'con su cita, NO es amarillo: va en observaciones y el nivel sigue siendo verde. No subas el ' +
        'nivel «por las dudas»: inflar amarillos hace que el técnico deje de mirarlos.',
    ),
    criterio: deLaLista(
      [SIN_CRITERIO, ...CRITERIOS_DEL_AGENTE[agente]],
      `El criterio que disparó, de los de ESTE agente (${agente}). «${SIN_CRITERIO}» si no disparó ` +
        'ninguno. No uses un criterio que no esté en esta lista: son de otra etapa y juzgarían otro ' +
        'trabajo.',
    ),

    // ── EL VERDE SE SOSTIENE, O NO ES UN VERDE ──────────────────────────────
    destacado: textoONulo(
      'En una línea, QUÉ HIZO BIEN el agente. Concreto, no elogio genérico. Va JUNTO con `evidencia`: ' +
        'los dos o ninguno. Si no hay una línea citable, los dos van null y el nivel sigue siendo ' +
        'verde — no encontrar un elogio no es encontrar una falla, y lo que no se hace es inventar un ' +
        'mérito. En rojo los dos van null.',
    ),
    evidencia: textoONulo(
      'La línea EXACTA Y LITERAL del agente que demuestra el destacado, copiada del transcript. Va ' +
        'JUNTO con `destacado`: los dos o ninguno. Un mérito afirmado sin la línea que lo respalda es ' +
        'peor que un hallazgo sin cita, porque nadie audita un elogio.',
    ),

    sentimiento: deLaLista(
      SENTIMIENTOS,
      'El sentimiento DEL CONTACTO, no del agente. Independiente de todo lo demás: un contacto ' +
        'positivo no impide un hallazgo, y uno molesto no lo exige.',
    ),

    // ── LAS OBSERVACIONES: describen, no imputan ────────────────────────────
    observaciones: {
      type: 'array',
      description:
        'Hasta cuatro. Una observación DESCRIBE; un hallazgo IMPUTA. «No hizo las dos preguntas ' +
        'porque la llamada duró 19 segundos» es una observación; «no hace las preguntas de ' +
        'calificación nunca» es un hallazgo. Una observación no tiene código de patrón, no tiene ' +
        'corrección y NO mueve el nivel. Array vacío si se miraron y no hubo ninguna.',
      items: objeto({
        etiqueta: deLaLista(
          ETIQUETAS_DE_OBSERVACION,
          'cobertura_prompt = el prompt pide algo que en ESTA conversación no ocurrió. ritmo = se ' +
            'cortó o se abandonó antes de desarrollarse. oportunidad = algo que el agente podía ' +
            'aprovechar y no aprovechó, sin llegar a fallo. contexto = algo que conviene saber y que ' +
            'NO es responsabilidad del agente.',
        ),
        texto: texto('La observación, concreta.'),
        cita: textoONulo(
          'La línea del transcript, o null si es sobre la conversación entera: una duración, un corte, ' +
            'algo que NO pasó.',
        ),
      }),
    },

    // ── LOS HALLAZGOS ───────────────────────────────────────────────────────
    hallazgos: {
      type: 'array',
      description:
        'Los más importantes. CADA hallazgo exige una cita textual del agente: si no podés copiar la ' +
        'línea exacta que lo prueba, el hallazgo NO EXISTE y no se reporta. Array vacío si no hubo ' +
        'ninguno.',
      items: objeto({
        titulo: texto('El patrón en lenguaje humano, SEIS PALABRAS O MENOS.'),
        patron: texto(
          'El código del patrón: minúsculas, guiones bajos, sin acentos ni espacios. Describe LA ' +
            'FALLA, no la conversación: `promete_financiamiento_inexistente` sí, `caso_juan_perez` no. ' +
            'Si tu hallazgo es el MISMO patrón que uno de la lista de patrones ya detectados, REUSÁ ESE ' +
            'CÓDIGO EXACTO, aunque vos lo hubieras nombrado distinto.',
        ),
        criterio: deLaLista(
          CRITERIOS_DEL_AGENTE[agente],
          `Cuál de los criterios de este agente (${agente}) se incumplió.`,
        ),
        severidad: deLaLista(
          SEVERIDADES,
          'rojo = le cuesta clientes o le da información falsa a la gente. amarillo = le baja la ' +
            'conversión o la calidad, SIN daño directo. Un hallazgo puede ser rojo sin que la ' +
            'conversación requiera intervención: el daño ya ocurrió y el contacto se fue tranquilo.',
        ),
        categoria: deLaLista(
          CATEGORIAS,
          'comportamiento = tono, largo, insistencia, manejo. base_conocimiento = le falta un dato o ' +
            'tiene uno equivocado. informacion_adicional = debería estar diciendo algo que hoy no dice.',
        ),
        diagnostico: texto('Qué está fallando y por qué, en dos o tres frases.'),
        fragmento_prompt: textoONulo(
          'El texto EXACTO Y LITERAL del prompt del agente que causa la falla, copiado tal cual. null ' +
            'si no hay prompt cargado, o si NO ENCONTRÁS ningún fragmento que explique la falla: en ese ' +
            'caso no inventes una cita.',
        ),
        prompt_seccion: textoONulo(
          'A qué sección del prompt pertenece el fragmento, o —si no hay fragmento— a qué sección ' +
            'debería ir la corrección.',
        ),
        correccion: texto(
          'Si citaste un fragmento: el REEMPLAZO listo para pegar, en el mismo idioma, tono y formato ' +
            'que el resto del prompt. Si no: una instrucción autónoma para agregar, que empiece ' +
            'indicando a qué sección va. La corrección arregla EL PATRÓN, no el caso puntual: no ' +
            'menciones al contacto ni cites la conversación acá adentro.',
        ),
        evidencia_agente: texto(
          'La línea EXACTA Y LITERAL del AGENTE IA que prueba el hallazgo, copiada del transcript. ' +
            'Obligatoria: sin ella el hallazgo no existe.',
        ),
        evidencia_contacto: textoONulo(
          'La línea del contacto a la que el agente respondió mal, si el hallazgo es sobre una ' +
            'respuesta. null si no aplica.',
        ),
      }),
    },
  });
}

/** Lo que el modelo devuelve, ya validado por el esquema. Se normaliza antes de escribir. */
export interface VeredictoDelModelo {
  auditable: boolean;
  no_auditable_motivo: string | null;
  resumen: string;
  intervencion: { requerida: boolean; motivo: string | null };
  nivel: string;
  criterio: string;
  destacado: string | null;
  evidencia: string | null;
  sentimiento: string;
  observaciones: { etiqueta: string; texto: string; cita: string | null }[];
  hallazgos: {
    titulo: string;
    patron: string;
    criterio: string;
    severidad: string;
    categoria: string;
    diagnostico: string;
    fragmento_prompt: string | null;
    prompt_seccion: string | null;
    correccion: string;
    evidencia_agente: string;
    evidencia_contacto: string | null;
  }[];
}
