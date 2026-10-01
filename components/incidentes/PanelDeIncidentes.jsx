'use client';

/* El Panel de Incidentes: los fallos del modelo de IA de todas las empresas.
   ==========================================================================
   Pedido de Kevin el 2026-10-01, para enterarse de un fallo ANTES de que un cliente escriba
   «falló otra vez». Cada fila es lo mismo que vio la persona —la situación y la referencia— más
   lo técnico, así que con la captura de un cliente se encuentra la fila por su referencia.

   Rojo = nuestro, ámbar = lo arregla la cuenta de IA del cliente, gris = pasajero o salvado por el
   reintento automático (la persona no vio nada). */

import { useCallback, useEffect, useState } from 'react';
import { contadores, leerIncidentes, marcarRevisado, quienDe } from '@/lib/incidentes/panel';

const VENTANAS = [
  { dias: 1, nombre: 'Hoy y ayer' },
  { dias: 7, nombre: 'Últimos 7 días' },
  { dias: 30, nombre: 'Últimos 30 días' },
];

const ETIQUETA = {
  nuestro: { clase: 'tagx venc', texto: 'nuestro' },
  cuenta: { clase: 'tagx seg', texto: 'la cuenta' },
  nadie: { clase: 'tagx nu', texto: 'pasajero' },
};

const fecha = (iso) =>
  new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function PanelDeIncidentes() {
  const [dias, setDias] = useState(7);
  const [soloNuestros, setSoloNuestros] = useState(false);
  const [incidentes, setIncidentes] = useState([]);
  const [ilegibles, setIlegibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async (d) => {
    setCargando(true);
    setError('');
    const r = await leerIncidentes(d);
    if (r.tipo === 'datos') {
      setIncidentes(r.incidentes);
      setIlegibles(r.ilegibles);
    } else {
      setError(r.mensaje);
      setIncidentes([]);
      setIlegibles([]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar(dias);
  }, [cargar, dias]);

  const revisar = async (i) => {
    if (await marcarRevisado(i.orgId, i.id)) {
      setIncidentes((xs) => xs.map((x) => (x.id === i.id ? { ...x, revisadoEl: new Date().toISOString() } : x)));
    } else {
      setError('No se pudo marcar como revisado. Probá de nuevo.');
    }
  };

  const c = contadores(incidentes);
  const visibles = soloNuestros ? incidentes.filter((i) => quienDe(i) === 'nuestro') : incidentes;

  return (
    <>
      <div className="mon-totales">
        <div className="mon-tarjeta">
          <span className="mon-cifra">{c.hoy}</span>
          <span className="mon-rotulo">Hoy</span>
          <span className="mon-pie">fallos que alguien vio</span>
        </div>
        <div className="mon-tarjeta">
          <span className="mon-cifra">{c.total}</span>
          <span className="mon-rotulo">En la ventana</span>
          <span className="mon-pie">{VENTANAS.find((v) => v.dias === dias)?.nombre.toLowerCase()}</span>
        </div>
        <div className="mon-tarjeta">
          <span className="mon-cifra">{c.salvados}</span>
          <span className="mon-rotulo">Salvados por el reintento</span>
          <span className="mon-pie">nadie los vio</span>
        </div>
        <div className="mon-tarjeta">
          <span className="mon-cifra">{c.nuestrosSinRevisar}</span>
          <span className="mon-rotulo">Nuestros sin revisar</span>
          <span className="mon-pie">los que hay que mirar</span>
        </div>
      </div>

      {ilegibles.length > 0 ? (
        <div className="fd-aviso falta">
          <i>◍</i>
          <span>
            No se pudieron leer los incidentes de {ilegibles.join(', ')}. No es que no tengan: no se pudo mirar.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="fd-aviso mal">
          <i>◍</i>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mon-bloque">
        <div className="mon-cabeza">
          <div className="inc-filtros">
            <div className="db-seg" role="group" aria-label="Ventana">
              {VENTANAS.map((v) => (
                <button
                  type="button"
                  key={v.dias}
                  className={v.dias === dias ? 'on' : ''}
                  aria-pressed={v.dias === dias}
                  onClick={() => setDias(v.dias)}
                >
                  {v.nombre}
                </button>
              ))}
            </div>
            <label>
              <input type="checkbox" checked={soloNuestros} onChange={(e) => setSoloNuestros(e.target.checked)} />
              Solo los nuestros
            </label>
          </div>
          <div className="mon-acciones">
            <button type="button" className="fd-btn-menor" onClick={() => cargar(dias)} disabled={cargando}>
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {cargando && incidentes.length === 0 ? <p className="mon-vacio">Cargando…</p> : null}
        {!cargando && !error && visibles.length === 0 ? (
          <p className="mon-vacio">Sin incidentes en esta ventana.</p>
        ) : null}

        {visibles.length > 0 ? (
          <div className="mon-scroll">
            <table className="mon-tabla">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Cuenta</th>
                  <th>Dónde</th>
                  <th>Qué pasó</th>
                  <th>Ref</th>
                  <th>Detalle técnico</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map((i) => {
                  const q = ETIQUETA[quienDe(i)];
                  return (
                    <tr key={i.id} className={i.revisadoEl ? 'inc-revisado' : ''}>
                      <td>{fecha(i.creadoEl)}</td>
                      <td>
                        <b>{i.empresa}</b>
                        {i.usuario ? <span className="inc-sub">{i.usuario}</span> : null}
                      </td>
                      <td>
                        {i.donde ?? i.origen}
                        <span className="inc-sub">{i.origen}</span>
                      </td>
                      <td>
                        <span className="inc-ref">{i.situacion}</span>
                        <span className="inc-sub">
                          <span className={q.clase}>{i.salvado ? 'salvado' : q.texto}</span>
                        </span>
                      </td>
                      <td className="inc-ref">{i.ref}</td>
                      <td className="inc-tecnico">{i.tecnico}</td>
                      <td>
                        {i.revisadoEl ? (
                          <span className="inc-sub">revisado</span>
                        ) : i.salvado ? null : (
                          <button type="button" className="fd-btn-menor" onClick={() => revisar(i)}>
                            Marcar revisado
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
