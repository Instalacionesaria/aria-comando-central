// Las nueve herramientas de Fundaciones: SIETE en la pantalla `icp` (ICP & Oferta) y dos en
// `tools`, al lado de Prospección. El VSL se mudó el 2026-08-31 y la Landing el 2026-09-02; ver
// `TOOLS`, más abajo, para el motivo y para lo que la mudanza cambia.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE VIENE ESTE ARCHIVO, Y QUÉ NO SE PUEDE CAMBIAR
//
// Es un PORT de `ARIA-brain/app-next/lib/tools.ts` + `lib/journey.ts`. ARIA-brain sigue en pie y
// sigue siendo el sistema que los alumnos usan hoy: este port CONVIVE con él, no lo reemplaza.
//
// Y de esa convivencia sale la única regla dura del archivo: **los `id` son los del hub, no un
// número nuevo**. El estado nació copiado del almacén de ARIA-brain (hoy vive en
// `aria_cc_foundations`, ver `almacen.ts`), y ahí las llaves son POSICIONALES: `perfil[3]` es
// el ICP, `historial[10]` es el Pricing. Renumerar acá —"que queden 0..6, más ordenado"— no rompe
// nada visible: rompe la HERENCIA, y el síntoma es un documento generado con el contexto de otra
// herramienta. Un éxito reportado que no ocurrió.
//
// Por eso el orden del método y el orden de los identificadores NO COINCIDEN, igual que en el hub:
//   Perfil(0) → Research(1) → ICP(3) → Categoría(2) → Oferta(4) → Pricing(10) → Mapa(26)
//                                                        → VSL(5) → Landing(6)
//
// VSL(5) y Landing(6) entraron después: `docs/OTROS/capa-base/ETAPA-9.md` las dejó fuera de la primera entrega y
// esta las agrega, con lo que las nueve del hub quedan completas. Van AL FINAL porque son las dos
// últimas del método —la Landing hereda del VSL, que hereda de las cuatro anteriores—, no por
// haber llegado tarde.
// ═══════════════════════════════════════════════════════════════════════════════

