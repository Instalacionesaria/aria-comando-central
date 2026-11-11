-- 114 · Los agentes del cliente después del Brief: el Research (cinco pasos y el prediagnóstico), el Estratega (ICP,
-- categoría y oferta, precio y Process Map) y el Funnel Builder (VSL, anuncios, prompt de la landing), con lo que otros
-- consultan guardado como filas, y el ICP aprobado publicado como conocimiento de la cuenta del cliente.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (docs/_privado/modelo-de-datos/27-MANAGED-AGENTS.md § Research, § Estratega y § Funnel Builder)
--
-- FILAS, NO SÓLO JSON. El documento de cada paso vive en su versión de entregable (la 113). Pero los segmentos, los
-- dolores, los referentes y las citas textuales del mercado se consumen FUERA del Research: el Estratega elige el ICP
-- sobre el segmento elegido, el Funnel Builder escribe con las citas del mercado de cada dolor, y el cerebro puede
-- responder «¿qué dolores aparecen en los clientes del nicho X?» (con catalogo.dolores_comunes, comparable entre
-- clientes). Cada fila apunta a la versión que la produjo: una versión nueva no se mezcla con las viejas.
--
-- LA CITA DEL MERCADO SE COTEJA. Una cita se registra contra una evidencia pública (negocio.fuentes_publicas, la 110)
-- que el agente registró ANTES de citarla; si el texto no aparece en el extracto, queda con cita_verificada = false.
--
-- EL ICP LO LEEN LOS AGENTES. Al aprobarse la Etapa 1, el ICP se publica como conocimiento «icp» de la cuenta del
-- cliente (negocio.conocimiento_de_la_cuenta, origen entregable): desde ahí, el Triage que clasifique a SUS leads usa
-- su ICP. Por eso el contenido del ICP trae criterios estructurados (a_quien_si / a_quien_no, con la pregunta estándar,
-- el operador y el valor cuando se puede), y la base lo valida.
--
-- LAS PIEZAS NACEN CON SU CÓDIGO. Cada variante de anuncio del Funnel Builder es una fila de negocio.piezas_de_contenido
-- con su código de nomenclatura: el día que el cliente la publique en Meta con ese nombre, la métrica del anuncio se une
-- con la variante, el dolor y la cita del mercado que la originó. Es el aprendizaje que cierra el ciclo.
--
-- LA KICKOFF, COMO DATO. Lo que se decide en la Kickoff (el segmento, el precio, las reglas de los agentes) se escribe en
-- negocio.decisiones_de_kickoff: cinco líneas que el Estratega lee, en vez de una transcripción de una hora.
--
-- Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · Las filas del Research ──────────────────────────────────────────────────

create table if not exists negocio.segmentos_del_mercado (
  org_id             uuid not null references identidad.organizaciones (id),
  cuenta_id          uuid not null,
  id                 uuid not null default gen_random_uuid(),
  version_id         uuid not null,
  nombre             text not null check (length(btrim(nombre)) between 1 and 200),
  descripcion        text check (descripcion is null or length(descripcion) <= 4000),
  criterios          jsonb not null default '[]'::jsonb,
  valor_del_cliente  text check (valor_del_cliente is null or length(valor_del_cliente) <= 1000),
  contrato_inicial   text check (contrato_inicial is null or length(contrato_inicial) <= 1000),
  senales_de_tamano  text check (senales_de_tamano is null or length(senales_de_tamano) <= 2000),
  elegido            boolean not null default false,
  creado_el          timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, cuenta_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint segmentos_misma_cuenta_que_la_version
    foreign key (org_id, cuenta_id, version_id) references negocio.versiones_de_entregable (org_id, cuenta_id, id) on delete cascade
);
comment on table negocio.segmentos_del_mercado is 'Los segmentos del nicho del cliente (Research, paso 1; 114). elegido = el que fijó el paso 5.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.segmentos_del_mercado', true);
revoke delete, truncate on negocio.segmentos_del_mercado from app_inquilino;
grant select, insert on negocio.segmentos_del_mercado to agente_mcp;
grant update (elegido) on negocio.segmentos_del_mercado to agente_mcp;

