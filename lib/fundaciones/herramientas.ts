// Las nueve herramientas de Fundaciones que viven dentro de la pantalla `icp` (ICP & Oferta).
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE VIENE ESTE ARCHIVO, Y QUÉ NO SE PUEDE CAMBIAR
//
// Es un PORT de `ARIA-brain/app-next/lib/tools.ts` + `lib/journey.ts`. ARIA-brain sigue en pie y
// sigue siendo el sistema que los alumnos usan hoy: este port CONVIVE con él, no lo reemplaza.
//
// Y de esa convivencia sale la única regla dura del archivo: **los `id` son los del hub, no un
// número nuevo**. El estado del alumno vive en el mismo almacén que ARIA-brain
// (`aria_brain_client_state`, ver `almacen.ts`), y ahí las llaves son POSICIONALES: `perfil[3]` es
// el ICP, `historial[10]` es el Pricing. Renumerar acá —"que queden 0..6, más ordenado"— no rompe
// nada visible: rompe la HERENCIA, y el síntoma es un documento generado con el contexto de otra
// herramienta. Un éxito reportado que no ocurrió.
//
// Por eso el orden del método y el orden de los identificadores NO COINCIDEN, igual que en el hub:
//   Perfil(0) → Research(1) → ICP(3) → Categoría(2) → Oferta(4) → Pricing(10) → Mapa(26)
//                                                        → VSL(5) → Landing(6)
//
// VSL(5) y Landing(6) entraron después: `docs/ETAPA-9.md` las dejó fuera de la primera entrega y
// esta las agrega, con lo que las nueve del hub quedan completas. Van AL FINAL porque son las dos
// últimas del método —la Landing hereda del VSL, que hereda de las cuatro anteriores—, no por
// haber llegado tarde.
// ═══════════════════════════════════════════════════════════════════════════════

export type TipoCampo = 'texto' | 'numero' | 'area' | 'lista';

export interface OpcionCampo {
  valor: string;
  etiqueta: string;
}

export interface Campo {
  /** El identificador del hub (`t4-niche`), NO uno nuevo. Ver `campos.ts`. */
  id: string;
  etiqueta: string;
  tipo: TipoCampo;
  marcador?: string;
  opciones?: readonly OpcionCampo[];
  valorPorOmision?: string;
}

export interface FilaDeCampos {
  columnas: 1 | 2;
  campos: readonly Campo[];
}

/** Cómo se pinta la herramienta. `generica` = formulario + un botón + un documento. */
export type FormaDeHerramienta = 'generica' | 'research' | 'prospeccion';

export interface Herramienta {
  /** El índice global del hub. Es la llave del almacén. NO renumerar. */
  id: number;
  clave: string;
  /** La etiqueta de la subpestaña. Corta: entra en `.cl-sub`. */
  pestania: string;
  /** El título de la vista. */
  titulo: string;
  /** Una línea bajo el título. */
  bajada: string;
  /** El párrafo de "¿cómo funciona?", plegado por omisión. */
  detalle?: string;
  filas: readonly FilaDeCampos[];
  /**
   * `true` = la herramienta NO ofrece regenerar con un ajuste. Puerto de `hasEdit: false`.
   *
   * Ausente = sí lo ofrece, que es el caso de las nueve de Fundaciones. La bandera se escribe en
   * negativo a propósito: así agregar una herramienta nueva no obliga a acordarse de habilitar
   * algo que casi todas tienen.
   */
  sinAjuste?: true;
  etiquetaBoton: string;
  etiquetaSalida: string;
  forma: FormaDeHerramienta;
}

