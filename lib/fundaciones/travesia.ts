// La travesía de Fundaciones: el ORDEN del método, y qué paso viene antes y después.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES ESTO
//
// Puerto de `lib/journey.ts` de ARIA-brain. Sirve a la barra del pie —«← Paso anterior», el
// indicador de progreso, «Continuar al paso N →»— que allá acompaña a cada herramienta del método
// y que acá faltaba: se terminaban los cinco pasos del Research y no había por dónde seguir.
//
// **Es navegación, no generación.** Allá tampoco genera: `StepNav` no toca la lógica de las
// herramientas, y acá menos todavía — cada generación gasta la llave de IA de la organización, así
// que una cadena que se dispara sola gastaría nueve porque alguien terminó la primera.
//
// ── EL ORDEN ES EL DEL MÉTODO, NO EL DE LOS IDENTIFICADORES NI EL DE LAS PESTAÑAS ──
//
// Escrito literal, por lo mismo que `IDS_FUNDACIONES`: que reordenarlo sea una decisión y no el
// efecto de haber tocado otra cosa.
// ═══════════════════════════════════════════════════════════════════════════════

import { FUNDACIONES, TODAS, herramienta, type Herramienta } from './herramientas.ts';

/** Las dos pantallas que tienen herramientas del método. */
export type PantallaDeHerramientas = 'icp' | 'tools';

/**
 * El orden del método. Nueve pasos.
 *
 * Perfil(0) → Research(1) → ICP(3) → Categoría(2) → Oferta(4) → Pricing(10) → Mapa(26) → VSL(5) →
 * Landing(6).
 */
export const TRAVESIA: readonly number[] = [0, 1, 3, 2, 4, 10, 26, 5, 6];

/** En qué pantalla vive una herramienta. Se DERIVA del catálogo, no se escribe. */
export function pantallaDe(id: number): PantallaDeHerramientas {
  return FUNDACIONES.some((h) => h.id === id) ? 'icp' : 'tools';
}

/** Qué número de paso es, contando desde 1. `0` si no está en la travesía. */
export function posicionEnLaTravesia(id: number): number {
  return TRAVESIA.indexOf(id) + 1;
}

/** Un vecino en la travesía: la herramienta, su número de paso y dónde vive. */
export interface Vecino {
  herramienta: Herramienta;
  posicion: number;
  pantalla: PantallaDeHerramientas;
}

function vecino(indice: number): Vecino | null {
  if (indice < 0 || indice >= TRAVESIA.length) return null;
  const id = TRAVESIA[indice]!;
  const h = herramienta(id);
  /* Si el catálogo dejó de tener esa herramienta, la barra la omite en vez de romper la pantalla.
     Ya pasó una vez: el VSL estuvo fuera de los dos catálogos durante una mudanza. */
  if (!h) return null;
  return { herramienta: h, posicion: indice + 1, pantalla: pantallaDe(id) };
}

/** El paso anterior, o `null` si es el primero. */
export function pasoAnterior(id: number): Vecino | null {
  const i = TRAVESIA.indexOf(id);
  return i <= 0 ? null : vecino(i - 1);
}

/** El paso siguiente, o `null` si es el último (o si la herramienta no está en la travesía). */
export function pasoSiguiente(id: number): Vecino | null {
  const i = TRAVESIA.indexOf(id);
  if (i < 0 || i === TRAVESIA.length - 1) return null;
  return vecino(i + 1);
}

/** Las herramientas de la travesía que existen en algún catálogo. Para las comprobaciones. */
export function pasosDeLaTravesia(): readonly Herramienta[] {
  return TRAVESIA.map((id) => TODAS.find((h) => h.id === id)).filter((h): h is Herramienta => !!h);
}
