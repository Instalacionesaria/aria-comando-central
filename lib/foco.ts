// El selector de cliente y el rótulo del foco (el nivel 3): cuándo se dibujan y qué dicen.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA, EN UN SOLO LUGAR
//
// Una empresa con varios clientes (las cuentas) puede mirar todos o enfocarse en uno, y un cliente final mira los
// suyos. Dos piezas de la pantalla dependen de eso —el selector junto al de la empresa, y el rótulo de la cabecera— y
// las dos leen esta regla, para no decidir cada una por su lado:
//
//   · el selector es un MENÚ con dos clientes o más; con uno solo, un cliente final ve su nombre como texto (es lo
//     que mira), y una empresa no ve nada (no hay entre qué elegir: es lo de siempre);
//   · el rótulo dice el cliente enfocado en las pantallas del cliente (Leads y Sales, las que el foco filtra), y
//     «Toda la empresa» en las demás: con un cliente enfocado, una pantalla que no lo filtra tiene que decirlo, o el
//     número parece del cliente y es de la empresa.
//
// Puras y sin React: las prueba la 269.
// ═══════════════════════════════════════════════════════════════════════════════

/** Las cuentas de la sesión, como llegan en `GET /api/auth/sesion`. */
export interface CuentasEnLaSesion {
  limitado: boolean;
  activa: string | null;
  visibles: readonly { id: string; nombre: string; estado: 'activa' | 'pausada' }[];
}

export type FormaDelSelector = 'oculto' | 'texto' | 'menu';

export function formaDelSelector(cuentas: CuentasEnLaSesion): FormaDelSelector {
  if (cuentas.visibles.length >= 2) return 'menu';
  if (cuentas.visibles.length === 1 && cuentas.limitado) return 'texto';
  return 'oculto';
}

/** Lo que dice el selector cerrado: el cliente enfocado, o todos. */
export function nombreDelFoco(cuentas: CuentasEnLaSesion): string {
  const enfocado = cuentas.visibles.find((c) => c.id === cuentas.activa);
  if (enfocado) return enfocado.nombre;
  if (cuentas.visibles.length === 1) return cuentas.visibles[0]!.nombre;
  return cuentas.limitado ? 'Todos tus clientes' : 'Todos los clientes';
}

/**
 * El rótulo de la cabecera, o `null` si no hay foco. `deUnCliente` = la pantalla filtra por el cliente enfocado.
 *
 * @param vista la pantalla abierta.
 * @param pantallasDelCliente las que el foco filtra; las manda la sesión (`SECCIONES_DEL_CLIENTE`).
 */
export function rotuloDelFoco(
  cuentas: CuentasEnLaSesion,
  vista: string | null,
  pantallasDelCliente: readonly string[],
): { texto: string; deUnCliente: boolean } | null {
  const enfocado = cuentas.visibles.find((c) => c.id === cuentas.activa);
  if (!enfocado) return null;
  if (vista !== null && pantallasDelCliente.includes(vista)) return { texto: enfocado.nombre, deUnCliente: true };
  // El cliente final sólo llega a sus pantallas: el rótulo de la empresa no es para él.
  return cuentas.limitado ? null : { texto: 'Toda la empresa', deUnCliente: false };
}
