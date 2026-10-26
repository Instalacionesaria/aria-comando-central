// Vive fuera de `proxy.ts` para que las pruebas la importen: el proxy importa `next/server`, que Node no resuelve fuera
// de Next.

/**
 * Las páginas que se ven SIN sesión además de la entrada (Meta directo, M6): las que Meta exige que estén abiertas a
 * cualquiera para aprobar la app —la política de privacidad, las condiciones, cómo pedir el borrado de los datos— y la
 * página que dice en qué quedó un borrado, a la que llega quien lo pidió con el código que le dio Meta.
 *
 * Son texto: ninguna lee la sesión ni datos de una empresa (la del borrado sólo busca un pedido por el hash de su
 * código). Una lista y no un prefijo suelto, para que agregar una sea una decisión: una pantalla de la aplicación que
 * cayera acá por error se vería sin entrar.
 */
export const CAMINOS_PUBLICOS: readonly string[] = ['/privacidad', '/terminos', '/borrado-de-datos', '/meta/borrado'];

/** Si un camino es una de las páginas públicas: ella misma o algo debajo, nunca un nombre que sólo empieza igual. */
export function esCaminoPublico(camino: string): boolean {
  return CAMINOS_PUBLICOS.some((c) => camino === c || camino.startsWith(`${c}/`));
}
