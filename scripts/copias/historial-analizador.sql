-- ═══════════════════════════════════════════════════════════════════════════════
-- LA COPIA ÚNICA DEL HISTORIAL DE LOS ANALIZADORES: de ARIA Brain a Comando Central
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Qué copia: todo lo de la cuenta tl;dv del alumno `610049a9…` de ARIA Brain —la única con
-- historial (107 de sus 108 llamadas); todos sus organizadores son @ariaia.com— a la organización
-- `aria` (`57e90f8a…`) de Comando Central. Decidido el 2026-09-22. La llamada restante (1 OB manual
-- de otra cuenta) NO se copia.
--
-- Qué NO copia, a propósito: ni `aria_brain_analyzer_tldv` ni `aria_brain_client_keys`. Son llaves,
-- y en Comando Central la de tl;dv la pega una persona en Integraciones y la de IA es la de la
-- empresa. Una prueba (`pruebas/codigo/173`) mira que este archivo no las nombre.
--
-- ── CÓMO SE CORRE, Y POR QUÉ ASÍ ──────────────────────────────────────────────
--
-- Como `postgres`, con `node --env-file=.env.supabase scripts/supabase.mjs correr --archivo
-- scripts/copias/historial-analizador.sql`, ENTRE la migración 060 —que le da `insert` sobre las
-- seis tablas— y la 061, que se lo quita. `postgres` es el único rol que ve las dos puntas: es dueño
-- de las tablas de Brain y tiene `rolbypassrls`, así que la RLS forzada de las nuestras no lo frena.
-- `migrador` no ve `public.aria_brain_*`, y `app_inquilino` no tiene política ahí.
--
-- Es UN solo bloque `do`, y eso es lo que lo hace atómico: si la verificación del final encuentra
-- una fila del origen sin su par, lanza, y no queda escrito nada.
--
-- ── Y ES IDEMPOTENTE ─────────────────────────────────────────────────────────
--
-- Los `id` se conservan, y cada `insert` se salta lo que ya está. Volver a correrlo no duplica nada.
-- Si Comando Central ya descubrió por su cuenta una reunión que también está en Brain —pasa si la
-- llave de tl;dv se cargó antes de copiar—, la de Comando Central se queda y la copia se la saltea
-- entera, con sus hijos: la verificación lo acepta, porque el par existe por la reunión externa.
--
-- ── LO QUE CAMBIA AL PASAR ───────────────────────────────────────────────────
--
--   · el motivo de un NOT_MATCH pasa de `error` a `motivo`: el origen usaba la misma columna para un
--     descarte y para un fallo;
--   · el correo del prospecto se guarda en minúsculas (medido: los 42 ya lo están);
--   · `costo_usd` queda NULO: Brain lo calculó con una tarifa que no está confirmada. Los tokens de
--     entrada y salida se copian; los de caché quedan nulos porque Brain no los guardaba;
--   · `con_marcas_de_tiempo` se deduce: tl;dv siempre trae tiempos, y una manual sin marcas tiene
--     cada segmento empezando en su número de línea —0, 1, 2…—, que es lo que el parser escribe.
-- ═══════════════════════════════════════════════════════════════════════════════

do $copia$
declare
  v_org     constant uuid := '57e90f8a-cc6d-4837-8f71-fb5f52c82b38';  -- aria
  v_cliente constant uuid := '610049a9-74e7-4397-83f9-33d797c4a054';  -- la cuenta tl;dv de ARIA en Brain
  v_faltan  integer;
  v_resumen text;