const PERFIL: Herramienta = {
  id: 0,
  clave: 'perfil',
  pestania: 'Tu ficha',
  titulo: 'Tu ficha de negocio',
  bajada: 'Quién eres y dónde estás hoy. Es la raíz: todo lo demás hereda de acá.',
  detalle:
    'Con estos siete datos se arma el perfil de cliente completo — dolores ordenados por ' +
    'intensidad, creencias que lo frenan, cómo habla, disparadores de compra y las señales de ' +
    'que alguien NO es tu cliente. Las seis herramientas siguientes leen este documento.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 't1-biz', etiqueta: '¿Cómo se llama tu negocio?', tipo: 'texto', marcador: 'Ej: ARIA IA' },
        { id: 't1-niche', etiqueta: '¿En qué nicho estás?', tipo: 'texto', marcador: 'Ej: agencias digitales, clínicas dentales' },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 't1-service', etiqueta: '¿Qué servicio vendes?', tipo: 'texto', marcador: 'Ej: sistema de adquisición con IA' },
        { id: 't1-price', etiqueta: '¿A qué precio lo vendes hoy?', tipo: 'texto', marcador: 'Ej: $3,000 setup + $1,500/mes' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't1-pain', etiqueta: '¿Cuál es el mayor problema de tu cliente?', tipo: 'area', marcador: 'Ej: consigue leads pero no logra agendar llamadas con decisores' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't1-result', etiqueta: '¿Qué resultado obtienen contigo?', tipo: 'area', marcador: 'Ej: 15 llamadas calificadas al mes en 90 días' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't1-before', etiqueta: '¿Qué intentaron antes de llegar a ti?', tipo: 'area', marcador: 'Ej: contrataron un setter, probaron ads, compraron un curso' },
      ],
    },
  ],
  etiquetaBoton: 'Crear mi perfil de cliente',
  etiquetaSalida: 'Perfil de Cliente',
  forma: 'generica',
};

// Market Research NO es un formulario que dispara una generación: son CINCO pasos encadenados, y
// cada uno recibe la salida del anterior. Sus campos son los cinco criterios de búsqueda; el
// componente `PanelResearch` los recorre. Ver `prompts.ts` → `PROMPTS_RESEARCH`.
const RESEARCH: Herramienta = {
  id: 1,
  clave: 'research',
  pestania: 'Research',
  titulo: 'Investiga tu mercado',
  bajada: 'Cinco pasos encadenados hasta el segmento ganador: el que tu ICP hereda.',
  detalle:
    'Paso 1 encuentra 3-4 segmentos que cumplan tus criterios. Paso 2 saca sus dolores y ' +
    'destila el dolor crítico de cada uno. Paso 3 busca quién ya escaló resolviéndolo. Paso 4 ' +
    'propone el modelo de precios. Paso 5 los evalúa contra las cuatro preguntas y elige uno. ' +
    'Cada paso lee la salida del anterior, así que el orden no es decorativo.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 'mr-niche', etiqueta: '¿Cuál es tu nicho?', tipo: 'texto', marcador: 'Ej: Salud, Bienes Raíces, Agencias Digitales' },
        { id: 'mr-buyers', etiqueta: 'Compradores potenciales mínimos', tipo: 'texto', marcador: 'Ej: 50,000+', valorPorOmision: '50,000+' },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 'mr-ltv', etiqueta: 'LTV mínimo de SUS clientes', tipo: 'texto', marcador: 'Ej: $3,000+', valorPorOmision: '$3,000+' },
        { id: 'mr-contract', etiqueta: 'Contrato inicial mínimo (opcional)', tipo: 'texto', marcador: 'Ej: $1,000+' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 'mr-experience', etiqueta: '¿Cuál es tu experiencia o trasfondo?', tipo: 'area', marcador: 'Ej: soy consultor de crecimiento con experiencia en marketing y ventas para agencias...' },
      ],
    },
  ],
  etiquetaBoton: 'Ejecutar research completo',
  etiquetaSalida: 'Market Research',
  forma: 'research',
};

