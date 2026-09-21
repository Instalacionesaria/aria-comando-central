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
import {
  type DineroDelMes,
  type Indicador,
  type SujetoDelCockpit,
  dineroDelMes,
} from './dineroDelMes.ts';

/* Los dos se re-exportan porque NACIERON acá: `Indicador` lo importa `inicioDelSetter.ts:40` y
   `SujetoDelCockpit` hoy no lo importa nadie, pero es el tipo del argumento de esta función y quien
   la lea lo va a buscar acá. Lo que se mudó a `dineroDelMes.ts` es la DEFINICIÓN, para que la
   dependencia apunte hacia abajo; el nombre sigue estando donde estaba.
   *
   Un `export type { … }` y no una copia: son el MISMO tipo, no uno igual. Copiarlos daría dos
   definiciones que compilan mientras coincidan y dejan de coincidir sin que nada falle. */
export type { Indicador, SujetoDelCockpit };

export interface Cockpit extends DineroDelMes {
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
 * @param tareasPendientes Viene contado de Mi Día. No se recalcula acá: dos conteos del mismo hecho
 *   pueden discrepar, y `app/api/closer/mi-dia/route.ts:20` ya lo dice.
 * @param sujeto De quién son los números. Antes era `closerId: string | null`, y este `@param`
 *   seguía nombrándolo — quedó mal el día que el nulo se volvió ambiguo y la unión lo reemplazó.
 */
export async function cockpitDelMes(
  zonaHoraria: string,
  tareasPendientes: number,
  sujeto: SujetoDelCockpit,
): Promise<Cockpit> {
  /* Las tres cifras de dinero salen de `dineroDelMes`, que es donde viven desde el 2026-09-20.
     No es una reorganizacion: Sales necesita las mismas tres, y dos consultas al mismo hecho
     divergen sin que nada falle. El encabezado de ese archivo tiene el motivo entero. */
  const dinero = await dineroDelMes(zonaHoraria, sujeto);

  // Los conteos por etiqueta. Éstos SÍ tienen dato hoy, y son la mitad útil del cockpit
  // mientras Avanzar no exista.
  const porEtiqueta = await datos()
    .selectFrom('contactos')
    .where('territorio', '=', 'closer')
    /* ── Y ACÁ TAMBIÉN, O LOS DOS NÚMEROS DE ABAJO SERÍAN DE OTRA GENTE ──────
     *
     * Los conteos por etiqueta —con cita agendada, no-shows— son de la MISMA persona que el número
     * grande. Sin este corte, un closer vería sus tres ventas arriba y los 152 contactos de la
     * empresa abajo: dos bases distintas en la misma tarjeta, que es exactamente el defecto que la
     * migración 020 vino a cerrar cuando el número grande era de la empresa y el anillo de al lado
     * de quien miraba.
     *
     * Se corta por `crm_asignado_a` y no por `registrado_por`: son dos ejes distintos y ninguno
     * sirve para lo del otro. Un contacto es de un closer porque el CRM se lo asignó; un resultado
     * es de un closer porque él lo registró acá. Cruzarlos daría los contactos de quien registró.
     *
     * `empresa` y `nadie` no cortan: los dos miran el territorio entero, que es lo correcto para
     * quien administra y lo único posible cuando no hay closers. */
    .$if(sujeto.tipo === 'persona' && sujeto.crmUsuarioId !== null, (q) =>
      q.where(
        'crm_asignado_a',
        '=',
        (sujeto as { crmUsuarioId: string }).crmUsuarioId,
      ),
    )
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
    /* El esparcido trae `mes`, `cobrado`, `ventas` y `acuerdos` tal como los calcula
       `dineroDelMes`. Se esparce y no se copia campo por campo: una copia compila igual el día que
       ese módulo agregue un campo, y el campo nuevo no llegaría acá sin que nada fallara. */
    ...dinero,
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
