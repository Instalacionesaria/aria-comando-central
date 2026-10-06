// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// El cerebro en el Inicio: preguntar, ver los hilos propios y borrarlos (AG5 de los agentes,
// `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-40).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRIMERA OPERACIÓN DEL INICIO, Y LA BANDERA QUE BAJA
//
// `executive` era la última sección con `sinOperacionesTodavia` (`lib/autorizacion/secciones.ts`). Esta
// ruta y esa bandera se mueven juntas: el cable existe para que nadie le dé su primera operación a una
// pantalla sin enterarse.
//
// ── TRES CAPACIDADES, DOS PUERTAS ────────────────────────────────────────────
//
// El GET pide `tablero.ver`, la capacidad de la sección: mirar el Inicio. El POST y el DELETE piden
// `cerebro.usar`: preguntar gasta la llave de IA de la empresa. ADR-0304 compara sólo los GET con la
// capacidad de la sección, y `cerebro.usar` no es de lectura.
//
// ── IDENTIDAD ACÁ, NEGOCIO EN `lib/agentes/executive/` ───────────────────────
//
// La identidad se abre en este archivo con `conIdentidad` —la llave y, al preguntar, por qué el auditor no
// audita y el estado de las integraciones (`identidadDelCerebro`)— y viaja como dato: nada bajo
// `lib/agentes/` importa la conexión de identidad (prueba 207). Lo que es igual en esta ruta y en las de la
// caja del pie de cada sección vive en `lib/agentes/executive/caja.ts`. Qué queda a medias si la segunda
// mitad falla: la identidad sólo se LEE; lo de negocio lo escribe `preguntar` en transacciones cortas, y una
// pregunta que no llega a respuesta queda `fallida` —cuenta para el tope sólo si se pagó—. Si la función se
// corta antes de marcarla, su reserva vence sola a los diez minutos (`lib/agentes/executive/topes.ts`).
//
// Bajo delegación el cerebro no responde (`D-17`): lo rechaza este servidor, no sólo la pantalla.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { borrarHilo } from '../../../lib/agentes/executive/conversaciones.ts';
import {
  UUID,
  hiloPedido,
  identidadDelCerebro,
  laPregunta,
  leerLaPregunta,
  loDelPanel,
  respuestaDePreguntar,
  respuestaDelPanel,
  seccionesVisibles,
} from '../../../lib/agentes/executive/caja.ts';
import { preguntar } from '../../../lib/agentes/executive/preguntar.ts';
import { reunionParaUnaPersona } from '../../../lib/agentes/reunion/leer.ts';

export const PANTALLA = 'executive';

/** Una pregunta tarda hasta 240 s de modelo, más lo de antes y lo de después. */
export const maxDuration = 300;

/**
 * El estado del cerebro, los hilos propios y —con `?hilo=`— los mensajes de uno de ellos; sin `?hilo=`, la
 * Reunión de hoy como la ve esta persona (AG15, `04`, AG-73): sólo lee, así que se ve también sin llave,
 * sin `cerebro.usar` y bajo delegación (AG-79).
 */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tablero.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const hilo = hiloPedido(peticion);
  if (hilo instanceof Response) return hilo;

  const { llave } = await conIdentidad((db) => identidadDelCerebro(db, contexto, false));
  // Todos los hilos propios, de cualquier sección: el Inicio es donde se ven juntos.
  const visibles = seccionesVisibles(contexto).map((s) => s.clave);
  const { panel, reunion } = await conOrganizacion(contexto.orgEfectiva, async () => ({
    panel: await loDelPanel(contexto, null, hilo),
    reunion: hilo === null ? await reunionParaUnaPersona(visibles, contexto.organizacion.zonaHoraria) : undefined,
  }));
  return respuestaDelPanel(contexto, llave, panel, hilo, reunion === undefined ? {} : { reunion });
}

/** Preguntar: `{ pregunta, hilo?, periodo? }`. */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cerebro.usar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const leida = await leerLaPregunta(peticion, contexto);
  if (leida instanceof Response) return leida;

  const identidad = await conIdentidad((db) => identidadDelCerebro(db, contexto, true));
  const pregunta = laPregunta(contexto, identidad, leida, null);
  if (pregunta instanceof Response) return pregunta;
  return respuestaDePreguntar(await preguntar(pregunta));
}

/** Borrar un hilo propio: `?hilo=`. Uno ajeno da 404, como uno que no existe. */
export async function DELETE(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cerebro.usar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const hilo = new URL(peticion.url).searchParams.get('hilo');
  if (hilo === null || !UUID.test(hilo)) return rechazo('no_encontrado');
  const borrado = await conOrganizacion(contexto.orgEfectiva, () => borrarHilo(contexto.usuarioId, hilo));
  if (!borrado) return rechazo('no_encontrado');
  return ok({ borrado: true });
}
