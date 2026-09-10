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
 *
 * ── Y POR ESO MISMO LA LISTA VIVE EN UNA VENTANA, NO EN LA PANTALLA ───────
 *
 * Las dos decisiones de arriba —la dirección entera y la descripción completa— son correctas y
 * tienen un costo: **cada link ocupa dos renglones**, y con seis links cargados esta tarjeta era
 * más alta que la pantalla. En Inicio, que es lo primero que se ve al entrar, eso empuja hacia
 * abajo el cockpit y las cifras del mes, que es para lo que la gente abre esta pestaña.
 *
 * Se pidió con esas palabras: *«pasar la lista a una pestaña emergente en vez de ponerlo de frente
 * en la pestaña de inicio»*. Así que en Inicio quedan dos botones y nada más, y la lista y el
 * formulario se abren en `Ventana`. No se acortó ni la URL ni la descripción: se movieron de sitio,
 * que es lo que permite conservarlas enteras.
 *
 * ── LA VENTANA VA FUERA DE LA TARJETA, Y NO ES UN DETALLE DE ESTILO ───────
 *
 * `Ventana` es `position: fixed; inset: 0`. La tarjeta de esta pantalla es `.aj-tarjeta`, y la
 * estética de operación le pone `backdrop-filter: blur(4px)` — **y un `backdrop-filter` crea bloque
 * contenedor para los descendientes `fixed`**. Medido en el navegador: un `inset: 0` dentro de la
 * tarjeta se resolvió a `36×914` en la posición de la tarjeta, o sea la ventana atrapada adentro de
 * la caja, con su fondo cubriendo un rectángulo de 36 px de ancho. El `z-index: 101` no salva nada:
 * el problema no es el apilado, es contra qué se mide `inset`.
 *
 * Por eso este componente devuelve un fragmento con la tarjeta Y la ventana como HERMANAS. Se
 * comprobó la cadena entera de ancestros: la tarjeta es el único eslabón que atrapa; de `.cl-page`
 * hacia arriba no hay `transform`, `filter` ni `contain`. Mover la ventana un nivel afuera alcanza.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { TITULO_DE_LOS_ENLACES } from '../../lib/enlaces.ts';
/* La misma ventana que usan Empresas y Usuarios. Su encabezado explica las cuatro cosas que un
   modal tiene que hacer y casi nunca hace —el foco entra y vuelve, el tabulador no se escapa,
   Escape y el fondo cierran, el fondo no se desplaza—. Escribir otra acá sería tener dos, y la que
   se use menos es la que queda mal: es el `ADR-0304` aplicado a la interfaz. */
