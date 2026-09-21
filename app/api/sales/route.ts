// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// La pantalla de Sales: la cadena comercial, y el eslabón que no existe.
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
// `dineroDelMes` se llama **una vez**, con `{tipo:'empresa'}`. No N+1 por closer: su consulta corta
// por `registrado_por` y la de las etiquetas por `crm_asignado_a`, así que las filas nunca sumarían
// el total y la tabla mentiría sin que nada fallara. El motivo largo está en el plan de la pantalla
// y en `inicio.ts:123-125`.
//
// Y la lista de closers se lee UNA vez y se pasa a los dos consumidores. Con dos lecturas, el bloque
// de dinero y la tabla podrían discrepar sobre quiénes son los closers dentro de la misma respuesta.
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
import { closersDeLaEmpresa } from '../../../lib/negocio/alcanceDelCloser.ts';
import { dineroDelMes } from '../../../lib/negocio/dineroDelMes.ts';
import { tasaDeCancelacion } from '../../../lib/negocio/indicadoresDeCitas.ts';
import { cadenaDeCierre } from '../../../lib/negocio/cadenaDeCierre.ts';
import { cicloHastaLaCita } from '../../../lib/negocio/cicloHastaLaCita.ts';
import { cierrePorCloser } from '../../../lib/negocio/cierrePorCloser.ts';
import { VENTANAS } from '../../../lib/negocio/ventanasDeSales.ts';
import { HUECOS, MEDIDO_EL } from '../../../lib/negocio/huecosDeSales.ts';

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
     Y acá tiene un filo propio: el segmentado de la maqueta que esta pantalla reemplaza mandaba
     `data-p="mes"`, que no es ninguna de las cuatro claves. Ese botón habría recibido un rechazo. */
  const periodo = periodoDe(new URL(peticion.url).searchParams.get('periodo'));
  if (periodo === null) return rechazo('peticion_invalida', 'Ese período no existe.');

  const { dinero, cancelacion, cadena, ciclo, closers } = await conOrganizacion(
    contexto.orgEfectiva,
    async () => {
      /* Se lee una vez y se usa dos veces: para el sujeto del dinero y para las filas de la tabla.
         Ver el encabezado. */
      const catalogo = await closersDeLaEmpresa();

      /* ── EL SUJETO ES LA EMPRESA, SIEMPRE ──────────────────────────────────
       *
       * Sales no tiene selector de «ver como»: es una pantalla de dirección y mira al equipo entero.
       * Y `{tipo:'empresa'}` con la lista vacía no puede llegar a la consulta —un `in ()` es SQL
       * inválido—, así que sin closers configurados el sujeto es `nadie`, que además es el estado
       * que hace que el dinero salga `—` con su motivo en vez de `0`. */
      const sujeto =
        catalogo.length === 0
          ? ({ tipo: 'nadie' } as const)
          : ({ tipo: 'empresa', usuarioIds: catalogo.map((k) => k.usuarioId) } as const);

      return {
        dinero: await dineroDelMes(contexto.organizacion.zonaHoraria, sujeto),
        /* Segundo consumidor de esta cifra, y por eso NO se recalcula: reescribirla republicaría el
           62,7 % que el commit `9931f4d` ya corrigió mezclando el descarte propio con la pérdida. */
        cancelacion: await tasaDeCancelacion(periodo.dias),
        cadena: await cadenaDeCierre(periodo.dias),
        ciclo: await cicloHastaLaCita(periodo.dias),
        closers: await cierrePorCloser(periodo.dias, catalogo),
      };
    },
  );

  return ok({
    /* La clave viaja de vuelta y no se da por supuesta: la pantalla enciende el botón con LO QUE EL
       SERVIDOR CONTESTÓ, así que el botón encendido siempre describe las cifras de abajo. */
    periodo: periodo.clave,
    ventanas: VENTANAS,
    /* Lo que la pantalla NO puede decir, con su medición y su fecha. Viaja para que nadie lo
       rehaga, y porque la maqueta que esta pantalla reemplaza dibujaba justo estas cosas con
       números inventados: quien conozca esa pantalla las va a buscar. */
    huecos: { medidoEl: MEDIDO_EL, lista: HUECOS },
    dinero,
    cancelacion,
    cadena,
    ciclo,
    closers,
  });
}
