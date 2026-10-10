// De qué citas habla este producto. Los predicados, en UN solo lugar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTO IMPIDE YA HABÍA OCURRIDO NUEVE VECES
//
// `indicadoresDeCitas.ts` tenía los tres predicados en constantes locales, con el motivo escrito
// arriba: *«repetidos, el día que alguien agregue una cifra la escribe con un filtro apenas
// distinto, las dos conviven, y la tarjeta muestra números que no cuadran entre sí mientras cada
// uno se ve bien por separado»*.
//
// Medido el 2026-09-21, antes de escribir este archivo: **`ghl_calendario_id is not null` aparecía
// once veces en el repositorio, en nueve módulos** —dos de ellas en comentarios, nueve en código—.
// O sea que la advertencia describía algo que ya había pasado, y cada cifra nueva de los últimos
// tres departamentos agregó una copia.
//
// La regla 9 del departamento de Sales lo dice con su commit: *«el filtro de citas "alcanzables y no
// descartadas" es del sistema, no de una pantalla»* (`docs/OTROS/estado actual/05-SALES.md:474-481@51b5d25`).
//
// ── SON DOS PREGUNTAS DISTINTAS, Y CONFUNDIRLAS ES EL DEFECTO FINO ──────────
//
// De las nueve copias en código, **ocho no preguntaban lo mismo que la novena**:
//
//   · `alcanzable(alias)` pregunta por una fila de `citas`: **¿esta cita sigue viva para el
//     barrido?** Es un predicado sobre la cita.
//   · `tieneCitaAlcanzable(alias)` pregunta por una fila de `contactos`: **¿esta persona llegó a
//     tener alguna?** Es un `exists` sobre otra tabla, y su unidad es el contacto.
//
// Escribir la segunda como si fuera la primera da una cifra por CITAS con el rótulo de CONTACTOS, y
// la diferencia es real: medido el 2026-09-20, 226 citas alcanzables son 201 contactos. Un 12 % de
// diferencia que ninguna prueba ve, porque las dos consultas están bien escritas.
//
// ── POR QUÉ FUNCIONES CON ALIAS Y NO CONSTANTES ─────────────────────────────
//
// Porque los fragmentos originales referencian `citas.org_id` sin calificar, y la consulta hermana
// del mismo archivo usa `citas ci` (`indicadoresDeCitas.ts:267`). Una constante exportada se ata a
// un nombre de tabla y revienta en cuanto alguien pone un alias — o peor, en un `join` con dos
// tablas se ata a la equivocada y devuelve filas de la otra sin ningún error.
// ═══════════════════════════════════════════════════════════════════════════════

import { type RawBuilder, sql } from 'kysely';

import { ESTADO_NO_APARECIO, ESTADOS_CANCELADOS } from '../ghl/calendarios.ts';
import { ETIQUETAS_DE_DESCARTE } from '../ghl/contrato.ts';

/**
 * **¿El barrido todavía puede refrescar esta cita?**
 *
 * Las de `ghl_calendario_id` nulo son anteriores a la migración `038` y el CRM ya no devuelve sus
 * eventos, así que su estado no va a cambiar nunca más — contarlas es contar una foto vieja como si
 * fuera de hoy.
 *
 * @param alias El nombre con el que la consulta llama a la tabla `citas`. Sin alias, `citas`.
 */
export function alcanzable(alias = 'citas'): RawBuilder<boolean> {
  return sql<boolean>`${sql.raw(alias)}.ghl_calendario_id is not null`;
}

/**
 * **¿El CRM da esta cita por cancelada?**
 *
 * El vocabulario es de GoHighLevel y sale de `ESTADOS_CANCELADOS`, la misma lista que usa
 * `noCancelada()` en `citas.ts`. Se compara en minúscula porque el proveedor no garantiza la caja.
 */
export function cancelada(alias = 'citas'): RawBuilder<boolean> {
  return sql<boolean>`lower(coalesce(${sql.raw(alias)}.estado_ghl, '')) = any(${sql.val(ESTADOS_CANCELADOS)})`;
}

/**
 * **¿El contacto de esta cita está descartado por nosotros?**
 *
 * `exists` sobre `unnest` y no un `&&` de arreglos: las etiquetas se guardan crudas y GoHighLevel no
 * garantiza la caja, así que hay que comparar en minúscula — y `&&` no deja. El motivo completo, con
 * el censo de etiquetas, está en `ETIQUETAS_DE_DESCARTE`.
 *
 * **No se mezcla con `cancelada`.** Una cita que el cliente canceló y una que descartamos nosotros
 * son dos hechos distintos, y sumarlas daba una tasa que era «mitad descarte propio» — el defecto
 * que el commit `9931f4d` corrigió.
 */
