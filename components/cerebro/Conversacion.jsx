'use client';

/* Los turnos de una conversación con el cerebro: la del Inicio y la del panel de la caja del pie
 * (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-51 y AG-55).
 *
 * La pregunta que se está respondiendo se dibuja aparte (`pendiente`), con la mascota en `pensando`, y no
 * dentro de los turnos: si falla, vuelve al campo, y el hilo se vuelve a leer para mostrarla como la guardó
 * el servidor, fallida (`lib/agentes/usarCerebro.ts`). El turno actual es el último del cerebro mientras no hay otra pregunta en
 * camino: es el único cuya mascota sigue el cursor, y sólo con la conversación a la vista. */

import Mascota from '../marca/Mascota.jsx';
import Respuesta from './Respuesta.jsx';

export default function Conversacion({ turnos, pendiente, nombres, aLaVista, alNavegar }) {
  const ultimo = pendiente === null ? turnos.findLastIndex((t) => t.tipo === 'cerebro') : -1;
  return (
    <div className="cb-conversacion" aria-live="polite">
      {turnos.map((t, i) =>
        t.tipo === 'persona' ? (
          <p key={t.clave} className="cb-pregunta">
            {t.texto}
          </p>
        ) : t.tipo === 'fallo' ? (
          <p key={t.clave} className="cb-fallo">
            {t.texto}
          </p>
        ) : (
          <Respuesta
            key={t.clave}
            respuesta={t.respuesta}
            evidencia={t.evidencia}
            mascota={t.mascota}
            actual={aLaVista && i === ultimo}
            nombres={nombres}
            alNavegar={alNavegar}
          />
        ),
      )}
      {pendiente !== null ? (
        <>
          <p className="cb-pregunta">{pendiente}</p>
          <div className="cb-respuesta cb-esperando">
            <span className="cb-avatar">
              <Mascota diametro={28} estado="pensando" sigue={aLaVista} viva={aLaVista} />
            </span>
            <p className="cb-burbuja">Leyendo lo que miden tus pantallas…</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
