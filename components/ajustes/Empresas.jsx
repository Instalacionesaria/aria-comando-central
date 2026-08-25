'use client';

/* Empresas — dar de alta organizaciones y ver cuáles operan.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SOLO DESDE LA ORGANIZACIÓN PRINCIPAL, Y QUÉ CLASE DE REGLA ES
 *
 * Se pidió así. Y conviene decir qué protege y qué no: **no es una barrera de seguridad**. La
 * barrera es la capacidad `organizaciones.listar`, que solo tiene el rol de plataforma — la
 * migración 003 se la niega al administrador con `not like 'organizaciones.%'`. Quien no la
 * tiene no llega acá esté donde esté.
 *
 * Lo que la regla evita es otra cosa, y es real: administrar la plataforma **creyendo que se
 * está dentro de una empresa cliente**. Con la sesión conmutada a otra organización, el cartel
 * permanente dice "estás mirando otra organización" y esta pantalla mostraría las veinte — dos
 * afirmaciones que se contradicen en la misma vista.
 *
 * Se comprueba también en el servidor (`app/api/admin/organizaciones/route.ts`), para que las
 * dos mitades digan lo mismo. Una regla que solo vive en la pantalla se salta con una petición
 * a mano, y entonces no era una regla.
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
 * ── EL FORMULARIO ES UNA VENTANA ────────────────────────────────────────────
 *
 * Se pidió que apareciera al apretar el botón, y hay un motivo además del pedido: el alta es
 * una operación OCASIONAL y la lista es lo que se mira siempre. Con el formulario permanente
 * arriba, lo que importa quedaba empujado hacia abajo todo el tiempo. Ver `components/Ventana.jsx`.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import Ventana from '../Ventana.jsx';

const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede administrar empresas.',
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

export default function Empresas({ sesion, alCambiarDeEmpresa }) {
  const [lista, setLista] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState(null);
  /** El formulario vive en una ventana emergente: aparece al apretar «Crear empresa». */
  const [abierta, setAbierta] = useState(false);
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
      cuerpo: { nombre: nombre.trim(), slug: elSlug },
    });
    setCreando(false);

    if (r.tipo === 'sin_respuesta') {
      setAviso({ mal: true, texto: 'No llegó al servidor. No se creó nada.' });
      return;
    }
    if (r.tipo === 'rechazado') {
      setAviso({ mal: true, texto: r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).` });
      return;
    }
    /* Esta ruta devuelve `ok({creada:false, motivo}, 400)` para las validaciones — una forma
       vieja que el cliente clasifica como rechazo, así que este tramo solo corre en el 201.
       Se mira igual: si algún día la ruta devuelve 200 con `creada:false`, un «listo» acá
       sería un éxito reportado que no ocurrió. */
    if (r.datos?.creada === false) {
      setAviso({ mal: true, texto: `No se creó: ${r.datos.motivo}` });
      return;
    }

    setAviso({
      mal: false,
      texto: `«${nombre.trim()}» creada. Todavía NO opera: hay que cargarle su token de GoHighLevel y crearle usuarios.`,
    });
    setNombre('');
    setSlug('');
    setSlugTocado(false);
    /* Se cierra sola al crear, y el aviso NO se pierde: se dibuja en la página cuando la ventana
       no está. Los errores, en cambio, se quedan adentro — es donde está el campo que hay que
       corregir, y cerrar la ventana con el nombre a medio escribir sería perder lo tipeado. */
    setAbierta(false);
    yaPedido.current = false;
    await cargar();
  }, [nombre, slug, slugTocado, cargar]);

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

  /* El mismo aviso, en dos sitios posibles: adentro de la ventana mientras está abierta —donde
     está el campo que hay que corregir— y en la página cuando se cerró. Se define una vez para
     que las dos ubicaciones no puedan divergir. */
  const elAviso = aviso ? (
    <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
      <i>{aviso.mal ? '⚠' : '✓'}</i>
      <span>{aviso.texto}</span>
    </div>
  ) : null;

  /* Al abrir se limpia el aviso anterior. Un «creada» de hace un rato encima del formulario de
     la siguiente es la clase de cosa que hace dudar de si se creó una o dos. */
  const abrir = () => {
    setAviso(null);
    setAbierta(true);
  };

  return (
    <>
      <p className="aj-intro">
        Cada empresa tiene <b>sus propios datos y sus propias credenciales</b>. Una empresa recién
        creada existe pero <b>no opera</b>: hay que cargarle su conexión de GoHighLevel y crearle
        usuarios.
      </p>

      {abierta ? null : elAviso}

      {/* ── La lista, con el alta en su encabezado ── */}
      <div className="card">
        <div className="card-head">
          Empresas <span className="hint">{lista.length}</span>
          <button type="button" className="fd-btn aj-alta" onClick={abrir}>
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
              <div className="num">
                {o.id === sesion?.organizacion?.id ? (
                  <span className="rs">estás acá</span>
                ) : (
                  <button type="button" className="fd-btn sec" onClick={() => void irA(o)}>
                    Administrar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── El alta ── */}
      {abierta ? (
        <Ventana
          titulo="Crear una empresa"
          subtitulo="Va a existir pero NO va a operar: después hay que cargarle GoHighLevel y crearle usuarios."
          alCerrar={() => setAbierta(false)}
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
            <button type="button" className="fd-btn sec" disabled={creando} onClick={() => setAbierta(false)}>
              Cancelar
            </button>
          </div>
        </Ventana>
      ) : null}
    </>
  );
}
