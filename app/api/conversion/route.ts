// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// La pantalla de Conversion: los cinco pasos del prototipo, por dónde entra la gente y el formulario de la landing.
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
// ── UNA SOLA LECTURA, Y TRES PIEZAS DE LA MISMA VENTANA ───────────────────
//
// Desde el 2026-10-08 todo sale de `lecturaDeConversion` (`lib/negocio/pasosDeConversion.ts`), con los días
// cerrados de Acquisition (CV15-04 y CV15-21 de `docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`):
//
//   · `pasos`       · la tira y las cinco tarjetas del prototipo, con sus flechas contra la anterior
//   · `recorrido`   · la cohorte ENTERA repartida por el camino de entrada: la tabla del cajón de Landing. Siete
//                     familias que no se suman entre sí como si fueran pasos: son caminos alternativos
//   · `formulario`  · sólo los que llegaron al formulario de la landing: el cajón de Formulario
//
// **Las tres son de LA MISMA ventana**, y acá eso pesa más que en las otras pantallas: llevan el mismo
// `corteDeEpoca` —el último día con el formulario escrito— y si cada una calculara el suyo sobre una ventana
// distinta, la misma pantalla diría dos veces si cruza el corte y podrían contestar distinto. Antes eran dos
// lecturas sueltas con los días de calendario hasta hoy; ahora es una, y el cerebro y el detector leen la misma.
//
// **Ninguna cifra se escribe en este comentario**, y es deliberado: Creative pagó tener tres
// mediciones vencidas al mismo tiempo en el encabezado de su ruta.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';
import { type ClaveDePaso, lecturaDeConversion, PASOS, pasoDeLaSenal } from '../../../lib/negocio/pasosDeConversion.ts';
import { estadoDelDepartamento, reglasDelDepartamento, senalesDeLaPantalla, ultimoPlan } from '../../../lib/agentes/senales/lectura.ts';
import { textoDeConversion } from '../../../lib/agentes/plan/conversion.ts';
import { comentarioDelDepartamento, faltaPorFrescura, LO_QUE_LEE } from '../../../lib/agentes/cabecera.ts';
import { frescuraDe } from '../../../lib/negocio/frescura.ts';

export const PANTALLA = 'conversion';

/** La frescura de la lectura de contactos, con la frase de la cabecera. Corre dentro de `conOrganizacion`. */
async function frescuraDelChip() {
  const f = await frescuraDe('contactos');
  return { contactos: { estado: f.estado, aviso: faltaPorFrescura(f, LO_QUE_LEE.conversion.que) } };
}

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
     ninguna, y la tarjeta lo dice. Las guarda la pasada de cada mañana; acá sólo se leen, y se reparten por paso
     según su entidad (CV15-19), para que la pantalla dibuje cada una en la tarjeta y el cajón de su paso; la
     tarjeta de señales del final las muestra todas. */
  const ventana = periodo.clave === '7d' || periodo.clave === '30d' ? periodo.clave : null;
  const [lectura, senales, comentario, frescura] = await conOrganizacion(contexto.orgEfectiva, async () => {
    const lista = ventana === null ? [] : await senalesDeLaPantalla('conversion', ventana, textoDeConversion);
    const porPaso = Object.fromEntries(PASOS.map((p) => [p, [] as string[]])) as Record<ClaveDePaso, string[]>;
    for (const s of lista) {
      const p = pasoDeLaSenal(s.entidad);
      if (p !== null) porPaso[p].push(s.id);
    }
    return [
      await lecturaDeConversion(periodo, contexto.organizacion.zonaHoraria),
      {
        ventana,
        lista,
        estado: estadoDelDepartamento(lista),
        plan: ventana === null ? null : await ultimoPlan('conversion', ventana),
        reglas: await reglasDelDepartamento('conversion'),
        porPaso,
      },
      await comentarioDelDepartamento('conversion', contexto.organizacion.zonaHoraria),
      /* El punto del chip «GoHighLevel» (CV15-03): verde sólo con la lectura de contactos al día. Es la frescura
         de la tarea y no del día, así que no depende del período. Su `aviso`, para el `title` del chip, es la frase
         de la cabecera del departamento: la de `frescuraDe` promete una lectura al abrir la pantalla, y ésta no lee. */
      await frescuraDelChip(),
    ] as const;
  });

  return ok({
    /* El comentario de la cabecera (AG15 de los agentes, `04`, AG-77): de reglas, sin modelo, y no depende del
       período elegido. `null` es la regla del silencio. */
    comentario,
    /* La clave viaja de vuelta y no se da por supuesta: la pantalla enciende el botón con LO QUE EL
       SERVIDOR CONTESTÓ, así que el botón encendido siempre describe las cifras de abajo. */
    periodo: periodo.clave,
    pasos: lectura.pasos,
    recorrido: lectura.recorrido,
    formulario: lectura.formulario,
    frescura,
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