const ICP: Herramienta = {
  id: 3,
  clave: 'icp',
  pestania: 'ICP',
  titulo: 'Tu cliente ideal',
  bajada: 'El avatar completo: su situación actual con dolor y detalle, y la deseada.',
  detalle:
    'Hereda el segmento ganador del Research y tu ficha de negocio. Entrega la situación actual ' +
    'del avatar, la deseada, su lenguaje exacto, sus objeciones y la tarjeta espejo que las ' +
    'demás herramientas usan como fuente de dolores.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 't4-niche', etiqueta: 'Nicho del avatar', tipo: 'texto', marcador: 'Ej: dueños de agencias de marketing' },
        { id: 't4-income', etiqueta: 'Ingresos', tipo: 'texto', marcador: 'Ej: $10k-$50k/mes' },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 't4-age', etiqueta: 'Edad', tipo: 'texto', marcador: 'Ej: 28-45' },
        { id: 't4-country', etiqueta: 'País o región', tipo: 'texto', marcador: 'Ej: México, Colombia, España' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't4-occupation', etiqueta: 'Ocupación y rutina diaria', tipo: 'area', marcador: 'Ej: dirige la agencia, vende él mismo, entrega él mismo, 12 horas al día' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't4-pains', etiqueta: 'Dolores que ya conoces', tipo: 'area', marcador: 'Si ya corriste el Research, esos dolores investigados mandan y esto solo complementa' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't4-desires', etiqueta: 'Deseos que ya conoces', tipo: 'area', marcador: 'Ej: salir del día a día, cobrar más, tener un equipo que ejecute' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't4-tried', etiqueta: '¿Qué han intentado antes? (opcional)', tipo: 'area', marcador: 'Ej: contrataron freelancers, compraron cursos, probaron agencias' },
      ],
    },
  ],
  etiquetaBoton: 'Crear mi avatar',
  etiquetaSalida: 'Avatar Buyer Profile',
  forma: 'generica',
};

const CATEGORIA: Herramienta = {
  id: 2,
  clave: 'categoria',
  pestania: 'Categoría',
  titulo: 'Tu categoría única',
  bajada: 'Por qué tú y no otro: tu método con nombre propio, para dejar de competir por precio.',
  detalle:
    'Hereda tu nicho y tu ICP. Las tres preguntas de diagnóstico afinan el resultado y son ' +
    'opcionales si ya hay contexto. Entrega el Nuevo Juego con tu constraint real, el Enemigo ' +
    'nombrado, las Truth Bombs reutilizables, tu Modelo con nombre propio y el shift de ' +
    'identidad. Los supuestos vienen marcados y cierra con preguntas abiertas.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 't2cat-current', etiqueta: '¿Cómo te presentas hoy?', tipo: 'texto', marcador: 'Ej: agencia de marketing digital / consultor de IA' },
        { id: 't2cat-alternatives', etiqueta: '¿Contra qué te comparan tus clientes?', tipo: 'texto', marcador: 'Ej: otras agencias, contratar a alguien, hacerlo ellos mismos' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't2cat-notworking', etiqueta: '¿Qué NO está funcionando en cómo comunicas tu oferta?', tipo: 'area', marcador: 'Ej: me piden precio de una, me comparan por costo, no entienden qué me hace distinto' },
      ],
    },
  ],
  etiquetaBoton: 'Crear mi categoría única',
  etiquetaSalida: 'Category Architect — 5 Pasos',
  forma: 'generica',
};

