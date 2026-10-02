'use client';

/* El cajón de una pieza de Creative: sus anuncios, y su video (docs/creative/15, C15-02).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ES EL `C4-01` DE LA MAQUETA, QUE NUNCA SE CONSTRUYÓ
 *
 * La maqueta abría cada pieza en `#drawer` con una curva de retención y un guion inventados. Éste es
 * el cajón de verdad: lista los anuncios en los que corre la pieza, con lo que cada uno entregó en la
 * ventana, y el link manual del video cuando lo hay. La miniatura y el video de cada anuncio llegan
 * cuando se conecte Meta directo; hasta entonces el cajón lo dice, en vez de dejar el hueco callado.
 *
 * ── UN CAJÓN PROPIO, NO `#drawer` ──────────────────────────────────────────
 *
 * Mismo molde que `components/leads-portal/FichaDelLead.jsx`: `#drawer` lo escribía la maqueta del
 * Executive con `innerHTML`, y compartirlo hacía que dos pantallas pisaran el mismo nodo. Éste tiene su `id`, usa
 * las clases globales del cajón —se ve igual— y se monta en `document.body`.
 *
 * ── EL LINK MANUAL ES UN ENLACE, Y SÓLO LO CARGA QUIEN ADMINISTRA ───────────
 *
 * Se abre en una pestaña nueva con `noopener noreferrer`, y nada más: no se reproduce ni se embebe
 * (C15-06). El formulario para cargarlo se dibuja SÓLO si el servidor dijo que esta sesión puede
 * (`puedeEditar`): ofrecer un control que va a dar 403 es el `07` § 4. El servidor valida igual.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { borrarEnlaceDeLaPieza, guardarEnlaceDeLaPieza } from '@/lib/negocio/vistaDeCreative';

const miles = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-PE'));
const plata = (v) =>
  v === null || v === undefined ? '—' : `$${Number(v).toLocaleString('es-PE', { maximumFractionDigits: 2 })}`;
const fecha = (iso) =>
  iso ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—';

/** El rótulo del enlace según la red. La red la decide el servidor por el host, no el texto del link. */
const VER_EN = { facebook: 'Ver en Facebook', instagram: 'Ver en Instagram' };

export default function FichaDelCreativo({ fila, enlace, puedeEditar, alCambiarEnlaces, alCerrar }) {
  const cerrarRef = useRef(null);

  /* El foco entra UNA vez al abrirse y Escape cierra; la función vive en una referencia para que el
     reloj del panel, que vuelve a dibujar todo, no le robe el foco al lector. Mismo motivo que en
     `FichaDelLead`. */
  const alCerrarRef = useRef(alCerrar);
  alCerrarRef.current = alCerrar;
  useEffect(() => {
    cerrarRef.current?.focus();
    const alTeclear = (e) => {
      if (e.key === 'Escape') alCerrarRef.current();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, []);

  const anuncios = fila.anunciosDeLaPieza ?? [];

  return createPortal(
    <>
      <div className="scrim on" onClick={alCerrar} aria-hidden="true" />
      <aside className="drawer on cr-ficha" id="crFicha" role="dialog" aria-modal="true" aria-label={`Pieza ${fila.creativo}`}>
        <div className="dw-head">
          <div>
            <h3 className="cr-titulo">{fila.creativo}</h3>
            <div className="m">
              {fila.diasConEntrega === 0
                ? `Corre en ${fila.anuncios} anuncio(s), y no entregó ningún día de esta ventana.`
                : `Corre en ${fila.anuncios} anuncio(s) y entregó ${fila.diasConEntrega} día(s) de esta ventana.`}
            </div>
          </div>
          <button type="button" className="dw-x" ref={cerrarRef} onClick={alCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="dw-body">
          <div>
            <div className="dw-sec-t">El video</div>
            <div className="dw-block">
              {enlace ? (
                <p className="cr-enlace">
                  <a className="ld-btn" href={enlace.url} target="_blank" rel="noopener noreferrer">
                    {VER_EN[enlace.red] ?? 'Ver la publicación'} ↗
                  </a>
                  <span className="cr-dato">Link cargado a mano el {fecha(enlace.actualizadoEl)}.</span>
                </p>
              ) : null}
              <p className="cr-hueco">
                La miniatura y el video de cada anuncio todavía no se pueden mostrar: GoHighLevel no los
                entrega, y la conexión directa con Meta no está cargada.
                {enlace ? null : ' Mientras tanto, se puede cargar el link del post o del reel de la pieza.'}
              </p>
              {puedeEditar ? (
                <EditorDelEnlace pieza={fila.creativo} enlace={enlace} alCambiarEnlaces={alCambiarEnlaces} />
              ) : null}
            </div>
          </div>
          <div>
            <div className="dw-sec-t">Los anuncios de la pieza</div>
            {anuncios.length === 0 ? (
              <p className="cr-hueco">Ningún anuncio de esta pieza tiene datos en esta ventana.</p>
            ) : (
              <div className="kv-box">
                {anuncios.map((a, i) => (
                  <div className="kv cr-anuncio" key={a.anuncioId}>
                    {/* El número de orden y los últimos dígitos: dieciocho dígitos no se leen, y el id
                        completo queda en el `title` para quien lo tenga que buscar en Meta. */}
                    <span title={a.anuncioId}>
                      Anuncio {i + 1} · …{a.anuncioId.slice(-6)}
                    </span>
                    <span className="cr-dato">
                      {miles(a.impresiones)} impresiones · {plata(a.gasto)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}

/** Cargar, reemplazar o sacar el link manual. El motivo del servidor se muestra tal cual. */
function EditorDelEnlace({ pieza, enlace, alCambiarEnlaces }) {
  const [url, setUrl] = useState(enlace?.url ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function aplicar(accion) {
    setOcupado(true);
    setError('');
    const r = accion === 'sacar' ? await borrarEnlaceDeLaPieza(pieza) : await guardarEnlaceDeLaPieza(pieza, url.trim());
    setOcupado(false);
    if (r.tipo === 'datos') {
      alCambiarEnlaces(r.enlaces);
      if (accion === 'sacar') setUrl('');
    } else {
      setError(r.mensaje);
    }
  }

  return (
    <form
      className="cr-form"
      onSubmit={(e) => {
        e.preventDefault();
        aplicar('guardar');
      }}
    >
      <label className="cr-dato" htmlFor="crEnlaceUrl">
        Link del post o del reel (Facebook o Instagram)
      </label>
      <div className="cr-fila-form">
        <input
          id="crEnlaceUrl"
          className="cr-input"
          type="url"
          inputMode="url"
          placeholder="https://www.facebook.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={ocupado}
        />
        <button type="submit" className="ld-btn" disabled={ocupado || url.trim() === ''}>
          {enlace ? 'Reemplazar' : 'Guardar'}
        </button>
        {enlace ? (
          <button type="button" className="ld-btn" disabled={ocupado} onClick={() => aplicar('sacar')}>
            Sacar
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="cr-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
