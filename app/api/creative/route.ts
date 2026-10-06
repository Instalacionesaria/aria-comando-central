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
//   · `fatiga`       · las piezas con VEREDICTO, sobre las que entregaron. No es lo mismo que «con
//                      ocho días de serie»: hay tres motivos para no tener veredicto y sólo uno es
//                      la serie corta. Medido, 6 de las que no lo tienen sí tienen los ocho días
//
// **Las tres cifras NO se escriben acá.** Decían «94,5 %», «56-90 %» y «5 de 26», y al 2026-09-19
// las tres estaban vencidas: la primera de un denominador que ya no se usa, la tercera daba 11 y no
// 5. Un comentario con una cifra medida envejece con cada día que entra el colector, y nada avisa.
// Las tres las calcula y las publica cada módulo, y la pantalla las dibuja arriba de todo.
//
// Dibujar una antes que las otras muestra, durante esos segundos, un ranking sin la cobertura que lo
// califica — que es exactamente lo que el § 18.5 prohíbe. Y las tres reciben LA MISMA ventana: con
// ventanas distintas, el ICP hablaría de treinta días y el hook rate de tres, sin decirlo.
//
// ── Y LAS SEÑALES, QUE NO SE CALCULAN ACÁ ─────────────────────────────────
//
// Desde AG10 de los agentes, el detector de Creative guarda cada mañana sus señales y su Plan de acción
// (`lib/agentes/detectores/creative.ts`): esta ruta las publica en `senales`, en la misma transacción que las
// cifras, y no las recalcula en cada carga.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';
import { calidadDelCreativo } from '../../../lib/negocio/calidadDelCreativo.ts';
import { rendimientoDelCreativo } from '../../../lib/negocio/rendimientoDelCreativo.ts';
import { fatigaDelCreativo } from '../../../lib/negocio/fatigaDelCreativo.ts';
import { enlacesDeLasPiezas } from '../../../lib/negocio/enlaceDeLaPieza.ts';
import { estadoDelDepartamento, reglasDelDepartamento, senalesDeLaPantalla, ultimoPlan } from '../../../lib/agentes/senales/lectura.ts';
import { textoDeCreative } from '../../../lib/agentes/plan/creative.ts';
import { comentarioDelDepartamento } from '../../../lib/agentes/cabecera.ts';

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

  /* Las señales son de 7 o de 30 días (AG-28): con «hoy» o «completo» no hay ventana que mostrar, y la
     tarjeta dice sobre cuáles se calculan. */
  const ventana = periodo.clave === '7d' || periodo.clave === '30d' ? periodo.clave : null;
  const [calidad, rendimiento, fatiga, enlaces, senales, comentario] = await conOrganizacion(contexto.orgEfectiva, async () => {
    const lista = ventana === null ? [] : await senalesDeLaPantalla('creative', ventana, textoDeCreative);
    return [
      await calidadDelCreativo(periodo.dias),
      await rendimientoDelCreativo(periodo.dias),
      await fatigaDelCreativo(periodo.dias),
      /* Los links manuales de las piezas (docs/creative/15, C15-06): el respaldo del video, que el
         cajón de la pieza ofrece como «Ver en Facebook / Instagram». No dependen de la ventana. */
      await enlacesDeLasPiezas(),
      {
        ventana,
        lista,
        estado: estadoDelDepartamento(lista),
        plan: ventana === null ? null : await ultimoPlan('creative', ventana),
        reglas: await reglasDelDepartamento('creative'),
      },
      await comentarioDelDepartamento('creative', contexto.organizacion.zonaHoraria),
    ] as const;
  });

  return ok({
    /* El comentario de la cabecera (AG15 de los agentes, `04`, AG-77): de reglas, sin modelo, y no depende del
       período elegido. `null` es la regla del silencio. */
    comentario,
    /* La clave viaja de vuelta y no se da por supuesta: la pantalla enciende el botón con LO QUE EL
       SERVIDOR CONTESTÓ, así que el botón encendido siempre describe las cifras de abajo. */
    periodo: periodo.clave,
    calidad,
    rendimiento,
    fatiga,
    enlaces,
    senales,
    /* Lo que esta sesión puede hacer con las señales: las mismas capacidades que piden
       `app/api/creative/senales` y `…/umbrales`, y nada bajo delegación (AG-82). */
    puedeConSenales: {
      resolver: contexto.permisos.has('senales.resolver') && !contexto.mirandoOtraOrganizacion,
      validar: contexto.permisos.has('senales.validar') && !contexto.mirandoOtraOrganizacion,
      firmar: contexto.permisos.has('umbrales.firmar') && !contexto.mirandoOtraOrganizacion,
    },
  });
}