import Ventana from '../Ventana.jsx';

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
  /** El formulario de alta. `null` = no se está cargando nada. */
  const [nuevo, setNuevo] = useState(null);
  /** Qué muestra la ventana: `null` cerrada, `'lista'` los links, `'alta'` el formulario. */
  const [ventana, setVentana] = useState(null);
  /* El link que está esperando confirmación para salir. Antes la ✕ borraba en el acto; adentro de
     la ventana las filas quedan más juntas y un link de cobro borrado por error hay que volver a
     cargarlo con su URL exacta. La confirmación es EN LA FILA y no otra ventana encima: un modal
     sobre un modal es donde el foco y el Escape se enredan. */
  const [porSacar, setPorSacar] = useState(null);
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
    /* Y la ventana pasa a la LISTA en vez de cerrarse. Es el momento en que uno quiere ver qué
       quedó cargado —el nombre, el monto y la URL que acaba de pegar— y además deja el camino
       abierto para cargar el segundo sin volver a Inicio. */
    setVentana('lista');
    setAviso({ mal: false, texto: 'Listo. Ya se puede mandar desde el chat con el botón +.' });
  }, [nuevo, territorio]);

  const quitar = useCallback(async (id) => {
    setOcupado(true);
    setAviso(null);
    setPorSacar(null);
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

  /** El aviso, dondequiera que esté mirando la persona. */
  const elAviso = aviso ? (
    <div className={`fd-aviso${aviso.mal ? ' mal' : ''}`} role={aviso.mal ? 'alert' : undefined}>
      <i>{aviso.mal ? '⚠' : '✓'}</i>
      <span>{aviso.texto}</span>
    </div>
  ) : null;

  const cerrar = useCallback(() => {
    setVentana(null);
    setNuevo(null);
    setPorSacar(null);
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

  /** La lista, con la ✕ de cada fila y su confirmación. */
  const laLista = (
    <ul className="er-lista">
      {enlaces.map((e) => (
        <li key={e.id} className="er-fila">
          <div className="er-quien">
            <b>{e.nombre}</b>
            {e.monto ? <span className="er-monto">{e.monto}</span> : null}
            {e.descripcion ? <span className="er-nota">{e.descripcion}</span> : null}
          </div>
          {porSacar === e.id ? (
            /* La pregunta NOMBRA el link, y ahí está la seguridad: no hace falta pintar el botón de
               rojo si lo que se lee es «¿Sacar Stripe?». En una lista de filas parecidas, el nombre
               es lo que distingue el clic correcto del equivocado. */
            <div className="er-confirmar">
              <span>¿Sacar {e.nombre}?</span>
              <button
                type="button"
                className="fd-btn-menor er-si"
                disabled={ocupado}
                onClick={() => void quitar(e.id)}
              >
                Sí, sacar
              </button>
              <button
                type="button"
                className="fd-btn-menor"
                disabled={ocupado}
                onClick={() => setPorSacar(null)}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="fd-btn sec ck-quitar"
              disabled={ocupado}
              onClick={() => setPorSacar(e.id)}
              aria-label={`Sacar ${e.nombre}`}
              title="Sacar"
            >
              ✕
            </button>
          )}
          {/* Entera, sin cortar: ver el encabezado. */}
          <code className="er-url">{e.url}</code>
        </li>
      ))}
    </ul>
  );

  /** El formulario de alta. */
  const elFormulario = nuevo === null ? null : (
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
        <button type="button" className="fd-btn sec" disabled={ocupado} onClick={cerrar}>
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── EN INICIO QUEDAN DOS BOTONES Y LO QUE ES INFORMACIÓN ────────────
       *
       * El aviso de «todavía no hay links» se QUEDA acá y no se va a la ventana, y la diferencia
       * importa: no es una lista, es la explicación de por qué el botón `+` no aparece en el chat.
       * Alguien que lo busque ahí no tendría cómo saberlo, y esconderlo detrás de un botón que hay
       * que apretar lo convierte en un dato que nadie va a encontrar. */}
      <div className="aj-tarjeta ck-admin">
        <div className="fd-cab">
          <h3>{titulo}</h3>
          <span className="fd-bajada">
            Salen en el botón <b>+</b> del chat de un contacto de esta zona. Los ve y los puede
            mandar cualquiera que abra esa ficha; cargarlos y sacarlos es de quien administra.
          </span>
        </div>

        {causa ? (
          <div className="fd-aviso mal" role="alert">
            <i>⚠</i>
            <span>{causa}</span>
          </div>
        ) : null}

        {/* El aviso se dibuja donde está la persona: adentro de la ventana si está abierta, acá si
            la cerró justo después de guardar. Uno solo, en dos sitios posibles. */}
        {ventana === null ? elAviso : null}

        {enlaces.length === 0 ? (
          <div className="fd-aviso">
            <i>◍</i>
            <span>
              Todavía no hay links cargados en esta zona, así que el botón <b>+</b> no aparece en el
              chat de sus contactos.
            </span>
          </div>
        ) : null}

        <div className="fd-acciones">
          <button
            type="button"
            className="fd-btn"
            disabled={ocupado}
            onClick={() => {
              setAviso(null);
              setNuevo(EN_BLANCO);
              setVentana('alta');
            }}
          >
            + Agregar link
          </button>
          {/* Con la lista vacía este botón abriría una ventana que no tiene nada que mostrar, y el
              aviso de arriba ya dice lo que hay que saber. El número va en el rótulo porque es lo
              único que la lista decía y que acá se perdería: cuántos hay. */}
          {enlaces.length > 0 ? (
            <button
              type="button"
              className="fd-btn sec"
              disabled={ocupado}
              onClick={() => {
                setAviso(null);
                setVentana('lista');
              }}
            >
              Editar lista ({enlaces.length})
            </button>
          ) : null}
        </div>
      </div>

      {/* HERMANA de la tarjeta, no hija: el `backdrop-filter` de `.aj-tarjeta` la atraparía
          adentro. El motivo medido está en el encabezado del archivo. */}
      {ventana !== null ? (
        <Ventana
          titulo={ventana === 'alta' ? 'Agregar link' : titulo}
          subtitulo={
            ventana === 'alta'
              ? 'El nombre y el link son obligatorios.'
              : 'La ✕ de cada fila lo saca. Se agrega y se saca; para corregir un monto, sacalo y volvé a cargarlo.'
          }
          alCerrar={cerrar}
        >
          {elAviso}
          {ventana === 'alta' ? (
            elFormulario
          ) : (
            <>
              {laLista}
              <div className="fd-acciones">
                <button
                  type="button"
                  className="fd-btn"
                  disabled={ocupado}
                  onClick={() => {
                    setAviso(null);
                    setPorSacar(null);
                    setNuevo(EN_BLANCO);
                    setVentana('alta');
                  }}
                >
                  + Agregar link
                </button>
              </div>
            </>
          )}
        </Ventana>
      ) : null}
    </>
  );
}
