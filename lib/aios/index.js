/* Arranque de la capa imperativa portada del HTML original.
   Queda UN módulo: el armazón (`./shell`), que abre las pantallas y maneja el menú del teléfono.
   Todo lo demás de la capa imperativa ya es React o se fue con su maqueta. */

import { initShell } from './shell';

/* La maqueta del Executive SALIÓ el 2026-10-01, con el Inicio de la nueva estructura
   (`docs/OTROS/nueva-estructura/04-EL-INICIO.md`, `NE-30`). Eran seis módulos: `executive`,
   `executive-panel` y `executive-chat` —cifras escritas a mano y un chat que elegía entre respuestas
   fijas por palabras clave—, `leads-group` (el cajón «Grupo de contactos», que sólo abría el embudo
   de la maqueta), y `datepicker` y `period-controls`, que sólo servían a una píldora de período
   escondida. Con ellos se fue el orden que este archivo tenía que respetar: unos registraban
   `window.AIOSDate._cbs` y `window.AIOSLeads`, y otros los usaban.

   `initLeadsPortal` SALIÓ el 2026-09-26, con Leads Portal: dibujaba quince personas inventadas y
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
const MODULOS = [initShell];

/* El armazón engancha oyentes en `document` (el `Escape` del menú del teléfono), así que sólo
   puede correr una vez por carga de página. El guard cubre el doble montaje de React StrictMode
   en desarrollo. */
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
