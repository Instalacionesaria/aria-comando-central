'use client';

/* Empresas — dar de alta organizaciones, ver cuáles operan, editarlas y eliminarlas.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SOLO DESDE LA ORGANIZACIÓN PRINCIPAL, Y QUÉ CLASE DE REGLA ES
 *
 * Se pidió así. Y conviene decir qué protege y qué no: **no es una barrera de seguridad**. La
 * barrera es la capacidad `organizaciones.listar`, que solo tiene el rol de plataforma — el
 * reparto se la niega al administrador con `not like 'organizaciones.%'`. Quien no la tiene no
 * llega acá esté donde esté.
 *
 * Lo que la regla evita es otra cosa, y es real: administrar la plataforma **creyendo que se
 * está dentro de una empresa cliente**. Con la sesión conmutada a otra organización, el cartel
 * permanente dice "estás mirando otra organización" y esta pantalla mostraría las veinte — dos
 * afirmaciones que se contradicen en la misma vista.
 *
 * La comprobación vive SOLO acá, y eso es deliberado: en el servidor se quitó porque creaba un
 * encierro —el listado alimenta también el conmutador, así que la regla dejaba a alguien
 * conmutado sin pestaña *y* sin conmutador—. Ver `app/api/admin/organizaciones/route.ts`.
 *
 * ── LO QUE UN ALTA NO HACE ──────────────────────────────────────────────────
 *
 * Crear una empresa **no crea ningún usuario ni ninguna credencial**. Es del `05` § 2 y es
 * deliberado: *"la tentación de 'sembrar' una organización nueva con datos de demostración
 * termina en clientes que ven información que no es suya y no saben si es real"*.
 *
 * Así que una empresa recién creada existe y NO opera. La lista lo dice en cada fila, porque
 * es la pregunta que sigue: *¿a cuál le falta conectar GoHighLevel?*
 *
 * ── LA EMPRESA PRINCIPAL NO SE TOCA, Y NO LO DECIDE ESTA PANTALLA ───────────
 *
 * A ARIA no se le ofrece desactivar ni eliminar. Las dos las rechaza el disparador
 * `organizaciones_protegida` de la migración 007, con el criterio escrito ahí: *"un condicional se
 * saltea con una sentencia a mano un domingo. Un disparador no."* Desactivarla equivaldría a
 * apagar la plataforma entera.
 *
 * Tampoco se ofrece eliminar la empresa que se está administrando: quien lo hiciera se quedaría
 * con una sesión apuntando a algo que ya no existe. Eso lo rechaza la ruta, porque la base no lo
 * impide — `sesiones.org_activa` se pone en nulo y el borrado pasaría.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { ZONAS } from '../../lib/negocio/zonas.ts';
import Ventana from '../Ventana.jsx';

const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede administrar empresas.',
  sobre_si_mismo: 'No se puede eliminar la empresa que estás administrando.',
};

/** Un slug: minúsculas, números y guiones. La misma forma que valida el servidor. */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

