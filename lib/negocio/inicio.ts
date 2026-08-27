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
 * El cockpit del mes **del closer designado**.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANTES ESTE NÚMERO ERA DE TODA LA EMPRESA, Y AL LADO HABÍA UNA COMISIÓN PERSONAL
 *
 * Es el defecto que la migración `015` describió y no pudo cerrar sola. Su encabezado lo dejó
 * medido: *"ese `cobrado` es de TODA la organización — `cockpitDelMes` no recibe `usuarioId` y la
 * consulta filtra solo por fecha"*, y por eso la comisión se guardó por persona.
 *
 * Pero quedaba una inconsistencia a la vista: el número grande de arriba era de la empresa y el
 * anillo de al lado se calculaba sobre las ventas de UNA persona. Dos bases distintas en la misma
 * pantalla, sin nada que lo dijera.
 *
 * Ahora las dos son del closer designado, así que el número grande y el anillo hablan de lo mismo.
 *
 * ── Y SI NO HAY NADIE DESIGNADO ─────────────────────────────────────────────
 *
 * `closerId` nulo no produce ceros: produce `falta`. Un `0` afirmaría que el closer no vendió nada
 * este mes, y lo que pasa es que **nadie eligió de quién son los números**. Es la misma regla que
 * gobierna cada indicador de este archivo, y la que la `020` grabó en la base al no poner valor por
 * omisión: sin fila, nadie designó a nadie.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * @param zonaHoraria La de la ORGANIZACIÓN. El mes de un closer en Lima no empieza cuando
 *   empieza el del servidor, y una métrica mensual calculada en otra zona corre el corte de
 *   día en los dos extremos del mes.
 * @param closerId El usuario designado closer, o `null` si nadie lo está.
 */
export async function cockpitDelMes(
  zonaHoraria: string,
  tareasPendientes: number,
  closerId: string | null,
): Promise<Cockpit> {
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
   * Con `closerId` nulo no se consulta nada. Correr la consulta sin el filtro para «tener algo que
   * mostrar» es exactamente el error: mostraría el cobrado de la empresa como si fuera de un closer
   * que nadie eligió. */
  const r = closerId === null
    ? undefined
    : await datos()
    .selectFrom('resultados')
    .where('creado_el', '>=', desdeElPrimero)
    .where('registrado_por', '=', closerId)
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

  /* Y el OTRO motivo de que no haya número, que no es el mismo y no se dice igual: no hay a quién
     medir. Separarlos es lo único que permite que la pantalla diga qué hacer — cargar un resultado,
     o elegir al closer. Un solo texto para los dos casos mandaría a la mitad de la gente a hacer lo
     que no corresponde. */
  const SIN_CLOSER = 'Todavía no hay un closer asignado, así que no hay de quién mostrar números.';
  const porQueFalta = closerId === null ? SIN_CLOSER : SIN_AVANZAR;

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
      : { valor: null, falta: porQueFalta },
    ventas: huboResultados ? { valor: Number(r?.ventas ?? 0) } : { valor: null, falta: porQueFalta },
    acuerdos: huboResultados
      ? { valor: Number(r?.acuerdos ?? 0) }
      : { valor: null, falta: porQueFalta },
    /* ── ESTOS TRES TEXTOS NOMBRABAN EL CRM DEL PROVEEDOR ─────────────────────
       Decían «traídos de GoHighLevel» y «hace falta leer el calendario de GoHighLevel». Los lee un
       cliente en la primera pantalla del Closer, y no le dicen nada que pueda hacer: el nombre de la
       herramienta con la que la plataforma habla no es asunto suyo.
       Lo que NO se toca es la distinción: siguen diciendo que el dato no está medido, y no un cero.
       Cambia el vocabulario, no la honestidad. */
    conCitaAgendada: hayContactos
      ? { valor: Number(porEtiqueta?.con_cita ?? 0) }
      : { valor: null, falta: 'Todavía no hay contactos en tu cartera.' },
    tasaDeAsistencia: {
      valor: null,
      falta:
        'Todavía no se puede calcular: hace falta saber quién asistió a cada cita y sobre cuántas, ' +
        'y eso se registra al cerrar la cita.',
    },
    noShows: hayContactos
      ? { valor: Number(porEtiqueta?.noshows ?? 0) }
      : { valor: null, falta: 'Todavía no hay contactos en tu cartera.' },
    // Viene de Mi Día, calculado con su regla: los seguimientos automáticos NO cuentan.
    tareasPendientes: { valor: tareasPendientes },
  };
}
