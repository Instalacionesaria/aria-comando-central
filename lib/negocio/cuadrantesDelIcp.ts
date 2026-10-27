// Los cuadrantes del ICP: las cuatro palabras con las que el CRM clasifica a cada lead, y cómo se nombran acá.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE REEMPLAZA (decidido por el usuario el 2026-10-26, `docs/leads-portal/15-EL-CUADRANTE-DEL-ICP.md`)
//
// Hasta acá el ICP era un número de 0 a 100 («Puntaje | ICP») y `tramosDelIcp.ts` lo cortaba en 75 y 50. Ahora el CRM
// lo calcula de otra forma y manda una palabra en `contact.cuadrante_de_clasificacion`, que la sincronización guarda en
// `contactos.cuadrante` (la columna de la `084`, escrita desde la `105`). Ya no hay un corte que decidir acá: lo que
// este archivo agrega es lo que el CRM no dice —en qué orden se dibujan, cuál es el nivel de cada una, cuáles son
// calificados— y lo dice en UN lugar.
//
// Las cuatro claves son exactamente las de `catalogo.cuadrantes` (la `079`). Sin cuadrante es NULL, no una quinta
// clave: «Sin clasificar» (`sin_clasificar`) es sólo la seudoclave con que esta capa nombra el nulo. Si un día aparece
// en la columna una clave que no es de las cuatro, se cuenta como «Sin clasificar» (`claveDelCuadrante`) hasta que se
// decida cómo se dibuja.
//
//     Prioriza → nivel alto  ·  Valida y Financia → nivel medio  ·  Descarta → nivel bajo
//
// Calificados son las tres primeras. Descarta no lo es, y además **es un descarte** en toda la plataforma: lo mira
// `contactoDescartado` (`citasAlcanzables.ts`) junto a las etiquetas de descarte del CRM.
//
// El número viejo sigue en `contactos.score` y ninguna pantalla lo dibuja (decisión del mismo día).
//
// ── UNA SOLA NORMALIZACIÓN, EN LAS DOS CAPAS ────────────────────────────────
//
// El CRM manda la opción tal como está escrita en el campo («Prioriza»). Se guarda la CLAVE —minúscula, sin espacios a
// los costados, sin tilde—, y lo que no es ninguna de las cuatro se guarda como nulo. `cuadranteDeUnValor` lo hace en
// la sincronización y `cuadranteUsable` (`camposDelCrm.ts`) lo mismo en SQL, para el recálculo desde lo ya guardado:
// con dos reglas distintas, un mismo contacto quedaría clasificado por una vía y «Sin clasificar» por la otra. Por eso
// las dos usan los mismos caracteres (`ESPACIOS`, `CON_TILDE`/`SIN_TILDE`) y la prueba 310 las compara.
//
// ── ESTE ARCHIVO NO IMPORTA NADA ────────────────────────────────────────────
//
// Como `periodo.ts` y el `tramosDelIcp.ts` al que reemplaza: lo usan el servidor, para contar, y el navegador, para
// dibujar las tarjetas y filtrar la rejilla. Un import que llegue a la capa de datos mete el cliente de PostgreSQL en el
// paquete del navegador, y `next build` lo rechaza —ya pasó una vez con `DIAS_DE_TODO`—.
// ═══════════════════════════════════════════════════════════════════════════════

/** Las cuatro palabras, como las guarda `contactos.cuadrante`. */
export type Cuadrante = 'prioriza' | 'valida' | 'financia' | 'descarta';

/** Un cuadrante, o el contacto que no tiene ninguno. */
export type ClaveDeCuadrante = Cuadrante | 'sin_clasificar';

/** El nivel de un cuadrante. Valida y Financia comparten el medio: ninguna es mejor que la otra. */
export type NivelDelCuadrante = 'alto' | 'medio' | 'bajo';

/** Las cuatro, en el orden del CRM: de la mejor a la peor. Son las de `catalogo.cuadrantes`, la clave foránea de la `084`. */
export const LOS_CUATRO: readonly Cuadrante[] = ['prioriza', 'valida', 'financia', 'descarta'];

/** Los que son calificados: todos menos Descarta. */
export const CALIFICADOS: readonly Cuadrante[] = ['prioriza', 'valida', 'financia'];

