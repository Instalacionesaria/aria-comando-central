'use client';

/* La ficha de una pieza de Creative: el `aside.drawer` del prototipo, con los datos reales (docs/creative/16, CF1-10).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL CAJÓN DEL PROTOTIPO, SIN LO QUE NO TIENE FUENTE
 *
 * El prototipo abría cada pieza en `#drawer` (`aios-command-center_1.html:3764-3810`) con su veredicto y cuatro
 * secciones —«Qué es», «Datos del video», «Retención del video» y «Guión del video»— sobre datos inventados. Acá van
 * las mismas, en su orden, más la miniatura arriba y los anuncios de la pieza abajo. Lo que GoHighLevel no entrega
 * —el formato, el ángulo, la duración, el dolor, la retención y el guion— queda en «—» con su frase: no se inventa
 * una curva ni se marca una línea de un guion que no está guardado.
 *
 * ── UN CAJÓN PROPIO, NO `#drawer` ──────────────────────────────────────────
 *
 * Mismo molde que `components/leads-portal/FichaDelLead.jsx`: `#drawer` lo escribía la maqueta con `innerHTML`, y
 * compartirlo hacía que dos pantallas pisaran el mismo nodo. Éste usa las clases globales del cajón —se ve igual— y se
 * monta en `document.body`, así que sus reglas propias cuelgan de `.cr-ficha` y no de `#v-creative`.
 *
 * ── EL LINK MANUAL ES UN ENLACE, Y SÓLO LO CARGA QUIEN ADMINISTRA ───────────
 *
 * Se abre en una pestaña nueva con `noopener noreferrer`, y nada más: no se reproduce ni se embebe (C15-06). El
 * formulario para cargarlo se dibuja SÓLO si el servidor dijo que esta sesión puede (`puedeEditar`): ofrecer un
 * control que va a dar 403 es el `07` § 4. El servidor valida igual.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { borrarEnlaceDeLaPieza, guardarEnlaceDeLaPieza } from '@/lib/negocio/vistaDeCreative';
import Miniatura from './Miniatura.jsx';
import { CRITERIO, ESTADO, ETAPA, FORMATO_DEL_CRITERIO, FRASE, VER_EN, corto, fechaCorta, miles, motivo, o, pf, plata, veces } from './comun.jsx';

/** El día en que se cargó el link manual: es un instante, y se lee en la zona de quien mira. */
const elDia = (iso) => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

