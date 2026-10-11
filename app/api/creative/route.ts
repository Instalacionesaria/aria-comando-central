// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// La pantalla de Creative: qué pieza funciona, contra su etapa (docs/creative/16).
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
// Las tres las calcula y las publica cada módulo. Desde el 2026-10-11 la pantalla no las dibuja —es un tablero, y
// la cobertura la da el agente de Creative (CF1-05)—, pero siguen viajando. Y las tres reciben LA MISMA ventana: con
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
import { lecturaDeCreative } from '../../../lib/negocio/lecturaDeCreative.ts';
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
  const [lectura, senales, comentario] = await conOrganizacion(contexto.orgEfectiva, async () => {
    const lista = ventana === null ? [] : await senalesDeLaPantalla('creative', ventana, textoDeCreative);
    return [
      /* La calidad, el rendimiento, la fatiga, los links manuales de las piezas y lo que el front del prototipo
         dibuja con todo eso (docs/creative/16, CF1-15): una sola lectura, con la ventana del período. Los links
         (docs/creative/15, C15-06) no dependen de la ventana. */
      await lecturaDeCreative(periodo.dias),
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
    /* Lo que dibuja el front del prototipo, armado en el servidor (CF1-15): cada tasa de 0 a 1 y cada «—» con su
       motivo. Los bloques de abajo siguen viajando: son la respuesta de siempre de esta ruta, y la prueba 215 compara
       contra ellos las herramientas del cerebro, que los piden por su cuenta a las mismas funciones. */
    pantalla: lectura.pantalla,
    calidad: lectura.calidad,
    rendimiento: lectura.rendimiento,
    fatiga: lectura.fatiga,
    enlaces: lectura.enlaces,
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
