'use client';

/* El cajón de un paso de Conversion: Landing, Formulario o Agenda (docs/conversion/15, CV15-17).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LA FORMA DEL `stepDetail` DEL PROTOTIPO, SÓLO CON LO QUE SE MIDE
 *
 * El prototipo abría cada paso en `#drawer` (`stepDetail`, `aios-command-center_1.html:4330-4490`): la meta
 * con la fuente y la población, una rejilla de cajas, sus secciones y las «Observaciones». Acá va la misma
 * forma con lo real, y **nada inventado**: donde el prototipo tenía el mapa de calor, las grabaciones o el
 * abandono campo por campo, el cajón dice «Sin dato». No lleva la «Lectura» en prosa, porque no hay ningún
 * texto que el servidor escriba con fuente; la «Franja preferida» tampoco, porque se podría calcular y
 * «Sin dato» sería falso.
 *
 * VSL y Gracias no abren cajón: sería uno que sólo dice «Sin dato», y eso ya lo dice la tarjeta (CV15-13).
 *
 * ── UN CAJÓN PROPIO, NO `#drawer` ──────────────────────────────────────────
 *
 * Mismo molde que `components/creative/FichaDelCreativo.jsx`: tiene su `id`, usa las clases globales del
 * cajón —se ve igual— y se monta en `document.body`. Por eso sus reglas propias cuelgan de `.cv-cajon` y no de
 * `#v-conversion`, que no lo alcanzaría.
 *
 * ── SIN DATOS DE UNA PERSONA (CV15-24) ─────────────────────────────────────
 *
 * Todo lo de acá son conteos de la cohorte. La familia de entrada sale del host y nunca se dibuja la dirección
 * ni el `referrer`, tampoco en un `title`: la dirección entera puede llevar el nombre de la persona.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CON_REGLAS, Delta, FRASE, PASOS, fechaCorta, miles, o, pf, poner, rangoDe, senalesDelPaso } from './comun.jsx';

/** El punto de cada observación, con el color de su gravedad (`.obs.alta`, `.obs.critica` de `aios.css`). */
const CLASE_DE_OBS = { critica: 'obs critica', alta: 'obs alta' };
const ESTADO_DE_LA_SENAL = { abierta: 'abierta', vista: 'vista', sin_medicion: 'sin medición hoy' };

