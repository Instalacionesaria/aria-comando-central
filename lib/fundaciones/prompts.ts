// Los prompts de las siete herramientas: qué metodología usa cada una y qué datos recibe.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTE ARCHIVO ES EL PUERTO DE `DATA_GETTERS` DEL HUB, Y SE PARECE MÁS DE LO QUE GUSTARÍA
//
// Las etiquetas, los recortes (`slice(0, 3500)`) y el orden de los bloques están copiados de
// `ARIA-brain/app-next/lib/legacy/dataGetters.ts` **a propósito**. No son detalles de estilo: los
// `SKILL.md` fueron escritos y afinados contra ESTOS textos. Cambiar "AVATAR YA GENERADO" por
// "Avatar" o subir un recorte de 2500 a 4000 cambia el documento que recibe el alumno, y lo cambia
// sin que nada falle — que es la clase de cambio que no se detecta hasta que alguien nota que los
// entregables de acá salen distintos que los del hub.
//
// Los recortes existen por una razón medida: el Mapa hornea desde cuatro documentos completos, y
// sin límites el prompt no entra. Los números son los que el hub ya calibró.
//
// ── LO QUE SÍ CAMBIÓ, Y POR QUÉ ──────────────────────────────────────────────
//
// En el hub esto corre en el NAVEGADOR y lee el DOM (`document.getElementById(id).value`) y
// variables globales mutables. Acá corre en el SERVIDOR y todo entra por argumentos. El motivo está
// en `herencia.ts`: una global de módulo en el servidor se comparte entre organizaciones.
// ═══════════════════════════════════════════════════════════════════════════════

import { SIN_ESPECIFICAR, presente, valor } from './campos.ts';
import { ultimaVersion, type EstadoDeFundaciones } from './estado.ts';
import { extraerCompromisos, formatearCompromisos } from './compromisos.ts';
import { fuentes } from './herencia.ts';
import { interpolar, leerPlantilla, type DatosDePlantilla } from './plantillas.ts';

/** Qué archivo de metodología usa cada herramienta. */
export const METODOLOGIA: Readonly<Record<number, string>> = {
  0: 'perfil/onboarding',
  2: 'categoria/system',
  3: 'icp/avatar',
  4: 'oferta/irresistible',
  10: 'pricing/protocol',
  26: 'mapa-proceso/system',
  5: 'vsl/killer-framework',
  6: 'landing/vsl-ai-studio',
};

/** Las metodologías de los cinco pasos del Research, en orden. */
export const METODOLOGIA_RESEARCH: readonly string[] = [
  'market-research/paso-1',
  'market-research/paso-2',
  'market-research/paso-3',
  'market-research/paso-4',
  'market-research/paso-5',
];

/**
 * Cuántos tokens de salida se le dan a cada herramienta.
 *
 * Los cuatro entregables largos —avatar, oferta, precio y mapa— llevan 16.000 y el resto 8.192, que
 * son los números del hub. El del Mapa no es generosidad: son nueve secciones densas más el
 * veredicto, y con menos presupuesto la respuesta se corta a la mitad de S6.
 */
export function tokensDeSalida(id: number): number {
  return id === 3 || id === 4 || id === 10 || id === 26 ? 16_000 : 8_192;
}

/** El Research busca en la web: son segmentos y referentes reales, no un ejercicio de estilo. */
export const TOKENS_RESEARCH = 16_000;

/** Cuando una metodología no se puede leer, la generación NO se hace. Ver `plantillas.ts`. */
export class MetodologiaIlegible extends Error {
  readonly metodologia: string;

  constructor(metodologia: string) {
    super(`No se pudo leer la metodología ${metodologia}`);
    this.name = 'MetodologiaIlegible';
    this.metodologia = metodologia;
  }
}

// ── Los constructores de contexto heredado ───────────────────────────────────

function nd(inputs: Record<string, string> | undefined, clave: string): string {
  const v = inputs ? inputs[clave] : undefined;
  return v ? v : 'N/D';
}