create table if not exists negocio.dolores_del_segmento (
  org_id             uuid not null references identidad.organizaciones (id),
  cuenta_id          uuid not null,
  id                 uuid not null default gen_random_uuid(),
  version_id         uuid not null,
  segmento_id        uuid,
  segmento_nombre    text,
  etapa_del_recorrido text check (etapa_del_recorrido is null or length(etapa_del_recorrido) <= 200),
  descripcion        text not null check (length(descripcion) between 1 and 4000),
  intensidad         smallint check (intensidad between 1 and 5),
  es_critico         boolean not null default false,
  dolor_comun        catalogo.clave references catalogo.dolores_comunes (clave),
  creado_el          timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, cuenta_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint dolores_misma_cuenta_que_la_version
    foreign key (org_id, cuenta_id, version_id) references negocio.versiones_de_entregable (org_id, cuenta_id, id) on delete cascade,
  constraint dolores_misma_cuenta_que_el_segmento
    foreign key (org_id, cuenta_id, segmento_id) references negocio.segmentos_del_mercado (org_id, cuenta_id, id) on delete set null (segmento_id)
);
comment on table negocio.dolores_del_segmento is 'Los dolores de cada segmento en el recorrido de su cliente (Research, paso 2; 114). dolor_comun los hace comparables entre clientes del mismo nicho.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.dolores_del_segmento', true);
revoke update, delete, truncate on negocio.dolores_del_segmento from app_inquilino;
grant select, insert on negocio.dolores_del_segmento to agente_mcp;

create table if not exists negocio.referentes_del_mercado (
  org_id             uuid not null references identidad.organizaciones (id),
  cuenta_id          uuid not null,
  id                 uuid not null default gen_random_uuid(),
  version_id         uuid not null,
  segmento_id        uuid,
  tipo               text not null check (tipo in ('resolvio_el_dolor', 'proveedor')),
  nombre             text not null check (length(btrim(nombre)) between 1 and 300),
  url                text check (url is null or length(url) <= 2000),
  que_ofrece         text check (que_ofrece is null or length(que_ofrece) <= 4000),
  precio             text check (precio is null or length(precio) <= 300),
  fuente_publica_id  uuid,
  creado_el          timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint referentes_misma_cuenta_que_la_version
    foreign key (org_id, cuenta_id, version_id) references negocio.versiones_de_entregable (org_id, cuenta_id, id) on delete cascade,
  constraint referentes_misma_cuenta_que_el_segmento
    foreign key (org_id, cuenta_id, segmento_id) references negocio.segmentos_del_mercado (org_id, cuenta_id, id) on delete set null (segmento_id)
);
comment on table negocio.referentes_del_mercado is 'Quiénes ya resolvieron el dolor y qué proveedores le venden al nicho (Research, paso 3; 114).';
select negocio.aplicar_aislamiento_de_cuenta('negocio.referentes_del_mercado', true);
revoke update, delete, truncate on negocio.referentes_del_mercado from app_inquilino;
grant select, insert on negocio.referentes_del_mercado to agente_mcp;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'negocio.fuentes_publicas'::regclass and conname = 'fuentes_publicas_org_cuenta_id') then
    alter table negocio.fuentes_publicas add constraint fuentes_publicas_org_cuenta_id unique (org_id, cuenta_id, id);
  end if;
end $$;

create table if not exists negocio.citas_del_mercado (
  org_id             uuid not null references identidad.organizaciones (id),
  cuenta_id          uuid not null,
  id                 uuid not null default gen_random_uuid(),
  version_id         uuid not null,
  segmento_id        uuid,
  dolor_id           uuid,
  fuente_publica_id  uuid not null,
  texto              text not null check (length(texto) between 1 and 2000),
  cita_verificada    boolean not null default false,
  creado_el          timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint citas_misma_cuenta_que_la_version
    foreign key (org_id, cuenta_id, version_id) references negocio.versiones_de_entregable (org_id, cuenta_id, id) on delete cascade,
  constraint citas_misma_cuenta_que_el_segmento
    foreign key (org_id, cuenta_id, segmento_id) references negocio.segmentos_del_mercado (org_id, cuenta_id, id) on delete set null (segmento_id),
  constraint citas_misma_cuenta_que_el_dolor
    foreign key (org_id, cuenta_id, dolor_id) references negocio.dolores_del_segmento (org_id, cuenta_id, id) on delete set null (dolor_id),
  constraint citas_misma_cuenta_que_la_fuente
    foreign key (org_id, cuenta_id, fuente_publica_id) references negocio.fuentes_publicas (org_id, cuenta_id, id) on delete cascade
);
create index if not exists citas_del_mercado_por_dolor on negocio.citas_del_mercado (org_id, cuenta_id, dolor_id) where dolor_id is not null;
comment on table negocio.citas_del_mercado is
  'Cada cita textual de alguien del mercado (una reseña, un comentario en un foro), con su fuente pública, el segmento y el dolor que expresa (Research; 114). Es la entrada clave del Funnel Builder. cita_verificada = el texto está en el extracto de la fuente.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.citas_del_mercado', true);
revoke update, delete, truncate on negocio.citas_del_mercado from app_inquilino;
grant select, insert on negocio.citas_del_mercado to agente_mcp;

-- ─── 2 · Las decisiones de la Kickoff ────────────────────────────────────────────

