// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
//
// Generar —o rehacer— la ficha del prospecto de una HT ya analizada.
//
// ── POR QUÉ ES UNA PETICIÓN APARTE DEL ANÁLISIS ─────────────────────────────
//
// En el origen la ficha se generaba a continuación del análisis, en la misma función: dos
// inferencias de minutos dentro de 300 s. Acá el análisis termina y contesta, y la pantalla pide la
// ficha enseguida con esta ruta. Si esta falla, la llamada sigue DONE con su análisis intacto y la
// ficha queda FAILED, que se rehace con este mismo botón. La tarea programada solo genera las que
// NUNCA se generaron: reintentar sola una FAILED repetiría el mismo fallo, pagando cada hora.
//
// Mismo patrón que `analizar/`: `conIdentidad(` solo para la llave, el trabajo en `lib/`.

import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { resolverLlaveDeIa } from '../../../../../../lib/credenciales/resolver.ts';
import { generarFicha, relojDe } from '../../../../../../lib/analizadores/pipeline.ts';
import { TIEMPO_DE_LA_RUTA_MS, UUID, respuestaDelRechazo } from '../../../../../../lib/analizadores/rutas.ts';

export const PANTALLA = 'analizadores';

export const maxDuration = 300;

/** Gasta la llave de IA, así que pide `.editar`. */
export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/analizadores/llamadas/[id]/ficha'>,
): Promise<Response> {
  const reloj = relojDe(TIEMPO_DE_LA_RUTA_MS);
  const contexto = await exigir(peticion, ['analizadores.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const llave = await conIdentidad((db) => resolverLlaveDeIa(db, contexto.orgEfectiva));
  if (llave.tipo === 'falta') return rechazo(llave.que);

  const r = await generarFicha(contexto.orgEfectiva, id, llave.claveIa, reloj);
  if (r.tipo === 'rechazo') return respuestaDelRechazo(r.que);
  // Una ficha FAILED se devuelve con su estado: el fallo quedó guardado en su fila, no es un rechazo.
  return ok(r);
}
