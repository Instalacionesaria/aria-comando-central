'use client';

/* El Brief del closer de una cita, dentro de la ficha (AG12 de los agentes;
 * `docs/OTROS/agentes/fichas/F13-CLOSER-Y-BRIEF.md`, `D-19`).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SE GENERA AL ABRIR LA CITA, Y NO SE REGENERA SOLO
 *
 * Al abrir: si la cita no tiene Brief y esta sesión puede generarlo, se pide (AG-F13-2). Una vez guardado se
 * lee; si lo que leyó ya no es lo de hoy —el formulario cambió, hay una llamada nueva— lo dice y ofrece
 * regenerarlo a mano, que cuenta para el tope del cerebro. Lo que no se puede (bajo delegación, sin llave, sin
 * `cerebro.usar`) se dice en vez de ofrecer un botón que va a fallar: lo decide el servidor (`noSePuede`).
 *
 * Cada dato muestra su fuente y su cita, y lo que no consta o es ambiguo se dice así (AG-F13-1). La objeción
 * que viene de las llamadas de la empresa se marca como tal: no es algo que esta persona dijo.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

/* La ruta declara `maxDuration = 300` (una llamada al modelo de hasta 120 s): quien la llama espera al menos
   eso, o el navegador cortaría una generación que el servidor termina y guarda (la regla de `lib/http/cliente.ts`). */
const ESPERA_DEL_BRIEF_MS = 300_000;

const POR_QUE_NO = {
  bajo_delegacion: 'Estás mirando otra empresa: el Brief no se genera aquí.',
  sin_permiso: 'Tu rol no puede generar el Brief.',
  sin_llave: 'Sin llave de IA: la empresa tiene que cargarla en Ajustes para generar el Brief.',
};

/** «formulario:3» → «formulario, pregunta 3». La fuente, en palabras. */
function fuenteEnPalabras(fuente) {
  if (!fuente) return null;
  const [de, cual] = fuente.split(':');
  if (de === 'formulario') return `formulario, pregunta ${cual}`;
  if (de === 'ficha') return 'ficha del lead';
  if (de === 'llamada') return 'su llamada anterior';
  if (fuente === 'objeciones_frecuentes') return 'las llamadas de la empresa';
  return fuente;
}

function Dato({ d }) {
  const fuente = fuenteEnPalabras(d.fuente);
  return (
    <li className={`br-dato br-${d.estado.toLowerCase()}`}>
      <span className="br-et">{d.etiqueta}</span>
      <span className="br-val">
        {d.estado === 'NO_CONSTA' ? 'No consta' : d.valor}
        {d.estado === 'AMBIGUO' ? <em className="br-marca"> · no está claro</em> : null}
      </span>
      {d.cita || fuente ? (
        <span className="br-fuente">
          {d.cita ? `«${d.cita}»` : ''}
          {d.cita && fuente ? ' · ' : ''}
          {fuente ?? ''}
        </span>
      ) : null}
    </li>
  );
}

export default function BriefDeLaCita({ citaId }) {
  const [estado, setEstado] = useState({ tipo: 'cargando' });
  const [generando, setGenerando] = useState(false);
  const pedido = useRef(false);

  const generar = useCallback(
    async (regenerar) => {
      setGenerando(true);
      const r = await pedir('/api/closer/brief', { metodo: 'POST', cuerpo: { cita: citaId, regenerar }, espera: ESPERA_DEL_BRIEF_MS });
      setGenerando(false);
      if (r.tipo === 'datos') setEstado((antes) => ({ tipo: 'listo', ...r.datos, noSePuede: antes.noSePuede ?? null }));
      else setEstado((antes) => ({ ...antes, fallo: r.tipo === 'rechazado' ? r.detalle || 'No se pudo generar el Brief.' : 'No se pudo conectar para generar el Brief.' }));
    },
    [citaId],
  );

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const r = await pedir(`/api/closer/brief?cita=${encodeURIComponent(citaId)}`, { espera: ESPERA_DEL_BRIEF_MS });
      if (!vigente) return;
      if (r.tipo !== 'datos') {
        setEstado({ tipo: 'error', mensaje: r.tipo === 'rechazado' ? r.detalle || 'No se pudo leer el Brief.' : 'No se pudo conectar para leer el Brief.' });
        return;
      }
      setEstado({ tipo: 'listo', ...r.datos });
      // Se genera al abrir, una vez, si no hay uno y se puede.
      if (r.datos.brief === null && r.datos.noSePuede === null && !pedido.current) {
        pedido.current = true;
        void generar(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [citaId, generar]);

  if (estado.tipo === 'cargando') return <div className="dw-empty">Cargando el Brief…</div>;
  if (estado.tipo === 'error') {
    return (
      <div className="fd-aviso mal">
        <i>⚠</i>
        <span>{estado.mensaje}</span>
      </div>
    );
  }
  const b = estado.brief;
  return (
    <div className="br">
      {estado.sinFormulario ? (
        <div className="fd-aviso falta" role="status">
          <i>◍</i>
          <span>SIN FORMULARIO: esta persona no completó el formulario. El Brief usa lo que hay.</span>
        </div>
      ) : null}
      {estado.fallo ? (
        <div className="fd-aviso mal">
          <i>⚠</i>
          <span>{estado.fallo}</span>
        </div>
      ) : null}
      {generando ? <div className="dw-empty">Preparando el Brief de esta cita…</div> : null}
      {!b && !generando ? (
        <div className="dw-empty">{estado.noSePuede ? POR_QUE_NO[estado.noSePuede] : 'Todavía no hay Brief para esta cita.'}</div>
      ) : null}
      {b && !generando ? (
        <>
          {estado.datosNuevos ? (
            <div className="fd-aviso falta br-nuevos" role="status">
              <i>◍</i>
              <span>Hay datos nuevos desde que se preparó.</span>
              {estado.noSePuede === null ? (
                <button type="button" className="fd-btn sec" onClick={() => void generar(true)}>
                  Regenerar
                </button>
              ) : null}
            </div>
          ) : null}
          <section className="br-sec">
            <h4>Quién es</h4>
            <ul>{b.quienEs.length ? b.quienEs.map((d, i) => <Dato key={i} d={d} />) : <li className="br-vacio">No consta.</li>}</ul>
          </section>
          <section className="br-sec">
            <h4>Qué dijo</h4>
            <ul>{b.queDijo.length ? b.queDijo.map((d, i) => <Dato key={i} d={d} />) : <li className="br-vacio">No consta.</li>}</ul>
          </section>
          <section className="br-sec">
            <h4>Objeción probable</h4>
            <ul>
              <Dato d={b.objecionProbable} />
            </ul>
            {b.objecionProbable.deLaEmpresa ? (
              <p className="br-nota">Es la objeción más frecuente en las llamadas de tu empresa, no algo que esta persona dijo.</p>
            ) : null}
            {b.objecionProbable.sugerencia ? <p className="br-sug">{b.objecionProbable.sugerencia}</p> : null}
          </section>
          <section className="br-sec">
            <h4>Pregunta para abrir</h4>
            <p className="br-preg">{b.preguntaParaAbrir || 'No consta.'}</p>
          </section>
          {!estado.datosNuevos && estado.noSePuede === null ? (
            <button type="button" className="fd-btn sec br-regenerar" onClick={() => void generar(true)}>
              Regenerar
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
