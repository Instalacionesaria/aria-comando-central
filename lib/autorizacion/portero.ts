// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0302 — El permiso se pregunta por capacidad, nunca por nombre de rol.
// ADR-0306 — Toda petición que modifica verifica el origen.
//
// El portero. UNA sola función, y toda operación empieza llamándola.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA FIRMA CAMBIÓ, Y EL MOTIVO IMPORTA MÁS QUE EL CAMBIO
//
// El 03 § 5 escribe `exigir(peticion, respuesta, capacidadesRequeridas)` con el contrato
// "devuelve nulo y ya respondió", y defiende esa forma con un argumento que hay que leer
// entero antes de cambiarla:
//
//   "Devuelve nulo y ya respondió, en vez de lanzar una excepción o devolver un resultado
//    con dos ramas. Eso obliga a escribir la línea de salida, y OLVIDARSE NO ABRE LA
//    OPERACIÓN: rompe en cuanto se usa el contexto. Un portero que devolviera un booleano
//    se podría ignorar en silencio."
//
// **Esa firma no es implementable en el App Router.** Un manejador de ruta no recibe un
// objeto `respuesta` que se pueda escribir: devuelve una `Response`. No hay a quién
// "responderle" desde adentro del portero.
//
// Así que se cambia la firma y **se conserva la propiedad**, que es lo que el documento
// está defendiendo:
//
//     const ctx = await exigir(peticion, ['usuarios.ver']);
//     if (ctx instanceof Response) return ctx;      // el portero ya armó la respuesta
//
// Olvidarse de esa línea no abre la operación: `ctx.permisos` sobre un `Contexto | Response`
// es un **error de compilación**, porque `Response` no tiene `permisos`. Es MÁS fuerte que
// la versión del documento —ahí olvidarse rompe en tiempo de ejecución, acá no compila— y
// conserva lo esencial: no hay forma de ignorar el resultado en silencio.
//
// Lo que NO se hace, y son las dos salidas que parecen naturales:
//
//   · **Lanzar una excepción.** El 03 § 5 la descarta explícitamente, y con razón: un
//     `catch` de más arriba la convierte en 500 y el cliente pierde el código.
//   · **Devolver `{ ok, contexto }`.** Es el defecto que el mismo § 5 nombra para las rutas
//     sin sesión: *"quien escriba `si no contexto: devolver` sobre la forma nueva NUNCA
//     corta, porque un objeto siempre es verdadero"*.
//
// Queda registrado como desviación en `docs/ETAPA-3.md` y `docs/LEXICO.md`. La cadena que
// buscan las pruebas sigue siendo `exigir(`.
// ═══════════════════════════════════════════════════════════════════════════════

import { contieneAlguna, NINGUNA, type Exigencia } from './capacidades.ts';
import {
  EXENTAS_DE_ORGANIZACION_ACTIVA,
  SIN_SESION_REQUERIDA,
  estadoHabilita,
  type Ruta,
} from './estados.ts';
import { rechazo } from './respuesta.ts';
import { COOKIE_SESION, resolverSesion, type Contexto } from './sesion.ts';
import { conIdentidad } from '../datos/capa.ts';
import { auditar } from '../autenticacion/auditoria.ts';

export { NINGUNA } from './capacidades.ts';
export type { Contexto } from './sesion.ts';

/**
 * El dominio del que se aceptan peticiones que modifican.
 *
 * Se lee del entorno y NO tiene respaldo implícito: si falta, `verificarOrigen` rechaza
 * toda petición que modifica. Un respaldo a "cualquier origen" sería el `??` del `07` § 1
 * con la peor consecuencia posible.
 */
function dominioEsperado(): string | undefined {
  return process.env.DOMINIO_ESPERADO;
}

/** `MÉTODO /camino`, como lo comparan las listas blancas. */
export function rutaDe(peticion: Request): Ruta {
  const { pathname } = new URL(peticion.url);
  return `${peticion.method} ${pathname}` as Ruta;
}

