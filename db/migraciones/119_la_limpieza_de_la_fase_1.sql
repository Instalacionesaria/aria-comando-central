-- 119 · La limpieza de la fase 1: se borra lo que Triage, Sales Assistant, Sales Coach y Brief dejaron sin uso.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (decisiones del usuario del 2026-11-20; docs/_privado/modelo-de-datos/28-LIMPIEZA-DE-NEGOCIO.md, etapa 1)
--
-- El esquema negocio tenía 85 tablas, 26 de los managed agents. La 118 dejó a los cuatro primeros agentes con un solo
-- output cada uno en negocio.respuestas_de_los_agentes, así que sus salidas estructuradas de la 110 a la 115 quedaron
-- sin uso. Se borran, sin respaldo (sólo tenían datos de prueba):
--   · 10 tablas: triajes, fichas_del_lead, resultados_propuestos, evaluaciones_de_llamada, objeciones_de_llamada,
--     borradores_de_mensaje, rutas_de_la_cuenta, conocimiento_de_la_cuenta, clientes y pagos;
--   · sus vistas (triaje_vigente, ficha_vigente, conocimiento_vigente), sus funciones (registrar_/leer_ de Triage,
--     Sales Assistant y Sales Coach, confirmar_resultado, registrar_pago, registrar_contrato, alta_del_comprador,
--     cargar_rutas, cargar_conocimiento, leer_conocimiento, marcar_ficha_leida, decidir_borrador), los catálogos que
--     quedan huérfanos (tipos_de_conocimiento, clases_de_ruta) y los tipos de evento sólo de ellas, si ningún evento
--     los usa;
--   · las columnas del «comprador»: corridas_de_agente.cliente_id y vendedor_*, y fuentes_publicas.cliente_id.
--
-- RESEARCH, ESTRATEGA Y FUNNEL BUILDER NO SE TOCAN (decisión del usuario: su output todavía no está definido). Sus
-- tablas y funciones quedan; sólo se corrige lo mínimo de las que leían algo que se borra (leer_brief,
-- responder_brief, _al_enviar_el_brief, _entregable), para que sigan andando igual.
--
-- LO QUE QUEDA Y SE CORRIGE: el disparador que vincula al lead que llega después (sin triajes: sin esto, todo alta de
-- contacto fallaría), abrir_corrida (sin la rama del comprador; el modo sombra era del Triage estructurado y ya no
-- existe; «siguiente» apunta a lo de la fase 1), registrar_fuente_publica y ver_corrida (sin cliente_id) y el
-- expediente (sin ficha, evaluación, objeciones ni seguimientos; el triaje queda con las clasificaciones y el resultado
-- con los confirmados).
--
-- UNA FUNCIÓN NUEVA, agentes.leer_llamada: la llamada de venta del lead con su transcripción entera. Reemplaza a
-- leer_sales_coach, que se borra: el Sales Coach queda en una sola corrida, sin abrir otra para buscar la llamada.
--
-- Las funciones se copian de su última definición (110, 115, 117 y 118) con un generador que falla si el texto que
-- cambia no está tal cual (scratchpad/limpieza/generar_119.py de la sesión 2ad51abd). Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · El expediente sale primero (lee las vistas que se borran); se vuelve a crear al final ─

drop view if exists negocio.expediente_del_lead;

-- ─── 2 · Las funciones que sólo servían a lo que se borra ────────────────────────

do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'agentes'
              and p.proname in ('registrar_triage', 'leer_triage', 'registrar_sales_assistant', 'leer_sales_assistant',
                                'marcar_ficha_leida', 'registrar_sales_coach', 'leer_sales_coach', 'decidir_borrador',
                                'confirmar_resultado', 'alta_del_comprador', 'registrar_pago', 'registrar_contrato',
                                'cargar_rutas', 'cargar_conocimiento', 'leer_conocimiento', '_conocimiento') loop
    execute format('drop function %s', f.firma);
  end loop;
end $$;

-- ─── 3 · Las vistas y las tablas ─────────────────────────────────────────────────

drop view if exists negocio.triaje_vigente;
drop view if exists negocio.ficha_vigente;
drop view if exists negocio.conocimiento_vigente;

-- Sin cascade: si algo que queda dependiera de ellas, la migración falla en vez de llevárselo.
drop table if exists negocio.pagos, negocio.clientes, negocio.borradores_de_mensaje, negocio.objeciones_de_llamada,
  negocio.evaluaciones_de_llamada, negocio.resultados_propuestos, negocio.fichas_del_lead, negocio.triajes,
  negocio.rutas_de_la_cuenta, negocio.conocimiento_de_la_cuenta;

drop table if exists catalogo.tipos_de_conocimiento, catalogo.clases_de_ruta;
drop function if exists negocio.el_conocimiento_no_sale_de_un_lead();

