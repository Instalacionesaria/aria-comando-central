'use client';

/* Usuarios — crear personas y darles su rol, en la empresa que se esté administrando.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA PESTAÑA NO SE OCULTA AL CAMBIAR DE EMPRESA
 *
 * Se pidió que Empresas y Usuarios se vieran solo desde la organización principal. Empresas
 * cumple esa regla —y el servidor la comprueba—. **Usuarios no puede.**
 *
 * El motivo no es de interfaz: `POST /api/admin/usuarios` crea SIEMPRE en
 * `contexto.orgEfectiva`, y eso está decidido desde la Etapa 5 con su razón escrita — *"un
 * segundo camino sería un segundo lugar donde olvidarse el filtro"*. O sea que para crearle un
 * usuario a «Cliente X» hay que estar administrando Cliente X.
 *
 * Si la pestaña desapareciera al conmutar, no habría forma de crearle usuarios a ninguna
 * empresa que no fuera la principal — que es justamente lo que hay que poder hacer.
 *
 * Lo que sí se respeta es lo esencial del pedido: **la pestaña pide `organizaciones.listar`**,
 * que solo tiene el rol de plataforma. Un administrador de una empresa cliente no la ve.
 *
 * Y la pantalla dice SIEMPRE, arriba de todo, en qué empresa está creando. El defecto que eso
 * evita es concreto: crear el usuario de un cliente dentro de otro, sin que nada falle.
 *
 * ── ASIGNAR UN ROL REEMPLAZA, NO SUMA ───────────────────────────────────────
 *
 * `POST /api/admin/usuarios/{id}/roles` borra los roles que tenía y pone los que se manden. Por
 * eso esta pantalla muestra los actuales y los precarga: hasta la Etapa 11 el listado no los
 * devolvía, así que editar el rol de alguien era **destructivo a ciegas**.
 *
 * ── EL FORMULARIO ES UNA VENTANA, Y ESO TOCA LA CONTRASEÑA TEMPORAL ─────────
 *
 * Se pidió que el alta apareciera al apretar el botón. Con el formulario adentro de una ventana
 * aparece un riesgo que antes no existía: **la temporal se muestra UNA sola vez**, y una ventana
 * es algo que se cierra de un Escape sin leer.
 *
 * Así que la ventana no se cierra al crear la persona: se queda mostrando la contraseña, y
 * mientras esté en pantalla **Escape y el fondo dejan de cerrar**. Sale con un botón que dice
 * qué se está confirmando. Sin eso, el gesto más natural del mundo —cerrar— destruye un dato
 * irrecuperable, y lo único que queda es restablecerlo.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import Ventana from '../Ventana.jsx';

const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede administrar personas en esta empresa.',
  sobre_si_mismo: 'No podés cambiar tus propios roles.',
  ultimo_administrador: 'Es la última persona que puede administrar esta empresa: no se puede desactivar.',
  email_duplicado: 'Ya existe alguien con ese correo.',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Usuarios({ sesion }) {
  const [gente, setGente] = useState(null);
  const [roles, setRoles] = useState([]);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rolNuevo, setRolNuevo] = useState('');
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState(null);
  /** La contraseña temporal. **Se muestra una sola vez y no se guarda en ningún lado.** */
  const [temporal, setTemporal] = useState(null);
  const [editando, setEditando] = useState(null);
  /** El formulario vive en una ventana emergente: aparece al apretar «Agregar usuario». */
  const [abierta, setAbierta] = useState(false);
  const yaPedido = useRef(false);

  const orgId = sesion?.organizacion?.id;

  const cargar = useCallback(async () => {
    setSituacion('cargando');
    const [u, r] = await Promise.all([pedir('/api/usuarios'), pedir('/api/admin/roles')]);

    if (u.tipo === 'sin_respuesta' || r.tipo === 'sin_respuesta') {
      setCausa('No se pudo contactar al servidor.');
      setSituacion('sin_respuesta');
      return;
    }
    if (u.tipo === 'rechazado') {
      setCausa(u.detalle ?? MOTIVOS[u.codigo] ?? `El servidor respondió ${u.estado}.`);
      setSituacion('rechazado');
      return;
    }
    setGente(u.datos.usuarios ?? []);
    /* El catálogo de roles se pide aparte y su fallo NO tumba la pantalla: sin él se puede ver
       quién hay, que es la mitad útil. Lo que no se puede es asignar, y el formulario lo dice
       en vez de ofrecer una lista vacía. */
    setRoles(r.tipo === 'datos' ? (r.datos.roles ?? []) : []);
    setSituacion('listo');
  }, []);

  /* Se recarga cuando cambia la empresa administrada. Sin esto, conmutar dejaría en pantalla
     la gente de la empresa anterior con el encabezado de la nueva — la peor combinación. */
  useEffect(() => {
    yaPedido.current = false;
  }, [orgId]);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar, orgId]);

  const crear = useCallback(async () => {
    setCreando(true);
    setAviso(null);
    setTemporal(null);

    const r = await pedir('/api/admin/usuarios', {
      metodo: 'POST',
      cuerpo: { nombre: nombre.trim(), email: email.trim() },
    });

    if (r.tipo !== 'datos' || r.datos?.creado === false) {
      setCreando(false);
      const texto =
        r.tipo === 'rechazado'
          ? (r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`)
          : r.tipo === 'sin_respuesta'
            ? 'No llegó al servidor. No se creó nada.'
            : `No se creó: ${r.datos?.motivo}`;
      /* El error se queda en la ventana, con lo tipeado intacto: es donde está el campo que hay
         que corregir. */
      setAviso({ mal: true, texto });
      return;
    }

    const id = r.datos.id;
    /* La temporal se muestra ACÁ y no se guarda: el servidor la devuelve una sola vez
       (`seMuestraUnaVez`) y no hay forma de volver a verla — solo de restablecerla. Ponerla en
       el estado es lo que mantiene la ventana abierta y sin cierre accidental. */
    setTemporal({ email: email.trim(), clave: r.datos.temporal });

    /* El rol es una SEGUNDA llamada, y hay que decirlo: entre las dos, la persona existe con
       cero capacidades. Si la segunda falla, el aviso lo dice en vez de dar por hecho que
       quedó con su rol. */
    let avisoRol = '';
    if (rolNuevo) {
      const rr = await pedir(`/api/admin/usuarios/${id}/roles`, {
        metodo: 'POST',
        cuerpo: { roles: [rolNuevo] },
      });
      avisoRol =
        rr.tipo === 'datos' && rr.datos?.asignados !== false
          ? ` con el rol «${rolNuevo}»`
          : ` — PERO NO se le pudo dar el rol «${rolNuevo}»: ${
              rr.tipo === 'rechazado' ? (rr.detalle ?? rr.codigo) : (rr.datos?.motivo ?? 'sin respuesta')
            }. Quedó sin ninguna capacidad; asignáselo desde la lista.`;
    } else {
      avisoRol = ' — sin rol todavía, así que no va a poder ver ninguna pantalla.';
    }

    setCreando(false);
    setAviso({ mal: avisoRol.includes('PERO NO'), texto: `Usuario creado${avisoRol}` });
    setNombre('');
    setEmail('');
    setRolNuevo('');
    yaPedido.current = false;
    await cargar();
  }, [nombre, email, rolNuevo, cargar]);

  const asignar = useCallback(
    async (usuario, claves) => {
      const r = await pedir(`/api/admin/usuarios/${usuario.id}/roles`, {
        metodo: 'POST',
        cuerpo: { roles: claves },
      });
      if (r.tipo !== 'datos' || r.datos?.asignados === false) {
        const texto =
          r.tipo === 'rechazado'
            ? (r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`)
            : r.tipo === 'sin_respuesta'
              ? 'No llegó al servidor.'
              : `No se asignó: ${r.datos?.motivo}`;
        setAviso({ mal: true, texto });
        return;
      }
      setAviso({ mal: false, texto: `Roles de ${usuario.nombre}: ${claves.join(', ') || 'ninguno'}` });
      setEditando(null);
      yaPedido.current = false;
      await cargar();
    },
    [cargar],
  );

  if (situacion === 'cargando') {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Cargando las personas…</span>
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

  const puedeCrear = nombre.trim().length > 0 && EMAIL.test(email.trim()) && !creando;
  const asignables = roles.filter((r) => !r.soloPrincipal);

  /* El mismo aviso, en dos sitios posibles: adentro de la ventana mientras está abierta y en la
     página cuando se cerró. Se define una vez para que no puedan divergir. */
  const elAviso = aviso ? (
    <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
      <i>{aviso.mal ? '⚠' : '✓'}</i>
      <span>{aviso.texto}</span>
    </div>
  ) : null;

  const abrir = () => {
    setAviso(null);
    setTemporal(null);
    setAbierta(true);
  };
  /* Cerrar TIRA la temporal, y por eso solo se llega acá a propósito: mientras está en pantalla,
     `cerrablePorFuera={false}` saca el fondo y Escape de las formas de cerrar. */
  const cerrar = () => {
    setAbierta(false);
    setTemporal(null);
  };

  return (
    <>
      {/* EN QUÉ EMPRESA. Arriba de todo y sin ambigüedad: el defecto que evita es crear el
          usuario de un cliente dentro de otro, sin que nada falle. */}
      <div className={`fd-aviso ${sesion?.mirandoOtraOrganizacion ? 'falta' : ''}`}>
        <i>◍</i>
        <span>
          Estás creando personas en <b>{sesion?.organizacion?.nombre ?? '—'}</b>
          {sesion?.mirandoOtraOrganizacion
            ? ' — que NO es tu organización. Para cambiar, andá a la pestaña Empresas.'
            : '.'}
        </span>
      </div>

      {abierta ? null : elAviso}

      {/* ── La lista, con el alta en su encabezado ── */}
      <div className="card">
        <div className="card-head">
          Personas <span className="hint">{gente.length}</span>
          <button type="button" className="fd-btn aj-alta" onClick={abrir}>
            Agregar usuario
          </button>
        </div>
        <div className="rows">
          {gente.map((u) => (
            <div className="row-i" key={u.id} style={{ gridTemplateColumns: '1.6fr 1.4fr auto' }}>
              <div>
                <div className="rn">
                  {u.nombre}
                  {u.es_admin_principal ? <span className="tagx ag" style={{ marginLeft: 8 }}>Fundador</span> : null}
                  {!u.activo ? <span className="tagx no" style={{ marginLeft: 8 }}>Inactivo</span> : null}
                </div>
                <div className="rs">{u.email ?? 'sin correo'}</div>
              </div>
              <div>
                {editando === u.id ? (
                  <select
                    defaultValue={u.roles?.[0] ?? ''}
                    onChange={(e) => void asignar(u, e.target.value ? [e.target.value] : [])}
                  >
                    <option value="">Sin rol</option>
                    {asignables.map((r) => (
                      <option key={r.clave} value={r.clave}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                ) : u.roles?.length ? (
                  u.roles.map((c) => (
                    <span className="tagx nu" key={c} style={{ marginRight: 6 }}>
                      {c}
                    </span>
                  ))
                ) : (
                  /* Sin rol NO es un espacio en blanco: es una persona que puede entrar y no
                     ve nada, y eso hay que poder verlo de un vistazo. */
                  <span style={{ color: 'var(--warn)', fontSize: 11.5 }}>sin rol · no ve nada</span>
                )}
              </div>
              <div className="num">
                {u.id === sesion?.usuarioId ? (
                  /* `ADR-0502`: nadie se degrada a sí mismo. El servidor responde 409, y
                     ofrecer el botón para recibir ese 409 sería un control que no funciona. */
                  <span className="rs">sos vos</span>
                ) : (
                  <button
                    type="button"
                    className="fd-btn sec"
                    onClick={() => setEditando(editando === u.id ? null : u.id)}
                  >
                    {editando === u.id ? 'Cancelar' : 'Cambiar rol'}
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
          titulo={temporal ? 'Copiá la contraseña temporal' : 'Agregar una persona'}
          subtitulo={
            temporal
              ? 'Es la única vez que se puede ver. Después solo se puede restablecer.'
              : `Se crea en ${sesion?.organizacion?.nombre ?? 'esta empresa'}.`
          }
          /* La temporal en pantalla saca el cierre accidental. Es lo único que justifica quitar
             Escape, y solo porque lo que se pierde no se puede recuperar. */
          cerrablePorFuera={!temporal}
          alCerrar={cerrar}
        >
          {temporal ? (
            <>
              {/* Reemplaza al formulario en vez de sumarse: dejarlo debajo daría a entender que
                  se puede crear otra mientras esta contraseña sigue sin copiarse. */}
              <div className="fd-aviso bien">
                <i>✓</i>
                <span>
                  Contraseña temporal de <b>{temporal.email}</b>:
                </span>
              </div>
              <code className="aj-valor" style={{ display: 'block', padding: '10px 12px', fontSize: 14 }}>
                {temporal.clave}
              </code>
              <div className="aj-ayuda">
                <b>Se muestra una sola vez.</b> Copiala ahora: no se puede volver a ver, solo
                restablecer. La persona tendrá que cambiarla al entrar.
              </div>

              {elAviso}

              <div className="aj-fila">
                <button type="button" className="fd-btn" onClick={cerrar}>
                  Listo, ya la copié
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="fd-rejilla dos">
                <div className="fd-campo">
                  <label htmlFor="us-nombre">Nombre</label>
                  <input id="us-nombre" type="text" value={nombre} placeholder="Nombre y apellido"
                    onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div className="fd-campo">
                  <label htmlFor="us-email">Correo</label>
                  <input id="us-email" type="email" value={email} placeholder="persona@empresa.com"
                    autoComplete="off" onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="fd-campo">
                <label htmlFor="us-rol">Rol</label>
                {asignables.length === 0 ? (
                  <div className="fd-aviso falta">
                    <i>⚠</i>
                    <span>No se pudo leer el catálogo de roles. Se puede crear la persona, pero habrá que darle el rol después.</span>
                  </div>
                ) : (
                  <select id="us-rol" value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value)}>
                    <option value="">Sin rol todavía</option>
                    {asignables.map((r) => (
                      <option key={r.clave} value={r.clave}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="aj-ayuda">
                Sin rol, la persona puede entrar y no ve ninguna pantalla. Un <b>Closer</b> ve solo la
                pestaña Closer; un <b>Setter</b> solo la del Setter.
              </div>

              {elAviso}

              <div className="aj-fila">
                <button type="button" className="fd-btn" disabled={!puedeCrear} onClick={() => void crear()}>
                  {creando ? 'Creando…' : 'Crear persona'}
                </button>
                <button type="button" className="fd-btn sec" disabled={creando} onClick={cerrar}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </Ventana>
      ) : null}
    </>
  );
}
