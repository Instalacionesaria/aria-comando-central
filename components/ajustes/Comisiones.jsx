'use client';

/* Los porcentajes de comisión del equipo. Los fija quien administra, no cada persona.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LA DISTINCIÓN QUE ESTA PANTALLA NO PUEDE PERDER
 *
 * **Vacío no es cero.** Un `0 %` guardado afirma que esa persona no cobra comisión; un campo vacío
 * dice que todavía nadie lo definió. Son dos hechos distintos y del lado del closer se ven
 * completamente distintos: con cero, su anillo dice `$0`; sin configurar, dice `—` y le explica que
 * falta que alguien lo cargue.
 *
 * Por eso el campo vacío **no guarda 0**: guarda `null`, o sea que borra. Y por eso hay dos acciones
 * y no una — «Guardar» y «Dejar sin configurar» — porque volver del cero al «sin definir» tiene que
 * ser posible, y con un solo botón no lo sería.
 *
 * ── Y LO QUE ESTA PANTALLA NO TOCA ──────────────────────────────────────────
 *
 * La **meta** de cada persona. Es suya y la fija ella en su propio cockpit. Escribir las dos columnas
 * desde acá borraría la mitad ajena en cada guardado, y el síntoma —«se me borró la meta»— no tendría
 * ninguna pista de quién la borró.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

const MOTIVOS = {
  sin_permiso: 'No tenés permiso para ver o cambiar los porcentajes de comisión.',
  sin_sesion: 'La sesión venció. Hay que volver a entrar.',
};

function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No se pudo contactar al servidor.';
  return r.detalle ?? MOTIVOS[r.codigo] ?? `El servidor respondió ${r.estado}.`;
}

export default function Comisiones() {
  const [lista, setLista] = useState([]);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [aviso, setAviso] = useState(null);
  /* El borrador POR PERSONA, y solo de las que alguien tocó. Si el estado arrancara copiando todos
     los valores, un guardado ajeno recargando la lista pisaría lo que se está tipeando. */
  const [borradores, setBorradores] = useState({});
  const [guardando, setGuardando] = useState(null);
  const yaPedido = useRef(false);

  const cargar = useCallback(async () => {
    const r = await pedir('/api/admin/comisiones');
    if (r.tipo !== 'datos') {
      setCausa(porQue(r));
      setSituacion(r.tipo);
      return;
    }
    setLista(r.datos.usuarios ?? []);
    setSituacion('listo');
  }, []);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  const guardar = useCallback(async (usuarioId, porcentaje) => {
    setGuardando(usuarioId);
    setAviso(null);
    const r = await pedir('/api/admin/comisiones', {
      metodo: 'PUT',
      cuerpo: { usuarioId, porcentaje },
    });
    setGuardando(null);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }
    // La lista sale de la RESPUESTA. Mostrar «guardado» sin leer lo que quedó es reportar un éxito
    // sin verificarlo — y acá lo que quedó es cuánto va a cobrar alguien.
    setLista(r.datos.usuarios ?? []);
    setBorradores((b) => {
      const { [usuarioId]: _fuera, ...resto } = b;
      return resto;
    });
    setAviso({
      mal: false,
      texto:
        porcentaje === null
          ? 'Quedó sin configurar. Del otro lado se ve «nadie cargó tu porcentaje», no «0 %».'
          : `Quedó en ${porcentaje} %.`,
    });
  }, []);

  if (situacion === 'cargando') {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando los porcentajes…</span>
      </div>
    );
  }
  if (situacion !== 'listo') {
    return (
      <div className="aj-fila">
        <div className="fd-aviso mal">
          <i>◍</i>
          <span>{causa}</span>
        </div>
        <button type="button" className="fd-btn sec" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="aj-ayuda" style={{ marginBottom: 12 }}>
        El porcentaje se aplica sobre <b>las ventas que cada persona registró con Avanzar</b> en el
        mes, no sobre el cobrado de la empresa. Cada uno ve su propio número en Closer → Inicio, y
        ahí fija su meta.
      </div>

      {aviso ? (
        <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
          <i>{aviso.mal ? '⚠' : '✓'}</i>
          <span>{aviso.texto}</span>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          Comisiones
          <span className="hint">{lista.length} persona(s) activa(s)</span>
        </div>
        <div className="rows">
          {lista.length === 0 ? (
            <div className="fd-aviso">
              <i>◍</i>
              <span>Esta empresa no tiene usuarios activos, así que no hay a quién configurarle nada.</span>
            </div>
          ) : null}
          {lista.map((u) => {
            const tocado = Object.hasOwn(borradores, u.usuarioId);
            const valor = tocado ? borradores[u.usuarioId] : (u.porcentaje ?? '');
            const numero = Number(valor);
            const valido = valor !== '' && Number.isFinite(numero) && numero >= 0 && numero <= 100;
            return (
              <div
                className="row-i"
                key={u.usuarioId}
                style={{ gridTemplateColumns: '1.6fr 1fr auto' }}
              >
                <div>
                  <div className="rn">{u.nombre}</div>
                  <div className="rs">{u.email ?? 'sin correo'}</div>
                </div>
                <div>
                  {/* SIN CONFIGURAR se dice con palabras, no con un `0 %` ni con un hueco. Un hueco
                      no distingue «no cargado» de «no se pudo leer». */}
                  {u.porcentaje === null ? (
                    <span className="chip warn">Sin configurar</span>
                  ) : (
                    <span className="chip ok">{u.porcentaje} %</span>
                  )}
                </div>
                <div className="num" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    inputMode="decimal"
                    aria-label={`Porcentaje de ${u.nombre}`}
                    value={valor}
                    style={{ width: 90 }}
                    onChange={(e) =>
                      setBorradores((b) => ({ ...b, [u.usuarioId]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="fd-btn"
                    disabled={guardando === u.usuarioId || !valido}
                    onClick={() => void guardar(u.usuarioId, numero)}
                  >
                    {guardando === u.usuarioId ? '…' : 'Guardar'}
                  </button>
                  {/* La acción de BORRAR, aparte y explícita. Es el único camino de vuelta desde «0 %
                      a propósito» hasta «nadie lo configuró», y sin ella el campo vacío tendría que
                      significar cero — que es la confusión que esta pantalla existe para no tener. */}
                  {u.porcentaje !== null ? (
                    <button
                      type="button"
                      className="fd-btn sec"
                      disabled={guardando === u.usuarioId}
                      title="Vuelve al estado «nadie lo configuró», que NO es 0 %"
                      onClick={() => void guardar(u.usuarioId, null)}
                    >
                      Dejar sin configurar
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="aj-ayuda" style={{ marginTop: 12 }}>
        <b>Cero no es lo mismo que vacío.</b> Un <b>0 %</b> guardado dice que esa persona no cobra
        comisión, y su anillo muestra <b>$0</b>. «Sin configurar» dice que todavía nadie lo definió, y
        su anillo muestra <b>—</b> con el motivo.
      </div>
    </>
  );
}
