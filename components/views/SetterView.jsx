/* Portado de aios-command-center_1.html — vista, líneas 3075-3147. */
export default function SetterView({ activa }) {
  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-setter">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>
                Setter
              </h2>
              <span className="cre-desc">
                Qué tengo que hacer ahora con mis contactos
              </span>
            </div>
            <div className="cl-sub" id="stNav">
              <button data-c="dia" className="on">
                <svg viewBox="0 0 16 16">
                  <use href="#i-setter" />
                </svg>
                Mi Día
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
        <div className="grid-4">
          <div className="card">
            <div className="card-body stat">
              <div className="s-l">
                Pendientes hoy
              </div>
              <div className="s-v">
                9
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body stat">
              <div className="s-l">
                Escalados por la IA
              </div>
              <div className="s-v" style={{ color: 'var(--warn)' }}>
                3
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body stat">
              <div className="s-l">
                Agendados hoy
              </div>
              <div className="s-v">
                4
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body stat">
              <div className="s-l">
                Sin respuesta 48 h
              </div>
              <div className="s-v">
                6
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            Escalados por el agente{' '}
            <span className="hint">
              requieren humano
            </span>
          </div>
          <div className="rows">
            <div className="row-i" style={{ gridTemplateColumns: '1.4fr 1fr 2fr .8fr' }}>
              <div>
                <div className="rn">
                  Andrea Salas
                </div>
                <div className="rs">
                  ICP 54 · medio
                </div>
              </div>
              <div className="num" style={{ textAlign: 'left' }}>
                <span className="chip warn">
                  Precio
                </span>
              </div>
              <div className="rs" style={{ fontSize: '12px', color: 'var(--txt-dim)' }}>
                Pidió el precio tres veces. El agente no revela precio.
              </div>
              <div className="num">
                Hace 20 m
              </div>
            </div>
            <div className="row-i" style={{ gridTemplateColumns: '1.4fr 1fr 2fr .8fr' }}>
              <div>
                <div className="rn">
                  Pedro Chávez
                </div>
                <div className="rs">
                  ICP 88 · alto
                </div>
              </div>
              <div className="num" style={{ textAlign: 'left' }}>
                <span className="chip crit">
                  Molesto
                </span>
              </div>
              <div className="rs" style={{ fontSize: '12px', color: 'var(--txt-dim)' }}>
                Sentimiento negativo detectado en los últimos dos mensajes.
              </div>
              <div className="num">
                Hace 1 h
              </div>
            </div>
            <div className="row-i" style={{ gridTemplateColumns: '1.4fr 1fr 2fr .8fr' }}>
              <div>
                <div className="rn">
                  Sofía Marín
                </div>
                <div className="rs">
                  ICP 76 · alto
                </div>
              </div>
              <div className="num" style={{ textAlign: 'left' }}>
                <span className="chip">
                  Fuera de guion
                </span>
              </div>
              <div className="rs" style={{ fontSize: '12px', color: 'var(--txt-dim)' }}>
                Pregunta por un caso de otra industria. Sin respuesta en la base.
              </div>
              <div className="num">
                Hace 3 h
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            Seguimientos de hoy
          </div>
          <div className="rows">
            <div className="row-i" style={{ gridTemplateColumns: '1.4fr 1.2fr 2fr .9fr' }}>
              <div>
                <div className="rn">
                  Luis Ortega
                </div>
                <div className="rs">
                  ICP 71 · alto
                </div>
              </div>
              <div className="num" style={{ textAlign: 'left' }}>
                Toque 2 de 3
              </div>
              <div className="rs" style={{ fontSize: '12px', color: 'var(--txt-dim)' }}>
                Abrió el link pero no completó el formulario.
              </div>
              <div className="num">
                09:30
              </div>
            </div>
            <div className="row-i" style={{ gridTemplateColumns: '1.4fr 1.2fr 2fr .9fr' }}>
              <div>
                <div className="rn">
                  Karla Núñez
                </div>
                <div className="rs">
                  ICP 65 · medio
                </div>
              </div>
              <div className="num" style={{ textAlign: 'left' }}>
                Toque 3 de 3
              </div>
              <div className="rs" style={{ fontSize: '12px', color: 'var(--txt-dim)' }}>
                Último intento antes de pasar a nurture.
              </div>
              <div className="num">
                11:00
              </div>
            </div>
            <div className="row-i" style={{ gridTemplateColumns: '1.4fr 1.2fr 2fr .9fr' }}>
              <div>
                <div className="rn">
                  Iván Torres
                </div>
                <div className="rs">
                  ICP 58 · medio
                </div>
              </div>
              <div className="num" style={{ textAlign: 'left' }}>
                Toque 1 de 3
              </div>
              <div className="rs" style={{ fontSize: '12px', color: 'var(--txt-dim)' }}>
                Lead nuevo de Prospecting A, sin respuesta al primer mensaje.
              </div>
              <div className="num">
                14:00
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
