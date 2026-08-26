/* Portado de aios-command-center_1.html — barra Ask Executive, líneas 3193-3199. */

/**
 * El disparador del panel de Executive Intelligence.
 *
 * El nombre de la sección venía escrito a mano —«Executive»— y `lib/aios/executive-chat.js` lo
 * corrige recién al ABRIR el panel, leyendo `.nav-item.on`. Este botón, en cambio, está siempre a
 * la vista, así que hasta la primera apertura le decía «Pregúntale a Executive sobre Executive» a
 * alguien que no ve Executive. Es el mismo defecto de la miga de pan y se arregla igual: el dato
 * del arranque llega del servidor. Ver `TopBar.jsx`.
 */
export default function AskBar({ arranque }) {
  return (
    <>
    <footer className="ask">
      <button className="ask-trigger" id="askTrigger">
        <span className="at-ic">
          ◈
        </span>
        <span className="at-t">
          Pregúntale a Executive sobre{' '}
          <b id="askScope">
            {arranque?.seccion.nombre ?? ''}
          </b>
        </span>
        <span className="at-k">
          ⌘K
        </span>
      </button>
    </footer>
    </>
  );
}
