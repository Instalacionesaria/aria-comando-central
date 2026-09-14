// LA TASA DE CANCELACIÓN, y sobre qué citas se cuenta. El primer número real de Appointment Flow.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA CIFRA QUE ESTE ARCHIVO EXISTE PARA NO DAR
//
// Medido el 2026-09-13 y reportado como «160 de 316 canceladas, el 50,6 %». **Ese número estaba
// sesgado a la baja**, y cómo apareció importa más que el número: la tasa subía hacia el presente
// —61,9 % a siete días, 60,1 % a catorce, 52,9 % a treinta, 50,6 % en total— y eso se parece a una
// tendencia. No lo era.
//
// Partiendo la población el 2026-09-14:
//
//     con calendario (el barrido todavía las alcanza)   199 citas   120 canceladas   60,3 %
//     congeladas (anteriores a la migración 038)        101 citas    31 canceladas   30,7 %
//
// Las 101 congeladas tienen `ghl_calendario_id` nulo, dejaron de sincronizarse el 2026-09-06 y el
// CRM ya no devuelve sus eventos — comprobado: catorce caen DENTRO de la ventana actual del barrido
// y aun así no se refrescan. Su estado quedó congelado en el de ese día.
//
// ── LA REGLA QUE SALE DE AHÍ, Y VALE PARA TODA CIFRA POR PERÍODO ────────────
//
// **Una ventana más vieja no es una muestra más grande.** Cuanto más atrás mira un número en este
// sistema, mayor es la proporción de citas que el sistema dejó de mirar. Así que se cuenta sobre lo
// que el barrido alcanza, y lo congelado se declara aparte — nunca se suma en silencio.
//
// Y desde el 2026-09-14 esa exclusión tiene además un motivo de producto, no sólo técnico:
// **decidido que sólo cuentan las citas agendadas desde que Comando Central existe** (la primera
// guardada es del 2026-08-26). Las anteriores no importan, así que excluirlas no es una pérdida que
// haya que compensar algún día — es el alcance.
//
// ── Y POR QUÉ LA VENTANA VA POR `inicio_el` Y NO POR `reservada_el` ─────────
//
// `reservada_el` es la fecha nueva y tentadora —contestaría «de las que se agendaron esta semana,
// cuántas se cayeron»— pero su cobertura es parcial y crece sola: las citas anteriores a la `043` no
// la tienen. Una tasa sobre una columna que se está llenando cambia cada día sin que cambie el
// negocio. `inicio_el` está en 316 de 316, así que la ventana es completa por construcción y la
// única incompletitud que queda es la que este archivo declara.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { ESTADOS_CANCELADOS } from '../ghl/calendarios.ts';

/**
 * La tasa de cancelación de una ventana, con lo que quedó afuera.
 *
 * `aviso` es `null` cuando no hay nada que decir, y entonces **la pantalla no dibuja nada**. Es la
 * misma regla de silencio que usa `Frescura`, y es la que hace que un aviso signifique algo: un
 * cartel que aparece siempre se aprende a ignorar.
 */
export interface Cancelacion {
  /** Citas alcanzables en la ventana. `0` = no hay base, y entonces `tasa` es `null`. */
  citas: number;
  canceladas: number;
  /** De 0 a 100, redondeada a un decimal. `null` cuando no hay citas: un 0 % sería una afirmación. */
  tasa: number | null;
  /** Cuántas citas de la ventana quedaron fuera del conteo por estar congeladas. */
  congeladas: number;
  /** El texto ya armado, o `null` si no hay nada que advertir. */
  aviso: string | null;
  dias: number;
}

/**
 * Cuántos días mira la cifra.
 *
 * **Catorce y no treinta**, y el motivo es el sesgo de arriba: la ventana trasera del barrido son
 * catorce días, así que más allá de eso la proporción de citas congeladas crece y la tasa se
 * ensucia. Pedir una ventana más larga no trae más señal: trae más citas que el sistema dejó de
 * mirar.
 */
export const DIAS_DE_LA_TASA = 14;

export async function tasaDeCancelacion(dias = DIAS_DE_LA_TASA): Promise<Cancelacion> {
  const fila = await datos()
    .selectFrom('citas')
    .select([
      /* Alcanzables: las que el barrido todavía puede refrescar. Las de `ghl_calendario_id` nulo son
         anteriores a la `038` y el CRM ya no devuelve sus eventos, así que su estado no va a cambiar
         nunca más — contarlas es contar una foto vieja como si fuera de hoy. */
      sql<number>`count(*) filter (where ghl_calendario_id is not null)`.as('citas'),
      sql<number>`count(*) filter (
        where ghl_calendario_id is not null
          and lower(coalesce(estado_ghl, '')) = any(${sql.val(ESTADOS_CANCELADOS)})
      )`.as('canceladas'),
      sql<number>`count(*) filter (where ghl_calendario_id is null)`.as('congeladas'),
    ])
    /* La ventana la calcula la BASE y no la aplicación: es la única forma de que el «ahora» sea el
       mismo reloj que escribió las filas. Es el mismo recurso que usa `frescuraDe`. */
    .where(sql<boolean>`inicio_el >= now() - make_interval(days => ${dias})`)
    .where(sql<boolean>`inicio_el < now()`)
    .executeTakeFirst();

  const citas = Number(fila?.citas ?? 0);
  const canceladas = Number(fila?.canceladas ?? 0);
  const congeladas = Number(fila?.congeladas ?? 0);

  return {
    citas,
    canceladas,
    congeladas,
    /* Sin citas NO hay tasa. Un `0 %` con cero citas se lee como «no se cancela ninguna», que es una
       afirmación sobre el negocio hecha con cero datos — el cero indistinguible que este proyecto
       persigue en todas partes. */
    tasa: citas === 0 ? null : Math.round((canceladas / citas) * 1000) / 10,
    aviso: avisoDe(citas, congeladas, dias),
    dias,
  };
}

/**
 * Qué advertir, y **cuándo callarse**.
 *
 * Tres estados y no dos, en este orden:
 *
 *   1 · Sin citas alcanzables: no hay cifra, y hay que decir por qué o el vacío se lee como un cero.
 *   2 · Con citas congeladas en la ventana: la cifra vale, y hay que decir sobre cuántas NO se contó.
 *   3 · Todo lo demás: **`null`**, y la pantalla no dibuja nada.
 *
 * El tercero es el que hace que los otros dos signifiquen algo. Hoy hay congeladas y el aviso
 * aparece; el día que dejen de caer en la ventana —porque son todas anteriores al 2026-09-10— el
 * aviso desaparece solo, sin que nadie tenga que acordarse de sacarlo.
 */
function avisoDe(citas: number, congeladas: number, dias: number): string | null {
  if (citas === 0) {
    return congeladas > 0
      ? `No hay citas de los últimos ${dias} días que el sistema pueda seguir. Las ${congeladas} que ` +
          'hay quedaron congeladas: el CRM ya no devuelve sus eventos, así que su estado no cambia.'
      : `No hubo citas en los últimos ${dias} días, así que no hay tasa que calcular.`;
  }
  if (congeladas > 0) {
    return `No se cuentan ${congeladas} cita(s) de este período: quedaron congeladas y el CRM ya no ` +
      'devuelve sus eventos, así que contarlas mezclaría una foto vieja con el dato de hoy.';
  }
  return null;
}
