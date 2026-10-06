// El único escritor de `negocio.briefs_del_closer` (migración 074) y lo que lee la pantalla del Closer (AG12 de
// los agentes; `docs/OTROS/agentes/fichas/F13-CLOSER-Y-BRIEF.md`). **Corre dentro de `conOrganizacion(`.**

import { datos } from '../../datos/contexto.ts';
import type { Brief } from './brief.ts';
import { formulariosDe } from './entrada.ts';

export interface BriefGuardado {
  brief: Brief;
  sinFormulario: boolean;
  huella: string;
  modelo: string;
  generadoEl: string;
}

/** Guarda el Brief de una cita, o lo reemplaza si se regeneró. */
export async function guardarBrief(
  citaId: string,
  b: { brief: Brief; sinFormulario: boolean; huella: string; modelo: string; generadoPor: string | null },
): Promise<void> {
  const columnas = {
    brief: JSON.stringify(b.brief),
    sin_formulario: b.sinFormulario,
    huella: b.huella,
    modelo: b.modelo,
    generado_el: new Date(),
    generado_por: b.generadoPor,
  };
  await datos()
    .insertInto('briefs_del_closer')
    .values({ cita_id: citaId, ...columnas })
    .onConflict((oc) => oc.columns(['org_id', 'cita_id']).doUpdateSet(columnas))
    .execute();
}

export async function leerBrief(citaId: string): Promise<BriefGuardado | null> {
  const f = await datos()
    .selectFrom('briefs_del_closer')
    .select(['brief', 'sin_formulario', 'huella', 'modelo', 'generado_el'])
    .where('cita_id', '=', citaId)
    .executeTakeFirst();
  if (!f) return null;
  return { brief: f.brief as Brief, sinFormulario: f.sin_formulario, huella: f.huella, modelo: f.modelo, generadoEl: f.generado_el.toISOString() };
}

/** La marca de cada cita en la cola de Mi Día: si su Brief está listo, y si el contacto no tiene formulario. */
export interface MarcaDelBrief {
  listo: boolean;
  sinFormulario: boolean;
}

/**
 * Las marcas de esas citas. «Sin formulario» se mira aunque no haya Brief, con la misma regla que el Brief
 * (`formulariosDe`). No se le pide nada al modelo.
 */
export async function marcasDelBrief(citas: readonly { citaId: string; contactoId: string }[]): Promise<Record<string, MarcaDelBrief>> {
  if (citas.length === 0) return {};
  const listos = new Set(
    (await datos().selectFrom('briefs_del_closer').select('cita_id').where('cita_id', 'in', citas.map((c) => c.citaId)).execute()).map((f) => f.cita_id),
  );
  const formularios = await formulariosDe(citas.map((c) => c.contactoId));
  return Object.fromEntries(
    citas.map((c) => [c.citaId, { listo: listos.has(c.citaId), sinFormulario: (formularios.get(c.contactoId) ?? []).length === 0 }]),
  );
}
