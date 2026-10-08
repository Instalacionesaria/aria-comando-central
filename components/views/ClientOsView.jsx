/* La vista `clientos` — Client OS, una herramienta externa de seguimiento de clientes, en prueba.
   ==========================================================================
   Pedida el 2026-10-08: ARIA la quiere probar como herramienta propia antes de ofrecerla al resto, y
   *«cualquier usuario podría verlo con cualquier tipo de permiso»*. Por eso su sección es
   `soloDesdeLaPrincipal` y `sinAlcance` (`lib/autorizacion/secciones.ts`): la ve toda persona de la
   organización principal, y ninguna de una empresa cliente.

   Es un `iframe` y nada más: no llama a ninguna operación nuestra ni le pasa datos de la sesión. El sitio
   embebido vive en otro origen, así que no puede leer esta página. No está en `scripts/paridad.mjs`: no
   viene del prototipo. El `id="v-clientos"` tiene que coincidir con la clave de la sección, porque
   `lib/aios/shell.js` abre la pantalla por ese id.

   El `iframe` se monta recién cuando la pantalla se abre por primera vez: montado desde el arranque,
   cargaría el sitio ajeno en cada entrada a la aplicación, aunque nadie lo mire. */

import { useEffect, useRef, useState } from 'react';

/** La dirección de la herramienta. Una constante con nombre: el día que cambie, cambia acá. */
export const DIRECCION_DE_CLIENT_OS = 'https://client-os.vibepreview.app/clients';

export default function ClientOsView({ activa }) {
  const seccion = useRef(null);
  const [vista, setVista] = useState(activa === true);

  /* `shell.js` abre una pantalla poniéndole la clase `on`, por fuera de React: se mira la clase para saber
     cuándo se abrió por primera vez. */
  useEffect(() => {
    if (vista || !seccion.current) return undefined;
    const nodo = seccion.current;
    const mirar = () => {
      if (nodo.classList.contains('on')) setVista(true);
    };
    mirar();
    const observador = new MutationObserver(mirar);
    observador.observe(nodo, { attributes: true, attributeFilter: ['class'] });
    return () => observador.disconnect();
  }, [vista]);

  return (
    <section ref={seccion} className={activa ? 'view on' : 'view'} id="v-clientos">
      <div className="cos-pie">
        <span className="cos-nota">Herramienta en prueba.</span>
        <a className="cos-afuera" href={DIRECCION_DE_CLIENT_OS} target="_blank" rel="noopener noreferrer">
          Abrir en una pestaña nueva
        </a>
      </div>
      {vista ? (
        <iframe
          className="cos-marco"
          src={DIRECCION_DE_CLIENT_OS}
          title="Client OS"
          referrerPolicy="no-referrer"
          allow="clipboard-write"
        />
      ) : null}
    </section>
  );
}
