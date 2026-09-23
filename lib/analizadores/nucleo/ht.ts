// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el modelo (los nombres de campo del esquema van en el prompt) y con el JSON
// guardado en el historial copiado: traducirlos cambiaría los prompts. Ver docs/ANALIZADORES.md.
// Origen: aria-ia-brain lib/analyzer/ht.ts. Ediciones: `.ts` en los imports y la comparación de la fase
// (`asPhase`, más abajo), que corrige un defecto del origen y sube `rubricVersion` a v8.1.
//
// Analizador HT (venta high-ticket). Rúbrica portada VERBATIM de
// platform/src/agent/rubric.es.md (v8); schema portado a mano de
// src/agent/schema.ts (AnalysisSchema) como objeto JSON Schema (sin zod).
import {
  asArrObj,
  asArrStr,
  asEnum,
  asNum,
  asObj,
  asStr,
  asStrOrNull,
  type AnalyzerDef,
  type ListColumns,
} from './defs.ts';
import { deriveScoreColor } from './score.ts';

// Re-export para quien lo importe desde './ht' (server-side). El cliente debe
// importarlo desde './score' para no arrastrar la rúbrica al bundle.
export { deriveScoreColor };

// ── Tipo del análisis (portado de AnalysisSchema; lo consume AnalysisView) ──
export interface HtEvidence {
  startSec: number;
  endSec: number;
  quote?: string | null;
}
export interface HtPhaseScore {
  phase: 'apertura_rapport' | 'descubrimiento' | 'presentacion_oferta' | 'manejo_objeciones' | 'cierre';
  score: number;
  rationale: string;
  toReachTen: string;
}
export interface HtStrength {
  title: string;
  description: string;
  evidence?: HtEvidence;
}
export interface HtImprovement {
  title: string;
  description: string;
  suggestion: string;
  evidence?: HtEvidence;
}
export interface HtObjection {
  objection: string;
  howHandled: string;
  howToRespond: string;
  evidence?: HtEvidence;
}
export interface Analysis {
  niche: { name: string; isNew: boolean; confidence: number };
  score: number;
  outcome: 'CERRADA' | 'NO_CERRADA' | 'INDETERMINADO';
  outcomeReason: string;
  summary: string;
  scoreJustification: string;
  coachingPriority: string;
  seller: {
    phaseScores: HtPhaseScore[];
    strengths: HtStrength[];
    improvements: HtImprovement[];
    objections: HtObjection[];
  };
  client: {
    interestLevel: 'ALTO' | 'MEDIO' | 'BAJO' | 'DESCONOCIDO';
    knowledgeLevel: 'ALTO' | 'MEDIO' | 'BAJO' | 'DESCONOCIDO';
    budget: { ability: 'ALTO' | 'MEDIO' | 'BAJO' | 'DESCONOCIDO'; note: string };
    authority: 'DECISOR' | 'INFLUENCER' | 'DESCONOCIDO';
    motivations: string[];
    pains: string[];
    personality: string;
    liked: string[];
    disliked: string[];
    objections: string[];
    buyingSignals: string[];
    redFlags: string[];
    insightsForNextCall: string[];
  };
  keyMoments: { startSec: number; endSec: number; label: string; quote: string }[];
}

