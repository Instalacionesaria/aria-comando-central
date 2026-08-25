'use client';

/* Una ventana emergente. Un solo componente para los dos formularios de alta.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * POR QUÉ UNO Y NO DOS
 *
 * Empresas y Usuarios piden lo mismo: un formulario que aparece al apretar un botón. Con dos
 * implementaciones habría dos versiones del escape, del foco y del cierre — y la que se use
 * menos es la que queda mal. Es el `ADR-0304` aplicado a la interfaz: misma cosa, mismo
 * comportamiento.
 *
 * ── LO QUE UNA VENTANA TIENE QUE HACER, Y CASI NUNCA HACE ───────────────────
 *
 * Un modal que solo se dibuja encima es un modal roto de cuatro formas, y las cuatro se sienten
 * como «la página está rara» en vez de como un defecto:
 *
 *   1 · **El foco entra y vuelve.** Al abrirse, el foco va al primer campo; al cerrarse, vuelve
 *       al botón que la abrió. Sin eso, quien navega con teclado queda en la nada.
 *   2 · **El tabulador no se escapa.** Sin trampa de foco, tabular sale de la ventana y sigue
 *       por los controles de atrás, que están tapados por el fondo: se navega a ciegas.
 *   3 · **Escape y el fondo cierran.** Son los dos gestos que todo el mundo prueba primero.
 *   4 · **El fondo no se desplaza.** Rodar la rueda sobre el fondo mueve la página de atrás y
 *       parece que la ventana se despega.
 *
 * ── Y UNA QUE ES ESPECÍFICA DE ACÁ ──────────────────────────────────────────
 *
 * `cerrablePorFuera` existe por la contraseña temporal. El servidor la devuelve **una sola vez**
 * y no la guarda en claro: si la ventana se cierra sola después de crear la persona, o se cierra
 * con un Escape de reflejo, esa contraseña **no se puede recuperar** — solo restablecer. Así que
 * mientras está en pantalla, el fondo y Escape dejan de cerrar y hay que apretar un botón que
 * dice qué se está confirmando.
 *
 * No es un estado sin salida —lo que el `03` § 5 prohíbe—: la salida está, es explícita. Lo que
 * se saca es el cierre ACCIDENTAL de algo irrecuperable.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef } from 'react';

/** Lo que puede recibir el foco dentro de la ventana. */
const ENFOCABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Ventana({
  titulo,
  subtitulo,
  /** Con `false`, el fondo y Escape NO cierran. La ✕ y los botones propios sí. */
  cerrablePorFuera = true,
  alCerrar,
  children,
}) {
  const caja = useRef(null);
  const previo = useRef(null);

  /* NO hay estado de «visible», y eso es una corrección medida, no una simplificación.
   *
   * La primera versión se pintaba transparente y se encendía en el cuadro siguiente con
   * `requestAnimationFrame`, para que el fundido tuviera de dónde arrancar. **Se verificó en el
   * navegador y la ventana apareció con opacidad 0**: `requestAnimationFrame` no corre cuando la
   * página no está componiendo cuadros. Resultado: la ventana montada e invisible, el fondo sin
   * su clase —o sea sin recibir clics— y la página bloqueada en un estado que no se ve.
   *
   * El defecto de fondo no era el cuadro que faltó: era **hacer que ser visible dependiera de que
   * una animación corra**. Ahora la ventana nace visible y la animación es pura decoración, sin
   * `fill-mode`: si no corre, aparece de golpe, que es exactamente lo que corresponde. */

  /* El foco entra, y vuelve al control que abrió la ventana. */
  useEffect(() => {
    previo.current = document.activeElement;
    /* El primer control del CUERPO, no el primero de la ventana.
       Medido en el navegador: el primer enfocable en orden de DOM es la ✕ del encabezado, así
       que abrir la ventana y pulsar Enter la cerraba en el acto. El foco tiene que caer donde se
       empieza a trabajar. Si el cuerpo no tuviera ningún control, queda en la caja —que lleva
       `tabIndex={-1}`— para que Escape y la trampa del foco sigan funcionando. */
    const cuerpo = caja.current?.querySelector('.vt-cuerpo');
    const primero = cuerpo?.querySelector(ENFOCABLE);
    (primero ?? caja.current)?.focus();
    return () => {
      /* Puede haber quedado fuera del documento si la lista se redibujó. `focus()` sobre un
         elemento separado no hace nada, que es exactamente lo que corresponde. */
      if (previo.current instanceof HTMLElement) previo.current.focus();
    };
  }, []);

  /* El fondo no se desplaza. Se restaura lo que había en vez de asumir `visible`: si algún día
     otra cosa lo bloquea a la vez, pisarlo con un valor fijo lo desbloquearía de más. */
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  const teclas = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        if (!cerrablePorFuera) return;
        e.stopPropagation();
        alCerrar?.();
        return;
      }
      if (e.key !== 'Tab') return;

      /* La trampa del foco. `offsetParent` descarta lo que está oculto: un control invisible que
         igual recibe el tabulador es un salto a la nada. */
      const dentro = [...(caja.current?.querySelectorAll(ENFOCABLE) ?? [])].filter(
        (el) => el.offsetParent !== null,
      );
      if (dentro.length === 0) return;
      const primero = dentro[0];
      const ultimo = dentro[dentro.length - 1];
      if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      } else if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      }
    },
    [cerrablePorFuera, alCerrar],
  );

  return (
    <>
      {/* El fondo es `.scrim` del prototipo, tal cual: ya existe, ya está animado y ya tiene su
          `.on`. Hacer otro daría dos fondos distintos para la misma idea. */}
      <div
        className="scrim on vt-fondo"
        onClick={() => {
          if (cerrablePorFuera) alCerrar?.();
        }}
      />
      <div className="vt">
        <div
          className="vt-caja"
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          ref={caja}
          tabIndex={-1}
          onKeyDown={teclas}
        >
          <div className="vt-head">
            <div>
              <b>{titulo}</b>
              {subtitulo ? <em>{subtitulo}</em> : null}
            </div>
            <button type="button" className="vt-x" onClick={() => alCerrar?.()} aria-label="Cerrar">
              ✕
            </button>
          </div>
          <div className="vt-cuerpo">{children}</div>
        </div>
      </div>
    </>
  );
}
