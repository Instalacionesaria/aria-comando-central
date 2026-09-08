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
 * ── Y AHORA «CAMBIAR CONTRASEÑA», QUE NO ES UN BOTÓN MÁS ────────────────────
 *
 * Hasta acá, cambiar una contraseña **solo lo podía hacer un administrador por otra persona**:
 * `POST /api/admin/usuarios/{id}/restablecer-password`, que genera una temporal. Alguien que
 * quisiera cambiar la suya —porque se la vio un compañero, porque la escribió en un papel— no
 * tenía cómo, y la única vía era pedirle a un administrador que se la restableciera. O sea que
 * proteger tu propia cuenta dependía de que otro estuviera disponible.
 *
 * **El endpoint ya existía**: `POST /api/auth/sesion` cambia la propia contraseña, y su comentario
 * dice que *«NO exige ninguna capacidad»* porque es la única salida del estado
 * `debe_cambiar_password`. Lo que faltaba era la puerta: ese formulario vivía solo en
 * `app/entrar/page.tsx`, y ahí se llega únicamente con una contraseña temporal recién puesta.
 *
 * Así que esto no agrega lógica de servidor ni una migración. Agrega la entrada a algo que el
 * sistema ya sabía hacer y no ofrecía.
 *
 * Va ARRIBA de «Cerrar sesión» —donde se pidió— y por una razón que se sostiene: el destructivo va
 * último. Es la misma regla que el pie del menú lateral ya aplica con sus dos botones de icono.
 *
 * ── POR QUÉ ABRE HACIA ARRIBA ───────────────────────────────────────────────
 *
 * `.menu-pop` del prototipo abre hacia abajo (`top: calc(100% + 7px)`), que era correcto
 * colgando de la barra superior. En el pie de la barra lateral, hacia abajo se sale de la
 * pantalla. El modificador está en `app/armazon.css`.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../lib/http/cliente.ts';
import { usarCierreDeMenu } from '../lib/menu.ts';
import {
  AVISO_DE_OTRAS_SESIONES,
  MINIMO_PASSWORD,
  problemaDeLaNueva,
} from '../lib/autenticacion/politica.ts';
import Ventana from './Ventana.jsx';

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
  /* La ventana del cambio de contraseña. Es estado propio y no del menú: el menú se cierra al
     abrirla —si no, el desplegable queda flotando encima— y la ventana tiene que sobrevivir a eso. */
  const [cambiando, setCambiando] = useState(false);
  const caja = useRef(null);

  const cerrar = useCallback(() => setAbierto(false), []);

  /* Clic afuera y `Escape`. Las dos, porque un desplegable que solo cierra con un clic exacto
     queda abierto tapando el menú — es lo mismo que hacía `shell.js`. El efecto se mudó a
     `lib/menu.ts` cuando iba a ser la tercera copia idéntica. */
  usarCierreDeMenu(abierto, caja, cerrar);

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
              /* El nombre viaja con la clave: Ajustes ya no tiene fila en el menu lateral, asi
                 que no hay DOM del que leerlo para la miga de pan. */
              alIrALaSeccion?.(seccion.clave, seccion.nombre);
            }}
          >
            {seccion.nombre}
          </button>
        ) : null}
        {/* ARRIBA de «Cerrar sesión»: el destructivo va último. Y no lleva ninguna condición —
            cambiar la propia contraseña no depende de ninguna capacidad ni de ninguna pantalla, así
            que un `if` acá sería una puerta cerrada sobre algo que el servidor sí permite. */}
        <button
          type="button"
          className="mp-item"
          role="menuitem"
          onClick={() => {
            setAbierto(false);
            setCambiando(true);
          }}
        >
          Cambiar contraseña
        </button>
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

      {cambiando ? <CambiarPassword alCerrar={() => setCambiando(false)} /> : null}
    </div>
  );
}

/**
 * La ventana del cambio de contraseña.
 *
 * ── SE DESMONTA AL CERRAR, Y ESO ES LA LIMPIEZA ─────────────────────────────
 *
 * No hay ningún `setNueva('')` al terminar: el componente entero deja de existir cuando
 * `cambiando` pasa a `false`, así que las tres contraseñas se van con él. Guardar el estado
 * afuera y limpiarlo a mano sería tener que acordarse en cada salida —el éxito, la ✕, Escape, el
 * clic afuera— y la que se olvide deja una contraseña en memoria y en el campo, visible al
 * reabrir.
 */
