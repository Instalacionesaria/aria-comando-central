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
