// El cliente final: lo único que alcanza.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUIÉN ES (el nivel 3, 2026-10-18)
//
// El nivel 3 son los clientes de cada empresa: las cuentas, una subcuenta del CRM cada una. El CLIENTE FINAL es una
// persona de una de esas cuentas, limitada a ellas (`identidad.usuarios.limitado_a_cuentas`). En la v1 mira sus leads
// y sus ventas, y nada más: ni el cerebro, ni Ajustes, ni las herramientas, ni la ficha de un contacto.
//
// La base ya le cierra todo lo que no es suyo (la `086`: `app.toda_la_organizacion = 'no'`). Esto cierra lo que la
// base no ve: las rutas que no leen filas de negocio, las capacidades que su rol traería y las pantallas del menú.
// Son tres listas cortas y escritas a mano a propósito —una pantalla más para el cliente final es una decisión, y
// tiene que quedar escrita acá con su prueba—, y las tres las mira la 264.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Ruta } from './estados.ts';
import { SIN_SECCION, type Pantalla } from './secciones.ts';

/**
 * Las pantallas que lee el cliente final. Son también las que la empresa puede enfocar en un cliente: en las demás el
 * foco no aplica, porque leen configuración de la empresa entera (las comisiones, el closer asignado).
 */
export const SECCIONES_DEL_CLIENTE: ReadonlySet<string> = new Set(['contacts', 'sales']);

/** Las capacidades que conserva, de las que su rol le dé. Sin `cerebro.usar`: el cerebro lo paga la empresa. */
export const CAPACIDADES_DEL_CLIENTE: ReadonlySet<string> = new Set(['tablero.ver']);

/** Por qué se rechaza un rol o unas pestañas para un cliente final. El alta y el cambio de rol dicen lo mismo. */
export const MOTIVOS_DEL_CLIENTE = {
  rol: 'Un cliente final tiene un rol restringido por pestañas y nada de la plataforma: el rol usuario.',
  secciones: 'Un cliente final sólo ve Leads y Sales.',
} as const;

/**
 * Las rutas sin pantalla que sí alcanza: las de su propia sesión (cambiar la contraseña temporal, el segundo
 * factor, el tema). Sin ellas, un cliente final en `debe_cambiar_password` quedaría encerrado.
 */
export const RUTAS_DEL_CLIENTE: readonly Ruta[] = [
  'POST /api/auth/sesion',
  'POST /api/auth/2fo/verificar',
  'POST /api/auth/2fo/configurar',
  'POST /api/auth/2fo/confirmar',
  'PUT /api/auth/tema',
  // Elegir cuál de sus cuentas mira, si tiene más de una.
  'PATCH /api/auth/cliente',
];

/** ¿Es una pantalla del cliente? La usa el menú, el portero y el ámbito de la transacción. */
export function esPantallaDelCliente(pantalla: Pantalla): boolean {
  return pantalla !== SIN_SECCION && SECCIONES_DEL_CLIENTE.has(pantalla);
}

/**
 * ¿Puede el cliente final hacer esta petición? Sus rutas de sesión siempre; las de sus pantallas, sólo si tiene
 * alguna cuenta. Todo lo demás, no, aunque su rol lo habilite.
 *
 * @returns `null` si pasa, o el código del rechazo.
 */
export function rechazoDelCliente(
  ruta: Ruta,
  pantalla: Pantalla,
  cuantasCuentas: number,
): 'fuera_de_su_cuenta' | 'sin_cuentas' | null {
  if (RUTAS_DEL_CLIENTE.includes(ruta)) return null;
  if (!esPantallaDelCliente(pantalla)) return 'fuera_de_su_cuenta';
  return cuantasCuentas > 0 ? null : 'sin_cuentas';
}