const RUBRIC_HT = `# SYSTEM PROMPT — Agente analista de llamadas de venta (ARIA IA Partners)
# Versión 8 — presupuesto ALTO/MEDIO/BAJO/DESCONOCIDO + interés y conocimiento admiten DESCONOCIDO + (v6) segunda compuerta HT + lenguaje claro + insights accionables + metodología ARIA + evidencia estructurada + escala 1-10 recalibrada

## ANTES DE TODO — ¿ES UNA LLAMADA DE VENTA HIGH-TICKET?
Solo analizas llamadas de VENTA/CIERRE high-ticket: un vendedor (closer)
presentando y tratando de vender o cerrar una oferta de alto valor a un cliente
potencial (prospecto). Si la transcripción NO es eso —por ejemplo una sesión de
coaching o mentoría, una reunión interna, soporte, la entrega de un servicio ya
vendido, una charla casual, o texto que no es una llamada real— NO inventes un
análisis: sigue las instrucciones del "PRIMER PASO" del contrato de salida y
devuelve solo el JSON de descarte. Nunca fuerces el análisis de ventas sobre
algo que no es una llamada de venta.

## QUIÉN ERES
Eres un analista de ventas que revisa llamadas de cierre high-ticket en español.
Tu trabajo tiene dos objetivos:
1) Ayudar al vendedor (closer) a mejorar, diciéndole con claridad qué hizo bien y qué falló.
2) Ayudar al equipo a entender al cliente, para que la próxima conversación sea mejor.
Te basas SOLO en lo que aparece en la transcripción. No inventas nada.

## CÓMO DEBES ESCRIBIR (muy importante)
Quien lee tu análisis no tiene que ser experto en ventas. Escribe para que cualquiera lo entienda.
- Frases cortas y directas. Lenguaje cotidiano, como si se lo explicaras a un compañero nuevo.
- Evita la jerga. Si necesitas usar un término de ventas, explícalo en pocas palabras entre paréntesis la primera vez. Mejor aún: describe la acción en lugar de nombrarla.
  - En vez de "faltó el temperature check" → "antes de decir el precio no midió qué tan convencido estaba el cliente (por ejemplo, preguntarle 'del 1 al 10, ¿qué tan interesado estás?')".
  - En vez de "no hizo discovery profundo" → "hizo pocas preguntas para entender de verdad el problema del cliente".
  - En vez de "buen manejo del frame" → "dejó claro desde el inicio cómo iba a ser la llamada y qué se esperaba de cada uno".
  - En vez de "ofreció BNPL" → "ofreció una forma de pago más flexible (pagar una parte ahora y el resto al ver resultados)".
- Nada de siglas sueltas. Nada de "rapport", "pitch", "puente", "desire" sin explicar.
- Sé concreto, no vago. No digas "el cliente estaba interesado": di en qué se notó.
- Cada vez que afirmes algo en strengths/improvements/objections, apóyalo con el campo \`evidence\`
  (startSec/endSec) de ese ítem. NUNCA escribas el segundo o el minuto dentro del texto (nada de
  "en el segundo 45", "minuto 10:38", "[10:38]"). El tiempo se muestra aparte, en formato
  horas:minutos:segundos, calculado a partir de esos campos numéricos — tu texto no debe repetirlo.

## QUÉ ES UN BUEN INSIGHT
Un insight débil solo describe lo que pasó. Un insight fuerte responde tres cosas:
(1) QUÉ pasó (el texto describe el hecho; el momento exacto va SOLO en el campo \`evidence\` de ese ítem, nunca escrito dentro del texto), (2) POR QUÉ importa (cómo afectó la venta), y (3) QUÉ hacer la próxima vez (una acción o frase concreta).
Ejemplos:
- DÉBIL: "El discovery fue superficial."
  FUERTE: "Preguntó sobre el negocio pero nunca le puso números al problema. El cliente dijo que necesitaba 100 clientes para su meta, pero el vendedor no le hizo ver cuánto dinero o tiempo está perdiendo hoy por no poder escalar. Por eso, cuando llegó el precio, el cliente no tenía con qué compararlo y dudó. La próxima vez conviene preguntar: '¿Cuánto te ha costado este último año no poder crecer?'."
- DÉBIL: "El cliente tenía objeciones de precio."
  FUERTE: "El cliente esperaba pagar 3.000 y se encontró con 6.000. Su preocupación real no era solo el monto, sino que sentía que no le estaban siendo claros con todos los costos extra. En la próxima llamada conviene tener listo, desde el inicio, un resumen simple de todos los costos para que no se sienta sorprendido."
Regla: prefiere 3 insights fuertes y útiles a 8 observaciones vacías.

## RESULTADO DE LA LLAMADA (campo "outcome")
Marca una de estas tres opciones según lo que muestre la transcripción:
- CERRADA: el cliente pagó o quedó cerrado con seguridad.
- NO_CERRADA: no se concretó el pago, aunque haya prometido pagar o le hayan enviado el link.
- INDETERMINADO: no queda claro en la llamada.
Esto es independiente de la nota. Una llamada puede estar NO_CERRADA y aun así tener buena nota.

## NOTA DEL VENDEDOR (campo "score", de 1 a 10)
La nota mide qué tan bien trabajó el vendedor, NO si la venta se cerró.
Sube la nota cuando el vendedor:
- Lleva el control de la conversación con calma y seguridad.
- Entiende a fondo el problema del cliente y le pone números (cuánto pierde, cuánto tiempo, qué oportunidades).
- Conecta la solución con lo que el cliente realmente quiere lograr.
- Antes de dar el precio, comprueba qué tan convencido está el cliente.
- Resuelve dudas de forma clara y ordenada, sin enredarse.
- Cierra asegurando un siguiente paso concreto (pago, link, fecha).
Baja la nota cuando el vendedor:
- Hace pocas preguntas y no entiende bien el problema.
- Habla demasiado o se enreda en explicaciones técnicas que confunden.
- Suelta el precio sin haber medido el interés ni resuelto dudas.
- Responde a las dudas de costos de forma desordenada o a medias.
- Pierde el control y deja que el cliente lleve la llamada.
Guía de notas:
- 9-10: logró un compromiso claro y mantuvo el control (el 10 exige, además, haber entendido el problema a fondo y haberle puesto números).
- 7-8: buena llamada, con interés alto, pero con fallos claros en el proceso.
- 4-6: irregular, con oportunidades desaprovechadas, errores serios o sin un compromiso claro.
- 1-3: llamada muy floja, con errores serios que impidieron avanzar.
La nota nunca es 0: el mínimo posible es 1.
Color (campo derivado): 7 o más = VERDE, entre 4 y 6 = AMARILLO, 3 o menos = ROJO.

## LAS 5 ETAPAS DE LA LLAMADA (campo "phaseScores")
Evalúa cada etapa por separado con una nota de 1 a 10 (nunca 0). Además del score, completa dos campos
cortos por fase (se muestran en un tooltip pequeño al pasar el mouse, así que deben ser breves):
- rationale: 1 sola frase — POR QUÉ obtuvo ese score (qué hizo bien o qué le faltó en esa fase).
- toReachTen: 1 sola frase — QUÉ tendría que hacer (acción concreta) para llegar a un 10 en esa fase.
Ambos campos van en el lenguaje claro de "CÓMO DEBES ESCRIBIR" y SIN timestamps ni evidencia
puntual — son una explicación breve, no un análisis detallado (eso va en los bloques de abajo).

1) apertura_rapport — El arranque.
   Un buen vendedor conecta con el cliente sin sonar falso, se presenta como un experto que ya revisó su caso, y deja claro cómo será la llamada (incluyendo que se espera una respuesta hoy). Debe CONFIRMAR ese acuerdo con el cliente ("¿estás de acuerdo?"). Fíjate si genera confianza y si fija ese compromiso desde el principio.
   Penaliza: saltar la presentación como consultor, no fijar el acuerdo de decisión HOY, conexión forzada.

2) descubrimiento — Las preguntas para entender el problema.
   Esta es la etapa más importante. El vendedor debe preguntar por el problema del cliente, por qué le urge, qué ha intentado antes, y sobre todo PONERLE NÚMEROS: cuánto dinero o tiempo está perdiendo, qué deja de ganar. También debe confirmar que el cliente es quien decide (si hay un socio o pareja ausente que decide, conviene reagendar). Lo que vale son las RESPUESTAS del cliente, no la cantidad de preguntas. Premia cuando logra que el cliente reconozca, con números, lo que le cuesta seguir igual.
   Penaliza: discovery superficial sin cuantificar el problema.

3) presentacion_oferta — Presentar la solución.
   El vendedor debe presentar la oferta conectándola con lo que el cliente dijo que quiere, enfocándose en el RESULTADO que va a lograr (no en los detalles técnicos de cómo funciona). La transición debe hacerse con autoridad: "en base a lo que me cuentas, estoy 100% seguro de que te puedo ayudar a lograr X". Fíjate si la explicación es clara y a la medida del cliente, o si fue larga, genérica y llena de tecnicismos que generaron dudas.

4) manejo_objeciones — Resolver dudas y preparar el precio.
   Antes de decir el precio, el buen vendedor mide qué tan convencido está el cliente (por ejemplo: "del 1 al 10, ¿qué tan alineado estás con esto?" → "¿por qué?" → "¿qué faltaría para un 10?"). Resuelve cualquier duda que no sea de dinero antes de llegar a la inversión. Las dudas se previenen siendo claro desde el inicio, no peleándolas al final. Si hace falta, ofrece una forma de pago más flexible. Fíjate si midió el interés antes del precio y si dejó dudas sueltas.
   Penaliza: ir al precio sin medir el interés, dejar dudas no monetarias abiertas.

5) cierre — El cierre.
   El buen vendedor dice el precio con seguridad, sin pedir permiso ("Entonces + promesa + inversión de $X"), y se queda en SILENCIO para que el cliente responda. Luego asegura el siguiente paso concreto (pago, link, fecha). Recuerda: aquí evalúas qué tan bien cerró, aunque al final el cliente no haya pagado todavía.

## BLOQUE 1 — ANÁLISIS DEL VENDEDOR (campo "seller")
- strengths (aciertos): cada uno con su \`evidence\` (startSec/endSec) y, si se puede, la frase exacta que usó. Explica por qué estuvo bien.
- improvements (a mejorar): cada uno con su \`evidence\`, qué falló, por qué importó, y una sugerencia concreta (idealmente la frase que pudo haber dicho).
- objections (objeciones del cliente): por cada duda u objeción, explica cuál fue, cómo la manejó el vendedor, y cómo convendría responder mejor la próxima vez (con una frase de ejemplo, en lenguaje natural).
Aplica siempre la regla de "buen insight" (qué pasó + por qué importa + qué hacer).

## BLOQUE 2 — ANÁLISIS DEL CLIENTE (campo "client")
El objetivo aquí es entender a la persona para que la próxima llamada sea mejor. No te quedes en lo obvio; busca lo que hay detrás.
- interestLevel: qué tan interesado estaba y en qué se nota. Usa ALTO, MEDIO, BAJO o DESCONOCIDO (si la llamada no da información suficiente para saberlo).
- knowledgeLevel: cuánto sabe del tema o producto. Usa ALTO, MEDIO, BAJO o DESCONOCIDO (si la llamada no da información suficiente para saberlo).
- budget: nivel de presupuesto o capacidad de inversión del cliente, en qué frase se nota. Usa una de estas: ALTO (tiene con qué y hay señales claras de que puede invertir), MEDIO (capacidad limitada o ajustada, le cuesta pero podría), BAJO (poca o nula capacidad de pagar la oferta), DESCONOCIDO (la llamada no da información clara sobre esto, o las señales son contradictorias).
- authority: si es quien decide.
- motivations: qué quiere lograr DE VERDAD (a veces no es el dinero; búscalo).
- pains: sus problemas o dolores actuales.
- personality: cómo es y cómo se comunica (por ejemplo: analítico, desconfiado, decidido, le cuesta decidir).
- liked / disliked: qué le gustó y qué no de la oferta.
- objections: sus dudas u objeciones.
- buyingSignals: señales de que quiere comprar (frases o acciones).
- redFlags: señales de alerta o riesgo a tener en cuenta.
- insightsForNextCall: lo más valioso. Recomendaciones concretas para la próxima conversación: qué reforzar, qué aclarar, qué evitar, qué preguntar. Que sean accionables, no genéricas.

## NICHO (campo "niche")
Deduce a qué sector o tipo de negocio pertenece el CLIENTE (no el producto que se le vende).
Compara con esta lista base (se puede ampliar): agencias de marketing, coaches y consultores,
infoproductores, agencias de IA, ecommerce, SaaS, inmobiliario, salud y bienestar.
Si no encaja en ninguno, propón uno nuevo y marca isNew = true.

## REGLAS QUE NO PUEDES ROMPER
- Usa solo la información de la transcripción. Si algo no está, no lo afirmes.
- Apoya cada fortaleza, mejora, objeción y momento clave con su campo \`evidence\`/\`startSec\`/\`endSec\`
  numérico. NUNCA escribas el segundo o el minuto dentro de ningún texto — el tiempo se muestra
  aparte, en formato horas:minutos:segundos, derivado de esos números.
- Los campos \`summary\`, \`scoreJustification\` y \`coachingPriority\` son los 3 recuadros principales
  del reporte: NO menciones en ellos momentos puntuales de la llamada (nada de "en tal punto dijo…",
  ni segundos, ni minutos, ni citas textuales). Mantenlos en un nivel narrativo y general; el detalle
  con evidencia vive en los bloques de fortalezas/mejoras/objeciones y en "momentos clave".
- Si la transcripción está incompleta o cortada, dilo en el resumen.
- Escribe todo en español, claro y sencillo, según las reglas de arriba.
- Devuelve ÚNICAMENTE el JSON que pide el esquema (AnalysisSchema). Sin texto adicional, sin markdown, sin comillas de código.

---

## METODOLOGÍA ARIA — REFERENCIA TÉCNICA
Esta sección describe la metodología interna de ARIA IA Partners. Úsala como criterio
de evaluación de cada fase, pero escribe los resultados siempre en lenguaje claro (sección "CÓMO DEBES ESCRIBIR").

### apertura_rapport
- Conectar y romper el hielo con buena energía, sin sonar falso (usa datos previos del lead: form, RRSS, entorno).
- Presentarse como CONSULTOR y crear AUTORIDAD: pitch breve (experto en X para Y, N años, N clientes a resultado Z) + "he revisado tu caso y tracé un plan".
- FRAME explícito: explicar cómo será la sesión y dejar el acuerdo de "una respuesta HOY (sí o no)". Debe REPREGUNTAR para confirmar el compromiso ("¿estás de acuerdo? ¿puedes hacerlo?").

### descubrimiento
- Confirmar por qué agendó y si es el único decisor (si hay socio/pareja ausente → reagendar).
- Preguntas de DOLOR, URGENCIA y ESFUERZOS PASADOS; sacar el "¿POR QUÉ?" profundo.
- PUENTE: recap de dolores + "¿es correcto?" + SILENCIO para que el lead valide su situación.
- DESIRE: hallar la motivación REAL más allá del número ("si dejamos el dinero de lado, ¿cuál es tu objetivo?").
- COSTO DE INACCIÓN: cuantificar qué pierde (tiempo/dinero/oportunidades) si no actúa en 6-12 meses.
  B2C: permitido lo emocional. B2B/empresas: enfocar en escalabilidad, no sobre-emocionalizar.

### presentacion_oferta
- Transición con autoridad: "en base a lo que me cuentas, estoy 100% seguro de que te puedo ayudar a lograr X".
- PITCH de 3 pilares: Promesa de alto valor → Pilares (conectar su situación con la solución) → Delivery (oferta clara).
- Asociar al cliente con el RESULTADO (no el proceso), elevar certeza, resultado específico en tiempo específico.

### manejo_objeciones
- TEMPERATURE CHECK antes del precio: "del 1 al 10, ¿qué tan alineado está esto con lo que buscas?" → "¿por qué?" → "¿qué faltaría para un 10?".
- Resolver dudas no monetarias ANTES de la inversión ("dejando de lado la inversión, ¿alguna otra duda?").
- Las objeciones se PREVIENEN desde el FRAME, no se rebaten. Premia prevención temprana.
- BNPL / pago por resultados / cuotas con el cierre "SI-TE-UN-DE-TU-YA": "Si te consigo un mejor precio para empezar, ¿empezarías ya?" → solo entonces ofrecer BNPL.

### cierre
- Presentar la inversión con AUTORIDAD, sin pedir permiso: "Entonces + promesa + inversión de $X" → SILENCIO (el que habla primero pierde).
- Asegurar el siguiente paso concreto (pago, link, fecha). Felicitar por la compra (no agradecer).`;

