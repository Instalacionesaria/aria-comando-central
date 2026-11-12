-- 115 · El expediente del lead: lo que producen los managed agents es del LEAD, no de la cuenta, y guardarlo no dispara
-- nada.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (MANAGED-AGENTS-CORRECCION-DATOS-POR-LEAD.md, decisiones del usuario del 2026-11-11)
--
-- Las 110 a 114 se diseñaron para «la cuenta del comprador»: Brief, Research, Estratega y Funnel Builder trabajarían en
-- una cuenta propia de cada cliente que compró, y ahí había un solo cliente. Por eso había un entregable de cada tipo
-- por cuenta, las lecturas filtraban por cuenta y el ICP aprobado se publicaba como el ICP de esa cuenta.
--
-- El escenario real es otro: todo pasa en la cuenta de ARIA, sobre miles de leads, hayan comprado o no. Con eso, «uno
-- por cuenta» es «uno para todos los leads» (el Brief del lead B pisaba al del A), «filtrar por cuenta» es «leer a
-- todos los leads» y «publicar en la cuenta» es «reemplazar el ICP de ARIA». La corrección es una sola idea, aplicada
-- en todas partes:
--
--   · LO QUE PRODUCEN LOS AGENTES ES DEL LEAD. Los entregables, sus versiones, las respuestas del Brief, los segmentos,
--     dolores, referentes, citas, piezas y decisiones de la Kickoff llevan contacto_id NOT NULL, con claves foráneas
--     compuestas que hacen imposible colgar la fila de un lead del entregable de otro. Un entregable de cada tipo POR
--     LEAD. Toda lectura de agentes.* filtra por el (org_id, cuenta_id, contacto_id) de la corrida.
--   · GUARDAR NO DISPARA NADA. Aprobar el ICP de un lead ya no lo publica como conocimiento de la cuenta (y un
--     disparador rechaza cualquier conocimiento con origen «entregable»); «desactualizado» se calcula al leer y no se
--     escribe; confirmar una venta o registrar un pago ya no crean la cuenta del comprador; enviar el Brief no copia
--     respuestas al formulario del lead ni cambia el estado de la venta (sólo deja la pregunta 9 en la venta, si la hay).
--   · LOS CUATRO AGENTES DEL CLIENTE CORREN SOBRE CUALQUIER LEAD (cuenta_de_trabajo = 'contacto'): no necesitan una
--     venta ni una cuenta propia. El Research corre con el Brief vigente del lead, el enviado o el prellenado.
--   · EL EXPEDIENTE: negocio.expediente_del_lead, una fila por contacto y una columna jsonb por sección, y
--     agentes.expediente(corrida, secciones) para leerlo. agentes.buscar_contacto(location, correo) para identificar a
--     mano, y corridas_de_agente.identificado_por.
--   · El Sales Assistant ya no lee el conteo de objeciones de toda la cuenta; una salida que nombra otro contacto se
--     rechaza; el rol de los agentes ya no ejecuta cargar_conocimiento, cargar_rutas ni alta_del_comprador.
--
-- En producción, al escribir esto, todas las tablas de los agentes tienen 0 filas: las columnas nuevas nacen NOT NULL
-- sin relleno. Si alguna tuviera filas, el `add column … not null` falla entero y no deja nada a medias.
--
-- La lógica de la cuenta del comprador (alta_del_comprador, cuenta_de_trabajo = 'comprador') queda en el código, sin
-- uso. Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · Los cuatro agentes del cliente trabajan sobre el lead ───────────────────

alter table catalogo.agentes drop constraint if exists agentes_cuenta_de_trabajo_check;
alter table catalogo.agentes add constraint agentes_cuenta_de_trabajo_check
  check (cuenta_de_trabajo in ('vendedor', 'comprador', 'contacto'));
update catalogo.agentes set cuenta_de_trabajo = 'contacto', sujeto = 'contacto'
 where clave in ('brief', 'research', 'estratega', 'funnel_builder') and cuenta_de_trabajo <> 'contacto';
comment on column catalogo.agentes.cuenta_de_trabajo is
  'Dónde quedan sus salidas: vendedor (los del lead antes de la venta), contacto (los del cliente: sobre el lead, en la misma cuenta, haya comprado o no) o comprador (la cuenta propia del que compró; sin uso desde la 115).';

-- ─── 2 · Cómo se identificó al lead ──────────────────────────────────────────────

alter table negocio.corridas_de_agente add column if not exists identificado_por text not null default 'workflow';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'corridas_identificado_por_valido') then
    alter table negocio.corridas_de_agente add constraint corridas_identificado_por_valido
      check (identificado_por in ('workflow', 'correo', 'persona'));
  end if;
end $$;
comment on column negocio.corridas_de_agente.identificado_por is
  'Cómo se supo quién es el lead: workflow (el contact_id del disparador de GHL), correo (agentes.buscar_contacto, en una prueba a mano) o persona.';

-- ─── 3 · Cada fila de lo que producen los agentes lleva su lead ──────────────────

-- Los entregables: uno de cada tipo POR LEAD.
alter table negocio.entregables add column if not exists contacto_id uuid not null;
alter table negocio.entregables drop constraint if exists entregables_org_id_cuenta_id_tipo_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entregables_uno_por_lead_y_tipo') then
    alter table negocio.entregables add constraint entregables_uno_por_lead_y_tipo unique (org_id, cuenta_id, contacto_id, tipo);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entregables_org_cuenta_id_contacto') then
    alter table negocio.entregables add constraint entregables_org_cuenta_id_contacto unique (org_id, cuenta_id, id, contacto_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entregables_del_lead') then
    alter table negocio.entregables add constraint entregables_del_lead
      foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade;
  end if;
end $$;
comment on column negocio.entregables.contacto_id is 'El lead dueño del entregable (115): un Brief, un Research, un ICP… por lead.';
comment on table negocio.entregables is
  'Un documento por lead y por tipo (113, por lead desde la 115): el Brief, cada paso del Research, cada etapa del Estratega, cada pieza del Funnel Builder. La vigente es la última aprobada, o la última propuesta si no hay aprobada.';

-- Las versiones: del mismo lead que su entregable (la clave foránea lo exige).
alter table negocio.versiones_de_entregable add column if not exists contacto_id uuid not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'versiones_del_mismo_lead_que_el_entregable') then
    alter table negocio.versiones_de_entregable add constraint versiones_del_mismo_lead_que_el_entregable
      foreign key (org_id, cuenta_id, entregable_id, contacto_id) references negocio.entregables (org_id, cuenta_id, id, contacto_id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'versiones_org_cuenta_id_contacto') then
    alter table negocio.versiones_de_entregable add constraint versiones_org_cuenta_id_contacto unique (org_id, cuenta_id, id, contacto_id);
  end if;
end $$;
comment on column negocio.versiones_de_entregable.contacto_id is 'El lead (115). Igual al de su entregable: la clave foránea compuesta lo exige.';

-- Las respuestas del Brief: del lead de su entregable.
alter table negocio.respuestas_del_brief add column if not exists contacto_id uuid not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'respuestas_brief_del_mismo_lead') then
    alter table negocio.respuestas_del_brief add constraint respuestas_brief_del_mismo_lead
      foreign key (org_id, cuenta_id, entregable_id, contacto_id) references negocio.entregables (org_id, cuenta_id, id, contacto_id)
      on delete cascade;
  end if;
end $$;
comment on column negocio.respuestas_del_brief.contacto_id is 'El lead (115). Igual al del Brief: la clave foránea compuesta lo exige.';

-- Las filas del Research y las piezas: del lead de su versión.
do $$
declare
  t text;
begin
  foreach t in array array['segmentos_del_mercado', 'dolores_del_segmento', 'referentes_del_mercado', 'citas_del_mercado',
                           'piezas_de_contenido'] loop
    execute format('alter table negocio.%I add column if not exists contacto_id uuid not null', t);
    if not exists (select 1 from pg_constraint where conname = t || '_del_mismo_lead_que_la_version') then
      execute format('alter table negocio.%I add constraint %I foreign key (org_id, cuenta_id, version_id, contacto_id)
                        references negocio.versiones_de_entregable (org_id, cuenta_id, id, contacto_id) on delete cascade',
                     t, t || '_del_mismo_lead_que_la_version');
    end if;
    execute format('create index if not exists %I on negocio.%I (org_id, cuenta_id, contacto_id)', t || '_por_lead', t);
    execute format('comment on column negocio.%I.contacto_id is %L', t,
                   'El lead (115). Igual al de su versión: la clave foránea compuesta lo exige.');
  end loop;
end $$;

-- Las decisiones de la Kickoff: de un lead.
alter table negocio.decisiones_de_kickoff add column if not exists contacto_id uuid not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'decisiones_de_kickoff_del_lead') then
    alter table negocio.decisiones_de_kickoff add constraint decisiones_de_kickoff_del_lead
      foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade;
  end if;
end $$;
create index if not exists decisiones_de_kickoff_por_lead on negocio.decisiones_de_kickoff (org_id, cuenta_id, contacto_id);
comment on column negocio.decisiones_de_kickoff.contacto_id is 'El lead de la Kickoff (115).';
comment on table negocio.decisiones_de_kickoff is
  'Lo que se decidió en la Kickoff de un lead (114, por lead desde la 115): el segmento, el precio, las reglas. El Estratega lo lee. autor es el coach.';

-- La evidencia pública se lee por lead (la columna existía; queda nula sólo en la de un Triage sin lead todavía).
create index if not exists fuentes_publicas_por_lead on negocio.fuentes_publicas (org_id, cuenta_id, contacto_id);

-- ─── 4 · El conocimiento de la cuenta no se publica desde un lead ────────────────

create or replace function negocio.el_conocimiento_no_sale_de_un_lead() returns trigger
language plpgsql security invoker set search_path = pg_catalog, pg_temp
as $$
begin
  if new.origen = 'entregable' then
    raise exception using errcode = '23514',
      message = 'el conocimiento de la cuenta (el ICP de ARIA, la matriz, el script…) lo carga una persona; el ICP de un lead es un dato de su expediente, no de la cuenta';
  end if;
  return new;
end $$;
drop trigger if exists conocimiento_no_sale_de_un_lead on negocio.conocimiento_de_la_cuenta;
create trigger conocimiento_no_sale_de_un_lead before insert or update on negocio.conocimiento_de_la_cuenta
  for each row execute function negocio.el_conocimiento_no_sale_de_un_lead();
revoke insert on negocio.conocimiento_de_la_cuenta from agente_mcp;
revoke insert, update on negocio.rutas_de_la_cuenta from agente_mcp;
revoke insert on identidad.organizaciones, identidad.cuentas from agente_mcp;
revoke update (crm_cuenta_id) on identidad.cuentas from agente_mcp;

-- ─── 5 · Las vistas de lo vigente, por lead ──────────────────────────────────────

-- La vigente de cada entregable de cada lead, y si está desactualizada: CALCULADO, no escrito. Un entregable está
-- desactualizado si consumió (fuentes) una versión de un tipo del que DEPENDE (catalogo.tipos_de_entregable.depende_de)
-- que ya no es la aprobada de ESE MISMO lead. Su propio tipo y lo que no le corresponde no cuentan.
drop view if exists negocio.expediente_del_lead;
drop view if exists negocio.entregable_vigente;
create view negocio.entregable_vigente with (security_invoker = true) as
  select e.org_id, e.cuenta_id, e.id as entregable_id, e.tipo, e.cliente_id, e.estado,
         v.id as version_id, v.numero, v.estado as estado_de_la_version, v.autor_tipo, v.contenido, v.contenido_texto,
         v.fuentes, v.creada_el, v.decidida_el, e.contacto_id, v.corrida_id,
         exists (select 1 from jsonb_each_text(v.fuentes) fu(tipo, version)
                   join catalogo.tipos_de_entregable t on t.clave = e.tipo and fu.tipo = any (t.depende_de)
                   join negocio.entregables d on d.org_id = e.org_id and d.cuenta_id = e.cuenta_id
                                             and d.contacto_id = e.contacto_id and d.tipo = fu.tipo and d.id <> e.id
                  where d.version_aprobada_id is not null and d.version_aprobada_id::text <> fu.version) as desactualizado
    from negocio.entregables e
    join negocio.versiones_de_entregable v on v.org_id = e.org_id and v.cuenta_id = e.cuenta_id
                                          and v.entregable_id = e.id and v.contacto_id = e.contacto_id
                                          and v.id = coalesce(e.version_aprobada_id, e.version_vigente_id);
comment on view negocio.entregable_vigente is
  'La versión que hoy vale de cada entregable de cada lead (113, por lead desde la 115): la aprobada, o la última propuesta. desactualizado se calcula al leer.';
revoke all on negocio.entregable_vigente from public, app_inquilino;
grant select on negocio.entregable_vigente to app_inquilino, agente_mcp;

create or replace view negocio.brief_vigente with (security_invoker = true) as
  select distinct on (r.org_id, r.cuenta_id, r.contacto_id, r.entregable_id, r.pregunta)
         r.org_id, r.cuenta_id, r.entregable_id, r.pregunta, r.version_del_brief, r.valor_texto, r.valor_json, r.estado,
         r.autor_tipo, r.fuente, r.cita, r.confianza, r.texto_para_el_cliente, r.registrada_el, r.id as respuesta_id, r.contacto_id
    from negocio.respuestas_del_brief r
   order by r.org_id, r.cuenta_id, r.contacto_id, r.entregable_id, r.pregunta, r.registrada_el desc, r.id;

-- ─── 4 · Abrir la corrida: los agentes del cliente, sobre el lead ─────────────────
-- La firma suma identificado_por: la vieja se quita, o la llamada sería ambigua.
drop function if exists agentes.abrir_corrida(text, text, text, text, jsonb, text, jsonb, text, text, text, text, text);
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
  v_cliente_id uuid;
  v_cli_org    uuid;
  v_cli_cta    uuid;
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
  -- Sólo el Triage marca sus salidas como no publicadas (triajes.aplicado). Los demás, hasta tener su marca, no
  -- corren en sombra: una ficha o un resultado «de prueba» se verían como reales.
  if coalesce(p_modo, 'activo') = 'sombra' and p_agente <> 'triage' then
    raise exception using errcode = '22023', message = 'agentes: por ahora sólo el Triage corre en modo sombra';
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

  -- Dónde trabaja: los del lead, en la cuenta del vendedor; los del comprador, en la cuenta del cliente que compró.
  v_trab_org := v_org;
  v_trab_cta := v_cuenta;
  if v_agente.cuenta_de_trabajo = 'comprador' then
    if v_contacto.id is null then
      raise exception using errcode = 'P0002', message = 'agentes: un agente del comprador necesita el contacto que compró';
    end if;
    execute $q$
      select id, organizacion_cliente_id, cuenta_cliente_id from negocio.clientes
       where org_id = $1 and cuenta_id = $2 and contacto_id = $3 and cuenta_cliente_id is not null
       order by creado_el desc limit 1 $q$
      into v_cliente_id, v_cli_org, v_cli_cta using v_org, v_cuenta, v_contacto.id;
    if v_cliente_id is null then
      raise exception using errcode = 'P0002',
        message = 'agentes: el contacto todavía no es cliente con su cuenta creada (agentes.confirmar_resultado y agentes.alta_del_comprador)';
    end if;
    v_trab_org := v_cli_org;
    v_trab_cta := v_cli_cta;
  end if;

  -- Los agentes del lead que compró o no (Brief, Research, Estratega, Funnel Builder) trabajan sobre el contacto, en la
  -- misma cuenta: su expediente. La venta, si la hubo, es sólo una referencia.
  if v_agente.cuenta_de_trabajo = 'contacto' then
    if v_contacto.id is null then
      raise exception using errcode = 'P0002',
        message = 'agentes: este agente trabaja sobre un lead que ya está en la base (identifícalo con agentes.buscar_contacto)';
    end if;
    select k.id into v_cliente_id from negocio.clientes k
     where k.org_id = v_org and k.cuenta_id = v_cuenta and k.contacto_id = v_contacto.id order by k.creado_el desc limit 1;
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
      'cita_id', v_existente.cita_id, 'llamada_id', v_existente.llamada_id, 'cliente_id', v_existente.cliente_id);
  end if;

  v_sujeto := case
    when v_agente.cuenta_de_trabajo = 'contacto'
      then 'contacto:' || v_contacto.id || coalesce(':' || coalesce(p_sujeto ->> 'paso', p_sujeto ->> 'etapa', p_sujeto ->> 'pieza'), '')
    when v_agente.cuenta_de_trabajo = 'comprador'
      then 'comprador:' || v_cliente_id || coalesce(':' || coalesce(p_sujeto ->> 'paso', p_sujeto ->> 'etapa', p_sujeto ->> 'pieza'), '')
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
    org_id, cuenta_id, id, agente, modo, sujeto_clave, contacto_id, ghl_contact_id, cita_id, llamada_id, cliente_id,
    vendedor_org_id, vendedor_cuenta_id, vendedor_contacto_id, disparador, clave_de_idempotencia, motivo,
    entrada, entrada_huella, sesion_externa_id, version_del_agente, version_de_la_skill, modelo, identificado_por)
  values (
    v_trab_org, v_trab_cta, v_id, p_agente, coalesce(p_modo, 'activo'), left(v_sujeto, 300),
    case when v_agente.cuenta_de_trabajo in ('vendedor', 'contacto') then v_contacto.id end,
    case when v_agente.cuenta_de_trabajo in ('vendedor', 'contacto') then p_ghl_contact_id end,
    case when v_agente.cuenta_de_trabajo in ('vendedor', 'contacto') then v_cita end,
    case when v_agente.cuenta_de_trabajo in ('vendedor', 'contacto') then v_llamada end,
    v_cliente_id,
    case when v_agente.cuenta_de_trabajo = 'comprador' then v_org end,
    case when v_agente.cuenta_de_trabajo = 'comprador' then v_cuenta end,
    case when v_agente.cuenta_de_trabajo = 'comprador' then v_contacto.id end,
    p_disparador, p_clave_de_idempotencia, v_motivo, p_entrada, md5(p_entrada::text),
    p_sesion_externa_id, p_version_del_agente, p_version_de_la_skill, p_modelo, coalesce(p_identificado_por, 'workflow'));

  return jsonb_build_object('ok', true, 'corrida_id', v_id, 'reutilizada', false, 'estado', 'abierta', 'motivo', v_motivo,
    'org_id', v_trab_org, 'cuenta_id', v_trab_cta, 'contacto_id', v_contacto.id, 'cita_id', v_cita, 'llamada_id', v_llamada,
    'cliente_id', v_cliente_id, 'reemplazo_a', to_jsonb(v_reemplazo),
    'no_contactar', v_contacto.no_contactar_desde is not null, 'faltantes', v_faltantes,
    'identificado_por', coalesce(p_identificado_por, 'workflow'),
    'siguiente', format('select agentes.leer_%s(%L)', p_agente, v_id));
