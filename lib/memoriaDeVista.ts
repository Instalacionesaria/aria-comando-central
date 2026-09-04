// Lo que la pantalla RECUERDA de cómo la dejaste: qué secciones estaban replegadas y dónde
// estaba el scroll de cada sub-pestaña. Acá está la parte que no sabe de React ni de la sesión.
//
// ══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTÁ PARTIDO EN DOS, IGUAL QUE `lecturas.ts` / `usarLectura.ts`
//
// Los hooks viven en `lib/usarMemoriaDeVista.ts`, y el motivo es el mismo que ya obligó a partir
// la memoria de lecturas: la sesión llega por un `.tsx`, Node no importa JSX, y con todo junto
// esto solo se podía comprobar **leyendo su código**.
//
// Y acá esa diferencia se paga sola, porque el defecto que importa es un `...` que falta:
//
//     guardar(clave, { [titulo]: ahora })            ← borra los otros pliegues
//     guardar(clave, { ...loGuardado, [titulo]: ahora })
//
// Se repliegan cuatro etapas, se repliega la quinta, y las cuatro primeras se abren solas. Una
// prueba que busque tres puntos en el código la satisface un comentario que los contenga —ya pasó
// cinco veces en este proyecto—; una que pliegue DOS secciones y mire la segunda, no.
//
// ────────────────────────── NO LLEVA `use client`, Y ESO ES A PROPÓSITO ──────────────────────────
//
// No guarda nada: son cuatro funciones que reciben un objeto y devuelven otro. La directiva en
// `lecturas.ts` está para eximir su `Map` del barrido de `ADR-0703`; ponerla donde no hay estado
// que eximir la convierte en decoración, y una exención decorativa es la que un día tapa un `Map`
// de verdad.
// ══════════════════════════════════════════════════════════════════════════════

/** Qué secciones están replegadas, por título. **Ausente = abierta.** */
export type Pliegues = Readonly<Record<string, boolean>>;

/** Dónde quedó el scroll de cada sub-pestaña, en píxeles. **Ausente = arriba.** */
export type Scrolls = Readonly<Record<string, number>>;

/**
 * ¿Esta sección está replegada?
 *
 * **Ausente significa abierta, y no es lo mismo que `false`.** Se pidió abiertas por omisión, así
 * que lo guardado lista solo las replegadas: con eso una sección nueva —una cola que se agregue,
 * una etapa del embudo— nace abierta sin que nadie tenga que acordarse de nada.
 */
export function estaPlegada(guardado: Pliegues | null, titulo: string): boolean {
  return guardado?.[titulo] === true;
}

/**
 * Lo guardado con UNA sección cambiada, y las demás intactas.
 *
 * Lo de «las demás intactas» es el motivo entero de que esta función exista en vez de armar el
 * objeto en el hook: sin copiar lo anterior, replegar una sección **abre todas las otras**.
 */
export function conPliegue(guardado: Pliegues | null, titulo: string, plegada: boolean): Pliegues {
  return { ...(guardado ?? {}), [titulo]: plegada };
}

/** Dónde quedó el scroll de esta sub-pestaña. Sin nada guardado, arriba. */
export function scrollDe(guardado: Scrolls | null, sub: string): number {
  return guardado?.[sub] ?? 0;
}

/** Lo guardado con UNA sub-pestaña cambiada. Mismo motivo que `conPliegue`. */
export function conScroll(guardado: Scrolls | null, sub: string, y: number): Scrolls {
  return { ...(guardado ?? {}), [sub]: y };
}
