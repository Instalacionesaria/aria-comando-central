/* Portado de aios-command-center_1.html — vista, líneas 2807-2862. */
export default function ConversionView({ activa }) {
  return (
    <>
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-conversion">
      <div className="view-scroll cre-scroll">
        <div className="cv-wrap">
          {/* La estética de operación INVIERTE el encabezado: el `h2` pasa a rótulo de 9,5 px en
            mayúsculas y la bajada a titular de 24 px. `.stack` y `.ch-title` son las que lo
            apilan, y `.cl-page` da el `gap: 18px` del cuerpo — sin ella, el `gap: 24px` del
            scroller se aplica entre TODOS los bloques. */}
          <div className="cre-head">
            <div className="ch-l stack">
              <div className="ch-title">
                <h2>
                  Conversion
                </h2>
                <span className="cre-desc">
                  Dónde se pierde la gente entre el click y la cita
                </span>
              </div>
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
          <div className="cl-page">
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
      </div>
    </section>
    </>
  );
}
