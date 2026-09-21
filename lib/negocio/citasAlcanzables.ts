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
// La regla 9 del departamento de Sales lo dice con su commit: *«el filtro "alcanzables y no
// descartadas" es del sistema, no de una pantalla»* (`docs/estado actual/05-SALES.md:193-195`).
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
// del mismo archivo usa `citas ci` (`indicadoresDeCitas.ts:239`). Una constante exportada se ata a
// un nombre de tabla y revienta en cuanto alguien pone un alias — o peor, en un `join` con dos
// tablas se ata a la equivocada y devuelve filas de la otra sin ningún error.
// ═══════════════════════════════════════════════════════════════════════════════

import { type RawBuilder, sql } from 'kysely';

import { ESTADOS_CANCELADOS } from '../ghl/calendarios.ts';
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
    select 1 from negocio.contactos ct, unnest(ct.etiquetas) e
     where ct.org_id = ${a}.org_id and ct.id = ${a}.contacto_id
       and lower(e) = any(${sql.val(ETIQUETAS_DE_DESCARTE)}))`;
}

/**
 * **¿Esta PERSONA llegó a tener alguna cita alcanzable?**
 *
 * Es el predicado de «agendó», y su unidad es el CONTACTO, no la cita. Ésta es la que estaba
 * copiada ocho veces —en Acquisition, Creative, Conversion y en las dos cifras de Lead Flow— y la
 * que más fácil se confunde con `alcanzable`.
 *
 * `exists` y no un `join` con `count`: un contacto con dos citas pesaría doble. Ese defecto ya se
 * midió una vez y está anotado en `docs/estado actual/02-CREATIVE.md:287`, donde infló una pieza de
 * 109 a 112.
 *
 * @param alias El nombre con el que la consulta llama a la tabla `contactos`.
 */
export function tieneCitaAlcanzable(alias = 'contactos'): RawBuilder<boolean> {
  const a = sql.raw(alias);
  return sql<boolean>`exists (
    select 1 from negocio.citas ci
     where ci.org_id = ${a}.org_id and ci.contacto_id = ${a}.id
       and ${alcanzable('ci')})`;
}
