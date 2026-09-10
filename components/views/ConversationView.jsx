/* La vista `conversation` — Conversation Intelligence.
   ==========================================================================
   Era el port del maquetado (`aios-command-center_1.html`, líneas 2865-2929) y su módulo
   imperativo `lib/aios/conversation.js`. Los dos se fueron; el porqué está abajo.

   El envoltorio —`.view` > `.view-scroll cre-scroll` > `.cre-head`— se conserva porque es el que
   hace que la vista se comporte como las otras: el mismo scroll, el mismo encabezado, el mismo
   lugar. El `id="v-conversation"` no es decorativo: `lib/aios/shell.js` abre una pantalla haciendo
   `document.getElementById('v-' + clave)`, así que un id que no coincida con la clave de la
   sección deja la entrada del menú sin responder, en silencio.

   ── SE BORRÓ EL MÓDULO DEL MAQUETADO, Y HAY QUE DECIR QUÉ SE LLEVÓ ────────

   `lib/aios/conversation.js` eran 559 líneas de las cuales unas 180 eran literales inventados: un
   embudo completo (`LEAD0`, `APPT0`, `ORIGEN0`), cuatro agentes con nombre de persona, tres filas
   de calidad de lead, quince líneas de diálogo de clientes que no existen, y seis «incidencias»
   con diagnósticos que imitaban a un supervisor de IA (*«En 14 de 22 llamadas…»*) más catorce
   líneas de prompt sugerido. Seis de sus diecinueve constantes estaban muertas — `FIXES` eran 33
   líneas que duplicaban `ISSUES` y nadie leía.

   Tres cosas que salieron con él y conviene tener nombradas:

     · el bloque **«Qué corregir · prompts, datos inválidos y conversaciones marcadas»** era
       funcionalmente lo mismo que hace el auditor de verdad. La aplicación tenía **dos
       supervisores, uno real y uno inventado**, y el inventado estaba en el departamento correcto;
     · el agente se llamaba **«Sofía»** y un diálogo saludaba a **«Rodrigo»**; **«landing BCL»**
       —iniciales de un cliente— aparecía en tres sitios;
     · el CRM del proveedor se nombraba en texto que se pinta (*«para pegar en GHL»*), que es lo
       que `pruebas/codigo/91-closer-y-setter.test.ts` prohíbe en el Closer *«porque lo van a ver
       clientes»*. Esa prueba excluía esta pantalla a propósito mientras no tuviera datos reales;
       con la mudanza deja de aplicar la excusa.

   Nada de eso se reemplazó por otra cifra: se reemplazó por qué falta para calcularla.

   ── QUIÉN LLEGA HASTA ACÁ ─────────────────────────────────────────────────

   Quien tenga `tablero.ver`, que es la capacidad de la sección. Las dos pestañas del supervisor
   piden además `auditor.ver` **en el servidor**, en `app/api/auditoria/`: el menú solo evita que
   la gente vea puertas que no puede abrir, y la barrera de verdad está en la ruta. */

import PanelDeConversation from '../conversation/PanelDeConversation.jsx';

export default function ConversationView({ activa }) {
  return (
    <section
      className={activa ? 'view on estetica-op' : 'view estetica-op'}
      id="v-conversation"
    >
      <div className="view-scroll cre-scroll">
        {/* El encabezado apilado: la estética de operación INVIERTE su peso —el `h2` pasa a rótulo
            de 9,5 px en mayúsculas y la bajada a titular de 24 px— y `.stack` con `.ch-title` son
            las dos clases que lo sostienen. */}
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>Conversation</h2>
              <span className="cre-desc">Cómo van los agentes que hablan con los contactos</span>
            </div>
          </div>
        </div>
        {/* El cuerpo en `.cl-page`, como en las otras: sin el envoltorio, el `gap: 24px` del
            scroller se aplica entre TODOS los bloques en vez de separar la cabecera del cuerpo una
            sola vez. */}
        <div className="cl-page">
          <PanelDeConversation />
        </div>
      </div>
    </section>
  );
}
