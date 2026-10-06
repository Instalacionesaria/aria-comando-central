// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// La pantalla de Conversion: por dónde entra la gente, y cuántos abandonan el formulario.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES LA PRIMERA OPERACIÓN DE SERVIDOR DE ESTA PANTALLA, Y ESO BAJA UN CABLE TRAMPA
//
// `conversion` estaba declarada con `sinOperacionesTodavia: true` en
// `lib/autorizacion/secciones.ts`. Esa bandera dice «esta pantalla no llama a ninguna operación», y
// `ADR-0304` la verifica en las dos direcciones: con la bandera puesta, una ruta que declare
// `PANTALLA = 'conversion'` es roja; sin la bandera, la ausencia de una ruta también.
//
// O sea que este archivo y esa bandera se mueven juntos. Tercer departamento que lo hace.
//
// ── DOS BLOQUES Y NO TRES, Y LA DIFERENCIA CON CREATIVE ES EL CORTE ───────
//
// Creative pide tres módulos porque tiene tres poblaciones del mismo nombre de pieza. Acá son dos, y
// hablan de **dos poblaciones que ni siquiera se solapan del todo**:
//
//   · `recorrido`   · la cohorte ENTERA repartida por el camino de entrada. Siete familias que no
//                     se suman entre sí como si fueran pasos: son caminos alternativos
//   · `formulario`  · sólo los que llegaron al formulario de la landing, que en la ventana de 30
//                     días son 63 de 335. Medido el 2026-09-20
//
// **Los dos reciben LA MISMA ventana**, y acá eso pesa más que en las otras pantallas: los dos
// llevan al lado el mismo `corteDeEpoca` —el último día con el formulario escrito— y si cada uno
// calculara el suyo sobre una ventana distinta, la misma pantalla diría dos veces si cruza el corte
// y podrían contestar distinto.
//
// **Ninguna cifra se escribe en este comentario**, y es deliberado: Creative pagó tener tres
// mediciones vencidas al mismo tiempo en el encabezado de su ruta. Las que hay arriba —63 de 335—
// llevan su fecha porque describen por qué el diseño es así, no lo que la pantalla va a mostrar hoy.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';
import { recorridoDelLead } from '../../../lib/negocio/recorridoDelLead.ts';
import { embudoDelFormulario } from '../../../lib/negocio/embudoDelFormulario.ts';
import { estadoDelDepartamento, reglasDelDepartamento, senalesDeLaPantalla, ultimoPlan } from '../../../lib/agentes/senales/lectura.ts';
import { textoDeConversion } from '../../../lib/agentes/plan/conversion.ts';

export const PANTALLA = 'conversion';

export async function GET(peticion: Request): Promise<Response> {
  /* `tablero.ver`, que es la que la sección ya declaraba. No se inventa una `conversion.ver`: siete
     pantallas comparten esta capacidad y lo que las separa es el ALCANCE por persona, no la
     capacidad — agregar un eje nuevo acá lo rompería para las otras seis. */
  const contexto = await exigir(peticion, ['tablero.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* El período que no está en la lista se RECHAZA, no se corrige al valor por omisión. Pedir un
     período que no existe y recibir treinta días sin enterarse es el defecto que `periodo.ts`
     cierra: la cifra sale bien calculada sobre una ventana que nadie pidió. */
  const periodo = periodoDe(new URL(peticion.url).searchParams.get('periodo'));
  if (periodo === null) return rechazo('peticion_invalida', 'Ese período no existe.');

  /* Las señales del detector de Conversion (AG14 de los agentes), de 7 o de 30 días; con «hoy» o «completo»,
     ninguna, y la tarjeta lo dice. Las guarda la pasada de cada mañana; acá sólo se leen. */
  const ventana = periodo.clave === '7d' || periodo.clave === '30d' ? periodo.clave : null;
  const [recorrido, formulario, senales] = await conOrganizacion(contexto.orgEfectiva, async () => {
    const lista = ventana === null ? [] : await senalesDeLaPantalla('conversion', ventana, textoDeConversion);
    return [
      await recorridoDelLead(periodo.dias),
      await embudoDelFormulario(periodo.dias),
      {
        ventana,
        lista,
        estado: estadoDelDepartamento(lista),
        plan: ventana === null ? null : await ultimoPlan('conversion', ventana),
        reglas: await reglasDelDepartamento('conversion'),
      },
    ] as const;
  });

  return ok({
    /* La clave viaja de vuelta y no se da por supuesta: la pantalla enciende el botón con LO QUE EL
       SERVIDOR CONTESTÓ, así que el botón encendido siempre describe las cifras de abajo. */
    periodo: periodo.clave,
    recorrido,
    formulario,
    senales,
    /* Lo que esta sesión puede hacer con las señales: las capacidades de `app/api/conversion/senales` y
       `…/umbrales`, y nada bajo delegación (AG-82). */
    puedeConSenales: {
      resolver: contexto.permisos.has('senales.resolver') && !contexto.mirandoOtraOrganizacion,
      validar: contexto.permisos.has('senales.validar') && !contexto.mirandoOtraOrganizacion,
      firmar: contexto.permisos.has('umbrales.firmar') && !contexto.mirandoOtraOrganizacion,
    },
  });
}
