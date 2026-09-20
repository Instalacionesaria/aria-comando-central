// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// La pantalla de Creative: qué pieza funciona, y sobre cuántos datos se está diciendo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES LA PRIMERA OPERACIÓN DE SERVIDOR DE ESTA PANTALLA, Y ESO BAJA UN CABLE TRAMPA
//
// `creative` estaba declarada con `sinOperacionesTodavia: true` en
// `lib/autorizacion/secciones.ts`. Esa bandera dice «esta pantalla no llama a ninguna operación», y
// `ADR-0304` la verifica en las dos direcciones: con la bandera puesta, una ruta que declare
// `PANTALLA = 'creative'` es roja; sin la bandera, la ausencia de una ruta también.
//
// O sea que este archivo y esa bandera se mueven juntos. Es el mismo par que movió Acquisition.
//
// ── UNA SOLA LECTURA PARA TODA LA PANTALLA, Y ACÁ EL MOTIVO ES PROPIO ─────
//
// Las tres cifras de esta pantalla hablan de **poblaciones distintas del mismo nombre de pieza**, y
// cada una tiene su propia cobertura:
//
//   · `calidad`      · los contactos, cruzados por nombre contra `negocio.anuncios`
//   · `rendimiento`  · las filas anuncio-día, según qué clave del desglose traiga cada una
//   · `fatiga`       · las piezas con ocho días de serie, sobre las que entregaron
//
// **Las tres cifras NO se escriben acá.** Decían «94,5 %», «56-90 %» y «5 de 26», y al 2026-09-19
// las tres estaban vencidas: la primera de un denominador que ya no se usa, la tercera daba 11 y no
// 5. Un comentario con una cifra medida envejece con cada día que entra el colector, y nada avisa.
// Las tres las calcula y las publica cada módulo, y la pantalla las dibuja arriba de todo.
//
// Dibujar una antes que las otras muestra, durante esos segundos, un ranking sin la cobertura que lo
// califica — que es exactamente lo que el § 18.5 prohíbe. Y las tres reciben LA MISMA ventana: con
// ventanas distintas, el ICP hablaría de treinta días y el hook rate de tres, sin decirlo.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';
import { calidadDelCreativo } from '../../../lib/negocio/calidadDelCreativo.ts';
import { rendimientoDelCreativo } from '../../../lib/negocio/rendimientoDelCreativo.ts';
import { fatigaDelCreativo } from '../../../lib/negocio/fatigaDelCreativo.ts';

export const PANTALLA = 'creative';

export async function GET(peticion: Request): Promise<Response> {
  /* `tablero.ver`, que es la que la sección ya declaraba. No se inventa una `creativos.ver`: siete
     pantallas comparten esta capacidad y lo que las separa es el ALCANCE por persona, no la
     capacidad — agregar un eje nuevo acá lo rompería para las otras seis. */
  const contexto = await exigir(peticion, ['tablero.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* El período que no está en la lista se RECHAZA, no se corrige al valor por omisión. Pedir un
     período que no existe y recibir treinta días sin enterarse es el defecto que `periodo.ts`
     cierra: la cifra sale bien calculada sobre una ventana que nadie pidió. */
  const periodo = periodoDe(new URL(peticion.url).searchParams.get('periodo'));
  if (periodo === null) return rechazo('peticion_invalida', 'Ese período no existe.');

  const [calidad, rendimiento, fatiga] = await conOrganizacion(contexto.orgEfectiva, async () => [
    await calidadDelCreativo(periodo.dias),
    await rendimientoDelCreativo(periodo.dias),
    await fatigaDelCreativo(periodo.dias),
  ]);

  return ok({
    /* La clave viaja de vuelta y no se da por supuesta: la pantalla enciende el botón con LO QUE EL
       SERVIDOR CONTESTÓ, así que el botón encendido siempre describe las cifras de abajo. */
    periodo: periodo.clave,
    calidad,
    rendimiento,
    fatiga,
  });
}
