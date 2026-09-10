/* Portado de aios-command-center_1.html — vista, líneas 2680-2744. */
export default function AcquisitionView({ activa }) {
  return (
    <>
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-acquisition">
      <div className="view-scroll cre-scroll">
        {/* La estética de operación INVIERTE el encabezado: el `h2` pasa a rótulo de 9,5 px en
            mayúsculas y la bajada a titular de 24 px. `.stack` y `.ch-title` son las que lo
            apilan, y `.cl-page` da el `gap: 18px` del cuerpo — sin ella, el `gap: 24px` del
            scroller se aplica entre TODOS los bloques. */}
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>
                Acquisition
              </h2>
              <span className="cre-desc">De dónde vienen los leads, y cuáles sirven</span>
            </div>
          </div>
          <div className="ch-r">
            <button className="reco-btn" id="acqPlanBtn">
              <span className="rb-ic">
                ◈
              </span>
              Plan de acción
            </button>
            <div className="ch-period">
              <div className="db-seg" id="acqPeriodSeg">
                <button data-p="p1">
                  Hoy
                </button>
                <button data-p="p7" className="on">
                  7 días
                </button>
                <button data-p="p30">
                  30 días
                </button>
              </div>
              <button className="pill" data-datepick="acq" id="acqPill">
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
          <div className="filterbar">
            <span className="tb-lab">
              Tasa
            </span>
            <div className="db-seg" id="acqRateSeg">
              <button data-r="step" className="on">
                Paso a paso
              </button>
              <button data-r="cum">
                Acumulada
              </button>
            </div>
          </div>
          <div className="acq-range off" id="acqRange">
            <span className="acq-rl">
              Periodo
            </span>
            <input type="date" id="acqA1" defaultValue="2026-07-01" />
            <span className="acq-arrow">
              →
            </span>
            <input type="date" id="acqA2" defaultValue="2026-07-21" />
            <span className="acq-rl" style={{ marginLeft: '8px' }}>
              Comparar vs
            </span>
            <span className="acq-seg" id="acqCmpSeg">
              <span data-c="prev" className="on">
                Periodo anterior
              </span>
              <span data-c="custom">
                Otro periodo
              </span>
            </span>
            <span className="acq-bwrap off" id="acqBWrap">
              <input type="date" id="acqB1" defaultValue="2026-06-01" />
              <span className="acq-arrow">
                →
              </span>
              <input type="date" id="acqB2" defaultValue="2026-06-21" />
            </span>
            <span className="acq-rn" id="acqRangeNote" />
          </div>
          <section className="acq-kpis" id="acqKpis" />
          <p className="acq-note">
            Los totales llegan hasta{' '}
            <b>
              calificados
            </b>
            , que es donde termina la responsabilidad de pauta. Son volumen y dinero, no tasas: sumar contactos de funnels distintos mide escala, no conversión.
          </p>
          <div className="acq-fgrid" id="acqFunnels" />
          <div id="acqTables" />
          <div className="card">
            <div className="card-head">
              Señales detectadas{' '}
              <span className="hint">
                sin recomendación automática
              </span>
            </div>
            <div className="sig">
              <span className="si" style={{ background: 'rgb(var(--c-warn) / .14)', color: 'var(--warn)' }}>
                ↓
              </span>
              <div>
                <div className="st-t">
                  Cae la afinidad ICP en Prospecting B
                </div>
                <div className="st-d">
                  Sus calificados promedian 54% de afinidad frente al 72% del retargeting, con costo por calificado más alto.
                </div>
              </div>
              <span className="ev">
                Ver evidencia
              </span>
            </div>
            <div className="sig">
              <span className="si" style={{ background: 'rgb(var(--c-warn) / .14)', color: 'var(--warn)' }}>
                ↻
              </span>
              <div>
                <div className="st-t">
                  Fuga entre formulario y landing VSL en Booking directo
                </div>
                <div className="st-d">
                  Una parte de quienes completan el formulario no llega a ver la VSL. Es el salto más caro de los tres funnels.
                </div>
              </div>
              <span className="ev">
                Ver evidencia
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
