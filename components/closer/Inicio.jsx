'use client';

/* Inicio — el cockpit. Responde UNA sola pregunta: ¿cómo voy este mes?
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LA REGLA QUE MANDA, Y ES LA MÁS FÁCIL DE ROMPER EN UNA PANTALLA DE MÉTRICAS
 *
 * El `11` § 4: **un cero medido y un cero no medido no son el mismo hecho.**
 *
 *   · No hay datos cargados → `—`, con una línea que diga qué falta.
 *   · Hay datos y el resultado es cero → `0`, atenuado.
 *
 * *"Un `$0` donde nadie cargó montos afirma «no vendiste nada». Es falso, y nadie reporta un
 * panel que simplemente parece vacío."*
 *
 * El servidor manda cada indicador como `{ valor, falta }` con `valor: null` cuando no hay
 * fuente, así que esta pantalla no lo adivina: lo dibuja. Un `?? 0` acá borraría la distinción
 * entera.
 *
 * ── Y LAS DOS REGLAS PROPIAS DEL COCKPIT ────────────────────────────────────
 *
 * Del `11` § 5.1: *"sin comisión configurada va `—`, nunca `$0`. Y «meta superada» NO aparece
 * si la comisión es cero, aunque la meta también lo sea: un porcentaje sobre base cero no es un
 * logro."* Todavía no hay comisión configurable, así que el anillo no se dibuja — en vez de
 * dibujar un anillo al 0% que afirmaría un progreso medido.
 *
 * ── LO QUE ESTA PANTALLA NO CUESTA ──────────────────────────────────────────
 *
 * Cero llamadas a GoHighLevel. El `04` § 8 lo pone en su tabla: las cuatro pantallas que el
 * closer mira todo el día cuestan **0**. Todo el presupuesto se gasta en TRAER los datos, una
 * vez, cuando cambian.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** Un monto. `null` → `—`. Nunca `$0` sin dato medido. */