/** Lo que el ICP hereda del Research: el segmento ganador, los dolores y la investigación. */
function contextoDeResearch(estado: EstadoDeFundaciones): string | null {
  const salidas = estado.researchSalidas;
  const ganador = salidas.length >= 5 ? salidas[4] : undefined;
  if (!ganador) return null;

  let ctx =
    'SEGMENTO RECOMENDADO (del Market Research completo del cliente):\n' + ganador.slice(0, 3000);
  const dolores = salidas[1];
  if (dolores) {
    ctx +=
      '\n\nDOLORES COMPLETOS + DOLOR CRÍTICO POR SEGMENTO (Market Research Paso 2 — ESTOS dolores ' +
      'investigados del mercado son la fuente PRINCIPAL para la sección de dolores del avatar; el ' +
      'campo manual de dolores es solo un complemento):\n' + dolores.slice(0, 2800);
  }
  if (estado.researchProfundo) {
    ctx +=
      '\n\nINVESTIGACIÓN PROFUNDA DEL MERCADO (TAM, competidores, objeciones, buyer journey, ' +
      'Dream 100):\n' + estado.researchProfundo.slice(0, 3000);
  }
  if (estado.researchCampo) {
    ctx +=
      '\n\nLENGUAJE REAL DEL MERCADO (extraído de investigación de campo en grupos/foros):\n' +
      estado.researchCampo.slice(0, 2000);
  }
  return ctx;
}

/** Lo que el ICP hereda de la ficha: la raíz de toda la cadena. */
function contextoDeFicha(estado: EstadoDeFundaciones): string | null {
  const p0 = estado.perfil[0];
  if (!p0) return null;
  const partes: string[] = [
    `PERFIL DE CLIENTE (raíz — negocio del alumno): Negocio: ${nd(p0, 'biz')}, ` +
      `Nicho: ${nd(p0, 'niche')}, Servicio: ${nd(p0, 'service')}, Precio actual: ${nd(p0, 'price')}, ` +
      `Dolor principal que resuelve: ${nd(p0, 'pain')}, Resultado que entrega: ${nd(p0, 'result')}, ` +
      `Situación antes: ${nd(p0, 'before')}`,
  ];
  const doc = ultimaVersion(estado, 0);
  if (doc) {
    partes.push(
      'PERFIL COMPLETO NORMALIZADO (usa este contexto de negocio como base del avatar):\n' +
        doc.slice(0, 3000),
    );
  }
  return partes.join('\n\n');
}

// ── Los datos de cada herramienta ────────────────────────────────────────────

function datosDeFicha(valores: Record<string, string>): DatosDePlantilla {
  return {
    biz: valor(valores, 't1-biz'),
    niche: valor(valores, 't1-niche'),
    service: valor(valores, 't1-service'),
    price: valor(valores, 't1-price'),
    pain: valor(valores, 't1-pain'),
    result: valor(valores, 't1-result'),
    before: valor(valores, 't1-before'),
  };
}

function datosDeIcp(valores: Record<string, string>, estado: EstadoDeFundaciones): DatosDePlantilla {
  const tried = valor(valores, 't4-tried');
  return {
    niche: valor(valores, 't4-niche'),
    income: valor(valores, 't4-income'),
    age: valor(valores, 't4-age'),
    country: valor(valores, 't4-country'),
    occupation: valor(valores, 't4-occupation'),
    pains: valor(valores, 't4-pains'),
    desires: valor(valores, 't4-desires'),
    tried,
    // El condicional del SKILL.md mira `_tried`, no `tried`: la línea entera se omite cuando el
    // alumno no contestó, en vez de aparecer con "(no especificado)" al lado.
    _tried: presente(valores, 't4-tried') ? tried : '',
    _researchContext: contextoDeResearch(estado),
    _profileContext: contextoDeFicha(estado),
  };
}

