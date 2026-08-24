/* Portado de aios-command-center_1.html — vista, líneas 3150-3172. */
export default function CloserView({ activa }) {
  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-closer">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2 id="clTitle">
                Tu cockpit
              </h2>
              <span className="cre-desc" id="clDesc">
                Closer · Jorge Veramendi
              </span>
            </div>
            <div className="cl-sub" id="clNav">
              <button data-c="inicio" className="on">
                <svg viewBox="0 0 16 16">
                  <use href="#i-exec" />
                </svg>
                Inicio
              </button>
              <button data-c="dia">
                <svg viewBox="0 0 16 16">
                  <use href="#i-setter" />
                </svg>
                Mi Día{' '}
                <span className="cnt">
                  27
                </span>
              </button>
              <button data-c="pipeline">
                <svg viewBox="0 0 16 16">
                  <use href="#i-conv" />
                </svg>
                Pipeline
              </button>
              <button data-c="agenda">
                <svg viewBox="0 0 16 16">
                  <use href="#i-closer" />
                </svg>
                Agenda
              </button>
            </div>
          </div>
        </div>
        <div className="cl-page" id="clInicio" />
        <div className="cl-page" id="clDia" hidden />
        <div className="cl-page" id="clPipeline" hidden />
        <div className="cl-page" id="clAgenda" hidden />
      </div>
    </section>
    </>
  );
}
