'use client';

/* Los clientes de un cliente final (el nivel 3): elegirlos en el alta, y cambiarlos después.
 *
 * Un cliente final es una persona limitada a algunos clientes de la empresa: sólo ve esos, y sólo en Leads y Sales.
 * Con `personaId`, el componente guarda solo (`PUT /api/admin/usuarios/[id]/cuentas`, que reemplaza el conjunto); sin
 * él, sólo elige y el alta los manda con la persona.
 *
 * Nunca deja guardar cero: un cliente final sin clientes no ve nada y no tiene cómo arreglarlo. Los clientes de baja
 * no se ofrecen. */

import { useEffect, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

export default function ClientesDeLaPersona({ orgId, elegidos, alCambiar, personaId = null, alGuardar = null }) {
  const [clientes, setClientes] = useState(null);
  const [causa, setCausa] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const r = await pedir(`/api/admin/cuentas${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`);
      if (!vivo) return;
      if (r.tipo !== 'datos') {
        setCausa(r.tipo === 'rechazado' ? (r.detalle ?? `El servidor respondió ${r.estado}.`) : 'No se pudo contactar al servidor.');
        setClientes([]);
        return;
      }
      setCausa(null);
      setClientes((r.datos.clientes ?? []).filter((c) => c.estado !== 'baja'));
    })();
    return () => {
      vivo = false;
    };
  }, [orgId]);

  /* Sólo lo que la lista dibuja. Un cliente de baja que la persona ya tenía no tiene casilla y no se puede destildar:
     mandarlo hacía que el servidor rechazara el conjunto entero, sin que se viera por qué. */
  const aGuardar = (clientes ?? []).filter((c) => elegidos.has(c.id)).map((c) => c.id);

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    const r = await pedir(`/api/admin/usuarios/${personaId}/cuentas`, { metodo: 'PUT', cuerpo: { cuentas: aGuardar } });
    setGuardando(false);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: r.tipo === 'rechazado' ? (r.detalle ?? `Rechazado (${r.estado}).`) : 'No llegó al servidor.' });
      return;
    }
    setAviso({ mal: false, texto: 'Sus clientes quedaron guardados.' });
    await alGuardar?.();
  };

  if (clientes === null) return <div className="aj-ayuda">Leyendo los clientes de la empresa…</div>;

  return (
    <div className="aj-casillas">
      {causa ? (
        <div className="fd-aviso mal" role="status">
          <i>⚠</i>
          <span>{causa}</span>
        </div>
      ) : null}
      {clientes.length === 0 && !causa ? <div className="aj-ayuda">La empresa todavía no tiene clientes.</div> : null}
      <div className="aj-grupo">
        {clientes.map((c) => (
          <label className="aj-casilla" key={c.id}>
            <input
              type="checkbox"
              checked={elegidos.has(c.id)}
              onChange={(e) => {
                const ahora = new Set(elegidos);
                if (e.target.checked) ahora.add(c.id);
                else ahora.delete(c.id);
                alCambiar(ahora);
              }}
            />
            <span>
              {c.nombre}
              {c.estado === 'pausada' ? ' · pausado' : ''}
            </span>
          </label>
        ))}
      </div>
      <div className="aj-ayuda">Ve sólo estos clientes, en Leads y Sales. Al menos uno.</div>
      {personaId ? (
        <>
          {aviso ? (
            <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
              <i>{aviso.mal ? '⚠' : '✓'}</i>
              <span>{aviso.texto}</span>
            </div>
          ) : null}
          <div className="aj-fila">
            <button type="button" className="fd-btn sec" disabled={guardando || aGuardar.length === 0} onClick={() => void guardar()}>
              {guardando ? 'Guardando…' : 'Guardar sus clientes'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