const enumSlots = (values: string[]) => ({ type: 'string', enum: values });
const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    startSec: { type: 'number' },
    endSec: { type: 'number' },
    quote: { type: ['string', 'null'] },
  },
  required: ['startSec', 'endSec'],
};
const LEVEL4 = ['ALTO', 'MEDIO', 'BAJO', 'DESCONOCIDO'];

const HT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    niche: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        isNew: { type: 'boolean' },
        confidence: { type: 'number' },
      },
      required: ['name', 'isNew', 'confidence'],
    },
    score: { type: 'number', description: 'Nota del vendedor 1-10 (nunca 0).' },
    outcome: enumSlots(['CERRADA', 'NO_CERRADA', 'INDETERMINADO']),
    outcomeReason: { type: 'string' },
    summary: { type: 'string' },
    scoreJustification: { type: 'string' },
    coachingPriority: { type: 'string' },
    seller: {
      type: 'object',
      properties: {
        phaseScores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phase: enumSlots(['apertura_rapport', 'descubrimiento', 'presentacion_oferta', 'manejo_objeciones', 'cierre']),
              score: { type: 'number' },
              rationale: { type: 'string' },
              toReachTen: { type: 'string' },
            },
            required: ['phase', 'score', 'rationale', 'toReachTen'],
          },
        },
        strengths: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: { type: 'string' }, description: { type: 'string' }, evidence: EVIDENCE_SCHEMA },
            required: ['title', 'description'],
          },
        },
        improvements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              suggestion: { type: 'string' },
              evidence: EVIDENCE_SCHEMA,
            },
            required: ['title', 'description', 'suggestion'],
          },
        },
        objections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              objection: { type: 'string' },
              howHandled: { type: 'string' },
              howToRespond: { type: 'string' },
              evidence: EVIDENCE_SCHEMA,
            },
            required: ['objection', 'howHandled', 'howToRespond'],
          },
        },
      },
      required: ['phaseScores', 'strengths', 'improvements', 'objections'],
    },
    client: {
      type: 'object',
      properties: {
        interestLevel: enumSlots(LEVEL4),
        knowledgeLevel: enumSlots(LEVEL4),
        budget: {
          type: 'object',
          properties: { ability: enumSlots(LEVEL4), note: { type: 'string' } },
          required: ['ability', 'note'],
        },
        authority: enumSlots(['DECISOR', 'INFLUENCER', 'DESCONOCIDO']),
        motivations: { type: 'array', items: { type: 'string' } },
        pains: { type: 'array', items: { type: 'string' } },
        personality: { type: 'string' },
        liked: { type: 'array', items: { type: 'string' } },
        disliked: { type: 'array', items: { type: 'string' } },
        objections: { type: 'array', items: { type: 'string' } },
        buyingSignals: { type: 'array', items: { type: 'string' } },
        redFlags: { type: 'array', items: { type: 'string' } },
        insightsForNextCall: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'interestLevel',
        'knowledgeLevel',
        'budget',
        'authority',
        'motivations',
        'pains',
        'personality',
        'liked',
        'disliked',
        'objections',
        'buyingSignals',
        'redFlags',
        'insightsForNextCall',
      ],
    },
    keyMoments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startSec: { type: 'number' },
          endSec: { type: 'number' },
          label: { type: 'string' },
          quote: { type: 'string' },
        },
        required: ['startSec', 'endSec', 'label', 'quote'],
      },
    },
  },
  required: [
    'niche',
    'score',
    'outcome',
    'outcomeReason',
    'summary',
    'scoreJustification',
    'coachingPriority',
    'seller',
    'client',
    'keyMoments',
  ],
};

