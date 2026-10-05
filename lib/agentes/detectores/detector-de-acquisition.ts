// El detector de Acquisition tal como lo corre la pasada diaria (`./correr.ts`): mide, detecta con los
// umbrales vigentes de la empresa y arma el plan. Aparte de `./acquisition.ts` para que el plan
// (`../plan/acquisition.ts`) pueda importar las reglas sin un ciclo con la pasada.

import { armarPlanDeAcquisition, type PlanDeAcquisition } from '../plan/acquisition.ts';
import { redactarPlan } from '../plan/redaccion.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../senales/umbrales.ts';
import type { Detector } from './correr.ts';
import { detectarEnAcquisition, medirAcquisition } from './acquisition.ts';

export const DETECTOR_DE_ACQUISITION: Detector = {
  departamento: 'acquisition',
  nombre: 'acquisition',
  async detectar(c) {
    const medida = await medirAcquisition(c.ventana, c.zona);
    const umbral = (codigo: string) => {
      const regla = CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo);
      if (!regla) throw new Error(`acquisition: «${codigo}» no está en el catálogo`);
      return umbralVigente(regla, c.firmados);
    };
    return { ...detectarEnAcquisition(medida, umbral), periodo: medida.embudos.ventana };
  },
  armarPlan: armarPlanDeAcquisition,
  redactar: (plan, c) => redactarPlan({ plan: plan as PlanDeAcquisition, ...c }),
};
