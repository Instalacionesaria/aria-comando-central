// El historial del Espía a tus competidores: las búsquedas que ya se hicieron y su análisis.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE
//
// Jorge, 2026-10-03: después de espiar cambiaba de pestaña y los resultados desaparecían, y no los
// encontraba en ningún lado. Estaban guardados —cada búsqueda deja sus anuncios en el trabajo del
// scraper— pero la pantalla sólo retomaba lo que seguía CORRIENDO. Una búsqueda terminada no tenía
// por dónde volver.
//
// Esto lista las búsquedas de la organización del contexto y guarda/lee el último análisis con IA
// de cada una (migración 068). Reabrir una búsqueda no vuelve a pagar Apify: los anuncios se leen del
// trabajo, por la misma ruta que el sondeo (`/api/tools/scrape?trabajo=`).
//
// Todo se llama dentro de `conOrganizacion(`: la RLS de las dos tablas filtra por la organización.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { PREFIJO_DE_BUSQUEDA } from './scrapers.ts';

/** Cuántas búsquedas se listan. Más que eso es una lista que nadie recorre. */
const TOPE = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BusquedaDelEspia {
  id: string;
  consulta: string;
  pais: string;
  status: string;
  creadoEl: string;
  /** `null` mientras no terminó: todavía no hay anuncios que contar. */
  anuncios: number | null;
  tieneAnalisis: boolean;
}

/** Las búsquedas del Espía de la organización, de la más nueva a la más vieja. */
export async function busquedasDelEspia(): Promise<BusquedaDelEspia[]> {
  const filas = await datos()
    .selectFrom('public.aria_cc_scraper_trabajos')
    .select(['id', 'business_type', 'location', 'status', 'created_at'])
    /* Sólo la CUENTA de anuncios, no los anuncios: `results_data` son cientos de kilobytes por
       búsqueda y la lista no los necesita. */
    .select(
      sql<number | null>`case when jsonb_typeof(results_data -> 'data') = 'array'
        then jsonb_array_length(results_data -> 'data') end`.as('anuncios'),
    )
    .where('fuente', '=', 'ad-spy')
    .orderBy('created_at', 'desc')
    .limit(TOPE)
    .execute();

  const ids = filas.map((f) => f.id);
  const conAnalisis = new Set(
    ids.length === 0
      ? []
      : (
          await datos()
            .selectFrom('analisis_del_espia')
            .select('trabajo_id')
            .where('trabajo_id', 'in', ids)
            .execute()
        ).map((a) => a.trabajo_id),
  );

  return filas.map((f) => {
    const tipo = f.business_type ?? '';
    return {
      id: f.id,
      consulta: tipo.startsWith(PREFIJO_DE_BUSQUEDA) ? tipo.slice(PREFIJO_DE_BUSQUEDA.length) : tipo,
      pais: f.location ?? 'ALL',
      status: f.status,
      creadoEl: new Date(f.created_at as unknown as string).toISOString(),
      anuncios: f.anuncios === null ? null : Number(f.anuncios),
      tieneAnalisis: conAnalisis.has(f.id),
    };
  });
}

export interface AnalisisGuardado {
  texto: string;
  cortado: boolean;
  creadoEl: string;
}

/** El último análisis de una búsqueda, o `null` si nunca se analizó. */
export async function analisisDe(trabajo: string): Promise<AnalisisGuardado | null> {
  if (!UUID.test(trabajo)) return null;
  const fila = await datos()
    .selectFrom('analisis_del_espia')
    .select(['texto', 'cortado', 'creado_el'])
    .where('trabajo_id', '=', trabajo)
    .executeTakeFirst();
  if (!fila) return null;
  return { texto: fila.texto, cortado: fila.cortado, creadoEl: new Date(fila.creado_el).toISOString() };
}

/** Guarda el análisis de una búsqueda, reemplazando el anterior. */
export async function guardarAnalisis(
  trabajo: string,
  analisis: { texto: string; cortado: boolean },
  usuarioId: string | null,
): Promise<void> {
  if (!UUID.test(trabajo)) return;
  const ahora = new Date();
  await datos()
    .insertInto('analisis_del_espia')
    .values({
      trabajo_id: trabajo,
      texto: analisis.texto,
      cortado: analisis.cortado,
      creado_el: ahora,
      usuario_id: usuarioId,
    } as never)
    .onConflict((oc) =>
      oc.columns(['org_id', 'trabajo_id']).doUpdateSet({
        texto: analisis.texto,
        cortado: analisis.cortado,
        creado_el: ahora,
        usuario_id: usuarioId,
      }),
    )
    .execute();
}
