-- El análisis del Espía: el último «Extraer hooks y ángulos con IA» de cada búsqueda.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ EXISTE
--
-- Pedido de Jorge y Kevin el 2026-10-03: el análisis se perdía al cambiar de pestaña y había que
-- volver a pagarlo. Los ANUNCIOS no necesitan tabla —ya viven en el trabajo del scraper
-- (`aria_cc_scraper_trabajos.results_data`)—, pero el análisis lo genera Comando Central con la llave
-- de IA de la organización y no quedaba en ningún lado.
--
-- Uno por búsqueda: volver a analizar reemplaza el anterior. `trabajo_id` es el identificador del
-- trabajo del scraper; no lleva clave foránea porque esa tabla vive en `public` y la escribe el
-- backend de scraping, no este proyecto.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.analisis_del_espia (
  org_id uuid not null references identidad.organizaciones(id),
  trabajo_id uuid not null,
  texto text not null,
  -- El modelo llegó al techo de tokens: el análisis está cortado.
  cortado boolean not null default false,
  creado_el timestamptz not null default now(),
  -- Quién lo pidió. Se borra la persona y el análisis queda: es de la organización.
  usuario_id uuid references identidad.usuarios(id) on delete set null,
  primary key (org_id, trabajo_id)
);

comment on table negocio.analisis_del_espia is
  'El último análisis con IA (hooks y ángulos) de cada búsqueda del Espía a tus competidores. Los anuncios viven en aria_cc_scraper_trabajos.results_data; esto guarda sólo lo que genera Comando Central.';

drop policy if exists aislamiento on negocio.analisis_del_espia;
select negocio.aplicar_aislamiento('negocio.analisis_del_espia');
