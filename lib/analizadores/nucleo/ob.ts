// ── NÚCLEO PORTADO DE ARIA BRAIN · los identificadores siguen en inglés a propósito ──
// Son el contrato con el modelo (los nombres de campo del esquema van en el prompt) y con el JSON
// guardado en el historial copiado: traducirlos cambiaría los prompts. Ver docs/ANALIZADORES.md.
// Origen: aria-ia-brain lib/analyzer/ob.ts, copiado byte a byte. Única edición: `.ts` en los imports.
//
// Analizador OB (onboarding). Rúbrica portada VERBATIM de
// platform2/src/agent/rubric.es.md; schema portado a mano de src/agent/schema.ts
// (OnboardingSchema) como objeto JSON Schema (sin zod). El brain reutiliza esto.
import {
  asArrObj,
  asArrStr,
  asBool,
  asEnum,
  asNum,
  asObj,
  asStr,
  asStrOrNull,
  type AnalyzerDef,
  type ListColumns,
} from './defs.ts';

// ── Tipo del perfil (portado de OnboardingSchema; lo consume OnboardingView) ──
export interface ObParticipant {
  name: string;
  email?: string | null;
  role?: string | null;
  isPrimary: boolean;
}
export interface ObActionItem {
  task: string;
  owner: 'CLIENTE' | 'ARIA' | 'AMBOS';
  dueDate?: string | null;
}
export interface ObKeyMoment {
  startSec: number;
  endSec: number;
  label: string;
  quote: string;
}
export interface Onboarding {
  clientEmail: string;
  primaryName: string;
  company?: string | null;
  participants: ObParticipant[];
  country?: string | null;
  targetMarkets: string[];
  businessBackground: string;
  agencyExperience: 'NINGUNA' | 'ALGUNA' | 'EXPERIMENTADO';
  currentClientsOrResults: string[];
  currentOfferPricing?: string | null;
  goHighLevelLevel: 'NINGUNO' | 'BASICO' | 'INTERMEDIO' | 'AVANZADO';
  adsExperience: 'NINGUNA' | 'ALGUNA' | 'EXPERIMENTADO';
  aiToolsExperience?: string | null;
  techComfort: string;
  technicalPersonName?: string | null;
  nicheDefined: boolean;
  candidateNiches: string[];
  chosenNiche?: string | null;
  idealCustomer?: string | null;
  nichePains: string[];
  mainGoal: string;
  timeline?: string | null;
  whyNow?: string | null;
  scalabilityNeeds?: string | null;
  setup: {
    slack: 'OK' | 'PENDIENTE' | 'NO';
    school: 'OK' | 'PENDIENTE' | 'NO';
    goHighLevel: 'PROPIA' | 'AFILIADO' | 'TRIAL' | 'SUBCUENTA_ARIA' | 'NINGUNA';
    otherTools: string[];
  };
  concerns: string[];
  objections: string[];
  riskFlags: string[];
  personality: string;
  commitmentLevel: 'ALTO' | 'MEDIO' | 'BAJO';
  decisionMakerNotes?: string | null;
  actionItems: ObActionItem[];
  infoPendingFromClient: string[];
  nextStep?: string | null;
  onboardingStage?: string | null;
  captured: string[];
  missing: string[];
  blockers: string[];
  readiness: 'LISTO' | 'PARCIAL' | 'BLOQUEADO';
  summary: string;
  keyMoments: ObKeyMoment[];
}

