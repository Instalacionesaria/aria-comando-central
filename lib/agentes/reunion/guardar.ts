// El único escritor de `negocio.reuniones_del_dia` (migración 075) y su lectura (AG15 de los agentes; `04`,
// AG-71 a AG-76). **Corre dentro de `conOrganizacion(`.**

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import type { TemaDeLaReunion } from './temas.ts';

/** Lo que el modelo ordenó y redactó, ya validado: el orden de las claves y una frase por clave. */
export interface RedaccionDeLaReunion {
  orden: string[];
  textos: Record<string, string>;
  modelo: string;
}

export interface ReunionGuardada {
  dia: string;
  temas: TemaDeLaReunion[];
  redaccion: RedaccionDeLaReunion | null;
  corrioEl: Date;
}

/** Guarda los temas del día. Una vez por día: si ya hay, no la pisa (la pasada no corre dos veces el mismo día). */
export async function guardarReunion(dia: string, temas: readonly TemaDeLaReunion[]): Promise<void> {
  await datos()
    .insertInto('reuniones_del_dia')
    .values({ dia, temas: JSON.stringify(temas), redaccion: null })
    .onConflict((oc) => oc.columns(['org_id', 'dia']).doNothing())
    .execute();
}

export async function guardarRedaccionDeLaReunion(dia: string, redaccion: RedaccionDeLaReunion): Promise<void> {
  await datos().updateTable('reuniones_del_dia').set({ redaccion: JSON.stringify(redaccion) }).where(sql<boolean>`dia = ${dia}::date`).execute();
}

/** La de hoy, o la última que corrió. */
export async function ultimaReunion(): Promise<ReunionGuardada | null> {
  const f = await datos()
    .selectFrom('reuniones_del_dia')
    .select([sql<string>`to_char(dia, 'YYYY-MM-DD')`.as('dia'), 'temas', 'redaccion', 'corrio_el'])
    .orderBy('dia', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (!f) return null;
  return { dia: f.dia, temas: f.temas as TemaDeLaReunion[], redaccion: (f.redaccion as RedaccionDeLaReunion | null) ?? null, corrioEl: f.corrio_el };
}

/**
 * Los temas en el orden que vale: el del modelo si redactó, si no el de las reglas; cada uno con su texto (el
 * redactado si lo hay). Pura.
 */
export function temasEnSuOrden(r: Pick<ReunionGuardada, 'temas' | 'redaccion'>): TemaDeLaReunion[] {
  if (!r.redaccion) return r.temas;
  const porClave = new Map(r.temas.map((t) => [t.clave, t]));
  const ordenados = r.redaccion.orden.map((c) => porClave.get(c)).filter((t): t is TemaDeLaReunion => t !== undefined);
  // Lo que el orden del modelo no nombró va al final, en el orden de las reglas: no se pierde un tema.
  const faltan = r.temas.filter((t) => !r.redaccion!.orden.includes(t.clave));
  return [...ordenados, ...faltan].map((t) => ({ ...t, texto: r.redaccion!.textos[t.clave] ?? t.texto }));
}
