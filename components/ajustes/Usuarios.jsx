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
/**
 * Las casillas de pestañas. **Un componente, dos usos: el alta y la edición.**
 *
 * Copiarlo era el camino corto y estaba mal por dos motivos medidos. El primero: es la única parte
 * de esta pantalla que recorre el catálogo de secciones, y una segunda copia es una segunda
 * oportunidad de que alguien escriba un nombre a mano — que es exactamente lo que
 * `pruebas/codigo/101-alcance.test.ts` prohíbe, y lo prohíbe porque ya pasó (`leads` contra
 * `contacts`, con dos pruebas en verde). El segundo: el `aria-label` de acá abajo se agregó después
 * de medir que el árbol de accesibilidad leía «on» en vez del nombre de la pestaña; con dos copias,
 * ese arreglo vive en una sola.
 *
 * `grupos` es el ALCANCE OFRECIBLE del rol, ya agrupado por el servidor. Lo que se ofrece es el
 * techo del rol: `usuario` no alcanza Ajustes, así que esa casilla no aparece. Ofrecerla sería un
 * control que se ve y no puede cumplir.
 *
 * ── Y EL SEGUNDO TECHO, QUE NO ES DEL ROL SINO DE LA EMPRESA ───────────────
 *
 * `desdeLaPrincipal` dice si la persona a la que se le concede el alcance vive en la organización
 * principal. Las secciones con `soloDesdeLaPrincipal` —hoy solo el Panel de Monitoreo— no existen
 * para nadie más, así que ofrecer su casilla es exactamente el mismo defecto que ofrecer Ajustes a
 * quien no alcanza Ajustes — se tilda, se guarda, y no aparece ninguna pestaña.
 *
 * Antes no podía pasar y ahora sí: hasta el retiro del rol `monitoreo`, ningún rol que restringiera
 * por sección tenía esa capacidad, así que la casilla no llegaba nunca a esta lista.
 *
 * Va sin valor por defecto A PROPÓSITO. Un llamador que se lo olvide manda `undefined`, que es
 * falso, y la casilla no se ofrece: falla del lado de mostrar de menos. Con `= true` por defecto,
 * olvidarse la ofrecería a todo el mundo y nada fallaría.
 */
