// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// El Pipeline del Setter: su cartera de leads, repartida en las OCHO columnas de SU embudo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES EL GEMELO DE `/api/closer/pipeline`, Y DIFIERE EN DOS LÍNEAS
//
// El mismo argumento que ya escribió `app/api/setter/contactos/route.ts` sobre por qué no hay una
// sola ruta con `?territorio=`: **el navegador elegiría el territorio**. Acá el territorio se
// escribe en el servidor y no se lee de ninguna parte de la petición.
//
// Y la segunda línea que difiere es `conCongelados`. Un contacto congelado no está en NINGÚN
// territorio, así que si las dos carteras lo pidieran aparecería en las dos y se contaría dos
// veces — en contradicción con que los territorios sean excluyentes. El dueño es el Closer, que es
// donde ya se veía; el argumento completo está en `lib/negocio/pipeline.ts`.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { pipelineDe } from '../../../../lib/negocio/pipeline.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'setter';

/** El territorio, ESCRITO ACÁ. No sale de la petición ni del cuerpo. */
const TERRITORIO = 'setter' as const;

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['setter.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const pipeline = await conOrganizacion(contexto.orgEfectiva, () =>
    pipelineDe(TERRITORIO, { conCongelados: false }),
  );
  return ok(pipeline);
}
