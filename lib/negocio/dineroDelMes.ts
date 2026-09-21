// El dinero del mes: cobrado, ventas y acuerdos sin pagar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SALIÓ DE `inicio.ts` PARA QUE EXISTA UNA SOLA VEZ, Y ÉSE ES TODO SU MOTIVO
//
// Hasta el 2026-09-20 esto vivía dentro de `cockpitDelMes`, que sirve una sola pantalla: el Inicio
// del Closer. Sales necesita las mismas tres cifras, y el `01` es terminante —está citado en
// producción, en `app/api/closer/mi-dia/route.ts:17-19`—: *«si dos pantallas muestran el mismo
// número, comparten la función que lo calcula»*.
//
// Con dos implementaciones, el día que una sume `acuerdo_sin_pago` al cobrado las dos pantallas
// publican dos revenues distintos **y ninguna falla**. No es hipotético: es el defecto que la
// migración `015` midió y que la regla 2 de `docs/sales/02-METRICAS.md` nombra.
//
// **Es una extracción sin cambio de comportamiento.** El cuerpo se movió tal cual; `cockpitDelMes`
// lo compone y su firma, su tipo y su único llamador no cambiaron una línea. Lo que lo verifica son
// las cuatro pruebas que ya existían en `pruebas/base/26-avanzar.test.ts:430-570` y que fijan los
// tres estados del dinero — se corrieron antes y después.
//
// ── POR QUÉ `Indicador` Y `SujetoDelCockpit` VIVEN ACÁ Y NO ALLÁ ────────────
//
// Porque la dependencia tiene que apuntar hacia ABAJO. Este módulo es el que `inicio.ts` compone,
// así que si los tipos se quedaran arriba habría dos importaciones cruzadas entre los dos archivos
// —de tipos, sí, pero cruzadas igual— y la que lee este archivo tendría que abrir el otro para
// saber qué devuelve.
//
// El costo es una línea: `inicioDelSetter.ts` cambió de dónde importa `Indicador`. Su cockpit no usa
// nada más de este archivo, y eso es correcto: el setter tiene su propio dinero (`venta_chica`) y
// **no se suma con el del closer, nunca** — `lib/negocio/etapas.ts:86-94`.
//
// ── LA VENTANA ES EL MES CALENDARIO, Y NO ES NEGOCIABLE ACÁ ─────────────────
//
// `date_trunc('month', …)` en la zona de la ORGANIZACIÓN. No se parametriza por días: la comisión se
// calcula sobre el mes (`comision.ts:79`) y `Cockpit.mes` promete describir esa ventana. Una pantalla
// que necesite otra ventana tiene que decirlo en su propio rótulo, no torcer ésta.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';

/** Un indicador del cockpit. `valor: null` = **no hay de dónde medirlo**. */
export interface Indicador {
  valor: number | null;
  /** Qué falta para que este número exista. Solo cuando `valor` es nulo. */
  falta?: string;
}

/**
 * DE QUIÉN son los números. Tres formas, y las tres se ven distinto en pantalla.
 *
 * ── ERA `closerId: string | null` Y ESE NULO SE VOLVIÓ AMBIGUO ──────────────
 *
 * Con un solo closer, `null` significaba una cosa sola: nadie designado, y la pantalla decía
 * *«todavía no hay un closer asignado»*. Con varios closers y el selector «ver como», `null`
 * pasaría a significar también «toda la empresa» — y esos dos estados llevan a pantallas
 * opuestas: uno es un aviso para configurar, el otro es el total real de tres personas.
 *
 * Un `string | null` los escribe igual y obliga a quien lea a acordarse de cuál era. La unión los
 * separa en el tipo, que es donde este proyecto separa los estados que no se pueden confundir.
 */
export type SujetoDelCockpit =
  /** No hay ningún closer configurado. Los números salen `—` con el aviso, nunca `0`. */
  | { tipo: 'nadie' }
  /**
   * Todos los closers juntos: lo que ve quien administra y no es closer.
   *
   * Lleva los identificadores porque el total es **la suma de los closers**, no la de la empresa
   * entera: un resultado registrado por alguien que no es closer no es venta de nadie del equipo
   * de cierre, y sumarlo inflaría el número sin que nada fallara.
   */
  | { tipo: 'empresa'; usuarioIds: readonly string[] }
  /** Un closer concreto. `crmUsuarioId` nulo = designado sin vincular: sus contactos son todos. */
  | { tipo: 'persona'; usuarioId: string; crmUsuarioId: string | null };

export interface DineroDelMes {
  /** El mes al que corresponden los tres números, en la zona de la organización. */
  mes: string;
  /**
   * Lo COBRADO del mes. Cobrado real, no prometido — son dos cosas distintas y solo una va acá.
   *
   * Sale de los resultados con salida `venta` y monto cargado. Un acuerdo sin pago NO suma:
   * tiene su propio indicador, porque *"hay plata comprometida, más que pendiente, menos que
   * cobrado"*.
   */
  cobrado: Indicador;
  /** Cuántas ventas se registraron. */
  ventas: Indicador;
  /** Acuerdos sin pagar: comprometido y no cobrado. */
  acuerdos: Indicador;
}

