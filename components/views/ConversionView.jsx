/* ═══════════════════════════════════════════════════════════════════════════════
 * VUELVE EL FRONT DEL PROTOTIPO, CON LOS DATOS REALES (CV-4, 2026-10-09)
 *
 * El 2026-09-20 esta vista dejó de ser una maqueta con cifras inventadas —cinco pasos de embudo calculados
 * en el navegador sobre seis números multiplicados por un factor de período— y pasó a dibujar el reparto de
 * la cohorte por camino de entrada, con la estética de operación (`estetica-op`). Era honesto y perdía la
 * forma que había pedido el product owner. El usuario pidió volver a esa forma —la de
 * `aios-command-center_1.html`, sección `#v-conversion`, líneas 2806-2862— con la estética al 100 % y los
 * datos reales (docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md).
 *
 * Por eso la sección **no lleva `estetica-op`**: esa capa es la que cambió el look, y sin ella las reglas del
 * prototipo, que siguen en `app/aios.css`, vuelven a mandar (CV15-01). Es el método de Acquisition
 * (`AcquisitionView.jsx`). `cv-wrap` es el envoltorio del prototipo, y todo lo que va adentro —el encabezado
 * incluido, porque el segmentado de período es estado del panel— está en `PanelDeConversion`.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeConversion from '../conversion/PanelDeConversion.jsx';

export default function ConversionView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-conversion">
      <div className="view-scroll cre-scroll">
        <div className="cv-wrap">
          <PanelDeConversion />
        </div>
      </div>
    </section>
  );
}