const OFERTA: Herramienta = {
  id: 4,
  clave: 'oferta',
  pestania: 'Oferta',
  titulo: 'Tu oferta irresistible',
  bajada: 'La promesa que se compra sola, construida sobre el avatar y el posicionamiento.',
  detalle:
    'Hereda el avatar y la categoría única. Si todavía no tienes precio, déjalo vacío: el stack ' +
    'de valor se construye sin anclarlo a un número y el precio sale después en Tu precio.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 't5-name', etiqueta: 'Nombre de tu oferta o programa', tipo: 'texto', marcador: 'Ej: Protocolo de Adquisición Predecible' },
        { id: 't5-price', etiqueta: 'Precio (opcional)', tipo: 'texto', marcador: 'Déjalo vacío si aún no lo definiste' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't5-result', etiqueta: '¿Qué resultado concreto entrega?', tipo: 'area', marcador: 'Ej: 15 llamadas calificadas al mes, sostenidas, sin depender de referidos' },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 't5-format', etiqueta: '¿En qué formato lo entregas?', tipo: 'texto', marcador: 'Ej: done-for-you con 2 sesiones semanales' },
        { id: 't5-when', etiqueta: '¿En cuánto tiempo?', tipo: 'texto', marcador: 'Ej: 90 días' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't5-why', etiqueta: '¿Por qué funciona tu método?', tipo: 'area', marcador: 'Ej: porque atacamos el cuello de botella real: la calificación, no el volumen' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't5-includes', etiqueta: '¿Qué incluye exactamente?', tipo: 'area', marcador: 'Enumera los entregables tal como se los cuentas a un cliente' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't5-urgency', etiqueta: '¿Qué hace que sea urgente? (opcional)', tipo: 'area', marcador: 'Escasez SOLO real: cupos de delivery, temporada, cambio de precio ya decidido' },
      ],
    },
  ],
  etiquetaBoton: 'Crear mi oferta',
  etiquetaSalida: 'Oferta Irresistible',
  forma: 'generica',
};

const PRICING: Herramienta = {
  id: 10,
  clave: 'pricing',
  pestania: 'Tu precio',
  titulo: 'Tu precio',
  bajada: 'Cuánto cobras y por qué: el precio como fracción del valor esperado, con su garantía.',
  detalle:
    'La fórmula es explícita: valor esperado = resultado potencial × probabilidad de lograrlo, y ' +
    'el precio es una fracción de eso. Hereda el stack de valor de tu oferta y entrega también ' +
    'la garantía condicional con sus indicadores líderes.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 't11-outcome', etiqueta: '¿Cuánto vale el resultado que entregas?', tipo: 'texto', marcador: 'Ej: $120,000 al año en revenue nuevo' },
        { id: 't11-probability', etiqueta: '¿Qué probabilidad real hay de lograrlo?', tipo: 'texto', marcador: 'Ej: 60%' },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 't11-problemcost', etiqueta: '¿Cuánto le cuesta NO resolverlo?', tipo: 'texto', marcador: 'Ej: $8,000/mes en oportunidad perdida' },
        { id: 't11-clientrevenue', etiqueta: '¿Cuánto factura tu cliente hoy?', tipo: 'texto', marcador: 'Ej: $30k-$80k/mes' },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 't11-delivery', etiqueta: '¿Cuánto te cuesta entregarlo?', tipo: 'texto', marcador: 'Ej: $600/mes entre herramientas y equipo' },
        { id: 't11-goal', etiqueta: '¿Cuál es tu meta de facturación?', tipo: 'texto', marcador: 'Ej: $30k/mes' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't11-proof', etiqueta: '¿Qué prueba tienes de que funciona?', tipo: 'area', marcador: 'Ej: 6 clientes, el mejor pasó de 3 a 14 llamadas al mes' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't11-pastresults', etiqueta: 'Resultados pasados con cifras (opcional)', tipo: 'area', marcador: 'Solo cifras reales. Lo que falte se marca como pendiente, no se inventa' },
      ],
    },
  ],
  etiquetaBoton: 'Calcular mi precio',
  etiquetaSalida: 'Pricing Protocol',
  forma: 'generica',
};

const MAPA: Herramienta = {
  id: 26,
  clave: 'mapa',
  pestania: 'Mapa',
  titulo: 'Tu mapa de proceso',
  bajada: 'Tu método dibujado: del caos actual del prospecto a la transformación, en nueve secciones.',
  detalle:
    'Es la única herramienta que hornea desde las CUATRO fuentes a la vez: avatar, categoría, ' +
    'oferta y precio. Si falta alguna, el documento sale con marcadores [COMPLETAR] en vez de ' +
    'cifras inventadas — a propósito.',
  filas: [
    {
      columnas: 1,
      campos: [
        { id: 't26-caso', etiqueta: 'Un caso real tuyo (opcional)', tipo: 'area', marcador: 'Ej: Marcos pasó de 4 a 19 llamadas al mes en 11 semanas' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't26-responsables', etiqueta: 'Responsables por fase (opcional)', tipo: 'area', marcador: 'Si no tienes equipo, déjalo vacío: se cubre con [tú / agente IA]' },
      ],
    },
  ],
  etiquetaBoton: 'Crear mi mapa de proceso',
  etiquetaSalida: 'Mapa de Proceso',
  forma: 'generica',
};