export function descartado(alias = 'citas'): RawBuilder<boolean> {
  const a = sql.raw(alias);
  return sql<boolean>`exists (
    select 1 from negocio.contactos ct
     where ct.org_id = ${a}.org_id and ct.id = ${a}.contacto_id
       and ${contactoDescartado('ct')})`;
}

/**
 * **¿El CALENDARIO dice que esta persona no apareció?**
 *
 * ── ES LA ÚNICA SEÑAL DE ASISTENCIA QUE HOY EXISTE, Y CASI SE PIERDE ────────
 *
 * `citas.asistio` —la que escribe Avanzar— es **nula en las 327 filas de la base**, y por eso todo
 * este departamento la declara como un hueco. Pero el censo de `estado_ghl` del 2026-09-21 dice
 * otra cosa:
 *
 *     cancelled  163  ·  confirmed  149  ·  noshow  15
 *
 * **Quince citas que el calendario marcó como plantón**, las quince alcanzables. O sea que la
 * asistencia no está completamente a oscuras: el lado negativo se observa y el positivo no
 * —`showed` no aparece ni una vez—, que es una asimetría que hay que decir y no promediar.
 *
 * `ESTADO_NO_APARECIO` estaba declarada desde la `038` y **nadie la leía**: una constante con el
 * nombre correcto al lado de una tabla que ya traía el dato.
 *
 * ── NO SE SUMA CON `asistio`, NUNCA ─────────────────────────────────────────
 *
 * Son dos fuentes de la misma pregunta y sólo una es nuestra. Meterlas en un mismo denominador daría
 * un show rate con dos definiciones adentro, y `salidas.ts:183-196` ya documenta lo que cuesta
 * inferir asistencia de donde no corresponde. Cada una viaja con su nombre y su conteo.
 */
export function marcadaComoPlanton(alias = 'citas'): RawBuilder<boolean> {
  return sql<boolean>`lower(coalesce(${sql.raw(alias)}.estado_ghl, '')) = ${sql.val(ESTADO_NO_APARECIO)}`;
}

/**
 * **¿Esta PERSONA llegó a tener alguna cita alcanzable?**
 *
 * Es el predicado de «agendó», y su unidad es el CONTACTO, no la cita. Ésta es la que estaba
 * copiada ocho veces —en Acquisition, Creative, Conversion y en las dos cifras de Lead Flow— y la
 * que más fácil se confunde con `alcanzable`.
 *
 * `exists` y no un `join` con `count`: un contacto con dos citas pesaría doble. Ese defecto ya se
 * midió una vez y está anotado en `docs/OTROS/estado actual/02-CREATIVE.md:445-448`, donde infló una pieza de
 * 109 a 112.
 *
 * @param alias El nombre con el que la consulta llama a la tabla `contactos`.
 * @param reservadaHaceDias Si se pide, «agendó» A ESA EDAD: sólo cuentan las citas reservadas antes de
 *   `now() - reservadaHaceDias días`. Lo usa la ventana anterior de Acquisition para que sus contactos,
 *   que llevan más tiempo en la base, no tengan más tiempo para agendar (`embudosDeAcquisition.ts`).
 *   Una cita sin `reservada_el` —las sincronizadas antes de la `043`— se mide por su inicio, que es
 *   siempre posterior a la reserva: una cota prudente, que puede dejar afuera una cita reservada a
 *   tiempo y nunca meter una reservada tarde. Va acá, y no copiada allá, por lo mismo que las ocho
 *   copias de arriba: un segundo «agendó» diverge sin que nada falle.
 */
export function tieneCitaAlcanzable(alias = 'contactos', reservadaHaceDias: number | null = null): RawBuilder<boolean> {
  const a = sql.raw(alias);
  const aTiempo =
    reservadaHaceDias === null
      ? sql``
      : sql` and coalesce(ci.reservada_el, ci.inicio_el) < now() - make_interval(days => ${reservadaHaceDias})`;
  return sql<boolean>`exists (
    select 1 from negocio.citas ci
     where ci.org_id = ${a}.org_id and ci.contacto_id = ${a}.id
       and ${alcanzable('ci')}${aTiempo})`;
}