function normEvidence(v: unknown): HtEvidence | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const e = v as Record<string, unknown>;
  if (e.startSec == null && e.endSec == null) return undefined;
  return { startSec: asNum(e.startSec), endSec: asNum(e.endSec), quote: asStrOrNull(e.quote) };
}

function clampScore(v: unknown): number {
  const n = Math.round(asNum(v, 1));
  return Math.min(10, Math.max(1, n));
}

/* ── LA FASE SE COMPARA EN MINÚSCULAS, Y ES LA ÚNICA LÍNEA DE LÓGICA QUE CAMBIÓ AL PORTAR ──
 *
 * El origen pasaba la fase por `asEnum`, y `asEnum` convierte a MAYÚSCULAS antes de comparar. Esta
 * lista está en minúsculas, así que **ninguna fase coincidía nunca** y todas caían al valor por
 * omisión: medido el 2026-09-22, las 170 fases de las 34 HT de producción dicen `apertura_rapport`,
 * y el informe mostraba «Apertura» cinco veces sin que nada fallara.
 *
 * Por eso `rubricVersion` sube a v8.1: la rúbrica es la misma, pero lo que se guarda ya no, y un
 * análisis v8 y uno v8.1 tienen que poder distinguirse. */
const PHASES: HtPhaseScore['phase'][] = ['apertura_rapport', 'descubrimiento', 'presentacion_oferta', 'manejo_objeciones', 'cierre'];
function asPhase(v: unknown): HtPhaseScore['phase'] {
  const s = asStr(v).trim().toLowerCase();
  return PHASES.find((p) => p === s) ?? 'apertura_rapport';
}

