/* ═══════════════════════════════════════════════════════════════════════════════
 * VUELVE EL FRONT DEL PROTOTIPO, CON LOS DATOS REALES (AQ-4, 2026-09-30)
 *
 * El 2026-09-16 esta vista dejó de ser una maqueta con 58 cifras inventadas y pasó a dibujar el costo
 * por anuncio y el monitor de atribución, con la estética de operación (`estetica-op`). Era honesto y
 * perdía la forma que había pedido el product owner. El usuario pidió volver a esa forma —la de
 * `aios-command-center_1.html`, sección `#v-acquisition`, líneas 2679-2744— con la estética al 100 %
 * (docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md).
 *
 * Por eso la sección **no lleva `estetica-op`**: esa capa es la que cambió el look, y sin ella las
 * reglas del prototipo, que siguen en `app/aios.css`, vuelven a mandar (A14-01). Es el método de
 * Leads Portal (`ContactsView.jsx`). Todo lo que se dibuja —el encabezado incluido, porque el
 * segmentado de período es estado del panel— está en `PanelDeAcquisition`.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeAcquisition from '../acquisition/PanelDeAcquisition.jsx';

export default function AcquisitionView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-acquisition">
      <div className="view-scroll cre-scroll">
        <PanelDeAcquisition />
      </div>
    </section>
  );
}
