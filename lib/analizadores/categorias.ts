// El juego cerrado de categorías de una objeción (`T-18`; `docs/OTROS/agentes/fichas/F14-LLAMADAS-DE-VENTA.md`).
// Aparte de `./objeciones.ts`, que llama al modelo: quien sólo cuenta (`lib/negocio/llamadasDeVenta.ts`) no
// arrastra el transporte ni el pipeline del analizador. Provisional: se puede cambiar sin rehacer nada, porque
// el texto de la objeción no se toca. El mismo juego que el `check` de la migración 073.

export const CATEGORIAS_DE_OBJECION = ['precio', 'momento', 'decisor', 'confianza', 'encaje', 'otra'] as const;
export type CategoriaDeObjecion = (typeof CATEGORIAS_DE_OBJECION)[number];
