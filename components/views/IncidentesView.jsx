/* La vista `incidentes` — el Panel de Incidentes.
   ==========================================================================
   No viene de `aios-command-center_1.html`, así que no está en `scripts/paridad.mjs` (el mismo caso
   que `monitoreo` y `tools`). El envoltorio es el de `MonitoreoView.jsx`, y el `id="v-incidentes"`
   tiene que coincidir con la clave de la sección: `lib/aios/shell.js` abre la pantalla por ese id.

   La barrera de verdad está en el servidor (`app/api/incidentes/route.ts`): `incidentes.ver`, que
   solo tiene el superadministrador, y ser de la organización principal. */

import PanelDeIncidentes from '../incidentes/PanelDeIncidentes';

export default function IncidentesView({ activa }) {
  return (
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-incidentes">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>Incidentes</h2>
              <span className="cre-desc">Lo que le falló a cada cuenta, antes de que te lo reporten</span>
            </div>
          </div>
        </div>
        <div className="cl-page">
          <PanelDeIncidentes />
        </div>
      </div>
    </section>
  );
}
