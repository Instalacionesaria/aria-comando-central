'use client';

/* Una respuesta del cerebro, en burbujas (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-46 a AG-49 y AG-55).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LO QUE SE DIBUJA, EN ESTE ORDEN
 *
 *   1 · La conclusión primero, con la confianza, las cifras —cada una con su muestra, su período y su
 *       fuente— y la EVIDENCIA, un desplegable dentro de la misma burbuja y no un panel aparte (`D-28`):
 *       las filas reales que leyó cada herramienta, con «mostrando X de N».
 *   2 · Las recomendaciones —con la marca de las que requieren validación ejecutiva— y lo que falta medir,
 *       con dónde se carga. Sólo si hay.
 *   3 · Los siguientes pasos, como botones que abren su pantalla, y los avisos de la validación (una cifra
 *       sin respaldo que se quitó, una conclusión dudosa).
 *
 * Todo sale de la respuesta que validó el servidor (`lib/agentes/executive/respuesta.ts`): acá no se
 * escribe ni se calcula ninguna cifra.
 *
 * ── LA MASCOTA ──────────────────────────────────────────────────────────────
 *
 * Sólo en la primera burbuja de cada respuesta, y con el estado que decidió el servidor (AG-55). La sigue
 * al cursor sólo la del turno actual: cada instancia que sigue lleva su propio bucle por cuadro, y una
 * conversación larga tendría veinte. Las demás quedan quietas, sin bucle.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { irALaVista } from '../../lib/aios/shell.js';
import Mascota from '../marca/Mascota.jsx';
import Evidencia from './Evidencia.jsx';

const NUMERO = new Intl.NumberFormat('es', { maximumFractionDigits: 2 });

const CONFIANZA = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja' };

export default function Respuesta({ respuesta, evidencia, mascota, actual, nombres, alNavegar }) {
  /* Un paso abre su pantalla, con la pestaña si la dijo. Desde el panel del pie, además lo cierra: si no, el
     panel quedaba encima de la pantalla que se acaba de abrir. */
  const abrir = (paso) => {
    alNavegar?.();
    irALaVista(paso.seccion, { pestana: paso.pestana ?? null });
  };
  const r = respuesta;
  const hayPie = r.siguientes.length > 0 || r.avisos.length > 0;
  const hayRecomendaciones = r.recomendaciones.length > 0 || r.no_hay_dato.length > 0;
  return (
    <div className="cb-respuesta">
      <span className="cb-avatar">
        <Mascota diametro={28} estado={mascota} sigue={actual} />
      </span>
      <div className="cb-burbujas">
        <div className="cb-burbuja">
          <p className="cb-conclusion">{r.conclusion}</p>
          <p className={`cb-confianza ${r.confianza.nivel}`}>
            <b>{CONFIANZA[r.confianza.nivel] ?? r.confianza.nivel}.</b> {r.confianza.porque}
          </p>
          {r.cifras.length > 0 ? (
            <ul className="cb-cifras">
              {r.cifras.map((c, i) => (
                <li key={`${i}:${c.ev}:${c.campo}`}>
                  <span className="cb-valor">{NUMERO.format(c.valor)}</span>
                  <span className="cb-que">{c.que_es}</span>
                  <span className="cb-detalle">
                    {c.muestra} · {c.periodo} · {nombres(c.fuente)} · {c.ev}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {evidencia.length > 0 ? <Evidencia evidencia={evidencia} /> : null}
        </div>

        {hayRecomendaciones ? (
          <div className="cb-burbuja">
            {r.recomendaciones.length > 0 ? (
              <ul className="cb-recomendaciones">
                {r.recomendaciones.map((x, i) => (
                  <li key={`${i}:${x.texto}`}>
                    {x.requiere_validacion_ejecutiva ? <span className="cb-marca">Requiere validación ejecutiva</span> : null}
                    {x.texto}
                    <span className="cb-detalle"> · {x.ev.join(', ')}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {r.no_hay_dato.length > 0 ? (
              <ul className="cb-falta">
                {r.no_hay_dato.map((x, i) => (
                  <li key={`${i}:${x.falta}`}>
                    <b>No hay dato suficiente:</b> {x.falta}. <span className="cb-detalle">Se carga en {x.donde_se_carga}.</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {hayPie ? (
          <div className="cb-burbuja cb-pie">
            {r.avisos.map((a, i) => (
              <p key={`${i}:${a}`} className="cb-aviso">
                {a}
              </p>
            ))}
            {r.siguientes.length > 0 ? (
              <div className="cb-siguientes">
                {r.siguientes.map((paso, i) => (
                  <button key={`${i}:${paso.seccion}:${paso.pestana ?? ''}`} type="button" className="cb-ir" onClick={() => abrir(paso)}>
                    Abrir {nombres(paso.seccion)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
