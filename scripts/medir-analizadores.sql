-- ═══════════════════════════════════════════════════════════════════════════════
-- CÓMO ANDAN LOS ANALIZADORES EN PRODUCCIÓN · solo lectura
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   node --env-file=.env.supabase scripts/supabase.mjs leer --archivo scripts/medir-analizadores.sql
--
-- Es la medición del hito de 24 h de HT-9 y de la observación de HT-10 y OB-4
-- (docs/ANALIZADORES.md): la misma consulta cada vez, para que dos lecturas en días distintos se
-- puedan comparar. Una fila por empresa y tipo.
--
-- ── SOLO LO QUE COMANDO CENTRAL HIZO POR SU CUENTA ───────────────────────────
--
-- El historial copiado de ARIA Brain conserva sus fechas (todas anteriores al 2026-09-20), así que
-- `creado_el >= '2026-09-23'` deja afuera la copia y mide solo lo que descubrió y analizó la tarea o
-- la pantalla. Las duraciones salen de `analizado_el - tomada_el`: la toma deja `tomada_el` puesto y
-- el guardado escribe `analizado_el`; una copiada no tiene `tomada_el`.
--
-- ── NO IMPRIME DATOS DE NADIE ────────────────────────────────────────────────
--
-- Conteos, tasas, segundos y tokens. Ni títulos, ni nombres, ni correos, ni texto del análisis.
--
-- ── LO QUE CADA COLUMNA TIENE QUE DAR, SI TODO ANDA ──────────────────────────
--
--   duplicadas, colgadas, sin_contadores, ht_sin_ficha_vieja → 0
--   sello                                                    → «corrio», y sin motivo o con uno que se entienda
--   seg_p50 / seg_p90 / seg_max                              → lo que HT-10 usa para ajustar las esperas
--                                                              (hoy el análisis arranca solo con 150 s por
--                                                              delante y espera hasta 270 s)
-- ═══════════════════════════════════════════════════════════════════════════════

with propias as (
  select l.*
    from negocio.analizador_llamadas l
   where l.creado_el >= '2026-09-23'
),
analisis_propios as (
  select l.org_id, l.tipo, a.coincide,
         extract(epoch from (a.analizado_el - l.tomada_el)) as segundos,
         a.tokens_entrada, a.tokens_salida, a.tokens_escritura_cache, a.tokens_lectura_cache
    from negocio.analizador_llamadas l
    join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id
   where l.tomada_el is not null
     and a.analizado_el >= l.tomada_el
),
tipos as (
  select distinct org_id, tipo from negocio.analizador_llamadas
)
select
  o.slug as empresa,
  t.tipo,
  (select count(*) from propias p where p.org_id = t.org_id and p.tipo = t.tipo) as descubiertas,
  (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
     from (select estado, count(*) n from propias p where p.org_id = t.org_id and p.tipo = t.tipo group by 1) x) as por_estado,
  -- De lo que se analizó, qué parte el PRIMER PASO dijo que no era de este tipo. OTRO no se analiza.
  (select round(100.0 * count(*) filter (where estado = 'NOT_MATCH')
                / nullif(count(*) filter (where estado in ('DONE', 'NOT_MATCH', 'FAILED')), 0), 1)
     from propias p where p.org_id = t.org_id and p.tipo = t.tipo and t.tipo <> 'OTRO') as pct_no_es,
  (select count(*) from negocio.analizador_llamadas l
    where l.org_id = t.org_id and l.tipo = t.tipo and l.estado = 'PENDING') as pendientes_hoy,
  (select round(extract(epoch from (now() - min(l.creado_el))) / 3600, 1) from negocio.analizador_llamadas l
    where l.org_id = t.org_id and l.tipo = t.tipo and l.estado = 'PENDING') as horas_de_la_pendiente_mas_vieja,
  (select count(*) from analisis_propios a where a.org_id = t.org_id and a.tipo = t.tipo) as analisis_medidos,
  (select round(percentile_cont(0.5) within group (order by segundos)::numeric) from analisis_propios a
    where a.org_id = t.org_id and a.tipo = t.tipo) as seg_p50,
  (select round(percentile_cont(0.9) within group (order by segundos)::numeric) from analisis_propios a
    where a.org_id = t.org_id and a.tipo = t.tipo) as seg_p90,
  (select round(max(segundos)) from analisis_propios a where a.org_id = t.org_id and a.tipo = t.tipo) as seg_max,
  (select round(percentile_cont(0.5) within group (order by tokens_salida)::numeric) from analisis_propios a
    where a.org_id = t.org_id and a.tipo = t.tipo and a.coincide) as tokens_salida_p50_completos,
  (select count(*) from analisis_propios a
    where a.org_id = t.org_id and a.tipo = t.tipo
      and (a.tokens_entrada is null or a.tokens_salida is null or a.tokens_escritura_cache is null or a.tokens_lectura_cache is null)) as sin_contadores,
  -- Las fichas son solo de HT. Una DONE sin ficha pasados 10 minutos la tendría que haber generado la tarea.
  (select coalesce(jsonb_object_agg(f.estado, f.n), '{}'::jsonb) from (
     select fi.estado, count(*) n from negocio.analizador_fichas fi join propias p on p.org_id = fi.org_id and p.id = fi.llamada_id
      where p.org_id = t.org_id and p.tipo = t.tipo group by 1) f) as fichas,
  (select count(*) from propias p
    join negocio.analizador_analisis a on a.org_id = p.org_id and a.llamada_id = p.id and a.coincide
    where p.org_id = t.org_id and p.tipo = 'HT' and t.tipo = 'HT' and p.estado = 'DONE'
      and a.analizado_el < now() - interval '1 hour'
      and not exists (select 1 from negocio.analizador_fichas fi where fi.org_id = p.org_id and fi.llamada_id = p.id)) as ht_sin_ficha_vieja,
  (select count(*) from (select 1 from negocio.analizador_llamadas l
    where l.org_id = t.org_id and l.tipo = t.tipo and l.reunion_externa_id is not null
    group by l.proveedor, l.reunion_externa_id having count(*) > 1) d) as duplicadas,
  (select count(*) from negocio.analizador_llamadas l
    where l.org_id = t.org_id and l.tipo = t.tipo and l.estado = 'ANALYZING' and l.tomada_el < now() - interval '15 minutes') as colgadas,
  (select tp.ultimo_estado || ' · ' || to_char(tp.ultima_corrida_el at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'
          || coalesce(' · ' || nullif(tp.ultimo_motivo, ''), '')
     from negocio.tareas_programadas tp where tp.org_id = t.org_id and tp.tarea = 'analizadores') as sello
from tipos t
join identidad.organizaciones o on o.id = t.org_id
order by o.slug, t.tipo;
