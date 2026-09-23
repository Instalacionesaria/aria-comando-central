// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
//
// Analizar UNA llamada guardada: la primera vez, reintentar una FAILED o reanalizar una DONE.
//
// ── POR QUÉ ESTA RUTA NO NOMBRA `conOrganizacion(` ────────────────────────────
//
// Es el patrón del Espía de Anuncios (`app/api/tools/espia/route.ts`): la ruta hace `conIdentidad(`
// solo para la llave, y el trabajo de negocio lo hace `lib/analizadores/pipeline.ts`, que abre sus
// propias transacciones CORTAS. Si la ruta abriera `conOrganizacion(` alrededor del análisis,
// retendría una conexión del agrupador durante los minutos que piensa el modelo — y además cruzaría
// los dos dominios en un solo archivo, sin atomicidad entre ellos (ADR-0209).

import { exigir } from '../../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../../lib/datos/capa.ts';
import { resolverLlaveDeIa } from '../../../../../../lib/credenciales/resolver.ts';
import { analizarLlamada, relojDe } from '../../../../../../lib/analizadores/pipeline.ts';
import { TIEMPO_DE_LA_RUTA_MS, UUID, respuestaDelRechazo } from '../../../../../../lib/analizadores/rutas.ts';

export const PANTALLA = 'analizadores';

/** Un análisis tarda minutos. La pantalla espera al menos esto (`espera` en `pedir`). */
export const maxDuration = 300;

/**
 * Pide `analizadores.editar` y no `.ver`: analizar **gasta la llave de IA de la empresa**. Mirar lo
 * ya analizado no cuesta nada; pedirle a Sonnet que juzgue una llamada, sí.
 */
export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/analizadores/llamadas/[id]/analizar'>,
): Promise<Response> {
  const reloj = relojDe(TIEMPO_DE_LA_RUTA_MS);
  const contexto = await exigir(peticion, ['analizadores.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  // La llave ANTES de nada: sin ella no se toca la llamada, y el rechazo dice qué cargar.
  const llave = await conIdentidad((db) => resolverLlaveDeIa(db, contexto.orgEfectiva));
  if (llave.tipo === 'falta') return rechazo(llave.que);

  const r = await analizarLlamada(contexto.orgEfectiva, id, llave.claveIa, reloj);
  if (r.tipo === 'rechazo') return respuestaDelRechazo(r.que);
  /* Un FAILED no es un rechazo de la petición: el análisis se intentó, se pagó o no, y el error
     quedó guardado en la llamada. Se devuelve con su estado para que la pantalla lo muestre. */
  return ok(r);
}
