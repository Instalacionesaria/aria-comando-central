'use client';

// La pantalla de entrada. Las cinco fases del ingreso, en una sola página.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UNA PÁGINA Y NO CINCO
//
// El backend tiene cuatro estados de sesión (`lib/autorizacion/estados.ts`) y cada uno
// habilita exactamente las rutas que sacan de él:
//
//   pendiente_2fo         → POST /api/auth/2fo/verificar
//   debe_cambiar_password → POST /api/auth/sesion
//   debe_configurar_2fo   → POST /api/auth/2fo/configurar, /confirmar
//   activa                → todo
//
// La tentación es una URL por estado. No se hace, por dos razones concretas:
//
//   1. **El estado lo decide el servidor, no la navegación.** Con cinco URLs hay que
//      mantener sincronizada la URL con el estado real, y cuando se desincronizan alguien
//      queda en una pantalla que su estado no habilita: cada llamada le responde 403 con un
//      código que la pantalla no espera. Preguntando el estado al servidor en cada paso, la
//      pantalla es una función del estado y no puede divergir.
//   2. **Recargar en medio del flujo.** Con una sola página, un F5 durante el alta del
//      segundo factor vuelve a preguntar `GET /api/auth/sesion` y retoma donde estaba.
//
// Y un usuario puede pasar por DOS estados restringidos seguidos —contraseña temporal y
// después segundo factor—, así que nunca se calcula el próximo estado acá: se lee el que el
// servidor devuelve, y cuando la respuesta no lo trae se vuelve a preguntar.
//
// ── LO QUE ESTA PANTALLA NO ES ────────────────────────────────────────────────
//
// No es seguridad. No decide nada: muestra lo que el servidor dice y llama a las rutas que el
// servidor habilita. Si alguien fuerza `fase` desde la consola del navegador, las llamadas
// siguen recibiendo 403 del portero, porque el estado vive en `identidad.sesiones.estado` y lo
// valida el paso 2 del portero en cada petición.
//
// ── Y NO HAY "OLVIDÉ MI CONTRASEÑA" ──────────────────────────────────────────
//
// A propósito: no existe ninguna ruta de recuperación por correo en todo el sistema. El único
// restablecimiento es `POST /api/admin/usuarios/{id}/restablecer-password`, que lo hace OTRA
// persona con la capacidad `usuarios.editar` y que además se niega a hacerlo sobre uno mismo.
// Un enlace acá llevaría a una pantalla que no existe.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir, hayQueVolverAEntrar, type Respuesta } from '../../lib/http/cliente.ts';
import { destinoSeguro } from '../../lib/autorizacion/destino.ts';
import { MINIMO_PASSWORD } from '../../lib/autenticacion/politica.ts';
import './entrar.css';

/** Los estados de sesión, tal como los escribe `lib/autorizacion/estados.ts`. */
type Estado = 'pendiente_2fo' | 'debe_cambiar_password' | 'debe_configurar_2fo' | 'activa';

type Fase =
  | 'cargando'
  | 'sin_respuesta'
  | 'credenciales'
  | 'verificar_2fo'
  | 'cambiar_password'
  | 'configurar_2fo'
  | 'confirmar_2fo'
  | 'respaldos'
  | 'listo';

/** Las fases donde la sesión existe pero está restringida. Todas necesitan salida. */
const RESTRINGIDAS: readonly Fase[] = [
  'verificar_2fo',
  'cambiar_password',
  'configurar_2fo',
  'confirmar_2fo',
  'respaldos',
];

/**
 * De estado de sesión a fase de pantalla.
 *
 * Un estado que no esté en este mapa cae en `credenciales`, que es el modo de fallar seguro:
 * pide entrar de nuevo en vez de mostrar una pantalla que no corresponde.
 */
function faseDe(estado: string | undefined): Fase {
  switch (estado) {
    case 'activa':
      return 'listo';
    case 'pendiente_2fo':
      return 'verificar_2fo';
    case 'debe_cambiar_password':
      return 'cambiar_password';
    case 'debe_configurar_2fo':
      return 'configurar_2fo';
    default:
      return 'credenciales';
  }
}

