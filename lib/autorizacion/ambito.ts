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
