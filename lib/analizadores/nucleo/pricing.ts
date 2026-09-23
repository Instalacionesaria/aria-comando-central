// Costo de un análisis en USD. Portado de aria-ia-brain `lib/analyzer/pricing.ts` y REESCRITO: de
// aquel archivo queda la firma de la idea, no los números.
//
// ── POR QUÉ LA TABLA ESTÁ VACÍA ─────────────────────────────────────────────
//
// La única fuente de precio de Sonnet 5 que había era un comentario del origen: «$2/$10 hasta
// 31/08/2026; luego sube a $3/$15», y su tabla seguía en $2/$10 pasada esa fecha. Nadie lo verificó
// contra la facturación. Copiarla publicaba un costo plausible y falso en cada análisis, sin que nada
// fallara.
//
// Así que acá **solo entra una tarifa confirmada**, y sin ella el costo es `null` —nunca `0`: un cero
// dice «este análisis no costó nada»—. Los tokens se guardan igual, así que el día que se confirme el
// costo se puede calcular hacia atrás.
//
// ── Y POR QUÉ SON CUATRO PRECIOS Y NO DOS ───────────────────────────────────
//
// El sistema del análisis se marca para cachear (`cache_control`), y el origen sumaba solo la
// entrada y la salida: la escritura y la lectura del caché se cobran aparte y **no aparecían en
// ningún lado**. Los cuatro van explícitos, sin multiplicadores derivados, para que confirmar la
// tarifa sea confirmar los cuatro números.

/** USD por millón de tokens, de cada uno de los cuatro contadores que devuelve Anthropic. */
export interface TokenRate {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** Los cuatro contadores de `usage`, ya con cero donde el proveedor no mandó el campo. */
export interface TokenUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/**
 * Las tarifas CONFIRMADAS contra la facturación de Anthropic, por modelo. Vacía hasta que alguien
 * confirme una: ver la cabecera.
 */
export const CONFIRMED_RATES: Readonly<Record<string, TokenRate>> = {};

export function computeCostUsd(
  model: string | null | undefined,
  usage: TokenUsage | null | undefined,
  rates: Readonly<Record<string, TokenRate>> = CONFIRMED_RATES,
): number | null {
  const rate = model ? rates[model] : undefined;
  if (!rate || !usage) return null;
  return (
    (usage.input * rate.input +
      usage.output * rate.output +
      usage.cacheWrite * rate.cacheWrite +
      usage.cacheRead * rate.cacheRead) /
    1_000_000
  );
}