end $$;

-- ─── 6 · Las piezas internas, por lead ───────────────────────────────────────────

-- Una salida que nombra a OTRO lead (por su contact_id de GHL, su id o su correo) es un error del agente: devuelve el
-- motivo, o nulo si la salida no nombra a nadie o nombra al lead de la corrida.
create or replace function agentes._otro_lead(p_corrida negocio.corridas_de_agente, p_salida jsonb) returns text
language plpgsql stable security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  k negocio.contactos;
  x text;
begin
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' then
    return null;
  end if;
  select * into k from negocio.contactos c
   where c.org_id = p_corrida.org_id and c.cuenta_id = p_corrida.cuenta_id and c.id = p_corrida.contacto_id;
  foreach x in array array['contact_id', 'ghl_contact_id'] loop
    if p_salida ? x and (p_salida ->> x) is distinct from coalesce(k.ghl_contact_id, p_corrida.ghl_contact_id) then
      return format('la salida nombra otro contacto (%s): un agente sólo guarda en el expediente del lead de su corrida', x);
    end if;
  end loop;
  if p_salida ? 'contacto_id' and (p_salida ->> 'contacto_id') is distinct from p_corrida.contacto_id::text then
    return 'la salida nombra otro contacto (contacto_id): un agente sólo guarda en el expediente del lead de su corrida';
  end if;
  foreach x in array array['correo', 'email'] loop
    if p_salida ? x and lower(btrim(p_salida ->> x)) is distinct from lower(btrim(k.email)) then
      return format('la salida nombra otro correo (%s): un agente sólo guarda en el expediente del lead de su corrida', x);
    end if;
  end loop;
  return null;
end $$;

-- El entregable de un tipo del lead de la corrida (lo crea si no existe).
create or replace function agentes._entregable(p_corrida negocio.corridas_de_agente, p_tipo text) returns negocio.entregables
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  e negocio.entregables;
begin
  if p_corrida.contacto_id is null then
    raise exception using errcode = 'P0002', message = 'agentes: la corrida no tiene lead: no hay expediente donde guardar';
  end if;
  insert into negocio.entregables (org_id, cuenta_id, contacto_id, tipo, cliente_id)
  values (p_corrida.org_id, p_corrida.cuenta_id, p_corrida.contacto_id, p_tipo, p_corrida.cliente_id)
  on conflict (org_id, cuenta_id, contacto_id, tipo) do nothing;
  select * into e from negocio.entregables
   where org_id = p_corrida.org_id and cuenta_id = p_corrida.cuenta_id and contacto_id = p_corrida.contacto_id and tipo = p_tipo;
  return e;
end $$;

-- Las versiones vigentes de los tipos pedidos DE UN LEAD, como fuentes citables «{tipo}@v{n}» y como {tipo: version_id}.
drop function if exists agentes._entregables_vigentes(uuid, uuid, text[]);
create or replace function agentes._entregables_vigentes(p_org uuid, p_cuenta uuid, p_contacto uuid, p_tipos text[]) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v_doc     jsonb := '{}'::jsonb;
  v_fuentes jsonb := '{}'::jsonb;
  v_ids     jsonb := '{}'::jsonb;
  v_falta   jsonb := '[]'::jsonb;
  r         record;
  t         text;
begin
  foreach t in array p_tipos loop
    select * into r from negocio.entregable_vigente ev
     where ev.org_id = p_org and ev.cuenta_id = p_cuenta and ev.contacto_id = p_contacto and ev.tipo = t;
    if r.version_id is null then
      v_falta := v_falta || to_jsonb('entregable:' || t);
      continue;
    end if;
    v_doc := v_doc || jsonb_build_object(t, jsonb_build_object('version', r.numero, 'version_id', r.version_id,
               'estado', r.estado_de_la_version, 'aprobado', r.estado_de_la_version = 'aprobada', 'desactualizado', r.desactualizado,
               'contenido', r.contenido, 'texto', r.contenido_texto, 'fuente', format('%s@v%s', t, r.numero)));
    v_fuentes := v_fuentes || jsonb_build_object(format('%s@v%s', t, r.numero), coalesce(r.contenido_texto, r.contenido::text));
    v_ids := v_ids || jsonb_build_object(t, r.version_id);
  end loop;
  return jsonb_build_object('entregables', v_doc, 'fuentes', v_fuentes, 'ids', v_ids, 'faltantes', v_falta);
end $$;

-- Exige que un entregable DEL LEAD esté aprobado (la etapa anterior). Devuelve el error o null.
drop function if exists agentes._exigir_aprobado(uuid, uuid, text);
create or replace function agentes._exigir_aprobado(p_org uuid, p_cuenta uuid, p_contacto uuid, p_tipo text) returns text
language sql stable security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
  select case when exists (select 1 from negocio.entregables e where e.org_id = p_org and e.cuenta_id = p_cuenta
                             and e.contacto_id = p_contacto and e.tipo = p_tipo and e.estado = 'aprobado')
              then null else format('falta aprobar «%s» antes', p_tipo) end
$$;

-- «Desactualizado» ya no se escribe (decisión del usuario, P-4): la vista entregable_vigente lo calcula al leer. La
-- función queda para quien la llama, y no toca nada.
create or replace function agentes._desactualizar(p_entregable negocio.entregables, p_version_id uuid) returns integer
language sql immutable security invoker set search_path = pg_catalog, pg_temp
as $$ select 0 $$;

create or replace function agentes._proponer_version(p_corrida negocio.corridas_de_agente, p_tipo text, p_contenido jsonb,
  p_texto text, p_fuentes jsonb) returns uuid
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  e      negocio.entregables := agentes._entregable(p_corrida, p_tipo);
  v_id   uuid := gen_random_uuid();
  v_num  integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('entregable:' || e.id, 0));
  select coalesce(max(numero), 0) + 1 into v_num from negocio.versiones_de_entregable
   where org_id = e.org_id and cuenta_id = e.cuenta_id and entregable_id = e.id;
  insert into negocio.versiones_de_entregable (org_id, cuenta_id, contacto_id, id, entregable_id, numero, autor_tipo, corrida_id, contenido,
                                               contenido_texto, fuentes)
  values (e.org_id, e.cuenta_id, e.contacto_id, v_id, e.id, v_num, 'agente_ia', p_corrida.id, coalesce(p_contenido, '{}'::jsonb), p_texto,
          coalesce(p_fuentes, '{}'::jsonb));
  update negocio.entregables
     set version_vigente_id = v_id, actualizado_el = now(),
         estado = case when estado = 'aprobado' then 'aprobado' else 'propuesto' end
   where org_id = e.org_id and cuenta_id = e.cuenta_id and id = e.id;
  perform agentes._evento(p_corrida, 'entregable_propuesto',
    jsonb_build_object('entregable_id', e.id, 'tipo', p_tipo, 'version', v_num, 'version_id', v_id), null, p_tipo || ':' || v_num);
  return v_id;
end $$;

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
     and p.contacto_id = p_corrida.contacto_id;
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

  -- La pregunta 9 (a quién vende) vive en el Brief del lead. Si el lead tiene una venta registrada, se copia ahí; nada
  -- más cambia: ni el estado de la venta ni el formulario del lead.
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
  if v_quien in ('negocios', 'consumidores') then
    update negocio.clientes set a_quien_vende = v_quien
     where org_id = p_entregable.org_id and cuenta_id = p_entregable.cuenta_id and contacto_id = p_entregable.contacto_id;
  end if;
  return jsonb_build_object('a_quien_vende', v_quien);
end $$;

create or replace function agentes._al_aprobar(p_entregable negocio.entregables, p_version negocio.versiones_de_entregable,
  p_usuario uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v_extra  jsonb := '{}'::jsonb;
begin
  if p_entregable.tipo = 'brief' then
    v_extra := agentes._al_enviar_el_brief(p_entregable, p_version);
  end if;
  -- Aprobar el ICP de un lead (o cualquier etapa) sólo cambia ese entregable de ese lead: no publica nada en la cuenta
  -- ni cambia el estado de la venta. Las piezas aprobadas son de la misma versión, del mismo lead.
  if p_entregable.tipo = 'anuncios' then
    update negocio.piezas_de_contenido set estado = 'aprobada'
     where org_id = p_version.org_id and cuenta_id = p_version.cuenta_id and version_id = p_version.id and estado = 'propuesta';
  end if;
  return v_extra;
end $$;

create or replace function agentes.decidir_entregable(
  p_version uuid, p_decision text, p_usuario uuid default null, p_motivo text default null,
  p_contenido jsonb default null, p_texto text default null, p_autor_tipo text default 'persona')
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  ver        negocio.versiones_de_entregable;
  e          negocio.entregables;
  v_sesion   text := nullif(btrim(current_setting('app.org_id', true)), '');
  v_aprobada negocio.versiones_de_entregable;
  v_nueva    uuid;
  v_num      integer;
  v_extra    jsonb := '{}'::jsonb;
  v_cascada  integer := 0;
  v_tipo_ev  text;
begin
  select * into ver from negocio.versiones_de_entregable where id = p_version;
  if not found then raise exception using errcode = 'P0002', message = 'agentes: la versión no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> ver.org_id then
    raise exception using errcode = '42501', message = 'agentes: la versión es de otra organización que la de la sesión';
  end if;
  -- El candado del entregable primero, y la versión leída OTRA VEZ: dos decisiones a la vez sobre lo mismo se esperan, y
  -- la segunda ve lo que dejó la primera (no corrige una versión que ya dejó de valer, ni la pisa).
  perform pg_advisory_xact_lock(hashtextextended('entregable:' || ver.entregable_id, 0));
  select * into ver from negocio.versiones_de_entregable where org_id = ver.org_id and cuenta_id = ver.cuenta_id and id = p_version;
  if p_decision not in ('aprobada', 'rechazada', 'corregida') then
    raise exception using errcode = '22023', message = 'agentes: la decisión es aprobada, rechazada o corregida';
  end if;
  if p_decision in ('aprobada', 'corregida') and exists (select 1 from negocio.entregables x where x.org_id = ver.org_id
       and x.cuenta_id = ver.cuenta_id and x.id = ver.entregable_id and x.tipo = 'brief') then
    raise exception using errcode = '22023',
      message = 'agentes: el Brief lo aprueba el cliente al enviarlo, y se corrige respondiéndolo (agentes.responder_brief)';
  end if;
  if ver.estado <> 'propuesta' and not (p_decision = 'corregida' and ver.estado = 'aprobada') then
    return jsonb_build_object('ok', false, 'errores', jsonb_build_array(format('la versión ya está «%s»', ver.estado)));
  end if;
  select * into e from negocio.entregables where org_id = ver.org_id and cuenta_id = ver.cuenta_id and id = ver.entregable_id;
  if p_decision = 'corregida' and ver.estado = 'aprobada' and ver.id is distinct from e.version_aprobada_id then
    return jsonb_build_object('ok', false, 'errores', jsonb_build_array('esa versión ya no es la vigente: corrige la que vale hoy'));
  end if;
  if p_usuario is null or not exists (select 1 from identidad.usuarios u where u.id = p_usuario and u.org_id = e.org_id) then
    raise exception using errcode = '22023',
      message = 'agentes: decidir una versión lo hace una persona de la organización (el coach), no el agente';
  end if;
  p_autor_tipo := 'persona';

  if p_decision = 'rechazada' then
    update negocio.versiones_de_entregable set estado = 'rechazada', decidida_por = p_usuario, decidida_el = now(), motivo = p_motivo
     where org_id = ver.org_id and cuenta_id = ver.cuenta_id and id = ver.id;
    update negocio.entregables set estado = case when version_aprobada_id is not null then estado else 'en_revision' end,
           actualizado_el = now()
     where org_id = e.org_id and cuenta_id = e.cuenta_id and id = e.id;
    if ver.corrida_id is not null then
      update negocio.corridas_de_agente set estado = 'rechazada' where org_id = ver.org_id and cuenta_id = ver.cuenta_id and id = ver.corrida_id;
    end if;
    v_tipo_ev := 'entregable_rechazado';
    v_aprobada := ver;
  elsif p_decision = 'aprobada' then
    update negocio.versiones_de_entregable set estado = 'aprobada', decidida_por = p_usuario, decidida_el = now(), motivo = p_motivo
     where org_id = ver.org_id and cuenta_id = ver.cuenta_id and id = ver.id
     returning * into v_aprobada;
    v_tipo_ev := 'entregable_aprobado';
  else
    if p_contenido is null and p_texto is null then
      raise exception using errcode = '22023', message = 'agentes: una corrección necesita el contenido o el texto nuevo';
    end if;
    select coalesce(max(numero), 0) + 1 into v_num from negocio.versiones_de_entregable
     where org_id = e.org_id and cuenta_id = e.cuenta_id and entregable_id = e.id;
    v_nueva := gen_random_uuid();
    insert into negocio.versiones_de_entregable (org_id, cuenta_id, contacto_id, id, entregable_id, numero, autor_tipo, autor_usuario_id,
      contenido, contenido_texto, fuentes, estado, decidida_por, decidida_el, motivo)
    values (e.org_id, e.cuenta_id, e.contacto_id, v_nueva, e.id, v_num, p_autor_tipo, p_usuario, coalesce(p_contenido, ver.contenido),
      coalesce(p_texto, ver.contenido_texto), ver.fuentes || jsonb_build_object('corrige_a', ver.id), 'aprobada', p_usuario, now(), p_motivo)
    returning * into v_aprobada;
    update negocio.versiones_de_entregable set estado = 'corregida', decidida_por = p_usuario, decidida_el = now(),
           motivo = coalesce(p_motivo, 'corregida en la versión ' || v_num)
     where org_id = ver.org_id and cuenta_id = ver.cuenta_id and id = ver.id;
    -- Lo que la versión vieja tenía como filas (segmentos, dolores, citas, piezas) pasa a la corregida.
    perform agentes._al_corregir(e, ver.id, v_aprobada.id);
    v_tipo_ev := 'entregable_corregido';
  end if;

  if p_decision in ('aprobada', 'corregida') then
    update negocio.entregables set estado = 'aprobado', version_aprobada_id = v_aprobada.id, version_vigente_id = v_aprobada.id,
           actualizado_el = now()
     where org_id = e.org_id and cuenta_id = e.cuenta_id and id = e.id
     returning * into e;
    if ver.corrida_id is not null then
      update negocio.corridas_de_agente set estado = 'aprobada' where org_id = ver.org_id and cuenta_id = ver.cuenta_id and id = ver.corrida_id;
    end if;
    v_cascada := agentes._desactualizar(e, v_aprobada.id);
    v_extra := agentes._al_aprobar(e, v_aprobada, p_usuario);
  end if;

  perform agentes._registrar_evento(e.org_id,
    e.cuenta_id,
    v_tipo_ev,
    e.contacto_id,
    'persona',
    coalesce(p_usuario::text, p_autor_tipo),
    'comando_central',
    v_tipo_ev || ':' || v_aprobada.id,
    jsonb_build_object('entregable_id', e.id, 'tipo', e.tipo, 'version', v_aprobada.numero, 'version_id', v_aprobada.id,
                             'motivo', left(p_motivo, 300)),
    now());
  return jsonb_build_object('ok', true, 'entregable_id', e.id, 'tipo', e.tipo, 'estado', e.estado, 'version_id', v_aprobada.id,
    'version', v_aprobada.numero, 'desactualizados', v_cascada) || coalesce(v_extra, '{}'::jsonb);
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
                                         and (p.vigente_hasta is null or p.vigente_hasta > now())), '{}'::jsonb);

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

