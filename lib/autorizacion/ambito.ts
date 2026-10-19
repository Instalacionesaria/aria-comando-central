// El ámbito de una petición: qué cuentas lee, y si ve la organización entera.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA (el nivel 3, 2026-10-18)
//
// `conOrganizacion` recibe un ámbito (`lib/datos/contexto.ts`), y la base filtra con él. Esta función lo arma desde la
// sesión y la pantalla, en un solo lugar:
//
//   · el CLIENTE FINAL lee sólo sus cuentas (o la que tenga enfocada), sin la organización entera, y sólo en sus
//     pantallas: en cualquier otra esto LANZA, porque el portero tendría que haberlo rechazado antes;
//   · la EMPRESA con un cliente enfocado lo lee sólo en las pantallas del cliente (Leads y Sales). En las demás sigue
//     viendo la empresa entera: leen configuración que es de la empresa (las comisiones, el closer asignado), y con
//     el foco se verían vacías;
//   · todo lo demás, la organización entera con todas sus cuentas: lo de siempre.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Ambito } from '../datos/contexto.ts';
import { esPantallaDelCliente } from './cliente.ts';
import type { Pantalla } from './secciones.ts';
import type { Contexto } from './sesion.ts';

export function ambitoDe(contexto: Contexto, pantalla: Pantalla): Ambito {
  const { cuentas, orgEfectiva: orgId } = contexto;
  const delCliente = esPantallaDelCliente(pantalla);
  if (cuentas.limitado) {
    if (!delCliente) {
      throw new Error(`ambitoDe: el cliente final no tiene ámbito en «${pantalla}»; el portero tendría que haberlo rechazado`);
    }
    // Sin cuentas, la lista va vacía y `conOrganizacion` lanza: el portero ya respondió `sin_cuentas` antes.
    const lista = cuentas.activa !== null ? [cuentas.activa] : cuentas.visibles.map((c) => c.id);
    return { orgId, todaLaOrganizacion: false, cuentas: lista };
  }
  if (delCliente && cuentas.activa !== null) return { orgId, todaLaOrganizacion: true, cuentas: [cuentas.activa] };
  return { orgId, todaLaOrganizacion: true, cuentas: '*' };
}

/**
 * La zona horaria de esa lectura: la del cliente, si el ámbito es uno solo; si no, la de la organización. Cada cliente
 * define el «día» de sus hechos (`identidad.cuentas.zona_horaria`).
 */
export function zonaDe(contexto: Contexto, pantalla: Pantalla): string {
  const { cuentas } = ambitoDe(contexto, pantalla);
  if (cuentas !== '*' && cuentas.length === 1) {
    const una = contexto.cuentas.visibles.find((c) => c.id === cuentas[0]);
    if (una) return una.zonaHoraria;
  }
  return contexto.organizacion.zonaHoraria;
}

/** Un cliente que una ruta manual trae del CRM: uno de los que la sesión ve. */
export interface ClienteQueSeTrae {
  id: string;
  nombre: string;
  esPorOmision: boolean;
}

/**
 * Los clientes que una ruta manual trae del CRM (el nivel 3, G4): los ACTIVOS que la pantalla de la ruta LEE, en el
 * orden de la sesión (el principal primero). Va acá y no en `lib/negocio` porque, como `ambitoDe`, sale de la sesión y
 * de la pantalla.
 *
 * Lo que la pantalla lee lo decide `ambitoDe`, así que el foco sólo cuenta en las pantallas del cliente: el Closer y el
 * Setter son de la empresa entera aunque haya foco, y traer sólo al enfocado dejaría el aviso de la agenda prendido
 * por los demás. Uno en pausa no se trae: el cron tampoco lo barre. Con el foco en uno en pausa (o un cliente final
 * con todos los suyos en pausa) la lista sale VACÍA, y lo responde la ruta.
 *
 * El cliente final no llega a las rutas de hoy (paso 3b del portero); si llegara por una pantalla suya, `ambitoDe` lo
 * acota a sus cuentas.
 */
export function clientesQueTrae(contexto: Contexto, pantalla: Pantalla): ClienteQueSeTrae[] {
  const { cuentas } = ambitoDe(contexto, pantalla);
  const lista = contexto.cuentas.visibles
    .filter((c) => c.estado === 'activa' && (cuentas === '*' || cuentas.includes(c.id)))
    .map(({ id, nombre, esPorOmision }) => ({ id, nombre, esPorOmision }));
  // Con la empresa entera, el principal está siempre a la vista y activo (la 085): sin él, un invariante roto.
  if (cuentas === '*' && !lista.some((c) => c.esPorOmision)) {
    throw new Error(`clientesQueTrae: la empresa ${contexto.orgEfectiva} no tiene su principal activo a la vista`);
  }
  return lista;
}
