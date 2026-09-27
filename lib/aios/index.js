/* Arranque de la capa imperativa portada del HTML original.
   Cada módulo es uno de los IIFE del <script>, en el mismo orden en que
   se ejecutaban ahí: el orden importa porque unos registran callbacks
   (window.AIOSDate._cbs, window.AIOSLeads) que otros usan. */

import { initDatePicker }      from './datepicker';
import { initShell }           from './shell';
import { initExecutive }       from './executive';
import { initExecutivePanel }  from './executive-panel';
import { initExecutiveChat }   from './executive-chat';
import { initPeriodControls }  from './period-controls';
import { initLeadsGroup }      from './leads-group';

/* `initLeadsPortal` SALIÓ el 2026-09-26, con Leads Portal: dibujaba quince personas inventadas y
   publicaba `window.AIOSLeadCard`, que abría una ficha por NOMBRE y rellenaba con otra persona cuando
   no la encontraba. La pestaña pide ahora sus datos a `/api/leads-portal`, y la ficha se abre por id.

   `initConversion` SALIÓ el 2026-09-20, con la pantalla de Conversion. Eran 655 líneas que
   calculaban en el navegador cinco pasos de embudo sobre 530 literales inventados. La pestaña
   ahora pide sus datos por `pedir()` a `/api/conversion`, como Acquisition y Creative.

   `initCloser` e `initCloserContact` SALIERON en la Etapa 11, y no fue una reorganización:
   esos dos módulos existían para pintar datos escritos a mano —nombres de personas, montos,
   un diagnóstico atribuido a la IA— y estuvieron en producción mostrándolos.

   Las pestañas Closer y Setter son React ahora y piden sus datos por `pedir()`, como `icp` y
   `credenciales`. Lo que el prototipo tenía de esas dos pantallas queda en el HTML original,
   que sigue siendo la referencia del port; lo que no queda es su contenido inventado. */
const MODULOS = [
  initDatePicker,
  initShell,
  initExecutive,
  initExecutivePanel,
  initExecutiveChat,
  initPeriodControls,
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