// ═════════════════════════════════════════════════════════════════════════════
// VSL (5) y Landing (6) — las dos últimas del método
//
// Entraron después de las siete primeras. Dos cosas de sus campos que NO se pueden tocar:
//
//   1. **Los prefijos son `t6-` y `t7-`, y no coinciden con el id de la herramienta.** El VSL es
//      la herramienta 5 y sus campos empiezan con `t6-`; la Landing es la 6 y su campo es
//      `t7-niche`. Así están en el hub, y `claveCorta()` guarda el identificador SIN prefijo
//      (`t6-program` → `program`). Renombrarlos a `t5-` "para que coincida" no rompe nada visible
//      y cambia la clave guardada: el mismo alumno vería el campo en blanco en el otro sistema.
//
//   2. **Los VALORES de las tres listas del VSL son texto largo a propósito.** No son etiquetas:
//      son lo que entra al prompt, y el `SKILL.md` de `vsl/killer-framework` deriva de ellos tres
//      booleanos que encienden ramas enteras (`_isB2C`, `_hasProof`, `_isScreenShare`). Esa
//      derivación mira el PRINCIPIO de la cadena — `'Sí'`, `'B2C'`, `'Case study'` — así que
//      acortar un valor apaga una rama del framework sin que nada falle. Ver `prompts.ts`.
// ═════════════════════════════════════════════════════════════════════════════

const VSL: Herramienta = {
  id: 5,
  clave: 'vsl',
  pestania: 'Tu video de ventas (VSL)',
  titulo: 'Tu video de ventas (VSL)',
  bajada: 'El guion completo del video que convence y lleva a agendar la llamada.',
  detalle:
    'Usa el Killer VSL Framework con el protocolo de Belief Shifting y Process Selling. Distingue ' +
    'B2B de B2C —cambian el lenguaje, la apertura y la llamada a la acción—, pregunta si tienes ' +
    'prueba social para saber en qué apoyar la credibilidad, y el formato de grabación: a cámara ' +
    'o compartiendo pantalla. Hereda tu avatar, tu categoría, tu oferta y tu precio si ya los ' +
    'generaste.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 't6-program', etiqueta: '¿Cómo se llama tu programa?', tipo: 'texto', marcador: 'Ej: ARIA IA Accelerator' },
        {
          id: 't6-duration',
          etiqueta: '¿Qué duración buscas?',
          tipo: 'lista',
          valorPorOmision: 'medio',
          opciones: [
            { valor: 'corto', etiqueta: 'Corto (5–8 min)' },
            { valor: 'medio', etiqueta: 'Medio (12–18 min)' },
            { valor: 'largo', etiqueta: 'Largo (25–35 min)' },
          ],
        },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't6-promise', etiqueta: 'La promesa grande', tipo: 'texto', marcador: 'Ej: Lanza tu AI Firm en 90 días' },
      ],
    },
    {
      columnas: 2,
      campos: [
        {
          id: 't6-market',
          etiqueta: '¿A quién le vendes?',
          tipo: 'lista',
          opciones: [
            {
              valor: 'B2B — vendes a dueños de negocio / empresas (lenguaje directo, lógico, orientado a resultados)',
              etiqueta: 'B2B (vendes a negocios)',
            },
            {
              valor: 'B2C — vendes a consumidor final (lenguaje emocional, entretenido, enfocado en transformación de vida)',
              etiqueta: 'B2C (vendes a consumidor final)',
            },
          ],
        },
        {
          id: 't6-socialproof',
          etiqueta: '¿Tienes prueba social? (casos, testimonios, resultados)',
          tipo: 'lista',
          opciones: [
            { valor: '', etiqueta: 'Selecciona…' },
            {
              valor: 'Sí, tengo casos de éxito / testimonios / resultados probados con clientes reales',
              etiqueta: 'Sí, tengo prueba social',
            },
            {
              valor: 'No, aún no tengo casos de éxito con clientes — solo mi propia experiencia con el método',
              etiqueta: 'No, aún no tengo prueba social',
            },
          ],
        },
      ],
    },
    {
      columnas: 1,
      campos: [
        {
          id: 't6-format',
          etiqueta: '¿Cómo te sientes más cómodo grabando?',
          tipo: 'lista',
          opciones: [
            {
              valor: 'Case study / screen share — proyectando Miro, Google Docs u otra pantalla mientras hablas',
              etiqueta: 'Compartiendo pantalla, estilo Loom (recomendado) — te doy el guion Y el documento',
            },
            {
              valor: 'Raw talking-head — cámara directa, tú hablando de frente, sin pantalla compartida',
              etiqueta: 'A cámara — tú hablando directo (solo el guion)',
            },
          ],
        },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't6-story', etiqueta: 'La historia de transformación que vas a contar', tipo: 'area', marcador: 'Un caso de éxito tuyo, o tu propia historia' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't6-obj', etiqueta: '¿Qué objeciones tienes que refutar?', tipo: 'area', marcador: 'Ej: "no tengo tiempo", "ya lo intenté", "es muy caro"' },
      ],
    },
  ],
  etiquetaBoton: 'Redactar mi VSL',
  etiquetaSalida: 'Guion del VSL',
  forma: 'generica',
};