-- Los tipos de evento que sólo emitían las funciones borradas, si ningún evento los usa (los eventos no se borran).
-- Tipo por tipo y atajando la FK: quien migra no ve negocio.eventos (RLS forzada), así que un «not exists» le daría
-- siempre vacío; la clave foránea de los eventos sí los ve, y el tipo que tenga eventos se queda.
do $$
declare
  k text;
begin
  foreach k in array array['triaje_registrado', 'ruta_asignada', 'ficha_generada', 'ficha_leida', 'resultado_propuesto',
                           'seguimiento_redactado', 'llamada_evaluada', 'objecion_registrada', 'cliente_creado',
                           'contrato_firmado', 'conocimiento_publicado'] loop
    begin
      delete from catalogo.tipos_de_evento where clave = k;
    exception when foreign_key_violation then
      null;
    end;
  end loop;
end $$;

-- El pago vuelve a «pendiente» en el diccionario de inputs del flujo (la 112 lo había apuntado a negocio.pagos).
update catalogo.inputs_del_flujo set donde_vive = 'pendiente:negocio.pagos.monto_usd'
 where clave = 'pago' and donde_vive = 'columna:negocio.pagos.monto_usd';

-- ─── 4 · Las columnas del comprador ──────────────────────────────────────────────

alter table negocio.corridas_de_agente
  drop column if exists cliente_id,
  drop column if exists vendedor_org_id,
  drop column if exists vendedor_cuenta_id,
  drop column if exists vendedor_contacto_id;
alter table negocio.fuentes_publicas drop column if exists cliente_id;

-- Lo que los agentes ya no escriben: los resultados confirmados y las respuestas del formulario eran de
-- confirmar_resultado (borrada).
revoke insert on negocio.resultados, negocio.respuestas_del_lead from agente_mcp;

-- ─── 5 · Lo que queda, corregido ─────────────────────────────────────────────────