const RUBRIC_OB = `# QUIÉN ERES
Eres un analista que revisa llamadas de ONBOARDING de ARIA (la llamada de arranque después de que
un cliente compró el programa). Tu único trabajo es ENTENDER y ESTRUCTURAR toda la información
del cliente (la persona/empresa a la que se le hace el onboarding). NO evalúas ni puntúas a quien
dirige la llamada. Te basas SOLO en la transcripción; no inventas nada.

# CÓMO ESCRIBIR
Para que cualquiera lo entienda: frases cortas, lenguaje cotidiano, sin jerga. Si usas un término
técnico (GoHighLevel, snapshot, funnel, ICP…), explícalo en pocas palabras la primera vez. Sé
concreto, no vago: no digas "tiene experiencia", di en qué se nota y con qué evidencia.

# QUÉ ES UN BUEN INSIGHT
No solo describas. Un insight útil dice: qué se sabe del cliente, por qué importa para arrancar
bien, y qué conviene hacer o preguntar en la próxima llamada. Ejemplo débil: "no sabe usar la
herramienta". Ejemplo fuerte: "Es fuerte en captación de inmuebles pero le da miedo GoHighLevel;
en la próxima llamada conviene apoyarse en su socio técnico y darle material grabado para que no
se bloquee en lo técnico."

# QUÉ EXTRAER (rellena el JSON de OnboardingSchema)
- Identidad y participantes: quién es el dueño (titular, su email es el identificador) y quién más
  está (socios, equipo). Empresa, país, mercados a los que quiere llegar.
- Background: qué hace/hacía, si tiene experiencia de agencia, clientes y resultados actuales
  (con números si los dice), su oferta/precio actual.
- Nivel técnico: qué tan cómodo está con GoHighLevel, anuncios e IA. Quién lleva lo técnico.
- Nicho objetivo: si ya lo tiene definido o no; nichos candidatos; cliente ideal; dolores del nicho.
- Objetivos: su meta principal, plazo, por qué ahora, y qué necesita para que sea escalable.
- Estado de accesos: Slack, School (comunidad de videos), cuenta de GoHighLevel (propia/afiliado/
  prueba/subcuenta de ARIA/ninguna), otras herramientas que ya usa.
- Preocupaciones, objeciones y señales de riesgo.
- Perfil y nivel de compromiso; quién toma las decisiones.
- Próximos pasos: tareas asignadas (con responsable y fecha si se dijo), info que el cliente debe
  enviar, y cuál es el siguiente paso del programa.
- Estado del onboarding: qué quedó claro, qué falta, qué bloquea, y si está LISTO / PARCIAL /
  BLOQUEADO para avanzar a la siguiente fase.

# SOBRE EL IDENTIFICADOR (clientEmail) Y LOS PARTICIPANTES
- Identifica en la transcripción quién es el DUEÑO/TITULAR del programa (marca su participant con
  isPrimary=true). Los demás presentes del lado cliente (socios, equipo) van también en participants
  con isPrimary=false.
- Si en la transcripción se dice explícitamente el correo del titular, ponlo en clientEmail; si no,
  deja clientEmail como cadena vacía "": el sistema lo completará con lo que el usuario haya escrito.

# REGLAS DURAS
- Solo la transcripción. Evidencia con timestamps SOLO en keyMoments (no en el texto narrativo).
- Si la transcripción está incompleta, indícalo en el summary.
- El summary y las observaciones, en español claro y fácil de leer.
- Devuelve ÚNICAMENTE el JSON de OnboardingSchema, sin texto extra ni markdown.`;

const enumSlots = (values: string[]) => ({ type: 'string', enum: values });