export default function FichaDelCreativo({ pieza, criterio, gana, unica, manual, manualDelServidor, puedeEditar, alCambiarEnlaces, alCerrar }) {
  const cerrarRef = useRef(null);

  /* El foco entra UNA vez al abrirse y Escape cierra; la función vive en una referencia para que el reloj del
     panel, que vuelve a dibujar todo, no le robe el foco al lector. Mismo motivo que en `FichaDelLead`. */
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

  const c = pieza.cifras;
  const f = pieza.ficha;
  /* Adónde lleva «Ver en…»: el link manual que hay AHORA, que el editor cambia sin esperar a la lectura; si no hay,
     el que mandó el servidor, salvo que ése fuera el manual que se acaba de sacar —la recarga trae el de la
     miniatura—. */
  const enlace = manual ? { url: manual.url, red: manual.red } : manualDelServidor ? null : pieza.enlace;
  const valor = c[criterio];

  return createPortal(
    <>
      <div className="scrim on" onClick={alCerrar} aria-hidden="true" />
      <aside className="drawer on cr-ficha" role="dialog" aria-modal="true" aria-label={`Pieza ${pieza.clave}`}>
        <div className="dw-head">
          <div className="cr-cabeza">
            <h3 className="cr-titulo">{pieza.clave}</h3>
            <div className="m">{`${ESTADO[pieza.estado]} · ${ETAPA[pieza.etapa]}`}</div>
            {/* El veredicto del prototipo, contra la etapa (CF1-08): «Funciona» con su cifra, o «Bajo en…». */}
            {gana ? (
              <span className="dw-verdict good">{`✓ Funciona · ${unica ? FRASE.unica : `${o(valor.valor, FORMATO_DEL_CRITERIO[criterio])} ${CRITERIO[criterio].unidad}`}`}</span>
            ) : (
              <span className="dw-verdict bad">{`✕ Bajo en ${CRITERIO[criterio].rotulo.toLowerCase()} · ${o(valor.valor, FORMATO_DEL_CRITERIO[criterio])}`}</span>
            )}
          </div>
          <button type="button" className="dw-x" ref={cerrarRef} onClick={alCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="dw-body">
          <div>
            <div className="dw-sec-t">La pieza</div>
            <div className="dw-block">
              <Miniatura url={pieza.miniatura} clase="dw-video" />
              {enlace ? (
                <p className="cr-enlace">
                  <a className="ld-btn" href={enlace.url} target="_blank" rel="noopener noreferrer">
                    {VER_EN[enlace.red]} ↗
                  </a>
                  {manual ? <span className="cr-dato">{`Link cargado a mano el ${elDia(manual.actualizadoEl)}.`}</span> : null}
                </p>
              ) : null}
              {puedeEditar ? <EditorDelEnlace pieza={pieza.clave} enlace={manual} alCambiarEnlaces={alCambiarEnlaces} /> : null}
            </div>
          </div>

          <div className="qe">
            <div className="dw-sec-t">Qué es</div>
            <div className="qe-grid">
              <Caja rotulo="Etapa" valor={ETAPA[pieza.etapa]} />
              <Caja rotulo="Estado" valor={ESTADO[pieza.estado]} />
              <Caja rotulo="Anuncios" valor={miles(f.anuncios)} />
              <Caja rotulo="Formato" valor={FRASE.guion} porque={FRASE.sinFuente} />
              <Caja rotulo="Ángulo" valor={FRASE.guion} porque={FRASE.sinFuente} />
              <Caja rotulo="Duración" valor={FRASE.guion} porque={FRASE.sinFuente} />
              <Caja rotulo="Primer día con entrega" valor={fechaCorta(f.primerDia) ?? FRASE.guion} ancha />
              <Caja rotulo="Último día con entrega" valor={fechaCorta(f.ultimoDia) ?? FRASE.guion} ancha />
              <Caja rotulo="Pieza" valor={pieza.clave} ancha />
              <Caja rotulo="Dolor que ataca" valor={FRASE.guion} porque={FRASE.sinFuente} ancha />
            </div>
          </div>

          <div>
            <div className="dw-sec-t">Datos de la pieza</div>
            <div className="dw-block out-grid cr-datos">
              <Dato rotulo="Calificados" c={c.calificados} formato={miles} hi />
              <Dato rotulo="Agendas" c={c.agendas} formato={miles} hi />
              <Dato rotulo="Hook rate" c={c.hookRate} formato={pf} />
              <Dato rotulo="Retención" c={c.retencion} formato={pf} />
              <Dato rotulo="Impresiones" c={c.impresiones} formato={corto} />
              <Dato rotulo="Frecuencia" c={c.frecuencia} formato={veces} />
              <Dato rotulo="Gasto" c={f.gasto} formato={plata} />
              <Dato rotulo="CTR" c={f.ctr} formato={pf} />
              <Dato rotulo="Link CTR" c={f.linkCtr} formato={pf} />
              <Dato rotulo="Landing" c={f.landing} formato={pf} />
              <Dato rotulo="Click-to-landing" c={f.clickToLanding} formato={pf} />
            </div>
          </div>

          <div>
            <div className="dw-sec-t">Retención y guion</div>
            <div className="dw-block">
              <div className="dw-empty">{FRASE.sinFuente}</div>
            </div>
          </div>

          <div>
            <div className="dw-sec-t">Los anuncios de la pieza</div>
            {f.anunciosDeLaPieza.length === 0 ? (
              <div className="dw-block">
                <div className="dw-empty">{FRASE.sinEntrega}</div>
              </div>
            ) : (
              <div className="kv-box">
                {f.anunciosDeLaPieza.map((a, i) => (
                  <div className="kv cr-anuncio" key={a.anuncioId}>
                    {/* El número de orden y los últimos dígitos: dieciocho dígitos no se leen, y el id completo queda
                        en el `title` para quien lo tenga que buscar en Meta. */}
                    <span title={a.anuncioId}>{`Anuncio ${i + 1} · …${a.anuncioId.slice(-6)}`}</span>
                    <span className="cr-dato">{`${o(a.impresiones, miles)} impresiones · ${o(a.gasto, plata)}`}</span>
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

/**
 * Una caja de «Qué es», la `qb` del prototipo. Un «—» lleva su frase en el `title`: la caja es de un renglón. Los
 * rótulos largos —los dos días, la pieza, el dolor— van a todo el ancho: en un tercio, el rótulo deja 30 px al valor.
 */
function Caja({ rotulo, valor, porque = null, ancha = false }) {
  return (
    <div className={ancha ? 'qb wide' : 'qb'}>
      <i>{rotulo}</i>
      <b title={porque ?? (typeof valor === 'string' ? valor : undefined)}>{valor}</b>
    </div>
  );
}

/** Una cifra de «Datos de la pieza», la `out` del prototipo, con la línea de su «—» debajo. */
function Dato({ rotulo, c, formato, hi = false }) {
  const porque = motivo(c);
  return (
    <div className={`out${hi ? ' hi' : ''}${porque ? ' cr-con-motivo' : ''}`}>
      <div className="k">{rotulo}</div>
      <div className="v">{o(c.valor, formato)}</div>
      {porque ? <div className="cr-motivo">{porque}</div> : null}
    </div>
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
