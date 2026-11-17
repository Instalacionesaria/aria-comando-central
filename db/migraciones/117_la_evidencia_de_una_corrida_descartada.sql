-- 117 · La evidencia de una corrida descartada no se entrega, y los tipos de fuente que el Research ya usa.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (revisión del Research en producción, 2026-11-17; docs/3-agentes/MANAGED-AGENTS-RESEARCH.md)
--
-- LA EVIDENCIA DE UNA CORRIDA DESCARTADA. El Research de un lead de prueba falló tres corridas de mr_segmentos por
-- «fuentes registradas sin resultado de herramienta» (URLs que no salieron de Apify) y dos más quedaron reemplazadas.
-- Las 61 fuentes que registraron siguen en negocio.fuentes_publicas, del lead, y `_leer_del_cliente` (Research,
-- Estratega y Funnel Builder) se las entregaba como claves citables a los pasos siguientes: el paso 1 que sí se guardó
-- mencionó una en su texto. Desde acá, la evidencia de una corrida fallida, reemplazada o cancelada:
--   · no la entrega ninguna lectura: `_leer_del_cliente`, `leer_brief`, `leer_sales_assistant` y la sección
--     evidencia_publica del expediente;
--   · no se puede citar, aunque haya quedado en lo leído de una corrida (lo leído sólo crece: una corrida que leyó
--     mientras la de otro paso seguía abierta la tiene adentro): `_texto_de_la_fuente`, que valida las citas de todos
--     los agentes;
--   · no ata un referente (`registrar_research`).
-- Quien está registrando su propia evidencia la sigue viendo (su corrida está abierta), y la evidencia de una corrida
-- rechazada por una persona se sigue viendo (el rechazo es del contenido, no de la evidencia). Medido en producción el
-- 2026-11-17: ninguna cita del mercado ni ningún referente guardados apuntaban a una evidencia descartada.
--
-- NO SE BORRA NI SE TOCA NINGUNA FILA. El filtro mira el estado de la corrida al leer, así que vale para las 61 de hoy
-- y para cualquier corrida que falle mañana, y es reversible: basta con volver a definir las funciones.
--
-- LOS TIPOS DE FUENTE. La skill fuentes-de-research usa TikTok, YouTube, páginas y grupos de Facebook, ofertas de
-- empleo y Google Trends; el catálogo no los tenía y los comentarios de TikTok quedaron como «instagram». Un tipo nuevo
-- es un INSERT (110).
--
-- Las funciones se copian de su última definición (la 115) y cambian sólo en la consulta de las fuentes públicas; la
-- vista conserva security_invoker (sin él, lee como su dueño y no devuelve filas). Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · Los tipos de fuente ─────────────────────────────────────────────────────
insert into catalogo.tipos_de_fuente_publica (clave, nombre) values
  ('tiktok', 'TikTok'), ('youtube', 'YouTube'), ('facebook', 'Facebook'), ('empleo', 'Oferta de empleo'),
  ('google_trends', 'Google Trends')
on conflict do nothing;

-- ─── 2 · Las lecturas: sin la evidencia de corridas descartadas ─────────────────