create or replace function agentes.abrir_corrida(
  p_agente               text,
  p_location_id          text,
  p_ghl_contact_id       text,
  p_clave_de_idempotencia text,
  p_entrada              jsonb default '{}'::jsonb,
  p_disparador           text default null,
  p_sujeto               jsonb default '{}'::jsonb,
  p_sesion_externa_id    text default null,
  p_version_del_agente   text default null,
  p_modo                 text default 'activo',
  p_version_de_la_skill  text default null,
  p_modelo               text default null,
  p_identificado_por    text default 'workflow'
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v_agente     catalogo.agentes;
  v_org        uuid;
  v_cuenta     uuid;
  v_contacto   negocio.contactos;
  v_cita       uuid;
  v_llamada    uuid;
  v_trab_org   uuid;
  v_trab_cta   uuid;
  v_sujeto     text;
  v_existente  negocio.corridas_de_agente;
  v_id         uuid := gen_random_uuid();
  v_motivo     text;
  v_sesion     text := nullif(btrim(current_setting('app.org_id', true)), '');
  v_faltantes  jsonb := '[]'::jsonb;
  v_reemplazo  uuid[];
begin
  p_sujeto := coalesce(p_sujeto, '{}'::jsonb);
  p_entrada := coalesce(p_entrada, '{}'::jsonb);
  select * into v_agente from catalogo.agentes where clave = p_agente and vigente;
  if not found then
    raise exception using errcode = '22023', message = format('agentes: «%s» no es un agente (catalogo.agentes)', p_agente);
  end if;
  if jsonb_typeof(p_entrada) <> 'object' or jsonb_typeof(p_sujeto) <> 'object' then
    raise exception using errcode = '22023', message = 'agentes: la entrada y el sujeto tienen que ser objetos JSON';
  end if;
  if p_entrada ? 'fuentes' and jsonb_typeof(p_entrada -> 'fuentes') <> 'object' then
    raise exception using errcode = '22023', message = 'agentes: entrada.fuentes tiene que ser un objeto {clave_de_fuente: texto}';
  end if;
  if coalesce(btrim(p_clave_de_idempotencia), '') = '' then
    raise exception using errcode = '22023', message = 'agentes: falta la clave de idempotencia (sale del disparador)';
  end if;
  if coalesce(p_modo, 'activo') not in ('activo', 'sombra') then
    raise exception using errcode = '22023', message = 'agentes: el modo es activo o sombra';
  end if;
  if coalesce(p_identificado_por, 'workflow') not in ('workflow', 'correo', 'persona') then
    raise exception using errcode = '22023', message = 'agentes: identificado_por es workflow, correo o persona';
  end if;
  -- El modo sombra era del Triage estructurado, que se borró en la 119: hoy ningún agente lo tiene.
  if coalesce(p_modo, 'activo') = 'sombra' then
    raise exception using errcode = '22023', message = 'agentes: ningún agente corre en modo sombra (desde la 119)';
  end if;

  -- La cuenta del vendedor: la location de GHL desde donde corre el agente.
  select c.org_id, c.id into v_org, v_cuenta
    from identidad.cuentas c where c.crm = 'ghl' and c.crm_cuenta_id = p_location_id and c.estado = 'activa';
  if v_cuenta is null then
    raise exception using errcode = 'P0002',
      message = format('agentes: la location de GHL «%s» no es una cuenta activa de Comando Central', p_location_id);
  end if;

  -- El lead.
  if p_ghl_contact_id is not null then
    select * into v_contacto from negocio.contactos k where k.org_id = v_org and k.ghl_contact_id = p_ghl_contact_id;
    if found and v_contacto.cuenta_id <> v_cuenta then
      raise exception using errcode = '42501', message = 'agentes: el contacto es de otra cuenta que la location';
    end if;
    if not found then
      v_faltantes := v_faltantes || to_jsonb('contacto_en_la_base'::text);
    end if;
  end if;

  -- La cita y la llamada del sujeto, si vienen.
  if p_sujeto ? 'ghl_evento_id' then
    select ci.id into v_cita from negocio.citas ci
     where ci.org_id = v_org and ci.cuenta_id = v_cuenta and ci.ghl_evento_id = p_sujeto ->> 'ghl_evento_id'
       and ci.contacto_id = v_contacto.id;
    if v_cita is null then
      v_faltantes := v_faltantes || to_jsonb('cita_en_la_base'::text);
    end if;
  end if;
  if p_sujeto ? 'llamada_id' then
    select l.id into v_llamada from negocio.llamadas l
     where l.org_id = v_org and l.cuenta_id = v_cuenta and l.id = (p_sujeto ->> 'llamada_id')::uuid
       and l.contacto_id = v_contacto.id;
    if v_llamada is null then
      raise exception using errcode = 'P0002', message = 'agentes: la llamada no es de este lead';
    end if;
  end if;

  -- Todos trabajan en la cuenta de la location, sobre el lead (119: sin la rama del comprador).
  v_trab_org := v_org;
  v_trab_cta := v_cuenta;

  -- Los agentes del lead que compró o no (Brief, Research, Estratega, Funnel Builder) trabajan sobre el contacto, en la
  -- misma cuenta: su expediente. La venta, si la hubo, es sólo una referencia.
  if v_agente.cuenta_de_trabajo = 'contacto' then
    if v_contacto.id is null then
      raise exception using errcode = 'P0002',
        message = 'agentes: este agente trabaja sobre un lead que ya está en la base (identifícalo con agentes.buscar_contacto)';
    end if;
  end if;

  if v_sesion is not null and v_sesion::uuid <> v_trab_org then
    raise exception using errcode = '42501', message = 'agentes: la sesión es de otra organización que la de la corrida';
  end if;

  -- Sin carreras: dos aperturas simultáneas de la misma clave o del mismo sujeto se esperan.
  perform pg_advisory_xact_lock(hashtextextended('corrida:' || v_trab_cta || ':' || p_agente || ':' || p_clave_de_idempotencia, 0));
  -- La idempotencia: la misma clave devuelve la misma corrida.
  select * into v_existente from negocio.corridas_de_agente
   where org_id = v_trab_org and cuenta_id = v_trab_cta and agente = p_agente and clave_de_idempotencia = p_clave_de_idempotencia;
  if found and ((v_existente.contacto_id is not null and v_existente.contacto_id is distinct from v_contacto.id)
                 or (v_agente.cuenta_de_trabajo in ('vendedor', 'contacto')
                     and v_existente.ghl_contact_id is distinct from p_ghl_contact_id)) then
    raise exception using errcode = '42501', message = 'agentes: esa clave de idempotencia ya es de una corrida de otro lead';
  end if;
  if found then
    return jsonb_build_object('ok', true, 'corrida_id', v_existente.id, 'reutilizada', true, 'estado', v_existente.estado,
      'org_id', v_existente.org_id, 'cuenta_id', v_existente.cuenta_id, 'contacto_id', v_existente.contacto_id,
      'cita_id', v_existente.cita_id, 'llamada_id', v_existente.llamada_id);
  end if;

  v_sujeto := case
    when v_agente.cuenta_de_trabajo = 'contacto'
      then 'contacto:' || v_contacto.id || coalesce(':' || coalesce(p_sujeto ->> 'paso', p_sujeto ->> 'etapa', p_sujeto ->> 'pieza'), '')
    when v_agente.sujeto = 'llamada' and v_llamada is not null then 'llamada:' || v_llamada
    when v_agente.sujeto = 'cita' and v_cita is not null then 'cita:' || (p_sujeto ->> 'ghl_evento_id')
    else 'contacto:' || coalesce(p_ghl_contact_id, p_clave_de_idempotencia)
  end;

  perform pg_advisory_xact_lock(hashtextextended('sujeto:' || v_trab_cta || ':' || p_agente || ':' || v_sujeto, 0));
  v_motivo := coalesce(p_sujeto ->> 'motivo', case when exists (
      select 1 from negocio.corridas_de_agente
       where org_id = v_trab_org and cuenta_id = v_trab_cta and agente = p_agente and sujeto_clave = v_sujeto)
    then 'datos_nuevos' else 'primera_vez' end);

  -- Una sola abierta por sujeto: la anterior queda reemplazada (su salida ya no se acepta).
  with r as (
    update negocio.corridas_de_agente
       set estado = 'reemplazada', reemplazada_por = v_id
     where org_id = v_trab_org and cuenta_id = v_trab_cta and agente = p_agente and sujeto_clave = v_sujeto and estado = 'abierta'
     returning id)
  select array_agg(id) into v_reemplazo from r;

  insert into negocio.corridas_de_agente (
    org_id, cuenta_id, id, agente, modo, sujeto_clave, contacto_id, ghl_contact_id, cita_id, llamada_id,
    disparador, clave_de_idempotencia, motivo,
    entrada, entrada_huella, sesion_externa_id, version_del_agente, version_de_la_skill, modelo, identificado_por)
  values (
    v_trab_org, v_trab_cta, v_id, p_agente, coalesce(p_modo, 'activo'), left(v_sujeto, 300),
    v_contacto.id, p_ghl_contact_id, v_cita, v_llamada,
    p_disparador, p_clave_de_idempotencia, v_motivo, p_entrada, md5(p_entrada::text),
    p_sesion_externa_id, p_version_del_agente, p_version_de_la_skill, p_modelo, coalesce(p_identificado_por, 'workflow'));

  return jsonb_build_object('ok', true, 'corrida_id', v_id, 'reutilizada', false, 'estado', 'abierta', 'motivo', v_motivo,
    'org_id', v_trab_org, 'cuenta_id', v_trab_cta, 'contacto_id', v_contacto.id, 'cita_id', v_cita, 'llamada_id', v_llamada,
    'reemplazo_a', to_jsonb(v_reemplazo),
    'no_contactar', v_contacto.no_contactar_desde is not null, 'faltantes', v_faltantes,
    'identificado_por', coalesce(p_identificado_por, 'workflow'),
    -- Lo siguiente: los agentes de la fase 1 leen el expediente y guardan su columna (118); los demás, su leer_.
    'siguiente', case
      when exists (select 1 from catalogo.salidas_de_los_agentes s where s.agente = p_agente and s.tipo = 'cuadrante' and s.vigente)
        then format('select agentes.expediente(%L, %L) y después agentes.registrar_cuadrante(%L, <cuadrante>, <razón>)', v_id, '{identidad,formulario}', v_id)
      when p_agente = 'sales_coach'
        then format('select agentes.leer_llamada(%L) y después agentes.guardar_respuesta(%L, <html>)', v_id, v_id)
      when exists (select 1 from catalogo.salidas_de_los_agentes s where s.agente = p_agente and s.vigente)
        then format('select agentes.expediente(%L) y después agentes.guardar_respuesta(%L, <html>)', v_id, v_id)
      else format('select agentes.leer_%s(%L)', p_agente, v_id) end);
end $$;

create or replace function agentes._entregable(p_corrida negocio.corridas_de_agente, p_tipo text) returns negocio.entregables
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  e negocio.entregables;
begin
  if p_corrida.contacto_id is null then
    raise exception using errcode = 'P0002', message = 'agentes: la corrida no tiene lead: no hay expediente donde guardar';
  end if;
  insert into negocio.entregables (org_id, cuenta_id, contacto_id, tipo)
  values (p_corrida.org_id, p_corrida.cuenta_id, p_corrida.contacto_id, p_tipo)
  on conflict (org_id, cuenta_id, contacto_id, tipo) do nothing;
  select * into e from negocio.entregables
   where org_id = p_corrida.org_id and cuenta_id = p_corrida.cuenta_id and contacto_id = p_corrida.contacto_id and tipo = p_tipo;
  return e;
end $$;

create or replace function agentes._al_enviar_el_brief(p_entregable negocio.entregables, p_version negocio.versiones_de_entregable)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v_quien  text;
begin
  perform agentes._registrar_evento(p_entregable.org_id,
    p_entregable.cuenta_id,
    'brief_enviado',
    p_entregable.contacto_id,
    'persona',
    coalesce(p_version.autor_usuario_id::text, 'cliente'),
    'comando_central',
    'brief_enviado:' || p_version.id,
    jsonb_build_object('entregable_id', p_entregable.id, 'version', p_version.numero, 'version_id', p_version.id),
    now());

  -- La pregunta 9 (a quién vende) vive en el Brief del lead, y se devuelve. (Desde la 119 no hay venta registrada donde
  -- copiarla: la tabla de ventas de los agentes se borró.)
  select coalesce(
           (select coalesce(bv.valor_texto, bv.valor_json #>> '{}') from negocio.brief_vigente bv
              join catalogo.preguntas_del_brief q2 on q2.clave = bv.pregunta and q2.decide_la_variante and q2.vigente
             where bv.org_id = p_entregable.org_id and bv.cuenta_id = p_entregable.cuenta_id
               and bv.contacto_id = p_entregable.contacto_id and bv.entregable_id = p_entregable.id
               and bv.estado <> 'vacio' limit 1),
           (select coalesce(bv.valor_texto, bv.valor_json #>> '{}') from negocio.brief_vigente bv
             where bv.org_id = p_entregable.org_id and bv.cuenta_id = p_entregable.cuenta_id
               and bv.contacto_id = p_entregable.contacto_id and bv.entregable_id = p_entregable.id
               and bv.pregunta = 'a_quien_vende' and bv.estado <> 'vacio'),
           -- Si nadie la respondió, vale la que propuso el agente.
           (select pv.contenido ->> 'a_quien_vende_propuesto' from negocio.versiones_de_entregable pv
             where pv.org_id = p_entregable.org_id and pv.cuenta_id = p_entregable.cuenta_id
               and pv.contacto_id = p_entregable.contacto_id and pv.entregable_id = p_entregable.id
               and pv.autor_tipo = 'agente_ia' order by pv.numero desc limit 1))
    into v_quien;
  return jsonb_build_object('a_quien_vende', v_quien);
end $$;

create or replace function agentes.responder_brief(p_contacto uuid, p_respuestas jsonb, p_enviar boolean default false,
  p_usuario uuid default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  k         negocio.contactos;
  v_sesion  text := nullif(btrim(current_setting('app.org_id', true)), '');
  e         negocio.entregables;
  r         jsonb;
  b         record;
  v_estado  text;
  v_valor_t text;
  v_version text;
  n         integer := 0;
  v_ver     negocio.versiones_de_entregable;
  v_res     jsonb;
  v_cont    jsonb;
  v_falta   jsonb;
begin
  select * into k from negocio.contactos where id = p_contacto;
  if not found then raise exception using errcode = 'P0002', message = 'agentes: el lead no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> k.org_id then
    raise exception using errcode = '42501', message = 'agentes: el lead es de otra organización que la de la sesión';
  end if;
  insert into negocio.entregables (org_id, cuenta_id, contacto_id, tipo)
  values (k.org_id, k.cuenta_id, k.id, 'brief')
  on conflict (org_id, cuenta_id, contacto_id, tipo) do nothing;
  select * into e from negocio.entregables where org_id = k.org_id and cuenta_id = k.cuenta_id and contacto_id = k.id and tipo = 'brief';
  -- Dos envíos a la vez se esperan; el segundo relee el entregable y ve la versión que dejó el primero.
  perform pg_advisory_xact_lock(hashtextextended('entregable:' || e.id, 0));
  select * into e from negocio.entregables where org_id = k.org_id and cuenta_id = k.cuenta_id and id = e.id;
  select coalesce(max(version_del_brief), 'libre') into v_version from catalogo.preguntas_del_brief where vigente;

  for r in select value from jsonb_array_elements(coalesce(p_respuestas, '[]'::jsonb)) loop
    if coalesce(btrim(r ->> 'pregunta'), '') = '' then continue; end if;
    select * into b from negocio.brief_vigente
     where org_id = k.org_id and cuenta_id = k.cuenta_id and contacto_id = k.id and entregable_id = e.id and pregunta = r ->> 'pregunta';
    v_valor_t := case when jsonb_typeof(r -> 'valor') = 'string' then r ->> 'valor' end;
    -- Lo mismo que el lead ya dijo no es otra respuesta (un formulario reenvía todo).
    if b.autor_tipo = 'cliente' and (coalesce(b.valor_json, to_jsonb(b.valor_texto)) is not distinct from r -> 'valor'
        or (b.estado = 'vacio' and (coalesce(jsonb_typeof(r -> 'valor'), 'null') = 'null'
                                    or (jsonb_typeof(r -> 'valor') = 'string' and btrim(r ->> 'valor') = '')))) then
      continue;
    end if;
    v_estado := case
      when coalesce(jsonb_typeof(r -> 'valor'), 'null') = 'null' or (jsonb_typeof(r -> 'valor') = 'string' and btrim(r ->> 'valor') = '') then 'vacio'
      when b.pregunta is null or b.estado = 'vacio' then 'completado'
      when coalesce(b.valor_json, to_jsonb(b.valor_texto)) = r -> 'valor' then 'confirmado'
      else 'corregido' end;
    insert into negocio.respuestas_del_brief (org_id, cuenta_id, contacto_id, entregable_id, version_del_brief, pregunta, valor_texto,
      valor_json, estado, autor_tipo, autor_usuario_id, reemplaza_a)
    values (k.org_id, k.cuenta_id, k.id, e.id, v_version, r ->> 'pregunta', left(v_valor_t, 20000),
      case when jsonb_typeof(r -> 'valor') not in ('string', 'null') then r -> 'valor' end, v_estado, 'cliente', p_usuario, b.respuesta_id);
    n := n + 1;
  end loop;

  if not p_enviar then
    return jsonb_build_object('ok', true, 'entregable_id', e.id, 'guardadas', n, 'enviado', false);
  end if;

  -- Enviar lo hace una persona de la organización (por el lead, o el lead con su usuario). Y el lead tiene que haber
  -- respondido algo: el prellenado del agente solo no es un Brief enviado.
  if p_usuario is null or not exists (select 1 from identidad.usuarios u where u.id = p_usuario and u.org_id = k.org_id) then
    raise exception using errcode = '22023', message = 'agentes: enviar el Brief lo hace una persona de la organización';
  end if;
  if not exists (select 1 from negocio.brief_vigente bv where bv.org_id = k.org_id and bv.cuenta_id = k.cuenta_id
                  and bv.contacto_id = k.id and bv.entregable_id = e.id and bv.autor_tipo = 'cliente' and bv.estado <> 'vacio') then
    return jsonb_build_object('ok', false, 'entregable_id', e.id, 'errores', jsonb_build_array('el lead no respondió ni confirmó ninguna pregunta'));
  end if;

  -- Las obligatorias tienen que tener valor (si el catálogo tiene la lista).
  select coalesce(jsonb_agg(q.clave), '[]'::jsonb) into v_falta from catalogo.preguntas_del_brief q
   where q.version_del_brief = v_version and q.vigente and q.obligatoria and q.variante = 'comun'
     and not exists (select 1 from negocio.brief_vigente bv where bv.org_id = k.org_id and bv.cuenta_id = k.cuenta_id
                      and bv.contacto_id = k.id and bv.entregable_id = e.id and bv.pregunta = q.clave and bv.estado <> 'vacio');
  if jsonb_array_length(v_falta) > 0 then
    return jsonb_build_object('ok', false, 'entregable_id', e.id, 'guardadas', n, 'errores', jsonb_build_array('faltan obligatorias'),
      'faltan', v_falta);
  end if;

  select coalesce(jsonb_object_agg(bv.pregunta, jsonb_build_object('valor', coalesce(bv.valor_json, to_jsonb(bv.valor_texto)),
           'estado', bv.estado, 'autor', bv.autor_tipo, 'fuente', bv.fuente)), '{}'::jsonb)
    into v_cont from negocio.brief_vigente bv
   where bv.org_id = k.org_id and bv.cuenta_id = k.cuenta_id and bv.contacto_id = k.id and bv.entregable_id = e.id;
  -- Un reenvío sin cambios no es otra versión. Se comparan sólo los VALORES de cada pregunta.
  if e.estado = 'aprobado' and exists (
       select 1 from negocio.versiones_de_entregable pv where pv.org_id = k.org_id and pv.cuenta_id = k.cuenta_id
          and pv.contacto_id = k.id and pv.id = e.version_aprobada_id and jsonb_typeof(pv.contenido -> 'respuestas') = 'object'
          and (select coalesce(jsonb_object_agg(kk, x -> 'valor'), '{}'::jsonb) from jsonb_each(pv.contenido -> 'respuestas') j(kk, x))
            = (select coalesce(jsonb_object_agg(kk, x -> 'valor'), '{}'::jsonb) from jsonb_each(v_cont) j(kk, x))) then
    return jsonb_build_object('ok', true, 'entregable_id', e.id, 'guardadas', n, 'enviado', true, 'sin_cambios', true,
      'version_id', e.version_aprobada_id);
  end if;
  insert into negocio.versiones_de_entregable (org_id, cuenta_id, contacto_id, entregable_id, numero, autor_tipo, autor_usuario_id,
                                               contenido, estado, decidida_por, decidida_el, motivo)
  values (k.org_id, k.cuenta_id, k.id, e.id,
          (select coalesce(max(numero), 0) + 1 from negocio.versiones_de_entregable
            where org_id = k.org_id and cuenta_id = k.cuenta_id and entregable_id = e.id),
          'cliente', p_usuario, jsonb_build_object('version_del_brief', v_version, 'respuestas', v_cont), 'aprobada',
          p_usuario, now(), 'enviado por el lead')
  returning * into v_ver;
  update negocio.versiones_de_entregable set estado = 'corregida', decidida_el = now(), decidida_por = p_usuario,
         motivo = 'el lead envió la versión ' || v_ver.numero
   where org_id = k.org_id and cuenta_id = k.cuenta_id and entregable_id = e.id and estado = 'propuesta';
  update negocio.entregables set estado = 'aprobado', version_aprobada_id = v_ver.id, version_vigente_id = v_ver.id, actualizado_el = now()
   where org_id = k.org_id and cuenta_id = k.cuenta_id and id = e.id
   returning * into e;
  update negocio.corridas_de_agente set estado = 'aprobada'
   where org_id = k.org_id and cuenta_id = k.cuenta_id and contacto_id = k.id and agente = 'brief' and estado = 'esperando_aprobacion';
  v_res := agentes._al_enviar_el_brief(e, v_ver);
  return jsonb_build_object('ok', true, 'entregable_id', e.id, 'guardadas', n, 'enviado', true, 'version_id', v_ver.id) || v_res;
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
  v_trans   record;
  v_preg    jsonb;
  v_version text;
  v_actual  jsonb;
  e         negocio.entregables := agentes._entregable(v, 'brief');
begin
  -- 119: la ficha estructurada y el resultado propuesto se borraron; la ficha de la fase 1 se lee con leer_respuesta.
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

create or replace function agentes.registrar_fuente_publica(
  p_corrida uuid, p_tipo text, p_extracto text, p_url text default null, p_titulo text default null,
  p_datos jsonb default '{}'::jsonb, p_obtenida_por text default 'web_fetch', p_vigente_dias integer default 30)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v  negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_id uuid := gen_random_uuid();
begin
  insert into negocio.fuentes_publicas (org_id, cuenta_id, id, corrida_id, contacto_id, tipo, url, titulo,
                                        extracto, datos, obtenida_por, vigente_hasta)
  values (v.org_id, v.cuenta_id, v_id, v.id, v.contacto_id, p_tipo, p_url, p_titulo, left(p_extracto, 8000),
          coalesce(p_datos, '{}'::jsonb), coalesce(p_obtenida_por, 'web_fetch'),
          case when p_vigente_dias is not null then now() + make_interval(days => p_vigente_dias) end);
  perform agentes._anotar_lectura(v, jsonb_build_object('publica:' || v_id, left(p_extracto, 8000)));
  return jsonb_build_object('ok', true, 'fuente_publica_id', v_id, 'fuente', 'publica:' || v_id);
end $$;

create or replace function agentes.ver_corrida(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v negocio.corridas_de_agente := agentes._corrida(p_corrida, false);
begin
  return jsonb_build_object('corrida_id', v.id, 'agente', v.agente, 'estado', v.estado, 'modo', v.modo, 'motivo', v.motivo,
    'contacto_id', v.contacto_id, 'cita_id', v.cita_id, 'llamada_id', v.llamada_id,
    'salida', v.salida, 'degradados', v.degradados, 'errores', v.errores, 'intentos', v.intentos,
    'abierta_el', v.abierta_el, 'terminada_el', v.terminada_el, 'conocimiento', v.conocimiento,
    'fuentes_citables', (select coalesce(jsonb_agg(k), '[]'::jsonb) from (
        select jsonb_object_keys(coalesce(v.entrada -> 'fuentes', '{}'::jsonb)) as k
        union select jsonb_object_keys(coalesce(v.leido -> 'fuentes', '{}'::jsonb))) x));
end $$;

create or replace function negocio.vincular_lo_del_agente() returns trigger
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v_corridas uuid[];
begin
  with c as (
    update negocio.corridas_de_agente
       set contacto_id = new.id
     where org_id = new.org_id and cuenta_id = new.cuenta_id and ghl_contact_id = new.ghl_contact_id and contacto_id is null
    returning id)
  select array_agg(id) into v_corridas from c;
  if v_corridas is not null then
    update negocio.fuentes_publicas set contacto_id = new.id
     where org_id = new.org_id and cuenta_id = new.cuenta_id and corrida_id = any (v_corridas) and contacto_id is null;
    update negocio.acciones_externas set contacto_id = new.id
     where org_id = new.org_id and cuenta_id = new.cuenta_id and corrida_id = any (v_corridas) and contacto_id is null;
  end if;
  return null;
end $$;

-- ─── 6 · La llamada de venta del lead, con su transcripción entera ──────────────
-- Para el Sales Coach (y cualquiera que la necesite): la indicada o, si no se indica, la de venta más reciente con
-- transcripción. Sólo del lead de la corrida. Queda en lo leído como llamada_venta:<id>.
create or replace function agentes.leer_llamada(p_corrida uuid, p_llamada_id uuid default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v negocio.corridas_de_agente := agentes._corrida(p_corrida, false);
  l record;
begin
  if v.contacto_id is null then
    return jsonb_build_object('ok', true, 'llamada_id', null, 'motivo', 'el lead todavía no está en la base');
  end if;
  select ll.id, ll.tipo, ll.proveedor, ll.titulo, ll.inicio_el, ll.duracion_segundos, t.texto
    into l
    from negocio.llamadas ll
    join lateral (select tt.texto from negocio.transcripciones tt
                   where tt.org_id = ll.org_id and tt.cuenta_id = ll.cuenta_id and tt.llamada_id = ll.id
                     and tt.contacto_id = v.contacto_id
                   order by tt.creada_el desc limit 1) t on true
   where ll.org_id = v.org_id and ll.cuenta_id = v.cuenta_id and ll.contacto_id = v.contacto_id
     and ((p_llamada_id is null and ll.tipo = 'venta') or ll.id = p_llamada_id)
   order by coalesce(ll.inicio_el, ll.creado_el) desc
   limit 1;
  if l.id is null then
    return jsonb_build_object('ok', true, 'llamada_id', null,
      'motivo', case when p_llamada_id is null then 'el lead no tiene una llamada de venta con transcripción'
                     else 'esa llamada no es de este lead o no tiene transcripción' end);
  end if;
  if v.estado = 'abierta' then
    perform agentes._anotar_lectura(v, jsonb_build_object(
      case when l.tipo = 'venta' then 'llamada_venta:' else 'llamada:' end || l.id, l.texto));
  end if;
  return jsonb_build_object('ok', true, 'llamada_id', l.id, 'tipo', l.tipo, 'proveedor', l.proveedor, 'titulo', l.titulo,
    'inicio_el', l.inicio_el, 'duracion_segundos', l.duracion_segundos, 'fuente', case when l.tipo = 'venta' then 'llamada_venta:' else 'llamada:' end || l.id,
    'transcripcion', l.texto);
end $$;

-- ─── 7 · El expediente, sin lo que se borró ──────────────────────────────────────
create view negocio.expediente_del_lead with (security_invoker = true) as
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
      'clasificaciones', (select jsonb_agg(jsonb_build_object('cuadrante', c.cuadrante, 'origen', c.origen, 'el', c.clasificado_el)
                             order by c.clasificado_el)
                            from negocio.clasificaciones c where c.org_id = k.org_id and c.cuenta_id = k.cuenta_id and c.contacto_id = k.id)))
      as triaje,
    agentes._o(jsonb_build_object(
      'confirmados', (select jsonb_agg(jsonb_build_object('id', r.id, 'salida', r.salida, 'monto_usd', r.monto_usd, 'el', r.creado_el)
                         order by r.creado_el)
                        from negocio.resultados r where r.org_id = k.org_id and r.cuenta_id = k.cuenta_id and r.contacto_id = k.id)))
      as resultado,
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
       from negocio.corridas_de_agente c where c.org_id = k.org_id and c.cuenta_id = k.cuenta_id and c.contacto_id = k.id) as corridas,
    -- 118: qué dejó cada agente en respuestas_de_los_agentes y cuándo, sin el HTML (se lee con agentes.leer_respuesta).
    (select jsonb_strip_nulls(jsonb_build_object('triage_cuadrante_de_clasificacion', r.triage_cuadrante_de_clasificacion,
              'procedencia', r.procedencia))
       from negocio.respuestas_de_los_agentes r
      where r.org_id = k.org_id and r.cuenta_id = k.cuenta_id and r.contacto_id = k.id) as respuestas_de_los_agentes
  from negocio.contactos k;
comment on view negocio.expediente_del_lead is
  'El expediente de cada lead (115; 119 sin ficha, evaluación, objeciones ni seguimientos): una fila por contacto y una columna jsonb por sección, con lo vigente de cada una. Una sección vacía es null; lo largo se recorta y lo dice. Sin teléfono ni correo. Se lee siempre filtrando por contacto_id.';
revoke all on negocio.expediente_del_lead from public, app_inquilino;
grant select on negocio.expediente_del_lead to app_inquilino, agente_mcp;

-- ─── 8 · Permisos ────────────────────────────────────────────────────────────────
-- Nada para PUBLIC; el inquilino y el rol de los agentes ejecutan todo lo que queda (las que el rol no podía
-- ejecutar —cargar_conocimiento, cargar_rutas, alta_del_comprador— ya no existen).
do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'agentes' loop
    execute format('revoke all on function %s from public', f.firma);
    execute format('grant execute on function %s to app_inquilino, agente_mcp', f.firma);
  end loop;
end $$;
