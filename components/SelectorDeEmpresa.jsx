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
 * Sin esa capacidad la píldora sigue existiendo —dice en qué empresa estás, que es información
 * útil— pero no es un botón y no se abre. No se oculta: un administrador que no ve el nombre de su
 * empresa en ningún lado tiene menos contexto, no menos confusión.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../lib/http/cliente.ts';
import { usarCierreDeMenu } from '../lib/menu.ts';

export default function SelectorDeEmpresa({ sesion }) {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState(null);
  const [causa, setCausa] = useState(null);
  const [yendo, setYendo] = useState(null);
  const caja = useRef(null);
  const disparador = useRef(null);

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

  /* Cerrar devuelve el foco a la píldora si estaba adentro: cerrado, el desplegable se esconde
     (`app/armazon.css`) y el foco quedaría en un botón que ya no se ve. */
  const cerrar = useCallback(() => {
    setAbierto(false);
    if (caja.current?.querySelector('.menu-pop')?.contains(document.activeElement)) disparador.current?.focus();
  }, []);

  /* Clic afuera y `Escape`. El efecto estaba escrito acá y letra por letra en
     `MenuDeUsuario`; con el menú de links de pago del compositor iban a ser tres copias, así
     que se mudó a `lib/menu.ts` con su motivo. */
  usarCierreDeMenu(abierto, caja, cerrar);

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
  const mirando = Boolean(sesion?.mirandoOtraOrganizacion);
  /* Desde la etapa E10, una píldora junto al logotipo, como en el lienzo: el nombre de la empresa en
     mono. Mirando otra, va en el tono de atención y el lector de pantalla oye la frase entera: es el
     cartel permanente del `03` § 3, la diferencia entre mirar los números de un cliente y creer que
     son los propios. La frase no va a la vista porque en 150 px se comía el nombre: con «Mirando · »
     delante quedaban seis letras de la empresa. El `title` da el nombre entero cuando no entra. */
  const titulo = mirando ? `Mirando otra organización: ${nombre}` : nombre;
  const rotulo = (
    <span className="acct-name">
      {mirando ? <span className="para-lectores">Mirando otra organización: </span> : null}
      {nombre}
    </span>
  );

  return (
    <div className={`menu-wrap acct-wrap${abierto ? ' open' : ''}`} ref={caja}>
      {puede ? (
        <button
          className={mirando ? 'acct mirando' : 'acct'}
          title={titulo}
          type="button"
          ref={disparador}
          aria-haspopup="menu"
          aria-expanded={abierto}
          onClick={(e) => {
            e.stopPropagation();
            setAbierto((v) => !v);
            if (!lista) void cargar();
          }}
        >
          {rotulo}
          <span className="acct-chev" aria-hidden="true">
            ⇅
          </span>
        </button>
      ) : (
        /* Sin la capacidad no es un botón: uno que no hace nada es una parada del tabulador que
           promete y no cumple. Y sin galón, por lo mismo. */
        <span className={mirando ? 'acct mirando' : 'acct'} title={titulo}>
          {rotulo}
        </span>
      )}

      {puede ? (
        <div className="menu-pop" role="menu" aria-label="Cambiar de empresa">
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
