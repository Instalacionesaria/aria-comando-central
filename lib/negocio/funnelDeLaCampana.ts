// A qué funnel pertenece cada campaña. **El único escritor de `negocio.funnels_de_campana`** (`066`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// PARA QUÉ
//
// El front de Acquisition reparte las campañas en los tres funnels del prototipo, y ningún dato dice
// cuál es cuál (la cabecera de la `066` lo mide). Lo decide una persona con `credenciales.editar`,
// campaña por campaña, y esto lo guarda (docs/acquisition/14, A14-03).
//
// ── LA CAMPAÑA SE IDENTIFICA POR SU ID, NUNCA POR SU NOMBRE ────────────────
//
// El nombre de una campaña se puede cambiar en Meta; el identificador no. Y dos campañas pueden
// llamarse igual. Así que la asignación va al `meta_campana_id` (A1-10), y existe si GoHighLevel listó
// esa campaña (`negocio.campanas`, `065`): la clave foránea de la `066` lo hace cumplir del lado de
// la base, y `existeLaCampana` lo dice antes, con un 404 en vez de un `23503`.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';

/** Los tres funnels del prototipo, con las claves que el prototipo usa (`FUNNELS`). */
export const FUNNELS = ['leadform', 'profile', 'booking'] as const;
export type Funnel = (typeof FUNNELS)[number];

/** Un funnel válido, o `null`. La lista es cerrada: la `066` tiene el mismo `check`. */
export function funnelValido(v: unknown): Funnel | null {
  return typeof v === 'string' && (FUNNELS as readonly string[]).includes(v) ? (v as Funnel) : null;
}

/** Una asignación, tal como la lee la pantalla. */
export interface FunnelDeCampana {
  campana: string;
  funnel: Funnel;
  /** Cuándo se asignó por última vez, en ISO. */
  actualizadoEl: string;
}

/** Si la campaña es de la empresa: GoHighLevel la listó (`065`). Bajo RLS, una ajena no existe. */
export async function existeLaCampana(campana: string): Promise<boolean> {
  const fila = await datos()
    .selectFrom('campanas')
    .select('meta_campana_id')
    .where('meta_campana_id', '=', campana)
    .executeTakeFirst();
  return fila !== undefined;
}

/**
 * Las asignaciones de la empresa, por campaña.
 *
 * Una fila con un funnel que hoy no es válido **no viaja**. La `066` lo impide con su `check`, así que
 * no debería existir; pero esta lectura es la que alimenta la pantalla, y un funnel desconocido no
 * tiene tarjeta donde dibujarse.
 */
export async function funnelsDeLasCampanas(): Promise<FunnelDeCampana[]> {
  const filas = await datos()
    .selectFrom('funnels_de_campana')
    .select(['meta_campana_id', 'funnel', 'actualizado_el'])
    .orderBy('meta_campana_id')
    .execute();

  const salida: FunnelDeCampana[] = [];
  for (const f of filas) {
    const funnel = funnelValido(f.funnel);
    if (funnel === null) continue;
    salida.push({
      campana: f.meta_campana_id,
      funnel,
      actualizadoEl: new Date(f.actualizado_el).toISOString(),
    });
  }
  return salida;
}

/**
 * Asigna o reemplaza el funnel de una campaña. Una campaña tiene UN funnel: el segundo reemplaza.
 *
 * El funnel tiene que llegar ya validado por la ruta; acá se vuelve a mirar igual, porque este
 * archivo es el único escritor y no puede depender de que todos los que lo llamen se acuerden.
 *
 * @returns `null` si se guardó, o por qué no.
 */
export async function asignarFunnel(
  asignacion: { campana: string; funnel: string },
  /** `null` cuando lo asigna un rol de plataforma sobre otra organización (`autorDelCambio`). */
  actor: string | null,
): Promise<'funnel_invalido' | 'sin_campana' | null> {
  const funnel = funnelValido(asignacion.funnel);
  if (funnel === null) return 'funnel_invalido';
  if (!(await existeLaCampana(asignacion.campana))) return 'sin_campana';

  const ahora = new Date();
  await datos()
    .insertInto('funnels_de_campana')
    .values({
      meta_campana_id: asignacion.campana,
      funnel,
      actualizado_el: ahora,
      actualizado_por: actor,
    } as never)
    .onConflict((oc) =>
      // Las DOS columnas de la clave primaria: con una sola, PostgreSQL no encuentra el índice (`42P10`).
      oc.columns(['org_id', 'meta_campana_id']).doUpdateSet({
        funnel,
        actualizado_el: ahora,
        actualizado_por: actor,
      } as never),
    )
    .execute();
  return null;
}

/**
 * Saca el funnel de una campaña: vuelve a «Sin funnel».
 *
 * ── UNA SOLA SENTENCIA, Y NO UN `select` SEGUIDO DE UN `delete` ────────────
 *
 * Con dos sentencias, dos quitas simultáneas —un doble clic— leían las dos la fila, la borraba una,
 * y las dos auditaban: dos filas de «quitado» por un solo borrado. Y una quita junto a una
 * reasignación auditaba el funnel de ANTES de la reasignación, aunque borrara el de después. Con
 * `returning`, lo que vuelve es la fila que se borró de verdad, y nada si otra transacción la borró
 * primero. Lo encontró la revisión de AQ-2.
 *
 * @returns el funnel que tenía —para que la auditoría diga CUÁL—, o `null` si no tenía ninguno. Es
 *   el texto guardado tal cual, sin validarlo: la auditoría registra lo que se sacó, fuera lo que fuera.
 */
export async function quitarFunnel(campana: string): Promise<string | null> {
  const borrada = await datos()
    .deleteFrom('funnels_de_campana')
    .where('meta_campana_id', '=', campana)
    .returning('funnel')
    .executeTakeFirst();
  return borrada?.funnel ?? null;
}