function datosDeOferta(valores: Record<string, string>, estado: EstadoDeFundaciones): DatosDePlantilla {
  const f = fuentes(estado);
  const icpInputs = estado.perfil[3];
  const partes: string[] = [];

  if (icpInputs) {
    partes.push(
      `ICP (inputs): Nicho: ${nd(icpInputs, 'niche')}, Ingresos: ${nd(icpInputs, 'income')}, ` +
        `Ocupación: ${nd(icpInputs, 'occupation')}, Dolores: ${nd(icpInputs, 'pains')}, ` +
        `Deseos: ${nd(icpInputs, 'desires')}`,
    );
  }
  if (f.icp.presente) {
    partes.push(
      'AVATAR YA GENERADO (usa su situación actual, deseada, without clauses, transformación y ' +
        'objeciones para diseñar la oferta):\n' + f.icp.completo.slice(0, 3500),
    );
  }
  if (f.categoria.presente) {
    partes.push(
      'POSICIONAMIENTO / CATEGORÍA ÚNICA YA DEFINIDA (alinea la oferta con este reframe):\n' +
        f.categoria.completo.slice(0, 2500),
    );
  }

  const precio = valor(valores, 't5-price');
  return {
    name: valor(valores, 't5-name'),
    price: precio,
    result: valor(valores, 't5-result'),
    format: valor(valores, 't5-format'),
    why: valor(valores, 't5-why'),
    when: valor(valores, 't5-when'),
    includes: valor(valores, 't5-includes'),
    urgency: valor(valores, 't5-urgency'),
    // Sin precio, el stack de valor se construye igual y NO se ancla a un número inventado. El
    // texto es el del hub, palabra por palabra: es una instrucción al modelo, no una etiqueta.
    _priceDisplay:
      precio !== SIN_ESPECIFICAR
        ? precio
        : 'aún no definido — este se calculará después en Pricing Protocol con base en el valor ' +
          'real generado; no inventes un número, genera el stack de valor completo sin anclarlo a ' +
          'un precio específico',
    _icpContext: partes.length > 0 ? partes.join('\n\n') : null,
  };
}

function datosDePricing(valores: Record<string, string>, estado: EstadoDeFundaciones): DatosDePlantilla {
  const icpInputs = estado.perfil[3];
  const ofertaInputs = estado.perfil[4];
  const docOferta = ultimaVersion(estado, 4);
  const partes: string[] = [];

  if (icpInputs) {
    partes.push(
      `ICP — Nicho: ${nd(icpInputs, 'niche')}, Dolores: ${nd(icpInputs, 'pains')}, ` +
        `Deseos: ${nd(icpInputs, 'desires')}`,
    );
  }
  if (docOferta) {
    partes.push(
      'STACK DE VALOR YA GENERADO EN OFERTA IRRESISTIBLE (usa el valor total estimado del stack ' +
        'como referencia del Valor Transformacional):\n' + docOferta.slice(0, 3000),
    );
  } else if (ofertaInputs) {
    partes.push(
      `Oferta — Nombre: ${nd(ofertaInputs, 'name')}, Precio tentativo: ${nd(ofertaInputs, 'price')}, ` +
        `Resultado: ${nd(ofertaInputs, 'result')}, Incluye: ${nd(ofertaInputs, 'includes')}`,
    );
  }

  return {
    outcome: valor(valores, 't11-outcome'),
    probability: valor(valores, 't11-probability'),
    problemcost: valor(valores, 't11-problemcost'),
    clientrevenue: valor(valores, 't11-clientrevenue'),
    delivery: valor(valores, 't11-delivery'),
    goal: valor(valores, 't11-goal'),
    proof: valor(valores, 't11-proof'),
    pastresults: valor(valores, 't11-pastresults'),
    _pricingContext: partes.length > 0 ? partes.join('\n\n') : null,
  };
}

