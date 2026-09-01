'use client';

// Cerrar un desplegable: con un clic afuera y con `Escape`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SE EXTRAE EN LA TERCERA COPIA, Y LAS DOS QUE HABÍA ERAN IDÉNTICAS
//
// `MenuDeUsuario` y `SelectorDeEmpresa` tenían este mismo efecto letra por letra, con el mismo
// comentario al lado: *«las dos, porque un desplegable que solo cierra con un clic exacto queda
// abierto tapando el menú»*.
//
// El menú de links de pago del compositor era la tercera. Copiarlo otra vez es lo que hace que la
// cuarta se olvide de `Escape` —o del `removeEventListener`, que deja un oyente por cada apertura—
// y que nadie lo note: las dos mitades fallan de forma tan silenciosa como se puede.
//
// ── LAS DOS COSAS QUE HAY QUE HACER BIEN ──────────────────────────────────
//
//   · **Los oyentes se sueltan.** El `return` del efecto los quita, y el efecto solo se registra
//     con el menú abierto: cerrado no hay nada escuchando clics de toda la página.
//   · **`Escape` además de el clic.** Un desplegable que solo cierra con un clic en el lugar
//     exacto se queda abierto tapando lo que hay debajo, y con el teclado no hay forma de salir.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';

/**
 * Cierra el desplegable al hacer clic fuera de `caja` o al apretar `Escape`.
 *
 * @param abierto  si está desplegado. Con `false` no se registra ningún oyente.
 * @param caja     la referencia al envoltorio: un clic ADENTRO no cierra.
 * @param cerrar   qué hacer. Se llama sin argumentos.
 */
export function usarCierreDeMenu(
  abierto: boolean,
  caja: { current: HTMLElement | null },
  cerrar: () => void,
): void {
  useEffect(() => {
    if (!abierto) return undefined;

    const afuera = (e: MouseEvent): void => {
      /* `contains` y no una comparación con el disparador: adentro del desplegable hay botones, y
         cerrarlo antes de que su propio `onClick` corra haría que elegir una opción no hiciera
         nada. Es el defecto clásico de esta función. */
      if (caja.current && !caja.current.contains(e.target as Node)) cerrar();
    };
    const escape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cerrar();
    };

    document.addEventListener('click', afuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', afuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto, caja, cerrar]);
}
