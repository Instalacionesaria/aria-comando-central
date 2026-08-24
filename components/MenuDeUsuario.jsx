'use client';

/* El menú de la cuenta. Vive en el PIE del menú lateral, junto al nombre de la persona.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SE MUDÓ DE LA BARRA SUPERIOR, Y NO FUE SOLO MOVERLO
 *
 * Estaba arriba a la derecha, con un avatar «FR» y el título «Francisco · Gerencia» escritos a
 * mano — el mismo nombre para todos los inquilinos. Y sus seis botones **no hacían nada**:
 * `lib/aios/shell.js` solo abría y cerraba el desplegable, así que «Cerrar sesión» era un
 * botón que se podía apretar y no cerraba nada.
 *
 * Eso último es lo que hace que esto no sea una mudanza cosmética. Un control que parece
 * funcionar y no hace nada es peor que su ausencia, y «Cerrar sesión» es el peor de la lista:
 * quien lo aprieta en una máquina compartida se va creyendo que salió.
 *
 * ── LOS CUATRO BOTONES QUE NO SOBREVIVIERON ─────────────────────────────────
 *
 * «Perfil», «Preferencias», «Usuarios y permisos» y «Ayuda y soporte» no existen. Se sacan en
 * vez de dejarlos inertes, por el mismo criterio con el que se sacaron los datos inventados de
 * las pestañas Closer y Setter: es preferible una pantalla que no ofrece algo, a una que lo
 * ofrece y no lo cumple.
 *
 * Queda «Ajustes», que sí lleva a una pantalla real, y «Cerrar sesión», que ahora cierra.
 *
 * ── POR QUÉ ABRE HACIA ARRIBA ───────────────────────────────────────────────
 *
 * `.menu-pop` del prototipo abre hacia abajo (`top: calc(100% + 7px)`), que era correcto
 * colgando de la barra superior. En el pie de la barra lateral, hacia abajo se sale de la
 * pantalla. El modificador está en `app/armazon.css`.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../lib/http/cliente.ts';

/** Las iniciales, igual que en el resto del menú. */
function iniciales(nombre) {
  const partes = String(nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '··';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export default function MenuDeUsuario({ sesion, seccion, alIrALaSeccion }) {
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const caja = useRef(null);

  /* Cerrar al hacer clic afuera y con Escape. Las dos, porque un desplegable que solo cierra
     con un clic exacto queda abierto tapando el menú. Es lo mismo que hacía `shell.js`. */
  useEffect(() => {
    if (!abierto) return undefined;
    const afuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('click', afuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', afuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const salir = useCallback(async () => {
    setSaliendo(true);
    /* La respuesta NO se mira antes de irse, y es a propósito: `DELETE /api/auth/sesion` borra
       la cookie SIEMPRE, haya sesión o no. Si la petición no llega, quedarse en la pantalla
       sería peor — quien apretó «Cerrar sesión» tiene que terminar afuera.
       Navegación completa y no enrutado del cliente: el proxy tiene que ver la petición. */
    await pedir('/api/auth/sesion', { metodo: 'DELETE' });
    window.location.replace('/entrar');
  }, []);

  const nombre = sesion?.usuarioNombre ?? '—';

  return (
    <div className={`menu-wrap arriba${abierto ? ' open' : ''}`} ref={caja}>
      {/* El disparador ES la fila del nombre: se ve igual que antes, y ahora abre el menú. */}
      <button
        type="button"
        className="role-row disparador"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={(e) => {
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
      >
        <i>{iniciales(nombre)}</i>
        <span className="n">{nombre}</span>
        <span className="chev">⌃</span>
      </button>

      <div className="menu-pop" role="menu">
        <div className="mp-head">
          <span className="uav big">{iniciales(nombre)}</span>
          <span>
            <b>{nombre}</b>
            {/* La organización, no un cargo inventado. Y si está mirando otra, se dice acá
                también: es el cartel permanente del `03` § 3, y este menú es justo donde
                alguien viene a preguntarse "¿en qué cuenta estoy?". */}
            <em>
              {sesion?.organizacion?.nombre ?? '—'}
              {sesion?.mirandoOtraOrganizacion ? ' · estás mirando otra organización' : ''}
            </em>
          </span>
        </div>
        <div className="mp-sep" />
        {/* Solo aparece si la persona TIENE la pantalla, y con SU nombre — los dos salen del
            menú que armó el servidor. Un menú que ofrece algo que después responde 403 es la
            misma mentira que una entrada de menú sin permiso. */}
        {seccion ? (
          <button
            type="button"
            className="mp-item"
            role="menuitem"
            onClick={() => {
              setAbierto(false);
              alIrALaSeccion?.(seccion.clave);
            }}
          >
            {seccion.nombre}
          </button>
        ) : null}
        <button
          type="button"
          className="mp-item danger"
          role="menuitem"
          disabled={saliendo}
          onClick={() => void salir()}
        >
          {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  );
}
