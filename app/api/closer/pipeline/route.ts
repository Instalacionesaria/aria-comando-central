// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// El Pipeline del closer: las siete columnas con sus contactos.
//
// `closer.ver` y no `contactos.ver`, por lo mismo que la lista de al lado: de esa línea depende que
// un closer vea su pestaña y no la del otro. Es una sub-pestaña de la MISMA pantalla que Inicio,
// Mi Día y Agenda, así que declara `PANTALLA = 'closer'` y pide el mismo conjunto — `ADR-0304`
// exige exactamente eso, y el defecto que previene es que una de las cuatro se vea vacía para
// alguien que ve las otras tres.
//
// Toda la clasificación vive en `lib/negocio/pipeline.ts` y `lib/negocio/etapas.ts`. Acá no hay ni
// una decisión de negocio: es el portero, el contexto de la organización, y la respuesta.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { pipelineDelCloser } from '../../../../lib/negocio/pipeline.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'closer';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['closer.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const pipeline = await conOrganizacion(contexto.orgEfectiva, () => pipelineDelCloser());
  return ok(pipeline);
}
