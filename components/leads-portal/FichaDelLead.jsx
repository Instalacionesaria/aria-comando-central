'use client';

/* La ficha de una persona de Leads Portal, en un cajón propio.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * UN CAJÓN PROPIO, NO `#drawer`
 *
 * La maqueta escribía la ficha en `#drawer` con `innerHTML`, y la del Executive escribía en el mismo
 * `#dwBody`. Compartirlo hacía que dos pantallas pisaran el mismo nodo (las dos maquetas ya se fueron). Éste tiene su `id`, usa las
 * mismas clases —se ve igual— y se monta en `document.body`, porque un `position: fixed` adentro de
 * una vista con desplazamiento puede quedar recortado.
 *
 * ── NADA DEL CRM SE VUELVE ENLACE, SALVO LLAMAR Y ESCRIBIR ─────────────────
 *
 * El nombre, las respuestas del cuestionario, las campañas y los anuncios los escribió gente de
 * afuera, en un formulario o en Meta. React los escapa y se muestran como texto: un enlace armado
 * con un campo del CRM es una puerta a `javascript:`. Las dos únicas excepciones las decidió el
 * usuario el 2026-09-26 —llamar y escribir—, y el teléfono pasa a `tel:` reducido a dígitos y el
 * correo a `mailto:` sólo si tiene forma de correo. **No hay enlace a GoHighLevel.**
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { leerLeadDelPortal } from '@/lib/negocio/vistaDeLeadsPortal';

const fecha = (iso) =>
  iso ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—';
const fechaYHora = (iso) =>
  iso
    ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
        new Date(iso),
      )
    : '—';
const miles = (v) => Number(v).toLocaleString('es-PE');

/** Sólo dígitos y el `+` del prefijo: lo demás no le sirve a un marcador y abre la puerta a inyectar. */
function enlaceDeTelefono(t) {
  const limpio = (t ?? '').replace(/[^\d+]/g, '');
  return limpio.replace(/\D/g, '').length >= 6 ? `tel:${limpio}` : null;
}

/** Un correo con forma de correo, y nada más. Sin forma, el botón queda atenuado. */
function enlaceDeCorreo(c) {
  const t = (c ?? '').trim();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(t) ? `mailto:${t}` : null;
}