import { DONDE_ESTAN_LOS_LEADS, SIN_DATOS_REALES, esB2C, esPaisReconocido, esUbicacionBuscable } from './mercado.ts';

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
  /**
   * Se puede dejar vacío y el entregable sale igual. **La etiqueta ya lo dice y esto lo hace
   * legible por código.**
   *
   * Entró con el agente conversacional del Research, que necesita saber qué preguntas puede dejar
   * pasar y cuáles no. La alternativa era una lista de identificadores obligatorios en el módulo
   * del agente, y esa lista es la que diverge: alguien marca un campo como opcional en la etiqueta,
   * el formulario deja de exigirlo, y el agente sigue insistiendo con una pregunta que ya no hace
   * falta — sin que nada falle.
   *
   * La bandera y el `(opcional)` de la etiqueta van juntos, y una prueba lo exige en las dos
   * direcciones: la etiqueta es lo que lee la persona y la bandera es lo que lee el código, así que
   * la única forma de que no se contradigan es que no se puedan poner una sin la otra.
   */
  opcional?: boolean;
  /**
   * Cómo tratar esta pregunta: qué vale como respuesta, cómo proponerla desde el contexto y cómo
   * preguntarla. La leen el agente (al preguntar) y el relleno (al proponer), y por eso vive en el
   * catálogo y no en el prompt de uno de los dos: si viviera en uno solo, el otro contradiría a la
   * persona. Entró con la ubicación del Research —Kevin (2026-09-13): «eso de la región debería
   * aparecer previamente, en el chat, y recomendarle comenzar por su país».
   */
  guia?: string;
  /**
   * Opcional para el entregable, pero el agente la pregunta ANTES de arrancar solo. Es distinto de
   * `opcional`: una pregunta opcional se deja pasar; ésta se deja pasar solo si la persona lo
   * decide. Sin la bandera, «Continuar al paso N» arrancaba con la ubicación vacía —o con una
   * región propuesta— y la mirada al mercado se omitía sin que nadie hubiera podido decir «Lima».
   */
  pedirAntesDeGenerar?: boolean;
  /**
   * Si un valor sirve como respuesta. Un valor guardado que no sirve se trata como VACÍO en todos
   * lados: el agente lo vuelve a preguntar, la apertura lo pone en «Me falta» y el arranque
   * automático no lo cuenta. Entró con Allpa (2026-09-13): la ubicación «Latinoamérica (México,
   * Colombia, …)» había quedado guardada de una conversación anterior, y la regla de «preguntar
   * antes de arrancar» solo miraba las vacías: pasó como respuesta y el Research arrancó igual.
   */
  valeComoRespuesta?: (valor: string, otra: (clave: string) => string) => boolean;
  /**
   * El agente puede DEDUCIR la respuesta, pero no anotarla sin que la persona la confirme. Lo que se
   * deduce al abrir (`proponerRespuestas`) se descarta para estos campos, así que la apertura la deja
   * en «Me falta» y el arranque automático no la da por contestada. Entró con el mercado del Research
   * (B2B o B2C): una deducción equivocada ahí cambia los cinco pasos.
   */
  confirmarEnElChat?: true;
  /**
   * Si la persona no sabe el número, el agente puede proponerle un rango razonable para su nicho,
   * explicar de dónde sale, y —solo con su sí— anotarlo como `[ESTIMACIÓN] rango — de dónde sale`.
   * La metodología lo usa y lo marca como [ESTIMACIÓN] en el documento, nunca como [COMPLETAR].
   * Entró con Tu precio (2026-10-03): valor del resultado, probabilidad, costo del problema y
   * facturación del cliente son números que casi nadie sabe, y el documento salía lleno de huecos.
   * Es la ÚNICA excepción a «no inventes valores», y por eso es una bandera y no una regla general.
   */
  admiteEstimacion?: true;
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
  /**
   * No se genera con los campos obligatorios vacíos. **Lo tiene UNA sola, y es una excepción con
   * motivo, no una categoría.**
   *
   * Las ocho genéricas generan con lo que haya: el entregable marca los huecos con `[COMPLETAR]` y
   * eso es una decisión de producto escrita en `PanelHerramienta` — *"hay alumnos que llegan con el
   * posicionamiento hecho fuera del sistema, y bloquearlos sería peor que avisarles"*.
   *
   * El Research no puede hacer eso porque sus campos no se interpolan en un documento, se usan para
   * BUSCAR EN LA WEB: sin nicho, el paso 1 no deja un hueco visible, trae cuatro segmentos genéricos
   * que se ven perfectos. El hueco existe y no se nota, que es la única forma de defecto que este
   * repositorio trata como grave.
   *
   * La leen `obligatoriosQueFaltan` —o sea el botón del formulario y el agente conversacional, los
   * dos— así que agregársela a una herramienta le cambia las dos puertas a la vez.
   */
  exigeSusCampos?: boolean;
  /**
   * Se trabaja SOLO por chat: sin formulario, sin selector «Opción 1 / Opción 2». El agente abre
   * proponiendo lo que hereda, y los inputs se guardan igual en `perfil[N]`.
   *
   * Es la MISMA regla que `soloChat` en el catálogo de una pantalla (`Fundaciones.jsx`), pero para
   * una herramienta suelta. ICP & Oferta la declara para sus siete de una vez; en Tools la llevan el
   * VSL y la Landing, y Prospección no —tiene su panel propio, sin agente—, así que declararla a
   * nivel de pantalla habría arrastrado también a esa.
   */
  soloChat?: true;
  /**
   * La herramienta se construye CONVERSANDO: sus preguntas son las de diagnóstico de su metodología, el
   * agente abre con la primera en vez de listar lo que falta, y no se genera hasta que cada una tenga
   * respuesta o se haya saltado. Hoy la lleva Categoría (2026-10-03).
   */
  conversa?: true;
}