create table if not exists negocio.decisiones_de_kickoff (
  org_id         uuid not null references identidad.organizaciones (id),
  cuenta_id      uuid not null,
  id             uuid not null default gen_random_uuid(),
  sobre          text not null check (sobre in ('research', 'segmento', 'oferta', 'precio', 'reglas_de_agentes', 'otro')),
  decision       text not null check (length(decision) between 1 and 4000),
  autor          text check (autor is null or length(autor) <= 200),
  cita_ghl_id    text,
  creada_el      timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id)
);
comment on table negocio.decisiones_de_kickoff is
  'Lo que se decidió en la Kickoff del cliente (114), en la cuenta del cliente: el segmento, el precio, las reglas de los agentes. El Estratega lo lee. autor es el coach (de otra organización: referencia blanda).';
select negocio.aplicar_aislamiento_de_cuenta('negocio.decisiones_de_kickoff', true);
revoke update, delete, truncate on negocio.decisiones_de_kickoff from app_inquilino;
grant select, insert on negocio.decisiones_de_kickoff to agente_mcp;

-- ─── 3 · Las piezas de contenido ─────────────────────────────────────────────────

create table if not exists negocio.piezas_de_contenido (
  org_id                 uuid not null references identidad.organizaciones (id),
  cuenta_id              uuid not null,
  id                     uuid not null default gen_random_uuid(),
  version_id             uuid not null,
  tipo                   text not null check (tipo in ('anuncio', 'vsl', 'landing')),
  codigo_de_nomenclatura text check (codigo_de_nomenclatura is null or length(codigo_de_nomenclatura) <= 300),
  angulo                 text check (angulo is null or length(angulo) <= 500),
  segmento_id            uuid,
  dolor_id               uuid,
  dolor_del_creativo     catalogo.clave references catalogo.dolores_del_creativo (clave),
  nivel_de_consciencia   catalogo.clave references catalogo.niveles_de_consciencia (clave),
  formato                catalogo.clave references catalogo.formatos (clave),
  titular                text check (titular is null or length(titular) <= 500),
  texto_principal        text check (texto_principal is null or length(texto_principal) <= 8000),
  guion                  text check (guion is null or length(guion) <= 40000),
  llamado_a_la_accion    text check (llamado_a_la_accion is null or length(llamado_a_la_accion) <= 300),
  citas_usadas           uuid[] not null default '{}',
  estado                 text not null default 'propuesta' check (estado in ('propuesta', 'aprobada', 'publicada', 'pausada', 'descartada')),
  anuncio_id_externo     text,
  creada_el              timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint piezas_misma_cuenta_que_la_version
    foreign key (org_id, cuenta_id, version_id) references negocio.versiones_de_entregable (org_id, cuenta_id, id) on delete cascade,
  constraint piezas_misma_cuenta_que_el_segmento
    foreign key (org_id, cuenta_id, segmento_id) references negocio.segmentos_del_mercado (org_id, cuenta_id, id) on delete set null (segmento_id),
  constraint piezas_misma_cuenta_que_el_dolor
    foreign key (org_id, cuenta_id, dolor_id) references negocio.dolores_del_segmento (org_id, cuenta_id, id) on delete set null (dolor_id)
);
create index if not exists piezas_por_codigo on negocio.piezas_de_contenido (org_id, cuenta_id, codigo_de_nomenclatura) where codigo_de_nomenclatura is not null;
comment on table negocio.piezas_de_contenido is
  'Cada variante que produce el Funnel Builder (114): anuncios (una fila por variante para probar), el VSL y la landing. Nace con su código de nomenclatura para unirse con negocio.anuncios cuando se publique.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.piezas_de_contenido', true);
revoke delete, truncate on negocio.piezas_de_contenido from app_inquilino;
grant select, insert on negocio.piezas_de_contenido to agente_mcp;
grant update (estado, anuncio_id_externo) on negocio.piezas_de_contenido to agente_mcp;

-- ─── 4 · Piezas internas ─────────────────────────────────────────────────────────

-- El paso / etapa / pieza de la corrida: lo último de sujeto_clave (comprador:{cliente}:{tipo}).
create or replace function agentes._tipo_de_la_corrida(p_corrida negocio.corridas_de_agente) returns text
language sql immutable security invoker set search_path = pg_catalog, pg_temp
as $$ select nullif(split_part(p_corrida.sujeto_clave, ':', 3), '') $$;

-- Exige que un entregable esté aprobado (la etapa anterior). Devuelve el error o null.
create or replace function agentes._exigir_aprobado(p_org uuid, p_cuenta uuid, p_tipo text) returns text
language sql stable security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
  select case when exists (select 1 from negocio.entregables e where e.org_id = p_org and e.cuenta_id = p_cuenta
                             and e.tipo = p_tipo and e.estado = 'aprobado')
              then null else format('falta aprobar «%s» antes', p_tipo) end
$$;