/** Propone un slug a partir del nombre, sin imponerlo. */
function slugDe(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** El texto de un rechazo, con el detalle del servidor si lo trae. */
function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se cambió nada.';
  if (r.tipo === 'rechazado') return r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`;
  return `No se pudo: ${r.datos?.motivo ?? 'sin motivo'}`;
}

export default function Empresas({ sesion, alCambiarDeEmpresa }) {
  const [lista, setLista] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [aviso, setAviso] = useState(null);

  // ── El alta ──
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  /* La zona de la empresa. Arranca en la de ESTE navegador y no en UTC: quien crea la empresa casi
     siempre está en la misma zona que su equipo, y `UTC` no significa «está en UTC» — significa
     «nadie lo dijo». Ver `lib/negocio/zonas.ts`, donde está medido lo que ese silencio costaba. */
  const [zona, setZona] = useState(() => {
    try {
      const propia = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return ZONAS.some((z) => z.valor === propia) ? propia : 'America/Lima';
    } catch {
      return 'America/Lima';
    }
  });
  const [creando, setCreando] = useState(false);

  // ── La edición ──
  const [editando, setEditando] = useState(null);
  const [edNombre, setEdNombre] = useState('');
  const [edZona, setEdZona] = useState('UTC');
  /* El precio como TEXTO y no como número: la cadena vacía es un estado que hay que poder
     representar —«sin cargar»— y `0` no sirve para eso. Se convierte al mandar. */
  const [edPrecio, setEdPrecio] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmaBorrado, setConfirmaBorrado] = useState(false);

  const yaPedido = useRef(false);

  const cargar = useCallback(async () => {
    setSituacion('cargando');
    const r = await pedir('/api/admin/organizaciones');
    if (r.tipo === 'sin_respuesta') {
      setCausa('No se pudo contactar al servidor.');
      setSituacion('sin_respuesta');
      return;
    }
    if (r.tipo === 'rechazado') {
      setCausa(r.detalle ?? MOTIVOS[r.codigo] ?? `El servidor respondió ${r.estado}.`);
      setSituacion('rechazado');
      return;
    }
    setLista(r.datos.organizaciones ?? []);
    setSituacion('listo');
  }, []);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  const recargar = useCallback(async () => {
    yaPedido.current = false;
    await cargar();
  }, [cargar]);

  /* El slug que se ENVÍA es el que se MUESTRA.
     La primera versión mandaba el estado `slug`, que está vacío mientras nadie toque el campo
     —el valor visible sale de `slugDe(nombre)`—, así que crear sin tocar el identificador
     mandaba una cadena vacía y el servidor respondía `slug_invalido`. Mostrar una cosa y
     mandar otra es la clase de defecto que no se ve leyendo el componente. */
  const crear = useCallback(async () => {
    const elSlug = (slugTocado ? slug : slugDe(nombre)).trim();
    setCreando(true);
    setAviso(null);
    const r = await pedir('/api/admin/organizaciones', {
      metodo: 'POST',
      cuerpo: { nombre: nombre.trim(), slug: elSlug, zonaHoraria: zona },
    });
    setCreando(false);

    if (r.tipo !== 'datos' || r.datos?.creada === false) {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }

    setAviso({
      mal: false,
      texto: `«${nombre.trim()}» creada. Todavía NO opera: hay que cargarle su token de GoHighLevel y crearle usuarios.`,
    });
    setNombre('');
    setSlug('');
    setSlugTocado(false);
    setAltaAbierta(false);
    await recargar();
  }, [nombre, slug, slugTocado, recargar]);

  /* Conmutar de empresa. Es una operación REAL de la sesión, no un filtro de pantalla:
     `PATCH /api/auth/sesion` escribe `org_activa`, y a partir de ahí TODO lo que hace la
     aplicación es de esa organización. Por eso se recarga la sesión entera después. */
  const irA = useCallback(
    async (org) => {
      const r = await pedir('/api/auth/sesion', { metodo: 'PATCH', cuerpo: { orgId: org.id } });
      if (r.tipo !== 'datos') {
        setAviso({ mal: true, texto: 'No se pudo cambiar de empresa.' });
        return;
      }
      alCambiarDeEmpresa?.();
    },
    [alCambiarDeEmpresa],
  );

  // ─── La edición ───────────────────────────────────────────────────────────

  const abrirEdicion = (o) => {
    setAviso(null);
    setConfirmaBorrado(false);
    setEditando(o);
    setEdNombre(o.nombre ?? '');
    /* El valor GUARDADO, no el del navegador. En el alta se propone la zona de quien crea; acá
       proponer otra cosa que lo guardado haría que abrir y guardar sin tocar nada cambiara la
       zona de la empresa — un efecto que nadie pidió y que nada mostraría. */
    setEdZona(o.zonaHoraria ?? 'UTC');
    /* Cadena vacía = «sin cargar», que es lo que la base guarda como `null`. Se propone `''` y no
       `'0'`: proponer un cero convertiría «nadie lo definió» en «no paga» con sólo abrir y
       guardar, y son dos hechos distintos que el Panel de Monitoreo dibuja distinto. */
    setEdPrecio(o.precioMensual === null || o.precioMensual === undefined ? '' : String(o.precioMensual));
  };
  const cerrarEdicion = () => {
    setEditando(null);
    setConfirmaBorrado(false);
  };

  const guardar = useCallback(async () => {
    if (!editando) return;
    setOcupado(true);
    setAviso(null);
    const r = await pedir(`/api/admin/organizaciones/${editando.id}`, {
      metodo: 'PATCH',
      cuerpo: {
        nombre: edNombre.trim(),
        zonaHoraria: edZona,
        /* El campo vacío se manda como `null` EXPLÍCITO, no se omite: omitirlo significa «no lo
           toques», así que borrar el precio sería imposible desde esta pantalla. Ver el endpoint,
           que distingue las dos cosas con `Object.hasOwn`. */
        precioMensual: edPrecio.trim() === '' ? null : Number(edPrecio),
      },
    });
    setOcupado(false);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }
    setAviso({ mal: false, texto: `Se guardó «${edNombre.trim()}».` });
    cerrarEdicion();
    await recargar();
  }, [editando, edNombre, edZona, edPrecio, recargar]);

  /** Activar, desactivar o borrar la empresa abierta. */
  const accion = useCallback(
    async (que) => {
      if (!editando) return;
      setOcupado(true);
      setAviso(null);
      const r =
        que === 'borrar'
          ? await pedir(`/api/admin/organizaciones/${editando.id}`, { metodo: 'DELETE' })
          : await pedir(`/api/admin/organizaciones/${editando.id}`, {
              metodo: 'PATCH',
              cuerpo: { activa: que === 'activar' },
            });
      setOcupado(false);

      if (r.tipo !== 'datos') {
        /* El aviso se queda EN LA VENTANA: estos rechazos explican por qué no se pudo —«tiene
           contactos cargados», «todavía tiene personas dadas de alta»— y ésa es la información
           que dice qué hacer en su lugar. */
        setAviso({ mal: true, texto: porQue(r) });
        return;
      }

      setAviso({
        mal: false,
        texto: {
          desactivar: `«${editando.nombre}» dejó de operar. Sus datos siguen ahí y se puede reactivar.`,
          activar: `«${editando.nombre}» vuelve a operar.`,
          borrar: `Se eliminó «${editando.nombre}».`,
        }[que],
      });
      cerrarEdicion();
      await recargar();
    },
    [editando, recargar],
  );

  // ─── Pantalla ─────────────────────────────────────────────────────────────

  if (situacion === 'cargando') {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando las empresas…</span>
      </div>
    );
  }
  if (situacion !== 'listo') {
    return (
      <div className="fd-aviso mal">
        <i>◍</i>
        <span>{causa}</span>
      </div>
    );
  }

  const slugPropuesto = slugTocado ? slug : slugDe(nombre);
  const slugValido = SLUG.test(slugPropuesto);
  const puedeCrear = nombre.trim().length > 0 && slugValido && !creando;

  const elAviso = aviso ? (
    <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
      <i>{aviso.mal ? '⚠' : '✓'}</i>
      <span>{aviso.texto}</span>
    </div>
  ) : null;

  const esPrincipal = Boolean(editando?.esPrincipal);
  const esLaQueAdministro = editando?.id === sesion?.organizacion?.id;

  return (
    <>
      <p className="aj-intro">
        Cada empresa tiene <b>sus propios datos y sus propias credenciales</b>. Una empresa recién
        creada existe pero <b>no opera</b>: hay que cargarle su conexión de GoHighLevel y crearle
        usuarios.
      </p>

      {altaAbierta || editando ? null : elAviso}

      {/* ── La lista, con el alta en su encabezado ── */}
      <div className="card">
        <div className="card-head">
          Empresas <span className="hint">{lista.length}</span>
          <button
            type="button"
            className="fd-btn aj-alta"
            onClick={() => {
              setAviso(null);
              setAltaAbierta(true);
            }}
          >
            Crear empresa
          </button>
        </div>
        <div className="rows">
          {lista.map((o) => (
            <div className="row-i" key={o.id} style={{ gridTemplateColumns: '1.6fr 1fr 1fr auto' }}>
              <div>
                <div className="rn">
                  {o.nombre}
                  {o.esPrincipal ? <span className="tagx ag" style={{ marginLeft: 8 }}>Principal</span> : null}
                  {!o.activa ? <span className="tagx no" style={{ marginLeft: 8 }}>Desactivada</span> : null}
                  {/* SIN ZONA se dice en la lista, no solo adentro del formulario. `UTC` es el valor
                      por omisión de la columna, así que significa «nadie lo dijo» — y el efecto es que
                      las citas de la tarde se dibujan un día corridas. Sin esta etiqueta había que abrir
                      cada empresa de a una para enterarse. */}
                  {o.zonaHoraria === 'UTC' ? (
                    <span
                      className="tagx venc"
                      style={{ marginLeft: 8 }}
                      title="Las horas se muestran en UTC. Si el equipo no trabaja en UTC, las citas de la tarde aparecen un día corridas. Se elige en Editar."
                    >
                      Sin zona horaria
                    </span>
                  ) : null}
                </div>
                <div className="rs">{o.slug}</div>
              </div>
              <div>
                {/* «Opera» no es «existe». Es la pregunta que sigue a crear una empresa. */}
                <span className={`chip ${o.tieneCredencialDeCrm ? 'ok' : 'warn'}`}>
                  {o.tieneCredencialDeCrm ? 'Conectada' : 'Sin conectar'}
                </span>
              </div>
              <div className="num">
                {o.usuarios === 0 ? (
                  /* Cero usuarios es un hecho medido, y grave: es una empresa a la que nadie
                     puede entrar. Por eso se dice con palabras y no con un 0 suelto. */
                  <span style={{ color: 'var(--warn)' }}>sin usuarios</span>
                ) : (
                  `${o.usuarios} usuario(s)`
                )}
              </div>
              <div className="num" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" className="fd-btn sec" onClick={() => abrirEdicion(o)}>
                  Editar
                </button>
                {o.id === sesion?.organizacion?.id ? (
                  <span className="rs">estás acá</span>
                ) : (
                  <button type="button" className="fd-btn sec" onClick={() => void irA(o)}>
                    Entrar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── El alta ── */}
      {altaAbierta ? (
        <Ventana
          titulo="Crear una empresa"
          subtitulo="Va a existir pero NO va a operar: después hay que cargarle GoHighLevel y crearle usuarios."
          alCerrar={() => setAltaAbierta(false)}
        >
          <div className="fd-rejilla dos">
            <div className="fd-campo">
              <label htmlFor="emp-nombre">Nombre</label>
              <input
                id="emp-nombre"
                type="text"
                value={nombre}
                placeholder="Cliente Ejemplo"
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="fd-campo">
              <label htmlFor="emp-slug">Identificador corto</label>
              <input
                id="emp-slug"
                type="text"
                value={slugPropuesto}
                placeholder="cliente-ejemplo"
                onChange={(e) => {
                  setSlugTocado(true);
                  setSlug(e.target.value);
                }}
              />
            </div>
          </div>
          <div className="fd-campo">
            <label htmlFor="emp-zona">Zona horaria</label>
            <select id="emp-zona" value={zona} onChange={(e) => setZona(e.target.value)}>
              {ZONAS.map((z) => (
                <option key={z.valor} value={z.valor}>
                  {z.nombre}
                </option>
              ))}
            </select>
            {/* Se dice PARA QUÉ sirve. Un campo de configuración sin consecuencia visible se elige
                al azar, y este decide qué día es «hoy» para toda la empresa. */}
            <div className="aj-ayuda">
              Decide qué es «hoy» y a qué hora se muestra cada cita. Si queda mal, las citas de la
              tarde aparecen un día corridas — y nada lo avisa.
            </div>
          </div>

          {/* Se PROPONE a partir del nombre y se puede cambiar. Un slug generado sin mostrarlo
              es un dato que después aparece en una URL y nadie sabe de dónde salió. */}
          <div className="aj-ayuda">
            El identificador va en direcciones y no se puede repetir: minúsculas, números y
            guiones. Se propone a partir del nombre y se puede cambiar.
          </div>
          {!slugValido && slugPropuesto.length > 0 ? (
            <div className="fd-aviso falta">
              <i>⚠</i>
              <span>«{slugPropuesto}» no sirve como identificador: minúsculas, números y guiones.</span>
            </div>
          ) : null}

          {elAviso}

          <div className="aj-fila">
            <button type="button" className="fd-btn" disabled={!puedeCrear} onClick={() => void crear()}>
              {creando ? 'Creando…' : 'Crear empresa'}
            </button>
            <button type="button" className="fd-btn sec" disabled={creando} onClick={() => setAltaAbierta(false)}>
              Cancelar
            </button>
          </div>
        </Ventana>
      ) : null}

      {/* ── La edición ── */}
      {editando ? (
        <Ventana
          titulo={editando.nombre}
          subtitulo={
            esPrincipal
              ? 'Es la empresa principal de la plataforma.'
              : `Identificador: ${editando.slug}`
          }
          alCerrar={cerrarEdicion}
        >
          <div className="fd-campo">
            <label htmlFor="ed-emp-nombre">Nombre</label>
            <input
              id="ed-emp-nombre"
              type="text"
              value={edNombre}
              onChange={(e) => setEdNombre(e.target.value)}
            />
          </div>
          <div className="fd-campo">
            <label htmlFor="ed-emp-zona">Zona horaria</label>
            <select id="ed-emp-zona" value={edZona} onChange={(e) => setEdZona(e.target.value)}>
              {ZONAS.map((z) => (
                <option key={z.valor} value={z.valor}>
                  {z.nombre}
                </option>
              ))}
            </select>
            {/* SE DICE LA CONSECUENCIA, no el nombre del campo. Esto decide qué día es «hoy» para
                toda la empresa, y una zona equivocada no da error: corre las horas en silencio. */}
            <div className="aj-ayuda" style={{ margin: '4px 0 0' }}>
              Decide qué es «hoy» y a qué hora se muestra cada cita de la agenda. Si queda mal, las
              citas de la tarde aparecen un día corridas — y nada lo avisa.
            </div>
          </div>

          <div className="fd-campo">
            <label htmlFor="ed-emp-precio">Precio mensual (USD)</label>
            <input
              id="ed-emp-precio"
              type="number"
              min="0"
              step="0.01"
              placeholder="Sin cargar"
              value={edPrecio}
              onChange={(e) => setEdPrecio(e.target.value)}
            />
            {/* SE DICE LA CONSECUENCIA. Vacío y cero no son lo mismo, y la diferencia decide qué
                muestra el Panel de Monitoreo: un total que contara los vacíos como cero afirmaría
                un ingreso medido sobre empresas que nadie miró. */}
            <div className="aj-ayuda" style={{ margin: '4px 0 0' }}>
              Lo que esta empresa te paga por mes. Déjalo <b>vacío</b> si todavía no lo definiste y
              pon <b>0</b> si no paga: en el Panel de Monitoreo el vacío no suma al total y el cero
              sí. Va en dólares — el costo de Apify también, y el margen es la resta de los dos.
            </div>
          </div>

          <div className="aj-ayuda">
            El identificador corto <b>no se cambia</b>: va en direcciones, y cambiarlo rompería
            cualquier enlace que ya exista.
          </div>

          {elAviso}

          <div className="aj-fila">
            <button
              type="button"
              className="fd-btn"
              disabled={ocupado || edNombre.trim().length === 0}
              onClick={() => void guardar()}
            >
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="fd-btn sec" disabled={ocupado} onClick={cerrarEdicion}>
              Cancelar
            </button>
          </div>

          <div className="aj-sep" />

          {esPrincipal ? (
            <div className="aj-ayuda">
              A la empresa principal no se la puede desactivar ni eliminar. Lo impide la base de
              datos, no esta pantalla: desactivarla equivale a apagar la plataforma entera.
            </div>
          ) : (
            <>
              <div className="aj-fila">
                {editando.activa ? (
                  <button
                    type="button"
                    className="fd-btn sec"
                    disabled={ocupado}
                    onClick={() => void accion('desactivar')}
                  >
                    Desactivar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="fd-btn sec"
                    disabled={ocupado}
                    onClick={() => void accion('activar')}
                  >
                    Reactivar
                  </button>
                )}
                {esLaQueAdministro || confirmaBorrado ? null : (
                  <button
                    type="button"
                    className="fd-btn sec"
                    disabled={ocupado}
                    style={{ color: 'var(--crit)' }}
                    onClick={() => setConfirmaBorrado(true)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
              <div className="aj-ayuda">
                <b>Desactivar</b> deja la empresa sin operar y conserva todos sus datos: sus
                usuarios no pueden entrar y sus pantallas dejan de responder. Es reversible.
              </div>

              {esLaQueAdministro ? (
                <div className="aj-ayuda">
                  No se puede eliminar la empresa que estás administrando: te quedarías con una
                  sesión apuntando a algo que ya no existe. Volvé a la tuya primero.
                </div>
              ) : null}

              {confirmaBorrado ? (
                <div className="fd-aviso falta">
                  <i>⚠</i>
                  <span>
                    <b>Eliminar no se puede deshacer.</b> Si esta empresa tiene personas, contactos
                    o cualquier dato cargado, la base va a rechazarlo — y ahí lo que corresponde es
                    desactivarla.
                    <br />
                    <button
                      type="button"
                      className="fd-btn"
                      disabled={ocupado}
                      style={{ marginTop: 8, marginRight: 7 }}
                      onClick={() => void accion('borrar')}
                    >
                      {ocupado ? 'Eliminando…' : `Sí, eliminar «${editando.nombre}»`}
                    </button>
                    <button
                      type="button"
                      className="fd-btn sec"
                      disabled={ocupado}
                      style={{ marginTop: 8 }}
                      onClick={() => setConfirmaBorrado(false)}
                    >
                      No
                    </button>
                  </span>
                </div>
              ) : null}
            </>
          )}
        </Ventana>
      ) : null}
    </>
  );
}