create or replace function agentes.registrar_brief(p_corrida uuid, p_salida jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v         negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  e         negocio.entregables := agentes._entregable(v, 'brief');
  v_err     jsonb := '[]'::jsonb;
  v_version text;
  v_resp    jsonb := coalesce(p_salida -> 'respuestas', '[]'::jsonb);
  v_datos   jsonb;
  r         jsonb;
  v_val     jsonb;
  v_prel    integer := 0;
  v_vacios  integer := 0;
  v_omit    integer := 0;
  v_ver_id  uuid;
  v_quien   text := nullif(p_salida ->> 'a_quien_vende', '');
  v_estado  text;
  i         integer := 0;
begin
  -- Una salida no puede traer OTRO lead: si nombra un contacto o un correo, tiene que ser el de la corrida.
  if agentes._otro_lead(v, p_salida) is not null then
    return agentes._rechazar(v, jsonb_build_array(agentes._otro_lead(v, p_salida)));
  end if;
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' or jsonb_typeof(v_resp) <> 'array' or jsonb_array_length(v_resp) = 0 then
    return agentes._rechazar(v, jsonb_build_array('la salida es {respuestas: [...], a_quien_vende}'));
  end if;
  select coalesce(max(version_del_brief), 'libre') into v_version from catalogo.preguntas_del_brief where vigente;
  if v_quien is not null and v_quien not in ('negocios', 'consumidores') then
    v_err := v_err || to_jsonb('a_quien_vende: negocios o consumidores'::text);
  end if;

  -- Cada respuesta prellenada es un dato con procedencia: detectado o inferido (vacio no lleva fuente).
  select jsonb_agg(jsonb_build_object('campo', x ->> 'pregunta',
           'estado', case x ->> 'estado' when 'vacio' then 'no_consta' else x ->> 'estado' end,
           'valor', x -> 'valor', 'fuente', x ->> 'fuente', 'cita', x ->> 'cita', 'confianza', x ->> 'confianza'))
    into v_datos from jsonb_array_elements(v_resp) x;
  for r in select value from jsonb_array_elements(v_resp) loop
    if coalesce(btrim(r ->> 'pregunta'), '') = '' or length(r ->> 'pregunta') > 100 then
      v_err := v_err || to_jsonb('respuestas: cada una con su «pregunta» (la clave, hasta 100 caracteres)'::text);
    end if;
    if coalesce(r ->> 'estado', '') not in ('detectado', 'inferido', 'vacio') then
      v_err := v_err || to_jsonb(format('respuestas: «%s» tiene estado detectado, inferido o vacio', r ->> 'pregunta'));
    end if;
    if v_version <> 'libre' and not exists (select 1 from catalogo.preguntas_del_brief q where q.version_del_brief = v_version and q.clave = r ->> 'pregunta') then
      v_err := v_err || to_jsonb(format('respuestas: «%s» no es una pregunta del Brief %s', r ->> 'pregunta', v_version));
    end if;
  end loop;
  v_datos := agentes._validar_datos(v, coalesce(v_datos, '[]'::jsonb), 'respuestas');
  v_err := v_err || (v_datos -> 'errores');
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  for v_val in select value from jsonb_array_elements(v_datos -> 'datos') loop
    i := i + 1;
    -- Lo que el cliente ya confirmó, corrigió o completó no se vuelve a prellenar.
    if exists (select 1 from negocio.brief_vigente b where b.org_id = e.org_id and b.cuenta_id = e.cuenta_id and b.contacto_id = e.contacto_id
                and b.entregable_id = e.id and b.pregunta = v_val ->> 'campo' and b.autor_tipo <> 'agente_ia') then
      v_omit := v_omit + 1;
      continue;
    end if;
    v_estado := case v_val ->> 'estado' when 'detectado' then 'prellenado_detectado' when 'no_consta' then 'vacio'
                                        else 'prellenado_inferido' end;
    if v_estado = 'vacio' then v_vacios := v_vacios + 1; else v_prel := v_prel + 1; end if;
    insert into negocio.respuestas_del_brief (org_id, cuenta_id, contacto_id, entregable_id, version_del_brief, pregunta, valor_texto, valor_json,
      estado, autor_tipo, fuente, cita, confianza, texto_para_el_cliente, degradado, corrida_id)
    values (e.org_id, e.cuenta_id, e.contacto_id, e.id, v_version, v_val ->> 'campo',
      case when v_estado = 'vacio' then null when jsonb_typeof(v_val -> 'valor') = 'string' then left(v_val ->> 'valor', 20000) end,
      case when v_estado <> 'vacio' and jsonb_typeof(v_val -> 'valor') not in ('string', 'null') then v_val -> 'valor' end,
      v_estado, 'agente_ia', v_val ->> 'fuente', left(v_val ->> 'cita', 2000), v_val ->> 'confianza',
      left((select x ->> 'texto_para_el_cliente' from jsonb_array_elements(v_resp) x where x ->> 'pregunta' = v_val ->> 'campo' limit 1), 500),
      coalesce((v_val ->> 'degradado')::boolean, false), v.id);
  end loop;

  v_ver_id := agentes._proponer_version(v, 'brief',
    jsonb_build_object('version_del_brief', v_version, 'a_quien_vende_propuesto', v_quien, 'respuestas', v_datos -> 'datos'),
    null, '{}'::jsonb);
  perform agentes._cerrar(v, p_salida, (v_datos ->> 'degradados')::integer, 'esperando_aprobacion');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'entregable_id', e.id, 'version_id', v_ver_id,
    'prellenadas', v_prel, 'vacias', v_vacios, 'omitidas_porque_ya_respondio_el_cliente', v_omit,
    'degradados', (v_datos ->> 'degradados')::integer,
    'siguiente', 'el lead (o una persona por él) confirma y envía con agentes.responder_brief(contacto_id, respuestas, true, usuario); el Research puede correr con el prellenado');
end $$;

-- ─── 7 · El lead responde y envía su Brief ───────────────────────────────────────
-- Se identifica por el LEAD (su contacto_id; agentes.buscar_contacto lo da desde el correo), no por una cuenta de
-- comprador. p_respuestas: [{pregunta, valor}]; el estado lo pone la base: confirmado si coincide con el prellenado,
-- corregido si lo cambió, completado si no había nada, vacio si viene en blanco. Con p_enviar, el Brief queda aprobado
-- (lo envía el lead, o una persona de la organización por él), y su pregunta 9 pasa a la venta si la hay.
drop function if exists agentes.responder_brief(uuid, jsonb, boolean, uuid);
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
  insert into negocio.entregables (org_id, cuenta_id, contacto_id, tipo, cliente_id)
  values (k.org_id, k.cuenta_id, k.id, 'brief',
          (select c.id from negocio.clientes c where c.org_id = k.org_id and c.cuenta_id = k.cuenta_id and c.contacto_id = k.id
            order by c.creado_el desc limit 1))
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

