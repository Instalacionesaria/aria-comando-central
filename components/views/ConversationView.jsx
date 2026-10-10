/* ═══════════════════════════════════════════════════════════════════════════════
 * LA VISTA `conversation` — Conversation Intelligence, con el front del prototipo (docs/conversation/01, CN-3)
 *
 * Desde septiembre de 2026 (`833fc51`, `f0f09b7`) hasta el 2026-10-10 esta vista llevó la estética de operación
 * (`estetica-op`) y un panel de cuatro pestañas —Lead Flow, Appointment Flow, Auditoría y Prompts— con las notas
 * de cada cifra detrás de un ícono. Volvió al
 * marcado de `aios-command-center_1.html:2865-2929`: el panel dibuja el encabezado con sus modos, los tres
 * paneles y las tarjetas del prototipo con los datos de `lecturaDeConversation`, y la sección no lleva
 * `estetica-op`, que era la capa que cambiaba el look (CN1-01). Auditoría y Prompts siguen con esa estética: el
 * panel los dibuja dentro de un contenedor que la trae (CN1-13).
 *
 * El `id="v-conversation"` no es decorativo: `lib/aios/shell.js` abre una pantalla haciendo
 * `document.getElementById('v-' + clave)`, así que un id que no coincida con la clave de la sección deja la
 * entrada del menú sin responder, en silencio.
 *
 * Quién llega hasta acá: quien tenga `auditor.ver`, la capacidad de la sección (`lib/autorizacion/secciones.ts`),
 * que es la misma que pide la lectura en `app/api/auditoria/`; editar un prompt pide además `auditor.editar`. El
 * menú sólo evita que la gente vea puertas que no puede abrir: la barrera de verdad está en la ruta.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeConversation from '../conversation/PanelDeConversation.jsx';

export default function ConversationView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-conversation">
      <div className="view-scroll cre-scroll">
        <PanelDeConversation />
      </div>
    </section>
  );
}
