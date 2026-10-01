// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// La pantalla de Acquisition: los tres funnels del prototipo, con los datos reales.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES LA PRIMERA OPERACIÓN DE SERVIDOR DE ESTA PANTALLA, Y ESO BAJA UN CABLE TRAMPA
//
// `acquisition` estaba declarada con `sinOperacionesTodavia: true` en
// `lib/autorizacion/secciones.ts`. Esa bandera dice «esta pantalla no llama a ninguna operación», y
// `ADR-0304` la verifica en las dos direcciones: con la bandera puesta, una ruta que declare
// `PANTALLA = 'acquisition'` es roja; sin la bandera, la ausencia de una ruta también.
//
// O sea que este archivo y esa bandera se mueven juntos, y eso es el diseño: el cable existe para
// que nadie le dé su primera operación a una pantalla sin enterarse.
//
// ── UNA SOLA LECTURA PARA TODA LA PANTALLA ────────────────────────────────
//
// Mismo argumento que `app/api/auditoria/route.ts`: las cinco cifras, las tarjetas y las tablas son
// una sola pantalla, y dibujarla a pedazos mostraría durante unos segundos totales que no suman lo que
// está abajo. Por eso todo sale de `embudosDeAcquisition`, con UNA ventana.
//
// ── LO QUE ESTA RUTA YA NO PUBLICA (AQ-4, 2026-09-30) ─────────────────────
//
// Publicaba además `costo` —la tabla por anuncio de `costoDelAnuncio`— y `calidad` —el monitor de
// atribución de `calidadDeLaAtribucion`—, que eran la pantalla anterior. La del prototipo no los
// dibuja (docs/acquisition/14, A14-15), y calcularlos en cada carga para nadie costaba dos lecturas.
// Con ellos se va el «Hoy» de dos significados de la misma respuesta: el monitor contaba 24 horas
// móviles por día, y los funnels, días de calendario (A14-10). `costoDelAnuncio` sigue vivo porque
// lo usa Creative; el monitor queda dormido, con sus pruebas, por decisión del usuario del
// 2026-09-30 (`docs/OTROS/futuro/monitor-de-atribucion.md`).
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';
import { embudosDeAcquisition } from '../../../lib/negocio/embudosDeAcquisition.ts';

export const PANTALLA = 'acquisition';

export async function GET(peticion: Request): Promise<Response> {
  /* La capacidad es `tablero.ver`, que es la que la sección ya declaraba. No se inventa una
     `anuncios.ver`: siete pantallas comparten `tablero.ver` y lo que las separa es el ALCANCE por
     persona, no la capacidad — está argumentado en `secciones.ts` y agregar un eje nuevo acá lo
     rompería para las otras seis. */
  const contexto = await exigir(peticion, ['tablero.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* El período se valida contra la lista y lo que no está se RECHAZA, no se corrige al valor por
     omisión. Pedir un período que no existe y recibir treinta días sin enterarse es el defecto que
     `periodo.ts` cierra: la cifra sale bien calculada sobre una ventana que nadie pidió. */
  const periodo = periodoDe(new URL(peticion.url).searchParams.get('periodo'));
  if (periodo === null) return rechazo('peticion_invalida', 'Ese período no existe.');

  /* No es una sola foto de las filas —la transacción es READ COMMITTED y cada sentencia ve la suya—,
     pero sí un solo `current_date` para todas las ventanas. */
  const embudos = await conOrganizacion(contexto.orgEfectiva, () =>
    embudosDeAcquisition(periodo, contexto.organizacion.zonaHoraria),
  );

  return ok({
    /* La clave viaja de vuelta y no se da por supuesta: la pantalla enciende el botón con LO QUE EL
       SERVIDOR CONTESTÓ. Si un día las dos dejan de coincidir, el botón encendido sigue describiendo
       las cifras que están abajo. */
    periodo: periodo.clave,
    embudos,
    /* Si esta sesión puede asignar funnels: la misma capacidad que pide `PUT /api/acquisition/funnel`.
       La decide el servidor para que la pantalla no ofrezca un selector que después responde 403. */
    puedeAsignar: contexto.permisos.has('credenciales.editar'),
  });
}
