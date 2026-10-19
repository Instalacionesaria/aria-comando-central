/* La vista `negocios` — el tablero de Negocios (el nivel 3).
   ==========================================================================
   No viene de `aios-command-center_1.html`, así que no está en `scripts/paridad.mjs` (el mismo caso que `monitoreo` e
   `incidentes`). El envoltorio es el de `MonitoreoView.jsx`, y el `id="v-negocios"` tiene que coincidir con la clave
   de la sección: `lib/aios/shell.js` abre la pantalla por ese id.

   La barrera de verdad está en el servidor (`app/api/negocios/route.ts`): `negocios.ver`, que sólo tiene el
   superadministrador, y ser de la organización principal. */

import PanelDeNegocios from '../cartera/PanelDeNegocios';

export default function NegociosView({ activa }) {
  return (
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-negocios">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>Negocios</h2>
              <span className="cre-desc">Las empresas que atendemos y los clientes de cada una, de un vistazo</span>
            </div>
          </div>
        </div>
        <div className="cl-page">
          <PanelDeNegocios />
        </div>
      </div>
    </section>
  );
}