function CasillasDeSecciones({ id, grupos, elegidas, alCambiar, desdeLaPrincipal }) {
  return (
    <div className="aj-casillas" id={id}>
      {ofrecibles(grupos, desdeLaPrincipal).map((g) => (
        <div className="aj-grupo" key={g.grupo.clave}>
          {g.grupo.etiqueta ? <span className="aj-grupo-t">{g.grupo.etiqueta}</span> : null}
          {g.secciones.map((sec) => (
            <label className="aj-casilla" key={sec.clave}>
              <input
                type="checkbox"
                /* El `<label>` envuelve la casilla, y aun así el árbol de accesibilidad la leía
                   como «on»: el nombre no se computaba. Con `aria-label` cada casilla dice qué
                   pestaña es. */
                aria-label={sec.nombre}
                checked={elegidas.has(sec.clave)}
                onChange={(e) => alCambiar(sec.clave, e.target.checked)}
              />
              <span>{sec.nombre}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Las casillas que de verdad se pueden ofrecer, ya sin los grupos que quedaron vacíos.
 *
 * Los grupos vacíos se descartan por lo mismo que `menuVisible` los descarta: un título de grupo
 * con nada debajo le dice a quien mira que ahí hay algo que no puede ver.
 *
 * Es una función suelta y no un `filter` en el JSX porque la usan dos cosas —el dibujo y el efecto
 * que poda la selección— y las dos tienen que estar de acuerdo. Con dos copias, una casilla podría
 * dejar de dibujarse y seguir viajando en el cuerpo de la petición.
 */
function ofrecibles(grupos, desdeLaPrincipal) {
  return (grupos ?? [])
    .map((g) => ({
      ...g,
      secciones: g.secciones.filter((s) => desdeLaPrincipal || !s.soloDesdeLaPrincipal),
    }))
    .filter((g) => g.secciones.length > 0);
}

/** Agregar o quitar una clave de un `Set`, sin tocar el original. */
function conmutar(antes, clave, puesta) {
  const ahora = new Set(antes);
  if (puesta) ahora.add(clave);
  else ahora.delete(clave);
  return ahora;
}

function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se cambió nada.';
  if (r.tipo === 'rechazado') return r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`;
  return `No se pudo: ${r.datos?.motivo ?? 'sin motivo'}`;
}

export default function Usuarios({ sesion }) {
  const [gente, setGente] = useState(null);
  /** `true` = la lista trae gente de TODAS las empresas. Lo dice el servidor, no se deduce acá. */
  const [cruzaEmpresas, setCruzaEmpresas] = useState(false);
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
  /* Las pestañas elegidas para la persona nueva. Un `Set` y no un arreglo: la pregunta es
     «¿está?», y con un arreglo habría que cuidarse de los duplicados en cada clic. */
  const [seccionesNuevas, setSeccionesNuevas] = useState(() => new Set());
  const [orgNueva, setOrgNueva] = useState('');
  const [creando, setCreando] = useState(false);

  // ── La edición ──
  const [editando, setEditando] = useState(null);
  const [edNombre, setEdNombre] = useState('');
  const [edEmail, setEdEmail] = useState('');
  const [edRol, setEdRol] = useState('');
  /* Las pestañas de quien se está editando. Arrancan con las que YA tiene: el `POST` reemplaza el
     conjunto, así que abrir el panel con las casillas vacías y guardar sería quitárselas todas. */
  const [edSecciones, setEdSecciones] = useState(() => new Set());
  /* El rol elegido en la edición, con sus datos del catálogo. Se declara ACÁ ARRIBA y no junto al
     resto de los derivados, y no es estilo: `guardar` lo nombra en su lista de dependencias, y esa
     lista se evalúa al renderizar. Declarado más abajo, la pantalla queda EN BLANCO con «Cannot
     access before initialization» — que ya pasó una vez con `elRol`, y no es un error de
     compilación, así que solo se ve abriendo la pantalla. */
  const elRolEditado = roles.find((r) => r.clave === edRol) ?? null;
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
    setCruzaEmpresas(Boolean(u.datos.todasLasEmpresas));
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

  /* ── IR A LA EMPRESA DE ESA PERSONA ─────────────────────────────────────────
   *
   * Ver a todo el mundo destapó algo que hasta ahora no se podía ver: **todas** las operaciones
   * sobre una persona están acotadas a la empresa activa —`usuarioObjetivo` es, con nombre y
   * apellido, *"el único `where('org_id', …)` del dominio de identidad"*—. Así que un botón
   * «Administrar» sobre alguien de otra empresa devolvería 404 (`ADR-0501`: 404 y nunca 403).
   *
   * Un control que se ve y no puede cumplir es el `07` § 4, y la salida NO es esconder a esa
   * persona —eso nos devolvería al defecto que vinimos a arreglar— sino ofrecer lo único que sí
   * funciona: **ir a su empresa**. Es la misma decisión que ya se había tomado para editar y
   * borrar, escrita como un botón en vez de como algo que hay que saber.
   *
   * Y NO se ensancha la escritura. Esa frontera es la que sostiene todo el aislamiento del
   * sistema, y abrirla porque el listado creció sería pagar con lo caro algo que se resuelve con
   * un clic.
   */
  const irALaEmpresaDe = useCallback(async (u) => {
    setAviso(null);
    const r = await pedir('/api/auth/sesion', { metodo: 'PATCH', cuerpo: { orgId: u.organizacion.id } });
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: `No se pudo cambiar a ${u.organizacion.nombre}.` });
      return;
    }
    /* La sesión entera cambió, así que se recarga la página. Un re-render dejaría media pantalla
       con la empresa vieja y media con la nueva, que es peor que esperar. */
    window.location.reload();
  }, []);

  const recargar = useCallback(async () => {
    yaPedido.current = false;
    await cargar();
  }, [cargar]);

  // ─── El alta ──────────────────────────────────────────────────────────────

  /* El rol elegido, con sus datos del catálogo. De acá sale si hay que pedir pestañas y cuáles se
     pueden ofrecer — se PREGUNTA al servidor, no se deduce del nombre del rol (`ADR-0302`).

     Va ANTES de `crear` porque esa función la usa en su cuerpo y en sus dependencias. Declarada
     después, el componente lanza `Cannot access 'elRol' before initialization` al renderizar — y el
     síntoma es una pantalla en blanco, no un error de compilación. */
  const elRol = roles.find((r) => r.clave === rolNuevo) ?? null;

  /* ── ¿LA EMPRESA DESTINO ES LA PRINCIPAL? ────────────────────────────────
   *
   * Se calcula con la MISMA fórmula que el servidor usa para `orgDestino`: la elegida si hay una,
   * y la de la sesión si no (`app/api/admin/usuarios/route.ts`). Dos fórmulas distintas harían que
   * la pantalla ofrezca una casilla que la petición rechaza, o al revés.
   *
   * Sale de datos que el servidor manda —`esPrincipal` de cada empresa y de la organización de la
   * sesión— y no de comparar el nombre con `'ARIA'`, que es lo que `Contexto.organizacion` advierte:
   * *el día que alguien renombre la organización, la pantalla cambia de comportamiento sin que
   * nadie toque una línea*. */
  const destinoEsPrincipal = orgNueva
    ? Boolean(empresas.find((o) => o.id === orgNueva)?.esPrincipal)
    : Boolean(sesion?.organizacion?.esPrincipal);

  /* ── Y LA SELECCIÓN SE PODA CUANDO LA CASILLA DEJA DE OFRECERSE ──────────
   *
   * Sin esto queda un estado que no se puede ver: tildar «Panel de Monitoreo» con ARIA elegida y
   * después cambiar a una empresa cliente esconde la casilla **y deja la clave en el conjunto**.
   * Se manda una pestaña que la pantalla ya no muestra, y si era la única el servidor responde
   * `alcance_vacio` señalando algo que nadie ve tildado.
   *
   * Solo hace falta en el alta: es el único formulario donde la empresa se elige. En la edición la
   * persona ya pertenece a una y no se la mueve.
   *
   * El `setState` va dentro del `if`, y no es cosmético: llamarlo con un `Set` nuevo en cada
   * render dispara el efecto otra vez y el ciclo no termina. */
  useEffect(() => {
    if (!elRol?.restringePorSeccion) return;
    const vigentes = new Set(
      ofrecibles(elRol.alcance, destinoEsPrincipal).flatMap((g) => g.secciones.map((x) => x.clave)),
    );
    setSeccionesNuevas((antes) => {
      const podadas = [...antes].filter((c) => vigentes.has(c));
      return podadas.length === antes.size ? antes : new Set(podadas);
    });
  }, [elRol, destinoEsPrincipal]);

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
        /* Las pestañas viajan SOLO si el rol se restringe, y el servidor no las guarda si no.
           Mandarlas siempre dejaría filas para roles que las ignoran — filas que resucitarían el
           día que ese rol pase a restringir. */
        ...(elRol?.restringePorSeccion ? { secciones: [...seccionesNuevas] } : {}),
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
        ` con el rol «${rolNuevo}».`,
    });
    setNombre('');
    setEmail('');
    setRolNuevo('');
    /* Y las pestañas. Sin este reset, el alta siguiente hereda las casillas de la anterior **sin
       ningún error** — y `orgNueva`, que ya estaba así, se agrega acá por lo mismo. */
    setSeccionesNuevas(new Set());
    setOrgNueva('');
    await recargar();
  }, [nombre, email, orgNueva, rolNuevo, seccionesNuevas, elRol, empresas, recargar]);

  // ─── La edición y las tres acciones ───────────────────────────────────────

  const abrirEdicion = (u) => {
    setAviso(null);
    setTemporal(null);
    setConfirmaBorrado(false);
    setEditando(u);
    setEdNombre(u.nombre ?? '');
    setEdEmail(u.email ?? '');
    setEdRol(u.roles?.[0] ?? '');
    setEdSecciones(new Set(u.secciones ?? []));
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
    /* Una operación, no dos: el servidor reemplaza roles Y alcance en la misma transacción. Se
       manda también cuando SOLO cambiaron las pestañas, porque no hay otro camino para escribirlas
       — y con el conjunto completo, que es lo que esa ruta espera. */
    const antes = new Set(editando.secciones ?? []);
    const cambioDeSecciones =
      antes.size !== edSecciones.size || [...edSecciones].some((s) => !antes.has(s));
    if (cambioDeRol || cambioDeSecciones) {
      const r = await pedir(`/api/admin/usuarios/${editando.id}/roles`, {
        metodo: 'POST',
        cuerpo: {
          roles: edRol ? [edRol] : [],
          /* Solo si el rol destino restringe, igual que en el alta. Con un rol sin restricción el
             servidor borra el alcance de todas formas; mandarlo sería decirle algo que va a
             ignorar, y la próxima persona que lea esto tendría que averiguar cuál manda. */
          ...(elRolEditado?.restringePorSeccion ? { secciones: [...edSecciones] } : {}),
        },
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
    if (!cambioDeDatos && !cambioDeRol && !cambioDeSecciones) {
      setAviso({ mal: false, texto: 'No había nada que cambiar.' });
      return;
    }
    setAviso({ mal: false, texto: `Se guardó ${edNombre.trim()}.` });
    cerrarEdicion();
    await recargar();
  }, [editando, edNombre, edEmail, edRol, edSecciones, elRolEditado, recargar]);

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

  /* El rol es obligatorio: ver el selector del alta. Sin esto, el botón quedaría habilitado con
     el selector en su opción vacía y se crearía justo la persona que no queremos crear. */
  const puedeCrear =
    nombre.trim().length > 0 &&
    EMAIL.test(email.trim()) &&
    rolNuevo !== '' &&
    /* Y al menos una pestaña cuando el rol las exige. Es el mismo argumento por el que se quitó la
       opción «sin rol todavía», escrito abajo en el selector: *el camino más corto del formulario
       creaba una persona que puede entrar y no ve ninguna pantalla*. */
    (!elRol?.restringePorSeccion || seccionesNuevas.size > 0) &&
    !creando;
  /* ── QUÉ ROLES SE OFRECEN, Y POR QUÉ EL DE PLATAFORMA AHORA SÍ ──────────────
   *
   * Antes esta línea filtraba `soloPrincipal` **siempre**, así que no había forma de crear otro
   * superadministrador desde la aplicación: el selector no lo mostraba, y el único que existía era
   * el que había sembrado el arranque. Una sola persona con la llave no es una regla de seguridad,
   * es un punto único de falla — si pierde el acceso, no queda nadie que pueda devolvérselo.
   *
   * Se ofrece a quien puede otorgarlo, y el criterio del servidor está en
   * `app/api/admin/usuarios/[id]/roles/route.ts`: **no se puede otorgar el alcance que uno no
   * tiene** — o sea, hace falta `organizaciones.listar`.
   *
   * Acá se pregunta por `puedeElegirEmpresa`, que el servidor calcula como *tener esa capacidad Y
   * un rol de plataforma*. Es **más estricto** que lo que el servidor exige, y esa asimetría es la
   * correcta: la pantalla nunca ofrece un control que vaya a ser rechazado. Al revés —ofrecer de
   * más y que el servidor conteste 403— es el `07` § 4, *"mostrar un control que no puede
   * cumplir"*.
   *
   * Y no es una comparación de nombre de rol, que es lo que `ADR-0302` prohíbe.
   *
   * Y sigue habiendo una restricción que NO se toca, porque vive en la base: el disparador
   * `rol_de_plataforma_acotado` exige que la persona pertenezca a la empresa principal. El
   * formulario la respeta en vez de dejar que la base rechace con un mensaje que nadie entiende.
   */
  const asignables = roles.filter((r) => !r.soloPrincipal || puedeElegirEmpresa);
  /**
   * El rol de plataforma, tal como lo trae el catálogo. Se guarda la fila entera y no solo su
   * clave porque **su nombre también sale de acá**: escribirlo a mano en la pantalla sería
   * hardcodear el nombre de un rol, que es lo que `ADR-0302` persigue, y además haría que renombrar
   * el rol en el catálogo dejara la ayuda diciendo otra cosa.
   */
  const rolDePlataforma = roles.find((r) => r.soloPrincipal) ?? null;
  /** `true` = se está por crear a alguien con el rol de plataforma. */
  const creandoPlataforma = Boolean(rolDePlataforma) && rolNuevo === rolDePlataforma.clave;
  const laPrincipal = empresas.find((o) => o.esPrincipal) ?? null;

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
          {cruzaEmpresas ? (
            <>
              Estás viendo <b>todas</b> las personas de la plataforma. Administrar actúa sobre{' '}
              <b>{sesion?.organizacion?.nombre ?? '—'}</b>: para las de otra empresa, el botón te
              lleva ahí.
            </>
          ) : (
            <>
              Estás viendo las personas de <b>{sesion?.organizacion?.nombre ?? '—'}</b>
              {sesion?.mirandoOtraOrganizacion
                ? ' — que NO es tu organización. Editar, desactivar y eliminar actúan sobre ella.'
                : '.'}
            </>
          )}
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
                <div className="rs">
                  {u.email ?? 'sin correo'}
                  {/* DE QUÉ EMPRESA ES, cuando la lista cruza empresas.
                      Sin esto, dos personas con el mismo nombre en empresas distintas son dos
                      renglones idénticos, y administrar al que no era no da ningún error. La
                      condición la manda el servidor: ver `todasLasEmpresas` en la respuesta. */}
                  {cruzaEmpresas && u.organizacion ? (
                    <span className={`tagx ${u.organizacion.esPrincipal ? 'ag' : 'nu'}`} style={{ marginLeft: 8 }}>
                      {u.organizacion.nombre}
                    </span>
                  ) : null}
                </div>
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
                {u.organizacion && u.organizacion.id !== orgId ? (
                  /* De otra empresa: administrar acá daría 404. Se ofrece lo que sí funciona. */
                  <button type="button" className="fd-btn sec" onClick={() => void irALaEmpresaDe(u)}>
                    Ir a {u.organizacion.nombre}
                  </button>
                ) : (
                  <button type="button" className="fd-btn sec" onClick={() => abrirEdicion(u)}>
                    {u.id === sesion?.usuarioId ? 'Tus datos' : 'Administrar'}
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
                    disabled={creandoPlataforma}
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
                    {creandoPlataforma
                      ? `Un ${rolDePlataforma?.nombre ?? 'rol de plataforma'} ve todas las empresas, así que vive en la principal. Por eso este campo queda fijo.`
                      : 'No hace falta conmutarse: la persona se crea en la empresa que elijas acá.'}
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
                  /* NO HAY OPCIÓN «SIN ROL». Estaba, y era la que venía elegida por omisión: el
                     camino más corto del formulario creaba una persona que puede entrar y no ve
                     ninguna pantalla. Nadie da de alta a alguien para que no vea nada, así que era
                     un valor por omisión que solo servía para equivocarse.
                     Quitar el rol sigue siendo posible, pero ahora es un acto deliberado y se hace
                     desde la edición, que es donde tiene sentido. */
                  <select
                    id="us-rol"
                    value={rolNuevo}
                    onChange={(e) => {
                      const elegido = e.target.value;
                      setRolNuevo(elegido);
                      /* UN SUPERADMINISTRADOR NACE EN LA EMPRESA PRINCIPAL, y no es una regla de
                         esta pantalla: la impone el disparador `rol_de_plataforma_acotado` de la
                         base. Sin esto, elegir el rol y dejar otra empresa daba un rechazo de la
                         base con un texto que nadie escribió para que lo lea una persona.
                         Se corrige acá, en el momento de elegir, en vez de avisar después. */
                      if (elegido && elegido === rolDePlataforma?.clave && laPrincipal) {
                        setOrgNueva(laPrincipal.id);
                      }
                    }}
                  >
                    <option value="" disabled>
                      Elegí un rol
                    </option>
                    {asignables.map((r) => (
                      <option key={r.clave} value={r.clave}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {/* ── LAS PESTAÑAS DE ESTA PERSONA ──────────────────────────────────
                  Solo para los roles que se restringen por sección, y eso lo dice el servidor. Las
                  casillas salen del catálogo YA AGRUPADO: ni un nombre de sección se escribe acá, por
                  lo mismo que el menú tampoco los tiene.

                  Y lo que se ofrece es el TECHO del rol: `usuario` no alcanza Ajustes, así que esa
                  casilla no aparece. Ofrecerla sería un control que se ve y no puede cumplir. */}
              {elRol?.restringePorSeccion ? (
                <div className="fd-campo">
                  <label htmlFor="alta-secciones">Pestañas que va a ver</label>
                  <CasillasDeSecciones
                    id="alta-secciones"
                    grupos={elRol.alcance}
                    desdeLaPrincipal={destinoEsPrincipal}
                    elegidas={seccionesNuevas}
                    alCambiar={(clave, puesta) =>
                      setSeccionesNuevas((antes) => conmutar(antes, clave, puesta))
                    }
                  />
                  {/* Se dice qué elige Y QUÉ NO, y la segunda mitad importa más: la restricción es de
                      PESTAÑAS. Las operaciones sobre un contacto —abrir su ficha, escribirle— piden
                      capacidades que este rol tiene y no pertenecen a ninguna pantalla, así que no
                      quedan restringidas. Prometer lo contrario sería la frontera cosmética que este
                      repositorio ya pagó dos veces. */}
                  <div className="aj-ayuda" style={{ margin: '4px 0 0' }}>
                    Elegí al menos una. Esto decide <b>qué pestañas aparecen</b> en su menú, y el
                    servidor rechaza lo que quede afuera. No limita a qué contactos accede: para eso
                    está el territorio.
                  </div>
                </div>
              ) : null}

              {/* Los NOMBRES salen del catálogo y la diferencia se describe en palabras. Escribir
                  «Closer ve la pestaña Closer» era cierto con cuatro roles y quedó falso al pasar
                  a tres, y una ayuda que miente es peor que ninguna: se lee con confianza. */}
              <div className="aj-ayuda">
                Un <b>Usuario</b> trabaja en las dos pestañas de operación y ve los tableros de su
                empresa. Un <b>Administrador</b> puede además cargar y rotar las credenciales de su
                empresa — es la única diferencia entre los dos.
                {creandoPlataforma ? (
                  <>
                    {' '}
                    Un <b>{rolDePlataforma.nombre}</b> ve <b>todas</b> las empresas y administra
                    empresas y personas, y por eso vive en la empresa principal.
                  </>
                ) : null}
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

              {/* ── LAS PESTAÑAS DE ESTA PERSONA, AL EDITAR ───────────────────────
                  Sin esto, el alcance se elegía una vez en el alta y NO se podía tocar nunca más:
                  un tilde de más había que arreglarlo borrando a la persona y volviéndola a crear.

                  Y había algo peor que una comodidad faltante: `POST .../roles` reemplaza roles y
                  alcance juntos y **rechaza** con `sin_secciones` cuando el rol destino restringe y
                  el cuerpo no trae ninguna. O sea que pasar a alguien al rol `usuario` desde este
                  panel devolvía 400 y no había ningún camino en la interfaz para hacerlo. */}
              {elRolEditado?.restringePorSeccion && !soyYo && !esFundador ? (
                <div className="fd-campo">
                  <label htmlFor="ed-secciones">Pestañas que va a ver</label>
                  <CasillasDeSecciones
                    id="ed-secciones"
                    grupos={elRolEditado.alcance}
                    /* La empresa de QUIEN SE EDITA, que el listado ya trae. No la de la sesión:
                       coinciden hoy —`usuarioObjetivo(` filtra por la organización efectiva— y
                       usar la del que mira sería cierto por casualidad. */
                    desdeLaPrincipal={Boolean(editando?.organizacion?.esPrincipal)}
                    elegidas={edSecciones}
                    alCambiar={(clave, puesta) =>
                      setEdSecciones((previas) => conmutar(previas, clave, puesta))
                    }
                  />
                  <div className="aj-ayuda" style={{ margin: '4px 0 0' }}>
                    Al menos una. Se guarda el conjunto <b>completo</b>: lo que destildes se le
                    quita.
                  </div>
                </div>
              ) : null}

              {elAviso}

              <div className="aj-fila">
                {/* Deshabilitado también cuando el rol elegido restringe y no quedó ninguna
                    pestaña: es el mismo freno que el alta, y evita mandar un cuerpo que el
                    servidor ya sabe que va a rechazar. */}
                <button
                  type="button"
                  className="fd-btn"
                  disabled={ocupado || (elRolEditado?.restringePorSeccion && edSecciones.size === 0)}
                  onClick={() => void guardar()}
                >
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
