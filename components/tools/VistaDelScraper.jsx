'use client';

/* La pestaña Scraper de Tools (`NE-20`): el buscador de leads, solo, con la tabla de lo que trae.
 *
 * En la estructura nueva el Scraper es de Research y la Prospección en frío de Sales. El buscador ya
 * era un componente aparte (`Scraper.jsx`), así que esta vista lo envuelve sin copiar nada: las
 * fuentes, las validaciones, el sondeo y la retoma de un escaneo en vuelo siguen en un solo lugar.
 * Prospección lo sigue usando igual, con el nicho que hereda de ICP.
 *
 * ── LO QUE NO TRAE, Y POR QUÉ ────────────────────────────────────────────
 *
 *   · el nicho de ICP: la vista recibe lo mismo que el Espía, su vecino en Research (`puedeEditar`),
 *     y nada del estado de Fundaciones;
 *   · la franja del saldo: la dibuja `ToolsView.jsx` arriba de esta pestaña y de Prospección, las dos
 *     que la gastan, así que acá no se repite;
 *   · un sondeo propio: lo hace el buscador, y `pruebas/codigo/123-relojes.test.ts` no admite otro.
 *
 * Sin `tools.editar` el buscador no se dibuja, como en el Espía, y el aviso va en la misma tarjeta:
 * sus botones gastan leads de un monedero con saldo real. Hereda del Espía también una deuda: la
 * vista recibe sólo `puedeEditar`, que es falso también cuando falló la lectura del estado de Tools,
 * y entonces el aviso culpa al rol (`docs/OTROS/estado actual/15-TOOLS-Y-MONITOREO.md`). */
import { useState } from 'react';

import { lugarDe } from '../../lib/autorizacion/departamentos.ts';
import Scraper, { TablaDeLeads } from './Scraper';

// Dónde quedan los leads, dicho como la navegación: Mis Leads se mudó a Sales en la segunda edición (`NE-52`).
const LOS_LEADS = lugarDe('tools', 'mis-leads') ?? 'la lista de leads';

export default function VistaDelScraper({ puedeEditar }) {
  const [leads, setLeads] = useState([]);

  return (
    <div className="cl-page">
      <div className="fd-cab">
        <h3>Scraper</h3>
        <span className="fd-bajada">
          Extraé leads de Google Maps, Facebook y LinkedIn. Lo que traen las corridas queda también en{' '}
          {LOS_LEADS}.
        </span>
      </div>

      {puedeEditar ? (
        /* `setLeads` directo y no una flecha: los efectos del buscador dependen de `onLeads`, y una
           función nueva en cada dibujo los vuelve a disparar (ver `SIN_LEADS` en `Scraper.jsx`). */
        <Scraper nicho="" onLeads={setLeads} />
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="fd-aviso">
              <i>◍</i>
              <span>
                Tu rol puede <b>ver</b> esta pantalla pero no lanzar búsquedas.
              </span>
            </div>
          </div>
        </div>
      )}

      {leads.length > 0 ? (
        <div className="pr-resultados">
          <TablaDeLeads leads={leads} />
        </div>
      ) : null}
    </div>
  );
}