const LANDING: Herramienta = {
  id: 6,
  clave: 'landing',
  pestania: 'Tu página',
  titulo: 'Tu página',
  bajada: 'El prompt listo para pegar en AI Studio y publicar la página donde agendan la llamada.',
  detalle:
    'Hereda TODO lo anterior: el avatar para el bloque de problema, la categoría para el titular y ' +
    'el mecanismo, la oferta para la promesa, la garantía del precio para el FAQ — y el guion del ' +
    'VSL, para que la página no prometa algo distinto del video. Los requisitos para aplicar y los ' +
    'cupos se copian del VSL en vez de inventarse de nuevo.',
  filas: [
    {
      columnas: 1,
      campos: [
        { id: 't7-niche', etiqueta: 'Tu nicho, en una línea', tipo: 'texto', marcador: 'Ej: dueñas de medspas que reciben consultas por WhatsApp' },
      ],
    },
  ],
  etiquetaBoton: 'Generar mi página',
  etiquetaSalida: 'Prompt para AI Studio',
  forma: 'generica',
};

// ═════════════════════════════════════════════════════════════════════════════
// LAS HERRAMIENTAS DE LA PANTALLA `tools`
//
// Foundations no es lo único que tiene el hub. `Prospección en Frío` vive en su fase Growth,
// y acá vive en una pantalla propia — no como décima subpestaña de ICP & Oferta, porque no es
// parte del método: es lo que se hace DESPUÉS, con el método hecho.
//
// Comparten TODO lo demás con las nueve: el mismo registro, el mismo almacén (`perfil[20]`,
// `historial[20]`), el mismo motor de plantillas y el mismo panel. El `id` sigue siendo el del
// hub por el mismo motivo de siempre — es la llave posicional del almacén compartido.
// ═════════════════════════════════════════════════════════════════════════════

