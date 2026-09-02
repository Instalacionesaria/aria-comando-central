// La travesía de Fundaciones: el ORDEN del método, y qué sigue después de cada entregable.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ARREGLA ESTO, Y POR QUÉ NO ES UNA COMODIDAD
//
// Llegó como un reclamo de Jorge: *«en su ARIA-brain, los pasos del 2 al 7 se ejecutaban solos o
// algo así»*. Se revisó el hub entero y **no existe ninguna ejecución automática**: `useRunTool`
// corre UNA herramienta y nadie la llama en bucle. Lo que sí existe allá y este port se dejó es la
// TRAVESÍA — la banda que aparece al terminar un entregable y dice qué se desbloqueó, qué va a
// heredar, y te lleva.
//
// Y el botón de esa banda lleva el rótulo de EJECUCIÓN de la herramienta siguiente («✨ Redactar mi
// VSL»), aunque solo navegue. Un botón que dice «Generar mi X», que aparece solo, y que te deja en
// una pantalla donde ya no hay nada que escribir porque todo se hereda, se recuerda perfectamente
// como «se ejecutaban solos». Ese es el origen del reclamo, y la respuesta no es automatizar la
// generación —eso gastaría la llave de IA sin que nadie lo pida— sino devolver la guía.
//
// ── EL ORDEN ES EL DEL MÉTODO, NO EL DE LOS IDENTIFICADORES NI EL DE LAS PESTAÑAS ──
//
// Es la misma lista que `FOUNDATIONS_JOURNEY` del hub, y está escrita literal por lo mismo que
// `IDS_FUNDACIONES`: que reordenarla sea una decisión y no un efecto de tocar otra cosa.
//
// ── Y CRUZA LAS DOS PANTALLAS ────────────────────────────────────────────────
//
// El VSL y la Landing se mudaron a `tools` (2026-08-31 y 2026-09-02), así que los dos últimos pasos
// del método viven en otra pantalla. La travesía los sigue nombrando: cortar en el Mapa dejaría la
// cadena muerta justo donde el método sigue, y quien la recorre no tiene por qué saber que hubo una
// mudanza. En qué pantalla vive cada uno NO se escribe acá: se deriva de los catálogos, así que la
// próxima mudanza no obliga a acordarse de este archivo.
// ═══════════════════════════════════════════════════════════════════════════════

import { FUNDACIONES, TODAS, herramienta, type Herramienta } from './herramientas.ts';

/** Las dos pantallas que tienen herramientas. */
export type PantallaDeHerramientas = 'icp' | 'tools';

/**
 * El orden del método. Nueve pasos.
 *
 * Perfil(0) → Research(1) → ICP(3) → Categoría(2) → Oferta(4) → Pricing(10) → Mapa(26) → VSL(5) →
 * Landing(6). El orden de los identificadores NO coincide, igual que en el hub.
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

/** Lo que sigue después de terminar una herramienta. */
export type Siguiente =
  | { tipo: 'paso'; herramienta: Herramienta; posicion: number; pantalla: PantallaDeHerramientas }
  /** Era el último: la travesía terminó. */
  | { tipo: 'final' }
  /** No está en la travesía —Prospección, el Espía— y por lo tanto no encadena con nada. */
  | { tipo: 'fuera' };

export function siguienteDeLaTravesia(id: number): Siguiente {
  const i = TRAVESIA.indexOf(id);
  if (i < 0) return { tipo: 'fuera' };
  if (i === TRAVESIA.length - 1) return { tipo: 'final' };

  const proximo = TRAVESIA[i + 1]!;
  const h = herramienta(proximo);
  /* Si el catálogo dejó de tener esa herramienta, la travesía se corta en silencio en vez de
     romper la pantalla. Es lo que ya pasó una vez con el VSL: estuvo fuera de los dos catálogos
     durante un cambio, y una lista literal que asume que existe habría reventado el panel. */
  if (!h) return { tipo: 'final' };

  return { tipo: 'paso', herramienta: h, posicion: i + 2, pantalla: pantallaDe(proximo) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EL DESTINO PENDIENTE: cómo se cruza de pantalla
//
// Dentro de una pantalla, navegar es `setActiva(id)` y no hace falta nada de esto. Cruzar a la otra
// son DOS cosas que ocurren en dos componentes distintos: abrir la vista —que la hace la capa
// imperativa del armazón, `irALaVista(`— y abrir la herramienta correcta dentro de ella, que la hace
// el `Fundaciones` que vive allá y que ni siquiera está montado cuando se aprieta el botón.
//
// Así que se deja el destino anotado y quien llega lo levanta. Se CONSUME al leerlo —una sola vez—
// porque un destino que quedara puesto haría que la próxima visita a esa pantalla saltara sola a una
// herramienta que nadie pidió, y eso es de los defectos que no se atribuyen nunca al botón que los
// causó.
// ═══════════════════════════════════════════════════════════════════════════════

let destinoPendiente: { pantalla: PantallaDeHerramientas; id: number } | null = null;

/** Anota a qué herramienta hay que abrir cuando se llegue a esa pantalla. */
export function anotarDestino(pantalla: PantallaDeHerramientas, id: number): void {
  destinoPendiente = { pantalla, id };
}

/** El destino anotado para esta pantalla, si lo hay. **Lo consume**: solo se sirve una vez. */
export function tomarDestino(pantalla: PantallaDeHerramientas): number | null {
  if (!destinoPendiente || destinoPendiente.pantalla !== pantalla) return null;
  const { id } = destinoPendiente;
  destinoPendiente = null;
  return id;
}

/** Para las pruebas: deja el buzón vacío. No lo usa la aplicación. */
export function olvidarDestino(): void {
  destinoPendiente = null;
}

/** Las herramientas de la travesía que existen en algún catálogo. Para las comprobaciones. */
export function pasosDeLaTravesia(): readonly Herramienta[] {
  return TRAVESIA.map((id) => TODAS.find((h) => h.id === id)).filter((h): h is Herramienta => !!h);
}
