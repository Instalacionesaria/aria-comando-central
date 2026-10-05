'use client';

/* El panel que sube desde la caja del pie (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-51 y AG-57; `D-12`).
 *
 * La respuesta de una pregunta hecha al pie se lee acá, sobre el cuerpo del departamento, y acá se sigue
 * la conversación y se ven los hilos propios de esta sección, con borrar: quien no ve el Inicio no tiene
 * CONVERSACIONES, y éste es su único lugar.
 *
 * Es una `Ventana` (`components/Ventana.jsx`) con la variante `vt-panel`: el foco entra y vuelve a la caja,
 * Escape y el fondo cierran, el tabulador no se escapa. Sin ids propios: la prueba 156 prohíbe los del
 * panel del prototipo (`askPanel`, `askScrim`…), y éste no necesita ninguno.
 *
 * El primer control del cuerpo es el que muestra los hilos, que siempre está habilitado: la ventana pone el
 * foco en el primero que encuentra. Mientras se espera una respuesta el campo queda en sólo lectura y no
 * deshabilitado: un campo deshabilitado suelta el foco al `body`, fuera de la ventana, donde Escape y la
 * trampa del tabulador no llegan (lo encontró la revisión de AG7). */

import { useState } from 'react';
import Ventana from '../Ventana.jsx';
import Conversacion from './Conversacion.jsx';

const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export default function PanelDelCerebro({ sobre, cerebro, listo, motivo, nombres, alPreguntar, alIrAAjustes, alCerrar }) {
  const [texto, setTexto] = useState('');
  /* Abierto sin una conversación en curso y con hilos guardados, se ve la lista: el panel vacío no dice qué
     hacer con él. */
  const [verHilos, setVerHilos] = useState(() => cerebro.turnos.length === 0 && cerebro.pendiente === null && (cerebro.panel?.hilos.length ?? 0) > 0);
  const enCamino = cerebro.pendiente !== null;
  const hilos = cerebro.panel?.hilos ?? [];

  const enviar = async () => {
    const limpio = texto.trim();
    if (limpio === '' || !listo || enCamino) return;
    setTexto('');
    if (!(await alPreguntar(limpio))) setTexto(limpio);
  };

  return (
    <Ventana titulo="El cerebro" subtitulo={sobre} clase="vt-panel" alCerrar={alCerrar}>
      <div className="cb-panel">
        <div className="cb-panel-barra">
          <button type="button" className="cb-texto" aria-expanded={verHilos} onClick={() => setVerHilos((v) => !v)}>
            {verHilos ? 'Volver a la conversación' : `Tus conversaciones aquí (${hilos.length})`}
          </button>
          {cerebro.hiloId !== null && !enCamino ? (
            <button
              type="button"
              className="cb-texto"
              onClick={() => {
                cerebro.nueva();
                setVerHilos(false);
              }}
            >
              Nueva conversación
            </button>
          ) : null}
        </div>

        {verHilos ? (
          hilos.length === 0 ? (
            <p className="cb-detalle">Todavía no le preguntaste nada al cerebro desde esta pestaña.</p>
          ) : (
            <ul className="cb-hilos">
              {hilos.map((h) => (
                <li key={h.id} className={h.id === cerebro.hiloId ? 'on' : undefined}>
                  <button
                    type="button"
                    className="cb-hilo"
                    onClick={() => {
                      void cerebro.abrir(h.id);
                      setVerHilos(false);
                    }}
                  >
                    <span>{h.titulo}</span>
                    <span className="cb-detalle">{FECHA.format(new Date(h.actualizadaEl))}</span>
                  </button>
                  <button type="button" className="cb-borrar" aria-label={`Borrar «${h.titulo}»`} onClick={() => void cerebro.borrar(h.id)}>
                    Borrar
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <Conversacion turnos={cerebro.turnos} pendiente={cerebro.pendiente} nombres={nombres} aLaVista alNavegar={alCerrar} />
        )}

        {cerebro.error || motivo ? (
          <p className={cerebro.error ? 'cb-nota mal' : 'cb-nota'} role="status">
            {cerebro.error ?? motivo}
            {alIrAAjustes ? (
              <>
                {' '}
                <button type="button" className="cb-texto" onClick={alIrAAjustes}>
                  Ir a {nombres('credenciales')}
                </button>
              </>
            ) : null}
          </p>
        ) : null}

        <form
          className="cb-caja"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
        >
          <textarea
            className="cb-campo"
            rows={2}
            value={texto}
            disabled={!listo}
            readOnly={enCamino}
            aria-busy={enCamino}
            placeholder={`Pregúntale al cerebro sobre ${sobre}…`}
            aria-label={`Pregúntale al cerebro sobre ${sobre}`}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
          />
          <button type="submit" className="cb-enviar" disabled={!listo || enCamino || texto.trim() === ''} aria-label="Enviar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
      </div>
    </Ventana>
  );
}
