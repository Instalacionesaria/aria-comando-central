// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// La pantalla de Sales: el front del prototipo con los datos reales (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`).
//
// Lee UNA lectura, `lecturaDeSales`, la misma que las herramientas del cerebro que publican lo armado (S15-14):
// `pantalla` es lo que dibuja el front —las cuatro cifras, la tabla, los motivos y la tarjeta de abajo, de 0 a 1—
// y los bloques de siempre siguen viajando con su forma (S15-13). Los huecos de `huecosDeSales.ts` ya no viajan:
// la pantalla dice cada «—» con su motivo, y lo que no mide está en `docs/OTROS/futuro/lo-que-sales-no-mide.md`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES LA PRIMERA OPERACIÓN DE SERVIDOR DE ESTA PANTALLA, Y ESO BAJA UN CABLE TRAMPA
//
// `sales` estaba declarada con `sinOperacionesTodavia: true` en `lib/autorizacion/secciones.ts`. Esa
// bandera dice «esta pantalla no llama a ninguna operación», y `ADR-0304` la verifica en las DOS
// direcciones: con la bandera puesta, una ruta que declare `PANTALLA = 'sales'` es roja; sin la
// bandera, la ausencia de una ruta también.
//
// O sea que este archivo, esa bandera y el conteo literal de `90-fundaciones.test.ts` se mueven en
// el mismo commit. Cuarto departamento que lo hace, y quedan dos pantallas con la bandera — las dos
// sin empezar.
//
// ── TRES VENTANAS EN UNA PANTALLA, Y POR ESO VIAJAN DESCRITAS ───────────────
//
// El plan preveía dos. La medición encontró una tercera, y la diferencia entre la segunda y la
// tercera es la peligrosa porque **las dos dicen «últimos 30 días» y describen poblaciones
// distintas**:
//
//   1 · MES CALENDARIO en la zona de la empresa — el dinero. No se recalcula acá: sale de
//       `dineroDelMes`, que es el dueño (`01`: *«si dos pantallas muestran el mismo número,
//       comparten la función que lo calcula»*). El selector de período NO lo gobierna.
//   2 · CONTACTOS dados de alta en los últimos N días — la cadena y el ciclo. Son cohortes: se
//       pregunta por gente que ENTRÓ y hasta dónde llegó.
//   3 · CITAS que OCURRIERON en los últimos N días — la cancelación y la tabla por closer. Se
//       pregunta por reuniones que pasaron, no por gente que entró.
//
// Con la 2 y la 3 confundidas, la tabla no cuadra contra la cifra de cabecera y no falla nada. Por
// eso `ventanas` viaja en la respuesta con el texto de cada una: la pantalla es `'use client'` y no
// puede importar nada de acá para explicarlo.
//
// ── EL DINERO SE CONSUME Y NO SE RECALCULA, Y NO BAJA A LA TABLA ───────────
//
// `dineroDelMes` se llama **una vez**, dentro de la lectura, con `{tipo:'empresa'}`. No N+1 por closer: su consulta corta
// por `registrado_por` y la de las etiquetas por `crm_asignado_a`, así que las filas nunca sumarían
// el total y la tabla mentiría sin que nada fallara. El motivo largo está en el plan de la pantalla
// y en `inicio.ts:123-125`.
//
// Y la lista de closers se lee UNA vez, en la lectura, y se pasa a los tres consumidores: el dinero, la tabla y
// los motivos. Con dos lecturas, podrían discrepar sobre quiénes son los closers dentro de la misma respuesta.
//
// ── LO QUE NO VIAJA, Y ES DELIBERADO ───────────────────────────────────────
//
// Del cockpit sólo viajan `mes`, `cobrado`, `ventas` y `acuerdos`. `conCitaAgendada` no es del mes
// —*«una etiqueta no trae fecha»*, `inicio.ts:44-48`—, `tasaDeAsistencia` está cableada a `null`
// allá y Sales publica la suya, `noShows` cuenta contactos con etiqueta y no citas, y
// `tareasPendientes` no tiene valor honesto en esta pantalla. Devolver el cockpit entero los traería
// los cuatro de arriba sin que nada fallara; hay una prueba de forma que lo impide.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';
import { lecturaDeSales } from '../../../lib/negocio/lecturaDeSales.ts';
import { VENTANAS } from '../../../lib/negocio/ventanasDeSales.ts';

/** A qué pantalla pertenece esta operación. Es un `export`, no un comentario. */
export const PANTALLA = 'sales';

export async function GET(peticion: Request): Promise<Response> {
  /* `tablero.ver`, que es la que la sección ya declaraba. No se inventa una `sales.ver`: siete
     pantallas comparten esta capacidad y lo que las separa es el ALCANCE por persona, no la
     capacidad — agregar un eje nuevo acá lo rompería para las otras seis. */
  const contexto = await exigir(peticion, ['tablero.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* El período que no está en la lista se RECHAZA, no se corrige al valor por omisión. Pedir un
     período que no existe y recibir treinta días sin enterarse es el defecto que `periodo.ts`
     cierra: la cifra sale bien calculada sobre una ventana que nadie pidió.
     *
     Y acá tiene un filo propio: el segmentado del prototipo mandaba `data-p="mes"`, que no es ninguna de las
     cuatro claves. Ese botón habría recibido un rechazo, y el front que vuelve al prototipo no lo copia. */
  const periodo = periodoDe(new URL(peticion.url).searchParams.get('periodo'));
  if (periodo === null) return rechazo('peticion_invalida', 'Ese período no existe.');

  /* La lectura entera dentro de la organización: los closers se leen una vez y el dinero, la tabla y los motivos
     hablan de las mismas personas. La cancelación es el segundo consumidor de `tasaDeCancelacion` y NO se
     recalcula: reescribirla republicaría el 62,7 % que el commit `9931f4d` ya corrigió mezclando el descarte
     propio con la pérdida. */
  const lectura = await conOrganizacion(contexto.orgEfectiva, () =>
    lecturaDeSales(periodo.dias, contexto.organizacion.zonaHoraria),
  );

  return ok({
    /* La clave viaja de vuelta y no se da por supuesta: la pantalla enciende el botón con LO QUE EL
       SERVIDOR CONTESTÓ, así que el botón encendido siempre describe las cifras de abajo. */
    periodo: periodo.clave,
    ventanas: VENTANAS,
    dinero: lectura.dinero,
    cancelacion: lectura.cancelacion,
    cadena: lectura.cadena,
    ciclo: lectura.ciclo,
    closers: lectura.closers,
    /* Lo que dibuja el front del prototipo, hecho en el servidor (S15-13). */
    pantalla: lectura.pantalla,
  });
}
