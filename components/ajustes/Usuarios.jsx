'use client';

/* Usuarios — crear personas, darles su rol, editarlas, desactivarlas y eliminarlas.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA PESTAÑA NO SE OCULTA AL CAMBIAR DE EMPRESA
 *
 * Se pidió que Empresas y Usuarios se vieran solo desde la organización principal. Empresas
 * cumple esa regla. **Usuarios no puede**, y el motivo no es de interfaz: editar, desactivar y
 * borrar operan sobre `contexto.orgEfectiva`, o sea la organización ACTIVA de la sesión. Si la
 * pestaña desapareciera al conmutar, no habría forma de administrar a la gente de ningún cliente.
 *
 * Lo esencial del pedido se cumple, y desde la Etapa 12 lo hace cumplir el SERVIDOR: el rol
 * `administrador` perdió la familia `usuarios.%` entera. Antes no la veía pero **podía llamar a
 * sus rutas**; ahora recibe 403. La frontera dejó de ser cosmética.
 *
 * Y para no obligar a conmutar por un alta, el formulario lleva **selector de empresa**.
 *
 * ── UNA VENTANA POR PERSONA, NO CINCO BOTONES POR FILA ──────────────────────
 *
 * Las operaciones son seis: editar, cambiar el rol, restablecer la contraseña, desactivar,
 * reactivar y eliminar. Seis controles por fila hacen una tabla ilegible, y la fila es donde
 * menos espacio hay para explicar por qué uno de ellos no está.
 *
 * Así que la fila tiene un botón y la ventana tiene todo, con las tres acciones destructivas
 * separadas del formulario. Y cuando una acción no corresponde, en su lugar va **la razón** — que
 * es lo que la fila no podía dar.
 *
 * ── LO QUE NO SE OFRECE, Y NO ES UN OLVIDO ──────────────────────────────────
 *
 * Sobre **vos**: nada destructivo. `ADR-0502` — el servidor responde 409, y ofrecer un botón para
 * recibir ese 409 es un control que no funciona.
 *
 * Sobre el **administrador principal**: no se ofrece eliminarlo, desactivarlo, cambiarle el rol ni
 * cambiarle el correo. Los cuatro los rechaza un disparador de la base (`007_invariantes.sql`), y
 * eso es lo que los hace imposibles — esto solo ahorra el viaje. Su nombre y su contraseña SÍ se
 * pueden cambiar, porque lo inmutable es quién es y qué puede hacer, no cómo se escribe.
 *
 * ── ASIGNAR UN ROL REEMPLAZA, NO SUMA ───────────────────────────────────────
 *
 * `POST /api/admin/usuarios/{id}/roles` borra los roles que tenía y pone los que se manden. Por
 * eso esta pantalla muestra el actual y lo precarga: sin eso, editar el rol de alguien sería
 * destructivo a ciegas.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import Ventana from '../Ventana.jsx';

const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede administrar personas en esta empresa.',
  sobre_si_mismo: 'No podés hacer eso sobre tu propio usuario.',
  ultimo_administrador: 'Es la última persona que puede administrar esta empresa: no se puede desactivar.',
  email_duplicado: 'Ya existe alguien con ese correo.',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** El texto de un rechazo, con el detalle del servidor si lo trae. */
