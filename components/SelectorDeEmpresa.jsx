'use client';

/* El botón de arriba a la izquierda: qué empresa estás mirando, y cómo cambiarla.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ESTE COMPONENTE EXISTE POR UN ENCIERRO QUE OCURRIÓ
 *
 * El botón mostraba el nombre de la empresa y **no hacía nada**: era un `<button id="acctBtn">`
 * del prototipo sin ningún manejador. Y la única forma de cambiar de empresa era la pestaña
 * Empresas de Ajustes, que solo se ve desde la organización principal.
 *
 * O sea que conmutarse a otra empresa quitaba de la pantalla el único control con el que se
 * podía volver. El 2026-08-25 el superadministrador se movió a una organización de control de la
 * sonda —que nace `activa = false` a propósito— y quedó sin salida: toda ruta le respondía 403
 * `organizacion_inactiva`, y la pestaña que tenía el conmutador ya no se dibujaba. Hubo que
 * devolverle la sesión con una sentencia contra la base.
 *
 * El `03` § 5 ya lo tenía escrito como principio: **un estado sin salida es un defecto.**
 *
 * ── POR QUÉ ACÁ Y NO EN AJUSTES ─────────────────────────────────────────────
 *
 * Porque este botón **se dibuja siempre**, en cualquier pantalla y en cualquier empresa. La
 * salida no puede vivir en un lugar al que se llega: tiene que estar donde ya estás.
 *
 * Y el servidor hizo su mitad: `GET /api/admin/organizaciones` pasó a estar exento del control
 * de organización activa, así que desde una empresa inactiva se puede ver a dónde volver.
 *
 * ── SOLO PARA QUIEN PUEDE ───────────────────────────────────────────────────
 *
 * `sesion.puedeCambiarDeEmpresa` lo responde el SERVIDOR, con la misma condición que comprueba
 * el endpoint que conmuta. No se deduce acá: dos definiciones de la misma regla acaban con un
 * botón que ofrece algo que va a ser rechazado.
 *
 * Sin esa capacidad el botón sigue existiendo —dice en qué empresa estás, que es información
 * útil— pero no se abre. No se oculta: un administrador que no ve el nombre de su empresa en
 * ningún lado tiene menos contexto, no menos confusión.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../lib/http/cliente.ts';

/** Las iniciales para el avatar. */
function iniciales(nombre) {
  const partes = String(nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '··';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export default function SelectorDeEmpresa({ sesion }) {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState(null);
  const [causa, setCausa] = useState(null);
  const [yendo, setYendo] = useState(null);
  const caja = useRef(null);

  const puede = Boolean(sesion?.puedeCambiarDeEmpresa);

  /* Las empresas se piden al ABRIR, no al montar. Es un menú que casi nunca se usa, y pedirlo
     en cada carga de la aplicación sería una consulta por sesión para nada. */
  const cargar = useCallback(async () => {
    const r = await pedir('/api/admin/organizaciones');
    if (r.tipo !== 'datos') {
      setCausa(
        r.tipo === 'rechazado'
          ? (r.detalle ?? `El servidor respondió ${r.estado}.`)
          : 'No se pudo contactar al servidor.',
      );
      setLista([]);
      return;
    }
    setCausa(null);
    setLista(r.datos.organizaciones ?? []);
  }, []);

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

  const irA = useCallback(async (orgId) => {
    setYendo(orgId ?? 'propia');
    const r = await pedir('/api/auth/sesion', { metodo: 'PATCH', cuerpo: { orgId } });
    if (r.tipo !== 'datos') {
      setYendo(null);
      setCausa(r.tipo === 'rechazado' ? (r.detalle ?? `Rechazado (${r.estado}).`) : 'No llegó al servidor.');
      return;
    }
    /* Recarga completa: conmutar reescribe la sesión entera, y media pantalla con la sesión
       vieja y media con la nueva es peor que esperar un segundo. */
    window.location.reload();
  }, []);

  const nombre = sesion?.organizacion?.nombre ?? '—';

  return (
    <div className={`menu-wrap acct-wrap${abierto ? ' open' : ''}`} ref={caja}>
      <button
        className="acct"
        type="button"
        aria-haspopup={puede ? 'menu' : undefined}
        aria-expanded={puede ? abierto : undefined}
        onClick={(e) => {
          if (!puede) return;
          e.stopPropagation();
          setAbierto((v) => !v);
          if (!lista) void cargar();
        }}
        style={puede ? undefined : { cursor: 'default' }}
      >
        <span className="acct-av">{iniciales(nombre)}</span>
        <span className="acct-txt">
          <span className="acct-name">{nombre}</span>
          <span className="acct-role">
            {/* El cartel permanente del `03` § 3. No es decoración: es la diferencia entre
                mirar los números de un cliente y creer que son los propios. */}
            {sesion?.mirandoOtraOrganizacion
              ? 'Mirando otra organización'
              : puede
                ? 'Tu organización · cambiar'
                : 'Tu organización'}
          </span>
        </span>
        {/* El galón solo si se puede abrir: un indicador de desplegable en algo que no se
            despliega es un control que promete y no cumple. */}
        {puede ? <span className="acct-chev">⇅</span> : null}
      </button>

      {puede ? (
        <div className="menu-pop" role="menu">
          <div className="mp-head">
            <span>
              <b>Cambiar de empresa</b>
              <em>Todo lo que hagas después será de la que elijas</em>
            </span>
          </div>
          <div className="mp-sep" />

          {/* LA SALIDA VA PRIMERA, y siempre está. Es lo que impide el encierro: incluso desde
              una organización inactiva —donde casi todo responde 403— esta opción funciona,
              porque el endpoint que conmuta está exento de ese control. */}
          {sesion?.mirandoOtraOrganizacion ? (
            <button
              type="button"
              className="mp-item"
              role="menuitem"
              disabled={yendo !== null}
              onClick={() => void irA(null)}
            >
              ← Volver a mi organización
            </button>
          ) : null}

          {lista === null ? (
            <div className="mp-item" style={{ color: 'var(--txt-faint)' }}>
              Cargando…
            </div>
          ) : null}

          {causa ? (
            <div className="mp-item" style={{ color: 'var(--crit)', whiteSpace: 'normal' }}>
              {causa}
            </div>
          ) : null}

          {(lista ?? []).map((o) => {
            const aqui = o.id === sesion?.organizacion?.id;
            return (
              <button
                key={o.id}
                type="button"
                className="mp-item"
                role="menuitem"
                disabled={aqui || yendo !== null}
                onClick={() => void irA(o.id)}
                style={aqui ? { color: 'var(--accent)' } : undefined}
              >
                {o.nombre}
                {aqui ? ' · acá estás' : ''}
                {/* Se dice cuál NO opera. Es la pregunta que sigue a entrar a una empresa, y
                    verlo antes de entrar ahorra el viaje. */}
                {!aqui && !o.tieneCredencialDeCrm ? (
                  <span style={{ color: 'var(--txt-faint)', fontSize: 11 }}> · sin conectar</span>
                ) : null}
                {!aqui && !o.activa ? (
                  <span style={{ color: 'var(--warn)', fontSize: 11 }}> · desactivada</span>
                ) : null}
              </button>
            );
          })}

          {lista !== null && lista.length === 0 && !causa ? (
            <div className="mp-item" style={{ color: 'var(--txt-faint)' }}>
              No hay otras empresas.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