/**
 * La URI que inscribe el secreto en una aplicación de autenticación.
 *
 * El servidor devuelve `secreto`, `emisor` y `cuenta`, y **no** arma esto ni genera un código
 * QR: el `otpauth://` es cosa del cliente. Los tres parámetros de algoritmo van explícitos
 * porque los valores por omisión del estándar no son universales entre aplicaciones, y una
 * que asuma otros genera códigos que nunca coinciden — con el síntoma más difícil de
 * diagnosticar que hay: todo parece bien y el código siempre está mal.
 */
function uriDeInscripcion(secreto: string, emisor: string, cuenta: string): string {
  const etiqueta = `${encodeURIComponent(emisor)}:${encodeURIComponent(cuenta)}`;
  const parametros = new URLSearchParams({
    secret: secreto,
    issuer: emisor,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${etiqueta}?${parametros.toString()}`;
}

interface Sesion {
  autenticado: boolean;
  estado?: Estado;
}

export default function Entrar() {
  const [fase, setFase] = useState<Fase>('cargando');
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [codigo, setCodigo] = useState('');

  const [secreto, setSecreto] = useState<string | null>(null);
  const [emisor, setEmisor] = useState('ARIA Comando Central');
  const [cuenta, setCuenta] = useState<string | null>(null);
  const [respaldos, setRespaldos] = useState<string[]>([]);

  // La contraseña temporal, para el cambio.
  //
  // `POST /api/auth/sesion` exige `{ actual, nueva }` — pide la actual incluso cuando el
  // estado es `debe_cambiar_password`, y el propio manejador dice por qué: *"sin eso, una
  // sesión robada permite cambiar la contraseña y quedarse con la cuenta"*.
  //
  // Vive en memoria del componente y en ningún otro lado: no va a `localStorage` —donde un
  // XSS la leería y donde sobreviviría a cerrar la pestaña— ni a la URL. Si alguien recarga
  // en esta fase queda vacía y el formulario pide la actual de nuevo, que es el costo
  // correcto.
  const [actual, setActual] = useState('');

  /**
   * Si la contraseña actual la traemos del paso de login, o hay que pedirla.
   *
   * Es un booleano APARTE del valor, y no una comprobación de `actual !== ''`. La primera
   * versión hacía `{actual ? null : <input value={actual} …/>}` — la condición de montaje era
   * el propio valor controlado, así que **el primer carácter que se escribía hacía desaparecer
   * el campo**. Y como después de recargar `actual` está vacío, el estado
   * `debe_cambiar_password` quedaba sin salida: el único formulario que lo resuelve se
   * desmontaba al empezar a escribir.
   */
  const [actualHeredada, setActualHeredada] = useState(false);

  const yaRetomado = useRef(false);

  const irAlDestino = useCallback(() => {
    const volver = destinoSeguro(
      new URLSearchParams(window.location.search).get('volver'),
      window.location.origin,
    );
    // `replace` y no `assign`: si el destino vuelve a rebotar acá, el botón de atrás no tiene
    // que quedar atrapado entre las dos pantallas.
    //
    // Y una navegación completa, no un enrutado del cliente: el proxy tiene que ver la
    // petición con la cookie puesta.
    window.location.replace(volver);
  }, []);

  /**
   * Pregunta el estado al servidor y coloca la fase que corresponda.
   *
   * @param siFalla A dónde volver si no se pudo preguntar. Por omisión a la pantalla de "no
   *   pudimos preguntar", pero desde la fase `respaldos` eso **perdería los códigos de
   *   respaldo para siempre** —se muestran una vez y no se pueden regenerar—, así que ahí se
   *   pasa la propia fase y el parpadeo de red no cuesta nada.
   */
  const retomar = useCallback(
    async (siFalla: Fase = 'sin_respuesta') => {
      // El error viejo se limpia acá. Sin esto, el cartel de una fase queda arriba de la
      // siguiente —se dibuja fuera de todos los bloques de fase— y se lee como si el paso nuevo
      // hubiera fallado.
      setError(null);

      // `GET /api/auth/sesion` responde 200 SIEMPRE, con o sin sesión — está diseñada así para
      // que el arranque del frontend no entre en bucle con el manejador del 401.
      const r = await pedir<Sesion>('/api/auth/sesion');

      if (r.tipo === 'sin_respuesta') {
        // NO se cae a la pantalla de login, y es la distinción que el `07` § 2 llama el peor
        // defecto de su lista: "no pude preguntar" no es "no estás autenticado". Mandar al
        // login ante un parpadeo de red le borra el formulario a alguien que sí tenía sesión.
        setFase(siFalla);
        setError('No se pudo contactar al servidor.');
        return;
      }
      if (r.tipo === 'rechazado') {
        // Esta ruta no rechaza por diseño. Si rechaza, algo estructural pasó —un proxy, la
        // plataforma— y decirlo es más útil que mostrar el login.
        setFase(siFalla);
        setError(textoDeRechazo(r));
        return;
      }

      if (!r.datos.autenticado) {
        setFase('credenciales');
        return;
      }
      const siguiente = faseDe(r.datos.estado);
      if (siguiente === 'listo') {
        irAlDestino();
        return;
      }
      setFase(siguiente);
    },
    [irAlDestino],
  );

  useEffect(() => {
    if (yaRetomado.current) return;
    yaRetomado.current = true;
    void retomar();
  }, [retomar]);

  /**
   * El resultado de una llamada que modifica.
   *
   * Tres ramas y ninguna nula, igual que `Respuesta<T>` de `lib/http/cliente.ts` y por el mismo
   * motivo: la versión anterior devolvía `Record | null` y los llamadores hacían `if (!datos)
   * return`. Eso volvía **inalcanzable** todo el manejo de los 409: las rutas del segundo
   * factor responden `ok({ confirmado: false, motivo: 'ya_confirmado' }, 409)`, que `pedir()`
   * convierte en `rechazado` porque el cuerpo lleva `motivo` y no `codigo` — así que
   * `datos.confirmado !== true` era código muerto y la pantalla quedaba clavada.
   */
  type Resultado =
    | { readonly tipo: 'datos'; readonly datos: Record<string, unknown> }
    | { readonly tipo: 'rechazado'; readonly estado: number; readonly codigo: string }
    | { readonly tipo: 'sin_respuesta' };

  /**
   * Una llamada que modifica, con el manejo de error en un solo lugar.
   *
   * Deja el mensaje puesto en todos los caminos de fallo y devuelve qué pasó, para que el
   * llamador pueda hacer algo distinto con un 409. Que el error se muestre siempre es el punto:
   * un botón que no hace nada y no dice por qué es indistinguible de uno roto.
   */
  const enviar = useCallback(
    async (
      camino: string,
      cuerpo?: unknown,
      // Textos que reemplazan el de un código en ESTE llamado.
      //
      // Existe por un caso medido: cambiar la contraseña con la actual mal responde
      // `credenciales_invalidas` —el mismo código que el login— porque para el servidor es
      // exactamente eso. Pero en esa pantalla "Credenciales inválidas." se lee como si la
      // contraseña NUEVA fuera el problema, y quien lo lea va a cambiarla en vez de corregir
      // la actual. El código del servidor está bien; el que necesita contexto es el texto.
      textos?: Readonly<Record<string, string>>,
    ): Promise<Resultado> => {
      setError(null);
      setOcupado(true);
      try {
        const r = await pedir<Record<string, unknown>>(camino, { metodo: 'POST', cuerpo });

        if (r.tipo === 'datos') return { tipo: 'datos', datos: r.datos };

        if (r.tipo === 'sin_respuesta') {
          setError('No se pudo contactar al servidor. Volvé a intentar.');
          return { tipo: 'sin_respuesta' };
        }

        // Tres códigos incorrectos del segundo factor BORRAN la sesión, y el servidor lo dice
        // con `sin_sesion`. Hay que volver al principio de verdad: la fila ya no existe, así
        // que insistir en la pantalla del código solo produce más rechazos.
        //
        // Va ANTES del texto por-llamada a propósito: el `detalle` del servidor acá dice
        // *"Demasiados códigos incorrectos. Volvé a iniciar sesión."*, que explica por qué la
        // sesión se cortó, y ningún texto nuestro lo puede mejorar.
        if (hayQueVolverAEntrar(r)) {
          setError(r.detalle ?? 'La sesión venció. Entrá de nuevo.');
          setCodigo('');
          setActualHeredada(false);
          setFase('credenciales');
          return { tipo: 'rechazado', estado: r.estado, codigo: r.codigo };
        }

        // Los tres códigos de ESTADO rutean a la fase que falta, en vez de mostrar un error.
        //
        // El portero los devuelve cuando la sesión está en un estado que no habilita la ruta, y
        // el `03` § 5 es explícito sobre por qué no se pueden mostrar como "no tenés permiso":
        // *"si se confunden, EL USUARIO NUNCA SABE QUE LE FALTA UN PASO"*. Y el nombre del
        // código **es** el nombre del estado, así que `faseDe()` lo traduce directo.
        const porEstado = faseDe(r.codigo);
        if (porEstado !== 'credenciales') {
          setFase(porEstado);
          return { tipo: 'rechazado', estado: r.estado, codigo: r.codigo };
        }

        setError(textos?.[r.codigo] ?? textoDeRechazo(r));
        return { tipo: 'rechazado', estado: r.estado, codigo: r.codigo };
      } finally {
        setOcupado(false);
      }
    },
    [],
  );

  async function salir() {
    // `DELETE /api/auth/sesion` borra la cookie SIEMPRE, con sesión o sin ella, y funciona en
    // todos los estados. Es la salida garantizada de un estado restringido, y por eso el botón
    // aparece en todos: *"un estado sin salida es una cuenta bloqueada que necesita a un
    // administrador"* (03 § 5).
    setOcupado(true);
    let salio: boolean;
    try {
      const r = await pedir('/api/auth/sesion', { metodo: 'DELETE' });
      salio = r.tipo === 'datos';
    } finally {
      setOcupado(false);
    }

    // Lo sensible se limpia SIEMPRE, haya salido o no: la cookie puede seguir viva, pero el
    // secreto del segundo factor y las contraseñas no tienen por qué seguir en memoria.
    setPassword('');
    setActual('');
    setActualHeredada(false);
    setNueva('');
    setRepetida('');
    setCodigo('');
    setSecreto(null);
    setRespaldos([]);
    setNota(null);

    if (!salio) {
      // `pedir()` no lanza ante red caída: devuelve `sin_respuesta`. Sin esta rama, la pantalla
      // volvía al login diciendo que cerró la sesión cuando la cookie seguía puesta y la fila
      // seguía viva — un éxito reportado que no ocurrió, en la única salida que un estado
      // restringido tiene.
      setError(
        'No se pudo cerrar la sesión: el servidor no respondió. Tu sesión sigue abierta. ' +
          'Volvé a intentar.',
      );
      return;
    }
    setError(null);
    setFase('credenciales');
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const r = await enviar('/api/auth/login', { email, password });
    if (r.tipo !== 'datos') return;
    // La contraseña se guarda para el posible cambio y se limpia del campo.
    setActual(password);
    setActualHeredada(true);
    setPassword('');
    const siguiente = faseDe(r.datos.estado as string | undefined);
    if (siguiente === 'listo') {
      irAlDestino();
      return;
    }
    setFase(siguiente);
  }

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    // Las dos comprobaciones del cliente: el largo lo exige también el servidor y esto evita
    // el viaje (ver `MINIMO_PASSWORD`); la igualdad de las dos copias NO la puede comprobar el
    // servidor, porque solo recibe una.
    if (nueva !== repetida) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }
    if (nueva.length < MINIMO_PASSWORD) {
      setError(`La contraseña nueva necesita al menos ${MINIMO_PASSWORD} caracteres.`);
      return;
    }
    const r = await enviar(
      '/api/auth/sesion',
      { actual, nueva },
      { credenciales_invalidas: 'La contraseña actual no es correcta.' },
    );
    if (r.tipo !== 'datos') return;
    setActual('');
    setActualHeredada(false);
    setNueva('');
    setRepetida('');
    // Esta respuesta **no trae `estado`**, así que hay que preguntar: cambiar la contraseña
    // puede dejar la sesión `activa` o mandar a configurar el segundo factor, y adivinarlo acá
    // sería duplicar la lógica de `estadoQueCorresponde()` del servidor.
    await retomar();
    // La nota va DESPUÉS: `retomar()` limpia el error, y ponerla antes la dejaba tapada por el
    // mensaje de la fase nueva.
    setNota('Contraseña cambiada. Las demás sesiones se cerraron.');
  }

  async function pedirSecreto() {
    const r = await enviar('/api/auth/2fo/configurar');
    if (r.tipo !== 'datos') return;
    const s = typeof r.datos.secreto === 'string' ? r.datos.secreto : null;
    if (!s) {
      // Sin secreto no hay nada que inscribir. Pasar a `confirmar_2fo` dejaría una caja vacía
      // con un botón que no puede funcionar: el código no va a coincidir con nada.
      setError('El servidor no devolvió el secreto. Volvé a intentar.');
      return;
    }
    setSecreto(s);
    if (typeof r.datos.emisor === 'string') setEmisor(r.datos.emisor);
    setCuenta(typeof r.datos.cuenta === 'string' ? r.datos.cuenta : null);
    setFase('confirmar_2fo');
  }

  async function confirmar2fo(e: React.FormEvent) {
    e.preventDefault();
    const r = await enviar('/api/auth/2fo/confirmar', { codigo });

    // El 409 es el camino que antes era inalcanzable. `sin_alta_empezada` y `ya_confirmado`
    // llegan los dos sin `motivo` —`pedir()` lo colapsa— y los dos se resuelven igual: el
    // secreto que tiene esta pantalla no sirve, así que se descarta y se vuelve a preguntar el
    // estado. Sin esto, la pantalla quedaba pidiendo un código contra un secreto muerto.
    if (r.tipo === 'rechazado' && r.estado === 409) {
      setSecreto(null);
      setCodigo('');
      await retomar();
      setError('El alta del segundo factor no estaba en curso. Volvé a generar el secreto.');
      return;
    }
    if (r.tipo !== 'datos') return;

    setCodigo('');
    setSecreto(null);
    const lista = Array.isArray(r.datos.respaldos) ? (r.datos.respaldos as string[]) : [];
    // Los códigos de respaldo se muestran UNA vez: el servidor guarda solo su huella. Si esta
    // pantalla no los mostrara se perderían sin que nada falle — y son la única salida de
    // "perdí el teléfono", porque no hay ruta para regenerarlos.
    setRespaldos(lista);
    setFase('respaldos');
  }

  async function verificar2fo(e: React.FormEvent) {
    e.preventDefault();
    const r = await enviar('/api/auth/2fo/verificar', { codigo });

    // `sin_factor_confirmado` viene como 409 sin motivo. Significa que esta pantalla y el
    // servidor no coinciden sobre el estado, y lo único correcto es volver a preguntar.
    if (r.tipo === 'rechazado' && r.estado === 409) {
      setCodigo('');
      await retomar();
      setError('Tu cuenta no tiene un segundo factor confirmado.');
      return;
    }
    if (r.tipo !== 'datos') return;

    setCodigo('');
    const porRespaldo = r.datos.porRespaldo === true;
    await retomar();
    if (porRespaldo) {
      // Usar un código de respaldo lo consume, y son ocho sin forma de regenerarlos. Callarlo
      // haría que alguien los gaste sin darse cuenta hasta quedarse sin ninguno. Va después de
      // `retomar()`, que limpia el error.
      setNota('Usaste un código de respaldo: ese código ya no sirve.');
    }
  }

  const enFaseRestringida = RESTRINGIDAS.includes(fase);

  return (
    <main className="entrar">
      <div className="entrar-caja">
        <header className="entrar-cabecera">
          <span className="entrar-marca">AIOS</span>
          <h1 className="entrar-titulo">{TITULOS[fase]}</h1>
          {SUBTITULOS[fase] ? <p className="entrar-sub">{SUBTITULOS[fase]}</p> : null}
        </header>

        {error ? (
          <p className="entrar-error" role="alert">
            {error}
          </p>
        ) : null}

        {nota ? (
          <p className="entrar-nota" role="status">
            {nota}
          </p>
        ) : null}

        {fase === 'cargando' ? <p className="entrar-sub">Verificando la sesión…</p> : null}

        {fase === 'sin_respuesta' ? (
          <div className="entrar-form">
            <button type="button" onClick={() => void retomar()} disabled={ocupado}>
              {ocupado ? 'Reintentando…' : 'Reintentar'}
            </button>
          </div>
        ) : null}

        {fase === 'credenciales' ? (
          <form onSubmit={entrar} className="entrar-form">
            <label className="entrar-campo">
              <span>Correo</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="entrar-campo">
              <span>Contraseña</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button type="submit" disabled={ocupado}>
              {ocupado ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        ) : null}

        {fase === 'cambiar_password' ? (
          <form onSubmit={cambiarPassword} className="entrar-form">
            {/* La actual se pierde al recargar: el campo aparece solo en ese caso.
             *
             * La condición es `actualHeredada` y NO `actual`, y la diferencia era un defecto
             * que rompía el flujo entero: con `{actual ? null : <input value={actual}/>}` la
             * condición de montaje era el propio valor controlado, así que el PRIMER CARÁCTER
             * que se escribía hacía desaparecer el campo. Después de recargar en este estado,
             * el único formulario que saca de `debe_cambiar_password` era inusable. */}
            {actualHeredada ? null : (
              <label className="entrar-campo">
                <span>Contraseña actual</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  autoFocus
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                />
              </label>
            )}
            <label className="entrar-campo">
              <span>Contraseña nueva</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={MINIMO_PASSWORD}
                autoFocus={actualHeredada}
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
              />
            </label>
            <label className="entrar-campo">
              <span>Repetila</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
              />
            </label>
            <button type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Cambiar la contraseña'}
            </button>
          </form>
        ) : null}

        {fase === 'configurar_2fo' ? (
          <div className="entrar-form">
            <button type="button" onClick={() => void pedirSecreto()} disabled={ocupado}>
              {ocupado ? 'Generando…' : 'Generar el secreto'}
            </button>
          </div>
        ) : null}

        {fase === 'confirmar_2fo' && secreto ? (
          <>
            <div className="entrar-secreto">
              <p className="entrar-sub">
                Cargalo en tu aplicación de autenticación con la opción de carga manual:
              </p>
              <code className="entrar-clave">{secreto}</code>
              <dl className="entrar-datos">
                <div>
                  <dt>Emisor</dt>
                  <dd>{emisor}</dd>
                </div>
                <div>
                  <dt>Cuenta</dt>
                  <dd className="entrar-mono">{cuenta}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>TOTP · SHA1 · 6 dígitos · 30 s</dd>
                </div>
              </dl>
              {cuenta ? (
                <p className="entrar-sub">
                  Desde el teléfono también sirve este enlace:{' '}
                  <a className="entrar-enlace" href={uriDeInscripcion(secreto, emisor, cuenta)}>
                    abrir en la aplicación
                  </a>
                </p>
              ) : null}
              <p className="entrar-aviso">
                Este secreto se muestra una sola vez. Si salís sin confirmar, hay que volver a
                empezar el alta.
              </p>
            </div>
            <form onSubmit={confirmar2fo} className="entrar-form">
              <label className="entrar-campo">
                <span>El código que muestra la aplicación</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />
              </label>
              <button type="submit" disabled={ocupado}>
                {ocupado ? 'Confirmando…' : 'Confirmar'}
              </button>
            </form>
          </>
        ) : null}

        {fase === 'respaldos' ? (
          <div className="entrar-secreto">
            <p className="entrar-sub">
              Guardá estos códigos en un lugar seguro. Cada uno sirve una sola vez, y son la
              única forma de entrar si perdés el teléfono.
            </p>
            <ul className="entrar-respaldos">
              {respaldos.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="entrar-aviso">
              No se vuelven a mostrar y no se pueden regenerar: el servidor guarda solo su
              huella, no los códigos.
            </p>
            <div className="entrar-form">
              {/* Se pasa la propia fase como respaldo: si el servidor no responde, la
                * pantalla se queda ACÁ con los códigos a la vista en vez de irse a "no pudimos
                * preguntar". Se muestran una sola vez y no se pueden regenerar, así que un
                * parpadeo de red no puede costarlos. */}
              <button
                type="button"
                onClick={() => void retomar('respaldos')}
                disabled={ocupado}
              >
                Ya los guardé, continuar
              </button>
            </div>
          </div>
        ) : null}

        {fase === 'verificar_2fo' ? (
          <form onSubmit={verificar2fo} className="entrar-form">
            <label className="entrar-campo">
              <span>Código de tu aplicación de autenticación</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </label>
            <button type="submit" disabled={ocupado}>
              {ocupado ? 'Verificando…' : 'Verificar'}
            </button>
            <p className="entrar-sub">
              También sirve uno de tus códigos de respaldo. Este paso vence en cinco minutos y
              tres códigos incorrectos cierran la sesión.
            </p>
          </form>
        ) : null}

        {fase === 'listo' ? <p className="entrar-sub">Entrando…</p> : null}

        {enFaseRestringida ? (
          <button type="button" className="entrar-salir" onClick={() => void salir()} disabled={ocupado}>
            Cerrar sesión y volver al principio
          </button>
        ) : null}
      </div>
    </main>
  );
}

const TITULOS: Record<Fase, string> = {
  cargando: 'Un momento',
  sin_respuesta: 'No pudimos preguntar',
  credenciales: 'Entrar',
  verificar_2fo: 'Segundo factor',
  cambiar_password: 'Cambiá tu contraseña',
  configurar_2fo: 'Configurá el segundo factor',
  confirmar_2fo: 'Confirmá el segundo factor',
  respaldos: 'Tus códigos de respaldo',
  listo: 'Listo',
};

const SUBTITULOS: Record<Fase, string | null> = {
  cargando: null,
  sin_respuesta: 'No es tu sesión: no se pudo llegar al servidor para preguntar por ella.',
  credenciales: null,
  verificar_2fo: null,
  cambiar_password: 'Entraste con una contraseña temporal. Elegí una propia para continuar.',
  configurar_2fo:
    'Tu rol exige un segundo factor. Vas a necesitar una aplicación de autenticación.',
  confirmar_2fo: null,
  respaldos: null,
  listo: null,
};

/**
 * El texto para un rechazo.
 *
 * Los códigos vienen de `RECHAZOS` en `lib/autorizacion/respuesta.ts`, donde están
 * deliberadamente sin colapsar: *"si se confunden, EL USUARIO NUNCA SABE QUE LE FALTA UN
 * PASO"*. Colapsarlos acá tiraría a la basura ese trabajo, así que cada uno tiene su texto.
 *
 * El `detalle` del servidor gana cuando existe: es texto escrito para leerse y a veces trae
 * lo único que no está en ningún otro campo —los minutos de `cuenta_bloqueada`—.
 *
 * Un código desconocido cae en un mensaje genérico y **no** en cadena vacía: un formulario que
 * rechaza sin decir nada es indistinguible de uno roto.
 */
function textoDeRechazo(r: Extract<Respuesta<unknown>, { tipo: 'rechazado' }>): string {
  const base = textoBase(r.codigo, r.estado);
  // El `detalle` COMPLEMENTA, no reemplaza.
  //
  // La primera versión hacía `if (r.detalle) return r.detalle`, y eso borraba la mitad que
  // explica QUÉ pasó. El caso concreto: `cuenta_bloqueada` trae como detalle
  // `"Esperá 15 minuto(s)."` — solo el plazo, porque el servidor supone que el código ya dijo
  // el resto. Con el reemplazo, quien fallaba cinco veces leía únicamente "Esperá 15
  // minuto(s)." sin enterarse de que su cuenta quedó bloqueada, que es justo la información
  // que el `02` § 4 rompe el mensaje único para poder darle: *"quien llegó hasta ahí ya sabe
  // que la cuenta existe, porque la bloqueó él. Ocultarlo solo confunde al dueño legítimo, que
  // necesita saber que tiene que esperar."*
  //
  // Concatenados, los dos dicen la cosa completa. Y cuando no hay código conocido, el detalle
  // solo sigue siendo mejor que un texto genérico.
  if (r.detalle) return base ? `${base} ${r.detalle}` : r.detalle;
  return base ?? `No se pudo completar la operación (${r.estado}). Volvé a intentar.`;
}

/** El texto de un código, o `null` si no lo conocemos. */
function textoBase(codigo: string, estado: number): string | null {
  switch (codigo) {
    case 'credenciales_invalidas':
      return 'Credenciales inválidas.';
    case 'cuenta_bloqueada':
      return 'La cuenta está bloqueada por intentos fallidos.';
    case 'demasiados_intentos':
      return 'Demasiados intentos desde esta conexión. Esperá unos minutos.';
    // ── Los tres códigos de ESTADO ────────────────────────────────────────────
    //
    // No estaban, y su ausencia caía en el texto genérico "no se pudo completar la
    // operación". El portero los devuelve cuando la sesión está en un estado que no habilita
    // la ruta, y el `03` § 5 es explícito: *"cada estado devuelve su propio código… si se
    // confunden, EL USUARIO NUNCA SABE QUE LE FALTA UN PASO"*. `enviar()` ya rutea a la fase
    // que corresponde; estos textos son para cuando además hay que decir algo.
    case 'pendiente_2fo':
      return 'Falta verificar tu segundo factor.';
    case 'debe_cambiar_password':
      return 'Tenés que cambiar tu contraseña antes de continuar.';
    case 'debe_configurar_2fo':
      return 'Tenés que configurar tu segundo factor antes de continuar.';
    case 'sin_sesion':
      return 'La sesión venció. Entrá de nuevo.';
    case 'sin_permiso':
      return 'Tu cuenta no tiene permiso para esta operación.';
    case 'organizacion_inactiva':
      return 'Tu organización está desactivada. Hablá con quien administra la plataforma.';
    case 'base_no_disponible':
      return 'La base de datos no responde. Volvé a intentar en un momento.';
    // Es el fallo de configuración número uno de este sistema: el dominio esperado tiene que
    // coincidir EXACTO con el host desde el que se abre la aplicación, y cuando no coincide
    // todo login falla con un 403. Lo que importa decirle a quien lo lee es que NO son sus
    // credenciales: sin eso, va a probar contraseñas hasta que se le bloquee la cuenta.
    //
    // El nombre de la variable NO se escribe acá, y lo aprendimos por una prueba:
    // `ADR-0601` falla si un nombre de variable de entorno aparece en el paquete del
    // navegador. Tenía razón — un mensaje de error no es lugar para el vocabulario de
    // configuración del servidor, y quien tenga que arreglarlo lo encuentra en
    // `docs/DESPLIEGUE.md` y en el registro del servidor.
    case 'origen_no_permitido':
      return (
        'El servidor rechazó el origen de esta petición. Es un problema de configuración del ' +
        'servidor, no de tus credenciales: avisale a quien lo administra.'
      );
    default:
      // `null` y no un texto: quien llama decide, y así el `detalle` del servidor no queda
      // escondido detrás de un genérico cuando el código no lo conocemos. `estado` se usa en
      // el texto de último recurso, que arma `textoDeRechazo`.
      void estado;
      return null;
  }
}
