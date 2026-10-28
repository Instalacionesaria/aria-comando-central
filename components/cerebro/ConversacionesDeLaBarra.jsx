'use client';

/* CONVERSACIONES, en la barra (`docs/3-agentes/03-EL-CEREBRO.md`, AG-51;
 * `docs/3-agentes/F19-CONVERSACIONES.md`): los hilos propios con el cerebro, del más reciente al
 * más viejo, de cualquier origen —el Inicio o la caja del pie de una sección—.
 *
 * No le pide nada al servidor, como la barra entera (`pruebas/codigo/193-*`): lee los hilos que publica el
 * chat del Inicio (`lib/agentes/hilos-de-la-barra.ts`). Tocar uno abre el Inicio con ese hilo, por el
 * traspaso (`lib/agentes/traspaso.ts`); el Inicio lo toma aunque se monte después.
 *
 * Sin «＋» para adjuntar ni enlace para compartir (AG-51). Hasta el 2026-10-12 se borraban sólo en la conversación
 * —en el Inicio, o en el panel de la caja de su sección—, porque en una fila de la barra un «Borrar» quedaba a un
 * clic de abrir. **Desde ese día se borran también acá**, pedido por el usuario: al lado de cada hilo, un botón
 * chico —se ve al pasar el cursor o al llegar con el teclado—, y antes de borrar la fila pregunta; la pregunta es
 * lo que resuelve el clic de más. Quien borra es el Inicio, por el traspaso (`pedirBorrarHiloDelInicio`): la barra
 * sigue sin pedirle nada al servidor.
 *
 * Están todas las que manda el servidor (las cincuenta más recientes, `listarHilos`): con un corte propio, los
 * hilos del Inicio que quedaban afuera no tenían ningún otro camino (lo encontró la revisión de AG7). */

import { useState } from 'react';
import { irALaVista } from '../../lib/aios/shell.js';
import { pedirBorrarHiloDelInicio, pedirHiloDelInicio } from '../../lib/agentes/traspaso.ts';
import { usarHilosDeLaBarra } from '../../lib/agentes/hilos-de-la-barra.ts';

export default function ConversacionesDeLaBarra({ inicio }) {
  const hilos = usarHilosDeLaBarra();
  const mostrados = hilos ?? [];
  /* Desplegada SIEMPRE al cargar (pedido del usuario, 2026-10-28): el botón chico del rótulo la repliega mientras dure
     la página, sin guardarlo en ningún lado. Replegada se esconde con `hidden` y no se deja de dibujar, como los
     departamentos. Sin `id` ni `aria-controls`: los componentes del cerebro no estrenan ids (`217`), y el
     `aria-expanded` del botón ya dice si la lista está a la vista. */
  const [desplegada, setDesplegada] = useState(true);
  return (
    <div className="nb-conversaciones">
      <div className="nb-rotulo-con-boton">
        <span className="nb-rotulo">CONVERSACIONES</span>
        <button
          type="button"
          className={desplegada ? 'nb-replegar abierta' : 'nb-replegar'}
          aria-expanded={desplegada}
          aria-label={desplegada ? 'Replegar las conversaciones' : 'Desplegar las conversaciones'}
          title={desplegada ? 'Replegar' : 'Desplegar'}
          onClick={() => setDesplegada(!desplegada)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <div hidden={!desplegada}>
        {hilos === null ? null : mostrados.length === 0 ? (
          <span className="nb-vacio">Todavía no hay ninguna.</span>
        ) : (
          <ul className="nb-hilos">
            {mostrados.map((h) => (
              <Hilo key={h.id} h={h} inicio={inicio} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Una fila: el título, que abre el hilo en el Inicio, y el botón de borrar. Borrar no tiene vuelta atrás: el botón
 * no borra, cambia la fila por la pregunta, con «Cancelar» enfocado —un Enter de más no borra nada—. Escape cancela.
 */
function Hilo({ h, inicio }) {
  const [confirmando, setConfirmando] = useState(false);
  if (confirmando) {
    return (
      <li
        className="nb-confirmar"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setConfirmando(false);
        }}
      >
        <span className="nb-pregunta" title={h.titulo}>
          ¿Borrar esta conversación?
        </span>
        <span className="nb-respuestas">
          <button
            type="button"
            className="nb-si"
            onClick={() => {
              setConfirmando(false);
              pedirBorrarHiloDelInicio(h.id);
            }}
          >
            Borrar
          </button>
          <button type="button" className="nb-no" autoFocus onClick={() => setConfirmando(false)}>
            Cancelar
          </button>
        </span>
      </li>
    );
  }
  return (
    <li className="nb-fila">
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
      <button type="button" className="nb-borrar" aria-label={`Borrar «${h.titulo}»`} title="Borrar" onClick={() => setConfirmando(true)}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M7 7v4M9 7v4" />
        </svg>
      </button>
    </li>
  );
}
