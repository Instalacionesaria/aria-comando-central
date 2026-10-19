// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0302 — El permiso se pregunta por CAPACIDAD, nunca por nombre de rol.
//
// El tablero de Negocios (el nivel 3): las empresas —nuestros clientes— y sus clientes, de un vistazo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUIÉN, EN QUÉ ORDEN, Y QUÉ SALE
//
// La ve el superadministrador (`negocios.ver`, que en el catálogo no tiene nadie más) y sólo desde la principal: mira a
// todas las empresas. La autorización es la del Panel de Incidentes. Después, dos lecturas en este orden:
//
//   1. la configuración y los nombres, en vivo, de identidad (`leerLaConfiguracion`: sólo presencias, nunca un valor
//      cifrado, y sin las organizaciones de control);
//   2. la última foto (`leerLaFoto`), en el contexto de la principal, que es su dueña (`089`).
//
// Las dos son lecturas: si la segunda falla no queda nada a medias. Y la respuesta es una lista blanca —la arma
// `armarElTablero`—: ningún token, ningún correo, ningún id del CRM.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad } from '../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { esDeLaPrincipal } from '../../../lib/autorizacion/secciones.ts';
import { leerLaConfiguracion } from '../../../lib/cartera/configuracion.ts';
import { leerLaFoto } from '../../../lib/cartera/lectura.ts';
import { armarElTablero } from '../../../lib/cartera/tablero.ts';

export const PANTALLA = 'negocios';

export const maxDuration = 60;

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['negocios.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  // Antes de abrir identidad: quien no es de la principal no llega a leer nada.
  if (!esDeLaPrincipal(contexto)) {
    return rechazo('sin_permiso', 'El tablero de Negocios es de la organización principal: mira a todas las empresas.');
  }

  const configuracion = await conIdentidad(leerLaConfiguracion);
  const foto = await conOrganizacion(contexto.orgEfectiva, leerLaFoto);
  return ok(armarElTablero(foto, configuracion, Date.now()));
}