-- Lo común de leer a un agente del comprador: los entregables vigentes pedidos, la evidencia pública del cliente y, si
-- se pide, las filas del Research de las versiones vigentes.
create or replace function agentes._leer_del_cliente(p_corrida negocio.corridas_de_agente, p_tipos text[], p_con_filas boolean)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  d        jsonb := agentes._entregables_vigentes(p_corrida.org_id, p_corrida.cuenta_id, p_tipos);
  v_pub    jsonb;
  v_filas  jsonb := null;
  v_seg_v  uuid := (d #>> '{ids,mr_segmentos}')::uuid;
  v_dol_v  uuid := (d #>> '{ids,mr_dolores}')::uuid;
  v_ref_v  uuid := (d #>> '{ids,mr_referentes}')::uuid;
begin
  select coalesce(jsonb_object_agg('publica:' || p.id, p.extracto), '{}'::jsonb) into v_pub
    from negocio.fuentes_publicas p where p.org_id = p_corrida.org_id and p.cuenta_id = p_corrida.cuenta_id;
  if p_con_filas then
    v_filas := jsonb_build_object(
      'segmentos', (select coalesce(jsonb_agg(jsonb_build_object('segmento_id', s.id, 'nombre', s.nombre, 'descripcion', s.descripcion,
                      'criterios', s.criterios, 'valor_del_cliente', s.valor_del_cliente, 'elegido', s.elegido)), '[]'::jsonb)
                    from negocio.segmentos_del_mercado s where s.org_id = p_corrida.org_id and s.cuenta_id = p_corrida.cuenta_id and s.version_id = v_seg_v),
      'dolores', (select coalesce(jsonb_agg(jsonb_build_object('dolor_id', x.id, 'segmento', x.segmento_nombre, 'descripcion', x.descripcion,
                      'etapa', x.etapa_del_recorrido, 'intensidad', x.intensidad, 'es_critico', x.es_critico, 'dolor_comun', x.dolor_comun,
                      'citas', (select coalesce(jsonb_agg(jsonb_build_object('cita_id', c.id, 'texto', c.texto, 'fuente', 'publica:' || c.fuente_publica_id,
                                 'verificada', c.cita_verificada)), '[]'::jsonb)
                                  from negocio.citas_del_mercado c where c.org_id = x.org_id and c.cuenta_id = x.cuenta_id and c.dolor_id = x.id))), '[]'::jsonb)
                  from negocio.dolores_del_segmento x where x.org_id = p_corrida.org_id and x.cuenta_id = p_corrida.cuenta_id and x.version_id = v_dol_v),
      'referentes', (select coalesce(jsonb_agg(jsonb_build_object('tipo', r.tipo, 'nombre', r.nombre, 'url', r.url, 'que_ofrece', r.que_ofrece,
                      'precio', r.precio)), '[]'::jsonb)
                     from negocio.referentes_del_mercado r where r.org_id = p_corrida.org_id and r.cuenta_id = p_corrida.cuenta_id and r.version_id = v_ref_v),
      'decisiones_de_kickoff', (select coalesce(jsonb_agg(jsonb_build_object('sobre', k.sobre, 'decision', k.decision, 'el', k.creada_el)
                      order by k.creada_el), '[]'::jsonb)
                     from negocio.decisiones_de_kickoff k where k.org_id = p_corrida.org_id and k.cuenta_id = p_corrida.cuenta_id));
    d := d || jsonb_build_object('fuentes', (d -> 'fuentes') || jsonb_build_object('kickoff:decisiones', v_filas -> 'decisiones_de_kickoff'));
  end if;
  return d || jsonb_build_object('fuentes', (d -> 'fuentes') || v_pub, 'filas', v_filas);
end $$;

-- ─── 5 · Research ────────────────────────────────────────────────────────────────

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
  v_err := agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'brief');
  d := agentes._leer_del_cliente(v, array['brief', 'mr_segmentos', 'mr_dolores', 'mr_referentes', 'mr_precio', 'mr_decision'], true);
  perform agentes._anotar_lectura(v, d -> 'fuentes');
  return jsonb_build_object('corrida_id', v.id, 'agente', 'research', 'paso', v_paso, 'aviso', v_err,
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
  if agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'brief') is not null then
    v_err := v_err || to_jsonb('el Brief del cliente todavía no está enviado'::text);
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
       or not exists (select 1 from negocio.fuentes_publicas f where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id
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

  d := agentes._entregables_vigentes(v.org_id, v.cuenta_id, array['brief', 'mr_segmentos', 'mr_dolores', 'mr_referentes', 'mr_precio', 'mr_decision']);
  v_ver := agentes._proponer_version(v, v_paso, coalesce(p_salida -> 'contenido', '{}'::jsonb) || (p_salida - 'texto' - 'contenido'),
                                     v_texto, d -> 'ids');
  v_seg_v := case when v_paso = 'mr_segmentos' then v_ver else (d #>> '{ids,mr_segmentos}')::uuid end;
  v_dol_v := case when v_paso = 'mr_dolores' then v_ver else (d #>> '{ids,mr_dolores}')::uuid end;

  if v_paso = 'mr_segmentos' then
    for x in select value from jsonb_array_elements(p_salida -> 'segmentos') loop
      insert into negocio.segmentos_del_mercado (org_id, cuenta_id, version_id, nombre, descripcion, criterios, valor_del_cliente,
                                                 contrato_inicial, senales_de_tamano)
      values (v.org_id, v.cuenta_id, v_ver, left(x ->> 'nombre', 200), left(x ->> 'descripcion', 4000),
              case when jsonb_typeof(x -> 'criterios') = 'array' then x -> 'criterios' else '[]'::jsonb end,
              left(x ->> 'valor_del_cliente', 1000), left(x ->> 'contrato_inicial', 1000), left(x ->> 'senales_de_tamano', 2000));
      n_filas := n_filas + 1;
    end loop;
  elsif v_paso = 'mr_dolores' then
    for x in select value from jsonb_array_elements(p_salida -> 'dolores') loop
      select s.id into v_seg from negocio.segmentos_del_mercado s
       where s.org_id = v.org_id and s.cuenta_id = v.cuenta_id and s.version_id = v_seg_v and lower(s.nombre) = lower(x ->> 'segmento') limit 1;
      v_dol := gen_random_uuid();
      insert into negocio.dolores_del_segmento (org_id, cuenta_id, id, version_id, segmento_id, segmento_nombre, etapa_del_recorrido,
                                                descripcion, intensidad, es_critico, dolor_comun)
      values (v.org_id, v.cuenta_id, v_dol, v_ver, v_seg, left(x ->> 'segmento', 200), left(x ->> 'etapa_del_recorrido', 200),
              left(coalesce(x ->> 'descripcion', x ->> 'dolor'), 4000), round(agentes._numero(x ->> 'intensidad'))::smallint,
              (x -> 'es_critico') = 'true'::jsonb, x ->> 'dolor_comun');
      v_ids := v_ids || jsonb_build_object(lower(coalesce(x ->> 'clave', x ->> 'descripcion', x ->> 'dolor')), v_dol);
      n_filas := n_filas + 1;
    end loop;
  elsif v_paso = 'mr_referentes' then
    for x in select value from jsonb_array_elements(coalesce(p_salida -> 'referentes', '[]'::jsonb)) loop
      select s.id into v_seg from negocio.segmentos_del_mercado s
       where s.org_id = v.org_id and s.cuenta_id = v.cuenta_id and s.version_id = v_seg_v and lower(s.nombre) = lower(x ->> 'segmento') limit 1;
      v_fp := case when x ->> 'fuente' ~ '^publica:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then substr(x ->> 'fuente', 9)::uuid end;
      insert into negocio.referentes_del_mercado (org_id, cuenta_id, version_id, segmento_id, tipo, nombre, url, que_ofrece, precio, fuente_publica_id)
      values (v.org_id, v.cuenta_id, v_ver, v_seg, case when x ->> 'tipo' = 'proveedor' then 'proveedor' else 'resolvio_el_dolor' end,
              left(x ->> 'nombre', 300), left(x ->> 'url', 2000), left(x ->> 'que_ofrece', 4000), left(x ->> 'precio', 300),
              case when exists (select 1 from negocio.fuentes_publicas f where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id and f.id = v_fp) then v_fp end);
      n_filas := n_filas + 1;
    end loop;
  elsif v_paso = 'mr_decision' then
    v_elegido := btrim(p_salida ->> 'segmento_elegido');
    update negocio.segmentos_del_mercado set elegido = (lower(nombre) = lower(v_elegido))
     where org_id = v.org_id and cuenta_id = v.cuenta_id and version_id = v_seg_v;
    get diagnostics n_filas = row_count;
  end if;

  -- Las citas del mercado: cada una contra su evidencia registrada.
  for x in select value from jsonb_array_elements(coalesce(p_salida -> 'citas', '[]'::jsonb)) loop
    v_fp := substr(x ->> 'fuente', 9)::uuid;
    select f.extracto into v_ext from negocio.fuentes_publicas f where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id and f.id = v_fp;
    select s.id into v_seg from negocio.segmentos_del_mercado s
     where s.org_id = v.org_id and s.cuenta_id = v.cuenta_id and s.version_id = v_seg_v and lower(s.nombre) = lower(x ->> 'segmento') limit 1;
    v_dol := coalesce((v_ids ->> lower(coalesce(x ->> 'dolor', '')))::uuid,
                      (select dd.id from negocio.dolores_del_segmento dd where dd.org_id = v.org_id and dd.cuenta_id = v.cuenta_id
                          and dd.version_id = v_dol_v and (dd.id::text = x ->> 'dolor' or lower(dd.descripcion) = lower(x ->> 'dolor')) limit 1));
    insert into negocio.citas_del_mercado (org_id, cuenta_id, version_id, segmento_id, dolor_id, fuente_publica_id, texto, cita_verificada)
    values (v.org_id, v.cuenta_id, v_ver, v_seg, v_dol, v_fp, left(x ->> 'texto', 2000),
            position(agentes._normal(x ->> 'texto') in agentes._normal(v_ext)) > 0);
    n_citas := n_citas + 1;
    if position(agentes._normal(x ->> 'texto') in agentes._normal(v_ext)) > 0 then n_verif := n_verif + 1; end if;
  end loop;

  perform agentes._cerrar(v, p_salida, n_citas - n_verif, 'esperando_aprobacion');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'paso', v_paso, 'version_id', v_ver, 'filas', n_filas,
    'citas', n_citas, 'citas_verificadas', n_verif,
    'siguiente', 'el coach aprueba con agentes.decidir_entregable(version_id, ''aprobada'' | ''rechazada'' | ''corregida'', …); el paso siguiente se abre aparte');
end $$;

-- ─── 6 · Estratega ───────────────────────────────────────────────────────────────

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
  v_avisos := v_avisos || coalesce(to_jsonb(agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'mr_decision')), '[]'::jsonb);
  if v_etapa <> 'icp' then
    v_avisos := v_avisos || coalesce(to_jsonb(agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'icp')), '[]'::jsonb);
  end if;
  if v_etapa = 'precio_y_process_map' then
    v_avisos := v_avisos || coalesce(to_jsonb(agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'categoria_y_oferta')), '[]'::jsonb);
  end if;
  d := agentes._leer_del_cliente(v, array['brief', 'mr_segmentos', 'mr_dolores', 'mr_referentes', 'mr_precio', 'mr_decision',
                                          'prediagnostico', 'icp', 'categoria_y_oferta', 'precio_y_process_map'], true);
  perform agentes._anotar_lectura(v, d -> 'fuentes');
  return jsonb_build_object('corrida_id', v.id, 'agente', 'estratega', 'etapa', v_etapa, 'avisos', v_avisos,
    'entregables', d -> 'entregables', 'filas', d -> 'filas', 'fuentes', d -> 'fuentes', 'faltantes', d -> 'faltantes',
    'preguntas_estandar', (select jsonb_agg(jsonb_build_object('clave', clave, 'eje', eje, 'tipo_de_valor', tipo_de_valor)) from catalogo.preguntas_estandar where vigente),
    'contrato', 'agentes.registrar_estratega(corrida_id, {texto (md), contenido{}}). El ICP trae a_quien_si[] y a_quien_no[] con {criterio, tipo: requisito|preferencia|knockout, pregunta_estandar, operador, valor, eje}.');
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
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' or jsonb_typeof(c) <> 'object' then
    return agentes._rechazar(v, jsonb_build_array('la salida es {texto, contenido{}}'));
  end if;
  if v_etapa is null or not exists (select 1 from catalogo.tipos_de_entregable t where t.clave = v_etapa and t.agente = v.agente) then
    return agentes._rechazar(v, jsonb_build_array('la corrida no dice una etapa del Estratega (ábrela con p_sujeto.etapa = icp, categoria_y_oferta o precio_y_process_map)'));
  end if;
  if v_texto is null then v_err := v_err || to_jsonb('texto: el documento de la etapa, en markdown'::text); end if;
  v_e := agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'mr_decision');
  if v_e is not null then v_err := v_err || to_jsonb(v_e); end if;
  if v_etapa in ('categoria_y_oferta', 'precio_y_process_map') then
    v_e := agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'icp');
    if v_e is not null then v_err := v_err || to_jsonb(v_e); end if;
  end if;
  if v_etapa = 'precio_y_process_map' then
    v_e := agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'categoria_y_oferta');
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

  d := agentes._entregables_vigentes(v.org_id, v.cuenta_id, array['brief', 'mr_decision', 'icp', 'categoria_y_oferta']);
  v_ver := agentes._proponer_version(v, v_etapa, c, v_texto, d -> 'ids');
  perform agentes._cerrar(v, p_salida, 0, 'esperando_aprobacion');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'etapa', v_etapa, 'version_id', v_ver,
    'siguiente', case v_etapa when 'icp' then 'al aprobarse, el ICP se publica como conocimiento de la cuenta del cliente' else 'el coach aprueba con agentes.decidir_entregable' end);
