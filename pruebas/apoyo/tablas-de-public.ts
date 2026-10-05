// Las tres tablas de `public` que leen las herramientas del cerebro, creadas SÓLO para una prueba.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HACE FALTA
//
// `public.aria_cc_scraper_leads`, `public.aria_cc_scraper_trabajos` y `public.aria_cc_foundations` las crea
// el backend de Python en el Supabase de producción, no una migración de este repositorio, así que **no
// existen en la base local** (`docs/OTROS/estado actual/12-ICP-Y-OFERTA.md`, deuda 6; y la prueba 130 impide
// que una migración cree la de Fundaciones). Sin ellas, `leads_del_scraper`, `espia` y `fundaciones` no se
// podrían probar contra filas, y las tres son justamente las que cuentan o recortan filas con correos y
// teléfonos.
//
// Se crean con las columnas que lee este proyecto (`lib/datos/esquema.ts`) y con el aislamiento de `negocio`
// (`negocio.aplicar_aislamiento`: RLS forzada y la política por `app.org_id`), que es el régimen que
// declaran en producción. Se crean sólo si no existen, y se quitan sólo si las creó esta prueba.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Client } from 'pg';

const DDL: Readonly<Record<string, string>> = {
  'public.aria_cc_scraper_leads': `
    create table public.aria_cc_scraper_leads (
      org_id uuid not null references identidad.organizaciones(id),
      id uuid not null default gen_random_uuid(),
      trabajo_id uuid not null,
      source text not null default 'maps',
      name text, email text, phone text, website text, location text, category text,
      raw_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      primary key (org_id, id)
    )`,
  'public.aria_cc_scraper_trabajos': `
    create table public.aria_cc_scraper_trabajos (
      org_id uuid not null references identidad.organizaciones(id),
      id uuid not null default gen_random_uuid(),
      fuente text not null,
      status text not null default 'PENDING',
      business_type text, location text,
      results_data jsonb,
      created_at timestamptz not null default now(),
      primary key (org_id, id)
    )`,
  'public.aria_cc_foundations': `
    create table public.aria_cc_foundations (
      org_id uuid not null references identidad.organizaciones(id),
      profile jsonb, history jsonb, market_research jsonb, deep_research jsonb, cat_chat jsonb, intake jsonb, tool_chats jsonb,
      actualizado_el timestamptz not null default now(),
      primary key (org_id)
    )`,
};

/** Crea las que no existen y devuelve cuáles creó: son las únicas que `quitarTablasDePublic` borra. */
export async function crearTablasDePublic(admin: Client): Promise<string[]> {
  const creadas: string[] = [];
  for (const [tabla, ddl] of Object.entries(DDL)) {
    const existe = (await admin.query<{ r: string | null }>('select to_regclass($1)::text as r', [tabla])).rows[0]!.r;
    if (existe !== null) continue;
    await admin.query(ddl);
    await admin.query('select negocio.aplicar_aislamiento($1::regclass)', [tabla]);
    creadas.push(tabla);
  }
  return creadas;
}

export async function quitarTablasDePublic(admin: Client, creadas: readonly string[]): Promise<void> {
  for (const tabla of creadas) await admin.query(`drop table if exists ${tabla}`);
}
