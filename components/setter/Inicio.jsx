'use client';

/* Inicio del Setter — el cockpit. Responde: ¿cómo voy este mes?
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * NO ES EL COCKPIT DEL CLOSER CON OTROS RÓTULOS
 *
 * Tres diferencias, y ninguna es cosmética:
 *
 * **1 · El sujeto es QUIEN MIRA.** El del closer muestra siempre al designado —`closer_asignado`
 * tiene `org_id` como clave primaria entera— y por eso tiene que decir de quién son los números y
 * esconder el botón de la meta a los demás. Acá no hay a quién designar: el setter es multi-persona
 * por construcción, el disparador del sello existe justamente porque *«el segundo setter no le roba
 * la atribución al primero»*. Así que los números son de quien abre la pantalla, sin ambigüedad, y
 * la meta siempre es suya.
 *
 * **2 · Hay DOS anillos, no uno.** El setter cobra por dos hechos distintos: sus ventas chicas, y el
 * tramo diferido sobre las ventas grandes que cierra el closer en los leads que él originó. Cada uno
 * con su porcentaje, su meta y su motivo de ausencia. Un anillo único sobre la suma no se podría
 * atribuir a ninguno de los dos.
 *
 * **3 · El número grande es CHICO, y se dice.** «Vendido» acá son ventas chicas, no el ticket alto.
 * Poner los dos con la misma tipografía y el mismo rótulo haría que un setter y un closer
 * comparándose lean dos cosas distintas con la misma etiqueta.
 *
 * ── LA REGLA QUE MANDA, IGUAL QUE EN EL OTRO ────────────────────────────────
 *
 * El `11` § 4: **un cero medido y un cero no medido no son el mismo hecho.** El servidor manda cada
 * indicador como `{ valor, falta }` con `valor: null` cuando no hay fuente, así que esta pantalla no
 * lo adivina: lo dibuja. Un `?? 0` acá borraría la distinción entera.
 *
 * ── Y LOS DOS HUECOS QUE SE MUESTRAN COMO HUECOS ────────────────────────────
 *
 * «Agendas del agente» y «Tasa de asistencia» viajan nulas con su motivo, y se dibujan igual. No se
 * ocultan: una baldosa que desaparece se lee como «eso no existe», y lo que pasa es que todavía no se
 * puede medir. `negocio.citas` no guarda quién creó la cita y nadie marca la asistencia.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import Comision from '../negocio/Comision.jsx';

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
 * Una baldosa.
 *
 * `s` es la nota de abajo: cuando el valor es nulo lleva **qué falta**, y cuando hay valor lleva su
 * aclaración. Nunca queda vacía — una baldosa con un guión y nada más no dice si el dato es cero, si
 * falta, o si la pantalla se rompió.
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
  mirandoOtraOrganizacion,
  alGuardarLaMeta,
  alIrAMiDia,
}) {
  if (!cockpit || !comision) {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando el tablero…</span>
      </div>
    );
  }

  const c = cockpit;
  const sinVendido = c.vendidoChico.valor === null;

  return (
    <>
      {/* ── El hero: lo cobrado en ventas chicas ── */}
      <div className="ck-hero ck-hero-dos">
        <div>
          {/* DICE QUE ES CHICO. Es parte de lo que el número afirma: «vendido» a secas, con la
              tipografía del número grande del closer, se lee como el ticket alto — y un setter
              comparando su tablero con el del closer leería dos cosas distintas con la misma
              etiqueta. */}
          <span className="ck-tag">◈ Vendido chico · {c.mes}</span>
          <div className="ck-big" style={sinVendido ? { color: 'var(--txt-faint)' } : undefined}>
            {plata(c.vendidoChico.valor)}
            {!sinVendido ? <span>ventas chicas que cerraste vos</span> : null}
          </div>
          {/* La nota dice QUÉ FALTA cuando falta. Es lo que hace que un `—` sea un diagnóstico en
              vez de un hueco. */}
          <div className="ck-note">
            <span className="pt" style={sinVendido ? { background: 'var(--warn)' } : undefined} />
            <em>
              {c.vendidoChico.falta ??
                'Producto chico. El ticket alto lo cierra el closer, y te paga el tramo diferido.'}
            </em>
          </div>

          <div className="ck-row">
            <Baldosa
              k="Ventas chicas"
              v={cifra(c.ventasChicas.valor)}
              s={c.ventasChicas.falta ?? 'registradas este mes'}
              color="var(--ok)"
            />
            <Baldosa
              k="Agendas tuyas"
              v={cifra(c.agendas.valor)}
              /* Dice «tuyas» porque es lo único que puede decir con verdad: cuenta resultados que
                 esta persona registró. Las del agente están en la baldosa de al lado, vacía. */
              s={c.agendas.falta ?? 'agendadas a mano por vos'}
              color="var(--accent)"
            />
            <Baldosa
              k="Agendas del agente"
              v={cifra(c.agendasDelAgente.valor)}
              s={c.agendasDelAgente.falta ?? 'agendadas por el agente'}
              color="var(--exec)"
            />
            <Baldosa
              k="Tasa de asistencia"
              v={c.tasaDeAsistencia.valor === null ? '—' : `${c.tasaDeAsistencia.valor}%`}
              s={c.tasaDeAsistencia.falta ?? 'de las citas que agendaste'}
              color="var(--exec)"
            />
          </div>
        </div>

        {/* ── LOS DOS ANILLOS ─────────────────────────────────────────────────
            Van uno arriba del otro en la columna derecha, y en este orden: el directo primero porque
            depende solo del trabajo de esta persona, y el diferido después porque depende de que su
            closer venda.

            Los dos son el MISMO componente, con los ocho estados en un solo lugar. Copiarlo para el
            segundo tramo habría sido lo barato, y es el defecto que ese archivo existe para evitar:
            un `?? 0` en una copia convierte «nadie lo configuró» en «no cobrás comisión» en un solo
            anillo, y el otro se ve bien al lado. */}
        <div className="ck-anillos">
          <Comision
            comision={comision.directo}
            mirandoOtraOrganizacion={mirandoOtraOrganizacion}
            /* Siempre suya: el sujeto de este cockpit es quien mira. Ver el encabezado. */
            puedeFijarLaMeta={!mirandoOtraOrganizacion}
            rutaDeLaMeta={'/api/setter/meta'}
            cuerpoExtra={{ tramo: 'setter_directo' }}
            rotulo={'las ventas chicas que cerraste este mes'}
            tituloDeLaMeta="Mi meta de ventas chicas"
            etiqueta="Directo · ventas chicas"
            alGuardar={alGuardarLaMeta}
          />
          <Comision
            comision={comision.diferido}
            mirandoOtraOrganizacion={mirandoOtraOrganizacion}
            puedeFijarLaMeta={!mirandoOtraOrganizacion}
            rutaDeLaMeta={'/api/setter/meta'}
            cuerpoExtra={{ tramo: 'setter_diferido' }}
            /* El rótulo del diferido nombra al closer, y hace falta: sin eso, un anillo en cero se
               lee como «no trabajaste» cuando lo que pasa es que la venta todavía no ocurrió. */
            rotulo={'las ventas del closer en los leads que originaste'}
            tituloDeLaMeta="Mi meta del tramo diferido"
            etiqueta="Diferido · leads que originaste"
            alGuardar={alGuardarLaMeta}
          />
        </div>
      </div>

      {/* ── LOS TRES CONTADORES ── */}
      <div className="md-counters">
        <div className="md-cn">
          <span className="ic md-ic-acento">◈</span>
          <span className="l">Leads que originaste</span>
          {/* Es un conteo MEDIDO y en total, no del mes: el sello de marzo es lo que hace que la
              venta de julio pague. Cero acá significa que todavía no originó ninguno. */}
          <span
            className="n"
            style={{ color: comision.leadsAtribuidos ? 'var(--accent)' : 'var(--txt-faint)' }}
          >
            {cifra(comision.leadsAtribuidos)}
          </span>
        </div>
        <div className="md-cn">
          <span className="ic md-ic-crit">✕</span>
          <span className="l">Descalificados este mes</span>
          <span
            className="n"
            style={{ color: c.descalificados.valor ? 'var(--crit)' : 'var(--txt-faint)' }}
          >
            {cifra(c.descalificados.valor)}
          </span>
        </div>
        <div className="md-cn">
          <span className="ic md-ic-warn">↻</span>
          <span className="l">Tareas para hoy</span>
          <span
            className="n"
            style={{ color: c.tareasPendientes.valor ? 'var(--warn)' : 'var(--txt-faint)' }}
          >
            {cifra(c.tareasPendientes.valor)}
          </span>
        </div>
      </div>

      {/* ── El puente a Mi Día. TODA la tarjeta es clicable, no solo el texto. ── */}
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
            {/* Se dice de dónde sale el número: son CINCO categorías —urgentes, buzón,
                oportunidades, estancadas y los seguimientos que piden manos— y no las tres del
                closer. Sin la aclaración, un setter que ve las seis secciones más largas que el
                contador cree que el contador está mal. */}
            <span>urgentes, buzón, oportunidades, estancadas y los seguimientos con manos</span>
          </div>
        </div>
      </div>
    </>
  );
}
