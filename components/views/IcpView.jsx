/* La vista `icp` — ICP & Oferta.
   ==========================================================================
   Era el placeholder "Pendiente de construir" portado del prototipo (líneas 2998-3021
   de `aios-command-center_1.html`). La Etapa 9 la llenó con las siete primeras
   herramientas de Fundaciones, traídas de ARIA-brain.

   ── CONSECUENCIA QUE HAY QUE SABER ANTES DE MIRAR `npm run paridad` ───────

   Esta vista **ya no coincide con el prototipo, a propósito**, así que salió de la lista
   `VISTAS` de `scripts/paridad.mjs`. Es la primera que sale. La compuerta de paridad
   sigue comparando las otras nueve, y ahí está su valor: el día que se reactifique
   otra, la comparación tiene que seguir siendo confiable para las que no cambiaron.
   El razonamiento completo está en `docs/ETAPA-9.md`.

   El envoltorio —`.view` > `.view-scroll cre-scroll` > `.cre-head`— sí se conserva,
   porque es el que hace que la vista se comporte como las otras nueve: el mismo
   scroll, el mismo encabezado, el mismo lugar. */

import Fundaciones from '../fundaciones/Fundaciones';

export default function IcpView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-icp">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l">
            <h2>ICP &amp; Oferta</h2>
            <span className="cre-desc">
              Tu cliente ideal y tu oferta, y cómo evolucionan con los datos reales
            </span>
          </div>
        </div>
        <Fundaciones />
      </div>
    </section>
  );
}
