// Los incidentes: guardarlos, leerlos y marcarlos revisados. Migración 067.
//
// ═══════════════════════════════════════════════════════════════════════════════
// GUARDAR NUNCA ROMPE LO QUE SE ESTABA HACIENDO
//
// `registrarIncidente` se llama desde el camino de un error que ya está pasando. Si la base no
// contesta o la tabla todavía no existe (la migración corre aparte del despliegue), se deja una
// línea en el registro y se sigue: el incidente ya quedó en el registro de Vercel con su
// referencia, y la persona tiene que ver su aviso igual.
//
// Se ESPERA y no se lanza al aire: en Vercel una promesa sin esperar puede quedar congelada cuando
// la función responde, y el incidente se perdería justo cuando importa. Son unos milisegundos en
// un camino que ya es de error.
// ═══════════════════════════════════════════════════════════════════════════════

import { conOrganizacion, datos } from '../datos/contexto.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NuevoIncidente {
  orgId: string;
  ref: string;
  situacion: string;
  origen: string;
  donde?: string;
  usuarioId?: string | null;
  tecnico: string;
  salvado?: boolean;
}

/** Guarda un incidente. No lanza nunca: ver el encabezado. */
export async function registrarIncidente(i: NuevoIncidente): Promise<void> {
  // Sin una organización de verdad no hay dónde guardarlo (pruebas, caminos que no la conocen).
  if (!UUID.test(i.orgId)) return;
  try {
    await conOrganizacion(i.orgId, async () => {
      await datos()
        .insertInto('incidentes')
        .values({
          ref: i.ref,
          situacion: i.situacion,
          origen: i.origen,
          donde: i.donde ?? null,
          usuario_id: i.usuarioId && UUID.test(i.usuarioId) ? i.usuarioId : null,
          // Acotado: es una frase del proveedor, y un servicio verborrágico no llena la tabla.
          tecnico: i.tecnico.slice(0, 1000),
          salvado: i.salvado ?? false,
        } as never)
        .execute();
    });
  } catch (e) {
    console.error(`incidentes: no se pudo guardar ${i.ref} · ${e instanceof Error ? e.message : 'desconocido'}`);
  }
}

/**
 * Cambia el `donde` de un incidente ya guardado: lo usa el grupo de una corrida para decir, al terminar,
 * cuántas llamadas fallaron igual que la primera (`lib/incidentes/agrupados.ts`). No lanza nunca, como
 * `registrarIncidente`.
 */
export async function recontarIncidente(orgId: string, ref: string, origen: string, donde: string): Promise<void> {
  if (!UUID.test(orgId)) return;
  try {
    await conOrganizacion(orgId, async () => {
      await datos().updateTable('incidentes').set({ donde }).where('ref', '=', ref).where('origen', '=', origen).execute();
    });
  } catch (e) {
    console.error(`incidentes: no se pudo recontar ${ref} · ${e instanceof Error ? e.message : 'desconocido'}`);
  }
}

/** Lo que el panel muestra de cada incidente. */
export interface IncidenteListado {
  id: string;
  orgId: string;
  creadoEl: string;
  ref: string;
  situacion: string;
  origen: string;
  donde: string | null;
  usuarioId: string | null;
  tecnico: string;
  salvado: boolean;
  revisadoEl: string | null;
}

/** Los incidentes de la organización del contexto, desde una fecha. Hasta 500, los más nuevos. */
export async function incidentesDeLaOrganizacion(desde: Date): Promise<IncidenteListado[]> {
  const filas = await datos()
    .selectFrom('incidentes')
    .select([
      'id',
      'org_id',
      'creado_el',
      'ref',
      'situacion',
      'origen',
      'donde',
      'usuario_id',
      'tecnico',
      'salvado',
      'revisado_el',
    ])
    .where('creado_el', '>=', desde)
    .orderBy('creado_el', 'desc')
    .limit(500)
    .execute();
  return filas.map((f) => ({
    id: f.id,
    orgId: f.org_id,
    creadoEl: new Date(f.creado_el).toISOString(),
    ref: f.ref,
    situacion: f.situacion,
    origen: f.origen,
    donde: f.donde,
    usuarioId: f.usuario_id,
    tecnico: f.tecnico,
    salvado: f.salvado,
    revisadoEl: f.revisado_el === null ? null : new Date(f.revisado_el).toISOString(),
  }));
}

/** Marca un incidente de la organización del contexto. `false` si no existe ahí. */
export async function marcarRevisado(id: string, usuarioId: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const r = await datos()
    .updateTable('incidentes')
    .set({ revisado_el: new Date(), revisado_por: usuarioId })
    .where('id', '=', id)
    .executeTakeFirst();
  return Number(r.numUpdatedRows) > 0;
}
