-- 113 · Los entregables del cliente que compró (versionados, aprobables, con desactualización en cascada) y el Brief de
-- onboarding: prellenado por el Brief Agent, confirmado y enviado por el cliente.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (docs/_privado/modelo-de-datos/27-MANAGED-AGENTS.md § Entregables y § Brief)
--
-- UN SOLO MOLDE PARA LOS DOCUMENTOS DEL CLIENTE. El Brief, los cinco pasos del Research y el prediagnóstico, las tres
-- etapas del Estratega y las tres piezas del Funnel Builder son documentos que se versionan, se aprueban y se consumen
-- entre agentes. Tienen la misma forma: negocio.entregables (uno por cuenta y tipo, con su estado) y
-- negocio.versiones_de_entregable (de sólo agregar: cada propuesta del agente, cada corrección de una persona o del
-- cliente es una versión nueva; lo propuesto nunca se pisa, y la diferencia con lo aprobado es lo que mejora la skill).
-- Viven en la cuenta del COMPRADOR (la 112). El contenido va en jsonb con la forma de su tipo, y el documento en
-- markdown (contenido_texto): un pdf o un archivo se guarda convertido a md.
--
-- LA CASCADA. Cada versión dice qué versión de cada entregable consumió (fuentes). Si se aprueba una versión nueva del
-- ICP, lo que se hizo con el ICP anterior (la oferta, el precio, el VSL) pasa a «desactualizado». Es la regla del hub
-- de Fundaciones («tu Oferta se generó con un ICP que ya cambiaste»), pero en la base, no en la pantalla.
--
-- EL BRIEF, PREGUNTA POR PREGUNTA. negocio.respuestas_del_brief (de sólo agregar, como respuestas_del_lead) guarda cada
-- campo con su estado (prellenado detectado o inferido, vacío, confirmado, corregido, completado), su fuente y cómo se
-- le explica al cliente de dónde salió. Cuando el cliente lo envía, las respuestas que equivalen a preguntas estándar
-- vuelven a respuestas_del_lead del lead en la cuenta del vendedor (vía «brief»), y la pregunta 9 fija a quién vende.
-- catalogo.preguntas_del_brief nace VACÍO: la lista de preguntas la pasa el equipo (P-26); mientras tanto el Brief
-- acepta claves libres con la versión «libre».
--
-- Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · Los tipos de entregable ─────────────────────────────────────────────────

create table if not exists catalogo.tipos_de_entregable (
  clave        catalogo.clave primary key,
  nombre       text not null,
  agente       catalogo.clave not null references catalogo.agentes (clave),
  orden        smallint not null,
  depende_de   text[] not null default '{}',
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.tipos_de_entregable is
  'Los documentos que los agentes producen para un cliente (113). depende_de son los tipos que consume: si cambia la versión aprobada de uno, éste queda desactualizado. Uno nuevo es un INSERT.';
insert into catalogo.tipos_de_entregable (clave, nombre, agente, orden, depende_de, descripcion) values
  ('brief', 'Brief', 'brief', 1, '{}', 'El formulario de onboarding: sección 1 (tu negocio) y sección 2 (tu mercado, para negocios o para consumidores).'),
  ('mr_segmentos', 'Research · Segmentos', 'research', 2, '{brief}', 'Paso 1: 3 o 4 segmentos del nicho que cumplen los criterios de compradores, valor y contrato inicial.'),
  ('mr_dolores', 'Research · Dolores', 'research', 3, '{brief,mr_segmentos}', 'Paso 2: los dolores de cada segmento en el recorrido de su cliente, y el crítico.'),
  ('mr_referentes', 'Research · Referentes', 'research', 4, '{mr_segmentos,mr_dolores}', 'Paso 3: quiénes ya resolvieron ese dolor y qué proveedores le venden al nicho.'),
  ('mr_precio', 'Research · Precio', 'research', 5, '{mr_segmentos,mr_dolores,mr_referentes}', 'Paso 4: el modelo de precio por segmento y el valor anual que genera el sistema.'),
  ('mr_decision', 'Research · Decisión', 'research', 6, '{mr_segmentos,mr_dolores,mr_referentes,mr_precio}', 'Paso 5: el segmento más rentable, la tabla comparativa y el documento final.'),
  ('prediagnostico', 'Prediagnóstico', 'research', 7, '{brief,mr_decision}', 'Un texto corto para el coach: situación, riesgos y qué decidir en la Kickoff.'),
  ('icp', 'ICP', 'estratega', 8, '{brief,mr_decision}', 'Etapa 1: el cliente ideal, a quién sí y a quién no, con criterios que usan los demás agentes.'),
  ('categoria_y_oferta', 'Categoría y oferta', 'estratega', 9, '{icp}', 'Etapa 2: el nombre de la categoría, el mecanismo único y la oferta high ticket.'),
  ('precio_y_process_map', 'Precio y Process Map', 'estratega', 10, '{icp,categoria_y_oferta}', 'Etapa 3: precio y garantía, el diagnóstico y el método en fases.'),
  ('guion_vsl', 'Guion del VSL', 'funnel_builder', 11, '{icp,categoria_y_oferta,precio_y_process_map}', 'El guion del video de ventas, con indicaciones para grabarlo o producirlo con IA.'),
  ('anuncios', 'Anuncios', 'funnel_builder', 12, '{icp,categoria_y_oferta,precio_y_process_map}', 'Guiones y textos de los anuncios, en varias versiones para probar.'),
  ('prompt_landing', 'Prompt de la landing', 'funnel_builder', 13, '{icp,categoria_y_oferta,precio_y_process_map}', 'El prompt de la landing para AI Studio, con el custom code incluido.')
on conflict do nothing;

-- ─── 2 · Los entregables y sus versiones ─────────────────────────────────────────

create table if not exists negocio.entregables (
  org_id               uuid not null references identidad.organizaciones (id),
  cuenta_id            uuid not null,
  id                   uuid not null default gen_random_uuid(),
  tipo                 catalogo.clave not null references catalogo.tipos_de_entregable (clave),
  cliente_id           uuid,
  estado               text not null default 'vacio'
                         check (estado in ('vacio', 'propuesto', 'en_revision', 'aprobado', 'desactualizado')),
  version_vigente_id   uuid,
  version_aprobada_id  uuid,
  creado_el            timestamptz not null default now(),
  actualizado_el       timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, cuenta_id, id),
  unique (org_id, cuenta_id, tipo),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id)
);
comment on table negocio.entregables is
  'Un documento del cliente por tipo (113), en la cuenta del COMPRADOR: el Brief, cada paso del Research, cada etapa del Estratega, cada pieza del Funnel Builder. La vigente es la última aprobada, o la última propuesta si no hay aprobada.';