function plata(v) {
  if (v === null || v === undefined) return '—';
  return `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Un número. Igual: `null` → `—`, `0` → `0`. */
function cifra(v) {
  if (v === null || v === undefined) return '—';
  return String(v);
}

/**
 * Una de las cuatro baldosas.
 *
 * `s` es la nota de abajo: cuando el valor es nulo lleva **qué falta**, y cuando hay valor
 * lleva su aclaración. Nunca queda vacía — una baldosa con un guión y nada más no dice si el
 * dato es cero, si falta, o si la pantalla se rompió.
 */
function Baldosa({ k, v, s, color }) {
  const sinDato = v === '—';
  return (
    <div className="ck-i">
      <div className="k">{k}</div>
      <div className="v" style={{ color: sinDato ? 'var(--txt-faint)' : color }}>
        {v}
      </div>
      <div className="s">{s}</div>
    </div>
  );
}

export default function Inicio({ cockpit, alIrAMiDia }) {
  if (!cockpit) {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando el tablero…</span>
      </div>
    );
  }

  const c = cockpit;
  const sinCobrado = c.cobrado.valor === null;

  return (
    <>
      {/* ── El hero: lo cobrado del mes ── */}
      <div className="ck-hero">
        <div>
          <span className="ck-tag">◈ Cobrado · {c.mes}</span>
          <div className="ck-big" style={sinCobrado ? { color: 'var(--txt-faint)' } : undefined}>
            {plata(c.cobrado.valor)}
            {!sinCobrado ? <span>cobrado real, no prometido</span> : null}
          </div>
          {/* La nota dice QUÉ FALTA cuando falta. Es la línea que el § 4 pide y la que hace que
              un `—` sea un diagnóstico en vez de un hueco. */}
          <div className="ck-note">
            <span className="pt" style={sinCobrado ? { background: 'var(--warn)' } : undefined} />
            <em>{c.cobrado.falta ?? 'Cobrado real del mes. Los acuerdos sin pagar van aparte.'}</em>
          </div>

          <div className="ck-row">
            <Baldosa
              k="Ventas"
              v={cifra(c.ventas.valor)}
              s={c.ventas.falta ?? 'registradas este mes'}
              color="var(--ok)"
            />
            <Baldosa
              k="Acuerdos sin pagar"
              v={cifra(c.acuerdos.valor)}
              s={c.acuerdos.falta ?? 'plata comprometida'}
              color="var(--warn)"
            />
            <Baldosa
              k="Con cita agendada"
              v={cifra(c.conCitaAgendada.valor)}
              /* NO dice «del mes», y es a propósito: el número sale de la etiqueta
                 `cita_agendada` y una etiqueta no trae fecha. Decir «del mes» inventaría el
                 recorte temporal. */
              s={c.conCitaAgendada.falta ?? 'contactos con cita (la etiqueta no trae fecha)'}
              color="var(--accent)"
            />
            <Baldosa
              k="Tasa de asistencia"
              v={c.tasaDeAsistencia.valor === null ? '—' : `${c.tasaDeAsistencia.valor}%`}
              s={c.tasaDeAsistencia.falta ?? 'de las citas del mes'}
              color="var(--exec)"
            />
          </div>
        </div>

        {/* ── La columna derecha: el anillo de comisión ── */}
        <div className="ck-ring">
          {/* NO se dibuja un anillo al 0%. El § 5.1: «meta superada» no aparece si la comisión
              es cero, aunque la meta también lo sea — un porcentaje sobre base cero no es un
              logro. Y sin comisión configurada, un anillo vacío afirmaría un progreso medido
              que nadie midió. */}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--txt-dim)', lineHeight: 1.6 }}>
            <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--txt-faint)' }}>—</div>
            <div style={{ marginTop: 8 }}>Sin comisión configurada</div>
            <div style={{ fontSize: 11, color: 'var(--txt-faint)', marginTop: 6 }}>
              Cargá tu porcentaje y tu meta para ver cuánto falta.
            </div>
          </div>
        </div>
      </div>

      {/* ── El no-show, que sí es un conteo real ── */}
      <div className="md-counters">
        <div className="md-cn">
          <span className="ic" style={{ background: 'rgba(240,92,92,.12)', color: 'var(--crit)' }}>
            !
          </span>
          <span className="l">No-shows registrados</span>
          <span className="n" style={{ color: c.noShows.valor ? 'var(--crit)' : 'var(--txt-faint)' }}>
            {cifra(c.noShows.valor)}
          </span>
        </div>
        <div className="md-cn">
          <span className="ic" style={{ background: 'rgba(53,224,210,.10)', color: 'var(--accent)' }}>
            ◔
          </span>
          <span className="l">Con cita agendada</span>
          <span className="n" style={{ color: 'var(--accent)' }}>
            {cifra(c.conCitaAgendada.valor)}
          </span>
        </div>
        <div className="md-cn">
          <span className="ic" style={{ background: 'rgba(240,136,76,.12)', color: 'var(--warn)' }}>
            ↻
          </span>
          <span className="l">Tareas para hoy</span>
          <span className="n" style={{ color: c.tareasPendientes.valor ? 'var(--warn)' : 'var(--txt-faint)' }}>
            {cifra(c.tareasPendientes.valor)}
          </span>
        </div>
      </div>

      {/* ── El puente a Mi Día. TODA la tarjeta es clicable, no solo el botón (§ 5.1). ── */}
      <div
        className="cl-tasks"
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        onClick={() => alIrAMiDia?.()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            alIrAMiDia?.();
          }
        }}
      >
        <span className="clt-ic">→</span>
        <div>
          <div className="clt-t">
            {c.tareasPendientes.valor === 0
              ? 'Nada pendiente en Mi Día'
              : `${c.tareasPendientes.valor} tarea(s) pendientes en Mi Día`}
          </div>
          <div className="clt-m">
            {/* Se dice de dónde sale el número: cuenta lo que PIDE MANOS, no todo lo de la
                lista. Sin esa aclaración, un closer que ve la lista más larga que el contador
                cree que el contador está mal. */}
            <span>cuenta lo que necesita una persona, no las series automáticas</span>
          </div>
        </div>
      </div>
    </>
  );
}