begin
  -- La organización destino tiene que ser la que se cree: un uuid copiado de otra ventana copiaría el
  -- historial de ARIA a otra empresa, y nada fallaría.
  if not exists (select 1 from identidad.organizaciones where id = v_org and slug = 'aria') then
    raise exception 'la organización % no es `aria`: no se copia nada', v_org;
  end if;

  -- ─── 1 · Los prospectos ───
  insert into negocio.analizador_prospectos (org_id, id, nombre, email, empresa, creado_el, actualizado_el)
  select v_org, l.id, l.nombre, nullif(lower(btrim(l.email)), ''), l.empresa, l.created_at, l.updated_at
    from public.aria_brain_analyzer_leads l
   where l.cliente_id = v_cliente
  on conflict do nothing;

  -- ─── 2 · Las llamadas ───
  --
  -- El prospecto se busca por id y, si ese id no entró —porque Comando Central ya tenía uno con el
  -- mismo correo—, por el correo. Así una llamada nunca queda apuntando a un prospecto que no existe.
  insert into negocio.analizador_llamadas (
    org_id, id, prospecto_id, tipo, proveedor, reunion_externa_id, titulo, prospecto_nombre,
    prospecto_email, estado, motivo, error, tomada_el, fecha_de_la_reunion, duracion_seg,
    organizador_nombre, organizador_email, url_de_la_grabacion, invitados, meta_del_proveedor,
    creado_el, actualizado_el
  )
  select v_org, c.id,
         (select p.id from negocio.analizador_prospectos p
           where p.org_id = v_org
             and (p.id = c.lead_id or (l.email is not null and p.email = lower(btrim(l.email))))
           order by (p.id = c.lead_id) desc
           limit 1),
         c.tipo, c.provider, c.external_meeting_id, c.titulo, c.prospecto_nombre, c.prospecto_email,
         -- Una ANALYZING del origen es una inferencia que ya no está corriendo acá: vuelve a la cola.
         case when c.estado = 'ANALYZING' then 'PENDING' else c.estado end,
         case when c.estado = 'NOT_MATCH' then c.error end,
         case when c.estado = 'FAILED' then left(c.error, 500) end,
         null,
         c.meeting_date, c.duracion_sec, c.organizador_nombre, c.organizador_email, c.meeting_url,
         c.invitees, c.provider_meta, c.created_at, c.updated_at
    from public.aria_brain_analyzer_calls c
    left join public.aria_brain_analyzer_leads l on l.id = c.lead_id and l.cliente_id = c.cliente_id
   where c.cliente_id = v_cliente
  on conflict do nothing;

  -- De acá en adelante, solo los hijos de las llamadas que entraron CON SU ID. Una que Comando Central
  -- ya tenía por su cuenta conserva sus propios hijos.
  -- `drop` antes: dos corridas en la misma sesión no chocan con la tabla de la anterior.
  drop table if exists pg_temp.copiadas;
  create temporary table copiadas on commit drop as
    select c.id
      from public.aria_brain_analyzer_calls c
      join negocio.analizador_llamadas x on x.org_id = v_org and x.id = c.id
     where c.cliente_id = v_cliente;

  -- ─── 3 · Las transcripciones ───
  insert into negocio.analizador_transcripciones (org_id, llamada_id, texto, segmentos, idioma, con_marcas_de_tiempo, creado_el)
  select v_org, t.call_id, t.full_text, t.segments, 'es',
         case
           when c.provider = 'TLDV' then true
           else not coalesce((
             select bool_and((e.v->>'startSec')::numeric = e.n - 1)
               from jsonb_array_elements(t.segments) with ordinality as e(v, n)
           ), false)
         end,
         t.created_at
    from public.aria_brain_analyzer_transcripts t
    join public.aria_brain_analyzer_calls c on c.id = t.call_id
    join copiadas k on k.id = t.call_id
  on conflict do nothing;

  -- ─── 4 · Los análisis ───
  insert into negocio.analizador_analisis (
    org_id, llamada_id, tipo, coincide, analisis, modelo, tokens_entrada, tokens_salida,
    tokens_escritura_cache, tokens_lectura_cache, costo_usd, version_de_rubrica, puntaje, resultado,
    color_del_puntaje, preparacion, resumen, analizado_el
  )
  select v_org, a.call_id, a.tipo, true, a.analysis_json, a.model, a.input_tokens, a.output_tokens,
         null, null, null, a.rubric_version, a.score, a.outcome, a.score_color, a.readiness, a.summary,
         a.created_at
    from public.aria_brain_analyzer_analyses a
    join copiadas k on k.id = a.call_id
  on conflict do nothing;

  -- ─── 5 · Las fichas ───
  insert into negocio.analizador_fichas (
    org_id, llamada_id, tipo_derivado, estado, ficha, error, modelo, tokens_entrada, tokens_salida,
    tokens_escritura_cache, tokens_lectura_cache, costo_usd, version_de_rubrica, intencion, decisor,
    riesgos, titular, creado_el, actualizado_el
  )
  select v_org, i.call_id, i.kind, i.estado, i.insight_json, left(i.error, 500), i.model,
         i.input_tokens, i.output_tokens, null, null, null, i.rubric_version, i.intent,
         i.decision_maker, i.risk_count, i.headline, i.created_at, i.updated_at
    from public.aria_brain_analyzer_call_insights i
    join copiadas k on k.id = i.call_id
   where i.cliente_id = v_cliente
  on conflict do nothing;

  -- ─── 6 · Las lápidas ───
  insert into negocio.analizador_lapidas (org_id, proveedor, reunion_externa_id, borrada_el)
  select v_org, d.provider, d.external_meeting_id, d.created_at
    from public.aria_brain_analyzer_deleted d
   where d.cliente_id = v_cliente
  on conflict do nothing;

  -- ═══ LA VERIFICACIÓN: ninguna fila del origen sin su par ═══
  --
  -- Una llamada tiene par si está con su id, o si Comando Central ya tiene la misma reunión externa.
  -- Los hijos, contra las llamadas que entraron con su id. Si falta uno solo, se lanza y el bloque
  -- entero se deshace.
  select count(*) into v_faltan
    from public.aria_brain_analyzer_calls c
   where c.cliente_id = v_cliente
     and not exists (select 1 from negocio.analizador_llamadas x where x.org_id = v_org and x.id = c.id)
     and not exists (select 1 from negocio.analizador_llamadas x
                      where x.org_id = v_org and x.proveedor = c.provider
                        and x.reunion_externa_id = c.external_meeting_id);
  if v_faltan > 0 then raise exception 'quedaron % llamada(s) sin su par: no se copia nada', v_faltan; end if;

  select count(*) into v_faltan
    from public.aria_brain_analyzer_transcripts t join copiadas k on k.id = t.call_id
   where not exists (select 1 from negocio.analizador_transcripciones x where x.org_id = v_org and x.llamada_id = t.call_id);
  if v_faltan > 0 then raise exception 'quedaron % transcripción(es) sin su par', v_faltan; end if;

  select count(*) into v_faltan
    from public.aria_brain_analyzer_analyses a join copiadas k on k.id = a.call_id
   where not exists (select 1 from negocio.analizador_analisis x where x.org_id = v_org and x.llamada_id = a.call_id);
  if v_faltan > 0 then raise exception 'quedaron % análisis sin su par', v_faltan; end if;

  select count(*) into v_faltan
    from public.aria_brain_analyzer_call_insights i join copiadas k on k.id = i.call_id
   where i.cliente_id = v_cliente
     and not exists (select 1 from negocio.analizador_fichas x
                      where x.org_id = v_org and x.llamada_id = i.call_id and x.tipo_derivado = i.kind);
  if v_faltan > 0 then raise exception 'quedaron % ficha(s) sin su par', v_faltan; end if;

  select count(*) into v_faltan
    from public.aria_brain_analyzer_deleted d
   where d.cliente_id = v_cliente
     and not exists (select 1 from negocio.analizador_lapidas x
                      where x.org_id = v_org and x.proveedor = d.provider and x.reunion_externa_id = d.external_meeting_id);
  if v_faltan > 0 then raise exception 'quedaron % lápida(s) sin su par', v_faltan; end if;

  select format('copiado a %s: %s llamadas, %s prospectos, %s transcripciones, %s análisis, %s fichas, %s lápidas',
                v_org,
                (select count(*) from negocio.analizador_llamadas where org_id = v_org),
                (select count(*) from negocio.analizador_prospectos where org_id = v_org),
                (select count(*) from negocio.analizador_transcripciones where org_id = v_org),
                (select count(*) from negocio.analizador_analisis where org_id = v_org),
                (select count(*) from negocio.analizador_fichas where org_id = v_org),
                (select count(*) from negocio.analizador_lapidas where org_id = v_org))
    into v_resumen;
  raise notice '%', v_resumen;
end
$copia$;

-- El resumen, como FILA: la API de Supabase devuelve el resultado de la última consulta y no los
-- `notice`. Si el bloque de arriba lanzó, esto no llega a correr.
select
  (select count(*) from negocio.analizador_llamadas        where org_id = '57e90f8a-cc6d-4837-8f71-fb5f52c82b38') as llamadas,
  (select count(*) from negocio.analizador_prospectos      where org_id = '57e90f8a-cc6d-4837-8f71-fb5f52c82b38') as prospectos,
  (select count(*) from negocio.analizador_transcripciones where org_id = '57e90f8a-cc6d-4837-8f71-fb5f52c82b38') as transcripciones,
  (select count(*) from negocio.analizador_analisis        where org_id = '57e90f8a-cc6d-4837-8f71-fb5f52c82b38') as analisis,
  (select count(*) from negocio.analizador_fichas          where org_id = '57e90f8a-cc6d-4837-8f71-fb5f52c82b38') as fichas,
  (select count(*) from negocio.analizador_lapidas         where org_id = '57e90f8a-cc6d-4837-8f71-fb5f52c82b38') as lapidas;
