/* La vista `monitoreo` — el Panel de Monitoreo.
   ==========================================================================
   No viene de `aios-command-center_1.html`, así que **no está en `scripts/paridad.mjs`**: no hay
   contra qué compararla, y compararla contra un HTML donde no existe daría un rojo permanente —
   que no se arregla, se ignora, y con él se ignoran los demás. Es el mismo caso que `tools`.

   El envoltorio —`.view` > `.view-scroll cre-scroll` > `.cre-head`— se conserva porque es el que
   hace que la vista se comporte como las otras: el mismo scroll, el mismo encabezado, el mismo
   lugar. El `id="v-monitoreo"` no es decorativo: `lib/aios/shell.js` abre una pantalla haciendo
   `document.getElementById('v-' + clave)`, así que un id que no coincida con la clave de la
   sección deja la entrada del menú sin responder, en silencio.

   ── QUIÉN LLEGA HASTA ACÁ ─────────────────────────────────────────────────

   Sólo gente de ARIA. La entrada del menú la filtra `menuVisible`, que corta por la capacidad
   `monitoreo.ver` **y** por `soloDesdeLaPrincipal`; y la barrera de verdad está en el servidor,
   en `app/api/monitoreo/route.ts`. Esto es lo que el 03 § 7 llama comodidad y no seguridad: el
   menú sólo evita que la gente vea puertas que no puede abrir. */

import PanelDeMonitoreo from '../monitoreo/PanelDeMonitoreo';

export default function MonitoreoView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-monitoreo">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l">
            <h2>Panel de Monitoreo</h2>
            <span className="cre-desc">
              Cuántos scrapeos hizo cada empresa y con qué scraper
            </span>
          </div>
        </div>
        <PanelDeMonitoreo />
      </div>
    </section>
  );
}
