// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0202 — Toda consulta de negocio corre dentro del contexto de su organización.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// En qué paso quedó «Construir el método» de la organización: leerlo al volver a ICP & Oferta, y
// guardarlo en cada paso de la cadena. Ver `lib/fundaciones/cadena.ts`.
//
// Leer pide `fundaciones.ver`, como el resto de la pantalla. Guardar pide `fundaciones.editar`: lo
// escribe la cadena, que solo corre con permiso de generar.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { leerRegistro } from '../../../../lib/fundaciones/cadena.ts';
import { guardarCadena, leerCadena } from '../../../../lib/fundaciones/cadena-almacen.ts';

export const PANTALLA = 'icp';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  // La organización sale del portero, nunca del navegador.
  const orgId = contexto.orgEfectiva;
  try {
    return await conOrganizacion(orgId, async () => ok(await leerCadena(orgId)));
  } catch (e) {
    console.error('[fundaciones/cadena] no se pudo leer la cadena:', e);
    return rechazo('base_no_disponible', 'No se pudo leer en qué paso quedó la cadena');
  }
}

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: { registro?: unknown };
  try {
    cuerpo = (await peticion.json()) as { registro?: unknown };
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON');
  }
  // `null` borra (la cadena terminó o la persona la cerró). Cualquier otra cosa tiene que ser un
  // registro legible: no se escribe lo que después no se podría leer.
  const registro = cuerpo.registro === null ? null : leerRegistro(cuerpo.registro);
  if (cuerpo.registro !== null && registro === null) {
    return rechazo('peticion_invalida', 'El estado de la cadena no tiene la forma esperada');
  }

  const orgId = contexto.orgEfectiva;
  try {
    return await conOrganizacion(orgId, async () => {
      await guardarCadena(orgId, registro);
      return ok({ guardado: true });
    });
  } catch (e) {
    console.error('[fundaciones/cadena] no se pudo guardar la cadena:', e);
    return rechazo('base_no_disponible', 'No se pudo guardar en qué paso quedó la cadena');
  }
}