export default function CajonDelPaso({ clave, p, alCerrar }) {
  const cerrarRef = useRef(null);

  /* El foco entra UNA vez al abrirse y Escape cierra; la función vive en una referencia para que el reloj del
     panel, que vuelve a dibujar todo, no le robe el foco al lector. Mismo motivo que en `FichaDelCreativo`. */
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

  const paso = PASOS.find((s) => s.k === clave);
  const { meta, cuerpo } = clave === 'sesiones' ? landing(p) : clave === 'form' ? formulario(p) : agenda(p);

  return createPortal(
    <>
      <div className="scrim on" onClick={alCerrar} aria-hidden="true" />
      <aside className="drawer on cv-cajon" id="cvCajon" role="dialog" aria-modal="true" aria-label={paso.t}>
        <div className="dw-head">
          <div>
            <h3>{paso.t}</h3>
            <div className="m">{meta}</div>
          </div>
          <button type="button" className="dw-x" ref={cerrarRef} onClick={alCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="dw-body">
          {cuerpo}
          <Observaciones clave={clave} p={p} />
        </div>
      </aside>
    </>,
    document.body,
  );
}

/**
 * Una caja de la rejilla (`box`, línea 4267): rótulo y cifra, con su flecha o su tasa al lado. Sin `tasa`, la caja no
 * lleva; con `tasa` nula —bajo el piso—, «—», como la tarjeta de la misma cifra.
 */
function Caja({ k, v, hi = false, d = null, tasa = undefined }) {
  return (
    <div className={hi ? 'out hi' : 'out'}>
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {tasa === undefined ? null : <span className="cv-tasa">{o(tasa, pf)}</span>}
        {d}
      </div>
    </div>
  );
}

/** Una sección que el prototipo llenaba con datos inventados y acá no tiene fuente. */
function Hueco({ titulo, detalle = null }) {
  return (
    <div>
      <div className="dw-sec-t">
        {titulo}
        {detalle ? <span className="r">{detalle}</span> : null}
      </div>
      <p className="cv-hueco">{FRASE.sinDato}</p>
    </div>
  );
}

/**
 * Landing: la tabla de las siete familias, que era el bloque principal de la pantalla anterior. Las filas suman
 * la cohorte —el servidor lo garantiza— y no se suman hacia abajo: son caminos, no pasos.
 */
function landing(p) {
  const r = p.recorrido;
  return {
    meta: `GoHighLevel · ${miles(r.cohorte)} contactos · ${rangoDe(p.pasos.ventana)}`,
    cuerpo: (
      <>
        <div>
          <div className="dw-sec-t">Por dónde entró la gente</div>
          {r.filas.length === 0 ? (
            <p className="cv-hueco">{FRASE.sinContactos}</p>
          ) : (
            <div className="dw-block cv-tabla cv-familias" role="table">
              <div className="cv-fila cv-cab" role="row">
                <span role="columnheader">Camino</span>
                <span role="columnheader">Contactos</span>
                <span role="columnheader">Del total</span>
                <span role="columnheader">Agendaron</span>
              </div>
              {r.filas.map((f) => (
                <div className="cv-fila" role="row" key={f.familia}>
                  {/* La definición de cada camino viaja en la respuesta (`rotulos`), y va en el `title`. */}
                  <span className="cv-n" role="cell" title={r.rotulos?.[f.familia]?.que}>
                    {f.titulo}
                    {/* La marca sólo si TODA la fila se registró al reservar: ahí «entró por acá» y «agendó» son
                        el mismo hecho, y su conteo de agendados no dice que el camino convierta. El aviso de abajo,
                        que escribe el servidor, nombra también las que lo son casi enteras. */}
                    {f.contactos > 0 && f.capturadaAlReservar === f.contactos ? (
                      <em className="cv-marca">{FRASE.alReservar}</em>
                    ) : null}
                  </span>
                  <span role="cell">{miles(f.contactos)}</span>
                  <span role="cell">{pf(f.porcion)}</span>
                  {/* Un CONTEO, no una tasa: la tasa por familia es circular (CV2-02). */}
                  <span role="cell">{miles(f.agendaron)}</span>
                </div>
              ))}
            </div>
          )}
          {r.aviso ? <p className="cv-aviso">{r.aviso}</p> : null}
        </div>
        <Hueco titulo="Comportamiento" detalle="mapa de calor y grabaciones" />
      </>
    ),
  };
}

/**
 * Formulario: lo empezaron, lo completaron y la tasa, y la tabla de los tres estados con la contradicción del
 * campo contra las citas. Con la ventana después del corte no hay a quién medir (CV15-14).
 */
function formulario(p) {
  const f = p.formulario;
  const c = p.pasos.cifras.formulario;
  const corte = c.corte === null ? null : fechaCorta(c.corte);
  const conDato = c.valor !== null;
  const rango = f.desde ? rangoDe({ desde: f.desde, hasta: f.hasta }) : rangoDe(p.pasos.ventana);
  return {
    meta: `GoHighLevel · ${o(c.valor, miles)} lo empezaron · ${rango}`,
    cuerpo: (
      <>
        <div>
          <div className="dw-sec-t">
            Resultado
            {conDato ? <span className="r">{poner(FRASE.hastaElCorte, { corte })}</span> : null}
          </div>
          <div className="dw-block out-grid cv-rejilla">
            <Caja k="Lo empezaron" v={o(c.valor, miles)} hi />
            <Caja k="Lo completaron" v={conDato ? miles(f.completaron) : FRASE.guion} />
            {/* La finalización, con el piso sobre los que lo empezaron. */}
            <Caja k="Tasa" v={o(c.finalizacion, pf)} />
          </div>
          {conDato ? null : (
            <p className="cv-hueco">{corte === null ? FRASE.sinDato : poner(FRASE.sinDatoDesde, { corte })}</p>
          )}
          {/* El aviso del embudo, dentro de la sección a la que se refiere: ésta si no hay tabla, la de la tabla si la hay. */}
          {f.aviso && !(conDato && f.filas.length > 0) ? <p className="cv-aviso">{f.aviso}</p> : null}
        </div>
        {conDato && f.filas.length > 0 ? (
          <div>
            <div className="dw-sec-t">Cómo quedó el formulario</div>
            <div className="dw-block cv-tabla cv-estados" role="table">
              <div className="cv-fila cv-cab" role="row">
                <span role="columnheader">Estado</span>
                <span role="columnheader">Contactos</span>
                <span role="columnheader">De los que llegaron</span>
                <span role="columnheader">Con cita</span>
              </div>
              {f.filas.map((x) => (
                <div className="cv-fila" role="row" key={x.estado}>
                  <span className="cv-n" role="cell">
                    {x.estado}
                  </span>
                  <span role="cell">{miles(x.contactos)}</span>
                  <span role="cell">{pf(x.porcion)}</span>
                  {/* La contradicción, al lado del número: el campo marca `Agendado` más veces de las que hay
                      citas que el CRM siga devolviendo, porque las viejas se congelan. */}
                  <span role="cell">{x.estado === 'Agendado' ? miles(f.agendadoSegunLasCitas.conCitaAlcanzable) : FRASE.guion}</span>
                </div>
              ))}
            </div>
            {f.aviso ? <p className="cv-aviso">{f.aviso}</p> : null}
          </div>
        ) : null}
        <Hueco titulo="Dónde se abandona" detalle="campo por campo" />
      </>
    ),
  };
}

/**
 * Agenda: la rejilla de 3×2 de CV15-17. Confirmados y Cancelaron son personas, sobre los calificados (CV15-18):
 * así no se mezcla la automatización de descarte, que cancela casi todo lo suyo.
 */
function agenda(p) {
  const c = p.pasos.cifras;
  return {
    meta: `Calendario · ${miles(c.agendados.valor)} agendados · ${rangoDe(p.pasos.ventana)}`,
    cuerpo: (
      <>
        <div>
          <div className="dw-sec-t">Resultado</div>
          <div className="dw-block out-grid cv-rejilla">
            {/* La flecha sin «sin comparación»: en la caja no entra, y la tira y la nota ya lo dicen. */}
            <Caja k="Agendados" v={miles(c.agendados.valor)} hi d={<Delta v={c.agendados.variacion} />} />
            <Caja k="Calificados" v={miles(c.calificados.valor)} hi />
            <Caja k="Tasa de calificación" v={o(c.calificados.tasa, pf)} />
            {/* Sin el campo de confirmación, la cifra ya es «—»: no se le suma otro guion. */}
            <Caja k="Confirmados" v={o(c.confirmados.valor, miles)} tasa={c.confirmados.valor === null ? undefined : c.confirmados.tasa} />
            <Caja k="Cancelaron" v={miles(c.cancelaron.valor)} tasa={c.cancelaron.tasa} />
            <Caja k="No calificados" v={miles(c.noCalificados.valor)} />
          </div>
        </div>
        {/* Depende del VSL, que no tiene fuente (docs/conversion/04-LOS-CAJONES.md:90-99). */}
        <Hueco titulo="Qué pasa después" />
      </>
    ),
  };
}

/**
 * Las señales del paso, con el marcado `obs` del prototipo (`obsBlock`, línea 4309). Sólo en los pasos a los que
 * apunta una regla, y con 7 o 30 días: con «Hoy» o «Completo» no hay señales que mirar. En Landing, las familias
 * de «No tocar» del plan van como «a favor» (CV15-P07): no son señales, y no se pueden resolver.
 */
function Observaciones({ clave, p }) {
  if (!CON_REGLAS.has(clave) || p.senales.ventana === null) return null;
  const malas = senalesDelPaso(p.senales, clave);
  const buenas = clave === 'sesiones' ? (p.senales.plan?.plan.grupos.find((g) => g.clave === 'no_tocar')?.renglones ?? []) : [];
  const aRevisar = malas.filter((s) => s.estado !== 'sin_medicion').length;
  return (
    <div>
      <div className="dw-sec-t">
        Observaciones
        <span className="r">
          {aRevisar} a revisar{buenas.length > 0 ? ` · ${buenas.length} a favor` : ''}
        </span>
      </div>
      <div className="dw-block">
        {malas.length === 0 && buenas.length === 0 ? <p className="cv-hueco">{FRASE.sinObservaciones}</p> : null}
        {malas.map((s) => (
          <div className={CLASE_DE_OBS[s.gravedad] ?? 'obs'} key={s.id}>
            <span className="obs-dot" />
            <div>
              <div className="obs-t">{s.texto}</div>
              <div className="obs-d">{s.revision}</div>
              <div className="obs-m">
                {fechaCorta(s.ultimaDeteccion)} · {ESTADO_DE_LA_SENAL[s.estado] ?? s.estado}
              </div>
            </div>
            {s.perdidaContactos === null ? null : (
              <div className="obs-n">
                −{miles(s.perdidaContactos)}
                <span>contactos</span>
              </div>
            )}
          </div>
        ))}
        {buenas.map((r) => (
          <div className="obs good" key={`${r.regla}:${r.entidad.tipo}:${r.entidad.id}`}>
            <span className="obs-dot" />
            <div>
              <div className="obs-t">{r.texto}</div>
              <div className="obs-m">señal a favor</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