export interface DefinicionDeCuadrante {
  clave: ClaveDeCuadrante;
  /** Lo mismo en la tarjeta, en el filtro, en el chip de la rejilla y en la ficha. */
  rotulo: string;
  /** `null` = Sin clasificar, que no tiene nivel. */
  nivel: NivelDelCuadrante | null;
}

/**
 * Los cinco, **en el orden en que se dibujan las tarjetas**: «Sin clasificar» primero y los otros del mejor al peor.
 * Es el orden que tenían los tramos, y se conserva fijo porque ordenar por volumen haría que la pantalla cambiara de
 * forma cada semana.
 *
 * Los rótulos son las palabras del CRM tal cual: es lo que el equipo ve en GoHighLevel y lo que se decidió en la
 * reunión. «Sin clasificar» y no «Sin calificar»: lo que falta es la clasificación, no un juicio sobre el lead.
 */
export const CUADRANTES: readonly DefinicionDeCuadrante[] = [
  { clave: 'sin_clasificar', rotulo: 'Sin clasificar', nivel: null },
  { clave: 'prioriza', rotulo: 'Prioriza', nivel: 'alto' },
  { clave: 'valida', rotulo: 'Valida', nivel: 'medio' },
  { clave: 'financia', rotulo: 'Financia', nivel: 'medio' },
  { clave: 'descarta', rotulo: 'Descarta', nivel: 'bajo' },
];

/** La tarjeta que suma a las otras. No es un cuadrante: no tiene clave de cuadrante. */
export const ROTULO_DE_TODOS = 'Todos';

/** Los espacios que se recortan a los costados. Los mismos en `cuadranteUsable` (SQL). */
export const ESPACIOS = ' \t\r\n';

/** Las vocales con tilde o diéresis, y su versión sin ella, posición por posición. Las mismas en `cuadranteUsable`. */
export const CON_TILDE = 'áéíóúüÁÉÍÓÚÜ';
export const SIN_TILDE = 'aeiouuAEIOUU';

function recortar(t: string): string {
  let i = 0;
  let j = t.length;
  while (i < j && ESPACIOS.includes(t.charAt(i))) i++;
  while (j > i && ESPACIOS.includes(t.charAt(j - 1))) j--;
  return t.slice(i, j);
}

function sinTildes(t: string): string {
  let salida = '';
  for (const ch of t) {
    const k = CON_TILDE.indexOf(ch);
    salida += k === -1 ? ch : SIN_TILDE[k];
  }
  return salida;
}

/**
 * La clave del cuadrante que trae un valor del CRM, o `null` si no es ninguna de las cuatro.
 *
 * Recorta, quita tildes y pasa a minúscula: «Prioriza», « prioriza » y «PRIORIZA» son la misma. Nada más: un
 * «Prioridad» —la opción del OTRO campo `contact.cuadrante`, que la subcuenta de ARIA también tiene— no es «Prioriza»,
 * y adivinarlo daría un lead clasificado por una pregunta que no es ésta. Un número o un arreglo tampoco es un
 * cuadrante.
 */
export function cuadranteDeUnValor(crudo: unknown): Cuadrante | null {
  if (typeof crudo !== 'string') return null;
  const clave = sinTildes(recortar(crudo)).toLowerCase();
  return (LOS_CUATRO as readonly string[]).includes(clave) ? (clave as Cuadrante) : null;
}

/** La clave para contar y filtrar: el cuadrante, o «Sin clasificar». `undefined` es el nulo de una fila sin la clave. */
export function claveDelCuadrante(cuadrante: string | null | undefined): ClaveDeCuadrante {
  return cuadrante !== null && cuadrante !== undefined && (LOS_CUATRO as readonly string[]).includes(cuadrante)
    ? (cuadrante as Cuadrante)
    : 'sin_clasificar';
}

/** Si un cuadrante es calificado: Prioriza, Valida o Financia. */
export function esCuadranteCalificado(cuadrante: string | null | undefined): boolean {
  return cuadrante !== null && cuadrante !== undefined && (CALIFICADOS as readonly string[]).includes(cuadrante);
}

/**
 * El rótulo de una clave. Con el tipo, toda clave está en `CUADRANTES`; el `?? clave` es para la que llega sin tipo,
 * desde el JSON de una respuesta: se dibuja la clave cruda antes que un hueco, y así se nota.
 */
export function rotuloDelCuadrante(clave: ClaveDeCuadrante): string {
  return CUADRANTES.find((c) => c.clave === clave)?.rotulo ?? clave;
}