const PERFIL: Herramienta = {
  id: 0,
  clave: 'perfil',
  pestania: 'Tu ficha',
  titulo: 'Tu ficha de negocio',
  bajada: 'Tu negocio tal como es hoy. Es la raíz: todo lo demás hereda de aquí.',
  /* ── LA FICHA DESCRIBE EL NEGOCIO, NO AL CLIENTE (2026-10-03) ─────────────────
     Hasta acá generaba un «Perfil de Cliente» —dolores, deseos, creencias, cómo habla— ANTES de
     que el Research eligiera el segmento, y el ICP volvía a hacer lo mismo sobre el segmento
     ganador: dos clientes ideales que podían contradecirse. Ahora el cliente ideal se define solo en
     el ICP, y esta ficha cuenta qué vende el negocio, a quién, a qué precio, con qué resultados y con
     qué experiencia. «El mayor problema de tu cliente» y «qué intentaron antes» salieron de acá: son
     del cliente, y el ICP ya los pregunta. */
  detalle:
    'Con estos seis datos se arma el perfil de tu negocio: qué vendes y cómo lo entregas, a quién ' +
    'le vendes hoy, tus precios, tus resultados y tu experiencia. El cliente ideal no se define ' +
    'aquí: lo define el ICP, después del Research. Los pasos siguientes leen este documento.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 't1-biz', etiqueta: '¿Cómo se llama tu negocio?', tipo: 'texto', marcador: 'Ej: ARIA IA' },
        { id: 't1-service', etiqueta: '¿Qué vendes?', tipo: 'texto', marcador: 'Ej: sistema de adquisición con IA' },
      ],
    },
    {
      columnas: 2,
      campos: [
        /* La clave sigue siendo `niche`: es el nicho del negocio, y así la leen los pasos siguientes.
           La pregunta cambió de «¿En qué nicho estás?» a la forma en que la contesta un negocio. */
        { id: 't1-niche', etiqueta: '¿A quién le vendes hoy?', tipo: 'texto', marcador: 'Ej: agencias digitales, clínicas dentales' },
        { id: 't1-price', etiqueta: '¿A qué precio lo vendes hoy?', tipo: 'texto', marcador: 'Ej: $3,000 setup + $1,500/mes' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't1-result', etiqueta: '¿Qué resultados has logrado con tus clientes? (con cifras si las tienes)', tipo: 'area', marcador: 'Ej: un cliente pasó de 4 a 15 llamadas calificadas al mes en 90 días' },
      ],
    },
    {
      columnas: 1,
      campos: [
        /* Es parte de describir el negocio. El Research también la pregunta (`mr-experience`) para
           elegir el segmento; que se pregunte una sola vez es otro cambio, aparte de éste. */
        { id: 't1-experience', etiqueta: '¿Cuál es tu experiencia o trasfondo?', tipo: 'area', marcador: 'Ej: 8 años en marketing y ventas para agencias; armé el área comercial de dos startups' },
      ],
    },
  ],
  etiquetaBoton: 'Crear mi perfil de negocio',
  etiquetaSalida: 'Perfil del Negocio',
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
    'Sirve si vendes a empresas (B2B) o a personas (B2C): lo primero que pregunta es eso. ' +
    'Paso 1 encuentra 3-4 segmentos que cumplan tus criterios. Paso 2 saca sus dolores y ' +
    'destila el dolor crítico de cada uno. Paso 3 busca quién ya escaló resolviéndolo. Paso 4 ' +
    'propone el modelo de precios. Paso 5 los evalúa contra las cuatro preguntas y elige uno. ' +
    'Cada paso lee la salida del anterior, así que el orden no es decorativo.',
  filas: [
    {
      columnas: 1,
      campos: [
        /* ── B2B O B2C (2026-10-03) ─────────────────────────────────────────────
           El Research daba por hecho que se vende a empresas: el paso 1 lo decía con todas las
           letras. Ahora es lo primero que se pregunta, y cambia los segmentos (paso 1), el modelo de
           precios (paso 4) y la mirada al mercado real (en B2C solo el Espía de anuncios).

           Los VALORES son los que entran al prompt y empiezan con «B2B» o «B2C», que es lo que mira
           `esB2C` (como en el VSL). `confirmarEnElChat`: el agente la deduce de Tu ficha pero NO la
           anota sin que la persona lo confirme — una deducción equivocada acá cambia los cinco pasos. */
        {
          id: 'mr-market',
          etiqueta: '¿Le vendes a empresas o a personas?',
          tipo: 'lista',
          confirmarEnElChat: true,
          opciones: [
            { valor: 'B2B — vende a empresas o dueños de negocio', etiqueta: 'A empresas (B2B)' },
            { valor: 'B2C — vende a personas (consumidor final)', etiqueta: 'A personas (B2C)' },
          ],
          guia:
            'Dedúcela de lo que dice Tu ficha («A quién le vendes hoy», «Qué vendes») y CONFÍRMALA en ' +
            'una línea antes de anotarla: «Por lo que me contaste, le vendes a empresas, ¿correcto?». ' +
            'Si no está claro, pregúntala tal cual. No la anotes sin que la persona diga que sí.',
        },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 'mr-niche', etiqueta: '¿Cuál es tu nicho?', tipo: 'texto', marcador: 'Ej: Salud, Bienes Raíces, Agencias Digitales' },
        { id: 'mr-buyers', etiqueta: '¿Cuántos compradores posibles debería haber, como mínimo?', tipo: 'texto', marcador: 'Ej: 50,000+', valorPorOmision: '50,000+' },
      ],
    },
    {
      columnas: 2,
      campos: [
        /* Era «LTV mínimo de SUS clientes». La clave sigue siendo `ltv`; lo que cambió es cómo se
           pregunta, y la guía dice qué significa en cada mercado, igual que el paso 1. */
        {
          id: 'mr-ltv',
          etiqueta: '¿Cuánto debería valer, como mínimo, un cliente a lo largo del tiempo?',
          tipo: 'texto',
          marcador: 'Ej: $3,000+ (lo que paga en total mientras sigue siendo cliente)',
          valorPorOmision: '$3,000+',
          guia:
            'Explícala en palabras simples, sin decir «LTV». Si vende a EMPRESAS: es cuánto le paga en ' +
            'total un cliente a los negocios a los que les va a vender (negocios con clientes valiosos ' +
            'pueden pagar más). Si vende a PERSONAS: es cuánto le paga a él, en total, una persona ' +
            'mientras sigue siendo su cliente.',
        },
        { id: 'mr-contract', etiqueta: '¿De cuánto debería ser, como mínimo, la primera compra o el primer contrato? (opcional)', tipo: 'texto', marcador: 'Ej: $1,000+', opcional: true },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 'mr-experience', etiqueta: '¿Cuál es tu experiencia o trasfondo?', tipo: 'area', marcador: 'Ej: soy consultor de crecimiento con experiencia en marketing y ventas para agencias...' },
      ],
    },
    {
      columnas: 1,
      campos: [
        /* El sexto criterio, y el único que no viene del hub. Es lo que la MIRADA AL MERCADO REAL
           necesita para buscar en Google Maps: un rubro (el primer segmento del paso 1) y una
           ubicación. Sin ubicación no hay scraping y el Research corre igual, por eso es opcional.
           El agente lo propone desde el onboarding cuando dice el mercado geográfico. Ver `mercado.ts`. */
        {
          id: 'mr-location',
          /* «Ciudad» y no «dónde»: con «dónde», el agente propuso «Latinoamérica (México, Colombia, …)»
             desde un onboarding que decía «Latinoamérica en general», y Maps no encontró el lugar.
             El scraper necesita un lugar concreto; la etiqueta lo pide y `esUbicacionAmplia` lo revisa. */
          etiqueta: '¿En qué ciudad buscar negocios reales? (si vendes a personas, solo el país) (opcional)',
          tipo: 'texto',
          marcador: 'Ej: Cayma, Arequipa, Perú · Miraflores, Lima, Perú (zona, ciudad, país)',
          opcional: true,
          pedirAntesDeGenerar: true,
          /* «sin datos reales» es la salida explícita: la persona decide seguir sin buscar negocios, y
             lo dice. Vale como respuesta para que el arranque no quede trabado, y `prepararMercado` la
             lee como «no quiso». */
          /* En B2C no se buscan negocios (decisión del 2026-10-03): solo el Espía de anuncios, que
             necesita el PAÍS. Por eso ahí vale un país solo; en B2B sigue exigiendo las tres partes. */
          valeComoRespuesta: (v, otra) =>
            SIN_DATOS_REALES.test(v) ||
            esUbicacionBuscable(v) ||
            (esB2C(otra('market')) && esPaisReconocido(v)),
          guia:
            'Tiene que ser un lugar concreto donde buscar negocios, con TRES partes separadas por coma: ' +
            'zona o distrito, ciudad, país (ej: «Cayma, Arequipa, Perú», «Polanco, Ciudad de México, ' +
            'México»). El buscador de negocios exige las tres; «Arequipa, Perú» a secas no vale. NUNCA una ' +
            'región de varios países ni «Latinoamérica». Para PROPONERLA desde el contexto: solo si el ' +
            'onboarding dice una ciudad concreta, y completa la zona con el centro de esa ciudad (ej: ' +
            '«Centro, Arequipa, Perú»); si dice una región o «en general», va vacía. Para PREGUNTARLA: ' +
            'recomiéndale empezar por SU país —si el onboarding, el sitio web o el prefijo del teléfono lo ' +
            'dicen, nómbralo— y pídele la ciudad y la zona o distrito donde vive o vende. Si te da solo la ' +
            'ciudad, pídele la zona o distrito por donde empezar (o propón el centro) y anota las tres ' +
            'partes juntas. Si no está claro, pregúntale con qué país quiere empezar a extraer leads, en ' +
            'qué ciudad y en qué zona. Dile en una línea que el estudio de mercado mira más de un país, pero la ' +
            'extracción de negocios reales arranca en un solo lugar, hasta 100 negocios, que quedan en ' +
            `${DONDE_ESTAN_LOS_LEADS}; y que lo que se vio en el mercado aparece en esta misma pestaña cuando ` +
            'termine el Research. Si la persona prefiere seguir SIN buscar negocios reales, anota ' +
            'exactamente «sin datos reales» y sigue. Hasta que esta respuesta no sea una ciudad concreta ' +
            'o «sin datos reales», NO des por completas las respuestas ni pongas `listo`: pregúntala, ' +
            'aunque la persona te pida generar. SI VENDE A PERSONAS (B2C), todo lo anterior cambia: no se ' +
            'buscan negocios ni se extraen leads; solo se mira, gratis, qué anuncios corren para ese ' +
            'público en su país. Pregúntale solo el PAÍS (ej: «Perú») y anótalo así; no le hables de ' +
            'leads ni de zonas.',
        },
      ],
    },
  ],
  etiquetaBoton: 'Ejecutar research completo',
  etiquetaSalida: 'Market Research',
  forma: 'research',
  /* La única. Ver la definición: sus criterios no se interpolan en un documento, se buscan en la
     web, y un criterio vacío no deja un `[COMPLETAR]` — deja un research genérico que se ve bien. */
  exigeSusCampos: true,
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
        { id: 't4-tried', etiqueta: '¿Qué han intentado antes? (opcional)', tipo: 'area', marcador: 'Ej: contrataron freelancers, compraron cursos, probaron agencias', opcional: true },
      ],
    },
  ],
  etiquetaBoton: 'Crear mi avatar',
  etiquetaSalida: 'Avatar Buyer Profile',
  forma: 'generica',
};