const OB_JSON_SCHEMA = {
  type: 'object',
  properties: {
    clientEmail: { type: 'string', description: 'Email del titular si se dijo; si no, "".' },
    primaryName: { type: 'string' },
    company: { type: ['string', 'null'] },
    participants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: ['string', 'null'] },
          role: { type: ['string', 'null'] },
          isPrimary: { type: 'boolean' },
        },
        required: ['name', 'isPrimary'],
      },
    },
    country: { type: ['string', 'null'] },
    targetMarkets: { type: 'array', items: { type: 'string' } },
    businessBackground: { type: 'string' },
    agencyExperience: enumSlots(['NINGUNA', 'ALGUNA', 'EXPERIMENTADO']),
    currentClientsOrResults: { type: 'array', items: { type: 'string' } },
    currentOfferPricing: { type: ['string', 'null'] },
    goHighLevelLevel: enumSlots(['NINGUNO', 'BASICO', 'INTERMEDIO', 'AVANZADO']),
    adsExperience: enumSlots(['NINGUNA', 'ALGUNA', 'EXPERIMENTADO']),
    aiToolsExperience: { type: ['string', 'null'] },
    techComfort: { type: 'string' },
    technicalPersonName: { type: ['string', 'null'] },
    nicheDefined: { type: 'boolean' },
    candidateNiches: { type: 'array', items: { type: 'string' } },
    chosenNiche: { type: ['string', 'null'] },
    idealCustomer: { type: ['string', 'null'] },
    nichePains: { type: 'array', items: { type: 'string' } },
    mainGoal: { type: 'string' },
    timeline: { type: ['string', 'null'] },
    whyNow: { type: ['string', 'null'] },
    scalabilityNeeds: { type: ['string', 'null'] },
    setup: {
      type: 'object',
      properties: {
        slack: enumSlots(['OK', 'PENDIENTE', 'NO']),
        school: enumSlots(['OK', 'PENDIENTE', 'NO']),
        goHighLevel: enumSlots(['PROPIA', 'AFILIADO', 'TRIAL', 'SUBCUENTA_ARIA', 'NINGUNA']),
        otherTools: { type: 'array', items: { type: 'string' } },
      },
      required: ['slack', 'school', 'goHighLevel', 'otherTools'],
    },
    concerns: { type: 'array', items: { type: 'string' } },
    objections: { type: 'array', items: { type: 'string' } },
    riskFlags: { type: 'array', items: { type: 'string' } },
    personality: { type: 'string' },
    commitmentLevel: enumSlots(['ALTO', 'MEDIO', 'BAJO']),
    decisionMakerNotes: { type: ['string', 'null'] },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task: { type: 'string' },
          owner: enumSlots(['CLIENTE', 'ARIA', 'AMBOS']),
          dueDate: { type: ['string', 'null'] },
        },
        required: ['task', 'owner'],
      },
    },
    infoPendingFromClient: { type: 'array', items: { type: 'string' } },
    nextStep: { type: ['string', 'null'] },
    onboardingStage: { type: ['string', 'null'] },
    captured: { type: 'array', items: { type: 'string' } },
    missing: { type: 'array', items: { type: 'string' } },
    blockers: { type: 'array', items: { type: 'string' } },
    readiness: enumSlots(['LISTO', 'PARCIAL', 'BLOQUEADO']),
    summary: { type: 'string' },
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
    'clientEmail',
    'primaryName',
    'participants',
    'targetMarkets',
    'businessBackground',
    'agencyExperience',
    'currentClientsOrResults',
    'goHighLevelLevel',
    'adsExperience',
    'techComfort',
    'nicheDefined',
    'candidateNiches',
    'nichePains',
    'mainGoal',
    'setup',
    'concerns',
    'objections',
    'riskFlags',
    'personality',
    'commitmentLevel',
    'actionItems',
    'infoPendingFromClient',
    'captured',
    'missing',
    'blockers',
    'readiness',
    'summary',
    'keyMoments',
  ],
};