function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se cambió nada.';
  if (r.tipo === 'rechazado') return r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`;
  return `No se pudo: ${r.datos?.motivo ?? 'sin motivo'}`;
}

export default function Usuarios({ sesion }) {
  const [gente, setGente] = useState(null);
  const [roles, setRoles] = useState([]);
  /** Las empresas, para el selector del alta. Solo se piden si se puede elegir. */
  const [empresas, setEmpresas] = useState([]);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [aviso, setAviso] = useState(null);

  // ── El alta ──
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rolNuevo, setRolNuevo] = useState('');
  const [orgNueva, setOrgNueva] = useState('');
  const [creando, setCreando] = useState(false);

  // ── La edición ──
  const [editando, setEditando] = useState(null);
  const [edNombre, setEdNombre] = useState('');
  const [edEmail, setEdEmail] = useState('');
  const [edRol, setEdRol] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmaBorrado, setConfirmaBorrado] = useState(false);

  /** La contraseña temporal. **Se muestra una sola vez y no se guarda en ningún lado.** */
  const [temporal, setTemporal] = useState(null);

  const yaPedido = useRef(false);
  const orgId = sesion?.organizacion?.id;
  /* Lo responde el SERVIDOR, con la misma condición que comprueba la ruta antes de aceptar un
     `orgId` ajeno. Deducirlo acá —por ejemplo mirando si hay más de una empresa— daría un selector
     que ofrece destinos para los que la petición va a responder 404. */
  const puedeElegirEmpresa = Boolean(sesion?.puedeCambiarDeEmpresa);

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

  /* Las empresas, solo para quien puede elegir. Un administrador de un cliente no puede, así que
     pedirlas sería una petición que va a recibir 403 en cada carga de la pestaña. */
  const cargarEmpresas = useCallback(async () => {
    if (!puedeElegirEmpresa) return;
    const r = await pedir('/api/admin/organizaciones');
    if (r.tipo === 'datos') setEmpresas(r.datos.organizaciones ?? []);
  }, [puedeElegirEmpresa]);

  /* Se recarga cuando cambia la empresa administrada. Sin esto, conmutar dejaría en pantalla
     la gente de la empresa anterior con el encabezado de la nueva — la peor combinación. */
  useEffect(() => {
    yaPedido.current = false;
  }, [orgId]);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
    void cargarEmpresas();
  }, [cargar, cargarEmpresas, orgId]);

  const recargar = useCallback(async () => {
    yaPedido.current = false;
    await cargar();
  }, [cargar]);

  // ─── El alta ──────────────────────────────────────────────────────────────

  const crear = useCallback(async () => {
    setCreando(true);
    setAviso(null);
    setTemporal(null);

    /* UNA sola llamada, con la empresa y el rol adentro. Antes eran dos, y entre ellas la persona
       existía sin ninguna capacidad: si la segunda fallaba quedaba así, y el aviso lo decía con un
       texto que empezaba con «PERO NO». Ahora o queda con su rol o no queda. */
    const r = await pedir('/api/admin/usuarios', {
      metodo: 'POST',
      cuerpo: {
        nombre: nombre.trim(),
        email: email.trim(),
        ...(orgNueva ? { orgId: orgNueva } : {}),
        ...(rolNuevo ? { rol: rolNuevo } : {}),
      },
    });
    setCreando(false);

    if (r.tipo !== 'datos' || r.datos?.creado === false) {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }

    const donde = empresas.find((o) => o.id === orgNueva);
    setTemporal({ email: email.trim(), clave: r.datos.temporal });
    setAviso({
      mal: false,
      texto:
        `Se creó ${nombre.trim()}` +
        (donde ? ` en ${donde.nombre}` : '') +
        (rolNuevo ? ` con el rol «${rolNuevo}».` : ', sin rol todavía: no va a ver ninguna pantalla.'),
    });
    setNombre('');
    setEmail('');
    setRolNuevo('');
    await recargar();
  }, [nombre, email, orgNueva, rolNuevo, empresas, recargar]);

  // ─── La edición y las tres acciones ───────────────────────────────────────

  const abrirEdicion = (u) => {
    setAviso(null);
    setTemporal(null);
    setConfirmaBorrado(false);
    setEditando(u);
    setEdNombre(u.nombre ?? '');
    setEdEmail(u.email ?? '');
    setEdRol(u.roles?.[0] ?? '');
  };

  const cerrarEdicion = () => {
    setEditando(null);
    setTemporal(null);
    setConfirmaBorrado(false);
  };

  /** Guarda nombre, correo y rol. El rol va aparte porque es otra operación del servidor. */
  const guardar = useCallback(async () => {
    if (!editando) return;
    setOcupado(true);
    setAviso(null);

    const cambioDeDatos =
      edNombre.trim() !== (editando.nombre ?? '') || edEmail.trim() !== (editando.email ?? '');
    if (cambioDeDatos) {
      const r = await pedir(`/api/admin/usuarios/${editando.id}`, {
        metodo: 'PATCH',
        cuerpo: { nombre: edNombre.trim(), email: edEmail.trim() },
      });
      if (r.tipo !== 'datos' || r.datos?.editado === false) {
        setOcupado(false);
        setAviso({ mal: true, texto: porQue(r) });
        return;
      }
    }

    const cambioDeRol = edRol !== (editando.roles?.[0] ?? '');
    if (cambioDeRol) {
      const r = await pedir(`/api/admin/usuarios/${editando.id}/roles`, {
        metodo: 'POST',
        cuerpo: { roles: edRol ? [edRol] : [] },
      });
      if (r.tipo !== 'datos' || r.datos?.asignados === false) {
        setOcupado(false);
        /* Se dice qué SÍ se guardó. Sin esto, un fallo del rol después de guardar el nombre se
           leería como «no se guardó nada», y alguien volvería a escribir lo que ya está. */
        setAviso({
          mal: true,
          texto:
            (cambioDeDatos ? 'Se guardaron el nombre y el correo, pero el rol NO: ' : '') + porQue(r),
        });
        return;
      }
    }

    setOcupado(false);
    if (!cambioDeDatos && !cambioDeRol) {
      setAviso({ mal: false, texto: 'No había nada que cambiar.' });
      return;
    }
    setAviso({ mal: false, texto: `Se guardó ${edNombre.trim()}.` });
    cerrarEdicion();
    await recargar();
  }, [editando, edNombre, edEmail, edRol, recargar]);

  /** Una acción sobre la persona abierta: desactivar, activar o borrar. */
  const accion = useCallback(
    async (que) => {
      if (!editando) return;
      setOcupado(true);
      setAviso(null);

      const donde = {
        desactivar: [`/api/admin/usuarios/${editando.id}/desactivar`, 'POST'],
        activar: [`/api/admin/usuarios/${editando.id}/activar`, 'POST'],
        borrar: [`/api/admin/usuarios/${editando.id}`, 'DELETE'],
      }[que];

      const r = await pedir(donde[0], {
        metodo: donde[1],
        ...(donde[1] === 'POST' ? { cuerpo: {} } : {}),
      });
      setOcupado(false);

      if (r.tipo !== 'datos') {
        /* El aviso se queda EN LA VENTANA: los rechazos de estas tres explican por qué no se pudo
           —«tiene contactos a su nombre», «es la última persona que puede administrar»— y cerrar
           la ventana los mandaría a un costado de la pantalla que quizá nadie mira. */
        setAviso({ mal: true, texto: porQue(r) });
        return;
      }

      const dicho = {
        desactivar: `${editando.nombre} ya no puede entrar. Se puede reactivar cuando quieras.`,
        activar: `${editando.nombre} puede entrar de nuevo con su contraseña.`,
        borrar: `Se eliminó ${editando.nombre}.`,
      }[que];
      setAviso({ mal: false, texto: dicho });
      cerrarEdicion();
      await recargar();
    },
    [editando, recargar],
  );

  /** Restablecer la contraseña. Devuelve una temporal, y se muestra UNA vez. */
  const restablecer = useCallback(async () => {
    if (!editando) return;
    setOcupado(true);
    setAviso(null);
    const r = await pedir(`/api/admin/usuarios/${editando.id}/restablecer-password`, {
      metodo: 'POST',
      cuerpo: {},
    });
    setOcupado(false);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }
    setTemporal({ email: editando.email, clave: r.datos.temporal });
    setAviso({
      mal: false,
      texto: `Se cerraron ${r.datos.sesionesCerradas ?? 0} sesión(es) de ${editando.nombre}.`,
    });
  }, [editando]);

  // ─── Pantalla ─────────────────────────────────────────────────────────────

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
  /* El rol de plataforma no se ofrece nunca en ningún selector: la bandera viene del servidor, y
     el disparador `rol_de_plataforma_acotado` lo rechazaría fuera de la organización principal. */
  const asignables = roles.filter((r) => !r.soloPrincipal);

  const elAviso = aviso ? (
    <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
      <i>{aviso.mal ? '⚠' : '✓'}</i>
      <span>{aviso.texto}</span>
    </div>
  ) : null;

  /** El panel de la contraseña temporal. Igual en el alta y en el restablecimiento. */
  const laTemporal = temporal ? (
    <>
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
        <b>Se muestra una sola vez.</b> Copiala ahora: no se puede volver a ver, solo restablecer.
        La persona tendrá que cambiarla al entrar.
      </div>
    </>
  ) : null;

  const soyYo = editando?.id === sesion?.usuarioId;
  const esFundador = Boolean(editando?.es_admin_principal);

  return (
    <>
      {/* EN QUÉ EMPRESA. Arriba de todo y sin ambigüedad: el defecto que evita es administrar la
          gente de un cliente creyendo estar en otro. */}
      <div className={`fd-aviso ${sesion?.mirandoOtraOrganizacion ? 'falta' : ''}`}>
        <i>◍</i>
        <span>
          Estás viendo las personas de <b>{sesion?.organizacion?.nombre ?? '—'}</b>
          {sesion?.mirandoOtraOrganizacion
            ? ' — que NO es tu organización. Editar, desactivar y eliminar actúan sobre ella.'
            : '.'}
        </span>
      </div>

      {altaAbierta || editando ? null : elAviso}

      <div className="card">
        <div className="card-head">
          Personas <span className="hint">{gente.length}</span>
          <button
            type="button"
            className="fd-btn aj-alta"
            onClick={() => {
              setAviso(null);
              setTemporal(null);
              /* Por omisión, la empresa que se está viendo. Así el caso normal —crear acá— no
                 pide elegir nada, y elegir otra es una decisión explícita. */
              setOrgNueva(orgId ?? '');
              setAltaAbierta(true);
            }}
          >
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
                {u.roles?.length ? (
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
                <button type="button" className="fd-btn sec" onClick={() => abrirEdicion(u)}>
                  {u.id === sesion?.usuarioId ? 'Tus datos' : 'Administrar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── El alta ── */}
      {altaAbierta ? (
        <Ventana
          titulo={temporal ? 'Copiá la contraseña temporal' : 'Agregar una persona'}
          subtitulo={
            temporal
              ? 'Es la única vez que se puede ver. Después solo se puede restablecer.'
              : 'Nace con una contraseña temporal que tendrá que cambiar al entrar.'
          }
          /* La temporal en pantalla saca el cierre accidental: el servidor no la guarda en claro y
             un Escape de reflejo la borraría para siempre. */
          cerrablePorFuera={!temporal}
          alCerrar={() => {
            setAltaAbierta(false);
            setTemporal(null);
          }}
        >
          {temporal ? (
            <>
              {laTemporal}
              {elAviso}
              <div className="aj-fila">
                <button
                  type="button"
                  className="fd-btn"
                  onClick={() => {
                    setAltaAbierta(false);
                    setTemporal(null);
                  }}
                >
                  Listo, ya la copié
                </button>
              </div>
            </>
          ) : (
            <>
              {/* EL SELECTOR DE EMPRESA. Solo para quien puede elegir — la misma condición que el
                  servidor comprueba antes de aceptar un `orgId` ajeno, y la misma que gobierna el
                  conmutador. Se pregunta a la sesión, no se deduce. */}
              {puedeElegirEmpresa ? (
                <div className="fd-campo">
                  <label htmlFor="us-empresa">Empresa</label>
                  <select
                    id="us-empresa"
                    value={orgNueva}
                    onChange={(e) => setOrgNueva(e.target.value)}
                  >
                    {empresas.length === 0 ? (
                      <option value={orgId ?? ''}>{sesion?.organizacion?.nombre ?? '—'}</option>
                    ) : null}
                    {empresas.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                        {o.id === orgId ? ' (donde estás)' : ''}
                        {!o.activa ? ' · desactivada' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="aj-ayuda">
                    No hace falta conmutarse: la persona se crea en la empresa que elijas acá.
                  </div>
                </div>
              ) : (
                <div className="aj-ayuda">
                  Se va a crear en <b>{sesion?.organizacion?.nombre ?? 'esta empresa'}</b>.
                </div>
              )}

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
                <button
                  type="button"
                  className="fd-btn sec"
                  disabled={creando}
                  onClick={() => setAltaAbierta(false)}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </Ventana>
      ) : null}

      {/* ── La edición ── */}
      {editando ? (
        <Ventana
          titulo={temporal ? 'Copiá la contraseña temporal' : editando.nombre}
          subtitulo={
            temporal
              ? 'Es la única vez que se puede ver. Después solo se puede restablecer.'
              : soyYo
                ? 'Es tu propio usuario.'
                : `En ${sesion?.organizacion?.nombre ?? 'esta empresa'}.`
          }
          cerrablePorFuera={!temporal}
          alCerrar={cerrarEdicion}
        >
          {temporal ? (
            <>
              {laTemporal}
              {elAviso}
              <div className="aj-fila">
                <button type="button" className="fd-btn" onClick={cerrarEdicion}>
                  Listo, ya la copié
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="fd-rejilla dos">
                <div className="fd-campo">
                  <label htmlFor="ed-nombre">Nombre</label>
                  <input id="ed-nombre" type="text" value={edNombre}
                    onChange={(e) => setEdNombre(e.target.value)} />
                </div>
                <div className="fd-campo">
                  <label htmlFor="ed-email">Correo</label>
                  <input id="ed-email" type="email" value={edEmail} autoComplete="off"
                    disabled={esFundador}
                    onChange={(e) => setEdEmail(e.target.value)} />
                </div>
              </div>
              {esFundador ? (
                <div className="aj-ayuda">
                  El correo del administrador principal es <b>inmutable</b>: es su identidad, y con
                  ella se entra a la plataforma. Su nombre y su contraseña sí se pueden cambiar.
                </div>
              ) : null}

              <div className="fd-campo">
                <label htmlFor="ed-rol">Rol</label>
                <select
                  id="ed-rol"
                  value={edRol}
                  disabled={soyYo || esFundador || asignables.length === 0}
                  onChange={(e) => setEdRol(e.target.value)}
                >
                  <option value="">Sin rol</option>
                  {asignables.map((r) => (
                    <option key={r.clave} value={r.clave}>
                      {r.nombre}
                    </option>
                  ))}
                  {/* El rol actual, aunque no sea asignable. Sin esto, la ficha del fundador
                      mostraría «Sin rol» sobre alguien que tiene el de plataforma. */}
                  {edRol && !asignables.some((r) => r.clave === edRol) ? (
                    <option value={edRol}>{edRol}</option>
                  ) : null}
                </select>
                {soyYo ? (
                  <div className="aj-ayuda">
                    Nadie cambia su propio rol. Quitarse el permiso es quedarse afuera con la misma
                    eficacia que borrarse.
                  </div>
                ) : esFundador ? (
                  <div className="aj-ayuda">
                    El rol del administrador principal no se puede cambiar: es lo que sostiene el
                    acceso a la plataforma.
                  </div>
                ) : null}
              </div>

              {elAviso}

              <div className="aj-fila">
                <button type="button" className="fd-btn" disabled={ocupado} onClick={() => void guardar()}>
                  {ocupado ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" className="fd-btn sec" disabled={ocupado} onClick={cerrarEdicion}>
                  Cancelar
                </button>
              </div>

              {/* ── Las acciones, separadas del formulario ── */}
              <div className="aj-sep" />

              {soyYo ? (
                <div className="aj-ayuda">
                  Sobre tu propio usuario no hay acciones: nadie se desactiva, se degrada ni se
                  elimina a sí mismo. Tu contraseña se cambia desde el menú de tu cuenta, que pide
                  la actual.
                </div>
              ) : (
                <>
                  <div className="aj-fila">
                    <button type="button" className="fd-btn sec" disabled={ocupado} onClick={() => void restablecer()}>
                      Restablecer contraseña
                    </button>
                    {editando.activo ? (
                      <button
                        type="button"
                        className="fd-btn sec"
                        disabled={ocupado || esFundador}
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
                  </div>

                  {esFundador ? (
                    <div className="aj-ayuda">
                      Al administrador principal no se lo puede desactivar ni eliminar. Lo impide la
                      base de datos, no esta pantalla: es el único usuario que garantiza que la
                      plataforma siempre tenga quién la administre.
                    </div>
                  ) : confirmaBorrado ? (
                    <div className="fd-aviso falta">
                      <i>⚠</i>
                      <span>
                        <b>Eliminar no se puede deshacer.</b> Si esta persona ya trabajó —notas,
                        resultados, tareas o contactos a su nombre— la base va a rechazarlo, y ahí
                        lo que corresponde es desactivarla.
                        <br />
                        <button
                          type="button"
                          className="fd-btn"
                          disabled={ocupado}
                          style={{ marginTop: 8, marginRight: 7 }}
                          onClick={() => void accion('borrar')}
                        >
                          {ocupado ? 'Eliminando…' : `Sí, eliminar a ${editando.nombre}`}
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
                  ) : (
                    <div className="aj-fila">
                      <button
                        type="button"
                        className="fd-btn sec"
                        disabled={ocupado}
                        style={{ color: 'var(--crit)' }}
                        onClick={() => setConfirmaBorrado(true)}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Ventana>
      ) : null}
    </>
  );
}
