/* Portado de aios-command-center_1.html — vista, líneas 2807-2862. */
export default function ConversionView({ activa }) {
  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-conversion">
      <div className="view-scroll cre-scroll">
        <div className="cv-wrap">
          <div className="cre-head">
            <div className="ch-l">
              <h2>
                Conversion
              </h2>
              <span className="cre-desc">
                Dónde se pierde la gente entre el click y la cita
              </span>
              <span className="srcs">
                <span className="src">
                  <span className="dotx" />
                  {' '}Clarity
                </span>
                <span className="src">
                  <span className="dotx" />
                  {' '}VTurb
                </span>
              </span>
            </div>
            <div className="ch-r">
              <button className="reco-btn" id="cvRecoBtn">
                <span className="rb-ic">
                  ◈
                </span>
                Plan de acción
              </button>
              <div className="ch-period">
                <div className="db-seg" id="cvDateSeg">
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
                <button className="pill" data-datepick="cv" id="cvPill">
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
          <section className="cs-panels cv-panels" id="cvStats" />
          <div className="filterbar">
            <span className="tb-lab">
              Dispositivo
            </span>
            <div className="db-seg" id="cvDevSeg">
              <button data-d="all" className="on">
                Todos
              </button>
              <button data-d="mobile">
                Móvil
              </button>
              <button data-d="desktop">
                Escritorio
              </button>
            </div>
            <span className="db-info" id="cvInfo" />
          </div>
          <div className="ghead">
            <span
              className="gdot"
              style={{ background: 'var(--accent)' }}
             />
            <span className="gt">
              Recorrido
            </span>
            <span className="gsub" id="cvJourneySub">
              porcentajes sobre el total de visitas · abre un paso para ver su evidencia
            </span>
            <span className="gn" id="cvWorst" />
          </div>
          <div className="journey" id="cvJourney" />
          <div id="cvAlarmWrap" hidden>
            <div className="ghead bad">
              <span className="gdot" />
              <span className="gt">
                Requiere acción ahora
              </span>
              <span className="gsub">
                rompe el funnel · no espera al ciclo diario
              </span>
              <span className="gn" id="cvAlarmN" />
            </div>
            <div id="cvAlarm" />
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
