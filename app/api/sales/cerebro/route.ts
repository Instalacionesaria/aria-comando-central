// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// El cerebro en la caja del pie de Sales (AG6 de los agentes, `docs/OTROS/agentes/03-EL-CEREBRO.md`,
// AG-40): preguntar con el contexto de esta pantalla, ver los hilos propios de esta sección y borrarlos.
//
// El GET pide `tablero.ver`, la capacidad de la sección, como las demás lecturas de esta pantalla; el POST
// y el DELETE, `cerebro.usar`. El portero aplica el alcance solo, con la `PANTALLA`: a quien no tiene
// concedida esta pestaña lo niega con `seccion_no_concedida`.
//
// La identidad se abre acá con `conIdentidad` (`identidadDelCerebro`: la llave y, al preguntar, lo que
// ciertas herramientas necesitan) y viaja como dato; lo de negocio va en transacciones cortas. Qué queda a
// medias si la segunda mitad falla: nada que dure. La identidad sólo se lee —salvo el registro de una
// credencial ilegible, que es de su resolvedor—, y una pregunta que no llega a respuesta queda `fallida`
// (`lib/agentes/executive/preguntar.ts`). Lo que comparten las rutas del cerebro está en
// `lib/agentes/executive/caja.ts`.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { borrarHilo } from '../../../../lib/agentes/executive/conversaciones.ts';
import {
  UUID,
  hiloPedido,
  identidadDelCerebro,
  laPregunta,
  leerLaPregunta,
  loDelPanel,
  respuestaDePreguntar,
  respuestaDelPanel,
} from '../../../../lib/agentes/executive/caja.ts';
import { preguntar } from '../../../../lib/agentes/executive/preguntar.ts';

export const PANTALLA = 'sales';

/** Una pregunta tarda hasta 240 s de modelo, más lo de antes y lo de después. */
export const maxDuration = 300;

/** El estado del cerebro y los hilos propios de esta sección; con `?hilo=`, los mensajes de uno. */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tablero.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const hilo = hiloPedido(peticion);
  if (hilo instanceof Response) return hilo;

  const { llave } = await conIdentidad((db) => identidadDelCerebro(db, contexto, false));
  const panel = await conOrganizacion(contexto.orgEfectiva, () => loDelPanel(contexto, PANTALLA, hilo));
  return respuestaDelPanel(contexto, llave, panel, hilo);
}

/** Preguntar desde la caja del pie: `{ pregunta, hilo?, periodo? }`, con el período que mira la pantalla. */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cerebro.usar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const leida = await leerLaPregunta(peticion, contexto);
  if (leida instanceof Response) return leida;

  const identidad = await conIdentidad((db) => identidadDelCerebro(db, contexto, true));
  const pregunta = laPregunta(contexto, identidad, leida, PANTALLA);
  if (pregunta instanceof Response) return pregunta;
  return respuestaDePreguntar(await preguntar(pregunta));
}

/** Borrar un hilo propio: `?hilo=`. Uno ajeno da 404, como uno que no existe. */
export async function DELETE(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cerebro.usar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const hilo = new URL(peticion.url).searchParams.get('hilo');
  if (hilo === null || !UUID.test(hilo)) return rechazo('no_encontrado');
  const borrado = await conOrganizacion(contexto.orgEfectiva, () => borrarHilo(contexto.usuarioId, hilo, PANTALLA));
  if (!borrado) return rechazo('no_encontrado');
  return ok({ borrado: true });
}