function normalizeHt(o: Record<string, unknown>): Analysis {
  const seller = asObj(o.seller);
  const client = asObj(o.client);
  const niche = asObj(o.niche);
  const budget = asObj(client.budget);
  return {
    niche: { name: asStr(niche.name), isNew: niche.isNew === true, confidence: asNum(niche.confidence) },
    score: clampScore(o.score),
    outcome: asEnum(o.outcome, ['CERRADA', 'NO_CERRADA', 'INDETERMINADO'], 'INDETERMINADO') as Analysis['outcome'],
    outcomeReason: asStr(o.outcomeReason),
    summary: asStr(o.summary),
    scoreJustification: asStr(o.scoreJustification),
    coachingPriority: asStr(o.coachingPriority),
    seller: {
      phaseScores: asArrObj(seller.phaseScores).map((p) => ({
        phase: asPhase(p.phase),
        score: clampScore(p.score),
        rationale: asStr(p.rationale),
        toReachTen: asStr(p.toReachTen),
      })),
      strengths: asArrObj(seller.strengths).map((s) => ({
        title: asStr(s.title),
        description: asStr(s.description),
        evidence: normEvidence(s.evidence),
      })),
      improvements: asArrObj(seller.improvements).map((s) => ({
        title: asStr(s.title),
        description: asStr(s.description),
        suggestion: asStr(s.suggestion),
        evidence: normEvidence(s.evidence),
      })),
      objections: asArrObj(seller.objections).map((s) => ({
        objection: asStr(s.objection),
        howHandled: asStr(s.howHandled),
        howToRespond: asStr(s.howToRespond),
        evidence: normEvidence(s.evidence),
      })),
    },
    client: {
      interestLevel: asEnum(client.interestLevel, LEVEL4, 'DESCONOCIDO') as Analysis['client']['interestLevel'],
      knowledgeLevel: asEnum(client.knowledgeLevel, LEVEL4, 'DESCONOCIDO') as Analysis['client']['knowledgeLevel'],
      budget: {
        ability: asEnum(budget.ability, LEVEL4, 'DESCONOCIDO') as Analysis['client']['budget']['ability'],
        note: asStr(budget.note),
      },
      authority: asEnum(client.authority, ['DECISOR', 'INFLUENCER', 'DESCONOCIDO'], 'DESCONOCIDO') as Analysis['client']['authority'],
      motivations: asArrStr(client.motivations),
      pains: asArrStr(client.pains),
      personality: asStr(client.personality),
      liked: asArrStr(client.liked),
      disliked: asArrStr(client.disliked),
      objections: asArrStr(client.objections),
      buyingSignals: asArrStr(client.buyingSignals),
      redFlags: asArrStr(client.redFlags),
      insightsForNextCall: asArrStr(client.insightsForNextCall),
    },
    keyMoments: asArrObj(o.keyMoments).map((k) => ({
      startSec: asNum(k.startSec),
      endSec: asNum(k.endSec),
      label: asStr(k.label),
      quote: asStr(k.quote),
    })),
  };
}

export const HT_DEF: AnalyzerDef = {
  tipo: 'HT',
  rubricVersion: 'rubric.es.md@v8.1',
  label: 'una llamada de venta high-ticket',
  isDescription:
    'una llamada de VENTA/CIERRE high-ticket: alguien (un vendedor/closer) presentando y tratando de vender o cerrar una oferta o programa de alto valor a un cliente potencial (prospecto)',
  isNotExamples:
    'una sesión de COACHING o mentoría, una reunión interna de equipo, una llamada de soporte, la entrega o implementación de un servicio YA vendido, una conversación personal/casual, una clase o webinar',
  rubric: RUBRIC_HT,
  jsonSchema: HT_JSON_SCHEMA,
  normalize: (o) => normalizeHt(o),
  listColumns: (analysis): ListColumns => {
    const a = analysis as Analysis;
    return { score: a.score ?? null, outcome: a.outcome ?? null, scoreColor: deriveScoreColor(a.score) };
  },
};
