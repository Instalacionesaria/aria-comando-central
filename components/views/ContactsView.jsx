/* Portado de aios-command-center_1.html — vista, líneas 3024-3072. */
export default function ContactsView({ activa }) {
  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-contacts">
      <div className="view-scroll cre-scroll">
        <div className="lp-wrap">
          <div className="cre-head">
            <div className="ch-l">
              <h2>
                Leads Portal
              </h2>
              <span className="cre-desc">
                Cada contacto, de dónde vino y hasta dónde llegó
              </span>
            </div>
            <div className="ch-r">
              <button className="reco-btn" id="lpPlanBtn">
                <span className="rb-ic">
                  ◈
                </span>
                Plan de acción
              </button>
              <div className="ch-period">
                <div className="db-seg" id="lpPeriod">
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
                <button className="pill" data-datepick="lp" id="lpPill">
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
          <section className="icp-cards" id="lpIcp" />
          <div className="lp-bar">
            <div className="lp-search">
              <span className="si">
                ⌕
              </span>
              <input type="text" id="lpSearch" placeholder="Buscar por nombre, campaña o creative…" />
            </div>
            <span className="tb-lab">
              ICP
            </span>
            <div className="db-seg" id="lpIcpSeg">
              <button data-i="all" className="on">
                Todos
              </button>
              <button data-i="nc">
                Sin calificar
              </button>
              <button data-i="alto">
                Alto
              </button>
              <button data-i="medio">
                Medio
              </button>
              <button data-i="bajo">
                Bajo
              </button>
            </div>
            <span className="fb-div" />
            <span className="tb-lab">
              Etapa
            </span>
            <div className="db-seg" id="lpStage">
              <button data-s="all" className="on">
                Todas
              </button>
              <button data-s="booked">
                Agendados
              </button>
              <button data-s="showed">
                Asistieron
              </button>
              <button data-s="sold">
                Vendidos
              </button>
            </div>
            <span className="lp-count" id="lpCount" />
          </div>
          <section className="lp-grid" id="lpGrid" />
        </div>
      </div>
    </section>
    </>
  );
}