function datosDeMapa(valores: Record<string, string>, estado: EstadoDeFundaciones): DatosDePlantilla {
  const f = fuentes(estado);
  const icpInputs = estado.perfil[3];
  const partes: string[] = [];

  // Cada bloque dice de qué SECCIONES del mapa es fuente. Eso no es documentación: el `SKILL.md`
  // referencia esas secciones por su número, y sin la anotación el modelo tiene que adivinar de
  // dónde sacar las cifras de S7.
  if (f.icp.presente) {
    partes.push(
      'AVATAR / ICP YA GENERADO (fuente de: avatar, transformación actual→deseada, dolores del ' +
        'nicho en su lenguaje, la métrica que le duele, meta) — S1/S2/S9:\n' +
        f.icp.completo.slice(0, 3500),
    );
  }
  if (f.categoria.presente) {
    partes.push(
      'CATEGORÍA ÚNICA / POSICIONAMIENTO (fuente del MECANISMO ÚNICO con su nombre propio; úsalo ' +
        'en S1/S4/S5) — S1/S4/S5:\n' + f.categoria.completo.slice(0, 2500),
    );
  }
  if (f.oferta.presente) {
    partes.push(
      'OFERTA IRRESISTIBLE (fuente de: fases y entregables del delivery, piezas del funnel, ' +
        'sistemas, garantía si existe) — S3/S5/S6/S7/S8:\n' + f.oferta.completo.slice(0, 3000),
    );
  }
  if (f.pricing.presente) {
    partes.push(
      'PRICING PROTOCOL (fuente de: ticket, LTV, cash collected, economía potencial×probabilidad, ' +
        'garantía condicional, escalera de valor) — S3/S4/S7/S8/S9:\n' +
        f.pricing.completo.slice(0, 3000),
    );
  }

  const nicho = f.niche.presente ? f.niche.completo : nd(icpInputs, 'niche');
  return {
    niche: nicho === 'N/D' ? SIN_ESPECIFICAR : nicho,
    caso: valor(valores, 't26-caso'),
    responsables: valor(valores, 't26-responsables'),
    _caso: presente(valores, 't26-caso') ? valor(valores, 't26-caso') : '',
    _responsables: presente(valores, 't26-responsables') ? valor(valores, 't26-responsables') : '',
    _crossContext: partes.length > 0 ? partes.join('\n\n') : null,
  };
}

/**
 * El diagnóstico de Categoría Única: un solo bloque de texto, no campos sueltos.
 *
 * `categoria/system` es la única metodología SIN variables de plantilla: es un prompt de sistema
 * conversacional que el hub adapta a modo documento y al que le pega los datos al final. El
 * adaptador de abajo es parte de ese contrato y va literal.
 */
/**
 * Lo que el VSL hereda. Puerto del `DATA_GETTERS[5]` del hub.
 *
 * ── LOS TRES BOOLEANOS SON LA MITAD DE ESTA FUNCIÓN ──────────────────────────
 *
 * `vsl/killer-framework` no es una plantilla con huecos: tiene RAMAS. `{{#_isScreenShare}}` cambia
 * el entregable entero —guion más documento visual, en vez de solo guion—, `{{^_hasProof}}` cambia
 * en qué se apoya la credibilidad cuando el alumno todavía no tiene casos, y `{{#_isB2C}}` cambia
 * el lenguaje, la apertura y el cierre.
 *
 * Los tres se derivan mirando el PRINCIPIO del valor de la lista, exactamente como el hub. Es
 * frágil y se conserva igual a propósito: acortar un valor en `herramientas.ts` —"B2C" en vez de
 * la frase entera— apaga una rama del framework y **el documento sale igual**, escrito con el
 * molde equivocado. Por eso el comentario está en los dos archivos.
 */
