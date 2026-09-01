'use client';

/* Los links de cobro de la empresa: cargarlos y sacarlos.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * VIVE EN CLOSER → INICIO Y NO EN AJUSTES, Y NO ES INDIFERENTE
 *
 * Se usan en el chat de la ficha, que se abre desde acá al lado. Quien los carga es quien
 * configura la empresa —la misma puerta que designa closers y fija porcentajes— y verlos junto a
 * la tabla de closers es lo que hace que se entiendan como parte de lo mismo: cómo trabaja el
 * equipo de cierre.
 *
 * ── SE AGREGA Y SE BORRA. NO SE EDITA ─────────────────────────────────────
 *
 * Corregir un monto es sacar el link y volver a cargarlo. Cuesta un renglón más de tipeo y ahorra
 * un formulario de edición entero, para un dato que una empresa toca cuando cambia su lista de
 * precios. El motivo largo está en `lib/negocio/enlacesDePago.ts`.
 *
 * ── LA DIRECCIÓN SE MUESTRA ENTERA ────────────────────────────────────────
 *
 * Cortarla con puntos suspensivos ahorraría lugar y taparía lo único que importa revisar: dos
 * enlaces de Stripe se diferencian en los últimos caracteres, y un link cambiado por otro es dinero
 * que entra en otra cuenta. Acá se lee completo, aunque ocupe dos renglones.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

/** Por qué falló, con las tres formas que puede tomar. Igual que en `QuienEsElCloser`. */
function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se cambió nada.';
  if (r.tipo === 'rechazado') return r.detalle ?? `Rechazado (${r.estado}).`;
  return `No se pudo: ${r.datos?.motivo ?? 'sin motivo'}`;
}

/** El formulario vacío. Una constante para que «cancelar» y «guardó bien» dejen lo mismo. */
const EN_BLANCO = { nombre: '', monto: '', descripcion: '', url: '' };

