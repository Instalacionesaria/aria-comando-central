// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0704 — Las respuestas de error no revelan estructura.
//
// Un turno de la conversación con el agente de una herramienta. **También gasta dinero.**
//
// Es la hermana de `generar/route.ts` y pide lo mismo que ella —`fundaciones.editar` y la llave de
// IA de la organización—, y por el mismo motivo: cada turno es una inferencia. Que el resultado sea
// una pregunta en vez de un documento no lo hace más barato ni menos autoridad.
//
// ── POR QUÉ NO ES UN MÉTODO MÁS DE `generar` ────────────────────────────────
//
// Porque son dos operaciones con dos formas de respuesta y dos maneras de fallar, y meterlas en el
// mismo manejador obligaría a ramificar por el cuerpo de la petición — que es exactamente donde el
// portero deja de poder auditarse de un vistazo. El trabajo, como en las otras tres, vive en
// `lib/fundaciones/operaciones.ts`; acá se quedan la capacidad y la resolución de la llave.
//
// Y tiene gemela en `tools` —`app/api/tools/conversar/route.ts`—, con la misma forma que las otras
// dos parejas: el trabajo es uno y las rutas son dos, porque `tools.editar` y `fundaciones.editar`
// son capacidades distintas y una ruta pertenece a UNA pantalla.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { resolverAccesoAFundaciones } from '../../../../lib/credenciales/resolver.ts';
import { FUNDACIONES } from '../../../../lib/fundaciones/herramientas.ts';
import { conversarConElAgente } from '../../../../lib/fundaciones/operaciones.ts';

export const PANTALLA = 'icp';

/**
 * Un turno tarda segundos, no minutos: no hay búsqueda web y el techo de tokens es chico.
 *
 * Se declara igual, y con el mismo valor que las otras dos, por lo que dice `estado/route.ts`: el
 * valor por omisión de la plataforma corta antes de que termine la lectura del almacén, que acá
 * también ocurre —cada turno lee las seis llaves— y el síntoma sería *"a veces no contesta"*.
 */
export const maxDuration = 300;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const acceso = await conIdentidad(async (db) =>
    resolverAccesoAFundaciones(db, contexto.orgEfectiva),
  );
  if (acceso.tipo === 'falta') return rechazo(acceso.que);

  return conversarConElAgente(peticion, acceso, FUNDACIONES);
}
