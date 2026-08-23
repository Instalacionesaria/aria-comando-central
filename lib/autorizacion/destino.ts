// A dónde se puede redirigir después de entrar. **Solo el mismo origen.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES UN MÓDULO Y NO UNA FUNCIÓN DENTRO DE LA PANTALLA
//
// Nació adentro de `app/entrar/page.tsx`, y ahí no se podía probar: ese archivo lleva
// `'use client'`, importa React y una hoja de estilos, así que una prueba de Node que lo
// importe muere en el `import './entrar.css'`.
//
// Y eso importaba, porque la primera versión de esta función **tenía un agujero** y ninguna
// prueba lo habría visto. Una función de seguridad que no se puede probar donde vive es una
// función de seguridad sin pruebas.
//
// Acá no importa nada. Se prueba con `node --test` y sin base de datos.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El camino interno al que se puede navegar, o `/`.
 *
 * El proxy manda `?volver=` con el camino que el visitante pidió antes de que lo mandaran a la
 * entrada. Pero un parámetro de consulta lo controla quien arma el enlace: sin esta
 * validación, un `?volver=https://sitio-falso` convierte la pantalla de login en un
 * **redirector abierto** — la forma clásica de usar el login de alguien como trampolín de
 * phishing. El usuario ve el dominio real en la barra, entra, y aterriza en una copia que le
 * dice "tu sesión venció, volvé a entrar".
 *
 * ── POR QUÉ SE NORMALIZA CON EL PARSER Y NO SE MIRAN PREFIJOS ────────────────
 *
 * La primera versión comprobaba prefijos sobre el texto: que empiece con UNA barra, y que lo
 * que sigue no sea otra barra ni una contrabarra. Eso tapa `//evil.com` y `/\evil.com`, y
 * **deja pasar cuatro variantes**. Medido con el parser de referencia, no supuesto:
 *
 *     /%09/evil.com   →  "/<TAB>/evil.com"   →  https://evil.com/
 *     /%0A/evil.com   →  "/<LF>/evil.com"    →  https://evil.com/
 *     /%0D/evil.com   →  "/<CR>/evil.com"    →  https://evil.com/
 *     /%09\evil.com   →  "/<TAB>\evil.com"   →  https://evil.com/
 *
 * La cadena llega decodificada —`URLSearchParams.get()` lo hace—, así que el segundo carácter
 * es un tab y las tres guardas pasan. Y después **el parser del navegador borra todo tab y
 * salto de línea ASCII antes de resolver**: es el primer paso del algoritmo del estándar. Lo
 * que queda es `//evil.com`.
 *
 * La lección no es "faltaban tres caracteres en la lista negra". Es que validar por prefijos
 * decide sobre un texto que **no es** el que el navegador va a resolver. Normalizar con el
 * mismo parser y comparar el origen decide sobre la cosa real, y cierra también las variantes
 * que a nadie se le ocurrieron.
 *
 * Y la salida se reconstruye desde el resultado (`pathname + search + hash`) en vez de
 * devolver la entrada: así lo que se navega es exactamente lo que se validó, carácter por
 * carácter.
 *
 * @param bruto  El valor de `?volver=`, ya decodificado. `null` y vacío dan `/`.
 * @param origen El origen propio, `window.location.origin`. Se pasa en vez de leerlo adentro
 *   para que esto se pueda probar sin un navegador.
 */
export function destinoSeguro(bruto: string | null | undefined, origen: string): string {
  if (!bruto) return '/';
  try {
    const u = new URL(bruto, origen);
    // La comparación es por ORIGEN y no por anfitrión: un `https://` contra un `http://` del
    // mismo anfitrión son orígenes distintos, y degradar el esquema es la mitad de un ataque
    // de intermediario.
    if (u.origin !== origen) return '/';
    return u.pathname + u.search + u.hash;
  } catch {
    // Una entrada que el parser no entiende no se navega. Falla al lugar seguro.
    return '/';
  }
}
