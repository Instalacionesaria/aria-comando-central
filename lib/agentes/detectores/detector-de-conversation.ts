// Conversation tal como la corre la pasada diaria (`./correr.ts`): lee los hallazgos del auditor y los traduce a
// señales. Aparte de `./conversation.ts` por lo mismo que los demás: el plan importa la regla sin un ciclo con la
// pasada.

import { armarPlanDeConversation, type PlanDeConversation } from '../plan/conversation.ts';
import { redactarPlan } from '../plan/redaccion.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../senales/umbrales.ts';
import type { Detector } from './correr.ts';
import { detectarEnConversation, medirConversation } from './conversation.ts';

export const DETECTOR_DE_CONVERSATION: Detector = {
  departamento: 'conversation',
  nombre: 'conversation',
  async detectar(c) {
    const medida = await medirConversation(c.ventana, c.ahora);
    const umbral = (codigo: string) => {
      const regla = CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo);
      if (!regla) throw new Error(`conversation: «${codigo}» no está en el catálogo`);
      return umbralVigente(regla, c.firmados);
    };
    return { ...detectarEnConversation(medida, umbral), periodo: medida.periodo };
  },
  armarPlan: armarPlanDeConversation,
  redactar: (plan, c) => redactarPlan({ plan: plan as PlanDeConversation, ...c }),
};
