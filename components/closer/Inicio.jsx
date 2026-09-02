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
 * logro."* Ahora la comisión SÍ se configura, y el anillo vive en `Comision.jsx` con los ocho
 * estados que eso abre — incluido el que este comentario nombra: meta superada exige que la
 * comisión sea mayor que cero, y no solo que falte cero para la meta.
 *
 * Un detalle que importa: el «Cobrado» del hero es de **toda la empresa** y la comisión trae su
 * propia base, la de las ventas que registró quien mira. Son dos números con dos rótulos, y
 * multiplicar el primero por un porcentaje personal habría dado un número plausible y más alto.
 *
 * ── LO QUE ESTA PANTALLA NO CUESTA ──────────────────────────────────────────
 *
 * Cero llamadas a GoHighLevel. El `04` § 8 lo pone en su tabla: las cuatro pantallas que el
 * closer mira todo el día cuestan **0**. Todo el presupuesto se gasta en TRAER los datos, una
 * vez, cuando cambian.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import Comision from '../negocio/Comision.jsx';
import QuienEsElCloser from './QuienEsElCloser.jsx';
import EnlacesRapidos from '../negocio/EnlacesRapidos.jsx';

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

export default function Inicio({
  cockpit,
  comision,
  /* De QUIÉN son los números de esta pantalla. `null` = nadie designado.
     Antes esta pregunta no existía: el número grande era de toda la empresa y el anillo de quien
     miraba. Ahora el cockpit tiene un sujeto y la pantalla tiene que decir cuál es — mostrar los
     números de una persona sin nombrarla es lo que hacía que dos lecturas del mismo tablero
     significaran cosas distintas según quién lo abriera. */
  /** Los closers configurados. Vacia = nadie, y entonces todos ven todo. */
  closers,
  /** De quien son los numeros que se estan mostrando. `null` = de toda la empresa. */
  mirando,
  /** `true` = esta persona ve TODO, asi que se le puede ofrecer el selector. Lo decide el servidor. */
  puedeVerTodo,
  verComo,
  alVerComo,
  /** `true` si quien mira ES el closer cuyos numeros se muestran. Lo decide el servidor. La META. */
  soyElCloser,
  mirandoOtraOrganizacion,
  puedeConfigurarComisiones,
  alGuardarLaMeta,
  alRecargar,
  alIrAMiDia,
}) {
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
      {/* ── EL SELECTOR «VER COMO» ────────────────────────────────────────
          Solo para quien ve todo, y lo decide el SERVIDOR con `puedeVerTodo`. Ofrecerselo a un
          closer seria un control que no puede cumplir: el servidor ignora el parametro cuando el
          alcance propio no es `todo`, asi que lo apretaria y no pasaria nada.

          Y solo si hay al menos un closer VINCULADO: sin vinculo esa persona no tiene numeros
          propios, asi que su opcion daria exactamente lo mismo que «toda la empresa». */}
      {puedeVerTodo && (closers ?? []).some((k) => k.vinculado) ? (
        <div className="ck-vercomo">
          <label htmlFor="ck-vercomo">Ver los números de</label>
          <select
            id="ck-vercomo"
            value={verComo ?? ''}
            onChange={(e) => alVerComo?.(e.target.value || null)}
          >
            <option value="">Toda la empresa</option>
            {(closers ?? [])
              .filter((k) => k.vinculado)
              .map((k) => (
                <option key={k.usuarioId} value={k.usuarioId}>
                  {k.nombre}
                </option>
              ))}
          </select>
        </div>
      ) : null}

      {/* ── El hero: lo cobrado del mes ── */}
      <div className="ck-hero">
        <div>
          {/* DE QUIÉN Y DE CUÁNDO. El nombre va en el rótulo del número grande y no en una nota al
              pie, porque es parte de lo que el número afirma: «cobrado de Ana en agosto» es un hecho
              distinto de «cobrado de la empresa en agosto», y hasta ahora la pantalla mostraba el
              segundo con la forma del primero. */}
          <span className="ck-tag">
            ◈ Cobrado · {c.mes}
            {mirando ? <> · {mirando.nombre}</> : null}
          </span>
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

        {/* ── La columna derecha: el anillo de comisión ──
            Estaba fijo en «Sin comisión configurada / Cargá tu porcentaje y tu meta», y ese texto era
            **imposible de seguir**: no había dónde cargar ninguna de las dos cosas. Y la mitad era
            además falsa — el porcentaje no lo carga la persona, lo fija quien administra.

            `Comision.jsx` tiene los ocho estados, y la regla que los gobierna es la misma de todo el
            cockpit: un cero medido y un cero sin medir no son el mismo hecho. Acá con una vuelta más,
            porque son DOS mitades —el porcentaje y la base— y cualquiera puede faltar por separado. */}
        <Comision
          comision={comision}
          mirandoOtraOrganizacion={mirandoOtraOrganizacion}
          puedeFijarLaMeta={soyElCloser}
          /* Los DOS motivos de que no haya comisión, separados. Sin esto, quien mira toda la
             empresa lee «todavía no hay ningún closer configurado» teniendo tres. */
          sinComision={(closers ?? []).length === 0 ? 'sin_closer' : 'toda_la_empresa'}
          rutaDeLaMeta={'/api/closer/meta'}
          alGuardar={alGuardarLaMeta}
          alRecargar={alRecargar}
        />
      </div>

      {/* ── QUIÉN ES EL CLOSER, Y CUÁNTO COBRA ──────────────────────────
          Solo para quien administra, y lo decide el SERVIDOR (`sesion.puedeConfigurarComisiones`,
          que es `credenciales.editar`) con la condición exacta de los dos endpoints que el panel
          llama. Una condición propia acá sería una segunda respuesta a la misma pregunta.

          Va al FINAL del cockpit y no arriba: quien administra entra a esta pantalla de vez en
          cuando, y quien la usa todos los días es el closer. Poner la configuración primero le
          daría el lugar de honor a lo que casi nunca se toca. */}
      {puedeConfigurarComisiones ? <QuienEsElCloser alCambiar={alRecargar} /> : null}

      {/* ── LOS LINKS DE COBRO ──────────────────────────────────────────
          Misma puerta y por la misma razón: `credenciales.editar` es «quién configura la
          empresa», y estos links deciden **a qué cuenta le paga un lead**. La bandera se llama
          `puedeConfigurarComisiones` porque nació con las comisiones; hoy abre más de lo que su
          nombre dice, y renombrarla toca la ruta de sesión y sus pruebas.

          Y NO se dibuja mirando otra empresa, igual que el panel gemelo del Setter: estos links
          son la cuenta a la que le paga un lead, y cargarlos desde una visita significa poner
          NUESTRO cobro en el menú de un cliente. Es exactamente el defecto por el que los links
          se configuran por empresa y no en el código.

          Debajo de los closers y no arriba: los closers son QUIÉN cierra, y esto es una
          herramienta que usan. `alCambiar` no le hace falta — no mueve ningún número del
          cockpit, así que recargarlo sería pedir datos que no cambiaron. */}
      {puedeConfigurarComisiones && !mirandoOtraOrganizacion ? (
        <EnlacesRapidos territorio="closer" />
      ) : null}

      {/* ── El no-show, que sí es un conteo real ── */}
      <div className="md-counters">
        <div className="md-cn">
          <span className="ic md-ic-crit">!</span>
          <span className="l">No-shows registrados</span>
          <span className="n" style={{ color: c.noShows.valor ? 'var(--crit)' : 'var(--txt-faint)' }}>
            {cifra(c.noShows.valor)}
          </span>
        </div>
        <div className="md-cn">
          <span className="ic md-ic-acento">◔</span>
          <span className="l">Con cita agendada</span>
          <span className="n" style={{ color: 'var(--accent)' }}>
            {cifra(c.conCitaAgendada.valor)}
          </span>
        </div>
        <div className="md-cn">
          <span className="ic md-ic-warn">↻</span>
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