function datosDeVsl(valores: Record<string, string>, estado: EstadoDeFundaciones): DatosDePlantilla {
  const f = fuentes(estado);
  const partes: string[] = [];

  // El orden y las etiquetas son los del hub. Los `SKILL.md` fueron afinados contra estos textos:
  // cambiar "AVATAR / TARJETA ESPEJO YA GENERADA" por "Avatar" cambia el documento que recibe el
  // alumno, sin que nada falle.
  if (f.icp.presente) {
    partes.push(
      'AVATAR / TARJETA ESPEJO YA GENERADA (usa su lenguaje exacto en el Pattern Interrupt y las ' +
        'secciones de dolor; usa sus objeciones en la sección de objeciones; deriva de aquí las ' +
        'creencias a instalar):\n' + f.icp.completo.slice(0, 3000),
    );
  }
  if (f.categoria.presente) {
    partes.push(
      'CATEGORÍA ÚNICA / POSICIONAMIENTO YA DEFINIDO (el Mecanismo Único del VSL debe alinearse ' +
        'con este reframe y llevar su nombre propio si ya existe; las afirmaciones provocadoras de ' +
        'aquí son candidatas directas para el Pattern Interrupt y el Hook):\n' +
        f.categoria.completo.slice(0, 2500),
    );
  }
  if (f.oferta.presente) {
    partes.push(
      'OFERTA IRRESISTIBLE YA GENERADA (usa el stack de valor para la sección del programa y la ' +
        'transición al CTA):\n' + f.oferta.completo.slice(0, 2500),
    );
  }
  if (f.pricing.presente) {
    // El recorte más chico de los cuatro, y la advertencia en mayúsculas: de acá solo se quiere la
    // GARANTÍA. El precio no se menciona nunca — este embudo lleva a una llamada, no a una compra.
    partes.push(
      'GARANTÍA Y PRICING PROTOCOL YA CALCULADOS (usa la garantía condicional de aquí para la ' +
        'sección de reducción de riesgo — NO reveles ninguna cifra de precio en el VSL, este es un ' +
        'funnel de aplicación/llamada):\n' + f.pricing.completo.slice(0, 2000),
    );
  }

  const proof = valor(valores, 't6-socialproof');
  const formato = valor(valores, 't6-format');
  const mercado = valor(valores, 't6-market');

  return {
    program: valor(valores, 't6-program'),
    duration: valor(valores, 't6-duration'),
    // El nicho sale del AVATAR y no de la ficha: es el nicho al que le habla el video.
    icp: f.niche.presente ? f.niche.completo : SIN_ESPECIFICAR,
    promise: valor(valores, 't6-promise'),
    story: valor(valores, 't6-story'),
    obj: valor(valores, 't6-obj'),
    _crossContext: partes.length > 0 ? partes.join('\n\n') : null,
    // Los tres booleanos. Ver el encabezado de esta función.
    _hasProof: proof.startsWith('Sí'),
    _noProof: proof.startsWith('No'),
    _isScreenShare: formato.startsWith('Case study'),
    _isB2C: mercado.startsWith('B2C'),
    // Y los tres textos, para que el prompt pueda decir qué eligió el alumno aunque la rama no
    // dependa de eso. `(no especificado)` es el valor del hub, no una cadena vacía: un hueco vacío
    // en el prompt se lee como si el campo no existiera.
    _marketTxt: mercado !== SIN_ESPECIFICAR ? mercado : 'B2B (por defecto)',
    _socialproofTxt: proof,
    _formatTxt: formato,
  };
}

/**
 * Lo que la Landing hereda. Puerto del `DATA_GETTERS[6]` del hub.
 *
 * Es la herramienta que MÁS hereda de todas: las cuatro fuentes del Mapa más el guion del VSL. Y
 * el guion entra dos veces y por motivos distintos — una para la coherencia narrativa, y otra
 * recortado a sus dos secciones de compromiso, que son la fuente de verdad de lo que la página
 * puede pedir. Ver `compromisos.ts` para el defecto que eso previene.
 */
