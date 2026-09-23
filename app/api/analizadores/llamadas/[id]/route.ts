// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0202 — Toda operación abre el contexto de su organización.
//
// Una llamada de los Analizadores: leerla, reencaminarla o borrarla.
//
// ── LEER PIDE `.ver`; CAMBIAR PIDE `.editar` ─────────────────────────────────
//
// ADR-0304: lo que modifica no se conforma con una capacidad de lectura. Reencaminar mueve la llamada
// a una cola que se paga, y borrar la saca para siempre —deja lápida—.

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../../lib/datos/contexto.ts';
import { borrarLlamada, leerDetalle, reencaminar } from '../../../../../lib/analizadores/datos.ts';
import { UUID, tipoDe } from '../../../../../lib/analizadores/rutas.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'analizadores';

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/analizadores/llamadas/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['analizadores.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const orgId = contexto.orgEfectiva;
  try {
    /* El detalle NO trae la transcripción, de ningún tipo: la evidencia viaja en el análisis con su
       cita, y el texto entero de una reunión interna (OTRO) no tiene por qué salir de la base. */
    const detalle = await conOrganizacion(orgId, () => leerDetalle(orgId, id));
    // Cero filas es 404 y cubre los dos casos: no existe, o es de otra empresa (`ADR-0501`).
    if (!detalle) return rechazo('no_encontrado');
    return ok(detalle);
  } catch (e) {
    console.error('analizadores: no se pudo leer el detalle', e);
    return rechazo('base_no_disponible');
  }
}

/** Reencaminar: `{ tipo: 'HT' | 'OB' | 'OTRO' }`. */
export async function PATCH(
  peticion: Request,
  ctx: RouteContext<'/api/analizadores/llamadas/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['analizadores.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  let cuerpo: { tipo?: unknown };
  try {
    cuerpo = (await peticion.json()) as { tipo?: unknown };
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON.');
  }
  const tipo = tipoDe(cuerpo?.tipo);
  if (tipo === null) return rechazo('peticion_invalida', 'El tipo tiene que ser HT, OB u OTRO.');

  const orgId = contexto.orgEfectiva;
  const r = await conOrganizacion(orgId, () => reencaminar(orgId, id, tipo));
  switch (r) {
    case 'hecho':
      return ok({ reencaminada: true, tipo });
    case 'no_encontrada':
      return rechazo('no_encontrado');
    case 'mismo_tipo':
      return rechazo('peticion_invalida', 'La llamada ya es de ese tipo.');
    case 'ya_analizada':
      /* El servidor lo impide aunque la pantalla no ofrezca el botón: una HT en DONE movida a OB
         quedaría PENDING con su informe de HT adentro, y la pestaña OB lo dibujaría como un
         onboarding. En el origen solo lo impedía la pantalla. */
      return rechazo('llamada_ya_analizada', 'Una llamada ya analizada no se puede mover de pestaña.');
    case 'en_curso':
      return rechazo('llamada_en_curso', 'Esta llamada se está analizando ahora. Esperá a que termine.');
  }
}

/** Borrar: la llamada se va con su transcripción, su análisis y su ficha, y deja lápida. */
export async function DELETE(
  peticion: Request,
  ctx: RouteContext<'/api/analizadores/llamadas/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['analizadores.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const orgId = contexto.orgEfectiva;
  const borrada = await conOrganizacion(orgId, () => borrarLlamada(orgId, id));
  if (!borrada) return rechazo('no_encontrado');
  return ok({ borrada: true });
}
