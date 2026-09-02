'use client';

/* Los links rápidos de UNA zona: cargarlos y sacarlos.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * UN SOLO COMPONENTE PARA LAS DOS PESTAÑAS
 *
 * Lo dibujan Closer → Inicio y Setter → Inicio, con la zona por propiedad. Es el mismo formulario,
 * la misma lista y las mismas dos llamadas; lo único que cambia es el rótulo y los ejemplos del
 * formulario.
 *
 * Copiarlo habría sido más rápido de escribir y es exactamente lo que después diverge: se arregla un
 * mensaje en uno, el otro queda con el viejo, y nadie lo nota porque las dos pantallas se ven bien
 * por separado. Vive en `components/negocio/` por eso — como `Ficha` y `Avanzar`, que también son de
 * las dos.
 *
 * ── SE AGREGA Y SE BORRA. NO SE EDITA ─────────────────────────────────────
 *
 * Corregir un monto es sacar el link y volver a cargarlo. Cuesta un renglón más de tipeo y ahorra un
 * formulario de edición entero, para un dato que una empresa toca cuando cambia su lista de precios.
 * El motivo largo está en `lib/negocio/enlacesRapidos.ts`.
 *
 * ── LA DIRECCIÓN SE MUESTRA ENTERA ────────────────────────────────────────
 *
 * Cortarla con puntos suspensivos ahorraría lugar y taparía lo único que importa revisar: dos
 * enlaces de Stripe se diferencian en los últimos caracteres, y un link cambiado por otro es dinero
 * que entra en otra cuenta. Acá se lee completo, aunque ocupe dos renglones.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { TITULO_DE_LOS_ENLACES } from '../../lib/enlaces.ts';

/** Por qué falló, con las tres formas que puede tomar. Igual que en `QuienEsElCloser`. */
function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se cambió nada.';
  if (r.tipo === 'rechazado') return r.detalle ?? `Rechazado (${r.estado}).`;
  return `No se pudo: ${r.datos?.motivo ?? 'sin motivo'}`;
}

/** El formulario vacío. Una constante para que «cancelar» y «guardó bien» dejen lo mismo. */
const EN_BLANCO = { nombre: '', monto: '', descripcion: '', url: '' };

/**
 * Los ejemplos de cada campo, POR ZONA.
 *
 * No es adorno: un campo llamado «Monto» delante de un setter no dice qué poner, y el ejemplo sí
 * —el suyo casi siempre va vacío—. Son los dos trabajos distintos otra vez: el closer cobra y el
 * setter agenda.
 */
const EJEMPLOS = {
  /* El ejemplo del monto es 'Monto libre' y no una cifra, por dos motivos que coinciden:
     enseña que el campo es TEXTO —ese link real deja que el cliente escriba cuánto paga— y evita
     escribir una cifra en la interfaz. `pruebas/codigo/91-closer-y-setter` prohibe lo segundo con
     todas las letras: *«un monto con dígitos es una AFIRMACIÓN sobre el dinero de un cliente»*, y un
     «$4.000» gris en un formulario vacío se lee como que ese link existe. */
  closer: { nombre: 'Stripe', monto: 'Monto libre', descripcion: 'Pago único' },
  setter: { nombre: 'Calendario', monto: '', descripcion: 'Para agendar la llamada' },
};