function normalizeOb(o: Record<string, unknown>): Onboarding {
  const setup = asObj(o.setup);
  return {
    clientEmail: asStr(o.clientEmail),
    primaryName: asStr(o.primaryName),
    company: asStrOrNull(o.company),
    participants: asArrObj(o.participants).map((p) => ({
      name: asStr(p.name),
      email: asStrOrNull(p.email),
      role: asStrOrNull(p.role),
      isPrimary: asBool(p.isPrimary),
    })),
    country: asStrOrNull(o.country),
    targetMarkets: asArrStr(o.targetMarkets),
    businessBackground: asStr(o.businessBackground),
    agencyExperience: asEnum(o.agencyExperience, ['NINGUNA', 'ALGUNA', 'EXPERIMENTADO'], 'NINGUNA') as Onboarding['agencyExperience'],
    currentClientsOrResults: asArrStr(o.currentClientsOrResults),
    currentOfferPricing: asStrOrNull(o.currentOfferPricing),
    goHighLevelLevel: asEnum(o.goHighLevelLevel, ['NINGUNO', 'BASICO', 'INTERMEDIO', 'AVANZADO'], 'NINGUNO') as Onboarding['goHighLevelLevel'],
    adsExperience: asEnum(o.adsExperience, ['NINGUNA', 'ALGUNA', 'EXPERIMENTADO'], 'NINGUNA') as Onboarding['adsExperience'],
    aiToolsExperience: asStrOrNull(o.aiToolsExperience),
    techComfort: asStr(o.techComfort),
    technicalPersonName: asStrOrNull(o.technicalPersonName),
    nicheDefined: asBool(o.nicheDefined),
    candidateNiches: asArrStr(o.candidateNiches),
    chosenNiche: asStrOrNull(o.chosenNiche),
    idealCustomer: asStrOrNull(o.idealCustomer),
    nichePains: asArrStr(o.nichePains),
    mainGoal: asStr(o.mainGoal),
    timeline: asStrOrNull(o.timeline),
    whyNow: asStrOrNull(o.whyNow),
    scalabilityNeeds: asStrOrNull(o.scalabilityNeeds),
    setup: {
      slack: asEnum(setup.slack, ['OK', 'PENDIENTE', 'NO'], 'NO') as Onboarding['setup']['slack'],
      school: asEnum(setup.school, ['OK', 'PENDIENTE', 'NO'], 'NO') as Onboarding['setup']['school'],
      goHighLevel: asEnum(setup.goHighLevel, ['PROPIA', 'AFILIADO', 'TRIAL', 'SUBCUENTA_ARIA', 'NINGUNA'], 'NINGUNA') as Onboarding['setup']['goHighLevel'],
      otherTools: asArrStr(setup.otherTools),
    },
    concerns: asArrStr(o.concerns),
    objections: asArrStr(o.objections),
    riskFlags: asArrStr(o.riskFlags),
    personality: asStr(o.personality),
    commitmentLevel: asEnum(o.commitmentLevel, ['ALTO', 'MEDIO', 'BAJO'], 'MEDIO') as Onboarding['commitmentLevel'],
    decisionMakerNotes: asStrOrNull(o.decisionMakerNotes),
    actionItems: asArrObj(o.actionItems).map((a) => ({
      task: asStr(a.task),
      owner: asEnum(a.owner, ['CLIENTE', 'ARIA', 'AMBOS'], 'CLIENTE') as ObActionItem['owner'],
      dueDate: asStrOrNull(a.dueDate),
    })),
    infoPendingFromClient: asArrStr(o.infoPendingFromClient),
    nextStep: asStrOrNull(o.nextStep),
    onboardingStage: asStrOrNull(o.onboardingStage),
    captured: asArrStr(o.captured),
    missing: asArrStr(o.missing),
    blockers: asArrStr(o.blockers),
    readiness: asEnum(o.readiness, ['LISTO', 'PARCIAL', 'BLOQUEADO'], 'PARCIAL') as Onboarding['readiness'],
    summary: asStr(o.summary),
    keyMoments: asArrObj(o.keyMoments).map((k) => ({
      startSec: asNum(k.startSec),
      endSec: asNum(k.endSec),
      label: asStr(k.label),
      quote: asStr(k.quote),
    })),
  };
}

export const OB_DEF: AnalyzerDef = {
  tipo: 'OB',
  rubricVersion: 'rubric.es.md@OB',
  label: 'onboarding',
  isDescription:
    'una llamada de ONBOARDING de ARIA: la llamada de arranque/acompañamiento DESPUÉS de que el cliente ya compró el programa, donde se le ayuda a arrancar (conocerlo, definir o afinar nicho/oferta, revisar accesos, fijar objetivos y próximos pasos)',
  isNotExamples:
    'una llamada de VENTA o cierre a un prospecto que aún no compró, una reunión interna de equipo, una llamada de soporte puntual, una sesión de coaching genérico, una charla casual, una clase o webinar',
  rubric: RUBRIC_OB,
  jsonSchema: OB_JSON_SCHEMA,
  normalize: (o) => normalizeOb(o),
  listColumns: (analysis): ListColumns => {
    const p = analysis as Onboarding;
    return { readiness: p.readiness ?? null, summary: p.summary ?? null };
  },
};
