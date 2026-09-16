// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// La pantalla de Acquisition: lo que costó cada anuncio, y cuánto vale esa cifra.
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
// Mismo argumento que `app/api/auditoria/route.ts`, y acá pesa más: la tabla de anuncios y el
// monitor de atribución **no se pueden leer por separado**. El § 18.5 sólo deja publicar una
// conclusión por anuncio *con su cobertura al lado*, así que una pantalla que dibuje la tabla antes
// que el monitor muestra durante esos segundos exactamente la afirmación que el documento prohíbe.
//
// Las dos cifras reciben además LA MISMA ventana. Con ventanas distintas, la tabla hablaría de
// treinta días y la cobertura de catorce, sin decirlo.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';
import { costoDelAnuncio } from '../../../lib/negocio/costoDelAnuncio.ts';
import { calidadDeLaAtribucion } from '../../../lib/negocio/calidadDeLaAtribucion.ts';

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

  const [costo, calidad] = await conOrganizacion(contexto.orgEfectiva, async () => [
    await costoDelAnuncio(periodo.dias),
    await calidadDeLaAtribucion(periodo.dias),
  ]);

  return ok({
    /* La clave viaja de vuelta y no se da por supuesta: la pantalla enciende el botón con LO QUE EL
       SERVIDOR CONTESTÓ. Si un día las dos dejan de coincidir, el botón encendido sigue describiendo
       las cifras que están abajo. */
    periodo: periodo.clave,
    costo,
    calidad,
  });
}