end $$;

-- ─── 7 · Funnel Builder ──────────────────────────────────────────────────────────

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
    'aviso', agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'precio_y_process_map'),
    'entregables', d -> 'entregables', 'filas', d -> 'filas', 'fuentes', d -> 'fuentes', 'faltantes', d -> 'faltantes',
    'nomenclatura', (select jsonb_agg(jsonb_build_object('clave', clave, 'separador', separador, 'partes', partes)) from catalogo.reglas_de_nomenclatura where vigente_hasta is null),
    'dolores_del_creativo', (select jsonb_agg(clave) from catalogo.dolores_del_creativo where vigente),
    'niveles_de_consciencia', (select jsonb_agg(clave order by orden) from catalogo.niveles_de_consciencia),
    'formatos', (select jsonb_agg(clave) from catalogo.formatos where vigente),
    'contrato', 'agentes.registrar_funnel_builder(corrida_id, {texto (md), contenido{}, variantes[{codigo_de_nomenclatura, angulo, dolor, dolor_del_creativo, nivel_de_consciencia, formato, titular, texto_principal, guion, llamado_a_la_accion, citas_usadas[cita_id]}]}). Para el prompt de la landing: contenido.prompt, contenido.custom_code, contenido.formulario.');
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
  v_e     text := agentes._exigir_aprobado(v.org_id, v.cuenta_id, 'precio_y_process_map');
