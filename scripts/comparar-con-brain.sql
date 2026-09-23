-- ═══════════════════════════════════════════════════════════════════════════════
-- COMANDO CENTRAL CONTRA ARIA BRAIN, EN LAS REUNIONES QUE ANALIZARON LOS DOS · solo lectura
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   node --env-file=.env.supabase scripts/supabase.mjs leer --archivo scripts/comparar-con-brain.sql
--
-- Es la prueba de HT-10 y OB-4 de que el porte no cambió el juicio: misma reunión, mismo tipo, un
-- puntaje parecido. Las fases van a diferir a propósito (el defecto v8 que se corrigió en v8.1).
--
-- **Solo sirve mientras existan las tablas de Brain** (`public.aria_brain_analyzer_*`). Cuando Brain
-- se apague y se borren, este archivo falla con «relation does not exist», y es lo esperable: ya no
-- hay contra qué comparar. `scripts/medir-analizadores.sql` no depende de Brain.
--
-- ── MEDIDO AL ESCRIBIRLO (2026-09-23 21:07 UTC) ──────────────────────────────
--
-- Brain no registra nada desde el 2026-09-19 10:00 —ni llamadas nuevas ni cambios—, y las reuniones
-- que Comando Central descubrió el 21 y el 23 no están en Brain. O sea que hoy no hay reuniones que
-- hayan analizado los dos: la comparación da cero filas hasta que Brain vuelva a correr.
--
-- Una fila por reunión en común, más una fila de total. Sin datos de nadie: identificadores,
-- tipos, estados y puntajes.
-- ═══════════════════════════════════════════════════════════════════════════════

with brain as (
  select c.id, c.external_meeting_id, c.tipo, c.estado, c.created_at, a.score
    from public.aria_brain_analyzer_calls c
    left join public.aria_brain_analyzer_analyses a on a.call_id = c.id
   where c.cliente_id = '610049a9-74e7-4397-83f9-33d797c4a054'  -- la cuenta tl;dv de ARIA en Brain
     and c.external_meeting_id is not null
),
cc as (
  -- Solo las que Comando Central descubrió por su cuenta: las copiadas son Brain mismo.
  select l.id, l.reunion_externa_id, l.tipo, l.estado, a.puntaje
    from negocio.analizador_llamadas l
    left join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id and a.coincide
   where l.org_id = '57e90f8a-cc6d-4837-8f71-fb5f52c82b38'  -- aria
     and l.creado_el >= '2026-09-23'
     and l.reunion_externa_id is not null
)
select 'reunion' as fila, cc.id as id_en_cc, brain.id as id_en_brain,
       brain.tipo as tipo_brain, cc.tipo as tipo_cc, brain.estado as estado_brain, cc.estado as estado_cc,
       brain.score as puntaje_brain, cc.puntaje as puntaje_cc,
       null::bigint as en_comun, null::bigint as mismo_tipo, null::numeric as dif_media_de_puntaje,
       null::bigint as de_brain_despues_de_la_copia_que_faltan_en_cc
  from cc join brain on brain.external_meeting_id = cc.reunion_externa_id
union all
select 'total', null, null, null, null, null, null, null, null,
       (select count(*) from cc join brain on brain.external_meeting_id = cc.reunion_externa_id),
       (select count(*) from cc join brain on brain.external_meeting_id = cc.reunion_externa_id and brain.tipo = cc.tipo),
       (select round(avg(abs(brain.score - cc.puntaje)), 2) from cc join brain on brain.external_meeting_id = cc.reunion_externa_id
         where brain.score is not null and cc.puntaje is not null),
       -- El hito de HT-9: ninguna reunión que Brain vio después de la copia puede faltar en Comando Central.
       (select count(*) from brain
         where brain.created_at >= '2026-09-23 17:00+00'
           and not exists (select 1 from negocio.analizador_llamadas l
                            where l.org_id = '57e90f8a-cc6d-4837-8f71-fb5f52c82b38' and l.reunion_externa_id = brain.external_meeting_id)
           and not exists (select 1 from negocio.analizador_lapidas x
                            where x.org_id = '57e90f8a-cc6d-4837-8f71-fb5f52c82b38' and x.reunion_externa_id = brain.external_meeting_id))
order by 1 desc;
