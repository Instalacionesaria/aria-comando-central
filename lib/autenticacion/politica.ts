// La política de contraseñas. **Un solo número, en un solo lugar.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE, Y POR QUÉ NO IMPORTA NADA
//
// El largo mínimo estaba escrito dos veces: un `12` literal en
// `app/api/auth/sesion/route.ts` y un `MINIMO_PASSWORD = 12` en
// `app/entrar/page.tsx`. Dos copias del mismo número, en los dos lados de la red, es
// cómo se llega a un formulario que acepta una contraseña que el servidor rechaza —
// o peor, a uno que la rechaza cuando el servidor la habría aceptado, y nadie sabe
// por qué.
//
// No importa nada a propósito: lo consume una página con `'use client'`, así que un
// import de `node:crypto` o de la capa de datos lo arrastraría al paquete del
// navegador. Es el mismo motivo por el que `COOKIE_SESION` se mudó a
// `lib/autorizacion/cookie.ts`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL MÍNIMO ES 9, Y ES UNA DECISIÓN TOMADA A LA VISTA
//
// Era 12, sin ninguna justificación escrita y sin ninguna prueba que lo afirmara —
// un número mágico que se podía borrar sin que nada fallara. El `02` § 1 no fija un
// largo, y el manejador del cambio de contraseña lo dice: *"la política de
// contraseñas completa no está en la especificación y no se inventa"*.
//
// Se bajó a 9 a pedido explícito del dueño del sistema, para que las credenciales que
// ya usaba sigan sirviendo. **Lo que eso cuesta, dicho de frente y sin adornos:**
//
//   · Una contraseña de 9 caracteres con forma de "nombre + números" está en todo
//     diccionario de ataque. Contra un volcado de la tabla de hashes se rompe en
//     minutos, y eso vale también con `scrypt`: el algoritmo lento sube el costo por
//     intento, no la cantidad de intentos que hace falta.
//   · No afecta a los ataques EN LÍNEA, y eso es lo que hace tolerable la decisión:
//     el freno por cuenta corta a los cinco intentos fallidos y bloquea quince
//     minutos, y el freno por origen corta a los veinte. Adivinar por la puerta de
//     entrada sigue siendo impracticable.
//
// O sea: el riesgo que se acepta es el de un volcado de la base, no el de alguien
// probando contraseñas en el login. Y contra un volcado, el largo de la contraseña es
// la única defensa que queda.
//
// Si algún día se sube, subirlo acá alcanza — y las contraseñas viejas siguen
// funcionando, porque este número solo se comprueba al ELEGIR una nueva. `scrypt`
// guarda sus parámetros junto al hash (`lib/datos/hash.ts`), así que endurecer no
// invalida nada de lo guardado.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El largo mínimo de una contraseña elegida por una persona.
 *
 * Se comprueba en `POST /api/auth/sesion` —el servidor es la autoridad— y también en
 * la pantalla de entrada, que lo usa solo para evitar el viaje y poder decir qué
 * pasó: ese endpoint responde el rechazo con `motivo` y no con `codigo`, así que el
 * cliente HTTP lo colapsa y el motivo real no llega.
 *
 * NO se aplica a las contraseñas temporales que genera el sistema: `contrasenaTemporal()`
 * produce 14 caracteres con muestreo por rechazo, y ese largo lo fija el `05` § 3.
 */
export const MINIMO_PASSWORD = 9;

/**
 * Qué le falta a una contraseña nueva, o `null` si está bien. **El texto es el que se muestra.**
 *
 * ── POR QUÉ ACÁ Y NO EN CADA FORMULARIO ────────────────────────────────────
 *
 * Porque ahora hay DOS pantallas que eligen una contraseña, y por el mismo motivo por el que este
 * archivo existe: el número estaba escrito dos veces y la nota de arriba cuenta cómo se llega a
 * *«un formulario que acepta una contraseña que el servidor rechaza — o peor, a uno que la rechaza
 * cuando el servidor la habría aceptado, y nadie sabe por qué»*.
 *
 *   · `app/entrar/page.tsx`, cuando la sesión está en `debe_cambiar_password` — la única salida de
 *     ese estado;
 *   · el menú de la cuenta, donde cualquiera cambia la suya cuando quiere.
 *
 * Las dos comprobaciones viajaban juntas con sus dos mensajes, y copiarlas era copiar también la
 * redacción: dos pantallas diciendo lo mismo con palabras distintas sobre el mismo rechazo.
 *
 * ── LA COMPROBACIÓN QUE EL SERVIDOR **NO** PUEDE HACER ─────────────────────
 *
 * La igualdad de las dos copias. El endpoint recibe UNA sola contraseña nueva, así que la
 * confirmación es necesariamente del lado de la pantalla — y es la única de las dos que no tiene
 * una segunda línea de defensa. El largo lo vuelve a exigir el servidor.
 */
export function problemaDeLaNueva(nueva: string, repetida: string): string | null {
  if (nueva !== repetida) return 'Las dos contraseñas no coinciden.';
  if (nueva.length < MINIMO_PASSWORD) {
    return `La contraseña nueva necesita al menos ${MINIMO_PASSWORD} caracteres.`;
  }
  return null;
}

/**
 * Lo que pasa además de cambiar la contraseña, dicho ANTES de apretar el botón.
 *
 * `POST /api/auth/sesion` cierra **todas las demás sesiones** del usuario, y ese comentario explica
 * por qué: *«cambiar la contraseña es lo que hace alguien que sospecha que le entraron; dejar las
 * otras sesiones vivas lo volvería inútil»*.
 *
 * Es correcto y hay que anunciarlo, porque de lo contrario alguien la cambia en la computadora y se
 * encuentra afuera en el teléfono sin saber por qué — y lo va a leer como que la aplicación se
 * rompió, no como que hizo lo que pidió. El texto vive acá para que las dos pantallas lo digan
 * igual.
 */
export const AVISO_DE_OTRAS_SESIONES =
  'Al cambiarla, se cierran tus sesiones en los demás dispositivos. Esta no.';
