/* Portado de aios-command-center_1.html — vista, líneas 2932-2995. */
export default function SalesView({ activa }) {
  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-sales">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l">
            <h2>
              Sales
            </h2>
            <span className="cre-desc">
              Cierre, closers y motivos de pérdida
            </span>
          </div>
          <div className="ch-r">
            <button className="reco-btn" id="slPlanBtn">
              <span className="rb-ic">
                ◈
              </span>
              Plan de acción
            </button>
            <div className="ch-period">
              <div className="db-seg" id="slPeriod">
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
              <button className="pill" data-datepick="sl" id="slPill">
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
        <div className="grid-4">
          <div className="card">
            <div className="card-body stat">
              <div className="s-l">
                Asistencias
              </div>
              <div className="s-v">
                74
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body stat">
              <div className="s-l">
                Tasa de cierre
              </div>
              <div className="s-v">
                24%
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body stat">
              <div className="s-l">
                Ventas
              </div>
              <div className="s-v">
                18
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body stat">
              <div className="s-l">
                Revenue reportado
              </div>
              <div className="s-v" style={{ color: 'var(--exec)' }}>
                $55,200
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            Closers
          </div>
          <div className="col-head" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1.1fr' }}>
            <span>
              Closer
            </span>
            <span>
              Agendadas
            </span>
            <span>
              Asistieron
            </span>
            <span>
              Ventas
            </span>
            <span>
              Cierre
            </span>
            <span>
              Revenue
            </span>
          </div>
          <div className="rows">
            <div className="row-i" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1.1fr' }}>
              <div>
                <div className="rn">
                  Jorge Veramendi
                </div>
                <div className="rs">
                  ICP alto asignado
                </div>
              </div>
              <div className="num">
                44
              </div>
              <div className="num">
                31
              </div>
              <div className="num">
                10
              </div>
              <div className="num" style={{ color: 'var(--ok)' }}>
                32%
              </div>
              <div className="num rev">
                $31,000
              </div>
            </div>
            <div className="row-i" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1.1fr' }}>
              <div>
                <div className="rn">
                  Asesor comercial
                </div>
                <div className="rs">
                  ICP medio y bajo
                </div>
              </div>
              <div className="num">
                63
              </div>
              <div className="num">
                43
              </div>
              <div className="num">
                8
              </div>
              <div className="num">
                19%
              </div>
              <div className="num rev">
                $24,200
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            Motivos de no venta{' '}
            <span className="hint">
              56 llamadas sin cierre
            </span>
          </div>
          <div className="rows">
            <div className="row-i" style={{ gridTemplateColumns: '1.6fr .6fr 2fr' }}>
              <div className="rn">
                Precio
              </div>
              <div className="num">
                21
              </div>
              <div className="mini-bar">
                <i style={{ width: '38%', background: 'var(--warn)' }} />
              </div>
            </div>
            <div className="row-i" style={{ gridTemplateColumns: '1.6fr .6fr 2fr' }}>
              <div className="rn">
                No es quien decide
              </div>
              <div className="num">
                13
              </div>
              <div className="mini-bar">
                <i style={{ width: '23%', background: 'var(--warn)' }} />
              </div>
            </div>
            <div className="row-i" style={{ gridTemplateColumns: '1.6fr .6fr 2fr' }}>
              <div className="rn">
                Sin necesidad clara
              </div>
              <div className="num">
                12
              </div>
              <div className="mini-bar">
                <i style={{ width: '21%', background: 'var(--txt-faint)' }} />
              </div>
            </div>
            <div className="row-i" style={{ gridTemplateColumns: '1.6fr .6fr 2fr' }}>
              <div className="rn">
                Pidió tiempo
              </div>
              <div className="num">
                10
              </div>
              <div className="mini-bar">
                <i style={{ width: '18%', background: 'var(--txt-faint)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
