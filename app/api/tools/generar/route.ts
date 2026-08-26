// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0704 — Las respuestas de error no revelan estructura.
//
// Generar el documento de una herramienta de `tools`. Gasta la llave de IA de la organización,
// igual que su gemela de Fundaciones.
//
// El trabajo vive en `lib/fundaciones/operaciones.ts`, compartido con la pantalla `tools`, y ahí
// está escrito por qué esta operación es distinta a todas las demás. Acá se quedan la capacidad
// —`tools.editar` y no `fundaciones.ver`: generar de nuevo no es la misma autoridad que
// leer— y la resolución de la llave de IA de la organización, que es lo que las pruebas leen.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAccesoAFundaciones } from '../../../../lib/credenciales/resolver.ts';
import { TOOLS } from '../../../../lib/fundaciones/herramientas.ts';
import { generarElDocumento } from '../../../../lib/fundaciones/operaciones.ts';

export const PANTALLA = 'tools';

/** Una generación de 16.000 tokens tarda minutos. Ver la nota en `estado/route.ts`. */
export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tools.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad(async (db) =>
    resolverAccesoAFundaciones(db, contexto.orgEfectiva),
  );
  if (acceso.tipo === 'falta') return rechazo(acceso.que);

  return generarElDocumento(peticion, acceso, TOOLS);
}
