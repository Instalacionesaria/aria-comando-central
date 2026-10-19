'use client';

/* Debajo de la empresa: qué cliente estás mirando (el nivel 3), y cómo cambiarlo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ ES UN CLIENTE ACÁ
 *
 * Un cliente es una cuenta de la empresa: una subcuenta del CRM, un negocio. La empresa puede mirar todos sus clientes
 * o enfocarse en uno; el cliente final mira los suyos. Con un cliente enfocado, Leads y Sales muestran sólo ese
 * cliente, y las demás pantallas siguen siendo de la empresa entera (la cabecera lo dice: `lib/foco.ts`).
 *
 * Cuándo se dibuja y qué dice lo decide `lib/foco.ts`, no este componente: con un solo cliente, una empresa no ve
 * nada (no hay entre qué elegir) y un cliente final ve su nombre como texto. Cambiar es `PATCH /api/auth/cliente`
 * más una recarga completa, como cambiar de empresa: media pantalla con el cliente viejo y media con el nuevo es peor
 * que esperar un segundo.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useRef, useState } from 'react';
import { pedir } from '../lib/http/cliente.ts';
import { usarCierreDeMenu } from '../lib/menu.ts';
import { formaDelSelector, nombreDelFoco } from '../lib/foco.ts';

const SIN_CUENTAS = { limitado: true, activa: null, visibles: [] };

export default function SelectorDeCliente({ sesion }) {
  const [abierto, setAbierto] = useState(false);
  const [causa, setCausa] = useState(null);
  const [yendo, setYendo] = useState(null);
  const caja = useRef(null);
  const disparador = useRef(null);

  const cuentas = sesion?.cuentas ?? SIN_CUENTAS;
  const forma = formaDelSelector(cuentas);

  const cerrar = useCallback(() => {
    setAbierto(false);
    if (caja.current?.querySelector('.menu-pop')?.contains(document.activeElement)) disparador.current?.focus();
  }, []);
  usarCierreDeMenu(abierto, caja, cerrar);

  const irA = useCallback(async (cuentaId) => {
    setYendo(cuentaId ?? 'todos');
    const r = await pedir('/api/auth/cliente', { metodo: 'PATCH', cuerpo: { cuentaId } });
    if (r.tipo !== 'datos') {
      setYendo(null);
      setCausa(r.tipo === 'rechazado' ? (r.detalle ?? `Rechazado (${r.estado}).`) : 'No llegó al servidor.');
      return;
    }
    window.location.reload();
  }, []);

  if (forma === 'oculto') return null;
  const nombre = nombreDelFoco(cuentas);
  const rotulo = (
    <span className="acct-name">
      <span className="nb-cliente-ceja">Cliente · </span>
      {nombre}
    </span>
  );

  return (
    <div className="nb-cliente">
      <div className={`menu-wrap acct-wrap${abierto ? ' open' : ''}`} ref={caja}>
        {forma === 'menu' ? (
          <button
            className="acct"
            title={`Cliente: ${nombre}`}
            type="button"
            ref={disparador}
            aria-haspopup="menu"
            aria-expanded={abierto}
            onClick={(e) => {
              e.stopPropagation();
              setAbierto((v) => !v);
            }}
          >
            {rotulo}
            <span className="acct-chev" aria-hidden="true">
              ⇅
            </span>
          </button>
        ) : (
          <span className="acct" title={`Cliente: ${nombre}`}>
            {rotulo}
          </span>
        )}

        {forma === 'menu' ? (
          <div className="menu-pop" role="menu" aria-label="Cambiar de cliente">
            <div className="mp-head">
              <span>
                <b>Cambiar de cliente</b>
                <em>Leads y Sales muestran sólo el cliente que elijas</em>
              </span>
            </div>
            <div className="mp-sep" />
            {causa ? (
              <div className="mp-item nb-cliente-causa" role="status">
                {causa}
              </div>
            ) : null}
            <button
              type="button"
              className={cuentas.activa === null ? 'mp-item nb-cliente-aqui' : 'mp-item'}
              role="menuitem"
              disabled={cuentas.activa === null || yendo !== null}
              onClick={() => void irA(null)}
            >
              {cuentas.limitado ? 'Todos tus clientes' : 'Todos los clientes'}
            </button>
            {cuentas.visibles.map((c) => {
              const aqui = c.id === cuentas.activa;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={aqui ? 'mp-item nb-cliente-aqui' : 'mp-item'}
                  role="menuitem"
                  disabled={aqui || yendo !== null}
                  onClick={() => void irA(c.id)}
                >
                  {c.nombre}
                  {/* Un cliente pausado sigue a la vista: se dice, porque sus números dejan de moverse. */}
                  {c.estado === 'pausada' ? <span className="nb-cliente-pausado"> · pausado</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
