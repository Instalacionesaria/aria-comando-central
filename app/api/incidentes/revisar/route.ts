// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Marcar un incidente como revisado, para que dos personas no miren lo mismo dos veces.
//
// La organización viaja en el cuerpo porque el panel mira a todas. Lo que lo autoriza es lo mismo
// que autoriza leerlas —`incidentes.revisar`, que solo tiene el superadministrador, y ser de la
// principal—, y la escritura pasa por el contexto de ESA organización, con su RLS.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { esDeLaPrincipal } from '../../../../lib/autorizacion/secciones.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { marcarRevisado } from '../../../../lib/incidentes/registro.ts';

export const PANTALLA = 'incidentes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['incidentes.revisar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  if (!esDeLaPrincipal(contexto)) {
    return rechazo('sin_permiso', 'El Panel de Incidentes es de la organización principal.');
  }

  let cuerpo: { orgId?: unknown; id?: unknown } | null;
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  const orgId = typeof cuerpo?.orgId === 'string' ? cuerpo.orgId : '';
  const id = typeof cuerpo?.id === 'string' ? cuerpo.id : '';
  if (!UUID.test(orgId) || !UUID.test(id)) {
    return rechazo('peticion_invalida', 'Falta la empresa o el incidente.');
  }

  const marcado = await conOrganizacion(orgId, () => marcarRevisado(id, contexto.usuarioId));
  if (!marcado) return rechazo('no_encontrado', 'Ese incidente no existe.');
  return ok({ revisado: true });
}
