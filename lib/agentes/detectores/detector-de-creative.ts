// El detector de Creative Insights tal como lo corre la pasada diaria (`./correr.ts`). Aparte de `./creative.ts`
// por lo mismo que el de Acquisition: el plan importa las reglas sin un ciclo con la pasada.

import { armarPlanDeCreative, type PlanDeCreative } from '../plan/creative.ts';
import { redactarPlan } from '../plan/redaccion.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../senales/umbrales.ts';
import type { Detector } from './correr.ts';
import { detectarEnCreative, medirCreative } from './creative.ts';

export const DETECTOR_DE_CREATIVE: Detector = {
  departamento: 'creative',
  nombre: 'creative',
  async detectar(c) {
    const medida = await medirCreative(c.ventana);
    const umbral = (codigo: string) => {
      const regla = CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo);
      if (!regla) throw new Error(`creative: «${codigo}» no está en el catálogo`);
      return umbralVigente(regla, c.firmados);
    };
    return { ...detectarEnCreative(medida, umbral), periodo: medida.periodo };
  },
  armarPlan: armarPlanDeCreative,
  redactar: (plan, c) => redactarPlan({ plan: plan as PlanDeCreative, ...c }),
};
