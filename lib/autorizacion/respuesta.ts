// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// El único constructor de respuestas del API.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UNO SOLO, Y POR QUÉ NINGÚN MANEJADOR CONSTRUYE `Response` DIRECTO
//
// Dos propiedades tienen que valer en TODA respuesta autenticada, y las dos se pierden por
// omisión:
//
//   · `Cache-Control: no-store`. La cabecera que Next pone por omisión en una respuesta
//     dinámica NO es `no-store`. Una respuesta con datos de un inquilino que quede en un
//     caché intermedio es la fuga del 08 § 3, y la fila de la Etapa 7 la va a verificar.
//   · Un cuerpo de error con `codigo`. El 03 § 5 y el 09 § 5 dicen dos veces que los cinco
//     403 no se pueden colapsar. Si cada manejador arma su propio cuerpo, se colapsan.
//
// Con un solo constructor las dos son estructurales. Con `Response.json()` suelto en cada
// manejador, las dos dependen de que nadie se olvide — y olvidarse no falla.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Los códigos de rechazo. Cada uno significa **una** cosa.
 *
 * Cinco de los seis son 403 y eso es deliberado. El 03 § 5:
 *
 *   "Cada estado devuelve su propio código de respuesta, distinto del de falta de permiso.
 *    Los dos son 403 y son cosas distintas: el de permiso se muestra muchas veces como
 *    'no hay datos', y si se confunden, EL USUARIO NUNCA SABE QUE LE FALTA UN PASO."
 *
 * Colapsarlos en un "no tenés permiso" deja a quien está en `debe_cambiar_password` leyendo
 * que le falta un permiso, cuando la salida —cambiar la contraseña— es justo la que no va a
 * buscar.
 */
export const RECHAZOS = {
  // Paso 1 del portero.
  sin_sesion: 401,
  // Paso 2: el estado de la sesión. Son los mismos valores que el `check` de la tabla.
  pendiente_2fo: 403,
  debe_cambiar_password: 403,
  debe_configurar_2fo: 403,
  // Paso 3.
  organizacion_inactiva: 403,
  // Paso 5.
  sin_permiso: 403,
  // 08 § 5.3. DECISIÓN: la especificación es el único lugar donde da un 403 SIN código de
  // cuerpo —"responder 403 'Origen no permitido'"—, y justo es el que el cliente no podría
  // distinguir de los otros cinco. Se le pone código.
  origen_no_permitido: 403,
  // ── Etapa 4 · el login ──────────────────────────────────────────────────────
  //
  // NINGUNO de estos tres está en la especificación con un código de cuerpo. Los tres hacen
  // falta, y los tres tienen que ser distinguibles.
  //
  // `credenciales_invalidas` es 401 y **no** es `sin_sesion`, y la diferencia no es
  // cosmética: `hayQueVolverAEntrar()` del cliente HTTP mira el código, no el estado, así
  // que si compartieran código una contraseña mal tipeada quedaría indistinguible de "se te
  // venció la sesión" para todo el frontend. El mensaje que se muestra es el mismo para las
  // tres causas —correo inexistente, cuenta inactiva, contraseña mal—; lo que se distingue
  // es el CÓDIGO DE SITUACIÓN, no la causa.
  credenciales_invalidas: 401,
  // La excepción deliberada al mensaje único (02 § 4): *"cuando la cuenta está bloqueada, se
  // dice. Rompe el mensaje único a propósito — quien llegó hasta ahí ya sabe que la cuenta
  // existe, porque la bloqueó él. Ocultarlo solo confunde al dueño legítimo, que necesita
  // saber que tiene que esperar."*
  cuenta_bloqueada: 429,
  // El freno por origen. Código propio y distinto del de cuenta: el 09 § 5 exige que
  // rechazos distintos sean distinguibles por el cliente, y estos dos significan cosas
  // opuestas —"tu cuenta está protegida" contra "esta dirección está golpeando"—.
  demasiados_intentos: 429,
  // ── Etapa 5 · administración ─────────────────────────────────────────────────
  //
  // NINGUNO de los tres está en la especificación con un código de cuerpo.
  //
  // `no_encontrado` es 404 y NO 403, y la diferencia es la fila INNEGOCIABLE de la etapa:
  // *"404, nunca 200 — y 404 y no 403, porque un 403 CONFIRMA QUE ESE IDENTIFICADOR EXISTE"*.
  // También se usa para un id mal formado: distinguirlo sería un oráculo más débil, pero gratis
  // de cerrar.
  no_encontrado: 404,
  // "Nadie se borra, desactiva ni degrada a sí mismo". Es un CONFLICTO, no una falta de permiso:
  // quien lo intenta tiene la capacidad, y lo que está mal es el objetivo. Con 403 el mensaje
  // diría "no tenés permiso" cuando sí lo tiene, y buscaría el permiso que le falta.
  sobre_si_mismo: 409,
  // "No se puede dejar una organización sin administrador activo". Mismo razonamiento.
  ultimo_administrador: 409,
  // Unicidad. El 05 § 3 lo nombra literal —`409`, código `email_duplicado`— y explica por qué NO
  // se devuelve el mensaje de la base: *"las verificaciones de unicidad y de integridad
  // referencial NO PASAN por la seguridad a nivel de fila… un mensaje de 'ya existe una fila con
  // ese valor' es entonces un canal que CONFIRMA LA EXISTENCIA DE UN REGISTRO DE OTRA
  // ORGANIZACIÓN, aunque quien pregunta no pueda verlo."*
  email_duplicado: 409,
  // Cualquier rechazo de un DISPARADOR, con el mensaje de la base tal cual. El 05 § 3: *"si los
  // mensajes de los disparadores están escritos para leerse, traducirlos en el backend sería
  // mantener dos textos que dicen lo mismo y que van a divergir."* La excepción son unicidad y
  // clave foránea, que tienen su propio código arriba.
  rechazo_de_la_base: 409,
  // No está en ningún documento, y hace falta: si la base falla, la respuesta NO puede ser
  // 401 `sin_sesion` —eso expulsaría a todo el mundo ante un parpadeo de red y en los
  // registros parecería que a nadie le andaba la sesión (07 § 4)—. Es la regla 2 del
  // 07 § 0: un valor significa una sola cosa.
  base_no_disponible: 503,
} as const;