const PROSPECCION: Herramienta = {
  id: 20,
  clave: 'prospeccion',
  pestania: 'Prospección en Frío',
  // El título, la bajada y el detalle son los del hub PALABRA POR PALABRA —`title`, `desc` y
  // `descMore` de `TOOL_20_PROSPECCION`—, igual que las etiquetas y los marcadores de abajo.
  //
  // La primera versión de este port los reescribió "más conversacionales" y partió la fila en
  // tres. Se rechazó, y con razón: portar no es reinterpretar. Un alumno que usa las dos puertas
  // tiene que reconocer la misma herramienta, y el texto de un campo es parte de la herramienta —
  // no un envoltorio que se pueda mejorar de paso.
  titulo: 'Prospección Inteligente',
  bajada:
    'No extrae leads por ti — te entrega el PLAN DE ATAQUE completo de prospección outbound ' +
    'listo para ejecutar.',
  detalle:
    'Con base en el Outbound Setting Framework y la Direct Value DM Structure (enfoque ' +
    'consultivo, no salesy), la IA genera: criterios y filtros de búsqueda exactos para Google ' +
    'Maps, LinkedIn y Facebook; cómo calificar cada lead (modelo de 3 tiers); el primer DM de dos ' +
    'preguntas estilo consultor; la secuencia de seguimiento de 7 toques lista para cargar en ' +
    'GHL; y el manejo de objeciones. Hereda tu ICP, Categoría Única, Oferta y VSL de las ' +
    'herramientas anteriores.',
  // UNA fila de dos columnas con los CUATRO campos, que es como está en el hub: se ven en una
  // cuadrícula de 2×2. Partirla en tres filas cambia dónde queda cada campo en la pantalla.
  filas: [
    {
      columnas: 2,
      campos: [
        {
          id: 't20-ubicacion',
          etiqueta: 'Ubicación / mercado objetivo',
          tipo: 'texto',
          marcador: 'Ej: Perú, México, España, LATAM completo...',
        },
        {
          // ── `valorPorOmision` ES LO ÚNICO QUE NO ESTÁ EN EL HUB, Y NO CAMBIA NADA VISIBLE ──
          //
          // En el hub esto es un `<select>` suelto: el navegador muestra la primera opción y ESA
          // es la que se lee del DOM al generar. Acá el valor sale del estado de React, que nace
          // vacío — así que la pantalla mostraría "Multicanal" y el prompt recibiría
          // `(no especificado)`, sin que nada falle y sin forma de notarlo mirando.
          //
          // Sembrar la primera opción es lo que hace que lo que se ve sea lo que se manda. La
          // alternativa —agregar un "Selecciona…" vacío— sí habría cambiado la pantalla.
          id: 't20-canal',
          etiqueta: 'Canal principal de outreach',
          tipo: 'lista',
          valorPorOmision: 'Multicanal (WhatsApp + Email + Llamada)',
          opciones: [
            { valor: 'Multicanal (WhatsApp + Email + Llamada)', etiqueta: 'Multicanal (WhatsApp + Email + Llamada)' },
            { valor: 'Instagram / Facebook DM', etiqueta: 'Instagram / Facebook DM' },
            { valor: 'LinkedIn DM', etiqueta: 'LinkedIn DM' },
            { valor: 'WhatsApp', etiqueta: 'WhatsApp' },
            { valor: 'Email', etiqueta: 'Email' },
          ],
        },
        {
          id: 't20-fuentes',
          etiqueta: 'Fuentes a usar',
          tipo: 'lista',
          valorPorOmision: 'Las 3: Google Maps + LinkedIn + Facebook',
          opciones: [
            { valor: 'Las 3: Google Maps + LinkedIn + Facebook', etiqueta: 'Las 3: Google Maps + LinkedIn + Facebook' },
            { valor: 'Solo Google Maps', etiqueta: 'Solo Google Maps' },
            { valor: 'Solo LinkedIn', etiqueta: 'Solo LinkedIn' },
            { valor: 'Solo Facebook', etiqueta: 'Solo Facebook' },
            { valor: 'Google Maps + LinkedIn', etiqueta: 'Google Maps + LinkedIn' },
          ],
        },
        {
          // "Siempre dentro del marco consultivo" no es adorno: las tres son variantes de tono
          // DENTRO de ese marco, y el `SKILL.md` está escrito sobre esa premisa (Direct Value DM:
          // consultor, no vendedor). Una cuarta opción "agresiva" contradiría la metodología.
          id: 't20-tono',
          etiqueta: 'Tono de los mensajes (siempre dentro del marco consultivo)',
          tipo: 'lista',
          valorPorOmision: 'Consultivo profesional (estilo doctor)',
          opciones: [
            { valor: 'Consultivo profesional (estilo doctor)', etiqueta: 'Consultivo profesional (estilo doctor)' },
            { valor: 'Consultivo cercano y conversacional', etiqueta: 'Consultivo cercano y conversacional' },
            { valor: 'Consultivo directo y seguro', etiqueta: 'Consultivo directo y seguro' },
          ],
        },
      ],
    },
  ],
  etiquetaBoton: 'Generar Plan de Prospección',
  etiquetaSalida: 'Plan de Prospección Generado',
  // El hub la declara con `hasEdit: false`: esta herramienta NO lleva el control de Ajustar. La
  // primera versión de este port se lo puso, porque el panel lo mostraba para todas.
  sinAjuste: true,
  // NO es 'generica': el hub la declara con cuatro campos y un formulario, y la pinta con un
  // panel propio que usa solo dos de esos campos y pone un extractor de leads en su lugar.
  forma: 'prospeccion',
};