/**
 * Las tres cifras de dinero del mes en curso, para el sujeto que se pida.
 *
 * Se corre dentro de `conOrganizacion(`.
 *
 * @param zonaHoraria La de la ORGANIZACIÓN. El mes de un closer en Lima no empieza cuando empieza
 *   el del servidor, y una métrica mensual calculada en otra zona corre el corte de día en los dos
 *   extremos del mes.
 */
export async function dineroDelMes(
  zonaHoraria: string,
  sujeto: SujetoDelCockpit,
): Promise<DineroDelMes> {
  const desdeElPrimero = sql<Date>`date_trunc('month', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`;

  // Los resultados del mes, agregados de una vez. `filter` en vez de tres consultas: el `01`
  // § "cómo se arma" pide una pasada, y tres viajes para tres números del mismo origen es
  // trabajo que no hace falta.
  /* ── EL `where` QUE HACE HONESTO EL NÚMERO GRANDE ──────────────────────────
   *
   * `registrado_por = closerId`, y es de la clase que este repositorio llama «el único lugar donde
   * olvidarse un `where` devuelve filas ajenas sin ningún error»: la política de RLS aísla por
   * ORGANIZACIÓN, no por persona. Sin esta línea el cobrado vuelve a ser de todos y sale más alto,
   * que es la forma en que este defecto se ve: un número plausible y equivocado.
   *
   * Sin ningún closer configurado no se consulta nada. Correr la consulta sin el filtro para «tener
   * algo que mostrar» es exactamente el error: mostraría el cobrado de la empresa como si fuera de
   * un closer que nadie eligió.
   *
   * Con varios closers el filtro es `in` en vez de `=`, y la lista son los closers CONFIGURADOS. Un
   * `in` sobre una lista vacía es SQL inválido, así que `{tipo:'empresa'}` sin identificadores no
   * puede llegar acá: la construye `app/api/closer/mi-dia/route.ts` a partir de la lista, y sin
   * closers el sujeto es `nadie`. */
  const deQuien: readonly string[] =
    sujeto.tipo === 'nadie'
      ? []
      : sujeto.tipo === 'empresa'
        ? sujeto.usuarioIds
        : [sujeto.usuarioId];

  const r = deQuien.length === 0
    ? undefined
    : await datos()
    .selectFrom('resultados')
    .where('creado_el', '>=', desdeElPrimero)
    .where('registrado_por', 'in', deQuien)
    .select(({ fn, eb }) => [
      fn
        .sum<string | null>(
          eb
            .case()
            .when('salida', '=', 'venta')
            .then(eb.ref('monto'))
            .else(null)
            .end(),
        )
        .as('cobrado'),
      fn.countAll<string>().filterWhere('salida', '=', 'venta').as('ventas'),
      fn.countAll<string>().filterWhere('salida', '=', 'acuerdo_sin_pago').as('acuerdos'),
      fn.countAll<string>().as('total'),
    ])
    .executeTakeFirst();

  /**
   * ¿Hubo ALGÚN resultado este mes?
   *
   * Es la pregunta que decide entre `—` y `0`, y es toda la diferencia entre las dos reglas del
   * encabezado de `inicio.ts`. Sin ningún resultado registrado, «cobrado» no es cero: es que nadie
   * registró nada todavía. Con resultados y sin ventas, cero es un hecho.
   */
  const huboResultados = Number(r?.total ?? 0) > 0;

  const SIN_AVANZAR =
    'Todavía no se registró ningún resultado este mes. Los números salen de Avanzar.';

  /* Y el OTRO motivo de que no haya número, que no es el mismo y no se dice igual: no hay a quién
     medir. Separarlos es lo único que permite que la pantalla diga qué hacer — cargar un resultado,
     o elegir al closer. Un solo texto para los dos casos mandaría a la mitad de la gente a hacer lo
     que no corresponde. */
  const SIN_CLOSER = 'Todavía no hay ningún closer configurado, así que no hay de quién mostrar ' +
    'números. Se configuran más abajo, en esta misma pantalla.';
  const porQueFalta = sujeto.tipo === 'nadie' ? SIN_CLOSER : SIN_AVANZAR;

  return {
    mes: new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: zonaHoraria }).format(
      new Date(),
    ),
    cobrado: huboResultados
      ? { valor: Number(r?.cobrado ?? 0) }
      : { valor: null, falta: porQueFalta },
    ventas: huboResultados ? { valor: Number(r?.ventas ?? 0) } : { valor: null, falta: porQueFalta },
    acuerdos: huboResultados
      ? { valor: Number(r?.acuerdos ?? 0) }
      : { valor: null, falta: porQueFalta },
  };
}
