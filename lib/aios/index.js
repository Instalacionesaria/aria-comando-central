/* Arranque de la capa imperativa portada del HTML original.
   Cada módulo es uno de los IIFE del <script>, en el mismo orden en que
   se ejecutaban ahí: el orden importa porque unos registran callbacks
   (window.AIOSDate._cbs, window.AIOSLeadCard, window.AIOSLeads) que otros usan. */

import { initDatePicker }      from './datepicker';
import { initShell }           from './shell';
import { initCreative }        from './creative';
import { initConversion }      from './conversion';
import { initLeadsPortal }     from './leads-portal';
import { initExecutive }       from './executive';
import { initExecutivePanel }  from './executive-panel';
import { initExecutiveChat }   from './executive-chat';
import { initAcquisition }     from './acquisition';
import { initAcquisitionPlan } from './acquisition-plan';
import { initPeriodControls }  from './period-controls';
import { initConversation }    from './conversation';
import { initLeadsGroup }      from './leads-group';

/* `initCloser` e `initCloserContact` SALIERON en la Etapa 11, y no fue una reorganización:
   esos dos módulos existían para pintar datos escritos a mano —nombres de personas, montos,
   un diagnóstico atribuido a la IA— y estuvieron en producción mostrándolos.

   Las pestañas Closer y Setter son React ahora y piden sus datos por `pedir()`, como `icp` y
   `credenciales`. Lo que el prototipo tenía de esas dos pantallas queda en el HTML original,
   que sigue siendo la referencia del port; lo que no queda es su contenido inventado. */
const MODULOS = [
  initDatePicker,
  initShell,
  initCreative,
  initConversion,
  initLeadsPortal,
  initExecutive,
  initExecutivePanel,
  initExecutiveChat,
  initAcquisition,
  initAcquisitionPlan,
  initPeriodControls,
  initConversation,
  initLeadsGroup,
];

/* Los módulos enganchan listeners en `document` y crean nodos sueltos en
   <body>, así que sólo pueden correr una vez por carga de página. El guard
   cubre el doble montaje de React StrictMode en desarrollo. */
let arrancado = false;

export function bootAios() {
  if (arrancado) return;
  arrancado = true;
  for (const init of MODULOS) {
    try {
      init();
    } catch (err) {
      console.error(`[aios] fallo al inicializar ${init.name}:`, err);
    }
  }
}
