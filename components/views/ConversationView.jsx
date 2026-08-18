/* Portado de aios-command-center_1.html — vista, líneas 2865-2929. */
export default function ConversationView() {
  return (
    <>
    <section className="view" id="v-conversation">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>
                Conversation
              </h2>
              <span className="cre-desc">
                Dos misiones, cuatro agentes · agendar y hacer que asistan
              </span>
            </div>
            <div className="mode-seg" id="csMode">
              <button data-m="estado" className="on">
                <svg viewBox="0 0 16 16">
                  <use href="#i-chat" />
                </svg>
                Estado
              </button>
              <button data-m="agentes">
                <svg viewBox="0 0 16 16">
                  <use href="#i-setter" />
                </svg>
                Agentes
              </button>
            </div>
          </div>
          <div className="ch-r">
            <button className="reco-btn" id="csPlanBtn">
              <span className="rb-ic">
                ◈
              </span>
              Plan de acción
            </button>
            <div className="ch-period">
              <span className="cmp-note" id="csCmp">
                vs los 7 días previos
              </span>
              <div className="db-seg" id="csPeriod">
                <button data-p="hoy">
                  Hoy
                </button>
                <button data-p="7d" className="on">
                  7 días
                </button>
                <button data-p="mes">
                  30 días
                </button>
              </div>
              <button className="pill" data-datepick="cs" id="csPill">
                <span className="pv">
                  Personalizado
                </span>
                <span className="pc">
                  ⌄
                </span>
              </button>
            </div>
          </div>
        </div>
        <section className="cs-panels" id="csStats" />
        <div className="cs-view" id="csEstado">
          <div className="ghead">
            <span
              className="gdot"
              style={{ background: 'var(--accent)', boxShadow: '0 0 8px rgba(53,224,210,.5)' }}
             />
            <span className="gt">
              Los dos flujos
            </span>
            <span className="gsub">
              cada uno con su propia misión y su cadena
            </span>
          </div>
          <div className="cs-flows" id="csFlows" />
        </div>
        <div className="cs-view" id="csAgentes" hidden>
          <div className="ghead">
            <span className="gdot" style={{ background: 'var(--txt-faint)' }} />
            <span className="gt">
              Los cuatro agentes
            </span>
            <span className="gsub">
              no todos convierten · cada uno se mide por su rol
            </span>
          </div>
          <div className="cs-agents" id="csAgents" />
          <div className="ghead bad" id="csIssues">
            <span className="gdot" />
            <span className="gt">
              Qué corregir
            </span>
            <span className="gsub">
              prompts, datos inválidos y conversaciones marcadas
            </span>
            <span className="gn" id="csIssN" />
          </div>
          <div className="iss-bar" id="csIssFilter">
            <button data-c="abiertos" className="on">
              Por resolver
            </button>
            <button data-c="resueltos">
              Resueltas
            </button>
          </div>
          <div className="card">
            <div id="csFixes" />
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