comment on column negocio.entregables.cliente_id is 'El registro de la venta (negocio.clientes, en la cuenta del vendedor). Referencia blanda: otra organización.';
comment on column negocio.entregables.estado is 'vacio, propuesto (el agente entregó), en_revision (alguien lo rechazó y se rehace), aprobado, desactualizado (cambió algo de lo que dependía).';
select negocio.aplicar_aislamiento_de_cuenta('negocio.entregables', true);
revoke delete, truncate on negocio.entregables from app_inquilino;
grant select, insert on negocio.entregables to agente_mcp;
grant update (estado, version_vigente_id, version_aprobada_id, actualizado_el) on negocio.entregables to agente_mcp;

create table if not exists negocio.versiones_de_entregable (
  org_id            uuid not null references identidad.organizaciones (id),
  cuenta_id         uuid not null,
  id                uuid not null default gen_random_uuid(),
  entregable_id     uuid not null,
  numero            integer not null check (numero >= 1),
  autor_tipo        text not null check (autor_tipo in ('agente_ia', 'persona', 'cliente')),
  corrida_id        uuid,
  autor_usuario_id  uuid,
  contenido         jsonb not null default '{}'::jsonb,
  contenido_texto   text check (contenido_texto is null or length(contenido_texto) <= 400000),
  fuentes           jsonb not null default '{}'::jsonb,
  estado            text not null default 'propuesta' check (estado in ('propuesta', 'aprobada', 'rechazada', 'corregida')),
  decidida_por      uuid,
  decidida_el       timestamptz,
  motivo            text check (motivo is null or length(motivo) <= 4000),
  creada_el         timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, cuenta_id, entregable_id, numero),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint versiones_misma_cuenta_que_el_entregable
    foreign key (org_id, cuenta_id, entregable_id) references negocio.entregables (org_id, cuenta_id, id) on delete cascade,
  constraint versiones_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete set null (corrida_id),
  check (jsonb_typeof(contenido) in ('object', 'array') and jsonb_typeof(fuentes) = 'object'),
  check ((autor_tipo = 'agente_ia') = (corrida_id is not null) or corrida_id is null)
);
comment on table negocio.versiones_de_entregable is
  'Cada versión de un entregable (113), de sólo agregar salvo su decisión: la que propuso el agente, la que corrigió el coach o el cliente. Lo propuesto nunca se pisa.';
comment on column negocio.versiones_de_entregable.fuentes is 'Qué versión de cada entregable consumió: {"icp": "{version_id}", "brief": "{version_id}"}. De esto sale la desactualización en cascada.';
comment on column negocio.versiones_de_entregable.decidida_por is 'Quién decidió: un usuario de la cuenta del cliente o de la organización que le vendió (el coach de ARIA). Referencia blanda: puede ser de otra organización.';
comment on column negocio.versiones_de_entregable.estado is 'propuesta, aprobada, rechazada, o corregida (alguien escribió una versión nueva encima de ésta).';
select negocio.aplicar_aislamiento_de_cuenta('negocio.versiones_de_entregable', true);
revoke update, delete, truncate on negocio.versiones_de_entregable from app_inquilino;
grant update (estado, decidida_por, decidida_el, motivo) on negocio.versiones_de_entregable to app_inquilino;
grant select, insert on negocio.versiones_de_entregable to agente_mcp;
grant update (estado, decidida_por, decidida_el, motivo) on negocio.versiones_de_entregable to agente_mcp;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'negocio.versiones_de_entregable'::regclass and conname = 'versiones_org_cuenta_id') then
    alter table negocio.versiones_de_entregable add constraint versiones_org_cuenta_id unique (org_id, cuenta_id, id);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conocimiento_viene_de_una_version') then
    alter table negocio.conocimiento_de_la_cuenta add constraint conocimiento_viene_de_una_version
      foreign key (org_id, cuenta_id, entregable_version_id) references negocio.versiones_de_entregable (org_id, cuenta_id, id);
  end if;