function datosDeLanding(valores: Record<string, string>, estado: EstadoDeFundaciones): DatosDePlantilla {
  const f = fuentes(estado);
  const partes: string[] = [];

  const docPerfil = ultimaVersion(estado, 0);
  if (docPerfil) {
    partes.push('PERFIL DE CLIENTE (el negocio del alumno):\n' + docPerfil.slice(0, 1500));
  }
  if (f.icp.presente) {
    partes.push(
      'AVATAR / TARJETA ESPEJO YA GENERADA (usa su situación actual para el bloque PROBLEMA, su ' +
        'situación deseada para el RESULTADO DESEADO, y sus objeciones para el FAQ; deriva de aquí ' +
        'testimonios creíbles del nicho):\n' + f.icp.completo.slice(0, 3000),
    );
  }
  if (f.categoria.presente) {
    partes.push(
      'CATEGORÍA ÚNICA / POSICIONAMIENTO (usa el nombre del Mecanismo Único como ' +
        'SOLUCIÓN/MECANISMO, y su ángulo para la OFERTA PRINCIPAL y el titular):\n' +
        f.categoria.completo.slice(0, 2500),
    );
  }
  if (f.oferta.presente) {
    partes.push(
      'OFERTA IRRESISTIBLE YA GENERADA (extrae la PROMESA MACRO para la OFERTA PRINCIPAL; usa los ' +
        'componentes del stack como base del ROADMAP en fases hacia el resultado, NO como lista de ' +
        'features):\n' + f.oferta.completo.slice(0, 2500),
    );
  }
  if (f.pricing.presente) {
    partes.push(
      'GARANTÍA / PRICING PROTOCOL (usa la garantía condicional para reducir riesgo en el FAQ — ' +
        'NUNCA reveles ninguna cifra de precio en la landing; este es un funnel de ' +
        'aplicación/llamada):\n' + f.pricing.completo.slice(0, 1500),
    );
  }

  const guion = ultimaVersion(estado, 5);
  if (guion) {
    partes.push(
      'GUIÓN DE VSL YA GENERADO (la landing acompaña este VSL — mantén coherencia de promesa, ' +
        'mecanismo y CTA con este guión):\n' + guion.slice(0, 2000),
    );
  }

  // El nicho, con la misma precedencia que el hub: el del avatar antes que el escrito acá. El campo
  // del formulario es el último recurso, no el primero: si el alumno ya definió su avatar, el nicho
  // de la página tiene que ser el mismo.
  const nicho = f.niche.presente
    ? f.niche.completo
    : presente(valores, 't7-niche')
      ? valor(valores, 't7-niche')
      : SIN_ESPECIFICAR;

  return {
    niche: nicho,
    _crossContext: partes.length > 0 ? partes.join('\n\n') : null,
    // `null` cuando el VSL no existe o es a cámara: el `SKILL.md` tiene una rama entera para ese
    // caso (`{{^_vslCommitments}}`), y ahí la página pide lo que corresponda sin contradecir nada.
    _vslCommitments: guion ? formatearCompromisos(extraerCompromisos(guion)) : null,
  };
}

function diagnosticoDeCategoria(valores: Record<string, string>, estado: EstadoDeFundaciones): string {
  const f = fuentes(estado);
  const partes: string[] = [];

  if (presente(valores, 't2cat-current')) {
    partes.push('CÓMO SE PRESENTA HOY (su "categoría"/etiqueta actual): ' + valor(valores, 't2cat-current'));
  }
  if (presente(valores, 't2cat-alternatives')) {
    partes.push(
      'ALTERNATIVAS COMPETITIVAS REALES (contra qué lo comparan sus clientes): ' +
        valor(valores, 't2cat-alternatives'),
    );
  }
  if (presente(valores, 't2cat-notworking')) {
    partes.push(
      'QUÉ NO ESTÁ FUNCIONANDO EN SU COMUNICACIÓN ACTUAL: ' + valor(valores, 't2cat-notworking'),
    );
  }
  if (f.niche.presente) partes.push('NICHO: ' + f.niche.completo);

  const p0 = estado.perfil[0];
  if (p0) {
    const etiquetas: readonly (readonly [string, string])[] = [
      ['biz', 'Negocio'],
      ['service', 'Servicio principal'],
      ['price', 'Ticket'],
      ['pain', 'Dolores del cliente'],
      ['result', 'Mejor resultado logrado'],
    ];
    const ficha = etiquetas
      .map(([clave, etiqueta]) => {
        const v = p0[clave];
        return v && v !== SIN_ESPECIFICAR ? `${etiqueta}: ${v}` : null;
      })
      .filter((x): x is string => x !== null)
      .join('\n');
    if (ficha) partes.push('PERFIL DEL NEGOCIO (del onboarding):\n' + ficha);
  }

  if (f.icp.presente) partes.push('ICP / AVATAR (base del diagnóstico):\n' + f.icp.completo);

  return partes.length > 0
    ? partes.join('\n\n')
    : '(el usuario no proporcionó datos: genera desde los frameworks, marca todos los supuestos y ' +
        'prioriza las preguntas abiertas al final)';
}