/**
 * Cómo se trata cada pregunta del diagnóstico de Categoría. La metodología dice «máximo 2-3 preguntas
 * por turno»; acá es una, como en todas las herramientas, y saltar es una respuesta explícita.
 */
const GUIA_DEL_DIAGNOSTICO =
  'Es una pregunta del diagnóstico de la metodología: hazla sola y espera la respuesta. Si la ' +
  'persona prefiere no contestarla, anota exactamente «(saltada)» y sigue con la siguiente: el ' +
  'documento hará un supuesto marcado SOLO en las saltadas. No la saltes por tu cuenta ni la des por ' +
  'respondida con lo que deduzcas del contexto.';

const CATEGORIA: Herramienta = {
  id: 2,
  clave: 'categoria',
  pestania: 'Categoría',
  titulo: 'Tu categoría única',
  bajada: 'Por qué tú y no otro: tu método con nombre propio, para dejar de competir por precio.',
  detalle:
    'Hereda tu ficha, el segmento ganador del Research, tu nicho y tu ICP. Antes de escribir, el ' +
    'agente te hace las preguntas de diagnóstico de la metodología, de a una (lo que ya sabe de los ' +
    'pasos anteriores no te lo vuelve a preguntar). Puedes saltar cualquiera: solo ahí el documento ' +
    'hace un supuesto, y lo marca como [SUPUESTO]. Entrega el Nuevo Juego con tu constraint real, el ' +
    'Enemigo nombrado, las Truth Bombs reutilizables, tu Modelo con nombre propio y el shift de ' +
    'identidad.',
  /* ── CATEGORÍA CONVERSA (2026-10-03) ──────────────────────────────────────────
     Tenía tres preguntas y generaba en «modo documento»: la metodología —un consultor que diagnostica
     preguntando— quedaba forzada a suponer, y el documento salía lleno de [SUPUESTO]. Ahora las
     preguntas son las de diagnóstico de su `SKILL.md`, en su orden, y todas llevan
     `pedirAntesDeGenerar`: el servidor no genera hasta que cada una tenga respuesta o la persona elija
     saltarla («(saltada)»). Tres vienen heredadas (`heredados.ts`): qué vende y sus resultados, de Tu
     ficha; para quién, del ICP. */
  conversa: true,
  filas: [
    {
      columnas: 1,
      campos: [
        { id: 't2cat-service', etiqueta: '¿Qué vendes exactamente? (qué incluye y cómo lo entregas)', tipo: 'area', marcador: 'Ej: un sistema de agendamiento con IA, lo instalamos en 2 semanas y lo operamos', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
        { id: 't2cat-forwho', etiqueta: '¿Para quién es?', tipo: 'texto', marcador: 'Ej: dueños de inmobiliarias con 5+ agentes', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
        { id: 't2cat-problem', etiqueta: '¿Qué problema cree tu cliente que está resolviendo cuando te compra?', tipo: 'area', marcador: 'Ej: cree que le faltan leads, cuando lo que pierde es el seguimiento', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 't2cat-current', etiqueta: '¿Cómo te presentas hoy?', tipo: 'texto', marcador: 'Ej: agencia de marketing digital / consultor de IA', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
        { id: 't2cat-alternatives', etiqueta: '¿Contra qué te comparan tus clientes?', tipo: 'texto', marcador: 'Ej: otras agencias, contratar a alguien, hacerlo ellos mismos', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't2cat-whychoose', etiqueta: '¿Por qué te eligen a ti en vez de esas alternativas?', tipo: 'area', marcador: 'Ej: porque respondemos en minutos y nos pagan por cita agendada', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
        { id: 't2cat-different', etiqueta: '¿Qué hace tu forma de trabajar genuinamente distinta?', tipo: 'area', marcador: 'Ej: medimos al cliente por citas, no por leads; el sistema es nuestro, no un software suelto', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
        { id: 't2cat-notworking', etiqueta: '¿Qué NO está funcionando en cómo comunicas tu oferta?', tipo: 'area', marcador: 'Ej: me piden precio de una, me comparan por costo, no entienden qué me hace distinto', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
        { id: 't2cat-evidence', etiqueta: '¿Qué te indica que tu posicionamiento actual no está funcionando?', tipo: 'area', marcador: 'Ej: 7 de cada 10 llamadas terminan en «lo pienso»; me comparan con freelancers', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
        { id: 't2cat-results', etiqueta: '¿Qué resultados logran tus mejores clientes?', tipo: 'area', marcador: 'Ej: pasan de 4 a 15 citas al mes en 90 días', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
        { id: 't2cat-goal', etiqueta: '¿Qué quieres lograr con el reposicionamiento?', tipo: 'area', marcador: 'Ej: dejar de competir por precio y cobrar el doble', pedirAntesDeGenerar: true, guia: GUIA_DEL_DIAGNOSTICO },
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
    'Hereda tu ficha, el avatar y la categoría única. Si todavía no tienes precio, déjalo vacío: el stack ' +
    'de valor se construye sin anclarlo a un número y el precio sale después en Tu precio.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 't5-name', etiqueta: 'Nombre de tu oferta o programa', tipo: 'texto', marcador: 'Ej: Protocolo de Adquisición Predecible' },
        { id: 't5-price', etiqueta: 'Precio tentativo (opcional)', tipo: 'texto', marcador: 'Déjalo vacío si aún no lo definiste', opcional: true },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't5-result', etiqueta: '¿Qué resultado quiere conseguir tu cliente?', tipo: 'area', marcador: 'Ej: 15 llamadas calificadas al mes, sostenidas, sin depender de referidos' },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 't5-format', etiqueta: '¿Cómo quiere recibirlo tu cliente? (formato y cuánto esfuerzo quiere poner)', tipo: 'texto', marcador: 'Ej: que se lo hagan todo, con 2 sesiones semanales de revisión' },
        { id: 't5-when', etiqueta: '¿Para cuándo quiere tu cliente ese resultado?', tipo: 'texto', marcador: 'Ej: en los próximos 90 días, antes de la temporada alta' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't5-why', etiqueta: '¿Por qué quiere tu cliente ese resultado? (la razón de fondo)', tipo: 'area', marcador: 'Ej: quiere dejar de depender de referidos para poder contratar y salir de la operación' },
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
        { id: 't5-urgency', etiqueta: '¿Por qué comprar ahora y no más adelante? (opcional)', tipo: 'area', marcador: 'Escasez SOLO real: cupos de delivery, temporada, cambio de precio ya decidido', opcional: true },
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
    'el precio es una fracción de eso. Hereda tu ficha, tu ICP, tu categoría y el stack de valor de ' +
    'tu oferta, y entrega también ' +
    'la garantía condicional con sus indicadores líderes. Si no sabes un número, el agente te ' +
    'propone un rango para tu nicho y te dice de dónde sale; si lo aceptas, el documento lo marca ' +
    'como [ESTIMACIÓN] y puedes reemplazarlo por tu dato real cuando lo tengas.',
  filas: [
    {
      columnas: 2,
      campos: [
        { id: 't11-outcome', etiqueta: '¿Cuánto vale al año, en dinero, el resultado que logra tu cliente?', tipo: 'texto', marcador: 'Ej: $120,000 al año en ventas nuevas', admiteEstimacion: true },
        { id: 't11-probability', etiqueta: '¿Qué probabilidad real hay de lograrlo?', tipo: 'texto', marcador: 'Ej: 60%', admiteEstimacion: true },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 't11-problemcost', etiqueta: '¿Cuánto le cuesta hoy el problema a tu cliente? (directo e indirecto)', tipo: 'texto', marcador: 'Ej: $8,000/mes en oportunidad perdida', admiteEstimacion: true },
        { id: 't11-clientrevenue', etiqueta: '¿Cuánto factura tu cliente al mes hoy?', tipo: 'texto', marcador: 'Ej: $30k-$80k/mes', admiteEstimacion: true },
      ],
    },
    {
      columnas: 2,
      campos: [
        { id: 't11-delivery', etiqueta: '¿Quién hace el trabajo: lo entregas tú, lo hacen juntos o lo hace el cliente con tu guía?', tipo: 'texto', marcador: 'Ej: lo hago yo por el cliente (done-for-you)' },
        { id: 't11-goal', etiqueta: '¿Prefieres cobrar por adelantado o de forma recurrente?', tipo: 'texto', marcador: 'Ej: todo por adelantado · o un setup + mensualidad' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't11-proof', etiqueta: '¿Qué prueba tienes de que funciona con este tipo de cliente?', tipo: 'area', marcador: 'Ej: 6 clientes, el mejor pasó de 3 a 14 llamadas al mes' },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't11-pastresults', etiqueta: 'Resultados pasados con cifras, con clientes o tuyos propios si aún no vendes (opcional)', tipo: 'area', marcador: 'Solo cifras reales. Lo que falte se marca como pendiente, no se inventa', opcional: true },
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
    'oferta y precio, además de tu ficha. Si falta alguna, el documento sale con marcadores [COMPLETAR] en vez de ' +
    'cifras inventadas — a propósito.',
  filas: [
    {
      columnas: 1,
      campos: [
        { id: 't26-caso', etiqueta: 'Un caso real tuyo (opcional)', tipo: 'area', marcador: 'Ej: Marcos pasó de 4 a 19 llamadas al mes en 11 semanas', opcional: true },
      ],
    },
    {
      columnas: 1,
      campos: [
        { id: 't26-responsables', etiqueta: 'Responsables por fase (opcional)', tipo: 'area', marcador: 'Si no tienes equipo, déjalo vacío: se cubre con [tú / agente IA]', opcional: true },
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
  // Pedido de Kevin (2026-09-05): «lo mismo que hicimos con ICP & Oferta» — el VSL se trabaja solo
  // por chat. Hereda de ICP, Categoría, Oferta y Tu precio (`FUENTES_POR_HERRAMIENTA[5]`), y eso es
  // lo que el agente lee para proponer las respuestas antes de que nadie escriba.
  soloChat: true,
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
  // Kevin (2026-09-05), el mismo día que el VSL: «¿podemos hacer lo mismo con Tu página?». Solo chat.
  // Tiene UN campo —el nicho— y lo hereda casi siempre del ICP, así que el agente suele abrir con
  // todo propuesto y la persona solo confirma. Prospección queda como la única de Tools con panel.
  soloChat: true,
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
];

/** Los nueve identificadores, para las comprobaciones y para recorrer sin buscar. */
export const IDS_FUNDACIONES: readonly number[] = FUNDACIONES.map((h) => h.id);

/**
 * Las herramientas de la pantalla `tools`, en el orden en que se muestran.
 *
 * ── EL VSL Y LA LANDING VIVEN ACÁ Y NO EN FUNDACIONES ───────────────────────
 *
 * En ARIA-brain son los pasos 8 y 9 de «Construye tu base», y el port las trajo ahí. El VSL se
 * movió el 2026-08-31 por pedido de Jorge; la Landing —la pestaña 8 de «ICP & Oferta»— el
 * 2026-09-02 por pedido de Kevin. Son las dos últimas del método, y las dos son de producción:
 * lo que sale de ellas es un prompt para construir algo, no una pieza del posicionamiento.
 *
 * La Landing va DESPUÉS del VSL, y no es cosmético: hereda de él (`FUENTES_POR_HERRAMIENTA[6]`
 * incluye `vsl`). Con las dos en esta pantalla, la fuente que más le importa queda del mismo
 * lado — que es más de lo que tenía cuando estaba en «ICP & Oferta» y su VSL ya se había mudado.
 *
 * Lo que NO cambia con la mudanza, y por eso es segura: `/api/tools/estado` y
 * `/api/fundaciones/estado` llaman las dos a `leerElEstado`, o sea que **comparten almacén**.
 * El trabajo ya guardado sigue estando, y los chips de herencia —ICP, categoría, oferta,
 * precio y VSL— siguen resolviendo, porque `fuentes()` lee el estado completo y no sólo el del
 * catálogo de su pantalla.
 *
 * Lo que SÍ cambia, y hay que saberlo: pasan a pedir `tools.ver` / `tools.editar` en vez de
 * `fundaciones.*`. Quien tenga uno y no el otro cambia de lado.
 */
export const TOOLS: readonly Herramienta[] = [PROSPECCION, VSL, LANDING];

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

/**
 * ¿Esta herramienta tiene agente conversacional?
 *
 * Lo tienen las que son «un formulario y un documento»: las ocho genéricas y el Research, que es un
 * formulario y cinco documentos encadenados. **Prospección no**, y no es un olvido: su formulario no
 * produce un documento sino que dispara un scraping que gasta leads del monedero de la organización,
 * y «arrancar cuando la persona confirme» no significa lo mismo cuando lo que se gasta no se puede
 * volver a generar. El día que se decida, se decide acá.
 *
 * ── POR QUÉ VIVE EN EL CATÁLOGO Y NO EN EL MÓDULO DEL AGENTE ────────────────
 *
 * Porque la usan las DOS mitades: la ruta, para decidir si acepta la conversación, y la pantalla,
 * para decidir si dibuja el selector. Si la pantalla ofreciera el modo donde el servidor lo rechaza,
 * el botón daría un error sin explicación; si lo ofreciera solo el servidor, no habría cómo llegar.
 *
 * Y en el catálogo, que es lo único que el navegador ya importa: puesta en `conversacion.ts`,
 * cualquier pantalla que la use se arrastra al paquete del navegador el módulo que le habla a
 * Anthropic —su URL, su esquema y las instrucciones enteras del entrevistador— para preguntar por un
 * `forma`. Es una propiedad de la herramienta, no de la llamada.
 */
export function tieneAgente(h: Herramienta): boolean {
  return h.forma === 'generica' || h.forma === 'research';
}

/**
 * La pestaña de `Fundaciones.jsx` que corresponde a la que pide la navegación (`NE-19`), o `null`.
 *
 * Las entradas de los departamentos nombran las pestañas por su CLAVE
 * (`lib/autorizacion/departamentos.ts`), y `Fundaciones.jsx` guarda la abierta como el `id` de una
 * herramienta —un número— o la clave de una vista —un texto—. Devolver la clave de una herramienta
 * en vez de su `id` no fallaría: la pantalla caería a la primera herramienta sin marcar ninguna
 * pestaña. Y una clave desconocida da `null`, para que quien pide no abra otra sin decirlo.
 */
export function activaDeLaPestana(
  herramientas: readonly Herramienta[],
  vistas: readonly { clave: string }[],
  pestana: string | null,
): number | string | null {
  if (pestana === null) return null;
  const herramienta = herramientas.find((h) => h.clave === pestana);
  if (herramienta) return herramienta.id;
  return vistas.some((v) => v.clave === pestana) ? pestana : null;
}

/**
 * La clave de la pestaña que `Fundaciones.jsx` DIBUJA con `activa`: la inversa de
 * `activaDeLaPestana`. Es lo que se ve, no lo que se pidió: un `id` que no está en el catálogo —el de
 * un chip «Hereda de» que apunta a una herramienta de ICP— cae a la primera herramienta, igual que
 * el panel que se dibuja.
 */
export function pestanaDeLaActiva(
  herramientas: readonly Herramienta[],
  vistas: readonly { clave: string }[],
  activa: number | string,
): string {
  if (typeof activa === 'string' && vistas.some((v) => v.clave === activa)) return activa;
  return (herramientas.find((h) => h.id === activa) ?? herramientas[0]!).clave;
}