export default function EnlacesDePago() {
  const [enlaces, setEnlaces] = useState([]);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  /** El formulario de alta, abierto o no. `null` = cerrado. */
  const [nuevo, setNuevo] = useState(null);
  const yaPedido = useRef(false);

  const cargar = useCallback(async () => {
    /* La MISMA lectura que usa el menú del compositor. No hay un `GET` de administración aparte: dos
       consultas de la misma lista divergen en silencio y dejan el menú mostrando siete links donde
       la pantalla que los administra muestra ocho. */
    const r = await pedir('/api/enlaces-de-pago');
    if (r.tipo !== 'datos') {
      setCausa(porQue(r));
      setSituacion(r.tipo);
      return;
    }
    setEnlaces(r.datos.enlaces ?? []);
    setSituacion('listo');
  }, []);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  const agregar = useCallback(async () => {
    setOcupado(true);
    setAviso(null);
    const r = await pedir('/api/admin/enlaces-de-pago', { metodo: 'POST', cuerpo: nuevo });
    setOcupado(false);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }
    /* La respuesta trae la lista completa, y se usa esa: releer con otra petición mostraría
       «guardado» antes de saber qué quedó. */
    setEnlaces(r.datos.enlaces ?? []);
    setNuevo(null);
    setAviso({ mal: false, texto: 'Listo. Ya se puede mandar desde el chat con el botón +.' });
  }, [nuevo]);

  const quitar = useCallback(async (id) => {
    setOcupado(true);
    setAviso(null);
    const r = await pedir(`/api/admin/enlaces-de-pago?id=${encodeURIComponent(id)}`, {
      metodo: 'DELETE',
    });
    setOcupado(false);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }
    setEnlaces(r.datos.enlaces ?? []);
    setAviso({ mal: false, texto: 'Sacado. Ya no aparece en el menú del chat.' });
  }, []);

  if (situacion === 'cargando') {
    return (
      <div className="aj-tarjeta ck-admin">
        <div className="fd-cab">
          <h3>Links de pago</h3>
        </div>
        <div className="fd-aviso">
          <i>◍</i>
          <span>Cargando…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="aj-tarjeta ck-admin">
      <div className="fd-cab">
        <h3>Links de pago</h3>
        <span className="fd-bajada">
          Salen en el botón <b>+</b> del chat de cualquier contacto. Los ve y los puede mandar
          cualquiera que abra una ficha; cargarlos y sacarlos es de quien administra.
        </span>
      </div>

      {causa ? (
        <div className="fd-aviso mal" role="alert">
          <i>⚠</i>
          <span>{causa}</span>
        </div>
      ) : null}

      {aviso ? (
        <div className={`fd-aviso${aviso.mal ? ' mal' : ''}`} role={aviso.mal ? 'alert' : undefined}>
          <i>{aviso.mal ? '⚠' : '✓'}</i>
          <span>{aviso.texto}</span>
        </div>
      ) : null}

      {enlaces.length === 0 ? (
        /* El vacío DICE qué pasa y no solo que está vacío: sin links cargados el botón `+` no se
           dibuja en el chat, y alguien que lo busque ahí no tendría cómo saber por qué no está. */
        <div className="fd-aviso">
          <i>◍</i>
          <span>
            Todavía no hay links cargados, así que el botón <b>+</b> no aparece en el chat.
          </span>
        </div>
      ) : (
        <ul className="ck-enlaces">
          {enlaces.map((e) => (
            <li key={e.id} className="ck-enlace">
              <div className="ck-enlace-q">
                <b>{e.nombre}</b>
                {e.monto ? <span className="ck-enlace-m">{e.monto}</span> : null}
                {e.descripcion ? <span className="ck-enlace-d">{e.descripcion}</span> : null}
              </div>
              <button
                type="button"
                className="fd-btn sec ck-quitar"
                disabled={ocupado}
                onClick={() => void quitar(e.id)}
                aria-label={`Sacar ${e.nombre}`}
                title="Sacar"
              >
                ✕
              </button>
              {/* Entera, sin cortar: ver el encabezado. */}
              <code className="ck-enlace-u">{e.url}</code>
            </li>
          ))}
        </ul>
      )}

      {/* El alta se abre con un botón en vez de estar siempre visible, igual que la de closers: un
          formulario vacío permanente al final de la lista se lee como un link a medio cargar. */}
      {nuevo === null ? (
        <div className="fd-acciones">
          <button
            type="button"
            className="fd-btn"
            disabled={ocupado}
            onClick={() => {
              setAviso(null);
              setNuevo(EN_BLANCO);
            }}
          >
            + Agregar link
          </button>
        </div>
      ) : (
        <div className="ck-alta-enlace">
          <div className="fd-campo">
            <label htmlFor="ep-nombre">Nombre</label>
            <input
              id="ep-nombre"
              type="text"
              value={nuevo.nombre}
              maxLength={60}
              disabled={ocupado}
              placeholder="Stripe"
              onChange={(ev) => setNuevo({ ...nuevo, nombre: ev.target.value })}
            />
          </div>
          <div className="fd-campo">
            <label htmlFor="ep-monto">Monto</label>
            {/* Texto y no un número, a propósito: «Monto libre» es uno de los links reales. El
                motivo completo está en la migración 035. */}
            <input
              id="ep-monto"
              type="text"
              value={nuevo.monto}
              maxLength={24}
              disabled={ocupado}
              placeholder="$4.000"
              onChange={(ev) => setNuevo({ ...nuevo, monto: ev.target.value })}
            />
          </div>
          <div className="fd-campo">
            <label htmlFor="ep-desc">Descripción</label>
            <input
              id="ep-desc"
              type="text"
              value={nuevo.descripcion}
              maxLength={120}
              disabled={ocupado}
              placeholder="Pago único"
              onChange={(ev) => setNuevo({ ...nuevo, descripcion: ev.target.value })}
            />
          </div>
          <div className="fd-campo ck-alta-url">
            <label htmlFor="ep-url">Link</label>
            <input
              id="ep-url"
              type="url"
              value={nuevo.url}
              maxLength={500}
              disabled={ocupado}
              placeholder="https://…"
              onChange={(ev) => setNuevo({ ...nuevo, url: ev.target.value })}
            />
            <span className="aj-ayuda">
              Tiene que ser <b>https://</b>. Por http:// el pago viaja en claro y no se acepta.
            </span>
          </div>
          <div className="fd-acciones">
            <button
              type="button"
              className="fd-btn"
              /* Los dos obligatorios se piden acá también, y no para reemplazar al servidor: el
                 servidor los rechaza igual. Es para no gastar un viaje en decir lo que se ve. */
              disabled={ocupado || nuevo.nombre.trim() === '' || nuevo.url.trim() === ''}
              onClick={() => void agregar()}
            >
              Guardar
            </button>
            <button
              type="button"
              className="fd-btn sec"
              disabled={ocupado}
              onClick={() => setNuevo(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
