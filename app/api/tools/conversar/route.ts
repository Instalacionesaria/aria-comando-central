// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0704 — Las respuestas de error no revelan estructura.
//
// Un turno de la conversación con el agente de una herramienta de `tools`. **También gasta dinero.**
//
// Es la gemela de `app/api/fundaciones/conversar/route.ts`, y existe por lo mismo que existen las
// otras dos parejas: `tools.editar` y `fundaciones.editar` son capacidades DISTINTAS a propósito, y
// una sola ruta compartida haría que quien puede conversar en una pantalla conversara —y generara—
// en la otra. El trabajo es el mismo y vive en `lib/fundaciones/operaciones.ts`; lo que cambia es la
// capacidad y la lista de herramientas admitidas, que también es un filtro de seguridad.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAccesoAFundaciones } from '../../../../lib/credenciales/resolver.ts';
import { TOOLS } from '../../../../lib/fundaciones/herramientas.ts';
import { conversarConElAgente } from '../../../../lib/fundaciones/operaciones.ts';

export const PANTALLA = 'tools';

/** Ver la nota de la ruta gemela: cada turno lee las seis llaves del almacén antes de responder. */
export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad(async (db) =>
    resolverAccesoAFundaciones(db, contexto.orgEfectiva),
  );
  if (acceso.tipo === 'falta') return rechazo(acceso.que);

  return conversarConElAgente(peticion, acceso, TOOLS);
}