end $$;

create or replace view negocio.entregable_vigente with (security_invoker = true) as
  select e.org_id, e.cuenta_id, e.id as entregable_id, e.tipo, e.cliente_id, e.estado,
         v.id as version_id, v.numero, v.estado as estado_de_la_version, v.autor_tipo, v.contenido, v.contenido_texto,
         v.fuentes, v.creada_el, v.decidida_el
    from negocio.entregables e
    join negocio.versiones_de_entregable v on v.org_id = e.org_id and v.cuenta_id = e.cuenta_id
                                          and v.id = coalesce(e.version_aprobada_id, e.version_vigente_id);
comment on view negocio.entregable_vigente is 'La versión que hoy vale de cada entregable (113): la aprobada, o la última propuesta si no hay aprobada.';
revoke all on negocio.entregable_vigente from public, app_inquilino;
grant select on negocio.entregable_vigente to app_inquilino, agente_mcp;

-- ─── 3 · Las preguntas y las respuestas del Brief ────────────────────────────────

create table if not exists catalogo.preguntas_del_brief (
  version_del_brief  text not null check (version_del_brief ~ '^[a-z0-9][a-z0-9_.-]{0,29}$'),
  clave              catalogo.clave not null,
  numero             smallint not null check (numero >= 1),
  seccion            smallint not null check (seccion in (1, 2)),
  variante           text not null default 'comun' check (variante in ('comun', 'negocios', 'consumidores')),
  texto              text not null,
  tipo_de_valor      text not null default 'texto' check (tipo_de_valor in ('texto', 'numero', 'moneda', 'opcion', 'opciones', 'url', 'fecha', 'booleano')),
  opciones           jsonb,
  obligatoria        boolean not null default true,
  prellenable        boolean not null default true,
  pregunta_estandar  catalogo.clave references catalogo.preguntas_estandar (clave),
  decide_la_variante boolean not null default false,
  vigente            boolean not null default true,
  primary key (version_del_brief, clave)
);
comment on table catalogo.preguntas_del_brief is
  'El formulario de onboarding (113), versionado: sección 1 (tu negocio) y sección 2 (tu mercado) en dos variantes, negocios o consumidores. La pregunta con decide_la_variante (la 9) elige la sección 2. Nace vacío: lo carga el equipo.';
comment on column catalogo.preguntas_del_brief.pregunta_estandar is 'Si equivale a una pregunta estándar (facturación, ticket, clientes activos): la respuesta confirmada vuelve a respuestas_del_lead y no se pregunta dos veces.';

