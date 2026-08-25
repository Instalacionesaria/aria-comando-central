// El cockpit del closer: ¿cómo voy este mes?
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA QUE MANDA ACÁ, Y ES LA MÁS FÁCIL DE ROMPER
//
// El `11` § 4: **un cero medido y un cero no medido no son el mismo hecho.**
//
//   · No hay datos cargados → `null`, y la pantalla dibuja `—` con una línea que diga qué falta.
//   · Hay datos y el resultado es cero → `0`, atenuado.
//
// *"Un `$0` donde nadie cargó montos afirma «no vendiste nada». Es falso, y nadie reporta un
// panel que simplemente parece vacío."*
//
// Por eso cada número de este archivo es `number | null` y no `number`. El tipo obliga a la
// pantalla a decidir, en vez de dejar que un `?? 0` lo decida por descuido.
//
// ── Y CERO LLAMADAS AL CRM ──────────────────────────────────────────────────
//
// Todo sale de la base propia. El `04` § 8: *"Mi Día, Pipeline, Agenda, Inicio, Chat → 0"*.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';

/** Un indicador del cockpit. `valor: null` = **no hay de dónde medirlo**. */
export interface Indicador {
  valor: number | null;
  /** Qué falta para que este número exista. Solo cuando `valor` es nulo. */
  falta?: string;
}

export interface Cockpit {
  /** El mes al que corresponden los números, en la zona de la organización. */
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
  /**
   * Contactos con cita agendada.
   *
   * ── POR QUÉ NO DICE «DEL MES» ─────────────────────────────────────────────
   *
   * Porque no se puede. El número sale de la etiqueta `cita_agendada`, y **una etiqueta no trae
   * fecha**. Acotarlo al mes sería inventar el recorte temporal: con 74 contactos etiquetados,
   * decir «74 este mes» afirma algo que nadie midió.
   *
   * El día que se lea el calendario, `negocio.citas` sí tiene fecha y este indicador pasa a ser
   * del mes de verdad.
   */
  conCitaAgendada: Indicador;
  /**
   * La tasa de asistencia, en porcentaje.
   *
   * Necesita saber quién asistió y quién no, o sea citas con su desenlace. Hoy no hay ninguna
   * cita leída, así que va nula — y NO se aproxima con los no-shows: `noshow` dice cuántos
   * faltaron, no sobre cuántos, y una tasa sin denominador no es una tasa.
   */
  tasaDeAsistencia: Indicador;
  /** No-shows registrados. Éste sí es un conteo, y sale de la etiqueta. */
  noShows: Indicador;
  /** Cuántas tareas esperan en Mi Día. El puente a la otra pantalla. */
  tareasPendientes: Indicador;
}

/**
 * El cockpit del mes.
 *
 * @param zonaHoraria La de la ORGANIZACIÓN. El mes de un closer en Lima no empieza cuando
 *   empieza el del servidor, y una métrica mensual calculada en otra zona corre el corte de
 *   día en los dos extremos del mes.
 */
export async function cockpitDelMes(zonaHoraria: string, tareasPendientes: number): Promise<Cockpit> {
  const desdeElPrimero = sql<Date>`date_trunc('month', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`;

  // Los resultados del mes, agregados de una vez. `filter` en vez de tres consultas: el `01`
  // § "cómo se arma" pide una pasada, y tres viajes para tres números del mismo origen es
  // trabajo que no hace falta.
  const r = await datos()
    .selectFrom('resultados')
    .where('creado_el', '>=', desdeElPrimero)
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
   * encabezado. Sin ningún resultado registrado, «cobrado» no es cero: es que nadie registró
   * nada todavía. Con resultados y sin ventas, cero es un hecho.
   */
  const huboResultados = Number(r?.total ?? 0) > 0;

  const SIN_AVANZAR =
    'Todavía no se registró ningún resultado este mes. Los números salen de Avanzar.';

  // Los conteos por etiqueta. Éstos SÍ tienen dato hoy, y son la mitad útil del cockpit
  // mientras Avanzar no exista.
  const porEtiqueta = await datos()
    .selectFrom('contactos')
    .where('territorio', '=', 'closer')
    .select(({ fn }) => [
      fn
        .countAll<string>()
        .filterWhere(sql<boolean>`etiquetas && array['cita_agendada']`, '=', true)
        .as('con_cita'),
      fn
        .countAll<string>()
        .filterWhere(sql<boolean>`etiquetas && array['noshow']`, '=', true)
        .as('noshows'),
      fn.countAll<string>().as('total'),
    ])
    .executeTakeFirst();

  const hayContactos = Number(porEtiqueta?.total ?? 0) > 0;

  return {
    mes: new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: zonaHoraria }).format(
      new Date(),
    ),
    cobrado: huboResultados
      ? { valor: Number(r?.cobrado ?? 0) }
      : { valor: null, falta: SIN_AVANZAR },
    ventas: huboResultados ? { valor: Number(r?.ventas ?? 0) } : { valor: null, falta: SIN_AVANZAR },
    acuerdos: huboResultados
      ? { valor: Number(r?.acuerdos ?? 0) }
      : { valor: null, falta: SIN_AVANZAR },
    conCitaAgendada: hayContactos
      ? { valor: Number(porEtiqueta?.con_cita ?? 0) }
      : {
          valor: null,
          falta: 'Todavía no hay contactos traídos de GoHighLevel.',
        },
    tasaDeAsistencia: {
      valor: null,
      falta:
        'Hace falta leer el calendario de GoHighLevel: la tasa necesita saber quién asistió y ' +
        'sobre cuántas citas, y una etiqueta no dice ninguna de las dos cosas.',
    },
    noShows: hayContactos
      ? { valor: Number(porEtiqueta?.noshows ?? 0) }
      : { valor: null, falta: 'Todavía no hay contactos traídos de GoHighLevel.' },
    // Viene de Mi Día, calculado con su regla: los seguimientos automáticos NO cuentan.
    tareasPendientes: { valor: tareasPendientes },
  };
}
