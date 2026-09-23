// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0704 — Las respuestas de error no revelan estructura.
//
// Generar un entregable de Fundaciones. Es la operación que gasta dinero.
//
// El trabajo vive en `lib/fundaciones/operaciones.ts`, compartido con la pantalla `tools`, y ahí
// está escrito por qué esta operación es distinta a todas las demás. Acá se quedan la capacidad
// —`fundaciones.editar` y no `fundaciones.ver`: generar de nuevo no es la misma autoridad que
// leer— y la resolución de la llave de IA de la organización, que es lo que las pruebas leen.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAccesoAFundaciones } from '../../../../lib/credenciales/resolver.ts';
import { FUNDACIONES } from '../../../../lib/fundaciones/herramientas.ts';
import { generarElDocumento } from '../../../../lib/fundaciones/operaciones.ts';

export const PANTALLA = 'icp';

/** Una generación de 16.000 tokens tarda minutos. Ver la nota en `estado/route.ts`. */
/* Diez minutos, y no los cinco de por omisión. El paso 1 del Research —busca en la web y escribe
 * hasta 16.000 tokens— se pasó de los cuatro minutos dos veces contra una organización real el
 * 2026-09-23. El plan (Pro con Fluid Compute) admite hasta 800; el corte del cliente va 20 segundos
 * por debajo para que quede tiempo de GUARDAR la versión antes de responder. Ver
 * `ESPERA_DE_GENERACION_MS`. */
export const maxDuration = 600;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad(async (db) =>
    resolverAccesoAFundaciones(db, contexto.orgEfectiva),
  );
  if (acceso.tipo === 'falta') return rechazo(acceso.que);

  return generarElDocumento(peticion, acceso, FUNDACIONES);
}
