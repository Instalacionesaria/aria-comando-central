// El Plan de acción de Conversation, armado con plantillas (`docs/OTROS/agentes/fichas/F05-CONVERSATION.md`;
// `02`, AG-32 y AG-37). Puro.
//
// Un grupo por agente del CRM —LeadFlow y AppFlow, con los nombres de la pantalla (`NOMBRE_DEL_AGENTE`)—, y en
// cada uno sus patrones abiertos, lo más grave primero (rojo antes que amarillo) y, a igual gravedad, el que toca
// más conversaciones. La frase dice cuántas conversaciones, cuántas en rojo y de dónde parece venir el error
// (`issue_source`, en palabras). El auditor sigue proponiendo la corrección y una persona sigue aprobándola: el
// plan sólo dice qué revisar.

import type { ParaElPlan } from '../detectores/correr.ts';
import { CONV } from '../detectores/conversation.ts';
import { AGENTES, type Agente } from '../../auditor/veredicto.ts';
import { NOMBRE_DEL_AGENTE } from '../../auditor/vista.ts';
import type { Deteccion, IssueSource } from '../senales/tipos.ts';
import { armarPlan, numero, type FormatoDelPlan, type PlanDelDepartamento } from './comun.ts';

export const GRUPOS_DEL_PLAN_DE_CONVERSATION = AGENTES.map((a) => ({ clave: a, titulo: NOMBRE_DEL_AGENTE[a] }));

/** De dónde parece venir el error, en palabras: la taxonomía de Arq (AG-37). */
export const FUENTE_EN_PALABRAS: Readonly<Record<IssueSource, string>> = {
  prompt_design: 'parece venir de cómo está escrito el prompt',
  agent_execution: 'parece venir de cómo el agente sigue su prompt',
  missing_data: 'parece venir de un dato que le falta al agente',
  missing_tool: 'parece venir de una herramienta que el agente no tiene',
  workflow_configuration: 'parece venir de la configuración del flujo',
  external_failure: 'parece venir de una falla externa',
};

interface EvidenciaDelPatron {
  agente?: Agente;
  titulo?: string;
  rojos?: number;
}

export function textoDeConversation(d: Deteccion): string {
  const ev = (d.evidencia ?? {}) as EvidenciaDelPatron;
  const n = d.valorActual ?? 0;
  const rojos = ev.rojos ?? 0;
  const fuente = d.issueSource ? `; ${FUENTE_EN_PALABRAS[d.issueSource]}` : '';
  return `«${ev.titulo ?? 'Un patrón'}»: ${numero(n)} ${n === 1 ? 'conversación abierta' : 'conversaciones abiertas'}${rojos > 0 ? `, ${numero(rojos)} en rojo` : ''}${fuente}.`;
}

const NO_SE_MIDIO: Record<string, string> = {
  [CONV.patronAbierto]: 'los patrones del auditor: la tarea del auditor no está al día',
};

export const FORMATO_DE_CONVERSATION: FormatoDelPlan<Agente> = {
  departamento: 'conversation',
  grupos: GRUPOS_DEL_PLAN_DE_CONVERSATION,
  grupoDe: (d) => ((d.evidencia as EvidenciaDelPatron | null)?.agente ?? AGENTES[0]) as Agente,
  textoDe: textoDeConversation,
  noSeMidio: NO_SE_MIDIO,
  desempate: (d) => d.valorActual ?? 0,
};

export type PlanDeConversation = PlanDelDepartamento<Agente>;

export function armarPlanDeConversation(p: ParaElPlan): PlanDeConversation {
  return armarPlan(FORMATO_DE_CONVERSATION, p);
}
