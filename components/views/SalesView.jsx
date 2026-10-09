/* ═══════════════════════════════════════════════════════════════════════════════
 * SALES VUELVE AL FRONT DEL PROTOTIPO, CON LOS DATOS REALES (docs/sales/15, SA-3)
 *
 * Del 2026-09-21 al 2026-10-09 esta vista llevó la estética de operación (`estetica-op`) y un tablero propio:
 * la maqueta que había antes —portada de `aios-command-center_1.html:2931-2995`— dibujaba 23 cifras escritas
 * a mano que cerraban entre sí, una de ellas al lado del nombre de una persona real, y se reemplazó entera
 * (`docs/sales/03-LOS-CUATRO-KPI.md`). Con eso se perdió la forma que había pedido el product owner.
 *
 * Ahora vuelve la forma y se queda el dato: el panel dibuja el marcado del prototipo con lo que arma
 * `lecturaDeSales`, y la sección no lleva `estetica-op`, que era la capa que cambiaba el look (S15-01). El
 * envoltorio es el del prototipo, `view-scroll cre-scroll`; el encabezado lo dibuja el panel, como en
 * Acquisition y Conversion.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeSales from '../sales/PanelDeSales.jsx';

export default function SalesView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-sales">
      <div className="view-scroll cre-scroll">
        <PanelDeSales />
      </div>
    </section>
  );
}