create or replace function agentes._leer_del_cliente(p_corrida negocio.corridas_de_agente, p_tipos text[], p_con_filas boolean)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  d        jsonb := agentes._entregables_vigentes(p_corrida.org_id, p_corrida.cuenta_id, p_corrida.contacto_id, p_tipos);
  v_pub    jsonb;
  v_filas  jsonb := null;
  v_seg_v  uuid := (d #>> '{ids,mr_segmentos}')::uuid;
  v_dol_v  uuid := (d #>> '{ids,mr_dolores}')::uuid;
  v_ref_v  uuid := (d #>> '{ids,mr_referentes}')::uuid;
begin
  select coalesce(jsonb_object_agg('publica:' || p.id, p.extracto), '{}'::jsonb) into v_pub
    from negocio.fuentes_publicas p where p.org_id = p_corrida.org_id and p.cuenta_id = p_corrida.cuenta_id
     and p.contacto_id = p_corrida.contacto_id
     and not exists (select 1 from negocio.corridas_de_agente cx where cx.org_id = p.org_id and cx.cuenta_id = p.cuenta_id
                      and cx.id = p.corrida_id and cx.estado in ('fallida', 'reemplazada', 'cancelada'));
  if p_con_filas then
    v_filas := jsonb_build_object(
      'segmentos', (select coalesce(jsonb_agg(jsonb_build_object('segmento_id', s.id, 'nombre', s.nombre, 'descripcion', s.descripcion,
                      'criterios', s.criterios, 'valor_del_cliente', s.valor_del_cliente, 'elegido', coalesce(lower(s.nombre) = lower(d #>> '{entregables,mr_decision,contenido,segmento_elegido}'), false))), '[]'::jsonb)
                    from negocio.segmentos_del_mercado s where s.org_id = p_corrida.org_id and s.cuenta_id = p_corrida.cuenta_id and s.contacto_id = p_corrida.contacto_id and s.version_id = v_seg_v),
      'dolores', (select coalesce(jsonb_agg(jsonb_build_object('dolor_id', x.id, 'segmento', x.segmento_nombre, 'descripcion', x.descripcion,
                      'etapa', x.etapa_del_recorrido, 'intensidad', x.intensidad, 'es_critico', x.es_critico, 'dolor_comun', x.dolor_comun,
                      'citas', (select coalesce(jsonb_agg(jsonb_build_object('cita_id', c.id, 'texto', c.texto, 'fuente', 'publica:' || c.fuente_publica_id,
                                 'verificada', c.cita_verificada)), '[]'::jsonb)
                                  from negocio.citas_del_mercado c where c.org_id = x.org_id and c.cuenta_id = x.cuenta_id and c.contacto_id = x.contacto_id and c.dolor_id = x.id))), '[]'::jsonb)
                  from negocio.dolores_del_segmento x where x.org_id = p_corrida.org_id and x.cuenta_id = p_corrida.cuenta_id and x.contacto_id = p_corrida.contacto_id and x.version_id = v_dol_v),
      'referentes', (select coalesce(jsonb_agg(jsonb_build_object('tipo', r.tipo, 'nombre', r.nombre, 'url', r.url, 'que_ofrece', r.que_ofrece,
                      'precio', r.precio)), '[]'::jsonb)
                     from negocio.referentes_del_mercado r where r.org_id = p_corrida.org_id and r.cuenta_id = p_corrida.cuenta_id and r.contacto_id = p_corrida.contacto_id and r.version_id = v_ref_v),
      'decisiones_de_kickoff', (select coalesce(jsonb_agg(jsonb_build_object('sobre', k.sobre, 'decision', k.decision, 'el', k.creada_el)
                      order by k.creada_el), '[]'::jsonb)
                     from negocio.decisiones_de_kickoff k where k.org_id = p_corrida.org_id and k.cuenta_id = p_corrida.cuenta_id and k.contacto_id = p_corrida.contacto_id));
    d := d || jsonb_build_object('fuentes', (d -> 'fuentes') || jsonb_build_object('kickoff:decisiones', v_filas -> 'decisiones_de_kickoff'));
  end if;
  return d || jsonb_build_object('fuentes', (d -> 'fuentes') || v_pub, 'filas', v_filas);
end $$;

create or replace function agentes.leer_brief(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v         negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  -- El expediente del lead de la corrida (antes, el del vendedor visto desde la cuenta del comprador).
  vo        uuid := v.org_id;
  vc        uuid := v.cuenta_id;
  vk        uuid := v.contacto_id;
  v_fuentes jsonb := '{}'::jsonb;
  v_falta   jsonb := '[]'::jsonb;
  v_ficha   negocio.fichas_del_lead;
  v_prop    negocio.resultados_propuestos;
  v_trans   record;
  v_preg    jsonb;
  v_version text;
  v_actual  jsonb;
  e         negocio.entregables := agentes._entregable(v, 'brief');
begin
  select f.* into v_ficha from negocio.ficha_vigente f where f.org_id = vo and f.cuenta_id = vc and f.contacto_id = vk;
  if v_ficha.id is not null then
    v_fuentes := v_fuentes || jsonb_build_object(format('ficha:%s@v%s', v_ficha.id, v_ficha.version),
      jsonb_build_object('resumen', v_ficha.resumen, 'quien_es', v_ficha.quien_es, 'que_dijo', v_ficha.que_dijo));
  else
    v_falta := v_falta || to_jsonb('ficha_del_lead'::text);
  end if;
  select p.* into v_prop from negocio.resultados_propuestos p
   where p.org_id = vo and p.cuenta_id = vc and p.contacto_id = vk and p.estado in ('confirmado', 'corregido')
   order by p.decidido_el desc limit 1;
  if v_prop.id is not null then
    v_fuentes := v_fuentes || jsonb_build_object('sales_coach:' || v_prop.corrida_id,
      jsonb_build_object('salida', v_prop.salida, 'ruta', coalesce(v_prop.ruta, v_prop.ruta_clase), 'monto', v_prop.monto,
                         'moneda', v_prop.moneda, 'datos_del_negocio', v_prop.datos_del_negocio, 'next_steps', v_prop.next_steps));
  else
    v_falta := v_falta || to_jsonb('resultado_confirmado'::text);
  end if;
  select t.texto, t.llamada_id into v_trans from negocio.transcripciones t
    join negocio.llamadas l on l.org_id = t.org_id and l.cuenta_id = t.cuenta_id and l.id = t.llamada_id
   where t.org_id = vo and t.cuenta_id = vc and l.contacto_id = vk and l.tipo = 'venta'
   order by t.creada_el desc limit 1;
  if v_trans.texto is not null then
    v_fuentes := v_fuentes || jsonb_build_object('llamada_venta:' || v_trans.llamada_id, left(v_trans.texto, 60000));
  else
    v_falta := v_falta || to_jsonb('transcripcion_de_venta'::text);
  end if;
  v_fuentes := v_fuentes || agentes._respuestas(vo, vc, vk);
  v_fuentes := v_fuentes || coalesce((select jsonb_object_agg('publica:' || p.id, p.extracto) from negocio.fuentes_publicas p
                                       where p.org_id = vo and p.cuenta_id = vc and p.contacto_id = vk
                                         and (p.vigente_hasta is null or p.vigente_hasta > now())
                                         and not exists (select 1 from negocio.corridas_de_agente cx where cx.org_id = p.org_id and cx.cuenta_id = p.cuenta_id
                      and cx.id = p.corrida_id and cx.estado in ('fallida', 'reemplazada', 'cancelada'))), '{}'::jsonb);

  select max(version_del_brief) into v_version from catalogo.preguntas_del_brief where vigente;
  if v_version is null then
    v_falta := v_falta || to_jsonb('preguntas_del_brief'::text);
    v_version := 'libre';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('clave', q.clave, 'numero', q.numero, 'seccion', q.seccion, 'variante', q.variante,
           'texto', q.texto, 'tipo_de_valor', q.tipo_de_valor, 'opciones', q.opciones, 'obligatoria', q.obligatoria,
           'prellenable', q.prellenable, 'pregunta_estandar', q.pregunta_estandar, 'decide_la_variante', q.decide_la_variante)
           order by q.seccion, q.numero), '[]'::jsonb)
    into v_preg from catalogo.preguntas_del_brief q where q.version_del_brief = v_version and q.vigente;
  select coalesce(jsonb_object_agg(b.pregunta, jsonb_build_object('valor', coalesce(b.valor_json, to_jsonb(b.valor_texto)),
           'estado', b.estado, 'autor', b.autor_tipo)), '{}'::jsonb)
    into v_actual from negocio.brief_vigente b where b.org_id = v.org_id and b.cuenta_id = v.cuenta_id and b.contacto_id = v.contacto_id and b.entregable_id = e.id;

  perform agentes._anotar_lectura(v, v_fuentes);
  return jsonb_build_object('corrida_id', v.id, 'agente', 'brief', 'version_del_brief', v_version, 'preguntas', v_preg,
    'ya_respondido', v_actual, 'fuentes', v_fuentes, 'faltantes', v_falta,
    'contrato', 'agentes.registrar_brief(corrida_id, {respuestas[{pregunta, estado: detectado|inferido|vacio, valor, fuente, cita, confianza, texto_para_el_cliente}], a_quien_vende: negocios|consumidores|null}). Lo que el lead ya confirmó no se vuelve a prellenar.');
end $$;

create or replace function agentes.leer_sales_assistant(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v         negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_k       jsonb := agentes._conocimiento(v, array['icp', 'rutas', 'script_de_ventas', 'manual_de_objeciones']);
  v_fuentes jsonb := '{}'::jsonb;
  v_falta   jsonb := v_k -> 'faltantes';
  v_cita    jsonb;
  v_triaje  jsonb;
  v_llam    jsonb;
  v_publ    jsonb;
  v_obj     jsonb;
  v_ficha   jsonb;
  r         record;
begin
  if v.contacto_id is null then
    perform agentes._anotar_lectura(v, v_k -> 'fuentes', v_k -> 'versiones');
    return jsonb_build_object('corrida_id', v.id, 'agente', 'sales_assistant', 'conocimiento', v_k -> 'conocimiento',
      'faltantes', v_falta || to_jsonb('contacto_en_la_base'::text));
  end if;

  v_fuentes := agentes._respuestas(v.org_id, v.cuenta_id, v.contacto_id) || agentes._atribucion(v.org_id, v.cuenta_id, v.contacto_id);

  -- La cita.
  select jsonb_build_object('cita_id', ci.id, 'inicio_el', ci.inicio_el, 'tipo', ci.tipo, 'estado', ci.estado_ghl,
           'reagendada_el', ci.reagendada_el, 'cuadrante_al_agendar', ci.cuadrante_al_agendar, 'closer_en_el_crm', ci.crm_asignado_a)
    into v_cita from negocio.citas ci
   where ci.org_id = v.org_id and ci.cuenta_id = v.cuenta_id and ci.contacto_id = v.contacto_id
     and ci.id = coalesce(v.cita_id, (select id from negocio.citas where org_id = v.org_id and cuenta_id = v.cuenta_id
                                        and contacto_id = v.contacto_id and baja_en_el_crm is null order by inicio_el desc limit 1));
  if v_cita is null then v_falta := v_falta || to_jsonb('cita'::text); end if;

  -- El triaje vigente.
  select to_jsonb(t) - 'org_id' - 'cuenta_id' into v_triaje from negocio.triaje_vigente t
   where t.org_id = v.org_id and t.cuenta_id = v.cuenta_id and t.contacto_id = v.contacto_id;
  if v_triaje is not null then
    v_fuentes := v_fuentes || jsonb_build_object('triage:' || (v_triaje ->> 'corrida_id'), v_triaje);
  else
    v_falta := v_falta || to_jsonb('triaje'::text);
  end if;

  -- Los mensajes: los últimos 80, agrupados por canal, cada uno con su autor y su fecha.
  for r in
    select coalesce(m.canal_estandar::text, m.canal, 'sin_canal') as canal,
           string_agg(format('[%s %s] %s', to_char(m.enviado_el at time zone 'UTC', 'YYYY-MM-DD HH24:MI'),
                             case m.autor when 'contacto' then 'lead' else m.autor end, left(coalesce(m.cuerpo, ''), 1500)),
                      E'\n' order by m.enviado_el) as texto
      from (select * from negocio.mensajes
             where org_id = v.org_id and cuenta_id = v.cuenta_id and contacto_id = v.contacto_id and cuerpo is not null
             order by enviado_el desc limit 80) m
     group by 1
  loop
    v_fuentes := v_fuentes || jsonb_build_object('mensajes:' || r.canal, r.texto);
  end loop;
  if not exists (select 1 from jsonb_object_keys(v_fuentes) k where k like 'mensajes:%') then
    v_falta := v_falta || to_jsonb('mensajes'::text);
  end if;

  -- Las llamadas anteriores (agente de voz, setter), con su última transcripción.
  select coalesce(jsonb_agg(jsonb_build_object('llamada_id', l.id, 'tipo', l.tipo, 'inicio_el', l.inicio_el,
           'duracion_segundos', l.duracion_segundos, 'contestada', l.contestada, 'resumen', l.resumen,
           'fuente', 'llamada:' || l.id) order by l.inicio_el), '[]'::jsonb)
    into v_llam from negocio.llamadas l
   where l.org_id = v.org_id and l.cuenta_id = v.cuenta_id and l.contacto_id = v.contacto_id and coalesce(l.tipo, 'otra') <> 'venta';
  for r in
    select distinct on (t.llamada_id) t.llamada_id, left(t.texto, 30000) as texto
      from negocio.transcripciones t join negocio.llamadas l on l.org_id = t.org_id and l.cuenta_id = t.cuenta_id and l.id = t.llamada_id
     where t.org_id = v.org_id and t.cuenta_id = v.cuenta_id and l.contacto_id = v.contacto_id and coalesce(l.tipo, 'otra') <> 'venta'
     order by t.llamada_id, t.creada_el desc
  loop
    v_fuentes := v_fuentes || jsonb_build_object('llamada:' || r.llamada_id, r.texto);
  end loop;
  if not exists (select 1 from negocio.llamadas l where l.org_id = v.org_id and l.cuenta_id = v.cuenta_id and l.contacto_id = v.contacto_id and l.tipo = 'ia_voz') then
    v_falta := v_falta || to_jsonb('llamada_ia'::text);
  end if;
  if not exists (select 1 from negocio.llamadas l where l.org_id = v.org_id and l.cuenta_id = v.cuenta_id and l.contacto_id = v.contacto_id and l.tipo = 'setter') then
    v_falta := v_falta || to_jsonb('llamada_humano'::text);
  end if;

  -- La evidencia pública que ya existe del lead (vigente).
  select coalesce(jsonb_agg(jsonb_build_object('fuente', 'publica:' || p.id, 'tipo', p.tipo, 'url', p.url, 'titulo', p.titulo,
           'observada_el', p.observada_el)), '[]'::jsonb)
    into v_publ
    from negocio.fuentes_publicas p
   where p.org_id = v.org_id and p.cuenta_id = v.cuenta_id and p.contacto_id = v.contacto_id
     and (p.vigente_hasta is null or p.vigente_hasta > now())
     and not exists (select 1 from negocio.corridas_de_agente cx where cx.org_id = p.org_id and cx.cuenta_id = p.cuenta_id
                      and cx.id = p.corrida_id and cx.estado in ('fallida', 'reemplazada', 'cancelada'));
  v_fuentes := v_fuentes || coalesce((select coalesce(jsonb_object_agg('publica:' || p.id, p.extracto), '{}'::jsonb)
                                        from negocio.fuentes_publicas p
                                       where p.org_id = v.org_id and p.cuenta_id = v.cuenta_id and p.contacto_id = v.contacto_id
                                         and (p.vigente_hasta is null or p.vigente_hasta > now())
                                         and not exists (select 1 from negocio.corridas_de_agente cx where cx.org_id = p.org_id and cx.cuenta_id = p.cuenta_id
                      and cx.id = p.corrida_id and cx.estado in ('fallida', 'reemplazada', 'cancelada'))), '{}'::jsonb);
  if v_publ = '[]'::jsonb then v_falta := v_falta || to_jsonb('datos_publicos'::text); end if;

  -- (Sin el conteo de objeciones de toda la cuenta: el agente lee sólo el expediente de su lead. Lo que ARIA sabe de
  -- objeciones en general está en su manual de objeciones, en el conocimiento de la cuenta.)

  -- La ficha anterior, si la hubo.
  select jsonb_build_object('version', f.version, 'resumen', f.resumen, 'creada_el', f.creada_el, 'leida_el', f.leida_el)
    into v_ficha from negocio.ficha_vigente f
   where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id and f.contacto_id = v.contacto_id;

  perform agentes._anotar_lectura(v, v_fuentes || (v_k -> 'fuentes'), v_k -> 'versiones');
  return jsonb_build_object(
    'corrida_id', v.id, 'agente', 'sales_assistant', 'cita', v_cita, 'triaje', v_triaje, 'llamadas', v_llam,
    'publicas', v_publ, 'ficha_anterior', v_ficha, 'fuentes', v_fuentes, 'conocimiento', v_k -> 'conocimiento',
    'faltantes', v_falta,
    'contrato', 'agentes.registrar_sales_assistant(corrida_id, {resumen, quien_es[], que_dijo[], estrategia{}, alertas[], faltantes[]}). La evidencia web/IG nueva va antes por agentes.registrar_fuente_publica.');
end $$;

-- ─── 3 · El expediente ─────────────────────────────────────────────────────────
create or replace view negocio.expediente_del_lead with (security_invoker = true) as
  select k.org_id, k.cuenta_id, k.id as contacto_id, k.ghl_contact_id,
    jsonb_strip_nulls(jsonb_build_object('nombre', k.nombre, 'etapa', k.etapa_estandar, 'salida', k.salida,
      'cuadrante_del_crm', k.cuadrante, 'canal_de_entrada', k.canal_de_entrada, 'fuente', k.fuente_estandar, 'pais', k.pais,
      'alta_en_el_crm', k.alta_en_el_crm, 'no_contactar', k.no_contactar_desde is not null)) as identidad,
    nullif(agentes._respuestas(k.org_id, k.cuenta_id, k.id), '{}'::jsonb) as formulario,
    (select jsonb_object_agg(e.tipo, e.n) from (select ev.tipo, count(*) as n from negocio.eventos ev
       where ev.org_id = k.org_id and ev.cuenta_id = k.cuenta_id and ev.contacto_id = k.id
         and ev.fuente not in ('ghl_managed_agents', 'comando_central') group by ev.tipo) e) as comportamiento,
    nullif(agentes._atribucion(k.org_id, k.cuenta_id, k.id), '{}'::jsonb) as atribucion,
    (select jsonb_build_object('total', count(*), 'recortado', count(*) > 50,
              'ultimos', (select jsonb_agg(jsonb_build_object('el', m2.enviado_el, 'canal', coalesce(m2.canal_estandar::text, m2.canal),
                                 'autor', m2.autor, 'texto', left(m2.cuerpo, 1000)) order by m2.enviado_el)
                            from (select * from negocio.mensajes m3 where m3.org_id = k.org_id and m3.cuenta_id = k.cuenta_id
                                     and m3.contacto_id = k.id order by m3.enviado_el desc limit 50) m2))
       from negocio.mensajes m where m.org_id = k.org_id and m.cuenta_id = k.cuenta_id and m.contacto_id = k.id
     having count(*) > 0) as conversacion,
    (select jsonb_agg(jsonb_build_object('cita_id', ci.id, 'inicio_el', ci.inicio_el, 'tipo', ci.tipo, 'estado', ci.estado_ghl,
              'asistio', ci.asistio, 'cuadrante_al_agendar', ci.cuadrante_al_agendar) order by ci.inicio_el)
       from negocio.citas ci where ci.org_id = k.org_id and ci.cuenta_id = k.cuenta_id and ci.contacto_id = k.id) as agenda,
    (select jsonb_agg(jsonb_build_object('llamada_id', l.id, 'tipo', l.tipo, 'inicio_el', l.inicio_el,
              'duracion_segundos', l.duracion_segundos, 'resumen', l.resumen,
              'transcripcion', (select left(t.texto, 4000) from negocio.transcripciones t where t.org_id = l.org_id
                                   and t.cuenta_id = l.cuenta_id and t.llamada_id = l.id order by t.creada_el desc limit 1),
              'transcripcion_recortada', (select length(t.texto) > 4000 from negocio.transcripciones t where t.org_id = l.org_id
                                   and t.cuenta_id = l.cuenta_id and t.llamada_id = l.id order by t.creada_el desc limit 1))
              order by l.inicio_el)
       from negocio.llamadas l where l.org_id = k.org_id and l.cuenta_id = k.cuenta_id and l.contacto_id = k.id) as llamadas,
    agentes._o(jsonb_build_object(
      'vigente', (select to_jsonb(tv) - 'org_id' - 'cuenta_id' from negocio.triaje_vigente tv
                   where tv.org_id = k.org_id and tv.cuenta_id = k.cuenta_id and tv.contacto_id = k.id),
      'clasificaciones', (select jsonb_agg(jsonb_build_object('cuadrante', c.cuadrante, 'origen', c.origen, 'el', c.clasificado_el)
                             order by c.clasificado_el)
                            from negocio.clasificaciones c where c.org_id = k.org_id and c.cuenta_id = k.cuenta_id and c.contacto_id = k.id)))
      as triaje,
    (select to_jsonb(fv) - 'org_id' - 'cuenta_id' from negocio.ficha_vigente fv
      where fv.org_id = k.org_id and fv.cuenta_id = k.cuenta_id and fv.contacto_id = k.id) as ficha,
    agentes._o(jsonb_build_object(
      'propuestos', (select jsonb_agg(jsonb_build_object('id', p.id, 'compro', p.compro, 'salida', p.salida, 'monto_usd', p.monto_usd,
                        'estado', p.estado, 'next_steps', p.next_steps, 'creado_el', p.creado_el) order by p.creado_el)
                       from negocio.resultados_propuestos p where p.org_id = k.org_id and p.cuenta_id = k.cuenta_id and p.contacto_id = k.id),
      'confirmados', (select jsonb_agg(jsonb_build_object('id', r.id, 'salida', r.salida, 'monto_usd', r.monto_usd, 'el', r.creado_el)
                         order by r.creado_el)
                        from negocio.resultados r where r.org_id = k.org_id and r.cuenta_id = k.cuenta_id and r.contacto_id = k.id)))
      as resultado,
    (select jsonb_agg(jsonb_build_object('id', ev.id, 'puntaje', ev.puntaje, 'fases', ev.fases, 'donde_se_perdio', ev.donde_se_perdio)
              order by ev.creada_el)
       from negocio.evaluaciones_de_llamada ev where ev.org_id = k.org_id and ev.cuenta_id = k.cuenta_id and ev.contacto_id = k.id)
      as evaluacion,
    (select jsonb_agg(jsonb_build_object('categoria', o.categoria, 'texto', o.texto, 'resuelta', o.resuelta) order by o.creada_el)
       from negocio.objeciones_de_llamada o where o.org_id = k.org_id and o.cuenta_id = k.cuenta_id and o.contacto_id = k.id) as objeciones,
    (select jsonb_agg(jsonb_build_object('id', b.id, 'motivo', b.motivo, 'canal', b.canal, 'estado', b.estado, 'cuerpo', b.cuerpo)
              order by b.creado_el)
       from negocio.borradores_de_mensaje b where b.org_id = k.org_id and b.cuenta_id = k.cuenta_id and b.contacto_id = k.id)
      as seguimientos,
    (select jsonb_agg(jsonb_build_object('fuente', 'publica:' || p.id, 'tipo', p.tipo, 'url', p.url, 'extracto', left(p.extracto, 1000),
              'observada_el', p.observada_el) order by p.observada_el)
       from negocio.fuentes_publicas p where p.org_id = k.org_id and p.cuenta_id = k.cuenta_id and p.contacto_id = k.id
         and not exists (select 1 from negocio.corridas_de_agente cx where cx.org_id = p.org_id and cx.cuenta_id = p.cuenta_id
                      and cx.id = p.corrida_id and cx.estado in ('fallida', 'reemplazada', 'cancelada')))
      as evidencia_publica,
    agentes._o(jsonb_build_object(
      'entregable', agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'brief'),
      'respuestas', (select jsonb_object_agg(bv.pregunta, jsonb_build_object('valor', coalesce(bv.valor_json, to_jsonb(bv.valor_texto)),
                        'estado', bv.estado, 'autor', bv.autor_tipo, 'fuente', bv.fuente))
                       from negocio.brief_vigente bv where bv.org_id = k.org_id and bv.cuenta_id = k.cuenta_id and bv.contacto_id = k.id)))
      as brief,
    agentes._research_del_lead(k.org_id, k.cuenta_id, k.id) as research,
    (select jsonb_agg(jsonb_build_object('sobre', d.sobre, 'decision', d.decision, 'autor', d.autor, 'el', d.creada_el) order by d.creada_el)
       from negocio.decisiones_de_kickoff d where d.org_id = k.org_id and d.cuenta_id = k.cuenta_id and d.contacto_id = k.id) as kickoff,
    agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'icp') as icp_del_lead,
    agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'categoria_y_oferta') as categoria_y_oferta,
    agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'precio_y_process_map') as precio_y_process_map,
    agentes._o(jsonb_build_object(
      'guion_vsl', agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'guion_vsl'),
      'anuncios', agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'anuncios'),
      'prompt_landing', agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'prompt_landing'),
      'piezas', (select jsonb_agg(jsonb_build_object('pieza_id', pc.id, 'tipo', pc.tipo, 'codigo', pc.codigo_de_nomenclatura,
                    'titular', pc.titular, 'estado', pc.estado) order by pc.creada_el)
                   from negocio.piezas_de_contenido pc where pc.org_id = k.org_id and pc.cuenta_id = k.cuenta_id and pc.contacto_id = k.id)))
      as embudo,
    (select jsonb_agg(jsonb_build_object('corrida_id', c.id, 'agente', c.agente, 'estado', c.estado, 'modo', c.modo, 'motivo', c.motivo,
              'identificado_por', c.identificado_por, 'abierta_el', c.abierta_el, 'terminada_el', c.terminada_el) order by c.abierta_el)
       from negocio.corridas_de_agente c where c.org_id = k.org_id and c.cuenta_id = k.cuenta_id and c.contacto_id = k.id) as corridas
  from negocio.contactos k;

-- ─── 4 · Las citas y los referentes: lo descartado no se cita ────────────────
create or replace function agentes._texto_de_la_fuente(p_corrida negocio.corridas_de_agente, p_fuente text) returns text
language sql stable security invoker set search_path = pg_catalog, catalogo, pg_temp
as $$
  select case jsonb_typeof(f) when 'string' then f #>> '{}' else f::text end
    from (select case
                   when coalesce(p_corrida.leido -> 'fuentes', '{}'::jsonb) ? p_fuente then p_corrida.leido -> 'fuentes' -> p_fuente
                   -- Las claves que arma la base (las de leer_*): el agente no las puede inventar en su entrada.
                   when p_fuente ~ '^(publica|llamada|llamada_venta|ficha|triage|sales_coach|conocimiento|formulario|campo|atribucion|mensajes|kickoff|corrida|entregable):'
                     or p_fuente ~ '@v[0-9]+$' then null
                   else p_corrida.entrada -> 'fuentes' -> p_fuente
                 end as f) x
   where f is not null
     and not (p_fuente like 'conocimiento:%'
              and exists (select 1 from catalogo.agentes a where a.clave = p_corrida.agente and a.cuenta_de_trabajo = 'contacto'))
     -- 117: la evidencia de una corrida fallida, reemplazada o cancelada no se cita, aunque esté en lo leído.
     and not exists (select 1 from negocio.fuentes_publicas fp
                       join negocio.corridas_de_agente cx on cx.org_id = fp.org_id and cx.cuenta_id = fp.cuenta_id and cx.id = fp.corrida_id
                      where fp.org_id = p_corrida.org_id
                        and fp.id = (case when p_fuente ~ '^publica:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                          then substr(p_fuente, 9)::uuid end)
                        and cx.estado in ('fallida', 'reemplazada', 'cancelada'))
$$;

create or replace function agentes.registrar_research(p_corrida uuid, p_salida jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v        negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_paso   text := agentes._tipo_de_la_corrida(v);
  v_err    jsonb := '[]'::jsonb;
  v_texto  text := nullif(btrim(p_salida ->> 'texto'), '');
  v_ver    uuid;
  d        jsonb;
  x        jsonb;
  v_seg_v  uuid;
  v_dol_v  uuid;
  v_seg    uuid;
  v_dol    uuid;
  v_fp     uuid;
  v_ext    text;
  v_ids    jsonb := '{}'::jsonb;
  n_filas  integer := 0;
  n_citas  integer := 0;
  n_verif  integer := 0;
  v_elegido text;
begin
  -- Una salida no puede traer OTRO lead: si nombra un contacto o un correo, tiene que ser el de la corrida.
  if agentes._otro_lead(v, p_salida) is not null then
    return agentes._rechazar(v, jsonb_build_array(agentes._otro_lead(v, p_salida)));
  end if;
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' then
    return agentes._rechazar(v, jsonb_build_array('la salida tiene que ser un objeto JSON'));
  end if;
  if v_paso is null then
    return agentes._rechazar(v, jsonb_build_array('la corrida no dice qué paso es (ábrela con p_sujeto.paso)'));
  end if;
  if not exists (select 1 from catalogo.tipos_de_entregable t where t.clave = v_paso and t.agente = v.agente) then
    return agentes._rechazar(v, jsonb_build_array(format('«%s» no es un paso del Research', v_paso)));
  end if;
  if exists (select 1 from (values ('segmentos'), ('dolores'), ('referentes'), ('citas'), ('precio')) k(clave)
             where p_salida ? k.clave and jsonb_typeof(p_salida -> k.clave) <> 'array') then
    return agentes._rechazar(v, jsonb_build_array('segmentos, dolores, referentes, citas y precio son listas'));
  end if;
  if v_texto is null then
    v_err := v_err || to_jsonb('texto: el documento del paso, en markdown'::text);
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_salida -> 'segmentos', '[]'::jsonb)) z
             where coalesce(btrim(z ->> 'nombre'), '') = '' or length(z ->> 'nombre') > 200) then
    v_err := v_err || to_jsonb('segmentos: cada uno con su nombre (hasta 200 caracteres)'::text);
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_salida -> 'dolores', '[]'::jsonb)) z
             where coalesce(btrim(coalesce(z ->> 'descripcion', z ->> 'dolor')), '') = '') then
    v_err := v_err || to_jsonb('dolores: cada uno con su descripcion'::text);
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_salida -> 'referentes', '[]'::jsonb)) z
             where coalesce(btrim(z ->> 'nombre'), '') = '') then
    v_err := v_err || to_jsonb('referentes: cada uno con su nombre'::text);
  end if;
  if not exists (select 1 from negocio.entregable_vigente ev where ev.org_id = v.org_id and ev.cuenta_id = v.cuenta_id
                   and ev.contacto_id = v.contacto_id and ev.tipo = 'brief') then
    v_err := v_err || to_jsonb('el lead todavía no tiene Brief (ni prellenado)'::text);
  end if;
  if v_paso = 'mr_segmentos' and jsonb_array_length(coalesce(p_salida -> 'segmentos', '[]'::jsonb)) not between 1 and 8 then
    v_err := v_err || to_jsonb('segmentos: de 1 a 8 (la skill pide 3 o 4), cada uno {nombre, descripcion, criterios[], valor_del_cliente, contrato_inicial, senales_de_tamano}'::text);
  end if;
  if v_paso = 'mr_dolores' and jsonb_array_length(coalesce(p_salida -> 'dolores', '[]'::jsonb)) = 0 then
    v_err := v_err || to_jsonb('dolores: al menos uno {segmento, etapa_del_recorrido, descripcion, intensidad 1-5, es_critico, dolor_comun?}'::text);
  end if;
  if v_paso = 'mr_dolores' and exists (select 1 from jsonb_array_elements(coalesce(p_salida -> 'dolores', '[]'::jsonb)) z
                                        where agentes._numero_malo(z -> 'intensidad', 1, 5) or agentes._booleano_malo(z -> 'es_critico')) then
    v_err := v_err || to_jsonb('dolores: intensidad de 1 a 5, es_critico true o false'::text);
  end if;
  if v_paso = 'mr_dolores' and not exists (select 1 from jsonb_array_elements(coalesce(p_salida -> 'dolores', '[]'::jsonb)) z where (z -> 'es_critico') = 'true'::jsonb) then
    v_err := v_err || to_jsonb('dolores: marca el dolor crítico (es_critico = true)'::text);
  end if;
  if v_paso = 'mr_decision' and coalesce(btrim(p_salida ->> 'segmento_elegido'), '') = '' then
    v_err := v_err || to_jsonb('segmento_elegido: el nombre del segmento más rentable'::text);
  end if;
  for x in select value from jsonb_array_elements(coalesce(p_salida -> 'citas', '[]'::jsonb)) loop
    if coalesce(x ->> 'fuente', '') !~ '^publica:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or agentes._texto_de_la_fuente(v, x ->> 'fuente') is null
       or not exists (select 1 from negocio.fuentes_publicas f where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id and f.contacto_id = v.contacto_id
                       and f.id = substr(x ->> 'fuente', 9)::uuid)
       or coalesce(btrim(x ->> 'texto'), '') = '' then
      v_err := v_err || to_jsonb(format('citas: la fuente «%s» no es una evidencia registrada (agentes.registrar_fuente_publica)', x ->> 'fuente'));
    end if;
  end loop;
  for x in select value from jsonb_array_elements(coalesce(p_salida -> 'dolores', '[]'::jsonb)) loop
    if x ? 'dolor_comun' and x ->> 'dolor_comun' is not null and not exists (select 1 from catalogo.dolores_comunes where clave = x ->> 'dolor_comun') then
      v_err := v_err || to_jsonb(format('dolores: «%s» no está en catalogo.dolores_comunes', x ->> 'dolor_comun'));
    end if;
  end loop;
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  d := agentes._entregables_vigentes(v.org_id, v.cuenta_id, v.contacto_id, array['brief', 'mr_segmentos', 'mr_dolores', 'mr_referentes', 'mr_precio', 'mr_decision']);
  v_ver := agentes._proponer_version(v, v_paso, coalesce(p_salida -> 'contenido', '{}'::jsonb) || (p_salida - 'texto' - 'contenido'),
                                     v_texto, d -> 'ids');
  v_seg_v := case when v_paso = 'mr_segmentos' then v_ver else (d #>> '{ids,mr_segmentos}')::uuid end;
  v_dol_v := case when v_paso = 'mr_dolores' then v_ver else (d #>> '{ids,mr_dolores}')::uuid end;

  if v_paso = 'mr_segmentos' then
    for x in select value from jsonb_array_elements(p_salida -> 'segmentos') loop
      insert into negocio.segmentos_del_mercado (org_id, cuenta_id, contacto_id, version_id, nombre, descripcion, criterios, valor_del_cliente,
                                                 contrato_inicial, senales_de_tamano)
      values (v.org_id, v.cuenta_id, v.contacto_id, v_ver, left(x ->> 'nombre', 200), left(x ->> 'descripcion', 4000),
              case when jsonb_typeof(x -> 'criterios') = 'array' then x -> 'criterios' else '[]'::jsonb end,
              left(x ->> 'valor_del_cliente', 1000), left(x ->> 'contrato_inicial', 1000), left(x ->> 'senales_de_tamano', 2000));
      n_filas := n_filas + 1;
    end loop;
  elsif v_paso = 'mr_dolores' then
    for x in select value from jsonb_array_elements(p_salida -> 'dolores') loop
      select s.id into v_seg from negocio.segmentos_del_mercado s
       where s.org_id = v.org_id and s.cuenta_id = v.cuenta_id and s.contacto_id = v.contacto_id and s.version_id = v_seg_v and lower(s.nombre) = lower(x ->> 'segmento') limit 1;
      v_dol := gen_random_uuid();
      insert into negocio.dolores_del_segmento (org_id, cuenta_id, contacto_id, id, version_id, segmento_id, segmento_nombre, etapa_del_recorrido,
                                                descripcion, intensidad, es_critico, dolor_comun)
      values (v.org_id, v.cuenta_id, v.contacto_id, v_dol, v_ver, v_seg, left(x ->> 'segmento', 200), left(x ->> 'etapa_del_recorrido', 200),
              left(coalesce(x ->> 'descripcion', x ->> 'dolor'), 4000), round(agentes._numero(x ->> 'intensidad'))::smallint,
              (x -> 'es_critico') = 'true'::jsonb, x ->> 'dolor_comun');
      v_ids := v_ids || jsonb_build_object(lower(coalesce(x ->> 'clave', x ->> 'descripcion', x ->> 'dolor')), v_dol);
      n_filas := n_filas + 1;
    end loop;
  elsif v_paso = 'mr_referentes' then
    for x in select value from jsonb_array_elements(coalesce(p_salida -> 'referentes', '[]'::jsonb)) loop
      select s.id into v_seg from negocio.segmentos_del_mercado s
       where s.org_id = v.org_id and s.cuenta_id = v.cuenta_id and s.contacto_id = v.contacto_id and s.version_id = v_seg_v and lower(s.nombre) = lower(x ->> 'segmento') limit 1;
      v_fp := case when x ->> 'fuente' ~ '^publica:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then substr(x ->> 'fuente', 9)::uuid end;
      insert into negocio.referentes_del_mercado (org_id, cuenta_id, contacto_id, version_id, segmento_id, tipo, nombre, url, que_ofrece, precio, fuente_publica_id)
      values (v.org_id, v.cuenta_id, v.contacto_id, v_ver, v_seg, case when x ->> 'tipo' = 'proveedor' then 'proveedor' else 'resolvio_el_dolor' end,
              left(x ->> 'nombre', 300), left(x ->> 'url', 2000), left(x ->> 'que_ofrece', 4000), left(x ->> 'precio', 300),
              case when exists (select 1 from negocio.fuentes_publicas f where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id and f.contacto_id = v.contacto_id and f.id = v_fp
                                  and not exists (select 1 from negocio.corridas_de_agente cx where cx.org_id = f.org_id and cx.cuenta_id = f.cuenta_id
                                                   and cx.id = f.corrida_id and cx.estado in ('fallida', 'reemplazada', 'cancelada'))) then v_fp end);
      n_filas := n_filas + 1;
    end loop;
  elsif v_paso = 'mr_decision' then
    -- La decisión no marca los segmentos (115): el elegido se calcula al leer, con la decisión vigente del lead.
    n_filas := 0;
  end if;

  -- Las citas del mercado: cada una contra su evidencia registrada.
  for x in select value from jsonb_array_elements(coalesce(p_salida -> 'citas', '[]'::jsonb)) loop
    v_fp := substr(x ->> 'fuente', 9)::uuid;
    select f.extracto into v_ext from negocio.fuentes_publicas f where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id and f.contacto_id = v.contacto_id and f.id = v_fp;
    select s.id into v_seg from negocio.segmentos_del_mercado s
     where s.org_id = v.org_id and s.cuenta_id = v.cuenta_id and s.contacto_id = v.contacto_id and s.version_id = v_seg_v and lower(s.nombre) = lower(x ->> 'segmento') limit 1;
    v_dol := coalesce((v_ids ->> lower(coalesce(x ->> 'dolor', '')))::uuid,
                      (select dd.id from negocio.dolores_del_segmento dd where dd.org_id = v.org_id and dd.cuenta_id = v.cuenta_id and dd.contacto_id = v.contacto_id
                          and dd.version_id = v_dol_v and (dd.id::text = x ->> 'dolor' or lower(dd.descripcion) = lower(x ->> 'dolor')) limit 1));
    insert into negocio.citas_del_mercado (org_id, cuenta_id, contacto_id, version_id, segmento_id, dolor_id, fuente_publica_id, texto, cita_verificada)
    values (v.org_id, v.cuenta_id, v.contacto_id, v_ver, v_seg, v_dol, v_fp, left(x ->> 'texto', 2000),
            position(agentes._normal(x ->> 'texto') in agentes._normal(v_ext)) > 0);
    n_citas := n_citas + 1;
    if position(agentes._normal(x ->> 'texto') in agentes._normal(v_ext)) > 0 then n_verif := n_verif + 1; end if;
  end loop;

  perform agentes._cerrar(v, p_salida, n_citas - n_verif, 'esperando_aprobacion');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'paso', v_paso, 'version_id', v_ver, 'filas', n_filas,
    'citas', n_citas, 'citas_verificadas', n_verif,
    'siguiente', 'el coach aprueba con agentes.decidir_entregable(version_id, ''aprobada'' | ''rechazada'' | ''corregida'', …); el paso siguiente se abre aparte');
end $$;