create table if not exists negocio.respuestas_del_brief (
  org_id               uuid not null references identidad.organizaciones (id),
  cuenta_id            uuid not null,
  id                   uuid not null default gen_random_uuid(),
  entregable_id        uuid not null,
  version_del_brief    text not null,
  pregunta             text not null check (length(pregunta) between 1 and 100),
  valor_texto          text check (valor_texto is null or length(valor_texto) <= 20000),
  valor_json           jsonb,
  estado               text not null check (estado in ('prellenado_detectado', 'prellenado_inferido', 'vacio', 'confirmado', 'corregido', 'completado')),
  autor_tipo           text not null check (autor_tipo in ('agente_ia', 'cliente', 'persona')),
  fuente               text check (fuente is null or length(fuente) <= 300),
  cita                 text check (cita is null or length(cita) <= 2000),
  confianza            text check (confianza in ('alta', 'media', 'baja')),
  texto_para_el_cliente text check (texto_para_el_cliente is null or length(texto_para_el_cliente) <= 500),
  degradado            boolean not null default false,
  corrida_id           uuid,
  autor_usuario_id     uuid,
  reemplaza_a          uuid,
  -- El reloj de pared, no el de la transacción: el prellenado y la respuesta del cliente pueden caer en la misma, y
  -- la vigente es la última.
  registrada_el        timestamptz not null default clock_timestamp(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint respuestas_brief_misma_cuenta_que_el_entregable
    foreign key (org_id, cuenta_id, entregable_id) references negocio.entregables (org_id, cuenta_id, id) on delete cascade,
  constraint respuestas_brief_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete set null (corrida_id)
);
create index if not exists respuestas_del_brief_por_pregunta on negocio.respuestas_del_brief (org_id, cuenta_id, entregable_id, pregunta, registrada_el desc);
comment on table negocio.respuestas_del_brief is
  'Cada respuesta del Brief (113), de sólo agregar: el prellenado del agente (con fuente, cita y confianza) y cada confirmación o corrección del cliente. La vigente es la última por pregunta (vista brief_vigente). Lo que el cliente dijo manda.';
comment on column negocio.respuestas_del_brief.autor_usuario_id is 'Quién respondió: un usuario de la cuenta del cliente o de la organización que le vendió, que carga por él. Referencia blanda: puede ser de otra organización.';
comment on column negocio.respuestas_del_brief.texto_para_el_cliente is 'Cómo se le explica al cliente de dónde salió: «Lo tomamos de tu llamada de venta».';
select negocio.aplicar_aislamiento_de_cuenta('negocio.respuestas_del_brief', true);
revoke update, delete, truncate on negocio.respuestas_del_brief from app_inquilino;
grant select, insert on negocio.respuestas_del_brief to agente_mcp;

create or replace view negocio.brief_vigente with (security_invoker = true) as
  select distinct on (r.org_id, r.cuenta_id, r.entregable_id, r.pregunta)
         r.org_id, r.cuenta_id, r.entregable_id, r.pregunta, r.version_del_brief, r.valor_texto, r.valor_json, r.estado,
         r.autor_tipo, r.fuente, r.cita, r.confianza, r.texto_para_el_cliente, r.registrada_el, r.id as respuesta_id
    from negocio.respuestas_del_brief r
   order by r.org_id, r.cuenta_id, r.entregable_id, r.pregunta, r.registrada_el desc, r.id;
comment on view negocio.brief_vigente is 'El último valor de cada pregunta del Brief de cada cliente (113): lo que muestra el formulario y lee el Research.';
revoke all on negocio.brief_vigente from public, app_inquilino;
grant select on negocio.brief_vigente to app_inquilino, agente_mcp;

-- ─── 4 · Las piezas internas de los entregables ──────────────────────────────────

-- El entregable de un tipo en la cuenta de la corrida (lo crea si no existe).
create or replace function agentes._entregable(p_corrida negocio.corridas_de_agente, p_tipo text) returns negocio.entregables
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  e negocio.entregables;
begin
  insert into negocio.entregables (org_id, cuenta_id, tipo, cliente_id)
  values (p_corrida.org_id, p_corrida.cuenta_id, p_tipo, p_corrida.cliente_id)
  on conflict (org_id, cuenta_id, tipo) do nothing;
  select * into e from negocio.entregables where org_id = p_corrida.org_id and cuenta_id = p_corrida.cuenta_id and tipo = p_tipo;
  return e;
end $$;

-- Las versiones vigentes de los tipos pedidos en una cuenta, como fuentes citables «{tipo}@v{n}» y como
-- {tipo: version_id} para las fuentes de la versión nueva.
create or replace function agentes._entregables_vigentes(p_org uuid, p_cuenta uuid, p_tipos text[]) returns jsonb
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
    select * into r from negocio.entregable_vigente ev where ev.org_id = p_org and ev.cuenta_id = p_cuenta and ev.tipo = t;
    if r.version_id is null then
      v_falta := v_falta || to_jsonb('entregable:' || t);
      continue;
    end if;
    v_doc := v_doc || jsonb_build_object(t, jsonb_build_object('version', r.numero, 'version_id', r.version_id,
               'estado', r.estado_de_la_version, 'aprobado', r.estado_de_la_version = 'aprobada',
               'contenido', r.contenido, 'texto', r.contenido_texto, 'fuente', format('%s@v%s', t, r.numero)));
    v_fuentes := v_fuentes || jsonb_build_object(format('%s@v%s', t, r.numero), coalesce(r.contenido_texto, r.contenido::text));
    v_ids := v_ids || jsonb_build_object(t, r.version_id);
  end loop;
  return jsonb_build_object('entregables', v_doc, 'fuentes', v_fuentes, 'ids', v_ids, 'faltantes', v_falta);
end $$;

-- Propone una versión nueva de un entregable: numero + 1, autor agente_ia, estado propuesta.
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
  insert into negocio.versiones_de_entregable (org_id, cuenta_id, id, entregable_id, numero, autor_tipo, corrida_id, contenido,
                                               contenido_texto, fuentes)
  values (e.org_id, e.cuenta_id, v_id, e.id, v_num, 'agente_ia', p_corrida.id, coalesce(p_contenido, '{}'::jsonb), p_texto,
          coalesce(p_fuentes, '{}'::jsonb));
  update negocio.entregables
     set version_vigente_id = v_id, actualizado_el = now(),
         estado = case when estado = 'aprobado' then 'aprobado' else 'propuesto' end
   where org_id = e.org_id and cuenta_id = e.cuenta_id and id = e.id;
  perform agentes._evento(p_corrida, 'entregable_propuesto',
    jsonb_build_object('entregable_id', e.id, 'tipo', p_tipo, 'version', v_num, 'version_id', v_id), null, p_tipo || ':' || v_num);
  return v_id;
end $$;

-- Al corregir una versión, sus filas pasan a la nueva. Acá no hay filas; la 114 la rehace (segmentos, dolores…).
create or replace function agentes._al_corregir(p_entregable negocio.entregables, p_vieja uuid, p_nueva uuid) returns void
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$ begin null; end $$;

-- Lo que pasa al aprobarse una versión, según su tipo. La 114 la rehace para publicar el ICP como conocimiento.
create or replace function agentes._al_aprobar(p_entregable negocio.entregables, p_version negocio.versiones_de_entregable,
  p_usuario uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
begin
  if p_entregable.tipo = 'brief' then
    return agentes._al_enviar_el_brief(p_entregable, p_version);
  end if;
  return '{}'::jsonb;
end $$;

-- La cascada: lo que consumió OTRA versión de este tipo queda desactualizado, y también todo lo que depende de eso,
-- de forma transitiva (el cierre de depende_de, calculado una vez y sin repetir tipos). Un solo update y un evento por
-- entregable, con un id externo fijo (entregable + versión que lo causó): repetir la decisión no duplica nada.
create or replace function agentes._desactualizar(p_entregable negocio.entregables, p_version_id uuid) returns integer
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    with recursive directos as (
      -- Los que consumieron otra versión de este tipo.
      select e.tipo from negocio.entregables e
        join catalogo.tipos_de_entregable t on t.clave = e.tipo
        join negocio.versiones_de_entregable v on v.org_id = e.org_id and v.cuenta_id = e.cuenta_id
                                             and v.id = coalesce(e.version_aprobada_id, e.version_vigente_id)
       where e.org_id = p_entregable.org_id and e.cuenta_id = p_entregable.cuenta_id and e.id <> p_entregable.id
         and p_entregable.tipo = any (t.depende_de)
         and v.fuentes ? p_entregable.tipo and (v.fuentes ->> p_entregable.tipo) is distinct from p_version_id::text
    ), cierre(tipo) as (
      select tipo::text from directos
      union
      select t.clave::text from catalogo.tipos_de_entregable t join cierre c on c.tipo = any (t.depende_de)
    )
    update negocio.entregables e set estado = 'desactualizado', actualizado_el = now()
     where e.org_id = p_entregable.org_id and e.cuenta_id = p_entregable.cuenta_id and e.id <> p_entregable.id
       and e.tipo in (select tipo from cierre) and e.estado not in ('desactualizado', 'vacio')
    returning e.id, e.tipo
  loop
    perform agentes._registrar_evento(p_entregable.org_id, p_entregable.cuenta_id, 'entregable_desactualizado', null, 'sistema',
      'agentes._desactualizar', 'comando_central', 'desactualizado:' || r.id || ':' || p_version_id,
      jsonb_build_object('entregable_id', r.id, 'tipo', r.tipo, 'por', p_entregable.tipo), now());
    n := n + 1;
  end loop;
  return n;
end $$;

-- ─── 5 · Decidir una versión: aprobarla, rechazarla o corregirla ─────────────────
-- La llama quien aprueba (el coach, el cliente) desde CC, Slack o GHL. 'corregida' escribe una versión nueva con
-- p_contenido / p_texto (autor persona o cliente), aprobada, y marca la anterior como corregida.
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
  if p_usuario is null or not exists (
       select 1 from identidad.usuarios u
        where u.id = p_usuario
          and (u.org_id = e.org_id
               or u.org_id in (select k.org_id from negocio.clientes k where k.cuenta_cliente_id = e.cuenta_id))) then
    raise exception using errcode = '22023',
      message = 'agentes: decidir una versión lo hace una persona (un usuario del cliente o de quien le vendió), no el agente';
  end if;
  -- Quién es lo dice su organización, no quien llama: de la cuenta del cliente, «cliente»; de quien le vendió, «persona».
  p_autor_tipo := case when exists (select 1 from identidad.usuarios u where u.id = p_usuario and u.org_id = e.org_id
                                     and not exists (select 1 from negocio.clientes k where k.cuenta_cliente_id = e.cuenta_id and k.org_id = e.org_id))
                       then 'cliente' else 'persona' end;

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
    insert into negocio.versiones_de_entregable (org_id, cuenta_id, id, entregable_id, numero, autor_tipo, autor_usuario_id,
      contenido, contenido_texto, fuentes, estado, decidida_por, decidida_el, motivo)
    values (e.org_id, e.cuenta_id, v_nueva, e.id, v_num, p_autor_tipo, p_usuario, coalesce(p_contenido, ver.contenido),
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
    null,
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

-- ─── 6 · Brief: leer ─────────────────────────────────────────────────────────────
-- Lee lo del lead en la cuenta del VENDEDOR (la ficha, el resultado confirmado, la llamada de venta, las respuestas, la
-- evidencia pública) y lo del cliente en la suya. La corrida guarda las dos cuentas: el aislamiento lo hace el filtro
-- explícito por cada una.
create or replace function agentes.leer_brief(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v         negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  vo        uuid := v.vendedor_org_id;
  vc        uuid := v.vendedor_cuenta_id;
  vk        uuid := v.vendedor_contacto_id;
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
    into v_actual from negocio.brief_vigente b where b.org_id = v.org_id and b.cuenta_id = v.cuenta_id and b.entregable_id = e.id;

  perform agentes._anotar_lectura(v, v_fuentes);
  return jsonb_build_object('corrida_id', v.id, 'agente', 'brief', 'version_del_brief', v_version, 'preguntas', v_preg,
    'ya_respondido', v_actual, 'fuentes', v_fuentes, 'faltantes', v_falta,
    'contrato', 'agentes.registrar_brief(corrida_id, {respuestas[{pregunta, estado: detectado|inferido|vacio, valor, fuente, cita, confianza, texto_para_el_cliente}], a_quien_vende: negocios|consumidores|null}). Lo que el cliente ya confirmó no se vuelve a prellenar.');
end $$;

-- ─── 7 · Brief: registrar el prellenado ──────────────────────────────────────────

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
    if exists (select 1 from negocio.brief_vigente b where b.org_id = e.org_id and b.cuenta_id = e.cuenta_id
                and b.entregable_id = e.id and b.pregunta = v_val ->> 'campo' and b.autor_tipo <> 'agente_ia') then
      v_omit := v_omit + 1;
      continue;
    end if;
    v_estado := case v_val ->> 'estado' when 'detectado' then 'prellenado_detectado' when 'no_consta' then 'vacio'
                                        else 'prellenado_inferido' end;
    if v_estado = 'vacio' then v_vacios := v_vacios + 1; else v_prel := v_prel + 1; end if;
    insert into negocio.respuestas_del_brief (org_id, cuenta_id, entregable_id, version_del_brief, pregunta, valor_texto, valor_json,
      estado, autor_tipo, fuente, cita, confianza, texto_para_el_cliente, degradado, corrida_id)
    values (e.org_id, e.cuenta_id, e.id, v_version, v_val ->> 'campo',
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
    'siguiente', 'el cliente confirma, corrige y envía con agentes.responder_brief(cuenta_id_del_cliente, respuestas, enviar => true)');
end $$;

-- ─── 8 · El cliente responde y envía el Brief ────────────────────────────────────
-- La llama el formulario donde el cliente ve su Brief (en CC, en GHL o en el de Walter). p_respuestas:
-- [{pregunta, valor}] — el estado lo pone la base: confirmado si coincide con el prellenado, corregido si lo cambió,
-- completado si no había nada. Con p_enviar, el Brief queda aprobado por el cliente: dispara el Research.
create or replace function agentes.responder_brief(p_cuenta_cliente uuid, p_respuestas jsonb, p_enviar boolean default false,
  p_usuario uuid default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v_org     uuid;
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
  select org_id into v_org from identidad.cuentas where id = p_cuenta_cliente;
  if v_org is null then raise exception using errcode = 'P0002', message = 'agentes: la cuenta no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> v_org then
    raise exception using errcode = '42501', message = 'agentes: la cuenta es de otra organización que la de la sesión';
  end if;
  -- Sólo la cuenta de un cliente que compró tiene Brief.
  if not exists (select 1 from negocio.clientes k where k.cuenta_cliente_id = p_cuenta_cliente) then
    raise exception using errcode = 'P0002', message = 'agentes: esa cuenta no es la de un cliente que compró';
  end if;
  insert into negocio.entregables (org_id, cuenta_id, tipo, cliente_id)
  values (v_org, p_cuenta_cliente, 'brief', (select id from negocio.clientes where cuenta_cliente_id = p_cuenta_cliente order by creado_el desc limit 1))
  on conflict (org_id, cuenta_id, tipo) do nothing;
  select * into e from negocio.entregables where org_id = v_org and cuenta_id = p_cuenta_cliente and tipo = 'brief';
  -- Dos envíos a la vez se esperan; el segundo relee el entregable y ve la versión que dejó el primero.
  perform pg_advisory_xact_lock(hashtextextended('entregable:' || e.id, 0));
  select * into e from negocio.entregables where org_id = v_org and cuenta_id = p_cuenta_cliente and id = e.id;
  select coalesce(max(version_del_brief), 'libre') into v_version from catalogo.preguntas_del_brief where vigente;

  for r in select value from jsonb_array_elements(coalesce(p_respuestas, '[]'::jsonb)) loop
    if coalesce(btrim(r ->> 'pregunta'), '') = '' then continue; end if;
    select * into b from negocio.brief_vigente where org_id = v_org and cuenta_id = p_cuenta_cliente and entregable_id = e.id
       and pregunta = r ->> 'pregunta';
    v_valor_t := case when jsonb_typeof(r -> 'valor') = 'string' then r ->> 'valor' end;
    -- Lo mismo que el cliente ya dijo no es otra respuesta (un formulario reenvía todo).
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
    insert into negocio.respuestas_del_brief (org_id, cuenta_id, entregable_id, version_del_brief, pregunta, valor_texto, valor_json,
      estado, autor_tipo, autor_usuario_id, reemplaza_a)
    values (v_org, p_cuenta_cliente, e.id, v_version, r ->> 'pregunta', left(v_valor_t, 20000),
      case when jsonb_typeof(r -> 'valor') not in ('string', 'null') then r -> 'valor' end, v_estado, 'cliente', p_usuario, b.respuesta_id);
    n := n + 1;
  end loop;

  if not p_enviar then
    return jsonb_build_object('ok', true, 'entregable_id', e.id, 'guardadas', n, 'enviado', false);
  end if;

  -- Enviar lo hace una persona: el cliente (un usuario de su cuenta) o alguien de la empresa que le vendió, por él. Y el
  -- cliente tiene que haber respondido algo: el prellenado del agente solo no es un Brief enviado.
  if p_usuario is null or not exists (
       select 1 from identidad.usuarios u where u.id = p_usuario
          and (u.org_id = v_org or u.org_id in (select k.org_id from negocio.clientes k where k.cuenta_cliente_id = p_cuenta_cliente))) then
    raise exception using errcode = '22023', message = 'agentes: enviar el Brief lo hace una persona (del cliente o de quien le vendió)';
  end if;
  if not exists (select 1 from negocio.brief_vigente bv where bv.org_id = v_org and bv.cuenta_id = p_cuenta_cliente
                  and bv.entregable_id = e.id and bv.autor_tipo = 'cliente' and bv.estado <> 'vacio') then
    return jsonb_build_object('ok', false, 'entregable_id', e.id, 'errores', jsonb_build_array('el cliente no respondió ni confirmó ninguna pregunta'));
  end if;

  -- Las obligatorias tienen que tener valor (si el catálogo tiene la lista).
  select coalesce(jsonb_agg(q.clave), '[]'::jsonb) into v_falta from catalogo.preguntas_del_brief q
   where q.version_del_brief = v_version and q.vigente and q.obligatoria and q.variante = 'comun'
     and not exists (select 1 from negocio.brief_vigente bv where bv.org_id = v_org and bv.cuenta_id = p_cuenta_cliente
                      and bv.entregable_id = e.id and bv.pregunta = q.clave and bv.estado <> 'vacio');
  if jsonb_array_length(v_falta) > 0 then
    return jsonb_build_object('ok', false, 'entregable_id', e.id, 'guardadas', n, 'errores', jsonb_build_array('faltan obligatorias'),
      'faltan', v_falta);
  end if;

  select coalesce(jsonb_object_agg(bv.pregunta, jsonb_build_object('valor', coalesce(bv.valor_json, to_jsonb(bv.valor_texto)),
           'estado', bv.estado, 'autor', bv.autor_tipo, 'fuente', bv.fuente)), '{}'::jsonb)
    into v_cont from negocio.brief_vigente bv where bv.org_id = v_org and bv.cuenta_id = p_cuenta_cliente and bv.entregable_id = e.id;
  -- Un reenvío sin cambios no es otra versión, ni vuelve a disparar el Research. Se comparan sólo los VALORES de cada
  -- pregunta (el estado y el autor cambian sin que cambie lo que el cliente dijo).
  if e.estado = 'aprobado' and exists (
       select 1 from negocio.versiones_de_entregable pv where pv.org_id = v_org and pv.cuenta_id = p_cuenta_cliente
          and pv.id = e.version_aprobada_id and jsonb_typeof(pv.contenido -> 'respuestas') = 'object'
          and (select coalesce(jsonb_object_agg(k, x -> 'valor'), '{}'::jsonb) from jsonb_each(pv.contenido -> 'respuestas') j(k, x))
            = (select coalesce(jsonb_object_agg(k, x -> 'valor'), '{}'::jsonb) from jsonb_each(v_cont) j(k, x))) then
    return jsonb_build_object('ok', true, 'entregable_id', e.id, 'guardadas', n, 'enviado', true, 'sin_cambios', true,
      'version_id', e.version_aprobada_id);
  end if;
  insert into negocio.versiones_de_entregable (org_id, cuenta_id, entregable_id, numero, autor_tipo, autor_usuario_id, contenido, estado,
                                               decidida_por, decidida_el, motivo)
  values (v_org, p_cuenta_cliente, e.id,
          (select coalesce(max(numero), 0) + 1 from negocio.versiones_de_entregable where org_id = v_org and cuenta_id = p_cuenta_cliente and entregable_id = e.id),
          'cliente', p_usuario, jsonb_build_object('version_del_brief', v_version, 'respuestas', v_cont), 'aprobada',
          p_usuario, now(), 'enviado por el cliente')
  returning * into v_ver;
  update negocio.versiones_de_entregable set estado = 'corregida', decidida_el = now(), decidida_por = p_usuario,
         motivo = 'el cliente envió la versión ' || v_ver.numero
   where org_id = v_org and cuenta_id = p_cuenta_cliente and entregable_id = e.id and estado = 'propuesta';
  update negocio.entregables set estado = 'aprobado', version_aprobada_id = v_ver.id, version_vigente_id = v_ver.id, actualizado_el = now()
   where org_id = v_org and cuenta_id = p_cuenta_cliente and id = e.id
   returning * into e;
  update negocio.corridas_de_agente set estado = 'aprobada'
   where org_id = v_org and cuenta_id = p_cuenta_cliente and agente = 'brief' and estado = 'esperando_aprobacion';
  perform agentes._desactualizar(e, v_ver.id);
  v_res := agentes._al_enviar_el_brief(e, v_ver);
  return jsonb_build_object('ok', true, 'entregable_id', e.id, 'guardadas', n, 'enviado', true, 'version_id', v_ver.id) || v_res;
end $$;

-- Al enviarse (o aprobarse) el Brief: el evento que dispara el Research, a quién vende en la venta del vendedor, y las
-- respuestas estándar de vuelta al lead (vía «brief»).
create or replace function agentes._al_enviar_el_brief(p_entregable negocio.entregables, p_version negocio.versiones_de_entregable)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  k        negocio.clientes;
  v_quien  text;
  q        record;
  n        integer := 0;
begin
  perform agentes._registrar_evento(p_entregable.org_id,
    p_entregable.cuenta_id,
    'brief_enviado',
    null,
    'persona',
    coalesce(p_version.autor_usuario_id::text, 'cliente'),
    'comando_central',
    'brief_enviado:' || p_version.id,
    jsonb_build_object('entregable_id', p_entregable.id, 'version', p_version.numero, 'version_id', p_version.id),
    now());

  select * into k from negocio.clientes where id = p_entregable.cliente_id or cuenta_cliente_id = p_entregable.cuenta_id
   order by creado_el desc limit 1;
  if k.id is null then
    return jsonb_build_object('copiadas_al_lead', 0);
  end if;
  -- La pregunta que decide la variante (la 9): negocios o consumidores.
  -- La pregunta que decide la variante (la 9): negocios o consumidores. Se lee de lo vigente del Brief (la última
  -- respuesta de cada pregunta), no del contenido de la versión: el del agente y el del cliente tienen formas distintas.
  select coalesce(
           (select coalesce(bv.valor_texto, bv.valor_json #>> '{}') from negocio.brief_vigente bv
              join catalogo.preguntas_del_brief q2 on q2.clave = bv.pregunta and q2.decide_la_variante and q2.vigente
             where bv.org_id = p_entregable.org_id and bv.cuenta_id = p_entregable.cuenta_id and bv.entregable_id = p_entregable.id
               and bv.estado <> 'vacio' limit 1),
           (select coalesce(bv.valor_texto, bv.valor_json #>> '{}') from negocio.brief_vigente bv
             where bv.org_id = p_entregable.org_id and bv.cuenta_id = p_entregable.cuenta_id and bv.entregable_id = p_entregable.id
               and bv.pregunta = 'a_quien_vende' and bv.estado <> 'vacio'),
           -- Si nadie la respondió, vale la que propuso el agente.
           (select pv.contenido ->> 'a_quien_vende_propuesto' from negocio.versiones_de_entregable pv
             where pv.org_id = p_entregable.org_id and pv.cuenta_id = p_entregable.cuenta_id and pv.entregable_id = p_entregable.id
               and pv.autor_tipo = 'agente_ia' order by pv.numero desc limit 1))
    into v_quien;
  update negocio.clientes
     set a_quien_vende = case when v_quien in ('negocios', 'consumidores') then v_quien else a_quien_vende end,
         estado = case when estado in ('vendido', 'pago_confirmado', 'contrato_firmado', 'en_onboarding') then 'brief_enviado' else estado end
   where org_id = k.org_id and cuenta_id = k.cuenta_id and id = k.id;

  -- Las respuestas vigentes que son preguntas estándar (por el catálogo del Brief, o porque ya se llaman así) vuelven
  -- al lead, en la cuenta del vendedor, con la vía «brief».
  for q in select bv.pregunta, coalesce(qb.pregunta_estandar::text, pe.clave::text) as estandar,
                  coalesce(bv.valor_texto, bv.valor_json #>> '{}', bv.valor_json::text) as valor
             from negocio.brief_vigente bv
             left join catalogo.preguntas_del_brief qb on qb.clave = bv.pregunta and qb.vigente and qb.pregunta_estandar is not null
             left join catalogo.preguntas_estandar pe on pe.clave = bv.pregunta and pe.vigente
            where bv.org_id = p_entregable.org_id and bv.cuenta_id = p_entregable.cuenta_id and bv.entregable_id = p_entregable.id
              and bv.estado <> 'vacio' and coalesce(qb.pregunta_estandar::text, pe.clave::text) is not null loop
    if nullif(btrim(q.valor), '') is not null then
      insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor,
                                               obtenida_por, observada_el)
      values (k.org_id, k.cuenta_id, k.contacto_id, q.estandar, left('brief:' || q.pregunta, 200), left(q.valor, 2000),
              'comando_central', 'brief', now());
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('copiadas_al_lead', n, 'a_quien_vende', v_quien);
end $$;

-- ─── 9 · Permisos ────────────────────────────────────────────────────────────────

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
