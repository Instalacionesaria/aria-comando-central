/* Portado de aios-command-center_1.html — vista, líneas 2555-2677. */
export default function ExecutiveView({ activa }) {
  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-executive">
      <div className="view-scroll ex-scroll">
        <div className="ex-head">
          <div className="ex-title-wrap">
            <div className="ch-title">
              <h2 id="exTitle">
                Equipo de inteligencia
              </h2>
            </div>
            <div className="mode-seg" id="exMode">
              <button data-m="map" className="on">
                <svg viewBox="0 0 16 16" fill="none">
                  <circle cx="5.5" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="11" cy="6.5" r="1.7" stroke="currentColor" strokeWidth="1.3" />
                  <path
                    d="M1.6 13c.4-2 1.9-3.2 3.9-3.2s3.5 1.2 3.9 3.2"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                   />
                  <path
                    d="M10.6 9.9c1.8 0 3.1 1.1 3.5 3.1"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                   />
                </svg>
                Equipo
              </button>
              <button data-m="funnel">
                <svg viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 3h12l-4.4 5.2v4.5L6.4 14V8.2L2 3Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                   />
                </svg>
                Funnel
              </button>
            </div>
          </div>
          <div className="ex-ctrl">
            <span className="cmp-note" id="exCmp" hidden>
              vs los 7 días previos
            </span>
            <div className="db-seg" id="exPeriod" hidden>
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
            <button className="pill" data-datepick="ex" id="exPill" hidden>
              <span className="pv">
                Personalizado
              </span>
              <span className="pc">
                ⌄
              </span>
            </button>
          </div>
        </div>
        <section className="bizfunnel" id="exFunnel" hidden />
        <section className="graph-wrap">
          <div className="graph-head">
            Pasa el cursor por un área para ver qué trae a la reunión · toca para entrar
          </div>
          <div className="graph-legend">
            <span>
              <span className="st ok" />
              {' '}activo
            </span>
            <span>
              <span className="st warn" />
              {' '}atención
            </span>
            <span>
              <span className="st crit" />
              {' '}incidencia
            </span>
          </div>
          <svg className="graph" id="deptGraph" viewBox="0 0 960 560" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* EL HALO DEL NÚCLEO, APAGADO. Era un ámbar al 28 % que se desvanecía hacia
                  afuera: profundidad, que es lo que se pidió sacar. La capa ejecutiva se sigue
                  distinguiendo por el ámbar de su borde y por su rótulo «CAPA EJECUTIVA».

                  Los tres degradados de este `<defs>` se conservan aunque dos queden en nada, y NO
                  es por las dudas: `scripts/paridad.mjs` compara esta vista contra el prototipo con
                  una huella de `tag + id + clases` de cada descendiente (su `forma()`), así que
                  sacar un `<radialGradient id="…">` de acá la deja en rojo para siempre. Y un rojo
                  permanente no se arregla: se ignora, y con él se ignoran las otras seis vistas que
                  sí sirven. Los ATRIBUTOS no entran en esa huella, así que cambiar los colores es
                  gratis y quitar un nodo no lo es. */}
              <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              {/* EL RELLENO DE LAS SEIS TARJETAS, Y ACÁ ESTABA EL DEFECTO DE VERDAD.
                  Los dos topes eran `#16202f` y `#0c1220` escritos a mano — dos azules casi negros.
                  Un literal no cambia con el tema, así que en modo claro las tarjetas SEGUÍAN
                  siendo negras mientras su texto, que sí usa tokens, se volvía casi negro: seis
                  tarjetas con el nombre del área ilegible, sin que nada falle.

                  Los dos topes apuntan al MISMO token a propósito. Un degradado de dos tonos es un
                  volumen, y no hay volumen: el token deja la tarjeta plana y del color del tema. */}
              <linearGradient id="nodeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--nodo-fondo)" />
                <stop offset="100%" stopColor="var(--nodo-fondo)" />
              </linearGradient>
              {/* `dataGlow` no lo referencia NADIE — se comprobó en todo el repositorio, no hay un
                  solo `url(#dataGlow)`. Queda por la huella de paridad, en nada. */}
              <radialGradient id="dataGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            {/* conexiones: cada área con el núcleo */}
            <path id="e1" className="edge hot" d="M 305 168 C 385 200, 430 228, 452 248" />
            <path id="e2" className="edge" d="M 268 372 C 350 352, 410 300, 444 276" />
            <path id="e3" className="edge" d="M 400 512 C 440 460, 462 340, 470 300" />
            <path id="e4" className="edge hot" d="M 655 168 C 575 200, 530 228, 508 248" />
            <path id="e5" className="edge" d="M 692 372 C 610 352, 550 300, 516 276" />
            <circle className="pulse" r="2.4">
              <animateMotion dur="4.4s" repeatCount="indefinite">
                <mpath href="#e1" />
              </animateMotion>
            </circle>
            <circle className="pulse" r="2.4">
              <animateMotion dur="5.4s" begin="1.2s" repeatCount="indefinite">
                <mpath href="#e4" />
              </animateMotion>
            </circle>
            <circle className="pulse" r="2.4">
              <animateMotion dur="4.8s" begin="2.2s" repeatCount="indefinite">
                <mpath href="#e5" />
              </animateMotion>
            </circle>
            <circle className="pulse" r="2.4">
              <animateMotion dur="6s" begin="0.6s" repeatCount="indefinite">
                <mpath href="#e2" />
              </animateMotion>
            </circle>
            {/* ====== NÚCLEO ====== */}
            <circle cx="480" cy="262" r="132" fill="url(#coreGlow)" />
            <g className="node-card core">
              <rect
                className="body"
                x="398"
                y="216"
                width="164"
                height="92"
                rx="16"
                /* El ámbar del núcleo, ahora por token: el literal `rgba(232,182,76,0.5)` es el
                   ámbar del tema OSCURO, y sobre blanco daba un borde lavado. El `drop-shadow` de
                   18 px que venía al lado era el halo, y se fue con el resto. */
                style={{ stroke: 'var(--nodo-nucleo-borde)' }}
               />
              <text
                className="node-sub"
                x="480"
                y="240"
                textAnchor="middle"
                style={{ fill: 'var(--exec)', letterSpacing: '.04em' }}
              >
                CAPA EJECUTIVA
              </text>
              <text className="node-name" x="480" y="264" textAnchor="middle" style={{ fontSize: '15px' }}>
                Executive
              </text>
              <text
                className="node-tag"
                x="480"
                y="286"
                textAnchor="middle"
                style={{ fill: 'var(--txt-faint)' }}
              >
                3 temas hoy · 1 conflicto
              </text>
            </g>
            {/* ====== ÁREAS ====== */}
            <g className="node-card" data-node="acquisition">
              <rect className="body" x="122" y="92" width="188" height="80" rx="14" />
              <use href="#i-acq" x="146" y="110" width="18" height="18" className="node-ico" />
              <circle cx="292" cy="112" r="3.5" fill="var(--warn)" />
              <text className="node-name" x="170" y="122">
                Acquisition
              </text>
              <text className="node-sub" x="170" y="140">
                Campañas y tráfico
              </text>
              <text className="node-tag" x="170" y="157" style={{ fill: 'var(--warn)' }}>
                2 a revisar
              </text>
            </g>
            <g className="node-card" data-node="conversation">
              <rect className="body" x="650" y="92" width="188" height="80" rx="14" />
              <use href="#i-chat" x="674" y="110" width="18" height="18" className="node-ico" />
              <circle cx="820" cy="112" r="3.5" fill="var(--warn)" />
              <text className="node-name" x="698" y="122">
                Conversation
              </text>
              <text className="node-sub" x="698" y="140">
                Agentes de WhatsApp y voz
              </text>
              <text className="node-tag" x="698" y="157" style={{ fill: 'var(--warn)' }}>
                1 a revisar
              </text>
            </g>
            <g className="node-card" data-node="conversion">
              <rect className="body" x="80" y="332" width="188" height="80" rx="14" />
              <use href="#i-conv" x="104" y="350" width="18" height="18" className="node-ico" />
              <circle cx="250" cy="352" r="3.5" fill="var(--crit)" />
              <text className="node-name" x="128" y="362">
                Conversion
              </text>
              <text className="node-sub" x="128" y="380">
                Landing, VSL y formulario
              </text>
              <text className="node-tag" x="128" y="397" style={{ fill: 'var(--crit)' }}>
                1 incidencia crítica
              </text>
            </g>
            <g className="node-card" data-node="sales">
              <rect className="body" x="692" y="332" width="188" height="80" rx="14" />
              <use href="#i-sales" x="716" y="350" width="18" height="18" className="node-ico" />
              <circle cx="862" cy="352" r="3.5" fill="var(--ok)" />
              <text className="node-name" x="740" y="362">
                Sales
              </text>
              <text className="node-sub" x="740" y="380">
                Closers y llamadas
              </text>
              <text className="node-tag" x="740" y="397" style={{ fill: 'var(--txt-faint)' }}>
                cierre 31%
              </text>
            </g>
            <g className="node-card" data-node="creative">
              <rect className="body" x="386" y="440" width="188" height="80" rx="14" />
              <use href="#i-creative" x="410" y="458" width="18" height="18" className="node-ico" />
              <circle cx="556" cy="460" r="3.5" fill="var(--ok)" />
              <text className="node-name" x="434" y="470">
                Creative
              </text>
              <text className="node-sub" x="434" y="488">
                Piezas, hooks y ángulos
              </text>
              <text className="node-tag" x="434" y="505" style={{ fill: 'var(--txt-faint)' }}>
                8 piezas activas
              </text>
            </g>
          </svg>
        </section>
        {/* TRAZABILIDAD DEL FUNNEL */}
      </div>
    </section>
    </>
  );
}
