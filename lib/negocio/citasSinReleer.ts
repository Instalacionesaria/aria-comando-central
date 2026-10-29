// Cuántas citas del período ya no se releen: el aviso de frescura de Sales y de Conversion (la `108`, paso 3).
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HACE FALTA DECIRLO
//
// El barrido del calendario mira **14 días atrás** (`DIAS_ATRAS` de `citas.ts`). Una cita que empezó antes ya no se
// relee: su estado queda en el último que vimos. Medido el 2026-10-29: 285 citas alcanzables, 265 fuera de la ventana y
// **95 de ésas todavía en `confirmed`, `booked` o `new`**, sin resultado. Una pantalla de 30 días cuenta esas citas
// con un estado que puede haber cambiado en el CRM, y no hay forma de verlo desde la cifra.
//
// La relectura larga (traer las de más de 14 días) NO se hace por ahora: cada cambio que leyera dispararía los eventos
// de la `106` con fecha de hoy. Lo honesto mientras tanto es decirlo: «N de M citas del período no se releen desde hace
// más de 14 días». M son las alcanzables del período —sin las borradas en el CRM, que `alcanzable()` ya saca—; N, las
// que hace más de 14 días que el barrido no toca. Cero de N es silencio: el texto es `null` y la pantalla no dibuja nada.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { DIAS_ATRAS } from './citas.ts';
import { alcanzable } from './citasAlcanzables.ts';

export interface CitasSinReleer {
  /** Las citas alcanzables que empezaron en el período (las de Sales: «citas que ocurrieron en los últimos N días»). */
  total: number;
  /** De ésas, las que hace más de `dias` días que el barrido no relee. */
  sinReleer: number;
  /** Los días de la ventana del barrido: el «14» del texto sale de acá y no de un literal. */
  dias: number;
  /** La frase, o `null` sin ninguna sin releer (la regla del silencio). */
  texto: string | null;
}

/**
 * Las citas del período que ya no se releen. Se corre dentro de `conOrganizacion(`: la política de fila deja ver las
 * de la empresa o del cliente a la vista, que son las que cuenta la pantalla.
 *
 * @param dias Los días del período (`periodo.dias`).
 */
export async function citasSinReleer(dias: number): Promise<CitasSinReleer> {
  const f = await datos()
    .selectFrom('citas')
    .select([
      sql<number>`count(*)::int`.as('total'),
      sql<number>`(count(*) filter (where sincronizado_el is null
                     or sincronizado_el < now() - make_interval(days => ${DIAS_ATRAS})))::int`.as('sin_releer'),
    ])
    .where(alcanzable('citas'))
    .where(sql<boolean>`inicio_el >= now() - make_interval(days => ${dias})`)
    .where(sql<boolean>`inicio_el < now()`)
    .executeTakeFirst();
  const total = Number(f?.total ?? 0);
  const sinReleer = Number(f?.sin_releer ?? 0);
  return { total, sinReleer, dias: DIAS_ATRAS, texto: textoDeCitasSinReleer(sinReleer, total, DIAS_ATRAS) };
}

/** La frase del aviso. Pura, para probarla sin base. `null` cuando no hay nada que avisar. */
export function textoDeCitasSinReleer(sinReleer: number, total: number, dias: number): string | null {
  if (sinReleer <= 0) return null;
  const citas = total === 1 ? 'cita' : 'citas';
  const verbo = sinReleer === 1 ? 'no se relee' : 'no se releen';
  return `${sinReleer} de ${total} ${citas} del período ${verbo} desde hace más de ${dias} días.`;
}