function CambiarPassword({ alCerrar }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState(false);

  const enviar = useCallback(
    async (e) => {
      e.preventDefault();
      /* Las dos comprobaciones del cliente viven en `lib/autenticacion/politica.ts`, junto al
         mínimo. Copiarlas acá era copiar también su redacción: la pantalla de entrada ya las hace,
         y dos textos distintos para el mismo rechazo es cómo se llega a que nadie sepa cuál es el
         de verdad. */
      const problema = problemaDeLaNueva(nueva, repetida);
      if (problema) {
        setError(problema);
        return;
      }
      setOcupado(true);
      setError(null);
      const r = await pedir('/api/auth/sesion', { metodo: 'POST', cuerpo: { actual, nueva } });
      setOcupado(false);

      /* LAS TRES RAMAS SIN COLAPSAR (`ADR-0305`). Un corte de red y una contraseña equivocada
         mandan a lugares distintos: una se reintenta igual, la otra hay que corregirla. Con un
         solo mensaje, quien se equivocó al escribir la actual se queda mirando la red. */
      if (r.tipo === 'sin_respuesta') {
        setError('No se pudo contactar al servidor. La contraseña NO se cambió: probá de nuevo.');
        return;
      }
      if (r.tipo === 'rechazado') {
        /* `credenciales_invalidas` es el único rechazo propio de este endpoint, y hay que
           traducirlo: el genérico diría «no se pudo» sobre algo que se arregla escribiendo bien la
           contraseña de ahora. Lo demás se muestra como venga. */
        setError(
          r.codigo === 'credenciales_invalidas'
            ? 'La contraseña actual no es correcta.'
            : (r.detalle ?? `El servidor respondió ${r.estado}.`),
        );
        return;
      }
      /* Y NO se cierra sola. El acuse tiene que poder leerse: una ventana que desaparece al
         instante deja a alguien sin saber si la contraseña quedó cambiada — y ésta es de las
         acciones en las que esa duda importa, porque la próxima vez que entre va a usar la nueva. */
      setListo(true);
    },
    [actual, nueva, repetida],
  );

  return (
    <Ventana
      titulo="Cambiar tu contraseña"
      /* El aviso va ANTES de apretar el botón, no después: el endpoint cierra las demás sesiones, y
         enterarse cuando el teléfono ya te echó se lee como que algo se rompió. */
      subtitulo={listo ? undefined : AVISO_DE_OTRAS_SESIONES}
      alCerrar={alCerrar}
    >
      {listo ? (
        <>
          <div className="fd-aviso bien" role="status">
            <i>◍</i>
            <span>
              <b>Contraseña cambiada.</b> Las sesiones en tus demás dispositivos se cerraron; esta
              sigue abierta.
            </span>
          </div>
          <div className="fd-acciones">
            <button type="button" className="fd-btn" onClick={alCerrar}>
              Listo
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={enviar}>
          {/* La actual se pide aunque la sesión ya esté abierta, y el servidor la verifica igual:
              sin eso, una sesión robada alcanza para cambiar la contraseña y quedarse con la
              cuenta. El comentario del endpoint lo dice con esas palabras. */}
          <div className="fd-campo">
            <label htmlFor="cp-actual">Contraseña actual</label>
            <input
              id="cp-actual"
              type="password"
              autoComplete="current-password"
              required
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </div>
          <div className="fd-campo">
            <label htmlFor="cp-nueva">Contraseña nueva</label>
            <input
              id="cp-nueva"
              type="password"
              autoComplete="new-password"
              required
              /* `minLength` además de la comprobación: es lo que hace que el navegador lo diga
                 mientras se escribe, en vez de recién al enviar. */
              minLength={MINIMO_PASSWORD}
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
            <p className="aj-ayuda">Al menos {MINIMO_PASSWORD} caracteres.</p>
          </div>
          <div className="fd-campo">
            <label htmlFor="cp-repetida">Repetila</label>
            <input
              id="cp-repetida"
              type="password"
              autoComplete="new-password"
              required
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
          </div>

          {error ? (
            <div className="fd-aviso mal" role="alert">
              <i>◍</i>
              <span>{error}</span>
            </div>
          ) : null}

          <div className="fd-acciones">
            <button type="button" className="fd-btn sec" onClick={alCerrar} disabled={ocupado}>
              Cancelar
            </button>
            <button type="submit" className="fd-btn" disabled={ocupado}>
              {ocupado ? 'Cambiando…' : 'Cambiar la contraseña'}
            </button>
          </div>
        </form>
      )}
    </Ventana>
  );
}