/**
 * Las nueve, **en el orden del método**. El componente pinta las subpestañas recorriendo esto.
 *
 * El orden NO es el de los identificadores y no se reordena sin decidirlo: es la secuencia en la
 * que una herramienta hereda de las anteriores. Poner Categoría antes de ICP, por ejemplo, deja al
 * diagnóstico de Categoría sin el avatar del que lee.
 */
export const FUNDACIONES: readonly Herramienta[] = [
  PERFIL,
  RESEARCH,
  ICP,
  CATEGORIA,
  OFERTA,
  PRICING,
  MAPA,
  LANDING,
];

/** Los nueve identificadores, para las comprobaciones y para recorrer sin buscar. */
export const IDS_FUNDACIONES: readonly number[] = FUNDACIONES.map((h) => h.id);

/**
 * Las herramientas de la pantalla `tools`, en el orden en que se muestran.
 *
 * ── EL VSL VIVE ACÁ Y NO EN FUNDACIONES, POR PEDIDO DE JORGE ────────────────
 *
 * En ARIA-brain es el paso 8 de 9 de «Construye tu base», y el port lo trajo ahí. Se movió a
 * esta pantalla el 2026-08-31.
 *
 * Lo que NO cambia con la mudanza, y por eso es segura: `/api/tools/estado` y
 * `/api/fundaciones/estado` llaman las dos a `leerElEstado`, o sea que **comparten almacén**.
 * El trabajo ya guardado del VSL sigue estando, y sus chips de herencia —ICP, categoría,
 * oferta y precio, ver `FUENTES_POR_HERRAMIENTA[5]`— siguen resolviendo, porque `fuentes()`
 * lee el estado completo y no sólo el de su catálogo.
 *
 * Lo que SÍ cambia, y hay que saberlo: el VSL pasa a pedir `tools.ver` / `tools.editar` en vez
 * de `fundaciones.*`. Quien tenga uno y no el otro cambia de lado.
 */
export const TOOLS: readonly Herramienta[] = [PROSPECCION, VSL];

/**
 * Todas las herramientas del proyecto, de las dos pantallas.
 *
 * Existe para `herramienta(id)`: la validación de "¿este identificador es una herramienta?" no
 * puede depender de en qué pantalla vive, o el mismo id sería válido en una ruta e inválido en
 * la otra. QUÉ pantalla puede usar cuál lo deciden las rutas, con su propia lista.
 */
export const TODAS: readonly Herramienta[] = [...FUNDACIONES, ...TOOLS];

/** La herramienta con ese identificador del hub, o `undefined`. */
export function herramienta(id: number): Herramienta | undefined {
  return TODAS.find((h) => h.id === id);
}

/** Los identificadores de los cinco pasos de Market Research, en orden. */
export const PASOS_RESEARCH = 5;
