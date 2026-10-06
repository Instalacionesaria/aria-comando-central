'use client';

/* La Reunión de hoy, en la barra (`docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-75;
 * `docs/OTROS/agentes/fichas/F17-LA-REUNION-DE-HOY.md`): un botón que lleva al Inicio, donde están las
 * tarjetas, con el número de temas de HOY que esa persona ve.
 *
 * No le pide nada al servidor, como la barra entera (`pruebas/codigo/193-*`): el número lo publica el Inicio
 * cada vez que lee su panel (`lib/agentes/hilos-de-la-barra.ts`). Sin número —todavía no se leyó, o hoy no
 * hay temas suyos— no se dibuja contador: un cero no dice nada que la falta del número no diga.
 *
 * Tocarla pide una conversación nueva, como «Nueva conversación»: las tarjetas se ven en el Inicio sin una
 * conversación abierta. */

import { irALaVista } from '../../lib/aios/shell.js';
import { pedirHiloDelInicio } from '../../lib/agentes/traspaso.ts';
import { usarTemasDeHoy } from '../../lib/agentes/hilos-de-la-barra.ts';

export default function ReunionDeLaBarra({ inicio }) {
  const temas = usarTemasDeHoy();
  const hay = typeof temas === 'number' && temas > 0;
  return (
    <button
      type="button"
      className="nb-reunion"
      aria-label={hay ? `Reunión de hoy: ${temas === 1 ? 'un tema' : `${temas} temas`}` : undefined}
      onClick={() => {
        pedirHiloDelInicio(null);
        irALaVista(inicio.seccion);
      }}
    >
      <svg className="nb-ico" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4 12H2M22 12h-2" />
      </svg>
      <span className="n">Reunión de hoy</span>
      {hay ? (
        <span className="nb-contador" aria-hidden="true">
          {temas}
        </span>
      ) : null}
    </button>
  );
}