/**
 * ADR-0306 · La verificación de origen. Tres líneas, del 08 § 5.3 literal.
 *
 * `SameSite=Lax` cubre el caso común, *"pero es una defensa del navegador y depende de su
 * versión y su configuración"*. Ésta es independiente.
 *
 * Va **antes** de resolver la sesión —decisión que el 08 § 5.3 deja abierta al decir solo
 * "junto a la verificación de sesión"—: una petición falsificada no llega a consultar la
 * base, y la comprobación más barata va primero.
 */
export function verificarOrigen(peticion: Request): Response | null {
  if (peticion.method === 'GET' || peticion.method === 'HEAD' || peticion.method === 'OPTIONS') {
    return null;
  }
  const esperado = dominioEsperado();
  const origen = peticion.headers.get('origin');
  if (!esperado) {
    // El nombre de la variable va al REGISTRO DEL SERVIDOR, no al cuerpo de la respuesta.
    //
    // Antes viajaba como `detalle`, y eso era un detalle de configuración del servidor
    // contado a cualquiera que golpee el endpoint. Dejó de ser teórico cuando la pantalla de
    // entrada empezó a mostrar el `detalle` de los rechazos: la variable mal puesta pasaba a
    // aparecer en la cara del usuario.
    //
    // Y el registro es el lugar correcto de todas formas: quien puede arreglar esto es quien
    // administra el despliegue, y esa persona lee el registro, no la pantalla de login.
    // Registrar el NOMBRE no filtra nada —no es el valor— y `ADR-0407` prohíbe registrar
    // cuerpos, que no es el caso.
    console.error(
      'verificarOrigen: la variable de dominio esperado no está configurada. Toda petición ' +
        'que modifica va a ser rechazada, incluido el login. Ver docs/DESPLIEGUE.md.',
    );
    return rechazo('origen_no_permitido');
  }
  if (!origen) return rechazo('origen_no_permitido');
  let host: string;
  try {
    host = new URL(origen).host;
  } catch {
    return rechazo('origen_no_permitido');
  }
  return host === esperado ? null : rechazo('origen_no_permitido');
}

/**
 * La sesión, o **nulo**, sin responder nada. Para las dos rutas de `SIN_SESION_REQUERIDA`.
 *
 * Es la función aparte que pide el paso 0 del 03 § 5, con su propio contrato: *"devuelve la
 * sesión O NULO, y nunca responde por su cuenta. Quien la llama decide qué hacer con el
 * nulo."*
 */
export async function sesionOpcional(peticion: Request): Promise<Contexto | null> {
  return resolverSesion(cookieDe(peticion));
}

function cookieDe(peticion: Request): string | undefined {
  // Se lee de la cabecera y no de `cookies()` de `next/headers` a propósito: así el portero
  // es una función de `Request` a `Response`, comprobable con una petición armada a mano en
  // una prueba, sin el almacén de la petición del framework de por medio.
  const crudo = peticion.headers.get('cookie');
  if (!crudo) return undefined;
  for (const parte of crudo.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === COOKIE_SESION) {
      return decodeURIComponent(parte.slice(i + 1).trim());
    }
  }
  return undefined;
}

/**
 * El portero. Devuelve el contexto, o la `Response` que hay que devolver.
 *
 * ── EL ORDEN DE LOS PASOS NO ES INTERCAMBIABLE ───────────────────────────────
 *
 * El 03 § 5: *"Los estados de la sesión antes de los permisos; la organización antes de
 * todo lo de negocio. Cada paso asume que el anterior pasó."*
 *
 * ── LO QUE NO LLEVA ──────────────────────────────────────────────────────────
 *
 * No lleva la línea `si contexto.esRolDePlataforma: devolver contexto`. El 03 § 5 ofrece ese
 * atajo como una de dos alternativas y `EJECUCION` § 3 eligió la otra: *"el rol de plataforma
 * tiene todas las capacidades cargadas en la tabla. Sin atajo en el portero."* El motivo
 * escrito: *"con cuatro roles y veinte usuarios el atajo ahorra poco y crea un camino de
 * código que se ejercita distinto que el normal"*. Un atajo que no está no se puede olvidar
 * de los pasos 1 a 3.
 */