begin
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

  d := agentes._entregables_vigentes(v.org_id, v.cuenta_id, array['icp', 'categoria_y_oferta', 'precio_y_process_map', 'mr_dolores']);
  v_ver := agentes._proponer_version(v, v_pieza, c || jsonb_build_object('variantes', v_var), v_texto, d -> 'ids');

  for x in select value from jsonb_array_elements(case when jsonb_typeof(v_var) = 'array' then v_var else '[]'::jsonb end) loop
    select dd.id into v_dol from negocio.dolores_del_segmento dd
     where dd.org_id = v.org_id and dd.cuenta_id = v.cuenta_id and dd.version_id = (d #>> '{ids,mr_dolores}')::uuid
       and (dd.id::text = x ->> 'dolor' or lower(dd.descripcion) = lower(x ->> 'dolor')) limit 1;
    select array_agg(cm.id) into v_citas from negocio.citas_del_mercado cm
     where cm.org_id = v.org_id and cm.cuenta_id = v.cuenta_id
       and cm.id::text in (select jsonb_array_elements_text(coalesce(x -> 'citas_usadas', '[]'::jsonb)));
    insert into negocio.piezas_de_contenido (org_id, cuenta_id, version_id, tipo, codigo_de_nomenclatura, angulo, dolor_id,
      dolor_del_creativo, nivel_de_consciencia, formato, titular, texto_principal, guion, llamado_a_la_accion, citas_usadas)
    values (v.org_id, v.cuenta_id, v_ver, case v_pieza when 'guion_vsl' then 'vsl' when 'prompt_landing' then 'landing' else 'anuncio' end,
      left(x ->> 'codigo_de_nomenclatura', 300), left(x ->> 'angulo', 500), v_dol, x ->> 'dolor_del_creativo', x ->> 'nivel_de_consciencia',
      x ->> 'formato', left(x ->> 'titular', 500), left(x ->> 'texto_principal', 8000), left(x ->> 'guion', 40000),
      left(x ->> 'llamado_a_la_accion', 300), coalesce(v_citas, '{}'));
    n := n + 1;
  end loop;

  perform agentes._cerrar(v, p_salida, 0, 'esperando_aprobacion');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'pieza', v_pieza, 'version_id', v_ver, 'variantes', n);