export default function EnlacesRapidos({ territorio }) {
  /* TODOS los de la empresa, y se filtran acá. La lectura es la MISMA que usa el menú del
     compositor: dos consultas de la misma lista divergen en silencio y dejan el menú mostrando siete
     links donde la pantalla que los administra muestra ocho. */
  const [todos, setTodos] = useState([]);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  /** El formulario de alta, abierto o no. `null` = cerrado. */
  const [nuevo, setNuevo] = useState(null);
  const yaPedido = useRef(false);

  const titulo = TITULO_DE_LOS_ENLACES[territorio];
  const ejemplo = EJEMPLOS[territorio];
  const enlaces = todos.filter((e) => e.territorio === territorio);

  const cargar = useCallback(async () => {
    const r = await pedir('/api/enlaces-rapidos');
    if (r.tipo !== 'datos') {
      setCausa(porQue(r));
      setSituacion(r.tipo);
      return;
    }
    setTodos(r.datos.enlaces ?? []);
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
    /* La zona va SIEMPRE en el cuerpo, y el servidor la exige sin valor por omisión: si esta pantalla
       se la olvidara, el link caería en la otra zona y aparecería en un menú que nadie pidió. */
    const r = await pedir('/api/admin/enlaces-rapidos', {
      metodo: 'POST',
      cuerpo: { ...nuevo, territorio },
    });
    setOcupado(false);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }
    /* La respuesta trae la lista completa, y se usa esa: releer con otra petición mostraría
       «guardado» antes de saber qué quedó. */
    setTodos(r.datos.enlaces ?? []);
    setNuevo(null);
    setAviso({ mal: false, texto: 'Listo. Ya se puede mandar desde el chat con el botón +.' });
  }, [nuevo, territorio]);

  const quitar = useCallback(async (id) => {
    setOcupado(true);
    setAviso(null);
    const r = await pedir(`/api/admin/enlaces-rapidos?id=${encodeURIComponent(id)}`, {
      metodo: 'DELETE',
    });
    setOcupado(false);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }
    setTodos(r.datos.enlaces ?? []);
    setAviso({ mal: false, texto: 'Sacado. Ya no aparece en el menú del chat.' });
  }, []);

  if (situacion === 'cargando') {
    return (
      <div className="aj-tarjeta ck-admin">
        <div className="fd-cab">
          <h3>{titulo}</h3>
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
        <h3>{titulo}</h3>
        <span className="fd-bajada">
          Salen en el botón <b>+</b> del chat de un contacto de esta zona. Los ve y los puede mandar
          cualquiera que abra esa ficha; cargarlos y sacarlos es de quien administra.
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
            Todavía no hay links cargados en esta zona, así que el botón <b>+</b> no aparece en el
            chat de sus contactos.
          </span>
        </div>
      ) : (
        <ul className="er-lista">
          {enlaces.map((e) => (
            <li key={e.id} className="er-fila">
              <div className="er-quien">
                <b>{e.nombre}</b>
                {e.monto ? <span className="er-monto">{e.monto}</span> : null}
                {e.descripcion ? <span className="er-nota">{e.descripcion}</span> : null}
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
              <code className="er-url">{e.url}</code>
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
        <div className="er-alta">
          <div className="fd-campo">
            <label htmlFor={`er-nombre-${territorio}`}>Nombre</label>
            <input
              id={`er-nombre-${territorio}`}
              type="text"
              value={nuevo.nombre}
              maxLength={60}
              disabled={ocupado}
              placeholder={ejemplo.nombre}
              onChange={(ev) => setNuevo({ ...nuevo, nombre: ev.target.value })}
            />
          </div>
          <div className="fd-campo">
            <label htmlFor={`er-monto-${territorio}`}>Monto</label>
            {/* Texto y no un número, a propósito: «Monto libre» es uno de los links reales del
                closer. El motivo completo está en la migración 035. */}
            <input
              id={`er-monto-${territorio}`}
              type="text"
              value={nuevo.monto}
              maxLength={24}
              disabled={ocupado}
              placeholder={ejemplo.monto}
              onChange={(ev) => setNuevo({ ...nuevo, monto: ev.target.value })}
            />
          </div>
          <div className="fd-campo">
            <label htmlFor={`er-desc-${territorio}`}>Descripción</label>
            <input
              id={`er-desc-${territorio}`}
              type="text"
              value={nuevo.descripcion}
              maxLength={120}
              disabled={ocupado}
              placeholder={ejemplo.descripcion}
              onChange={(ev) => setNuevo({ ...nuevo, descripcion: ev.target.value })}
            />
          </div>
          <div className="fd-campo er-alta-url">
            <label htmlFor={`er-url-${territorio}`}>Link</label>
            <input
              id={`er-url-${territorio}`}
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
