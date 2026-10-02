/* La vista `icp` — ICP & Oferta.
   ==========================================================================
   Era el placeholder "Pendiente de construir" portado del prototipo (líneas 2998-3021
   de `aios-command-center_1.html`). La Etapa 9 la llenó con las siete primeras
   herramientas de Fundaciones, traídas de ARIA-brain.

   ── LA CONSECUENCIA PARA `npm run paridad` ───────────────────────────────

   Esta vista **ya no coincide con el prototipo, a propósito**, así que salió de la lista
   `VISTAS` de `scripts/paridad.mjs`. Fue la primera en salir; las otras nueve la siguieron,
   y el 2026-10-01 la compuerta quedó retirada (nueva estructura, E7). Su valor era que, al
   reactificar una, la comparación siguiera siendo confiable para las que no cambiaban.
   El razonamiento completo está en `docs/OTROS/capa-base/ETAPA-9.md`.

   El envoltorio —`.view` > `.view-scroll cre-scroll` > `.cre-head`— sí se conserva,
   porque es el que hace que la vista se comporte como las otras nueve: el mismo
   scroll, el mismo encabezado, el mismo lugar. */

import Fundaciones from '../fundaciones/Fundaciones';

export default function IcpView({ activa }) {
  return (
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-icp">
      <div className="view-scroll cre-scroll">
        {/* El encabezado apilado y el cuerpo en `.cl-page`: las tres clases que la estética
            de operación necesita en el marcado. Sin `.stack` y `.ch-title` el encabezado no se
            invierte —el `h2` tiene que pasar a rótulo y la bajada a titular— y sin `.cl-page` el
            `gap` del scroller se reparte entre todos los bloques. */}
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>ICP &amp; Oferta</h2>
              <span className="cre-desc">
                Tu cliente ideal y tu oferta, y cómo evolucionan con los datos reales
              </span>
            </div>
          </div>
        </div>
        <div className="cl-page">
          <Fundaciones />
        </div>
      </div>
    </section>
  );
}
