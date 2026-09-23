/* La vista `analizadores` — las llamadas de tl;dv, juzgadas.
   ==========================================================================
   Dos pestañas internas, HT y OB, en una sola barra: la estética de operación dibuja una barra por
   pantalla, y Conversation ya pagó lo que cuesta encimar dos (`PanelDeConversation.jsx`).

   El `id="v-analizadores"` no es decorativo: `lib/aios/shell.js` abre una pantalla haciendo
   `document.getElementById('v-' + clave)`, así que un id que no coincida con la clave de la sección
   deja la entrada del menú sin responder, en silencio.

   Quién llega hasta acá: quien tenga `analizadores.ver`, que es la capacidad de la sección. Analizar,
   sincronizar, reencaminar y borrar piden además `analizadores.editar` **en el servidor**. */

import PanelDeAnalizadores from '../analizadores/PanelDeAnalizadores.jsx';

export default function AnalizadoresView({ activa }) {
  return (
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-analizadores">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>Analizadores</h2>
              <span className="cre-desc">Cada llamada de tl;dv, juzgada</span>
            </div>
          </div>
        </div>
        <div className="cl-page">
          <PanelDeAnalizadores />
        </div>
      </div>
    </section>
  );
}
