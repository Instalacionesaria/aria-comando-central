// La cookie de sesión. UN solo lugar la escribe, y escribe los cuatro atributos SIEMPRE.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTO NO ES CEREMONIA: EL `DELETE` QUE RESPONDE 200 Y NO BORRA NADA
//
// El 08 § 5.2 elige el prefijo `__Host-` porque convierte cuatro disciplinas en una
// garantía del navegador: *"con ese prefijo, el navegador RECHAZA la cookie si no lleva
// `Secure`, si no tiene `Path=/`, o si declara `Domain`."*
//
// La trampa es que esa garantía es **del navegador, no del servidor**, y el serializador de
// cookies de esta versión de Next no la impone. Verificado en
// `node_modules/next/dist/compiled/@edge-runtime/cookies/index.js`:
//
//   · `normalizeCookie()` solo rellena `path`. No agrega `Secure`, ni `HttpOnly`, ni
//     `SameSite`.
//   · `ResponseCookies.delete(nombre)` hace `set({ name, value: "", expires: new Date(0) })`
//     — sin `Secure`.
//
// Consecuencia medible: `cookieStore.delete('__Host-sesion')` emite
// `Set-Cookie: __Host-sesion=; Path=/; Expires=Thu, 01 Jan 1970…`, **el navegador lo
// rechaza por no llevar `Secure`**, el endpoint responde 200 y la cookie sigue viva. Es
// exactamente la falla que el `02` § 5 (*"el `DELETE` borra la cookie siempre"*) existe para
// impedir, y una prueba que verifique "responde 200" no la ve.
//
// La misma trampa del otro lado, en el login: un `set(token, { httpOnly, sameSite, path })`
// sin `secure: true` hace que el navegador descarte la cookie en silencio, el login responda
// 200 con el cuerpo correcto, y el usuario vuelva a la pantalla de login. Y como los
// navegadores tratan `http://localhost` como origen seguro, **puede funcionar en desarrollo
// y fallar en producción**.
//
// Por eso acá no se usa la API de cookies del framework: se serializa la cabecera a mano,
// una sola vez, con los cuatro atributos escritos. No hay una segunda forma de hacerlo.
// ═══════════════════════════════════════════════════════════════════════════════

import { COOKIE_SESION } from './sesion.ts';

/**
 * La cabecera `Set-Cookie` de la sesión.
 *
 * Sin `Max-Age` ni `Expires` cuando `segundos` es `undefined`: el 08 § 5.2 escribe la cookie
 * como `__Host-sesion=<token>; Path=/; HttpOnly; Secure; SameSite=Lax`, sin plazo. Es una
 * cookie de sesión del navegador, y **el único reloj es el de la base**. Eso es lo que hace
 * que la ventana deslizante de `resolverSesion` no tenga que reemitir nada: no hay dos
 * plazos que puedan desincronizarse.
 *
 * @param valor    El token, o cadena vacía para borrarla.
 * @param segundos `0` para borrarla. `undefined` para una cookie de sesión sin plazo.
 */
export function serializarCookieSesion(valor: string, segundos?: number): string {
  const partes = [
    `${COOKIE_SESION}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  // NUNCA `Domain`: con el prefijo `__Host-` el navegador rechaza la cookie si lo declara.
  if (segundos !== undefined) partes.push(`Max-Age=${segundos}`);
  return partes.join('; ');
}

/**
 * La cabecera que **borra** la cookie.
 *
 * El 02 § 2 lo pide así: *"al borrarla, usá el mismo juego de atributos más `Max-Age=0`"*.
 * El mismo juego, no un subconjunto — es lo que la API del framework no hace.
 */
export function cookieSesionBorrada(): string {
  return serializarCookieSesion('', 0);
}