create or replace function agentes.leer_research(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v      negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_paso text := agentes._tipo_de_la_corrida(v);
  d      jsonb;
  v_err  text;
begin
  if v_paso is null or v_paso not in ('mr_segmentos', 'mr_dolores', 'mr_referentes', 'mr_precio', 'mr_decision', 'prediagnostico') then
    return agentes._rechazar(v, jsonb_build_array('el Research se abre por paso: p_sujeto = {"paso": "mr_segmentos" | "mr_dolores" | "mr_referentes" | "mr_precio" | "mr_decision" | "prediagnostico"}'));
  end if;
  -- El Research corre con el Brief vigente del lead: el enviado o, si nadie lo envió, el prellenado por el agente.
  v_err := case when exists (select 1 from negocio.entregable_vigente ev where ev.org_id = v.org_id and ev.cuenta_id = v.cuenta_id
                              and ev.contacto_id = v.contacto_id and ev.tipo = 'brief')
                then null else 'el lead todavía no tiene Brief (ni prellenado): corre antes el Brief Agent' end;
  d := agentes._leer_del_cliente(v, array['brief', 'mr_segmentos', 'mr_dolores', 'mr_referentes', 'mr_precio', 'mr_decision'], true);
  perform agentes._anotar_lectura(v, d -> 'fuentes');
  return jsonb_build_object('corrida_id', v.id, 'agente', 'research', 'paso', v_paso, 'aviso', v_err,
    'brief_confirmado_por_el_lead', coalesce((d #>> '{entregables,brief,aprobado}')::boolean, false),
    'entregables', d -> 'entregables', 'filas', d -> 'filas', 'fuentes', d -> 'fuentes', 'faltantes', d -> 'faltantes',
    'contrato', 'agentes.registrar_research(corrida_id, {texto (el documento en md), contenido{}, segmentos[] | dolores[] | referentes[] | precio[] | segmento_elegido, citas[{texto, fuente: publica:{id}, dolor, segmento}]}). Cada evidencia nueva va antes por agentes.registrar_fuente_publica.');
end $$;

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
              case when exists (select 1 from negocio.fuentes_publicas f where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id and f.contacto_id = v.contacto_id and f.id = v_fp) then v_fp end);
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

create or replace function agentes.leer_estratega(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v       negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_etapa text := agentes._tipo_de_la_corrida(v);
  d       jsonb;
  v_avisos jsonb := '[]'::jsonb;
begin
  if v_etapa is null or v_etapa not in ('icp', 'categoria_y_oferta', 'precio_y_process_map') then
    return agentes._rechazar(v, jsonb_build_array('el Estratega se abre por etapa: p_sujeto = {"etapa": "icp" | "categoria_y_oferta" | "precio_y_process_map"}'));
  end if;
  v_avisos := v_avisos || coalesce(to_jsonb(agentes._exigir_aprobado(v.org_id, v.cuenta_id, v.contacto_id, 'mr_decision')), '[]'::jsonb);
  if v_etapa <> 'icp' then
    v_avisos := v_avisos || coalesce(to_jsonb(agentes._exigir_aprobado(v.org_id, v.cuenta_id, v.contacto_id, 'icp')), '[]'::jsonb);
  end if;
  if v_etapa = 'precio_y_process_map' then
    v_avisos := v_avisos || coalesce(to_jsonb(agentes._exigir_aprobado(v.org_id, v.cuenta_id, v.contacto_id, 'categoria_y_oferta')), '[]'::jsonb);
  end if;
  d := agentes._leer_del_cliente(v, array['brief', 'mr_segmentos', 'mr_dolores', 'mr_referentes', 'mr_precio', 'mr_decision',
                                          'prediagnostico', 'icp', 'categoria_y_oferta', 'precio_y_process_map'], true);
  perform agentes._anotar_lectura(v, d -> 'fuentes');
  return jsonb_build_object('corrida_id', v.id, 'agente', 'estratega', 'etapa', v_etapa, 'avisos', v_avisos,
    'entregables', d -> 'entregables', 'filas', d -> 'filas', 'fuentes', d -> 'fuentes', 'faltantes', d -> 'faltantes',
    'preguntas_estandar', (select jsonb_agg(jsonb_build_object('clave', clave, 'eje', eje, 'tipo_de_valor', tipo_de_valor)) from catalogo.preguntas_estandar where vigente),
    'contrato', 'agentes.registrar_estratega(corrida_id, {texto (md), contenido{}}). El ICP trae a_quien_si[] y a_quien_no[] con {criterio, tipo: requisito|preferencia|knockout, pregunta_estandar, operador, valor, eje}.');
end $$;

create or replace function agentes.leer_funnel_builder(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v       negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_pieza text := agentes._tipo_de_la_corrida(v);
  d       jsonb;
begin
  if v_pieza is null or v_pieza not in ('guion_vsl', 'anuncios', 'prompt_landing') then
    return agentes._rechazar(v, jsonb_build_array('el Funnel Builder se abre por pieza: p_sujeto = {"pieza": "guion_vsl" | "anuncios" | "prompt_landing"}'));
  end if;
  d := agentes._leer_del_cliente(v, array['brief', 'mr_decision', 'icp', 'categoria_y_oferta', 'precio_y_process_map',
                                          'mr_segmentos', 'mr_dolores', 'guion_vsl', 'anuncios', 'prompt_landing'], true);
  perform agentes._anotar_lectura(v, d -> 'fuentes');
  return jsonb_build_object('corrida_id', v.id, 'agente', 'funnel_builder', 'pieza', v_pieza,
    'aviso', agentes._exigir_aprobado(v.org_id, v.cuenta_id, v.contacto_id, 'precio_y_process_map'),
    'entregables', d -> 'entregables', 'filas', d -> 'filas', 'fuentes', d -> 'fuentes', 'faltantes', d -> 'faltantes',
    'nomenclatura', (select jsonb_agg(jsonb_build_object('clave', clave, 'separador', separador, 'partes', partes)) from catalogo.reglas_de_nomenclatura where vigente_hasta is null),
    'dolores_del_creativo', (select jsonb_agg(clave) from catalogo.dolores_del_creativo where vigente),
    'niveles_de_consciencia', (select jsonb_agg(clave order by orden) from catalogo.niveles_de_consciencia),
    'formatos', (select jsonb_agg(clave) from catalogo.formatos where vigente),
    'contrato', 'agentes.registrar_funnel_builder(corrida_id, {texto (md), contenido{}, variantes[{codigo_de_nomenclatura, angulo, dolor, dolor_del_creativo, nivel_de_consciencia, formato, titular, texto_principal, guion, llamado_a_la_accion, citas_usadas[cita_id]}]}). Para el prompt de la landing: contenido.prompt, contenido.custom_code, contenido.formulario.');
end $$;

create or replace function agentes.registrar_estratega(p_corrida uuid, p_salida jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v       negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_etapa text := agentes._tipo_de_la_corrida(v);
  v_err   jsonb := '[]'::jsonb;
  c       jsonb := coalesce(p_salida -> 'contenido', '{}'::jsonb);
  v_texto text := nullif(btrim(p_salida ->> 'texto'), '');
  x       jsonb;
  d       jsonb;
  v_ver   uuid;
  v_e     text;
begin
  -- Una salida no puede traer OTRO lead: si nombra un contacto o un correo, tiene que ser el de la corrida.
  if agentes._otro_lead(v, p_salida) is not null then
    return agentes._rechazar(v, jsonb_build_array(agentes._otro_lead(v, p_salida)));
  end if;
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' or jsonb_typeof(c) <> 'object' then
    return agentes._rechazar(v, jsonb_build_array('la salida es {texto, contenido{}}'));
  end if;
  if v_etapa is null or not exists (select 1 from catalogo.tipos_de_entregable t where t.clave = v_etapa and t.agente = v.agente) then
    return agentes._rechazar(v, jsonb_build_array('la corrida no dice una etapa del Estratega (ábrela con p_sujeto.etapa = icp, categoria_y_oferta o precio_y_process_map)'));
  end if;
  if v_texto is null then v_err := v_err || to_jsonb('texto: el documento de la etapa, en markdown'::text); end if;
  v_e := agentes._exigir_aprobado(v.org_id, v.cuenta_id, v.contacto_id, 'mr_decision');
  if v_e is not null then v_err := v_err || to_jsonb(v_e); end if;
  if v_etapa in ('categoria_y_oferta', 'precio_y_process_map') then
    v_e := agentes._exigir_aprobado(v.org_id, v.cuenta_id, v.contacto_id, 'icp');
    if v_e is not null then v_err := v_err || to_jsonb(v_e); end if;
  end if;
  if v_etapa = 'precio_y_process_map' then
    v_e := agentes._exigir_aprobado(v.org_id, v.cuenta_id, v.contacto_id, 'categoria_y_oferta');
    if v_e is not null then v_err := v_err || to_jsonb(v_e); end if;
  end if;

  if v_etapa = 'icp' then
    if coalesce(jsonb_typeof(c -> 'a_quien_si'), 'ausente') <> 'array' or jsonb_array_length(c -> 'a_quien_si') = 0 then
      v_err := v_err || to_jsonb('contenido.a_quien_si: la lista de criterios del cliente ideal'::text);
    end if;
    if jsonb_typeof(coalesce(c -> 'a_quien_no', '[]'::jsonb)) <> 'array' then
      v_err := v_err || to_jsonb('contenido.a_quien_no: una lista'::text);
    end if;
    for x in select value from jsonb_array_elements(coalesce(c -> 'a_quien_si', '[]'::jsonb) || coalesce(c -> 'a_quien_no', '[]'::jsonb)) loop
      if coalesce(btrim(x ->> 'criterio'), '') = '' then
        v_err := v_err || to_jsonb('icp: cada criterio necesita «criterio» (el texto)'::text);
      end if;
      if coalesce(x ->> 'tipo', 'requisito') not in ('requisito', 'preferencia', 'knockout') then
        v_err := v_err || to_jsonb('icp: tipo = requisito, preferencia o knockout'::text);
      end if;
      if x ->> 'pregunta_estandar' is not null and not exists (select 1 from catalogo.preguntas_estandar where clave = x ->> 'pregunta_estandar') then
        v_err := v_err || to_jsonb(format('icp: «%s» no es una pregunta estándar (o pon null y queda cualitativo)', x ->> 'pregunta_estandar'));
      end if;
      if x ->> 'operador' is not null and x ->> 'operador' not in ('=', '<>', '>', '>=', '<', '<=', 'in', 'not_in', 'contiene') then
        v_err := v_err || to_jsonb('icp: operador = =, <>, >, >=, <, <=, in, not_in o contiene'::text);
      end if;
      if x ->> 'eje' is not null and x ->> 'eje' not in ('encaje', 'capacidad') then
        v_err := v_err || to_jsonb('icp: eje = encaje o capacidad'::text);
      end if;
    end loop;
  elsif v_etapa = 'categoria_y_oferta' then
    if coalesce(c #>> '{categoria,nombre}', '') = '' or coalesce(c #>> '{mecanismo,nombre}', '') = '' or coalesce(c #>> '{oferta,promesa}', '') = '' then
      v_err := v_err || to_jsonb('contenido: categoria.nombre, mecanismo.nombre y oferta.promesa (y oferta.a_quien, por_que_compran, entregables, plazo)'::text);
    end if;
  elsif v_etapa = 'precio_y_process_map' then
    if agentes._numero(c #>> '{precio,monto}') is null or coalesce(c #>> '{precio,moneda}', '') = '' then
      v_err := v_err || to_jsonb('contenido.precio: monto y moneda (y forma_de_pago, cuotas)'::text);
    end if;
    if coalesce(jsonb_typeof(c #> '{metodo,fases}'), 'ausente') <> 'array' or jsonb_array_length(c #> '{metodo,fases}') = 0 then
      v_err := v_err || to_jsonb('contenido.metodo.fases: las fases ordenadas {nombre, objetivo, duracion, entregables}'::text);
    end if;
  else
    v_err := v_err || to_jsonb('etapa desconocida'::text);
  end if;
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  d := agentes._entregables_vigentes(v.org_id, v.cuenta_id, v.contacto_id, array['brief', 'mr_decision', 'icp', 'categoria_y_oferta']);
  v_ver := agentes._proponer_version(v, v_etapa, c, v_texto, d -> 'ids');
  perform agentes._cerrar(v, p_salida, 0, 'esperando_aprobacion');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'etapa', v_etapa, 'version_id', v_ver,
    'siguiente', 'el coach aprueba con agentes.decidir_entregable; ' || case v_etapa when 'icp' then 'el ICP queda como dato del expediente de este lead (icp_del_lead) y no cambia el conocimiento de la cuenta' else 'queda en el expediente de este lead' end);
end $$;

create or replace function agentes.registrar_funnel_builder(p_corrida uuid, p_salida jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v       negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_pieza text := agentes._tipo_de_la_corrida(v);
  v_err   jsonb := '[]'::jsonb;
  c       jsonb := coalesce(p_salida -> 'contenido', '{}'::jsonb);
  v_var   jsonb := coalesce(p_salida -> 'variantes', '[]'::jsonb);
  v_texto text := nullif(btrim(p_salida ->> 'texto'), '');
  x       jsonb;
  d       jsonb;
  v_ver   uuid;
  v_dol   uuid;
  v_citas uuid[];
  n       integer := 0;
  v_e     text := agentes._exigir_aprobado(v.org_id, v.cuenta_id, v.contacto_id, 'precio_y_process_map');
begin
  -- Una salida no puede traer OTRO lead: si nombra un contacto o un correo, tiene que ser el de la corrida.
  if agentes._otro_lead(v, p_salida) is not null then
    return agentes._rechazar(v, jsonb_build_array(agentes._otro_lead(v, p_salida)));
  end if;
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' then
    return agentes._rechazar(v, jsonb_build_array('la salida es {texto, contenido{}, variantes[]}'));
  end if;
  if v_pieza is null then
    return agentes._rechazar(v, jsonb_build_array('la corrida no dice qué pieza es (ábrela con p_sujeto.pieza)'));
  end if;
  if not exists (select 1 from catalogo.tipos_de_entregable t where t.clave = v_pieza and t.agente = v.agente) then
    return agentes._rechazar(v, jsonb_build_array(format('«%s» no es una pieza del Funnel Builder', v_pieza)));
  end if;
  if v_e is not null then v_err := v_err || to_jsonb(v_e); end if;
  if v_texto is null then v_err := v_err || to_jsonb('texto: la pieza en markdown'::text); end if;
  if v_pieza = 'anuncios' and (jsonb_typeof(v_var) <> 'array' or jsonb_array_length(v_var) = 0) then
    v_err := v_err || to_jsonb('variantes: al menos una variante de anuncio'::text);
  end if;
  if v_pieza = 'prompt_landing' and coalesce(c ->> 'prompt', '') = '' then
    v_err := v_err || to_jsonb('contenido.prompt: el prompt completo de la landing (y custom_code, formulario)'::text);
  end if;
  for x in select value from jsonb_array_elements(case when jsonb_typeof(v_var) = 'array' then v_var else '[]'::jsonb end) loop
    if x ->> 'dolor_del_creativo' is not null and not exists (select 1 from catalogo.dolores_del_creativo where clave = x ->> 'dolor_del_creativo') then
      v_err := v_err || to_jsonb(format('variantes: «%s» no está en catalogo.dolores_del_creativo', x ->> 'dolor_del_creativo'));
    end if;
    if x ->> 'nivel_de_consciencia' is not null and not exists (select 1 from catalogo.niveles_de_consciencia where clave = x ->> 'nivel_de_consciencia') then
      v_err := v_err || to_jsonb(format('variantes: «%s» no es un nivel de consciencia', x ->> 'nivel_de_consciencia'));
    end if;
    if x ->> 'formato' is not null and not exists (select 1 from catalogo.formatos where clave = x ->> 'formato') then
      v_err := v_err || to_jsonb(format('variantes: «%s» no es un formato', x ->> 'formato'));
    end if;
  end loop;
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  d := agentes._entregables_vigentes(v.org_id, v.cuenta_id, v.contacto_id, array['icp', 'categoria_y_oferta', 'precio_y_process_map', 'mr_dolores']);
  v_ver := agentes._proponer_version(v, v_pieza, c || jsonb_build_object('variantes', v_var), v_texto, d -> 'ids');

  for x in select value from jsonb_array_elements(case when jsonb_typeof(v_var) = 'array' then v_var else '[]'::jsonb end) loop
    select dd.id into v_dol from negocio.dolores_del_segmento dd
     where dd.org_id = v.org_id and dd.cuenta_id = v.cuenta_id and dd.contacto_id = v.contacto_id and dd.version_id = (d #>> '{ids,mr_dolores}')::uuid
       and (dd.id::text = x ->> 'dolor' or lower(dd.descripcion) = lower(x ->> 'dolor')) limit 1;
    select array_agg(cm.id) into v_citas from negocio.citas_del_mercado cm
     where cm.org_id = v.org_id and cm.cuenta_id = v.cuenta_id and cm.contacto_id = v.contacto_id
       and cm.id::text in (select jsonb_array_elements_text(coalesce(x -> 'citas_usadas', '[]'::jsonb)));
    insert into negocio.piezas_de_contenido (org_id, cuenta_id, contacto_id, version_id, tipo, codigo_de_nomenclatura, angulo, dolor_id,
      dolor_del_creativo, nivel_de_consciencia, formato, titular, texto_principal, guion, llamado_a_la_accion, citas_usadas)
    values (v.org_id, v.cuenta_id, v.contacto_id, v_ver, case v_pieza when 'guion_vsl' then 'vsl' when 'prompt_landing' then 'landing' else 'anuncio' end,
      left(x ->> 'codigo_de_nomenclatura', 300), left(x ->> 'angulo', 500), v_dol, x ->> 'dolor_del_creativo', x ->> 'nivel_de_consciencia',
      x ->> 'formato', left(x ->> 'titular', 500), left(x ->> 'texto_principal', 8000), left(x ->> 'guion', 40000),
      left(x ->> 'llamado_a_la_accion', 300), coalesce(v_citas, '{}'));
    n := n + 1;
  end loop;

  perform agentes._cerrar(v, p_salida, 0, 'esperando_aprobacion');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'pieza', v_pieza, 'version_id', v_ver, 'variantes', n);
end $$;

-- ─── 8 · Las decisiones de la Kickoff, del lead ──────────────────────────────────
drop function if exists agentes.registrar_decisiones_de_kickoff(uuid, jsonb, text, text);
create or replace function agentes.registrar_decisiones_de_kickoff(p_contacto uuid, p_decisiones jsonb,
  p_autor text default null, p_cita_ghl_id text default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, pg_temp
as $$
declare
  k        negocio.contactos;
  v_sesion text := nullif(btrim(current_setting('app.org_id', true)), '');
  x        jsonb;
  n        integer := 0;
begin
  select * into k from negocio.contactos where id = p_contacto;
  if not found then raise exception using errcode = 'P0002', message = 'agentes: el lead no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> k.org_id then
    raise exception using errcode = '42501', message = 'agentes: el lead es de otra organización que la de la sesión';
  end if;
  for x in select value from jsonb_array_elements(coalesce(p_decisiones, '[]'::jsonb)) loop
    if coalesce(x ->> 'sobre', 'otro') not in ('research', 'segmento', 'oferta', 'precio', 'reglas_de_agentes', 'otro')
       or coalesce(btrim(x ->> 'decision'), '') = '' then
      raise exception using errcode = '22023',
        message = 'agentes: cada decisión lleva su texto y «sobre» = research, segmento, oferta, precio, reglas_de_agentes u otro';
    end if;
    insert into negocio.decisiones_de_kickoff (org_id, cuenta_id, contacto_id, sobre, decision, autor, cita_ghl_id)
    values (k.org_id, k.cuenta_id, k.id, coalesce(x ->> 'sobre', 'otro'), left(x ->> 'decision', 4000), left(p_autor, 200), p_cita_ghl_id);
    n := n + 1;
  end loop;
  perform agentes._registrar_evento(k.org_id, k.cuenta_id, 'kickoff_realizada', k.id, 'persona', coalesce(p_autor, 'coach'),
    'comando_central', 'kickoff:' || k.id || ':' || coalesce(p_cita_ghl_id, to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS')),
    jsonb_build_object('decisiones', n), now());
  return jsonb_build_object('ok', true, 'decisiones', n);
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
     and (p.vigente_hasta is null or p.vigente_hasta > now());
  v_fuentes := v_fuentes || coalesce((select coalesce(jsonb_object_agg('publica:' || p.id, p.extracto), '{}'::jsonb)
                                        from negocio.fuentes_publicas p
                                       where p.org_id = v.org_id and p.cuenta_id = v.cuenta_id and p.contacto_id = v.contacto_id
                                         and (p.vigente_hasta is null or p.vigente_hasta > now())), '{}'::jsonb);
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

create or replace function agentes.leer_sales_coach(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v         negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_k       jsonb := agentes._conocimiento(v, array['script_de_ventas', 'manual_de_objeciones', 'rutas', 'icp']);
  v_fuentes jsonb := '{}'::jsonb;
  v_falta   jsonb := v_k -> 'faltantes';
  v_llamada record;
  v_trans   record;
  v_ficha   negocio.fichas_del_lead;
  v_triaje  jsonb;
  v_rutas   jsonb;
  v_closer  jsonb;
begin
  if v.llamada_id is null then
    return agentes._rechazar(v, jsonb_build_array('el Sales Coach se abre con la llamada: p_sujeto = {"llamada_id": "…"} (agentes.registrar_llamada la devuelve)'));
  end if;
  select l.* into v_llamada from negocio.llamadas l where l.org_id = v.org_id and l.cuenta_id = v.cuenta_id and l.contacto_id = v.contacto_id and l.id = v.llamada_id;
  select t.* into v_trans from negocio.transcripciones t
   where t.org_id = v.org_id and t.cuenta_id = v.cuenta_id and t.contacto_id = v.contacto_id and t.llamada_id = v.llamada_id
   order by t.creada_el desc limit 1;
  if v_trans.id is not null then
    v_fuentes := v_fuentes || jsonb_build_object('llamada_venta:' || v.llamada_id, v_trans.texto);
  else
    v_falta := v_falta || to_jsonb('transcripcion'::text);
  end if;
  select f.* into v_ficha from negocio.ficha_vigente f
   where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id and f.contacto_id = v.contacto_id;
  if v_ficha.id is not null then
    v_fuentes := v_fuentes || jsonb_build_object(format('ficha:%s@v%s', v_ficha.id, v_ficha.version),
      jsonb_build_object('resumen', v_ficha.resumen, 'quien_es', v_ficha.quien_es, 'que_dijo', v_ficha.que_dijo,
                         'estrategia', v_ficha.estrategia, 'alertas', v_ficha.alertas));
  else
    v_falta := v_falta || to_jsonb('ficha_del_lead'::text);
  end if;
  select to_jsonb(t) - 'org_id' - 'cuenta_id' into v_triaje from negocio.triaje_vigente t
   where t.org_id = v.org_id and t.cuenta_id = v.cuenta_id and t.contacto_id = v.contacto_id;
  if v_triaje is not null then
    v_fuentes := v_fuentes || jsonb_build_object('triage:' || (v_triaje ->> 'corrida_id'), v_triaje);
  end if;
  v_fuentes := v_fuentes || agentes._respuestas(v.org_id, v.cuenta_id, v.contacto_id);
  select coalesce(jsonb_agg(jsonb_build_object('clave', r.clave, 'nombre', r.nombre, 'clase', r.clase, 'precio_desde', r.precio_desde,
           'precio_hasta', r.precio_hasta, 'moneda', r.moneda)), '[]'::jsonb)
    into v_rutas from negocio.rutas_de_la_cuenta r where r.org_id = v.org_id and r.cuenta_id = v.cuenta_id and r.activa;
  if v_llamada.persona_id is not null then
    select jsonb_build_object('closer_id', u.id, 'nombre', u.nombre) into v_closer from identidad.usuarios u
     where u.org_id = v.org_id and u.id = v_llamada.persona_id;
  end if;
  perform agentes._anotar_lectura(v, v_fuentes || (v_k -> 'fuentes'), v_k -> 'versiones');
  return jsonb_build_object('corrida_id', v.id, 'agente', 'sales_coach',
    'llamada', jsonb_build_object('llamada_id', v_llamada.id, 'tipo', v_llamada.tipo, 'inicio_el', v_llamada.inicio_el,
      'duracion_segundos', v_llamada.duracion_segundos, 'cita_id', v_llamada.cita_id, 'segmentos', coalesce(v_trans.segmentos, '[]'::jsonb)),
    'closer', v_closer, 'rutas', v_rutas, 'no_contactar', exists (select 1 from negocio.contactos k where k.org_id = v.org_id
      and k.cuenta_id = v.cuenta_id and k.id = v.contacto_id and k.no_contactar_desde is not null),
    'fuentes', v_fuentes, 'conocimiento', v_k -> 'conocimiento', 'faltantes', v_falta,
    'contrato', 'agentes.registrar_sales_coach(corrida_id, {resultado{compro, salida, monto, moneda, forma_pago, motivo, ruta|ruta_clase, next_steps[], evidencia[], confianza}, evaluacion{puntaje 0-10, fases[], lo_que_hizo_bien[], donde_se_perdio, siguio_el_script}, objeciones[{categoria, texto, marca_de_tiempo_seg, respuesta_del_closer, resuelta}], seguimiento{canal, asunto, cuerpo, programar_para, motivo}, datos_del_negocio[]})');
end $$;

create or replace function agentes.registrar_sales_coach(p_corrida uuid, p_salida jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v          negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_err      jsonb := '[]'::jsonb;
  v_res      jsonb := coalesce(p_salida -> 'resultado', '{}'::jsonb);
  v_eval     jsonb := p_salida -> 'evaluacion';
  v_objs     jsonb := coalesce(p_salida -> 'objeciones', '[]'::jsonb);
  v_seg      jsonb := p_salida -> 'seguimiento';
  v_evid     jsonb;
  v_negocio  jsonb;
  v_ruta     text := nullif(btrim(v_res ->> 'ruta'), '');
  v_clase    text := nullif(btrim(v_res ->> 'ruta_clase'), '');
  v_transc   text;
  v_llamada  negocio.llamadas;
  v_no_contactar boolean;
  v_prop_id  uuid := gen_random_uuid();
  v_eval_id  uuid;
  v_borr_id  uuid;
  v_o        jsonb;
  v_o_id     uuid;
  v_n_obj    integer := 0;
  v_deg      integer;
  v_puntaje  numeric;
begin
  -- Una salida no puede traer OTRO lead: si nombra un contacto o un correo, tiene que ser el de la corrida.
  if agentes._otro_lead(v, p_salida) is not null then
    return agentes._rechazar(v, jsonb_build_array(agentes._otro_lead(v, p_salida)));
  end if;
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' then
    return agentes._rechazar(v, jsonb_build_array('la salida tiene que ser un objeto JSON'));
  end if;
  if v.llamada_id is null or v.contacto_id is null then
    return agentes._rechazar(v, jsonb_build_array('la corrida no tiene llamada o lead'));
  end if;
  select * into v_llamada from negocio.llamadas where org_id = v.org_id and cuenta_id = v.cuenta_id and contacto_id = v.contacto_id and id = v.llamada_id;
  if v_llamada.id is null then
    return agentes._rechazar(v, jsonb_build_array('la llamada de la corrida no es de este lead'));
  end if;
  v_transc := agentes._texto_de_la_fuente(v, 'llamada_venta:' || v.llamada_id);
  select no_contactar_desde is not null into v_no_contactar from negocio.contactos
   where org_id = v.org_id and cuenta_id = v.cuenta_id and id = v.contacto_id;

  -- El resultado.
  if coalesce(jsonb_typeof(v_res -> 'compro'), '') <> 'boolean' then
    v_err := v_err || to_jsonb('resultado.compro: true o false'::text);
  end if;
  if coalesce(v_res ->> 'salida', '') not in ('venta', 'acuerdo_sin_pago', 'seguimiento', 'no_interesa', 'no_show', 'nurture', 'agendo', 'venta_chica', 'no_califica') then
    v_err := v_err || to_jsonb('resultado.salida: venta, acuerdo_sin_pago, seguimiento, no_interesa, no_show, nurture, venta_chica o no_califica'::text);
  end if;
  if agentes._numero_malo(v_res -> 'monto', 0, 9999999999) or agentes._numero_malo(v_res -> 'monto_usd', 0, 99999999999) then
    v_err := v_err || to_jsonb('resultado.monto y monto_usd: números, cero o más'::text);
  end if;
  if (v_res -> 'compro') = 'true'::jsonb and coalesce(v_res ->> 'salida', '') not in ('venta', 'venta_chica', 'acuerdo_sin_pago') then
    v_err := v_err || to_jsonb('resultado: si compró, la salida es venta, venta_chica o acuerdo_sin_pago'::text);
  end if;
  if v_res ? 'motivo' and not exists (select 1 from catalogo.motivos where clave = v_res ->> 'motivo') then
    v_err := v_err || to_jsonb(format('resultado.motivo: «%s» no está en catalogo.motivos', v_res ->> 'motivo'));
  end if;
  if v_res ? 'moneda' and not exists (select 1 from catalogo.monedas where codigo = v_res ->> 'moneda') then
    v_err := v_err || to_jsonb('resultado.moneda: un código ISO de 3 letras'::text);
  end if;
  if v_ruta is not null then
    select r.clase into v_clase from negocio.rutas_de_la_cuenta r where r.org_id = v.org_id and r.cuenta_id = v.cuenta_id and r.clave = v_ruta;
    if v_clase is null then v_err := v_err || to_jsonb(format('resultado.ruta: «%s» no es una ruta de la cuenta', v_ruta)); end if;
  elsif v_clase is not null and not exists (select 1 from catalogo.clases_de_ruta where clave = v_clase) then
    v_err := v_err || to_jsonb('resultado.ruta_clase: alto_ticket, bajo_ticket o nutricion'::text);
  end if;
  if length(coalesce(v_res ->> 'forma_pago', '')) > 100 then
    v_err := v_err || to_jsonb('resultado.forma_pago: hasta 100 caracteres'::text);
  end if;
  if jsonb_typeof(coalesce(v_res -> 'evidencia', '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_salida -> 'datos_del_negocio', '[]'::jsonb)) <> 'array'
     or (v_eval is not null and jsonb_typeof(coalesce(v_eval -> 'lo_que_hizo_bien', '[]'::jsonb)) <> 'array') then
    v_err := v_err || to_jsonb('evidencia, datos_del_negocio y lo_que_hizo_bien son listas'::text);
  end if;
  if coalesce(v_res ->> 'confianza', 'media') not in ('alta', 'media', 'baja') then
    v_err := v_err || to_jsonb('resultado.confianza: alta, media o baja'::text);
  end if;
  if jsonb_typeof(coalesce(v_res -> 'next_steps', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(v_res -> 'next_steps', '[]'::jsonb)) = 0 then
    v_err := v_err || to_jsonb('resultado.next_steps: al menos un paso siguiente (el objetivo del agente)'::text);
  end if;
  v_evid := agentes._validar_datos(v, coalesce(v_res -> 'evidencia', '[]'::jsonb), 'resultado.evidencia');
  v_negocio := agentes._validar_datos(v, coalesce(p_salida -> 'datos_del_negocio', '[]'::jsonb), 'datos_del_negocio');
  v_err := v_err || (v_evid -> 'errores') || (v_negocio -> 'errores');

  -- La evaluación.
  if v_eval is not null then
    begin
      v_puntaje := (v_eval ->> 'puntaje')::numeric;
    exception when others then v_puntaje := null;
    end;
    if v_puntaje is null or v_puntaje not between 0 and 10 then
      v_err := v_err || to_jsonb('evaluacion.puntaje: de 0 a 10'::text);
    end if;
    if agentes._numero_malo(v_eval -> 'siguio_el_script', 0, 100) then
      v_err := v_err || to_jsonb('evaluacion.siguio_el_script: de 0 a 100'::text);
    end if;
    if jsonb_typeof(coalesce(v_eval -> 'fases', '[]'::jsonb)) <> 'array' then
      v_err := v_err || to_jsonb('evaluacion.fases: una lista'::text);
    end if;
  end if;

  -- Las objeciones.
  if jsonb_typeof(v_objs) <> 'array' then
    v_err := v_err || to_jsonb('objeciones: una lista'::text);
    v_objs := '[]'::jsonb;
  end if;
  for v_o in select value from jsonb_array_elements(v_objs) loop
    if coalesce(v_o ->> 'categoria', '') not in ('precio', 'momento', 'decisor', 'confianza', 'encaje', 'otra') then
      v_err := v_err || to_jsonb('objeciones: categoria = precio, momento, decisor, confianza, encaje u otra'::text);
    end if;
    if agentes._numero_malo(v_o -> 'marca_de_tiempo_seg', 0, 99999999) or agentes._booleano_malo(v_o -> 'resuelta') then
      v_err := v_err || to_jsonb('objeciones: marca_de_tiempo_seg es un número (segundos) y resuelta, true o false'::text);
    end if;
    if coalesce(btrim(v_o ->> 'texto'), '') = '' then
      v_err := v_err || to_jsonb('objeciones: cada una con su texto (las palabras del lead)'::text);
    end if;
  end loop;

  -- El seguimiento.
  if v_seg is not null and jsonb_typeof(v_seg) = 'object' then
    if coalesce(btrim(v_seg ->> 'cuerpo'), '') = '' then
      v_err := v_err || to_jsonb('seguimiento.cuerpo: falta el texto'::text);
    end if;
    if v_seg ? 'programar_para' and jsonb_typeof(v_seg -> 'programar_para') <> 'null' and agentes._fecha(v_seg ->> 'programar_para') is null then
      v_err := v_err || to_jsonb('seguimiento.programar_para: una fecha ISO (2026-11-12T15:00:00-05:00)'::text);
    end if;
    if not exists (select 1 from catalogo.canales where clave = coalesce(v_seg ->> 'canal', '')) then
      v_err := v_err || to_jsonb('seguimiento.canal: whatsapp, email, sms, instagram_dm…'::text);
    end if;
  end if;

  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  -- La propuesta anterior de esta llamada que nadie decidió queda rechazada: confirmar las dos duplicaría la venta.
  update negocio.resultados_propuestos
     set estado = 'rechazado', decidido_el = now(), motivo_decision = 'reemplazado por la corrida ' || v.id
   where org_id = v.org_id and cuenta_id = v.cuenta_id and contacto_id = v.contacto_id and llamada_id = v.llamada_id
     and estado = 'propuesto';

  insert into negocio.resultados_propuestos (org_id, cuenta_id, id, contacto_id, cita_id, llamada_id, corrida_id, closer_id,
    compro, salida, ruta, ruta_clase, monto, moneda, monto_usd, forma_pago, motivo, objeciones, next_steps, evidencia,
    datos_del_negocio, confianza)
  values (v.org_id, v.cuenta_id, v_prop_id, v.contacto_id, coalesce(v.cita_id, v_llamada.cita_id), v.llamada_id, v.id,
    v_llamada.persona_id, (v_res -> 'compro') = 'true'::jsonb, v_res ->> 'salida', v_ruta, v_clase,
    agentes._numero(v_res ->> 'monto'), v_res ->> 'moneda', agentes._numero(v_res ->> 'monto_usd'), v_res ->> 'forma_pago', v_res ->> 'motivo',
    coalesce((select jsonb_agg(jsonb_build_object('categoria', o ->> 'categoria', 'texto', left(o ->> 'texto', 300),
              'resuelta', o -> 'resuelta')) from jsonb_array_elements(v_objs) o), '[]'::jsonb),
    v_res -> 'next_steps', v_evid -> 'datos', v_negocio -> 'datos', coalesce(v_res ->> 'confianza', 'media'));
  perform agentes._evento(v, 'resultado_propuesto', jsonb_build_object('resultado_propuesto_id', v_prop_id, 'compro', (v_res -> 'compro') = 'true'::jsonb));

  if v_eval is not null then
    v_eval_id := gen_random_uuid();
    insert into negocio.evaluaciones_de_llamada (org_id, cuenta_id, id, llamada_id, contacto_id, closer_id, corrida_id,
      version_script, puntaje, fases, lo_que_hizo_bien, donde_se_perdio, siguio_el_script)
    values (v.org_id, v.cuenta_id, v_eval_id, v.llamada_id, v.contacto_id, v_llamada.persona_id, v.id,
      (v.conocimiento ->> 'script_de_ventas')::integer, v_puntaje, coalesce(v_eval -> 'fases', '[]'::jsonb),
      coalesce(v_eval -> 'lo_que_hizo_bien', '[]'::jsonb), v_eval -> 'donde_se_perdio', agentes._numero(v_eval ->> 'siguio_el_script'));
    perform agentes._evento(v, 'llamada_evaluada', jsonb_build_object('evaluacion_id', v_eval_id, 'puntaje', v_puntaje));
  end if;

  for v_o in select value from jsonb_array_elements(v_objs) loop
    v_o_id := gen_random_uuid();
    v_n_obj := v_n_obj + 1;
    insert into negocio.objeciones_de_llamada (org_id, cuenta_id, id, llamada_id, contacto_id, corrida_id, categoria, texto,
      marca_de_tiempo_seg, respuesta_del_closer, resuelta, cita_verificada)
    values (v.org_id, v.cuenta_id, v_o_id, v.llamada_id, v.contacto_id, v.id, v_o ->> 'categoria', left(v_o ->> 'texto', 1000),
      agentes._numero(v_o ->> 'marca_de_tiempo_seg'), left(v_o ->> 'respuesta_del_closer', 2000), agentes._booleano(v_o -> 'resuelta'),
      v_transc is not null and position(agentes._normal(v_o ->> 'texto') in agentes._normal(v_transc)) > 0);
    perform agentes._evento(v, 'objecion_registrada', jsonb_build_object('objecion_id', v_o_id, 'categoria', v_o ->> 'categoria',
      'resuelta', v_o -> 'resuelta'), null, v_n_obj::text);
  end loop;

  if v_seg is not null and jsonb_typeof(v_seg) = 'object' and not v_no_contactar then
    v_borr_id := gen_random_uuid();
    insert into negocio.borradores_de_mensaje (org_id, cuenta_id, id, contacto_id, corrida_id, motivo, canal, asunto, cuerpo, programar_para)
    values (v.org_id, v.cuenta_id, v_borr_id, v.contacto_id, v.id,
      coalesce(nullif(v_seg ->> 'motivo', ''), case when (v_res ->> 'salida') in ('nurture', 'no_interesa') then 'nutricion'
                                                   when (v_res ->> 'salida') = 'no_show' then 'no_show' else 'seguimiento_post_llamada' end),
      v_seg ->> 'canal', left(v_seg ->> 'asunto', 300), left(v_seg ->> 'cuerpo', 8000), agentes._fecha(v_seg ->> 'programar_para'));
    perform agentes._evento(v, 'seguimiento_redactado', jsonb_build_object('borrador_id', v_borr_id, 'motivo', 'seguimiento'));
  end if;

  v_deg := (v_evid ->> 'degradados')::integer + (v_negocio ->> 'degradados')::integer;
  perform agentes._cerrar(v, p_salida, v_deg, 'esperando_aprobacion');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'resultado_propuesto_id', v_prop_id, 'evaluacion_id', v_eval_id,
    'objeciones', v_n_obj, 'borrador_id', v_borr_id, 'seguimiento_omitido_por_no_contactar', v_seg is not null and v_no_contactar,
    'degradados', v_deg, 'siguiente', 'el closer confirma con agentes.confirmar_resultado(resultado_propuesto_id, ''confirmado'' | ''corregido'' | ''rechazado'', closer_id, correcciones)');
end $$;

create or replace function agentes.registrar_triage(p_corrida uuid, p_salida jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v           negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_err       jsonb := '[]'::jsonb;
  v_razones   jsonb;
  v_prioridad smallint;
  v_ruta      text := nullif(btrim(p_salida ->> 'ruta'), '');
  v_clase     text := nullif(btrim(p_salida ->> 'ruta_clase'), '');
  v_cuadrante text := nullif(btrim(p_salida ->> 'cuadrante_propuesto'), '');
  v_encaje    text := p_salida #>> '{ejes,encaje}';
  v_capacidad text := p_salida #>> '{ejes,capacidad}';
  v_ko        jsonb := coalesce(p_salida -> 'knockouts', '[]'::jsonb);
  v_dudosos   jsonb := coalesce(p_salida -> 'datos_dudosos', '[]'::jsonb);
  v_faltan    text[];
  v_confianza text := coalesce(p_salida ->> 'confianza', 'media');
  v_id        uuid := gen_random_uuid();
  v_crm       text;
  v_k         record;
  v_ko_item   jsonb;
begin
  -- Una salida no puede traer OTRO lead: si nombra un contacto o un correo, tiene que ser el de la corrida.
  if agentes._otro_lead(v, p_salida) is not null then
    return agentes._rechazar(v, jsonb_build_array(agentes._otro_lead(v, p_salida)));
  end if;
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' then
    return agentes._rechazar(v, jsonb_build_array('la salida tiene que ser un objeto JSON'));
  end if;
  v_razones := agentes._validar_datos(v, coalesce(p_salida -> 'razones', '[]'::jsonb), 'razones');
  v_err := v_err || (v_razones -> 'errores');
  if jsonb_array_length(v_razones -> 'datos') = 0 then
    v_err := v_err || to_jsonb('razones: hace falta al menos una razón con su fuente'::text);
  end if;

  begin
    v_prioridad := (p_salida ->> 'prioridad')::smallint;
  exception when others then
    v_prioridad := null;
  end;
  if v_prioridad is null or v_prioridad not between 1 and 10 then
    v_err := v_err || to_jsonb('prioridad: un entero de 1 (llamar primero) a 10'::text);
  end if;

  if v_ruta is not null then
    select r.clase into v_clase from negocio.rutas_de_la_cuenta r
     where r.org_id = v.org_id and r.cuenta_id = v.cuenta_id and r.clave = v_ruta and r.activa;
    if v_clase is null then
      v_err := v_err || to_jsonb(format('ruta: «%s» no es una ruta activa de la cuenta', v_ruta));
    end if;
  elsif v_clase is null or not exists (select 1 from catalogo.clases_de_ruta where clave = v_clase and vigente) then
    v_err := v_err || to_jsonb('ruta o ruta_clase: hace falta una (ruta_clase = alto_ticket, bajo_ticket o nutricion)'::text);
  end if;

  if v_cuadrante is not null and not exists (select 1 from catalogo.cuadrantes where clave = v_cuadrante) then
    v_err := v_err || to_jsonb(format('cuadrante_propuesto: «%s» no es un cuadrante', v_cuadrante));
  end if;
  if v_encaje is not null and v_encaje not in ('alto', 'bajo') then
    v_err := v_err || to_jsonb('ejes.encaje: alto o bajo'::text);
  end if;
  if v_capacidad is not null and v_capacidad not in ('alta', 'baja') then
    v_err := v_err || to_jsonb('ejes.capacidad: alta o baja'::text);
  end if;
  if v_cuadrante is not null and v_encaje is not null and v_capacidad is not null and jsonb_array_length(v_ko) = 0 then
    select * into v_k from catalogo.cuadrantes where clave = v_cuadrante;
    if found and (v_k.encaje <> v_encaje or v_k.capacidad <> v_capacidad) then
      v_err := v_err || to_jsonb(format('cuadrante_propuesto: «%s» es encaje %s y capacidad %s, no %s y %s', v_cuadrante, v_k.encaje, v_k.capacidad, v_encaje, v_capacidad));
    end if;
  end if;
  if agentes._numero_malo(p_salida #> '{ejes,puntaje_encaje}', -9999, 9999) or agentes._numero_malo(p_salida #> '{ejes,puntaje_capacidad}', -9999, 9999) then
    v_err := v_err || to_jsonb('ejes.puntaje_*: un número'::text);
  end if;
  if jsonb_typeof(v_ko) <> 'array' then
    v_err := v_err || to_jsonb('knockouts: una lista'::text);
    v_ko := '[]'::jsonb;
  end if;
  for v_ko_item in select value from jsonb_array_elements(v_ko) loop
    if agentes._texto_de_la_fuente(v, v_ko_item ->> 'fuente') is null then
      v_err := v_err || to_jsonb(format('knockouts: la fuente «%s» no está en la corrida', v_ko_item ->> 'fuente'));
    end if;
  end loop;
  if jsonb_array_length(v_ko) > 0 and v_cuadrante is not null and v_cuadrante <> 'descarta' then
    v_err := v_err || to_jsonb('cuadrante_propuesto: con un knockout, el cuadrante es descarta'::text);
  end if;
  if jsonb_typeof(v_dudosos) <> 'array' then
    v_err := v_err || to_jsonb('datos_dudosos: una lista'::text);
  end if;
  if v_confianza not in ('alta', 'media', 'baja') then
    v_err := v_err || to_jsonb('confianza: alta, media o baja'::text);
  end if;
  if p_salida ? 'faltantes' and jsonb_typeof(p_salida -> 'faltantes') <> 'array' then
    v_err := v_err || to_jsonb('faltantes: una lista de preguntas estándar'::text);
  end if;

  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  select array_agg(x) into v_faltan from jsonb_array_elements_text(coalesce(p_salida -> 'faltantes', '[]'::jsonb)) x;
  select cuadrante into v_crm from negocio.contactos where org_id = v.org_id and cuenta_id = v.cuenta_id and id = v.contacto_id;

  insert into negocio.triajes (org_id, cuenta_id, id, corrida_id, contacto_id, ghl_contact_id, cuadrante_del_crm,
    cuadrante_propuesto, encaje, capacidad, puntaje_encaje, puntaje_capacidad, knockouts, prioridad, ruta, ruta_clase,
    razones, datos_dudosos, faltantes, confianza, version_icp, version_matriz, aplicado)
  values (v.org_id, v.cuenta_id, v_id, v.id, v.contacto_id, v.ghl_contact_id, v_crm,
    v_cuadrante, v_encaje, v_capacidad, agentes._numero(p_salida #>> '{ejes,puntaje_encaje}'), agentes._numero(p_salida #>> '{ejes,puntaje_capacidad}'),
    v_ko, v_prioridad, v_ruta, v_clase, v_razones -> 'datos', v_dudosos, coalesce(v_faltan, '{}'),
    v_confianza, (v.conocimiento ->> 'icp')::integer, (v.conocimiento ->> 'matriz_de_scoring')::integer, v.modo = 'activo');

  if v.contacto_id is not null then
    perform agentes._evento(v, 'triaje_registrado', jsonb_build_object('triaje_id', v_id, 'prioridad', v_prioridad,
      'ruta', coalesce(v_ruta, v_clase), 'cuadrante_propuesto', v_cuadrante));
    if v.modo = 'activo' then
      perform agentes._evento(v, 'ruta_asignada', jsonb_build_object('ruta', coalesce(v_ruta, v_clase)));
    end if;
  end if;
  perform agentes._cerrar(v, p_salida || jsonb_build_object('razones', v_razones -> 'datos'), (v_razones ->> 'degradados')::integer);
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'triaje_id', v_id, 'degradados', (v_razones ->> 'degradados')::integer,
    'cuadrante_del_crm', v_crm, 'difiere_del_crm', v_cuadrante is not null and v_crm is distinct from v_cuadrante,
    'escribir_en_ghl', case when v.modo = 'activo' then jsonb_build_object('prioridad', v_prioridad, 'ruta', coalesce(v_ruta, v_clase)) end,
    'aviso', case when v.modo <> 'activo' then 'modo sombra: no escribas nada en GHL; esto sólo queda registrado' end);
end $$;

create or replace function agentes.registrar_sales_assistant(p_corrida uuid, p_salida jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v         negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_err     jsonb := '[]'::jsonb;
  v_quien   jsonb;
  v_dijo    jsonb;
  v_est     jsonb := coalesce(p_salida -> 'estrategia', '{}'::jsonb);
  v_alertas jsonb := coalesce(p_salida -> 'alertas', '[]'::jsonb);
  v_resumen text := nullif(btrim(p_salida ->> 'resumen'), '');
  v_version integer;
  v_id      uuid := gen_random_uuid();
  v_triaje  record;
  v_crm     text;
  v_deg     integer;
  v_a       jsonb;
begin
  -- Una salida no puede traer OTRO lead: si nombra un contacto o un correo, tiene que ser el de la corrida.
  if agentes._otro_lead(v, p_salida) is not null then
    return agentes._rechazar(v, jsonb_build_array(agentes._otro_lead(v, p_salida)));
  end if;
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' then
    return agentes._rechazar(v, jsonb_build_array('la salida tiene que ser un objeto JSON'));
  end if;
  if v.contacto_id is null then
    return agentes._rechazar(v, jsonb_build_array('el lead todavía no está en la base: vuelve a intentarlo en unos minutos'));
  end if;
  if v_resumen is null or length(v_resumen) > 4000 then
    v_err := v_err || to_jsonb('resumen: un texto corto (lo que se lee en 30 segundos), hasta 4000 caracteres'::text);
  end if;
  v_quien := agentes._validar_datos(v, coalesce(p_salida -> 'quien_es', '[]'::jsonb), 'quien_es');
  v_dijo  := agentes._validar_datos(v, coalesce(p_salida -> 'que_dijo', '[]'::jsonb), 'que_dijo');
  v_err := v_err || (v_quien -> 'errores') || (v_dijo -> 'errores');
  if jsonb_typeof(v_est) <> 'object' then
    v_err := v_err || to_jsonb('estrategia: un objeto {objetivo_de_la_llamada, angulo, ruta_recomendada, preguntas_clave, objeciones_probables, cierre_sugerido}'::text);
  elsif coalesce(btrim(v_est ->> 'objetivo_de_la_llamada'), '') = '' then
    v_err := v_err || to_jsonb('estrategia.objetivo_de_la_llamada: falta'::text);
  end if;
  if jsonb_typeof(v_alertas) <> 'array' then
    v_err := v_err || to_jsonb('alertas: una lista'::text);
  else
    for v_a in select value from jsonb_array_elements(v_alertas) loop
      if coalesce(btrim(v_a ->> 'descripcion'), '') = '' or coalesce(btrim(v_a ->> 'que_confirmar'), '') = '' then
        v_err := v_err || to_jsonb('alertas: cada una necesita descripcion y que_confirmar'::text);
      end if;
      if v_a ? 'fuente_a' and agentes._texto_de_la_fuente(v, v_a ->> 'fuente_a') is null then
        v_err := v_err || to_jsonb(format('alertas: la fuente «%s» no está en la corrida', v_a ->> 'fuente_a'));
      end if;
      if v_a ? 'fuente_b' and agentes._texto_de_la_fuente(v, v_a ->> 'fuente_b') is null then
        v_err := v_err || to_jsonb(format('alertas: la fuente «%s» no está en la corrida', v_a ->> 'fuente_b'));
      end if;
    end loop;
  end if;
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ficha:' || v.contacto_id, 0));
  select coalesce(max(version), 0) + 1 into v_version from negocio.fichas_del_lead
   where org_id = v.org_id and cuenta_id = v.cuenta_id and contacto_id = v.contacto_id;
  select prioridad into v_triaje from negocio.triaje_vigente where org_id = v.org_id and cuenta_id = v.cuenta_id and contacto_id = v.contacto_id;
  select cuadrante into v_crm from negocio.contactos where org_id = v.org_id and cuenta_id = v.cuenta_id and id = v.contacto_id;
  v_deg := (v_quien ->> 'degradados')::integer + (v_dijo ->> 'degradados')::integer;

  insert into negocio.fichas_del_lead (org_id, cuenta_id, id, contacto_id, cita_id, corrida_id, version, resumen, quien_es,
    que_dijo, estrategia, alertas, faltantes, cuadrante_al_generar, prioridad_al_generar, degradados)
  values (v.org_id, v.cuenta_id, v_id, v.contacto_id, v.cita_id, v.id, v_version, v_resumen, v_quien -> 'datos',
    v_dijo -> 'datos', v_est, v_alertas, coalesce(p_salida -> 'faltantes', '[]'::jsonb), v_crm, v_triaje.prioridad, v_deg);

  perform agentes._evento(v, 'ficha_generada', jsonb_build_object('ficha_id', v_id, 'version', v_version, 'cita_id', v.cita_id));
  perform agentes._cerrar(v, p_salida || jsonb_build_object('quien_es', v_quien -> 'datos', 'que_dijo', v_dijo -> 'datos'), v_deg);
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'ficha_id', v_id, 'version', v_version, 'degradados', v_deg,
    'alertas', jsonb_array_length(v_alertas));
end $$;

create or replace function agentes.registrar_llamada(
  p_location_id      text,
  p_ghl_contact_id   text,
  p_externa_id       text,
  p_tipo             text,
  p_proveedor        text default 'ghl',
  p_transcripcion    text default null,
  p_segmentos        jsonb default '[]'::jsonb,
  p_inicio_el        timestamptz default null,
  p_duracion_segundos integer default null,
  p_ghl_evento_id    text default null,
  p_persona_id       uuid default null,
  p_url_de_la_grabacion text default null,
  p_resumen          text default null,
  p_contestada       boolean default true,
  p_direccion        text default null,
  p_idioma           text default null,
  p_agente_de_voz    text default null
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v_org      uuid;
  v_cuenta   uuid;
  v_contacto uuid;
  v_cita     uuid;
  v_id       uuid;
  v_nueva    boolean := false;
  v_trans    uuid;
  v_sesion   text := nullif(btrim(current_setting('app.org_id', true)), '');
begin
  select c.org_id, c.id into v_org, v_cuenta from identidad.cuentas c
   where c.crm = 'ghl' and c.crm_cuenta_id = p_location_id and c.estado = 'activa';
  if v_cuenta is null then
    raise exception using errcode = 'P0002', message = format('agentes: la location de GHL «%s» no es una cuenta activa', p_location_id);
  end if;
  if v_sesion is not null and v_sesion::uuid <> v_org then
    raise exception using errcode = '42501', message = 'agentes: la sesión es de otra organización';
  end if;
  select k.id into v_contacto from negocio.contactos k where k.org_id = v_org and k.cuenta_id = v_cuenta and k.ghl_contact_id = p_ghl_contact_id;
  if v_contacto is null then
    raise exception using errcode = 'P0002', message = 'agentes: el contacto todavía no está en la base (reintenta en unos minutos)';
  end if;
  if not exists (select 1 from catalogo.tipos_de_llamada where clave = p_tipo) then
    raise exception using errcode = '22023', message = format('agentes: «%s» no es un tipo de llamada', p_tipo);
  end if;
  if p_ghl_evento_id is not null then
    select ci.id into v_cita from negocio.citas ci where ci.org_id = v_org and ci.cuenta_id = v_cuenta and ci.contacto_id = v_contacto
       and ci.ghl_evento_id = p_ghl_evento_id;
  end if;

  select l.id into v_id from negocio.llamadas l where l.org_id = v_org and l.externa_id = p_externa_id;
  if v_id is null then
    v_id := gen_random_uuid();
    v_nueva := true;
    insert into negocio.llamadas (org_id, cuenta_id, id, externa_id, contacto_id, agente, contestada, inicio_el, duracion_segundos,
      resumen, tipo, proveedor, cita_id, persona_id, direccion, url_de_la_grabacion, estado_de_transcripcion, vinculada_por)
    values (v_org, v_cuenta, v_id, p_externa_id, v_contacto, p_agente_de_voz, coalesce(p_contestada, true), p_inicio_el,
      p_duracion_segundos, left(p_resumen, 4000), p_tipo, coalesce(p_proveedor, 'ghl'), v_cita, p_persona_id, p_direccion,
      p_url_de_la_grabacion, case when p_transcripcion is not null then 'lista' else 'pendiente' end, 'ghl');
  else
    update negocio.llamadas
       set cita_id = coalesce(cita_id, v_cita), persona_id = coalesce(persona_id, p_persona_id),
           resumen = coalesce(left(p_resumen, 4000), resumen), url_de_la_grabacion = coalesce(p_url_de_la_grabacion, url_de_la_grabacion),
           duracion_segundos = coalesce(p_duracion_segundos, duracion_segundos), inicio_el = coalesce(inicio_el, p_inicio_el),
           tipo = coalesce(tipo, p_tipo), proveedor = coalesce(proveedor, p_proveedor),
           estado_de_transcripcion = case when p_transcripcion is not null then 'lista' else estado_de_transcripcion end
     where org_id = v_org and cuenta_id = v_cuenta and id = v_id and contacto_id = v_contacto;
    if not found then
      raise exception using errcode = '42501', message = 'agentes: ese id externo ya es de una llamada de otro lead';
    end if;
  end if;

  if p_transcripcion is not null and btrim(p_transcripcion) <> '' then
    -- Una transcripción idéntica a la última no se duplica.
    if not exists (select 1 from (select texto from negocio.transcripciones where org_id = v_org and cuenta_id = v_cuenta and llamada_id = v_id
                                   order by creada_el desc limit 1) t where md5(t.texto) = md5(p_transcripcion)) then
      v_trans := gen_random_uuid();
      insert into negocio.transcripciones (org_id, cuenta_id, contacto_id, id, llamada_id, texto, segmentos, idioma, proveedor)
      values (v_org, v_cuenta, v_contacto, v_trans, v_id, p_transcripcion, coalesce(p_segmentos, '[]'::jsonb), p_idioma, coalesce(p_proveedor, 'ghl'));
      perform agentes._registrar_evento(v_org,
    v_cuenta,
    'transcripcion_lista',
    v_contacto,
    'sistema',
    'agentes.registrar_llamada',
    coalesce(p_proveedor, 'ghl'),
    'transcripcion:' || v_trans,
    jsonb_build_object('llamada_id', v_id, 'tipo', p_tipo, 'transcripcion_id', v_trans, 'cita_id', v_cita),
    now());
    end if;
  end if;
  if v_nueva and v_cita is not null then
    perform agentes._registrar_evento(v_org,
    v_cuenta,
    'llamada_vinculada',
    v_contacto,
    'sistema',
    'agentes.registrar_llamada',
    coalesce(p_proveedor, 'ghl'),
    'llamada_vinculada:' || v_id,
    jsonb_build_object('llamada_id', v_id, 'vinculada_por', 'ghl'),
    now());
  end if;
  return jsonb_build_object('ok', true, 'llamada_id', v_id, 'nueva', v_nueva, 'transcripcion_id', v_trans, 'cita_id', v_cita,
    'contacto_id', v_contacto);
end $$;

create or replace function agentes.confirmar_resultado(
  p_resultado_propuesto uuid, p_decision text, p_closer uuid default null, p_correcciones jsonb default '{}'::jsonb,
  p_motivo text default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  p          negocio.resultados_propuestos;
  v_sesion   text := nullif(btrim(current_setting('app.org_id', true)), '');
  c          jsonb := coalesce(p_correcciones, '{}'::jsonb);
  v_salida   text;
  v_compro   boolean;
  v_res_id   uuid;
  v_cli_id   uuid;
  v_dif      jsonb := '{}'::jsonb;
  v_campo    text;
  v_corrida  negocio.corridas_de_agente;
  v_nombre   text;
  d          jsonb;
  v_alta_error text;
begin
  select * into p from negocio.resultados_propuestos where id = p_resultado_propuesto;
  if not found then raise exception using errcode = 'P0002', message = 'agentes: el resultado propuesto no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> p.org_id then
    raise exception using errcode = '42501', message = 'agentes: el resultado es de otra organización que la de la sesión';
  end if;
  if p.estado <> 'propuesto' then
    return jsonb_build_object('ok', false, 'errores', jsonb_build_array(format('ya está «%s»', p.estado)), 'resultado_id', p.resultado_id);
  end if;
  if p_decision not in ('confirmado', 'corregido', 'rechazado') then
    raise exception using errcode = '22023', message = 'agentes: la decisión es confirmado, corregido o rechazado';
  end if;
  if p_closer is null or not exists (select 1 from identidad.usuarios u where u.org_id = p.org_id and u.id = p_closer) then
    raise exception using errcode = '22023',
      message = 'agentes: confirmar un resultado lo hace una persona: p_closer tiene que ser un usuario de la organización';
  end if;
  select * into v_corrida from negocio.corridas_de_agente where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.corrida_id;
  -- Una llamada, una venta: si otro resultado de esta misma llamada ya se confirmó, éste no se confirma.
  if p_decision <> 'rechazado' and p.llamada_id is not null and exists (
      select 1 from negocio.resultados_propuestos o
       where o.org_id = p.org_id and o.cuenta_id = p.cuenta_id and o.contacto_id = p.contacto_id and o.llamada_id = p.llamada_id
         and o.id <> p.id and o.estado in ('confirmado', 'corregido')) then
    return jsonb_build_object('ok', false, 'errores', jsonb_build_array('esta llamada ya tiene un resultado confirmado'));
  end if;

  if p_decision = 'rechazado' then
    update negocio.resultados_propuestos set estado = 'rechazado', decidido_por = p_closer, decidido_el = now(), motivo_decision = p_motivo
     where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.id;
    update negocio.corridas_de_agente set estado = 'rechazada' where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.corrida_id;
    return jsonb_build_object('ok', true, 'estado', 'rechazado');
  end if;

  if c ? 'salida' and c ->> 'salida' not in ('venta', 'acuerdo_sin_pago', 'seguimiento', 'no_interesa', 'no_show', 'nurture', 'agendo', 'venta_chica', 'no_califica') then
    raise exception using errcode = '22023', message = 'agentes: la salida corregida no es válida';
  end if;
  if agentes._numero_malo(c -> 'monto', 0, 9999999999) or agentes._numero_malo(c -> 'monto_usd', 0, 99999999999) or agentes._booleano_malo(c -> 'compro') then
    raise exception using errcode = '22023', message = 'agentes: monto y monto_usd son números de cero o más, y compro es true o false';
  end if;
  if c ? 'motivo' and not exists (select 1 from catalogo.motivos where clave = c ->> 'motivo') then
    raise exception using errcode = '22023', message = 'agentes: el motivo corregido no está en catalogo.motivos';
  end if;
  if c ? 'moneda' and not exists (select 1 from catalogo.monedas where codigo = c ->> 'moneda') then
    raise exception using errcode = '22023', message = 'agentes: la moneda corregida no es un código ISO';
  end if;
  if c ? 'ruta' and not exists (select 1 from negocio.rutas_de_la_cuenta r where r.org_id = p.org_id and r.cuenta_id = p.cuenta_id
                                and r.clave = c ->> 'ruta') then
    raise exception using errcode = '22023', message = 'agentes: la ruta corregida no es una ruta de la cuenta (agentes.cargar_rutas)';
  end if;
  foreach v_campo in array array['salida', 'monto', 'moneda', 'monto_usd', 'forma_pago', 'motivo', 'compro', 'ruta'] loop
    if c ? v_campo and (case when v_campo in ('monto', 'monto_usd') then agentes._numero(c ->> v_campo) is distinct from agentes._numero(to_jsonb(p) ->> v_campo)
                            when v_campo = 'compro' then agentes._booleano(c -> v_campo) is distinct from p.compro
                            else (c ->> v_campo) is distinct from (to_jsonb(p) ->> v_campo) end) then
      v_dif := v_dif || jsonb_build_object(v_campo, jsonb_build_object('propuesto', to_jsonb(p) -> v_campo, 'confirmado', c -> v_campo));
    end if;
  end loop;
  v_salida := coalesce(c ->> 'salida', p.salida);
  v_compro := coalesce(agentes._booleano(c -> 'compro'), p.compro);

  v_res_id := gen_random_uuid();
  insert into negocio.resultados (org_id, cuenta_id, id, contacto_id, salida, rol, monto, forma_pago, detalle, registrado_por,
                                  cita_id, moneda, monto_usd, motivo, closer_id, clave_de_intento)
  values (p.org_id, p.cuenta_id, v_res_id, p.contacto_id, v_salida, 'closer',
          coalesce(agentes._numero(c ->> 'monto'), p.monto), coalesce(c ->> 'forma_pago', p.forma_pago),
          left('Propuesto por el Sales Coach (corrida ' || p.corrida_id || ')', 500), p_closer, p.cita_id,
          coalesce(c ->> 'moneda', p.moneda), coalesce(agentes._numero(c ->> 'monto_usd'), p.monto_usd), coalesce(c ->> 'motivo', p.motivo),
          coalesce(p.closer_id, p_closer), p.id);
  perform agentes._registrar_evento(p.org_id,
    p.cuenta_id,
    'resultado_registrado',
    p.contacto_id,
    'persona',
    coalesce(p_closer::text, 'closer'),
    'comando_central',
    'resultado:' || v_res_id,
    jsonb_build_object('resultado_id', v_res_id, 'salida', v_salida,
          'resultado_propuesto_id', p.id),
    now());

  update negocio.resultados_propuestos
     set estado = case when v_dif = '{}'::jsonb then 'confirmado' else 'corregido' end,
         decidido_por = p_closer, decidido_el = now(), motivo_decision = p_motivo,
         diferencias = nullif(v_dif, '{}'::jsonb), resultado_id = v_res_id
   where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.id;
  update negocio.corridas_de_agente set estado = 'aprobada' where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.corrida_id;

  -- Lo que el lead contó de su negocio y es una pregunta estándar, a sus respuestas (vía agente_ia).
  for d in select value from jsonb_array_elements(p.datos_del_negocio) loop
    if d ->> 'estado' = 'detectado' and nullif(btrim(d ->> 'valor'), '') is not null
       and exists (select 1 from catalogo.preguntas_estandar where clave = d ->> 'campo') then
      insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor,
                                               obtenida_por, observada_el)
      values (p.org_id, p.cuenta_id, p.contacto_id, d ->> 'campo', left('sales_coach:' || p.corrida_id, 200),
              left(d ->> 'valor', 2000), 'ghl_managed_agents', 'agente_ia', now());
    end if;
  end loop;

  -- Si compró: el registro de la venta (el cliente). Su cuenta se crea al confirmarse el pago.
  if v_compro then
    select coalesce(nullif(btrim(c ->> 'nombre_del_negocio'), ''),
                    (select d2 ->> 'valor' from jsonb_array_elements(p.datos_del_negocio) d2 where d2 ->> 'campo' = 'nombre_del_negocio' limit 1))
      into v_nombre;
    v_cli_id := gen_random_uuid();
    insert into negocio.clientes (org_id, cuenta_id, id, contacto_id, resultado_id, resultado_propuesto_id, ruta, ruta_clase, nombre_del_negocio)
    values (p.org_id, p.cuenta_id, v_cli_id, p.contacto_id, v_res_id, p.id, coalesce(c ->> 'ruta', p.ruta),
            coalesce((select r.clase from negocio.rutas_de_la_cuenta r where r.org_id = p.org_id and r.cuenta_id = p.cuenta_id
                        and r.clave = c ->> 'ruta'), p.ruta_clase), v_nombre);
    perform agentes._registrar_evento(p.org_id,
    p.cuenta_id,
    'cliente_creado',
    p.contacto_id,
    'persona',
    coalesce(p_closer::text, 'closer'),
    'comando_central',
    'cliente:' || v_cli_id,
    jsonb_build_object('cliente_id', v_cli_id, 'ruta', coalesce(c ->> 'ruta', p.ruta, p.ruta_clase)),
    now());
    -- El pago pudo llegar antes que la confirmación: se une a esta venta.
    update negocio.pagos set cliente_id = v_cli_id
     where org_id = p.org_id and cuenta_id = p.cuenta_id and contacto_id = p.contacto_id and cliente_id is null;
    if exists (select 1 from negocio.pagos where org_id = p.org_id and cuenta_id = p.cuenta_id and cliente_id = v_cli_id and estado = 'pagado') then
      update negocio.clientes
         set pago_confirmado_el = (select min(pagado_el) from negocio.pagos where org_id = p.org_id and cuenta_id = p.cuenta_id
                                     and cliente_id = v_cli_id and estado = 'pagado'),
             estado = 'pago_confirmado'
       where org_id = p.org_id and cuenta_id = p.cuenta_id and id = v_cli_id;
      -- (Sin alta automática del comprador: confirmar y pagar sólo guardan la venta y el pago del lead.)
    end if;
    if coalesce(agentes._numero(c ->> 'monto_usd'), p.monto_usd) is not null then
      perform agentes._registrar_evento(p.org_id,
    p.cuenta_id,
    'venta_cerrada',
    p.contacto_id,
    'persona',
    coalesce(p_closer::text, 'closer'),
    'comando_central',
    'venta:' || v_res_id,
    jsonb_build_object('resultado_id', v_res_id, 'monto_usd', coalesce(agentes._numero(c ->> 'monto_usd'), p.monto_usd)),
    now());
    end if;
  end if;

  return jsonb_build_object('ok', true, 'estado', case when v_dif = '{}'::jsonb then 'confirmado' else 'corregido' end,
    'resultado_id', v_res_id, 'cliente_id', v_cli_id, 'diferencias', v_dif, 'alta_del_comprador_error', v_alta_error);
end $$;

create or replace function agentes.registrar_pago(
  p_location_id text, p_ghl_contact_id text, p_proveedor text, p_id_externo text, p_monto numeric, p_moneda text,
  p_estado text default 'pagado', p_pagado_el timestamptz default null, p_concepto text default null,
  p_cuota_numero integer default null, p_cuotas_total integer default null, p_monto_usd numeric default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v_org      uuid;
  v_cuenta   uuid;
  v_contacto uuid;
  v_cliente  negocio.clientes;
  v_id       uuid;
  v_alta     jsonb;
  v_final    text;
  v_sesion   text := nullif(btrim(current_setting('app.org_id', true)), '');
begin
  select c.org_id, c.id into v_org, v_cuenta from identidad.cuentas c
   where c.crm = 'ghl' and c.crm_cuenta_id = p_location_id and c.estado = 'activa';
  if v_cuenta is null then
    raise exception using errcode = 'P0002', message = format('agentes: la location de GHL «%s» no es una cuenta activa', p_location_id);
  end if;
  if v_sesion is not null and v_sesion::uuid <> v_org then
    raise exception using errcode = '42501', message = 'agentes: la sesión es de otra organización';
  end if;
  select id into v_contacto from negocio.contactos where org_id = v_org and cuenta_id = v_cuenta and ghl_contact_id = p_ghl_contact_id;
  if v_contacto is null then
    raise exception using errcode = 'P0002', message = 'agentes: el contacto todavía no está en la base';
  end if;
  if p_estado not in ('pendiente', 'pagado', 'fallido', 'reembolsado') then
    raise exception using errcode = '22023', message = 'agentes: el estado del pago es pendiente, pagado, fallido o reembolsado';
  end if;
  select * into v_cliente from negocio.clientes where org_id = v_org and cuenta_id = v_cuenta and contacto_id = v_contacto
   order by creado_el desc limit 1;

  insert into negocio.pagos (org_id, cuenta_id, contacto_id, cliente_id, proveedor, id_externo, monto, moneda, monto_usd, concepto,
                             cuota_numero, cuotas_total, estado, pagado_el)
  values (v_org, v_cuenta, v_contacto, v_cliente.id, p_proveedor, p_id_externo, p_monto, upper(p_moneda), p_monto_usd, p_concepto,
          p_cuota_numero, p_cuotas_total, p_estado, case when p_estado = 'pagado' then coalesce(p_pagado_el, now()) end)
  on conflict (org_id, cuenta_id, proveedor, id_externo) do update
     set estado = case when negocio.pagos.estado = 'reembolsado' then 'reembolsado'
                       when negocio.pagos.estado = 'pagado' and excluded.estado in ('pendiente', 'fallido') then 'pagado'
                       else excluded.estado end,
         pagado_el = coalesce(negocio.pagos.pagado_el, excluded.pagado_el),
         cliente_id = coalesce(negocio.pagos.cliente_id, excluded.cliente_id), monto_usd = coalesce(excluded.monto_usd, negocio.pagos.monto_usd)
   where negocio.pagos.contacto_id = excluded.contacto_id
  returning id, estado into v_id, v_final;
  if v_id is null then
    raise exception using errcode = '42501', message = 'agentes: ese id externo ya es de un pago de otro lead';
  end if;

  if v_final = 'pagado' then
    perform agentes._registrar_evento(v_org,
    v_cuenta,
    'pago_recibido',
    v_contacto,
    'sistema',
    'agentes.registrar_pago',
    p_proveedor,
    'pago:' || p_id_externo,
    jsonb_build_object('monto', p_monto, 'moneda', upper(p_moneda), 'pago_id', v_id,
            'cliente_id', v_cliente.id),
    coalesce(p_pagado_el, now()));
    if v_cliente.id is not null then
      update negocio.clientes set pago_confirmado_el = coalesce(pago_confirmado_el, coalesce(p_pagado_el, now())),
             estado = case when estado = 'vendido' then 'pago_confirmado' else estado end
       where org_id = v_org and cuenta_id = v_cuenta and id = v_cliente.id;
      -- (Sin alta automática del comprador.)
    end if;
  end if;
  return jsonb_build_object('ok', true, 'pago_id', v_id, 'estado', v_final, 'cliente_id', v_cliente.id, 'alta_del_comprador', v_alta,
    'aviso', case when v_cliente.id is null then 'el lead todavía no tiene una venta confirmada: el pago quedó sin cliente (agentes.confirmar_resultado)' end);
end $$;

-- ─── 12 · Lo que encontró la revisión adversaria de la 115 ───────────────────────

-- Las referencias internas entre filas del Research y del embudo, también atadas al lead (no sólo a la cuenta): un
-- dolor sólo apunta a un segmento de su lead, una cita sólo a una evidencia, un dolor y un segmento de su lead.
do $$
declare
  t text;
begin
  foreach t in array array['segmentos_del_mercado', 'dolores_del_segmento', 'fuentes_publicas'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_org_cuenta_id_contacto') then
      execute format('alter table negocio.%I add constraint %I unique (org_id, cuenta_id, id, contacto_id)', t, t || '_org_cuenta_id_contacto');
    end if;
  end loop;
end $$;
do $$
declare
  r record;
begin
  for r in select * from (values
      ('dolores_del_segmento', 'segmento_id', 'segmentos_del_mercado'),
      ('referentes_del_mercado', 'segmento_id', 'segmentos_del_mercado'),
      ('citas_del_mercado', 'segmento_id', 'segmentos_del_mercado'),
      ('citas_del_mercado', 'dolor_id', 'dolores_del_segmento'),
      ('piezas_de_contenido', 'segmento_id', 'segmentos_del_mercado'),
      ('piezas_de_contenido', 'dolor_id', 'dolores_del_segmento')) x(tabla, columna, destino) loop
    if not exists (select 1 from pg_constraint where conname = r.tabla || '_' || r.columna || '_del_mismo_lead') then
      execute format('alter table negocio.%I add constraint %I foreign key (org_id, cuenta_id, %I, contacto_id)
                        references negocio.%I (org_id, cuenta_id, id, contacto_id) on delete set null (%I)',
                     r.tabla, r.tabla || '_' || r.columna || '_del_mismo_lead', r.columna, r.destino, r.columna);
    end if;
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'citas_del_mercado_fuente_del_mismo_lead') then
    alter table negocio.citas_del_mercado add constraint citas_del_mercado_fuente_del_mismo_lead
      foreign key (org_id, cuenta_id, fuente_publica_id, contacto_id) references negocio.fuentes_publicas (org_id, cuenta_id, id, contacto_id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referentes_del_mercado_fuente_del_mismo_lead') then
    alter table negocio.referentes_del_mercado add constraint referentes_del_mercado_fuente_del_mismo_lead
      foreign key (org_id, cuenta_id, fuente_publica_id, contacto_id) references negocio.fuentes_publicas (org_id, cuenta_id, id, contacto_id)
      on delete cascade;
  end if;
end $$;

-- Las citas que usa una pieza, también del mismo lead (es una lista: lo cuida un disparador).
create or replace function negocio.las_citas_de_la_pieza_son_de_su_lead() returns trigger
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
begin
  if exists (select 1 from unnest(new.citas_usadas) c(id)
              where not exists (select 1 from negocio.citas_del_mercado m where m.org_id = new.org_id and m.cuenta_id = new.cuenta_id
                                  and m.contacto_id = new.contacto_id and m.id = c.id)) then
    raise exception using errcode = '23503', message = 'una pieza sólo usa citas del mercado de su mismo lead';
  end if;
  return new;
end $$;
drop trigger if exists piezas_citas_del_mismo_lead on negocio.piezas_de_contenido;
create trigger piezas_citas_del_mismo_lead before insert or update of citas_usadas on negocio.piezas_de_contenido
  for each row execute function negocio.las_citas_de_la_pieza_son_de_su_lead();

-- Los agentes del cliente no citan el conocimiento de la cuenta (el ICP, el script de ARIA): no lo leen y, si igual lo
-- tuvieran en lo leído, la cita no vale. Y leer_conocimiento no se los da. Además, lo que entregó la base (leido) gana
-- sobre lo que el agente puso en su entrada: su entrada sólo aporta sus propias claves (ghl:…).
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
$$;

create or replace function agentes.leer_conocimiento(p_corrida uuid, p_tipos text[] default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  r jsonb;
begin
  -- Brief, Research, Estratega y Funnel Builder trabajan sobre el negocio del lead: el conocimiento de ARIA no es suyo.
  if exists (select 1 from catalogo.agentes a where a.clave = v.agente and a.cuenta_de_trabajo = 'contacto') then
    return jsonb_build_object('conocimiento', '{}'::jsonb, 'fuentes', '{}'::jsonb, 'versiones', '{}'::jsonb, 'faltantes', '[]'::jsonb,
      'aviso', 'este agente trabaja sobre el negocio del lead: no lee el conocimiento de la cuenta');
  end if;
  r := agentes._conocimiento(v, coalesce(p_tipos, (select array_agg(clave::text order by clave) from catalogo.tipos_de_conocimiento where vigente)));
  perform agentes._anotar_lectura(v, r -> 'fuentes', r -> 'versiones');
  return r;
end $$;

-- El lead que llega después: también su evidencia y lo que el agente hizo afuera (los eventos no se editan).
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
  update negocio.triajes
     set contacto_id = new.id
   where org_id = new.org_id and cuenta_id = new.cuenta_id and ghl_contact_id = new.ghl_contact_id and contacto_id is null;
  if v_corridas is not null then
    update negocio.fuentes_publicas set contacto_id = new.id
     where org_id = new.org_id and cuenta_id = new.cuenta_id and corrida_id = any (v_corridas) and contacto_id is null;
    update negocio.acciones_externas set contacto_id = new.id
     where org_id = new.org_id and cuenta_id = new.cuenta_id and corrida_id = any (v_corridas) and contacto_id is null;
  end if;
  return null;
end $$;
grant update (contacto_id) on negocio.fuentes_publicas, negocio.acciones_externas to app_inquilino;

-- «Elegido» se calcula al leer: el segmento cuyo nombre eligió la decisión vigente del Research del mismo lead.
-- (registrar_research ya no marca los segmentos; la columna queda sin uso.)
comment on column negocio.segmentos_del_mercado.elegido is
  'Sin uso desde la 115: el segmento elegido se calcula al leer, con la decisión vigente (mr_decision) del mismo lead.';

-- Las transcripciones, atadas al lead de su llamada (antes sólo a la cuenta). Las que ya hubiera toman el contacto de
-- su llamada; desde ahora lo pone registrar_llamada y una clave foránea compuesta impide colgarla de otro lead.
alter table negocio.transcripciones add column if not exists contacto_id uuid;
update negocio.transcripciones t set contacto_id = l.contacto_id
  from negocio.llamadas l
 where l.org_id = t.org_id and l.cuenta_id = t.cuenta_id and l.id = t.llamada_id and t.contacto_id is null;
alter table negocio.transcripciones alter column contacto_id set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'llamadas_org_cuenta_id_contacto') then
    alter table negocio.llamadas add constraint llamadas_org_cuenta_id_contacto unique (org_id, cuenta_id, id, contacto_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transcripciones_del_mismo_lead') then
    alter table negocio.transcripciones add constraint transcripciones_del_mismo_lead
      foreign key (org_id, cuenta_id, llamada_id, contacto_id) references negocio.llamadas (org_id, cuenta_id, id, contacto_id)
      on delete cascade;
  end if;
end $$;
comment on column negocio.transcripciones.contacto_id is 'El lead de la llamada (115): la clave foránea compuesta lo ata al de negocio.llamadas.';

-- La versión vigente y la aprobada de un entregable son SUYAS: no se puede apuntar el entregable de un lead a la versión
-- de otro (la vista entregable_vigente además une por entregable y lead).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'versiones_de_entregable_org_cuenta_id_entregable') then
    alter table negocio.versiones_de_entregable add constraint versiones_de_entregable_org_cuenta_id_entregable
      unique (org_id, cuenta_id, id, entregable_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entregables_la_vigente_es_suya') then
    alter table negocio.entregables add constraint entregables_la_vigente_es_suya
      foreign key (org_id, cuenta_id, version_vigente_id, id) references negocio.versiones_de_entregable (org_id, cuenta_id, id, entregable_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'entregables_la_aprobada_es_suya') then
    alter table negocio.entregables add constraint entregables_la_aprobada_es_suya
      foreign key (org_id, cuenta_id, version_aprobada_id, id) references negocio.versiones_de_entregable (org_id, cuenta_id, id, entregable_id);
  end if;
end $$;

-- Una llamada, una venta: dos resultados confirmados de la misma llamada duplicarían la venta, el cliente y la comisión.
create unique index if not exists resultados_propuestos_una_venta_por_llamada
  on negocio.resultados_propuestos (org_id, cuenta_id, llamada_id)
  where estado in ('confirmado', 'corregido') and llamada_id is not null;

-- Borrar un lead borra sus corridas: guardan lo que el agente leyó y produjo sobre él (leido, salida). Desde la 110 la
-- clave las dejaba con el contacto en nulo y todo su contenido adentro.
alter table negocio.corridas_de_agente drop constraint if exists corridas_misma_cuenta_que_el_contacto;
alter table negocio.corridas_de_agente add constraint corridas_misma_cuenta_que_el_contacto
  foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade;

-- ─── 9 · El expediente del lead ──────────────────────────────────────────────────

-- Un objeto sin sus claves nulas DE PRIMER NIVEL (no toca lo de adentro de un contenido), o nulo si queda vacío.
create or replace function agentes._o(p jsonb) returns jsonb
language sql immutable security invoker set search_path = pg_catalog, pg_temp
as $$ select nullif(coalesce((select jsonb_object_agg(j.k, j.v) from jsonb_each(p) j(k, v) where j.v <> 'null'::jsonb), '{}'::jsonb), '{}'::jsonb) $$;

-- La versión vigente de un entregable de un lead, recortada para leer.
create or replace function agentes._entregable_del_lead(p_org uuid, p_cuenta uuid, p_contacto uuid, p_tipo text) returns jsonb
language sql stable security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
  select jsonb_build_object('entregable_id', ev.entregable_id, 'version', ev.numero, 'version_id', ev.version_id,
           'estado', ev.estado_de_la_version, 'aprobado', ev.estado_de_la_version = 'aprobada', 'desactualizado', ev.desactualizado,
           'autor', ev.autor_tipo, 'corrida_id', ev.corrida_id, 'creada_el', ev.creada_el, 'decidida_el', ev.decidida_el,
           'contenido', ev.contenido, 'texto', left(ev.contenido_texto, 20000),
           'texto_recortado', coalesce(length(ev.contenido_texto) > 20000, false))
    from negocio.entregable_vigente ev
   where ev.org_id = p_org and ev.cuenta_id = p_cuenta and ev.contacto_id = p_contacto and ev.tipo = p_tipo
$$;

-- El Research de un lead: sus seis entregables y las filas de sus versiones vigentes.
create or replace function agentes._research_del_lead(p_org uuid, p_cuenta uuid, p_contacto uuid) returns jsonb
language sql stable security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
  with v as (
    select ev.tipo, ev.version_id from negocio.entregable_vigente ev
     where ev.org_id = p_org and ev.cuenta_id = p_cuenta and ev.contacto_id = p_contacto
       and ev.tipo in ('mr_segmentos', 'mr_dolores', 'mr_referentes', 'mr_precio', 'mr_decision', 'prediagnostico'))
  select agentes._o(jsonb_build_object(
    'mr_segmentos', agentes._entregable_del_lead(p_org, p_cuenta, p_contacto, 'mr_segmentos'),
    'mr_dolores', agentes._entregable_del_lead(p_org, p_cuenta, p_contacto, 'mr_dolores'),
    'mr_referentes', agentes._entregable_del_lead(p_org, p_cuenta, p_contacto, 'mr_referentes'),
    'mr_precio', agentes._entregable_del_lead(p_org, p_cuenta, p_contacto, 'mr_precio'),
    'mr_decision', agentes._entregable_del_lead(p_org, p_cuenta, p_contacto, 'mr_decision'),
    'prediagnostico', agentes._entregable_del_lead(p_org, p_cuenta, p_contacto, 'prediagnostico'),
    'segmentos', (select jsonb_agg(jsonb_build_object('segmento_id', s.id, 'nombre', s.nombre, 'descripcion', s.descripcion,
                    'valor_del_cliente', s.valor_del_cliente,
                    'elegido', coalesce(lower(s.nombre) = lower((select ev.contenido ->> 'segmento_elegido' from negocio.entregable_vigente ev
                                 where ev.org_id = p_org and ev.cuenta_id = p_cuenta and ev.contacto_id = p_contacto and ev.tipo = 'mr_decision')), false)))
                    from negocio.segmentos_del_mercado s
                   where s.org_id = p_org and s.cuenta_id = p_cuenta and s.contacto_id = p_contacto
                     and s.version_id = (select version_id from v where tipo = 'mr_segmentos')),
    'dolores', (select jsonb_agg(jsonb_build_object('dolor_id', d.id, 'segmento', d.segmento_nombre, 'descripcion', d.descripcion,
                  'intensidad', d.intensidad, 'es_critico', d.es_critico, 'dolor_comun', d.dolor_comun))
                  from negocio.dolores_del_segmento d
                 where d.org_id = p_org and d.cuenta_id = p_cuenta and d.contacto_id = p_contacto
                   and d.version_id = (select version_id from v where tipo = 'mr_dolores')),
    'referentes', (select jsonb_agg(jsonb_build_object('tipo', r.tipo, 'nombre', r.nombre, 'url', r.url, 'que_ofrece', r.que_ofrece))
                     from negocio.referentes_del_mercado r
                    where r.org_id = p_org and r.cuenta_id = p_cuenta and r.contacto_id = p_contacto
                      and r.version_id = (select version_id from v where tipo = 'mr_referentes')),
    'citas_del_mercado', (select jsonb_agg(jsonb_build_object('cita_id', c.id, 'texto', c.texto, 'dolor_id', c.dolor_id,
                            'fuente', 'publica:' || c.fuente_publica_id, 'verificada', c.cita_verificada))
                            from negocio.citas_del_mercado c
                           where c.org_id = p_org and c.cuenta_id = p_cuenta and c.contacto_id = p_contacto
                             and c.version_id in (select version_id from v))))
$$;

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
       from negocio.fuentes_publicas p where p.org_id = k.org_id and p.cuenta_id = k.cuenta_id and p.contacto_id = k.id)
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
comment on view negocio.expediente_del_lead is
  'El expediente de cada lead (115): una fila por contacto y una columna jsonb por sección, con lo vigente de cada una. Una sección vacía es null; lo largo se recorta y lo dice. Sin teléfono ni correo. Se lee siempre filtrando por contacto_id.';
revoke all on negocio.expediente_del_lead from public, app_inquilino;
grant select on negocio.expediente_del_lead to app_inquilino, agente_mcp;

-- Las secciones pedidas del expediente del lead de una corrida (todas, si no se piden).
create or replace function agentes.expediente(p_corrida uuid, p_secciones text[] default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v negocio.corridas_de_agente := agentes._corrida(p_corrida, false);
  x jsonb;
begin
  if v.contacto_id is null then
    return jsonb_build_object('corrida_id', v.id, 'contacto_en_la_base', false);
  end if;
  select to_jsonb(ex) - 'org_id' - 'cuenta_id' into x from negocio.expediente_del_lead ex
   where ex.org_id = v.org_id and ex.cuenta_id = v.cuenta_id and ex.contacto_id = v.contacto_id;
  if p_secciones is not null then
    select coalesce(jsonb_object_agg(j.key, j.value), '{}'::jsonb) into x from jsonb_each(x) j
     where j.key = any (p_secciones || array['contacto_id', 'ghl_contact_id']);
  end if;
  return x;
end $$;

-- ─── 10 · Identificar al lead a mano, por su correo ──────────────────────────────
-- Para una prueba a mano (sin workflow): con una coincidencia, el agente sigue con su ghl_contact_id y abre la corrida
-- con identificado_por = 'correo'; con ninguna se detiene; con varias, muestra la lista y pide elegir. Nunca crea
-- contactos.
create or replace function agentes.buscar_contacto(p_location_id text, p_correo text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, pg_temp
as $$
declare
  v_org    uuid;
  v_cuenta uuid;
  v_sesion text := nullif(btrim(current_setting('app.org_id', true)), '');
  v_lista  jsonb;
  n        integer;
begin
  if coalesce(btrim(p_correo), '') = '' or position('@' in p_correo) = 0 then
    raise exception using errcode = '22023', message = 'agentes: hace falta el correo del lead';
  end if;
  select c.org_id, c.id into v_org, v_cuenta from identidad.cuentas c
   where c.crm = 'ghl' and c.crm_cuenta_id = p_location_id and c.estado = 'activa';
  if v_cuenta is null then
    raise exception using errcode = 'P0002', message = format('agentes: la location de GHL «%s» no es una cuenta activa', p_location_id);
  end if;
  if v_sesion is not null and v_sesion::uuid <> v_org then
    raise exception using errcode = '42501', message = 'agentes: la sesión es de otra organización';
  end if;
  select count(*) into n from negocio.contactos k
   where k.org_id = v_org and k.cuenta_id = v_cuenta and lower(btrim(k.email)) = lower(btrim(p_correo));
  select jsonb_agg(jsonb_build_object('ghl_contact_id', x.ghl_contact_id, 'contacto_id', x.id, 'nombre', x.nombre,
           'alta_en_el_crm', x.alta_en_el_crm))
    into v_lista
    from (select k.* from negocio.contactos k
           where k.org_id = v_org and k.cuenta_id = v_cuenta and lower(btrim(k.email)) = lower(btrim(p_correo))
           order by k.alta_en_el_crm desc nulls last limit 10) x;
  return jsonb_build_object('coincidencias', n, 'contactos', coalesce(v_lista, '[]'::jsonb),
    'siguiente', case when n = 1 then 'abre la corrida con ese ghl_contact_id y identificado_por = correo'
                      when n = 0 then 'no hay ningún lead con ese correo en la cuenta: detente y pregunta'
                      else 'hay varios: muestra la lista y pide elegir uno' end);
end $$;

-- ─── 11 · Permisos ───────────────────────────────────────────────────────────────
-- El rol de los agentes ya no ejecuta lo que cambia el conocimiento de la cuenta (cargar_conocimiento, cargar_rutas)
-- ni lo que crea cuentas (alta_del_comprador): eso lo hace una persona.
do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as firma, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'agentes' loop
    execute format('revoke all on function %s from public', f.firma);
    execute format('grant execute on function %s to app_inquilino', f.firma);
    if f.proname in ('cargar_conocimiento', 'cargar_rutas', 'alta_del_comprador') then
      execute format('revoke execute on function %s from agente_mcp', f.firma);
    else
      execute format('grant execute on function %s to agente_mcp', f.firma);
    end if;
  end loop;
end $$;
