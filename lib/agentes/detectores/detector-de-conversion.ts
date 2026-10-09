// El detector de Conversion tal como lo corre la pasada diaria (`./correr.ts`). Aparte de `./conversion.ts` por lo
// mismo que los demás: el plan importa las reglas sin un ciclo con la pasada.

import { armarPlanDeConversion, type PlanDeConversion } from '../plan/conversion.ts';
import { redactarPlan } from '../plan/redaccion.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../senales/umbrales.ts';
import type { Detector } from './correr.ts';
import { detectarEnConversion, medirConversion } from './conversion.ts';

export const DETECTOR_DE_CONVERSION: Detector = {
  departamento: 'conversion',
  nombre: 'conversion',
  async detectar(c) {
    const medida = await medirConversion(c.ventana, c.zona);
    const umbral = (codigo: string) => {
      const regla = CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo);
      if (!regla) throw new Error(`conversion: «${codigo}» no está en el catálogo`);
      return umbralVigente(regla, c.firmados);
    };
    return { ...detectarEnConversion(medida, umbral), periodo: medida.periodo };
  },
  armarPlan: armarPlanDeConversion,
  redactar: (plan, c) => redactarPlan({ plan: plan as PlanDeConversion, ...c }),
};