const iniciales = (n) =>
  (n ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '—';

export default function FichaDelLead({ id, alCerrar }) {
  const [estado, setEstado] = useState({ tipo: 'cargando' });
  const cerrarRef = useRef(null);

  useEffect(() => {
    let vigente = true;
    setEstado({ tipo: 'cargando' });
    leerLeadDelPortal(id).then((r) => {
      if (vigente) setEstado(r);
    });
    /* Si se abre otra ficha antes de que llegue ésta, la respuesta vieja no pisa a la nueva. */
    return () => {
      vigente = false;
    };
  }, [id]);

  /* El foco entra al cajón UNA vez, al abrirse, y Escape lo cierra. Al cerrarse, el panel devuelve
     el foco a la tarjeta que lo abrió.
     *
     Sin dependencias y con la función en una referencia, a propósito: el panel se vuelve a dibujar
     con cada recarga del reloj, y si este efecto dependiera de `alCerrar` el foco saltaría a la cruz
     cada vez, en medio de la lectura. */
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

  const f = estado.tipo === 'datos' ? estado.ficha : null;

  return createPortal(
    <>
      <div className="scrim on" onClick={alCerrar} aria-hidden="true" />
      <aside
        className="drawer on lp-ficha"
        id="lpFicha"
        role="dialog"
        aria-modal="true"
        aria-label={f ? `Ficha de ${f.nombre}` : 'Ficha del contacto'}
      >
        <div className="dw-head">
          <div>
            <h3>
              <span className="ld-head">
                <span className="ld-av">{f ? iniciales(f.nombre) : '—'}</span>
                {f ? f.nombre : estado.tipo === 'cargando' ? 'Leyendo la ficha…' : 'Ficha del contacto'}
              </span>
            </h3>
            {f ? <Meta f={f} /> : null}
          </div>
          <button type="button" className="dw-x" ref={cerrarRef} onClick={alCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="dw-body">
          {estado.tipo === 'no_esta' ? (
            <p className="lp-hueco">Este contacto ya no está, o no es de esta empresa.</p>
          ) : estado.tipo === 'fallo' ? (
            <p className="lp-hueco" role="alert">{estado.mensaje}</p>
          ) : f ? (
            <Contenido f={f} />
          ) : null}
        </div>
      </aside>
    </>,
    document.body,
  );
}

/** El puntaje con su tramo, en palabras. El 0 dice que es un 0 y cómo se cuenta. */
function textoDelPuntaje(p) {
  if (p.motivo === 'sin_puntaje') return 'sin puntaje · Sin calificar';
  if (p.motivo === 'en_cero') return '0, se cuenta como sin calificar';
  return `ICP ${p.valor} · ${p.rotulo}`;
}

function Meta({ f }) {
  return (
    <div className="m">
      {textoDelPuntaje(f.puntaje)} · entró el {fecha(f.altaEl)}
      {f.pais ? ` · ${f.pais}` : ''}
      {f.descarte.length > 0 ? <span className="lp-marca lp-marca-descarte">descartado: {f.descarte.join(', ')}</span> : null}
    </div>
  );
}

function Fila({ k, v, nota = null }) {
  return (
    <div className="kv" title={nota ?? undefined}>
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

function Paso({ ok, t, m, cuando = '' }) {
  return (
    <div className="ld-time">
      <span className={ok === true ? 'ld-dot ok' : ok === 'duda' ? 'ld-dot lp-duda' : 'ld-dot'} />
      <div>
        <div className="ld-t">{t}</div>
        <div className="ld-m">{m}</div>
      </div>
      <span className="ld-when">{cuando}</span>
    </div>
  );
}

function Huecos({ f, donde }) {
  const lista = f.huecos.lista.filter((h) => h.donde === donde);
  if (lista.length === 0) return null;
  return lista.map((h) => (
    <p key={h.punto} className="lp-hueco">
      <b>{h.punto}:</b> {h.porque}. <span className="lp-medido">Medido el {f.huecos.medidoEl}.</span>
    </p>
  ));
}

const ASISTENCIA = {
  asistio: [true, 'Asistió', 'registrado en Avanzar'],
  no_asistio: [false, 'No asistió', 'registrado en Avanzar'],
  sin_registrar: ['duda', 'Sin registrar', 'la cita ya debería haber ocurrido y nadie cargó si se presentó'],
};

const ESTADO_DE_CITA = { confirmed: 'confirmada', cancelled: 'cancelada', noshow: 'plantón según el calendario', showed: 'asistió según el calendario', new: 'nueva' };

function Contenido({ f }) {
  const tel = enlaceDeTelefono(f.telefono);
  const correo = enlaceDeCorreo(f.email);
  const r = f.recorrido;
  const asistencia = r.asistio.asistencia === null ? null : ASISTENCIA[r.asistio.asistencia];

  return (
    <>
      <div>
        <div className="ld-actions">
          {tel ? (
            <a className="ld-btn" href={tel}>✆ Llamar</a>
          ) : (
            <span className="ld-btn lp-apagado" aria-disabled="true" title="No hay un teléfono guardado">✆ Llamar</span>
          )}
          {correo ? (
            <a className="ld-btn" href={correo}>✉ Escribir</a>
          ) : (
            <span className="ld-btn lp-apagado" aria-disabled="true" title="No hay un correo guardado">✉ Escribir</span>
          )}
        </div>
      </div>

      <div>
        <div className="dw-sec-t">Recorrido</div>
        <div className="dw-block">
          <Paso ok t="Entró" m={`${r.entro.campana ?? '—'} · ${r.entro.creativo ?? '—'}`} cuando={fecha(r.entro.altaEl)} />
          <Paso ok t={`Llegó por: ${r.llegoPor.titulo}`} m={r.llegoPor.que} cuando="último toque" />
          <Paso
            ok={r.agendo.estado === 'agendo' ? true : r.agendo.estado === 'solo_congeladas' ? 'duda' : false}
            t="Agendó"
            m={
              r.agendo.estado === 'solo_congeladas'
                ? 'tuvo cita, y el CRM ya no devuelve en qué quedó'
                : r.agendo.estado === 'sin_cita'
                  ? 'sin cita'
                  : r.agendo.todasCanceladas
                    ? 'agendó y canceló'
                    : 'agendó'
            }
            cuando={r.agendo.primeraCitaEl ? fecha(r.agendo.primeraCitaEl) : ''}
          />
          <Paso
            ok={asistencia ? asistencia[0] : false}
            t={asistencia ? asistencia[1] : 'Asistió'}
            m={
              (asistencia ? asistencia[2] : 'no aplica: no hubo una cita que ya debiera haber ocurrido') +
              (r.asistio.planton ? ' · el calendario marcó un plantón, que se cuenta aparte' : '')
            }
          />
          <Paso
            ok={r.compro.vendio}
            t="Compró"
            m={
              r.compro.vendio
                ? r.compro.monto === null
                  ? 'venta registrada, sin monto'
                  : `$${miles(r.compro.monto)} reportado por el closer`
                : r.compro.acuerdoSinPago
                  ? 'acordó comprar, todavía no pagó'
                  : 'sin venta registrada'
            }
          />
          <Huecos f={f} donde="vsl" />
        </div>
      </div>

      <div>
        <div className="dw-sec-t">Cuestionario de calificación</div>
        {f.cuestionario.length === 0 ? (
          <p className="lp-hueco">No hay respuestas del cuestionario guardadas para este contacto.</p>
        ) : (
          <div className="kv-box">
            {f.cuestionario.map((x) => (
              <Fila key={x.etiqueta} k={x.etiqueta} v={x.valor} />
            ))}
          </div>
        )}
        <div className="kv-box">
          <Fila
            k="Formulario de la landing"
            v={f.formulario.valor ?? '—'}
            nota="Es lo que escribió el formulario, no si hay cita: el paso «Agendó» sale de las citas."
          />
        </div>
        {f.formulario.valor === null && f.formulario.despuesDelCorte ? (
          <p className="lp-hueco">
            El campo no se escribe desde el {f.formulario.corte}: este contacto entró después, así que el vacío no dice que no
            lo completó.
          </p>
        ) : null}
      </div>

      <div>
        <div className="dw-sec-t">Video precall</div>
        <div className="kv-box">
          <Fila k="Lo que registró el CRM" v={f.precall.valor ?? '—'} />
        </div>
        {f.precall.sinReproduccionRegistrada ? (
          <p className="lp-hueco">Es el valor que el CRM escribe al agendar: no registró ninguna reproducción.</p>
        ) : null}
      </div>

      <div>
        <div className="dw-sec-t">Interacciones</div>
        <div className="kv-box">
          <Fila k="Último mensaje recibido" v={fechaYHora(f.mensajes.ultimoEntranteEl)} />
          <Fila k="Último mensaje enviado" v={fechaYHora(f.mensajes.ultimoSalienteEl)} />
          <Fila
            k="Mensajes"
            v={f.mensajes.historiaLeida ? `${miles(f.mensajes.entrantes)} recibidos · ${miles(f.mensajes.salientes)} enviados` : 'no se leyó su historia'}
          />
        </div>
        {f.citas.length > 0 ? (
          <div className="kv-box">
            {f.citas.map((c, i) => (
              <Fila
                key={`${c.inicioEl}-${i}`}
                k={fechaYHora(c.inicioEl)}
                v={[
                  ESTADO_DE_CITA[(c.estado ?? '').toLowerCase()] ?? c.estado ?? 'sin estado',
                  c.alcanzable ? null : 'congelada',
                  c.asistio === true ? 'asistió' : c.asistio === false ? 'no asistió' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </div>
        ) : null}
        {f.resultados.length > 0 ? (
          <div className="kv-box">
            {f.resultados.map((x, i) => (
              <Fila
                key={`${x.creadoEl}-${i}`}
                k={fecha(x.creadoEl)}
                v={x.monto === null ? x.nombre : `${x.nombre} · $${miles(x.monto)}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <div className="dw-sec-t">Parámetros de publicidad</div>
        {f.publicidad.length === 0 ? (
          <p className="lp-hueco">El CRM no guardó parámetros de publicidad para este contacto.</p>
        ) : (
          <div className="kv-box">
            {f.publicidad.map((x) => (
              <Fila key={x.clave} k={x.rotulo} v={x.valor} nota={x.nota} />
            ))}
          </div>
        )}
        <Huecos f={f} donde="publicidad" />
      </div>

      <div>
        <div className="dw-sec-t">Calificación</div>
        <div className="kv-box">
          <Fila k="Puntaje ICP" v={textoDelPuntaje(f.puntaje)} nota="Lo calcula el CRM, no Comando Central." />
          <Fila k="Descarte" v={f.descarte.length > 0 ? f.descarte.join(', ') : 'no'} />
        </div>
        <Huecos f={f} donde="calificacion" />
      </div>

      <div>
        <div className="dw-sec-t">Contacto</div>
        <div className="kv-box">
          <Fila k="Teléfono" v={f.telefono ?? '—'} />
          <Fila k="Correo" v={f.email ?? '—'} />
          <Fila
            k="Closer asignado"
            v={
              f.closer.estado === 'asignado'
                ? f.closer.nombre
                : f.closer.estado === 'no_configurado'
                  ? 'asignado en el CRM a alguien que no es un closer configurado'
                  : 'sin asignar en el CRM'
            }
          />
          <Fila
            k="Última sincronización"
            v={fechaYHora(f.sincronizadoEl)}
            nota={f.territorio === 'congelado' ? 'Contacto congelado: ya no se refresca, así que esto es la última foto.' : undefined}
          />
        </div>
      </div>
    </>
  );
}
