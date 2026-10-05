'use client';

/* CONVERSACIONES, en la barra (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-51;
 * `docs/OTROS/agentes/fichas/F19-CONVERSACIONES.md`): los hilos propios con el cerebro, del más reciente al
 * más viejo, de cualquier origen —el Inicio o la caja del pie de una sección—.
 *
 * No le pide nada al servidor, como la barra entera (`pruebas/codigo/193-*`): lee los hilos que publica el
 * chat del Inicio (`lib/agentes/hilos-de-la-barra.ts`). Tocar uno abre el Inicio con ese hilo, por el
 * traspaso (`lib/agentes/traspaso.ts`); el Inicio lo toma aunque se monte después.
 *
 * Sin «＋» para adjuntar ni enlace para compartir (AG-51). Se borran en la conversación —en el Inicio, o en
 * el panel de la caja de su sección—, no acá: en una fila de la barra un «Borrar» queda a un clic de abrir.
 *
 * Están todas las que manda el servidor (las cincuenta más recientes, `listarHilos`): con un corte propio, los
 * hilos del Inicio que quedaban afuera no tenían ningún otro camino (lo encontró la revisión de AG7). */

import { irALaVista } from '../../lib/aios/shell.js';
import { pedirHiloDelInicio } from '../../lib/agentes/traspaso.ts';
import { usarHilosDeLaBarra } from '../../lib/agentes/hilos-de-la-barra.ts';

export default function ConversacionesDeLaBarra({ inicio }) {
  const hilos = usarHilosDeLaBarra();
  const mostrados = hilos ?? [];
  return (
    <div className="nb-conversaciones">
      <span className="nb-rotulo">CONVERSACIONES</span>
      {hilos === null ? null : mostrados.length === 0 ? (
        <span className="nb-vacio">Todavía no hay ninguna.</span>
      ) : (
        <ul className="nb-hilos">
          {mostrados.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="nb-hilo"
                title={h.titulo}
                onClick={() => {
                  pedirHiloDelInicio(h.id);
                  irALaVista(inicio.seccion);
                }}
              >
                {h.titulo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
