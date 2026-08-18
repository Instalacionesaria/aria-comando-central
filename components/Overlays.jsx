/* Portado de aios-command-center_1.html — scrims, drawers y modales, líneas 3207-3319. */
export default function Overlays() {
  return (
    <>
    {/* ================= GRUPO DE CONTACTOS ================= */}
    <div className="scrim" id="lgScrim" />
    <aside className="lg" id="lgPanel" aria-hidden="true">
      <div className="lg-h">
        <div>
          <div className="lg-t" id="lgTitle">
            Contactos
          </div>
          <div className="lg-s" id="lgSub" />
        </div>
        <span className="cw-x" id="lgClose" style={{ marginLeft: 'auto' }}>
          ✕
        </span>
      </div>
      <div className="lg-b" id="lgBody" />
      <div className="lg-f">
        <button className="lg-open" id="lgOpen">
          Abrir en Leads Portal →
        </button>
        <span className="lg-count" id="lgCount" />
      </div>
    </aside>
    {/* ================= CONTACTO DEL CLOSER ================= */}
    <div className="scrim" id="cwScrim" />
    <aside className="cw" id="cwPanel" aria-hidden="true">
      <div className="cw-h">
        <div className="cw-top">
          <span className="cw-av" id="cwAv">
            AR
          </span>
          <div>
            <div className="cw-n" id="cwName">
              Andres Rendon
            </div>
            <div className="cw-p" id="cwPhone">
              +57 317 500 7777
            </div>
          </div>
          <button
            className="cw-pin"
            style={{ marginLeft: 'auto' }}
            onClick={() => { window.open('https://app.gohighlevel.com/','_blank') }}
          >
            ↗ Ver en GHL
          </button>
          <span className="cw-x" id="cwClose">
            ✕
          </span>
        </div>
        <div className="cw-meta">
          <span className="tagx ag" id="cwState">
            Agendado
          </span>
          <span className="cw-acts">
            <i title="Video">
              ▢
            </i>
            <i title="Agenda">
              ▤
            </i>
            <i title="Llamadas">
              ✆ 1
            </i>
            <i title="Bot">
              ◈
            </i>
            <i title="Recordar">
              ◷
            </i>
            <i title="Cobrar">
              $
            </i>
          </span>
        </div>
        <button className="cw-go" id="cwAdvance">
          Avanzar →
        </button>
      </div>
      <div className="cw-tabs" id="cwTabs">
        <button data-t="chat" className="on">
          ◔ Chat
        </button>
        <button data-t="llamada">
          ✆ Llamada
        </button>
        <button data-t="perfil">
          ☰ Perfil
        </button>
        <button data-t="historial">
          ◷ Historial
        </button>
        <button data-t="notas">
          ▤ Notas
        </button>
      </div>
      <div className="cw-body" id="cwBody" />
      <div className="cw-input">
        <input type="text" placeholder="Escribe un mensaje…" />
        <button className="cw-send">
          ⏎
        </button>
      </div>
    </aside>
    {/* ================= RESULTADO ================= */}
    <div className="scrim" id="resScrim" />
    <div className="res" id="resModal" role="dialog">
      <span className="res-x" id="resClose">
        ✕
      </span>
      <div className="res-h">
        <div className="res-k">
          Resultado · llamada o chat
        </div>
        <div className="res-t">
          ¿Cómo terminó?
        </div>
        <div className="res-d">
          Sirve igual tras una llamada o tras el chat. Un clic mueve el pipeline y dispara lo que corresponda.
        </div>
      </div>
      <div className="res-g" id="resOpts" />
    </div>
    <div className="scrim" id="askScrim" />
    <div className="ask-panel" id="askPanel" aria-hidden="true">
      <div className="ap-head">
        <span className="ap-ic">
          ◈
        </span>
        <div>
          <div className="ap-t">
            Executive Intelligence
          </div>
          <div className="ap-s">
            respondiendo con datos de{' '}
            <b id="askCtx">
              Executive
            </b>
            {' '}·{' '}
            <span id="askCtxP">
              7 días
            </span>
          </div>
        </div>
        <button className="dw-x" id="askClose">
          ✕
        </button>
      </div>
      <div className="ap-body" id="askBody">
        <div className="ap-empty">
          <div className="ap-e-t">
            Preguntas frecuentes en esta sección
          </div>
          <div className="ap-chips" id="askChips" />
        </div>
      </div>
      <div className="ap-input">
        <input type="text" id="askInput" placeholder="Escribe tu pregunta…" autoComplete="off" />
        <button className="ap-send" id="askSend">
          ⏎
        </button>
      </div>
    </div>
    <div className="scrim" id="scrim" style={{ zIndex: '96' }} />
    <div className="scrim" id="recoScrim" />
    <div
      className="reco-modal"
      id="recoModal"
      aria-hidden="true"
      aria-label="Recomendaciones y conclusiones"
    >
      <div className="reco-head">
        <div>
          <h3>
            Recomendaciones y conclusiones
          </h3>
          <div className="reco-sub" id="recoSub">
            —
          </div>
        </div>
        <button className="dw-x" id="recoClose" aria-label="Cerrar">
          ✕
        </button>
      </div>
      <div className="reco-body" id="recoBody" />
    </div>
    <aside className="drawer" id="drawer" aria-hidden="true" aria-label="Detalle del contenido">
      <div className="dw-head">
        <div>
          <h3 id="dwTitle">
            —
          </h3>
          <div className="m" id="dwMeta">
            —
          </div>
          <div id="dwVerdict" />
        </div>
        <button className="dw-x" id="dwClose" aria-label="Cerrar">
          ✕
        </button>
      </div>
      <div className="dw-body" id="dwBody" />
    </aside>
    </>
  );
}
