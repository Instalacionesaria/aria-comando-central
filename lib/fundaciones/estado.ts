// La forma del estado de Fundaciones de un alumno.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS NOMBRES DE ESTOS CAMPOS SON UN CONTRATO, NO UNA ELECCIÓN
//
// Este estado NO vive en la base de este proyecto: vive en el mismo almacén que ARIA-brain
// (`aria_brain_client_state`, una fila por llave), porque la decisión de esta etapa fue que los dos
// sistemas COMPARTAN los datos del alumno mientras el hub siga en pie. Ver `docs/ETAPA-9.md`.
//
// Consecuencia directa: los nombres de las llaves y de los campos de cada documento JSON son los
// que ya escribió el hub, en inglés, y **no se traducen**. `date` no puede pasar a ser `fecha`:
// serían dos formas distintas del mismo dato, cada sistema escribiría la suya, y el otro leería
// `undefined` sin ningún error — un historial que se ve vacío con las filas ahí.
//
// La convención en español de este repositorio aplica a los identificadores del CÓDIGO (los tipos,
// las funciones, las variables). Los campos serializados son datos ajenos, y se copian tal cual.
// ═══════════════════════════════════════════════════════════════════════════════

/** Las llaves del almacén compartido que usa Fundaciones. */
export const LLAVES = {
  perfil: 'profile',
  historial: 'history',
  research: 'market_research',
  researchProfundo: 'deep_research',
  categoriaLegado: 'cat_chat',
  /**
   * La conversación del agente del Research. **Es la única llave que el hub NO escribe.**
   *
   * Y aun así sus campos van en inglés como los de al lado. No es coherencia decorativa: la fila
   * vive en la MISMA tabla que las otras cinco, y el día que alguien mire `aria_brain_client_state`
   * a mano —que es como se diagnostica esto— un documento con `contenido` entre cinco con `content`
   * se lee como un dato roto. Lo que sí es nuestro es el nombre: `research_chat`, y no `cat_chat`,
   * que es el del chat viejo de Categoría Única del hub y guarda otra cosa.
   */
  researchChat: 'research_chat',
} as const;

/**
 * Una versión de un entregable. **Campos en inglés: los escribe y los lee ARIA-brain.**
 *
 * `sources` es la procedencia: qué versión de cada fuente consumió esta generación. El hub la usa
 * para avisar *"tu Oferta se generó con un ICP que ya cambiaste"*.
 *
 * **Este port la LEE y no la escribe**, y es una carencia, no una decisión de diseño: una versión
 * generada acá queda sin procedencia, así que el hub no le puede detectar el contexto viejo. Lo que
 * NO pasa es que la pierda para las versiones que ya la tienen — el campo es opcional y las
 * anteriores quedan intactas. Está en `docs/ETAPA-9.md` como pendiente.
 */
export interface Version {
  date: string;
  output: string;
  sources?: Record<number, { version: number; hash: string } | number>;
}

/**
 * Un turno de la conversación con el agente del Research.
 *
 * Los dos únicos papeles que existen: quien pregunta y quien contesta. **El `system` no está y no
 * puede estar** — las instrucciones del entrevistador las arma el servidor en cada llamada (ver
 * `conversacion.ts`), y guardarlas acá significaría que una conversación vieja sigue corriendo con
 * las instrucciones del día que empezó, sin que nadie lo note al corregirlas.
 */
export interface MensajeDeChat {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Lo que el agente del Research juntó hasta ahora: los turnos y los criterios.
 *
 * Los criterios viven ACÁ y no en `market_research.inputs` mientras la conversación está a medias,
 * y esa separación es la que impide una pérdida de trabajo concreta: alguien llenó el formulario,
 * abre el chat para revisar un dato, y a la segunda pregunta el documento de criterios ya estaría
 * pisado con lo que el agente lleva juntado — que a esa altura es casi nada. Lo que junta el agente
 * pasa a `market_research.inputs` en UN solo momento: cuando arranca el research, que es el mismo
 * momento en que lo hace el botón del formulario.
 */
export interface ChatDeResearch {
  messages: MensajeDeChat[];
  /** Claves cortas, como en `researchInputs`. Vacío = el agente todavía no lo sabe. */
  criteria: Record<string, string>;
}

/** El estado completo, tal como lo devuelve `GET /api/fundaciones/estado`. */
export interface EstadoDeFundaciones {
  /** Inputs por herramienta, con claves cortas. Índice = id del hub. */
  perfil: Record<number, Record<string, string>>;
  /** Versiones por herramienta, la más reciente primero. Índice = id del hub. */
  historial: Record<number, Version[]>;
  /** Los cinco criterios de búsqueda del Research, con claves cortas. */
  researchInputs: Record<string, string>;
  /** Las salidas de los cinco pasos del Research, en orden. */
  researchSalidas: string[];
  /** La conversación con el agente del Research, si el alumno usó ese modo. */
  researchChat: ChatDeResearch;
  /** Investigación profunda y lenguaje de campo, si el alumno los corrió en el hub. Solo lectura. */
  researchProfundo: string | null;
  researchCampo: string | null;
  /** El entregable de Categoría Única del chat viejo del hub, si existe. Solo lectura. */
  categoriaLegado: string | null;
}

/** Un estado sin nada. No es un error: es un alumno que todavía no empezó. */
export function estadoVacio(): EstadoDeFundaciones {
  return {
    perfil: {},
    historial: {},
    researchInputs: {},
    researchSalidas: [],
    researchChat: { messages: [], criteria: {} },
    researchProfundo: null,
    researchCampo: null,
    categoriaLegado: null,
  };
}

/** La versión más reciente de una herramienta, o `null`. */
export function ultimaVersion(estado: EstadoDeFundaciones, id: number): string | null {
  const versiones = estado.historial[id];
  const primera = versiones && versiones.length > 0 ? versiones[0] : undefined;
  return primera && primera.output ? primera.output : null;
}

/**
 * ¿Este paso del método está completo?
 *
 * Puerto de `isStepDone` del hub, con sus tres casos especiales intactos:
 *   · Tu ficha (0) cuenta como hecha si hay documento **o** si hay inputs guardados, porque el
 *     onboarding puede haberla llenado sin que nadie generara nada;
 *   · Research (1) exige los CINCO pasos: con cuatro, lo que ICP hereda todavía no existe;
 *   · Categoría (2) acepta también el entregable del chat viejo del hub.
 */
export function pasoCompleto(estado: EstadoDeFundaciones, id: number): boolean {
  if (id === 0) {
    const inputs = estado.perfil[0];
    return !!ultimaVersion(estado, 0) || !!(inputs && Object.keys(inputs).length > 0);
  }
  if (id === 1) return estado.researchSalidas.filter((s) => !!s).length >= 5;
  if (id === 2) return !!ultimaVersion(estado, 2) || !!estado.categoriaLegado;
  return !!ultimaVersion(estado, id);
}