export async function exigir(
  peticion: Request,
  capacidadesRequeridas: Exigencia,
): Promise<Contexto | Response> {
  const ruta = rutaDe(peticion);

  // Paso 0 · Las dos rutas sin sesión tienen su propia función, y llamar al portero con
  // ellas es un error de programación, no un caso a manejar. El 03 § 5 lo escribe como un
  // `error`, no como un rechazo: mezclar los dos contratos es lo que produce los defectos
  // silenciosos que esa sección entera existe para evitar.
  if (SIN_SESION_REQUERIDA.includes(ruta)) {
    throw new Error(`exigir: ${ruta} usa sesionOpcional(), no el portero`);
  }

  // ADR-0306 · El origen, antes de tocar la base.
  const origenMal = verificarOrigen(peticion);
  if (origenMal) return origenMal;

  // Paso 1 · ¿Hay sesión válida?
  let contexto: Contexto | null;
  try {
    contexto = await resolverSesion(cookieDe(peticion));
  } catch {
    // "No pude preguntar" NO es "no hay sesión". Si esto devolviera 401, un parpadeo de la
    // base expulsaría a todos los usuarios a la vez (07 § 0 regla 2, 07 § 4).
    return rechazo('base_no_disponible');
  }
  if (!contexto) return rechazo('sin_sesion');

  // Paso 2 · ¿La sesión está en un estado que restringe?
  if (!estadoHabilita(contexto.estado, ruta)) {
    // `activa` no habilita "todas" por una lista sino por `null`, así que llegar acá con
    // `activa` es imposible… y el compilador no lo puede demostrar. En vez de callarlo con
    // un casteo, se afirma: si algún día `ESTADOS.activa` deja de ser `null`, esto LANZA en
    // vez de responder un código de rechazo que no existe.
    if (contexto.estado === 'activa') {
      throw new Error('exigir: una sesión activa quedó sin habilitar la ruta. Revisá ESTADOS.');
    }
    // El código es LITERALMENTE el estado, no `sin_permiso`. Los dos son 403 y son cosas
    // distintas.
    return rechazo(contexto.estado);
  }

  // Paso 3 · ¿La organización está activa?
  if (!contexto.organizacion.activa && !EXENTAS_DE_ORGANIZACION_ACTIVA.includes(ruta)) {
    return rechazo('organizacion_inactiva');
  }

  // Paso 4 · Las operaciones abiertas a cualquiera con sesión.
  if (capacidadesRequeridas === NINGUNA) return contexto;

  // Paso 5 · ¿Tiene ALGUNA de las capacidades pedidas?
  if (!contieneAlguna(contexto.permisos, capacidadesRequeridas)) {
    // ADR-0809 · Se EMITE `permiso_denegado`, con la capacidad en el detalle.
    //
    // El `10` § 1 lo llama *"la señal más subestimada"*: *"un pico de rechazos por permiso en una
    // organización casi nunca es un ataque: es un rol al que le falta una capacidad, y **nadie lo va
    // a reportar** porque la pantalla se ve"*.
    //
    // La capacidad va en el detalle porque la señal 3 agrupa por `detalle->>'capacidad'`. Sin ese
    // campo la consulta devuelve una sola fila con la capacidad en nulo, y se pierde justo lo que la
    // señal quería decir: **qué** permiso le falta a qué rol.
    try {
      await conIdentidad(async (db) => {
        await auditar(db, {
          accion: 'permiso_denegado',
          usuarioId: contexto.usuarioId,
          orgId: contexto.orgEfectiva,
          detalle: { capacidad: capacidadesRequeridas.join(',') },
        });
      });
    } catch {
      // Si la auditoría no se puede escribir, la base no está: `resolverSesion` habría fallado
      // antes, así que este camino es casi imposible. Pero si ocurre, responder 403 sería mentir
      // —el rechazo no quedó registrado— y el 503 dice la verdad.
      return rechazo('base_no_disponible');
    }
    return rechazo('sin_permiso');
  }

  return contexto;
}
