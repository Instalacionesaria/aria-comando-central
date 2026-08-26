/* Portado de aios-command-center_1.html — scrims, drawers y modales, líneas 3207-3319. */
export default function Overlays() {
  return (
    <>
    {/* ================= GRUPO DE CONTACTOS ================= */}
    <div className="scrim" id="lgScrim" />
    <aside className="lg" id="lgPanel" aria-hidden="true">
      <div className="lg-h">
        <div>
          <div className="lg-t" id="lgTitle">
            Contactos
          </div>
          <div className="lg-s" id="lgSub" />
        </div>
        <span className="cw-x" id="lgClose" style={{ marginLeft: 'auto' }}>
          ✕
        </span>
      </div>
      <div className="lg-b" id="lgBody" />
      <div className="lg-f">
        <button className="lg-open" id="lgOpen">
          Abrir en Leads Portal →
        </button>
        <span className="lg-count" id="lgCount" />
      </div>
    </aside>
    {/* ================= CONTACTO DEL CLOSER =================
        EL PANEL SE FUE DE ACA, Y AHORA ES REACT.

        Vivia aca portado fiel del prototipo -encabezado, las cinco pestanas, el cuerpo y el
        compositor- y **sin una linea de JavaScript**: cinco botones sin manejador, un cuerpo que
        nadie llenaba, y un solo control vivo, el enlace a GoHighLevel. Un panel que no se podia
        abrir, con cinco pestanas que no cambiaban nada.

        Ahora lo dibuja `components/negocio/Ficha.jsx`, con las MISMAS clases -`.cw`, `.cw-tabs`,
        `.cw-body`- asi que el CSS de `app/aios.css` se reusa sin tocar una regla.

        Se BORRA en vez de dejarse: dos elementos `.cw` en el arbol, uno inerte y otro real, es la
        clase de cosa que despues alguien encuentra y no entiende cual manda. Y sus ids duplicados
        harian que un `getElementById` eligiera el equivocado. */}
    {/* ================= RESULTADO ================= */}
    <div className="scrim" id="resScrim" />
    <div className="res" id="resModal" role="dialog">
      <span className="res-x" id="resClose">
        ✕
      </span>
      <div className="res-h">
        <div className="res-k">
          Resultado · llamada o chat
        </div>
        <div className="res-t">
          ¿Cómo terminó?
        </div>
        <div className="res-d">
          Sirve igual tras una llamada o tras el chat. Un clic mueve el pipeline y dispara lo que corresponda.
        </div>
      </div>
      <div className="res-g" id="resOpts" />
    </div>
    <div className="scrim" id="askScrim" />
    <div className="ask-panel" id="askPanel" aria-hidden="true">
      <div className="ap-head">
        <span className="ap-ic">
          ◈
        </span>
        <div>
          <div className="ap-t">
            Executive Intelligence
          </div>
          <div className="ap-s">
            {/* VACÍO y no «Executive»: lo llena `refreshScope()` en `executive-chat.js` antes de
                mostrar el panel, leyendo la fila activa del menú. El literal del prototipo no se
                alcanzaba a ver, pero era otro nombre de sección escrito a mano — y el de al lado,
                en `AskBar.jsx`, sí se veía y decía «Executive» a quien no ve Executive. */}
            respondiendo con datos de{' '}
            <b id="askCtx" />
            {' '}·{' '}
            <span id="askCtxP">
              7 días
            </span>
          </div>
        </div>
        <button className="dw-x" id="askClose">
          ✕
        </button>
      </div>
      <div className="ap-body" id="askBody">
        <div className="ap-empty">
          <div className="ap-e-t">
            Preguntas frecuentes en esta sección
          </div>
          <div className="ap-chips" id="askChips" />
        </div>
      </div>
      <div className="ap-input">
        <input type="text" id="askInput" placeholder="Escribe tu pregunta…" autoComplete="off" />
        <button className="ap-send" id="askSend">
          ⏎
        </button>
      </div>
    </div>
    <div className="scrim" id="scrim" style={{ zIndex: '96' }} />
    <div className="scrim" id="recoScrim" />
    <div
      className="reco-modal"
      id="recoModal"
      aria-hidden="true"
      aria-label="Recomendaciones y conclusiones"
    >
      <div className="reco-head">
        <div>
          <h3>
            Recomendaciones y conclusiones
          </h3>
          <div className="reco-sub" id="recoSub">
            —
          </div>
        </div>
        <button className="dw-x" id="recoClose" aria-label="Cerrar">
          ✕
        </button>
      </div>
      <div className="reco-body" id="recoBody" />
    </div>
    <aside className="drawer" id="drawer" aria-hidden="true" aria-label="Detalle del contenido">
      <div className="dw-head">
        <div>
          <h3 id="dwTitle">
            —
          </h3>
          <div className="m" id="dwMeta">
            —
          </div>
          <div id="dwVerdict" />
        </div>
        <button className="dw-x" id="dwClose" aria-label="Cerrar">
          ✕
        </button>
      </div>
      <div className="dw-body" id="dwBody" />
    </aside>
    </>
  );
}
