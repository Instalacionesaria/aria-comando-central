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
import { initCloser }          from './closer';
import { initCloserContact }   from './closer-contact';
import { initLeadsGroup }      from './leads-group';

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
  initCloser,
  initCloserContact,
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
