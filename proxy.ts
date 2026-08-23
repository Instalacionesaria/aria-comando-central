// La compuerta de rutas: sin cookie de sesión, no se ve la aplicación.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SE LLAMA `proxy.ts` Y NO `middleware.ts`
//
// En Next.js 16 el convenio `middleware.js` está **deprecado y renombrado**. Verificado en
// la documentación de la versión instalada, `node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/middleware.md`:
//
//   "The `middleware.js` file convention has been deprecated in Next.js 16 and renamed to
//    `proxy.js`. All functionality remains the same — only the file and export names have
//    changed."
//
// Escribirlo como `middleware.ts` no da error: **no corre**. Y lo que no corre acá es la
// única cosa que impide que un visitante sin sesión vea la aplicación entera, así que el
// modo de fallar es silencioso y total.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTO SOLO MIRA SI LA COOKIE EXISTE. NO LA VALIDA, Y NO PUEDE.
//
// La documentación de esta versión es explícita sobre por qué:
//
//   "Proxy is meant to be invoked separately of your render code and in optimized cases
//    deployed to your CDN for fast redirect/rewrite handling, you should not attempt
//    relying on shared modules or globals."
//
// O sea: puede correr en el borde, sin la capa de datos. No puede consultar
// `identidad.sesiones`, ni descifrar, ni resolver permisos. Un token vencido, revocado o
// inventado pasa por acá.
//
// **Eso no es un agujero, y es importante entender por qué.** Esta compuerta no es la
// autorización: la autorización es el portero (`lib/autorizacion/portero.ts`), que corre en
// CADA ruta de API, resuelve la sesión contra la base y valida capacidades y estado. Toda
// operación con datos pasa por ahí.
//
// Lo que esta compuerta compra es distinto y vale igual: que un visitante sin sesión reciba
// una redirección en vez del armazón de la aplicación. Sin ella, `/` devuelve el HTML del
// centro de mando —hoy con datos de maqueta, mañana con la forma de las pantallas reales— y
// recién el navegador descubre que no hay sesión. Es exactamente lo que pasa hoy en
// producción, y es la razón por la que se puede abrir la URL y ver todo.
//
// La regla que se sigue de eso: **nada sensible puede venir en el HTML de una página**. Los
// datos se piden por API, donde el portero decide. Una página que dibuje datos de inquilino
// en el servidor sin llamar al portero se saltearía todo el diseño, y esta compuerta no la
// salvaría.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// De `cookie.ts` y NO de `sesion.ts`, y es la diferencia entre un import de trece caracteres y
// arrastrar `pg` y el agrupador de conexiones a este archivo. Ver el comentario de `COOKIE_SESION`
// en `lib/autorizacion/cookie.ts`.
import { COOKIE_SESION } from './lib/autorizacion/cookie.ts';

/** La pantalla de entrada. Es la única página que se ve sin sesión. */
export const CAMINO_ENTRAR = '/entrar';

export function proxy(peticion: NextRequest): NextResponse {
  // `has()` y no `get()?.value`: alcanza con la presencia, y pedir el valor invitaría a
  // mirarlo. Acá no se puede validar nada, así que mejor que ni esté a mano.
  const hayCookie = peticion.cookies.has(COOKIE_SESION);

  const { pathname } = peticion.nextUrl;
  const enEntrar = pathname === CAMINO_ENTRAR || pathname.startsWith(`${CAMINO_ENTRAR}/`);

  // Sin cookie, a la entrada.
  if (!hayCookie && !enEntrar) {
    const destino = peticion.nextUrl.clone();
    destino.pathname = CAMINO_ENTRAR;
    // El camino pedido viaja para volver ahí después de entrar. Se guarda SOLO el camino y
    // nunca la URL completa: un `?volver=https://otro-sitio` convertiría la pantalla de
    // login en un redirector abierto, que es la forma clásica de usar el login de alguien
    // como trampolín de phishing. `app/entrar/page.tsx` además lo valida al usarlo.
    destino.search = pathname === '/' ? '' : `?volver=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(destino);
  }

  // CON cookie, la pantalla de entrada NO redirige a `/`.
  //
  // Es deliberado y es la mitad que se olvida. La cookie existe durante todo el flujo
  // restringido —contraseña temporal, alta y verificación del segundo factor— porque el
  // login la emite antes de que el estado sea `activa`. Un redirect de `/entrar` a `/` acá
  // mandaría a alguien a medio autenticar al centro de mando, donde toda llamada le
  // responde 403 y no tiene cómo volver a la única pantalla que lo puede sacar del estado.
  //
  // Un estado sin salida es una cuenta bloqueada que necesita a un administrador (03 § 5).
  // Quién ya terminó y está en `activa` lo decide `app/entrar/page.tsx`, que sí puede
  // preguntarle a la base por el estado.
  return NextResponse.next();
}

export const config = {
  // Todo menos las rutas de API, los artefactos del empaquetador y los archivos con
  // extensión.
  //
  // `api` está excluido a propósito y en los dos sentidos: las rutas de API tienen su propio
  // portero, que es la autorización de verdad — y si el proxy las redirigiera, el `POST` del
  // propio login recibiría un 307 a `/entrar` y nadie podría entrar nunca. Una compuerta que
  // se cierra sobre la puerta.
  //
  // La documentación de esta versión advierte que sin `matcher` el proxy corre en CADA
  // petición, *"including static files (`_next/static`), image optimizations
  // (`_next/image`), and assets in the `public/` folder"*, y que sin excluirlos *"auth logic
  // or redirects can unintentionally block CSS, JS, or images from loading"* — o sea la
  // pantalla de login sin hoja de estilos.
  // ── `api(?:/|$)` Y NO `api`, Y ES UN DEFECTO REAL AUNQUE HOY NO SE VEA ─────
  //
  // La primera versión excluía `api` a secas, o sea **por prefijo**. Medido compilando el
  // patrón: `/apis`, `/api-docs` y `/apifoo/bar` quedaban FUERA de la compuerta.
  //
  // Hoy no hay ninguna página con esos nombres, así que no hay agujero abierto — hay uno
  // esperando. El día que exista `app/apis/page.tsx`, esa pantalla se sirve sin pasar por acá y
  // nadie lo nota, porque el síntoma es "se ve sin sesión" y no un error. Lo mismo con
  // `favicon.ico`, que sin ancla excluía cualquier camino que empiece así.
  matcher: ['/((?!api(?:/|$)|_next/static/|_next/image|favicon\\.ico$|.*\\..*).*)'],
};
