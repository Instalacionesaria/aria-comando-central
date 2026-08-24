/* Portado de aios-command-center_1.html — vista, líneas 2747-2804. */
export default function CreativeView({ activa }) {
  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-creative">
      <div className="view-scroll cre-scroll">
        <div className="cre-wrap">
          <div className="cre-head">
            <div className="ch-l">
              <h2>
                Creative
              </h2>
              <span className="cre-desc">
                Qué funciona, qué no, y por qué
              </span>
            </div>
            <div className="ch-r">
              <button className="reco-btn" id="recoBtn">
                <span className="rb-ic">
                  ◈
                </span>
                Plan de acción
              </button>
              <div className="ch-period">
                <div className="db-seg" id="dateSeg">
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
                <button className="pill" data-datepick="cre" id="crePill">
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
          <section className="cre-stats" id="statRow" />
          <div className="filterbar">
            <div className="pill-wrap" id="sortWrap">
              <button className="pill" id="sortPill" aria-haspopup="true" aria-expanded="false">
                <span className="pk">
                  Ordenar por
                </span>
                <span className="pv" id="sortPillVal">
                  Agenda
                </span>
                <span className="pc">
                  ⌄
                </span>
              </button>
              <div className="pill-menu" id="sortMenu" role="menu">
                <div className="pm-list" id="sortSeg" />
              </div>
            </div>
            <span className="db-info" id="dbInfo" />
            <span id="critName" hidden />
          </div>
          <div className="ghead good">
            <span className="gdot" />
            <span className="gt">
              Funciona
            </span>
            <span className="gsub" id="goodSub" />
            <span className="gn" id="goodN" />
          </div>
          <section className="cg" id="goodGrid" />
          <div className="ghead bad">
            <span className="gdot" />
            <span className="gt">
              No funciona
            </span>
            <span className="gsub" id="badSub" />
            <span className="gn" id="badN" />
          </div>
          <section className="cg" id="badGrid" />
        </div>
      </div>
    </section>
    </>
  );
}
