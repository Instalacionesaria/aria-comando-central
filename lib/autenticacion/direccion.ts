// ADR-0402 — El freno por intentos no se evade.
//
// La dirección de origen de una petición. UN solo lugar la calcula.
//
// ═══════════════════════════════════════════════════════════════════════════════
// `X-Forwarded-For` ES UNA LISTA, Y EL CLIENTE CONTROLA EL PRINCIPIO
//
// El `08` § 5.4 nombra las dos consecuencias de tomar el primer valor, y **la segunda es
// peor que la primera**:
//
//   "· un atacante manda una dirección distinta en cada intento y EVADE EL FRENO POR
//      COMPLETO;
//    · un atacante manda la dirección de OTRA PERSONA y la deja bloqueada a voluntad."
//
// La segunda convierte una defensa en un arma: cualquiera puede bloquear a cualquiera.
//
// La solución que da el documento: *"tomar el valor que tu plataforma garantiza —la mayoría
// de los hostings agregan una cabecera propia con la dirección real, o documentan cuántos
// proxies confiables hay para contar desde el final de la lista— y no el primer elemento de
// la cadena."*
//
// ── POR QUÉ NO HAY RESPALDO IMPLÍCITO ───────────────────────────────────────
//
// Si esto devolviera `'desconocida'` cuando no encuentra la cabecera, **todas** las
// peticiones compartirían un solo contador y el freno por origen se convertiría en un
// interruptor global: veinte fallos de cualquiera bloquean a todo el mundo. Y al revés, si
// devolviera un valor distinto por petición, el freno no contaría nada.
//
// Devuelve `null`, y quien la usa decide. El freno por origen trata el `null` como "no
// puedo contar" y **falla abierto** a propósito (ver `freno.ts`).
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * El nombre de la cabecera que la plataforma garantiza.
 *
 * Se lee del entorno porque **depende de dónde esté desplegado**, y el `08` § 5.4 deja la
 * plataforma abierta a propósito. En Vercel es `x-real-ip`, que la plataforma pone y el
 * cliente no puede falsificar; detrás de otro proxy es otra.
 *
 * Sin la variable, `direccionDeOrigen` devuelve `null` y el freno por origen queda
 * desactivado **ruidosamente** —hay una prueba que lo afirma— en vez de contar sobre un
 * valor que el cliente controla, que sería peor que no contar.
 */
function cabeceraConfiable(): string | undefined {
  return process.env.CABECERA_DIRECCION_REAL;
}

/**
 * La dirección de origen de la petición, o `null` si no se puede determinar.
 *
 * **Nunca** lee `x-forwarded-for`. Ni el primer elemento ni el último: el último tampoco
 * sirve si no se sabe cuántos proxies confiables hay, y ese número es un dato de la
 * plataforma, no una suposición.
 */
export function direccionDeOrigen(peticion: Request): string | null {
  const cabecera = cabeceraConfiable();
  if (!cabecera) return null;
  const valor = peticion.headers.get(cabecera);
  if (!valor) return null;
  const limpio = valor.trim();
  // Aunque la cabecera confiable debería traer UN valor, si trajera una lista se toma el
  // último: es el que agregó el proxy más cercano al servidor, o sea el que el cliente no
  // pudo escribir.
  const partes = limpio.split(',');
  const ultimo = partes[partes.length - 1]?.trim();
  return ultimo && ultimo.length > 0 ? ultimo : null;
}