/**
 * **¿Esta PERSONA está descartada por nosotros?** La misma pregunta que `descartado`, sobre una fila
 * de `contactos` en vez de una de `citas`.
 *
 * Existe por la misma razón que `tieneCitaAlcanzable` al lado de `alcanzable`: Leads Portal marca a
 * cada persona de la cohorte, y copiar el `unnest` con la lista sería la décima copia de la que este
 * archivo habla. `descartado` lo usa por dentro, así que las dos no pueden divergir.
 *
 * @param alias El nombre con el que la consulta llama a la tabla `contactos`.
 */
export function contactoDescartado(alias = 'contactos'): RawBuilder<boolean> {
  return sql<boolean>`exists (
    select 1 from unnest(${sql.raw(alias)}.etiquetas) e
     where lower(e) = any(${sql.val(ETIQUETAS_DE_DESCARTE)}))`;
}

/**
 * **¿Esta PERSONA es un calificado?** Agendó y no está descartada (A14-07 de
 * `docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`).
 *
 * Vivía como una expresión local de Acquisition, y Conversion pide la misma cifra (CV15-09): dos copias de
 * «calificado» divergen el día que alguien cambie una, y las dos pantallas dirían «35 calificados» de gente
 * distinta.
 *
 * El descarte se mira como está hoy aunque se pida una edad: las etiquetas no tienen fecha. Por eso los
 * calificados no comparan contra una ventana anterior en ninguna pantalla.
 *
 * Entre paréntesis porque son dos condiciones: sin ellos, un `not ${esCalificado(…)}` negaría sólo la
 * primera.
 *
 * @param alias El nombre con el que la consulta llama a la tabla `contactos`.
 * @param reservadaHaceDias La edad de `tieneCitaAlcanzable`, para una ventana anterior.
 */
export function esCalificado(alias = 'contactos', reservadaHaceDias: number | null = null): RawBuilder<boolean> {
  return sql<boolean>`(${tieneCitaAlcanzable(alias, reservadaHaceDias)} and not ${contactoDescartado(alias)})`;
}

/**
 * **¿Esta PERSONA canceló todo lo que reservó?** Tuvo alguna cita alcanzable, y ninguna de sus citas
 * alcanzables sigue sin cancelar.
 *
 * Es la pregunta de la cifra «Cancelaron» que pide Conversion (CV15-18 de
 * `docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`), y su unidad es la persona: quien canceló y volvió a
 * reservar no canceló. **No es la tasa de cancelación**
 * de `indicadoresDeCitas.ts`, que cuenta citas en una ventana móvil; las dos se rotulan distinto para que
 * nadie las compare.
 *
 * Las citas congeladas no cuentan ni para un lado ni para el otro, como en `tieneCitaAlcanzable`: su estado
 * es una foto que el CRM ya no actualiza.
 *
 * @param alias El nombre con el que la consulta llama a la tabla `contactos`.
 */
export function todasSusCitasCanceladas(alias = 'contactos'): RawBuilder<boolean> {
  const a = sql.raw(alias);
  return sql<boolean>`(${tieneCitaAlcanzable(alias)} and not exists (
    select 1 from negocio.citas cv
     where cv.org_id = ${a}.org_id and cv.contacto_id = ${a}.id
       and ${alcanzable('cv')} and not ${cancelada('cv')}))`;
}

/**
 * **¿Esta cita ya debería haber ocurrido?** Alcanzable, no cancelada, y su horario ya empezó.
 *
 * Son las tres condiciones con que Avanzar ofrece cerrar una cita (`citasParaCerrar.ts`), y las que
 * usan el tercer eslabón de la cadena de Sales y el `sin_registrar` de Leads Portal. Tienen que ser
 * las mismas en los tres: si una pantalla acusara de no registrar sobre otra población que la que
 * Avanzar ofrece, estaría acusando a gente a la que nunca se le pidió.
 *
 * Entre paréntesis porque son tres condiciones: sin ellos, un `not ${citaCerrable(…)}` negaría sólo
 * la primera y dejaría las otras dos afirmadas, sin ningún error.
 */
export function citaCerrable(alias = 'citas'): RawBuilder<boolean> {
  return sql<boolean>`(${alcanzable(alias)} and not ${cancelada(alias)} and ${sql.raw(alias)}.inicio_el < now())`;
}
