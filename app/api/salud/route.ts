// ADR-0301 — Toda operación llama al portero. RUTA PÚBLICA declarada.
//
// La comprobación de salud. Es una de las dos únicas rutas públicas del sistema, y está
// nombrada en `pruebas/apoyo/autorizados.ts` (`RUTAS_PUBLICAS`).
//
// El 03 § 6 nombra "login, salud" como las públicas. `PRUEBAS.md` dice "login, salud,
// arranque", pero `EJECUCION` § 3 cerró que el arranque del primer administrador es un
// **script contra la base, no endpoint HTTP** — así que la lista tiene DOS entradas, no
// tres, y la comprobación de entradas muertas rompería con una tercera.
//
// NO TOCA LA BASE, y eso es la mitad del punto. Una comprobación de salud que consulta la
// base es un endpoint sin autenticar que puede agotar el agrupador de conexiones desde
// afuera. Esta responde con lo que el proceso ya sabe.

import { ok } from '../../../lib/autorizacion/respuesta.ts';

export async function GET(): Promise<Response> {
  return ok({ estado: 'vivo' });
}