/** El adaptador de modo documento de Categoría Única. Literal, del hub. */
const MODO_DOCUMENTO_CATEGORIA = `

# MODO DOCUMENTO (ANULA LAS INSTRUCCIONES DE CONVERSACIÓN ANTERIORES)
Estás en modo de generación única, NO en una conversación. No hagas preguntas ni esperes respuestas. Ejecuta el diagnóstico (Etapas 1-4) internamente con los datos provistos abajo y entrega DIRECTAMENTE el ENTREGABLE FINAL de los 5 pasos del Category Architect, completo.
- Todo supuesto razonable que necesites hacer, márcalo inline como **[SUPUESTO]**.
- Si falta información clave, NO la inventes: cierra el documento con una sección "## Preguntas abiertas para afinar" (máximo 5 preguntas concretas para trabajar con tu coach en el Kickoff).

# FORMATO DE SALIDA (OBLIGATORIO)
Devuelve el documento en Markdown: un título con #, secciones con ##, subsecciones con ### si aplica, negritas para conceptos clave y listas con - donde aplique. No incluyas preámbulo ni cierres conversacionales.

# DATOS DEL NEGOCIO
`;

/**
 * El prompt completo de una herramienta.
 *
 * Lanza `MetodologiaIlegible` si el archivo no está: **no hay prompt suplente**. El hub sí tiene
 * uno —una copia embebida de cada metodología— y acá se decidió no portarlo, porque dos copias del
 * mismo prompt divergen en la primera corrección y el síntoma es un documento generado con la
 * metodología vieja, sin ningún error. Ver `docs/ETAPA-9.md`.
 */
export function armarPrompt(
  id: number,
  valores: Record<string, string>,
  estado: EstadoDeFundaciones,
): string {
  const metodologia = METODOLOGIA[id];
  if (!metodologia) throw new Error(`La herramienta ${id} no tiene metodología asignada`);
  const plantilla = leerPlantilla(metodologia);
  if (plantilla === null) throw new MetodologiaIlegible(metodologia);

  if (id === 2) {
    return plantilla + MODO_DOCUMENTO_CATEGORIA + diagnosticoDeCategoria(valores, estado);
  }

  const datos: DatosDePlantilla =
    id === 0
      ? datosDeFicha(valores)
      : id === 3
        ? datosDeIcp(valores, estado)
        : id === 4
          ? datosDeOferta(valores, estado)
          : id === 10
            ? datosDePricing(valores, estado)
            : id === 5
              ? datosDeVsl(valores, estado)
              : id === 6
                ? datosDeLanding(valores, estado)
                : datosDeMapa(valores, estado);

  return interpolar(plantilla, datos);
}

/**
 * El prompt de un paso del Research.
 *
 * `previas` son las salidas de los pasos anteriores, y llegan **explícitas**: el hub tuvo un
 * defecto exactamente acá —el encadenamiento leía el estado de React, que se actualiza de forma
 * asíncrona, y el paso 5 recibía la lista vacía interpolando `undefined` donde iban los pasos 1 a
 * 4—. La firma con la lista como argumento es lo que hace ese defecto inexpresable.
 */
export function armarPromptResearch(
  paso: number,
  inputs: Record<string, string>,
  previas: readonly string[],
): string {
  const metodologia = METODOLOGIA_RESEARCH[paso];
  if (!metodologia) throw new Error(`El Research no tiene un paso ${paso}`);
  const plantilla = leerPlantilla(metodologia);
  if (plantilla === null) throw new MetodologiaIlegible(metodologia);

  const contrato = inputs['contract'];
  return interpolar(plantilla, {
    niche: inputs['niche'] ? inputs['niche'] : SIN_ESPECIFICAR,
    buyers: inputs['buyers'] ? inputs['buyers'] : SIN_ESPECIFICAR,
    ltv: inputs['ltv'] ? inputs['ltv'] : SIN_ESPECIFICAR,
    // El condicional del paso 1 mira este valor: vacío significa "no pongas la línea del
    // contrato", no "pon la línea con un hueco".
    contract: contrato && contrato !== SIN_ESPECIFICAR ? contrato : '',
    experience: inputs['experience'] ? inputs['experience'] : SIN_ESPECIFICAR,
    _prev: previas,
  });
}

/**
 * ¿Este paso del Research se puede pedir todavía?
 *
 * El paso N interpola la salida del N-1. Pedirlo sin ella no falla: produce un prompt con un hueco
 * y un documento que parece bien. Por eso la comprobación está del lado del servidor y no solo en
 * la interfaz.
 */
export function pasoDeResearchListo(paso: number, previas: readonly string[]): boolean {
  if (paso === 0) return true;
  const anterior = previas[paso - 1];
  return !!anterior && anterior.trim().length > 0;
}
