/* La vista `auditoria` — la pantalla del técnico.
   ==========================================================================
   No viene de `aios-command-center_1.html`, así que **no está en `scripts/paridad.mjs`**: no hay
   contra qué compararla, y compararla contra un HTML donde no existe daría un rojo permanente —
   que no se arregla, se ignora, y con él se ignoran los demás. Es el mismo caso que `tools` y
   `monitoreo`.

   El envoltorio —`.view` > `.view-scroll cre-scroll` > `.cre-head`— se conserva porque es el que
   hace que la vista se comporte como las otras: el mismo scroll, el mismo encabezado, el mismo
   lugar. El `id="v-auditoria"` no es decorativo: `lib/aios/shell.js` abre una pantalla haciendo
   `document.getElementById('v-' + clave)`, así que un id que no coincida con la clave de la
   sección deja la entrada del menú sin responder, en silencio.

   ── QUIÉN LLEGA HASTA ACÁ ─────────────────────────────────────────────────

   Quien tenga `auditor.ver`. La entrada del menú la filtra `menuVisible`, y la barrera de verdad
   está en el servidor, en `app/api/auditoria/route.ts`. Esto es lo que el 03 § 7 llama comodidad y
   no seguridad: el menú sólo evita que la gente vea puertas que no puede abrir.

   Y a diferencia de `monitoreo`, **no lleva `soloDesdeLaPrincipal`**: esta pantalla muestra los
   agentes de la PROPIA empresa, no los de todas. Marcarla sería impedirle a un cliente ver los
   suyos. */

import PanelDeAuditoria from '../auditoria/PanelDeAuditoria';

export default function AuditoriaView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-auditoria">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l">
            <h2>Auditoría de agentes</h2>
            <span className="cre-desc">
              Qué patrones fallan en los agentes de IA, y con qué corregir su prompt
            </span>
          </div>
        </div>
        <PanelDeAuditoria />
      </div>
    </section>
  );
}