end $$;

-- ─── 8 · La Kickoff ──────────────────────────────────────────────────────────────

create or replace function agentes.registrar_decisiones_de_kickoff(p_cuenta_cliente uuid, p_decisiones jsonb,
  p_autor text default null, p_cita_ghl_id text default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, pg_temp
as $$
declare
  v_org    uuid;
  v_sesion text := nullif(btrim(current_setting('app.org_id', true)), '');
  x        jsonb;
  n        integer := 0;
begin
  select org_id into v_org from identidad.cuentas where id = p_cuenta_cliente;
  if v_org is null then raise exception using errcode = 'P0002', message = 'agentes: la cuenta no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> v_org then
    raise exception using errcode = '42501', message = 'agentes: la cuenta es de otra organización que la de la sesión';
  end if;
  for x in select value from jsonb_array_elements(coalesce(p_decisiones, '[]'::jsonb)) loop
    if coalesce(x ->> 'sobre', 'otro') not in ('research', 'segmento', 'oferta', 'precio', 'reglas_de_agentes', 'otro')
       or coalesce(btrim(x ->> 'decision'), '') = '' then
      raise exception using errcode = '22023',
        message = 'agentes: cada decisión lleva su texto y «sobre» = research, segmento, oferta, precio, reglas_de_agentes u otro';
    end if;
    insert into negocio.decisiones_de_kickoff (org_id, cuenta_id, sobre, decision, autor, cita_ghl_id)
    values (v_org, p_cuenta_cliente, coalesce(x ->> 'sobre', 'otro'), left(x ->> 'decision', 4000), left(p_autor, 200), p_cita_ghl_id);
    n := n + 1;
  end loop;
  perform agentes._registrar_evento(v_org,
    p_cuenta_cliente,
    'kickoff_realizada',
    null,
    'persona',
    coalesce(p_autor, 'coach'),
    'comando_central',
    'kickoff:' || p_cuenta_cliente || ':' || coalesce(p_cita_ghl_id, to_char(now(), 'YYYYMMDDHH24MISS')),
    jsonb_build_object('decisiones', n),
    now());
  update negocio.clientes set kickoff_el = coalesce(kickoff_el, now()) where cuenta_cliente_id = p_cuenta_cliente;
  return jsonb_build_object('ok', true, 'decisiones', n);
end $$;

-- ─── 9 · Al corregir: las filas de la versión vieja pasan a la corregida ─────────
-- Si el coach corrige un paso del Research (o los anuncios), lo que el agente guardó como filas sigue valiendo para la
-- versión que él escribió encima: segmentos, dolores, referentes, citas y piezas pasan a la versión nueva. Así el
-- Estratega y el Funnel Builder, que leen las filas de la versión vigente, no se quedan sin ellas.
create or replace function agentes._al_corregir(p_entregable negocio.entregables, p_vieja uuid, p_nueva uuid) returns void
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
begin
  update negocio.segmentos_del_mercado set version_id = p_nueva
   where org_id = p_entregable.org_id and cuenta_id = p_entregable.cuenta_id and version_id = p_vieja;
  update negocio.dolores_del_segmento set version_id = p_nueva
   where org_id = p_entregable.org_id and cuenta_id = p_entregable.cuenta_id and version_id = p_vieja;
  update negocio.referentes_del_mercado set version_id = p_nueva
   where org_id = p_entregable.org_id and cuenta_id = p_entregable.cuenta_id and version_id = p_vieja;
  update negocio.citas_del_mercado set version_id = p_nueva
   where org_id = p_entregable.org_id and cuenta_id = p_entregable.cuenta_id and version_id = p_vieja;
  update negocio.piezas_de_contenido set version_id = p_nueva
   where org_id = p_entregable.org_id and cuenta_id = p_entregable.cuenta_id and version_id = p_vieja;
end $$;
grant update (version_id) on negocio.segmentos_del_mercado, negocio.dolores_del_segmento, negocio.referentes_del_mercado,
  negocio.citas_del_mercado, negocio.piezas_de_contenido to agente_mcp, app_inquilino;

-- ─── 10 · Al aprobar: el Brief, el ICP como conocimiento y el estado del cliente ──

create or replace function agentes._al_aprobar(p_entregable negocio.entregables, p_version negocio.versiones_de_entregable,
  p_usuario uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v_extra  jsonb := '{}'::jsonb;
  v_estado text;
begin
  if p_entregable.tipo = 'brief' then
    v_extra := agentes._al_enviar_el_brief(p_entregable, p_version);
  elsif p_entregable.tipo = 'icp' then
    -- (cargar_conocimiento exige que la versión esté aprobada por una persona y sea de un entregable «icp»)
    -- El ICP aprobado es el conocimiento «icp» de la cuenta del cliente: lo usará su Triage.
    v_extra := jsonb_build_object('conocimiento_publicado',
      agentes.cargar_conocimiento(p_entregable.cuenta_id, 'icp', p_version.contenido, p_version.contenido_texto, true,
                                  case when exists (select 1 from identidad.usuarios u where u.org_id = p_entregable.org_id and u.id = p_usuario) then p_usuario end,
                                  'entregable', p_version.id));
  end if;

  v_estado := case p_entregable.tipo
    when 'mr_decision' then 'research_aprobado'
    when 'precio_y_process_map' then 'estrategia_aprobada' end;
  if p_entregable.tipo in ('guion_vsl', 'anuncios', 'prompt_landing')
     and (select count(*) from negocio.entregables e where e.org_id = p_entregable.org_id and e.cuenta_id = p_entregable.cuenta_id
            and e.tipo in ('guion_vsl', 'anuncios', 'prompt_landing') and e.estado = 'aprobado') = 3 then
    v_estado := 'funnel_listo';
  end if;
  if v_estado is not null then
    update negocio.clientes set estado = v_estado where cuenta_cliente_id = p_entregable.cuenta_id and estado not in ('instalado', 'activo', 'pausado', 'baja');
  end if;
  if p_entregable.tipo = 'anuncios' then
    update negocio.piezas_de_contenido set estado = 'aprobada'
     where org_id = p_version.org_id and cuenta_id = p_version.cuenta_id and version_id = p_version.id and estado = 'propuesta';
  end if;
  return v_extra;
end $$;

-- ─── 11 · Permisos ───────────────────────────────────────────────────────────────

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
