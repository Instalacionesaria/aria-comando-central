/* ═══════════════════════════════════════════════════════════════════════════════
 * LA VISTA `creative` — Creative Intelligence, con el front del prototipo (docs/creative/16, CF-3)
 *
 * Desde septiembre de 2026 hasta el 2026-10-11 esta vista llevó la estética de operación (`estetica-op`) y un
 * tablero propio: la cobertura del puente nombre↔anuncio, una tabla de gente por etapa, otra de la subasta, la fatiga
 * y la lista de lo que no se puede medir. Volvió al marcado de `aios-command-center_1.html:2746-2804`: el panel dibuja
 * el encabezado, la tira, «Ordenar por», los dos grupos y las tarjetas del prototipo con los datos de
 * `lecturaDeCreative`, y la sección no lleva `estetica-op`, que era la capa que cambiaba el look (CF1-01). Con eso,
 * `app/inteligencia-estetica.css` se quedó sin nadie que la usara y se borró.
 *
 * El `id="v-creative"` no es decorativo: `lib/aios/shell.js` abre una pantalla haciendo
 * `document.getElementById('v-' + clave)`, así que un id que no coincida con la clave de la sección deja la entrada
 * del menú sin responder, en silencio.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeCreative from '../creative/PanelDeCreative.jsx';

export default function CreativeView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-creative">
      <div className="view-scroll cre-scroll">
        <PanelDeCreative />
      </div>
    </section>
  );
}