/**
 * El único texto que ve quien falla el login. **Uno solo, para tres situaciones.**
 *
 * El `02` § 4: *"`401` con 'Credenciales inválidas.' para las tres situaciones: el email no
 * existe, la cuenta está inactiva, o la contraseña está mal. Distinguirlas le confirma a un
 * atacante qué emails son reales — un enumerador de cuentas gratis."*
 */
export const CREDENCIALES_INVALIDAS = 'Credenciales inválidas.';

export type CodigoRechazo = keyof typeof RECHAZOS;

/**
 * ADR-0704 — Las respuestas de error no revelan estructura.
 *
 * El mensaje de un error de la base, **solo si viene de un disparador que alguien escribió para
 * que lo lea una persona**. Para cualquier otro error devuelve `null`.
 *
 * ── EL DISCRIMINANTE ES EL SQLSTATE, NO EL TEXTO ─────────────────────────────
 *
 * El `05` § 3 pide devolver el mensaje de la base *"tal cual"* porque *"si los mensajes de los
 * disparadores están escritos para leerse, traducirlos en el backend sería mantener dos textos que
 * dicen lo mismo y que van a divergir"*. Y tiene razón.
 *
 * Pero `ADR-0704` exige que ningún cuerpo de error contenga nombres de tablas ni consultas. Las dos
 * cosas son compatibles **solo si se distingue qué error es**, y el texto no sirve para eso. Medido
 * contra esta base:
 *
 *   · un disparador:  `El administrador principal no se puede degradar (usuario 6fffc…).`
 *   · un error real:  `column "columna_inexistente" of relation "usuarios" does not exist`
 *
 * El segundo **nombra la tabla**. Un filtro por patrones sobre el texto sería una lista de palabras
 * prohibidas que hay que mantener, y que falla en el idioma equivocado.
 *
 * `P0001` es `raise_exception`: **el código que produce exactamente un `raise exception` de
 * plpgsql, y ningún otro error**. Los errores estructurales tienen los suyos —`42703` para una
 * columna que no existe, `42P01` para una tabla— y ninguno pasa.
 *
 * Nótese que `23505` (unicidad) y `23503` (clave foránea) **tampoco** pasan, y eso es deliberado:
 * el `05` § 3 los excluye por su cuenta porque *"las verificaciones de unicidad y de integridad
 * referencial no pasan por la seguridad a nivel de fila… un mensaje de 'ya existe una fila con ese
 * valor' es un canal que confirma la existencia de un registro de otra organización"*.
 */
export function mensajeDeDisparador(e: unknown): string | null {
  const codigo = (e as { code?: unknown } | null)?.code;
  if (codigo !== 'P0001') return null;
  const mensaje = (e as { message?: unknown } | null)?.message;
  if (typeof mensaje !== 'string' || mensaje.length === 0) return null;
  // Solo la primera línea: el `CONTEXT:` de plpgsql nombra la función y su número de línea.
  return mensaje.split('\n')[0] ?? null;
}

/** Las cabeceras que lleva TODA respuesta del API. */
function cabeceras(): Headers {
  const h = new Headers();
  h.set('content-type', 'application/json; charset=utf-8');
  // `no-store` y no `no-cache`: `no-cache` permite guardar y revalidar, `no-store` no
  // permite guardar. Con datos de inquilino la diferencia importa.
  h.set('cache-control', 'no-store');
  return h;
}

/** Una respuesta de éxito. */
export function ok(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras() });
}

/**
 * Un rechazo, con su código en el cuerpo.
 *
 * El campo se llama `codigo` porque así lo escribe el 03 § 5 (`{ codigo: "sin_sesion" }`).
 * `detalle` es opcional y **nunca** lleva nada que el cliente no deba saber: por qué falló
 * en detalle es información del servidor.
 */
export function rechazo(codigo: CodigoRechazo, detalle?: string): Response {
  return new Response(JSON.stringify(detalle ? { codigo, detalle } : { codigo }), {
    status: RECHAZOS[codigo],
    headers: cabeceras(),
  });
}
