-- 111 · Los agentes del lead antes de la llamada: el Triage (prioridad, ruta y por qué) y el Sales Assistant (la ficha
-- del lead para el closer), más las llamadas con su transcripción, que los dos leen.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (docs/_privado/modelo-de-datos/27-MANAGED-AGENTS.md § Triage y § Sales Assistant)
--
-- EL TRIAGE NO PONE EL CUADRANTE. Decisión del usuario del 2026-11-10: el cuadrante lo sigue poniendo el snapshot de
-- GHL al instante (la 105: el workflow decide con él si el lead ve el calendario) y el Triage corre después, sin
-- apuro. Guarda la prioridad de llamada, la ruta comercial, las razones con su cita, los datos que no cuadran, las
-- preguntas que faltan (las que el agente de DM o de WhatsApp puede hacer) y, si no está de acuerdo, un cuadrante
-- PROPUESTO. No toca contactos.cuadrante: así la sincronización no ve un eco ni registra una clasificación que no
-- hizo nadie. Lo vigente de cada lead sale de la vista triaje_vigente, no de columnas nuevas en contactos (que tiene
-- trece disparadores que un agente no tiene por qué despertar).
--
-- LAS RUTAS SON DE LA CUENTA. «Accelerator» es la oferta de ARIA; una agencia tiene las suyas. Cada ruta tiene una
-- clase estándar (alto_ticket, bajo_ticket, nutricion) para comparar entre cuentas. Mientras la cuenta no cargue sus
-- rutas, el Triage puede dar sólo la clase.
--
-- LA FICHA DEL LEAD ES VERSIONADA. El Sales Assistant vuelve a correr cuando llega algo nuevo (un mensaje, la llamada
-- del agente de voz, un reagendamiento): cada corrida es una versión, la vigente es la última, y se guarda cuándo la
-- abrió el closer y si le sirvió. Es la sucesora de negocio.briefs_del_closer (una fila por cita, sin versiones), que
-- queda como historia.
--
-- LAS LLAMADAS, EN UNA SOLA FAMILIA. negocio.llamadas existía (la 011) sin transcripción y sin filas. Se amplía para
-- todas: la del agente de voz, la del setter, la de venta, la Kickoff. La transcripción va aparte y de sólo agregar
-- (una corregida es una fila nueva). Las del analizador de tl;dv (negocio.analizador_*) siguen donde están.
--
-- Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · El idioma ────────────────────────────────────────────────────────────────

create table if not exists catalogo.clases_de_ruta (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.clases_de_ruta is 'La clase estándar de una ruta comercial (negocio.rutas_de_la_cuenta), comparable entre cuentas. Una nueva es un INSERT.';
insert into catalogo.clases_de_ruta (clave, nombre, descripcion) values
  ('alto_ticket', 'Alto ticket', 'La oferta principal, con llamada de venta (el Accelerator de ARIA).'),
  ('bajo_ticket', 'Bajo ticket', 'Una oferta chica, que puede venderse sin llamada.'),
  ('nutricion', 'Nutrición', 'Todavía no compra: entra a la secuencia de Nutrición.')
on conflict do nothing;

create table if not exists catalogo.tipos_de_llamada (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.tipos_de_llamada is 'Qué llamada es (negocio.llamadas.tipo). Una nueva es un INSERT.';
insert into catalogo.tipos_de_llamada (clave, nombre, descripcion) values
  ('ia_voz', 'Agente de voz', 'La llamada de un agente de voz de IA (la confirmación, la calificación).'),
  ('setter', 'Setter', 'La llamada de una persona que califica o confirma.'),
  ('venta', 'Venta', 'La llamada de venta con el closer.'),
  ('kickoff', 'Kickoff', 'La primera llamada con el coach, donde se aprueba el Research.'),
  ('coaching', 'Coaching', 'Una sesión con el coach.'),
  ('onboarding', 'Onboarding', 'La llamada de onboarding.'),
  ('otra', 'Otra', 'Cualquier otra.')
on conflict do nothing;

-- ─── 2 · Las rutas de la cuenta ──────────────────────────────────────────────────

create table if not exists negocio.rutas_de_la_cuenta (
  org_id            uuid not null references identidad.organizaciones (id),
  cuenta_id         uuid not null,
  clave             text not null check (clave ~ '^[a-z0-9][a-z0-9_]{0,59}$'),
  nombre            text not null check (length(btrim(nombre)) between 1 and 120),
  clase             catalogo.clave not null references catalogo.clases_de_ruta (clave),
  precio_desde      numeric(12,2) check (precio_desde >= 0),
  precio_hasta      numeric(12,2) check (precio_hasta >= 0),
  moneda            char(3) references catalogo.monedas (codigo),
  requiere_llamada  boolean not null default true,
  descripcion       text check (descripcion is null or length(descripcion) <= 4000),
  activa            boolean not null default true,
  creada_el         timestamptz not null default now(),
  primary key (org_id, cuenta_id, clave),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  check (precio_hasta is null or precio_desde is null or precio_hasta >= precio_desde)
);
comment on table negocio.rutas_de_la_cuenta is
  'Las ofertas comerciales de cada cuenta a las que el Triage dirige a un lead (111): el Accelerator, el low ticket, la nutrición. La clase es estándar; la clave y el nombre, de la cuenta.';
comment on column negocio.rutas_de_la_cuenta.requiere_llamada is 'false = se vende sin llamada (el lead no pasa por el Sales Assistant ni el Sales Coach).';
select negocio.aplicar_aislamiento_de_cuenta('negocio.rutas_de_la_cuenta', true);
grant select, insert, update on negocio.rutas_de_la_cuenta to agente_mcp;

-- ─── 3 · Los triajes ─────────────────────────────────────────────────────────────

create table if not exists negocio.triajes (
  org_id               uuid not null references identidad.organizaciones (id),
  cuenta_id            uuid not null,
  id                   uuid not null default gen_random_uuid(),
  corrida_id           uuid not null,
  contacto_id          uuid,
  ghl_contact_id       text,
  cuadrante_del_crm    catalogo.clave references catalogo.cuadrantes (clave),
  cuadrante_propuesto  catalogo.clave references catalogo.cuadrantes (clave),
  encaje               text check (encaje in ('alto', 'bajo')),
  capacidad            text check (capacidad in ('alta', 'baja')),
  puntaje_encaje       numeric(6,2),
  puntaje_capacidad    numeric(6,2),
  knockouts            jsonb not null default '[]'::jsonb,
  prioridad            smallint not null check (prioridad between 1 and 10),
  ruta                 text,
  ruta_clase           catalogo.clave not null references catalogo.clases_de_ruta (clave),
  razones              jsonb not null default '[]'::jsonb,
  datos_dudosos        jsonb not null default '[]'::jsonb,
  faltantes            text[] not null default '{}',
  confianza            text not null check (confianza in ('alta', 'media', 'baja')),
  version_icp          integer,
  version_matriz       integer,
  aplicado             boolean not null default true,
  creado_el            timestamptz not null default clock_timestamp(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint triajes_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete cascade,
  constraint triajes_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint triajes_ruta_de_la_cuenta
    foreign key (org_id, cuenta_id, ruta) references negocio.rutas_de_la_cuenta (org_id, cuenta_id, clave),
  check (contacto_id is not null or ghl_contact_id is not null),
  check (jsonb_typeof(knockouts) = 'array' and jsonb_typeof(razones) = 'array' and jsonb_typeof(datos_dudosos) = 'array')
);
create index if not exists triajes_por_contacto on negocio.triajes (org_id, cuenta_id, contacto_id, creado_el desc) where contacto_id is not null;
create index if not exists triajes_sin_contacto on negocio.triajes (org_id, cuenta_id, ghl_contact_id) where contacto_id is null;
comment on table negocio.triajes is
  'Cada salida del Triage (111), de sólo agregar: prioridad de llamada, ruta, razones con su cita, datos dudosos, preguntas que faltan y el cuadrante que propone. El cuadrante vigente lo sigue poniendo el CRM (contactos.cuadrante).';
comment on column negocio.triajes.cuadrante_del_crm is 'El cuadrante que tenía el lead en la base cuando corrió el Triage (el del snapshot de GHL).';
comment on column negocio.triajes.cuadrante_propuesto is 'El que propone el agente. Si difiere del CRM, es una alerta para una persona; no cambia contactos.cuadrante.';
comment on column negocio.triajes.prioridad is 'La prioridad de llamada: 1 = llamar primero, 10 = lo último.';
comment on column negocio.triajes.ruta is 'La ruta de la cuenta (negocio.rutas_de_la_cuenta). Nula si la cuenta todavía no cargó sus rutas: entonces vale ruta_clase.';
comment on column negocio.triajes.razones is 'Los datos con procedencia que justifican la prioridad y la ruta ({campo, estado, valor, fuente, cita, confianza}), ya cotejados.';
comment on column negocio.triajes.faltantes is 'Las preguntas estándar sin responder que habrían cambiado la decisión. Las lee el agente de DM o de WhatsApp: qué preguntarle.';
comment on column negocio.triajes.aplicado is 'false = corrida en modo sombra: se guarda para comparar y no se publica.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.triajes', true);
revoke update, delete, truncate on negocio.triajes from app_inquilino;
grant update (contacto_id) on negocio.triajes to app_inquilino;
grant select, insert on negocio.triajes to agente_mcp;

create or replace view negocio.triaje_vigente with (security_invoker = true) as
  select distinct on (t.org_id, t.cuenta_id, t.contacto_id)
         t.org_id, t.cuenta_id, t.contacto_id, t.id as triaje_id, t.corrida_id, t.prioridad, t.ruta, t.ruta_clase,
         t.cuadrante_propuesto, t.cuadrante_del_crm, t.faltantes, t.confianza, t.creado_el
    from negocio.triajes t
   where t.aplicado and t.contacto_id is not null
   order by t.org_id, t.cuenta_id, t.contacto_id, t.creado_el desc, t.id;
comment on view negocio.triaje_vigente is 'El último triaje aplicado de cada lead (111): su prioridad y su ruta vigentes.';
revoke all on negocio.triaje_vigente from public, app_inquilino;
grant select on negocio.triaje_vigente to app_inquilino, agente_mcp;

-- ─── 4 · Las llamadas y sus transcripciones ──────────────────────────────────────

alter table negocio.llamadas add column if not exists tipo catalogo.clave references catalogo.tipos_de_llamada (clave);
alter table negocio.llamadas add column if not exists proveedor catalogo.clave references catalogo.proveedores (clave);
alter table negocio.llamadas add column if not exists cita_id uuid;
alter table negocio.llamadas add column if not exists persona_id uuid;
alter table negocio.llamadas add column if not exists direccion text;
alter table negocio.llamadas add column if not exists url_de_la_grabacion text;
alter table negocio.llamadas add column if not exists estado_de_transcripcion text;
alter table negocio.llamadas add column if not exists vinculada_por text;
alter table negocio.llamadas add column if not exists corrida_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'llamadas_misma_cuenta_que_la_cita') then
    alter table negocio.llamadas add constraint llamadas_misma_cuenta_que_la_cita
      foreign key (org_id, cuenta_id, cita_id) references negocio.citas (org_id, cuenta_id, id) on delete set null (cita_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'llamadas_persona_de_la_organizacion') then
    alter table negocio.llamadas add constraint llamadas_persona_de_la_organizacion
      foreign key (org_id, persona_id) references identidad.usuarios (org_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'llamadas_direccion_valida') then
    alter table negocio.llamadas add constraint llamadas_direccion_valida check (direccion is null or direccion in ('entrante', 'saliente'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'llamadas_estado_de_transcripcion_valido') then
    alter table negocio.llamadas add constraint llamadas_estado_de_transcripcion_valido
      check (estado_de_transcripcion is null or estado_de_transcripcion in ('sin_grabar', 'pendiente', 'lista', 'fallida'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'llamadas_vinculada_por_valida') then
    alter table negocio.llamadas add constraint llamadas_vinculada_por_valida
      check (vinculada_por is null or vinculada_por in ('ghl', 'correo', 'cita', 'persona', 'agente'));
  end if;
end $$;
comment on column negocio.llamadas.tipo is 'Qué llamada es (catalogo.tipos_de_llamada): ia_voz, setter, venta, kickoff, coaching, onboarding (111). Nula en las de antes.';
comment on column negocio.llamadas.proveedor is 'Quién la grabó o la hizo (catalogo.proveedores): ghl, fathom, tldv, elevenlabs…';
comment on column negocio.llamadas.persona_id is 'Quién del equipo la hizo (el closer, el setter, el coach).';
comment on column negocio.llamadas.estado_de_transcripcion is 'sin_grabar, pendiente, lista (está en negocio.transcripciones) o fallida.';
comment on column negocio.llamadas.vinculada_por is 'Cómo se unió al lead y a la cita: ghl (vino con el contacto), correo, cita, persona o agente.';
comment on column negocio.llamadas.corrida_id is 'La corrida del agente que la registró, si fue un agente.';
create index if not exists llamadas_por_cita on negocio.llamadas (org_id, cuenta_id, cita_id) where cita_id is not null;
grant select, insert, update on negocio.llamadas to agente_mcp;

create table if not exists negocio.transcripciones (
  org_id        uuid not null references identidad.organizaciones (id),
  cuenta_id     uuid not null,
  id            uuid not null default gen_random_uuid(),
  llamada_id    uuid not null,
  texto         text not null check (length(texto) between 1 and 2000000),
  segmentos     jsonb not null default '[]'::jsonb,
  idioma        text check (idioma is null or length(idioma) <= 20),
  proveedor     catalogo.clave not null references catalogo.proveedores (clave),
  creada_el     timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint transcripciones_misma_cuenta_que_la_llamada
    foreign key (org_id, cuenta_id, llamada_id) references negocio.llamadas (org_id, cuenta_id, id) on delete cascade,
  check (jsonb_typeof(segmentos) = 'array')
);
create index if not exists transcripciones_por_llamada on negocio.transcripciones (org_id, cuenta_id, llamada_id, creada_el desc);
comment on table negocio.transcripciones is
  'La transcripción de cada llamada de negocio.llamadas (111), de sólo agregar: una corregida es una fila nueva y vale la última. Dato personal sensible.';
comment on column negocio.transcripciones.segmentos is 'Los turnos: [{hablante, desde_seg, hasta_seg, texto}]. Con ellos el Sales Coach cita el momento exacto.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.transcripciones', true);
revoke update, delete, truncate on negocio.transcripciones from app_inquilino;
grant select, insert on negocio.transcripciones to agente_mcp;

-- ─── 5 · La ficha del lead ───────────────────────────────────────────────────────

create table if not exists negocio.fichas_del_lead (
  org_id                uuid not null references identidad.organizaciones (id),
  cuenta_id             uuid not null,
  id                    uuid not null default gen_random_uuid(),
  contacto_id           uuid not null,
  cita_id               uuid,
  corrida_id            uuid not null,
  version               integer not null check (version >= 1),
  resumen               text not null check (length(resumen) between 1 and 4000),
  quien_es              jsonb not null default '[]'::jsonb,
  que_dijo              jsonb not null default '[]'::jsonb,
  estrategia            jsonb not null default '{}'::jsonb,
  alertas               jsonb not null default '[]'::jsonb,
  faltantes             jsonb not null default '[]'::jsonb,
  cuadrante_al_generar  catalogo.clave references catalogo.cuadrantes (clave),
  prioridad_al_generar  smallint,
  degradados            integer not null default 0 check (degradados >= 0),
  leida_por             uuid,
  leida_el              timestamptz,
  valoracion_del_closer text check (valoracion_del_closer in ('util', 'poco_util')),
  comentario_del_closer text check (comentario_del_closer is null or length(comentario_del_closer) <= 2000),
  creada_el             timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, cuenta_id, contacto_id, version),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  foreign key (org_id, leida_por) references identidad.usuarios (org_id, id),
  constraint fichas_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint fichas_misma_cuenta_que_la_cita
    foreign key (org_id, cuenta_id, cita_id) references negocio.citas (org_id, cuenta_id, id) on delete set null (cita_id),
  constraint fichas_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete cascade,
  check (jsonb_typeof(quien_es) = 'array' and jsonb_typeof(que_dijo) = 'array' and jsonb_typeof(estrategia) = 'object'
         and jsonb_typeof(alertas) = 'array' and jsonb_typeof(faltantes) = 'array')
);
comment on table negocio.fichas_del_lead is
  'La ficha del lead para el closer, del Sales Assistant (111): resumen, quién es, qué dijo, la estrategia de la llamada y las alertas. Versionada por lead; la vigente es la última (vista ficha_vigente). Sucede a negocio.briefs_del_closer.';
comment on column negocio.fichas_del_lead.estrategia is '{objetivo_de_la_llamada, angulo, ruta_recomendada, preguntas_clave[], objeciones_probables[{objecion, categoria, de_la_persona, fuente, respuesta_sugerida}], cierre_sugerido}.';
comment on column negocio.fichas_del_lead.alertas is 'Lo que no cuadra y el closer tiene que confirmar: [{descripcion, fuente_a, valor_a, fuente_b, valor_b, que_confirmar, gravedad}].';
comment on column negocio.fichas_del_lead.faltantes is 'Las fuentes esperadas que no existían (sin llamada del agente de voz, sin web).';
comment on column negocio.fichas_del_lead.leida_el is 'Cuándo la abrió el closer: para medir si se usa.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.fichas_del_lead', true);
revoke update, delete, truncate on negocio.fichas_del_lead from app_inquilino;
grant update (leida_por, leida_el, valoracion_del_closer, comentario_del_closer) on negocio.fichas_del_lead to app_inquilino;
grant select, insert on negocio.fichas_del_lead to agente_mcp;
grant update (leida_por, leida_el, valoracion_del_closer, comentario_del_closer) on negocio.fichas_del_lead to agente_mcp;

create or replace view negocio.ficha_vigente with (security_invoker = true) as
  select distinct on (f.org_id, f.cuenta_id, f.contacto_id) f.*
    from negocio.fichas_del_lead f
   order by f.org_id, f.cuenta_id, f.contacto_id, f.version desc;
comment on view negocio.ficha_vigente is 'La última ficha de cada lead (111).';
revoke all on negocio.ficha_vigente from public, app_inquilino;
grant select on negocio.ficha_vigente to app_inquilino, agente_mcp;

-- ─── 6 · El lead que llega después: también su triaje ────────────────────────────

create or replace function negocio.vincular_lo_del_agente() returns trigger
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
begin
  update negocio.corridas_de_agente
     set contacto_id = new.id
   where org_id = new.org_id and cuenta_id = new.cuenta_id and ghl_contact_id = new.ghl_contact_id and contacto_id is null;
  update negocio.triajes
     set contacto_id = new.id
   where org_id = new.org_id and cuenta_id = new.cuenta_id and ghl_contact_id = new.ghl_contact_id and contacto_id is null;
  return null;
end $$;

-- ─── 7 · Lo que el lead respondió, como fuentes citables ─────────────────────────

-- La última respuesta de cada pregunta del lead, como texto. Desde negocio.respuestas_del_lead_traducidas: las que
-- escribe el disparador de contactos llegan con la pregunta NULA y se traducen por el mapeo «campo» de la cuenta o del
-- snapshot. Las que traducen a una pregunta estándar son «formulario:{pregunta}»; las que no traducen (y no se ignoran)
-- son «campo:{fieldKey}», con el valor crudo. Una vaciada cuenta para saber cuál es la última y después se descarta.
create or replace function agentes._respuestas(p_org uuid, p_cuenta uuid, p_contacto uuid) returns jsonb
language sql stable security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
  select coalesce(jsonb_object_agg(r.clave, r.valor), '{}'::jsonb)
    from (select distinct on (x.clave) x.clave, x.vaciada,
                 coalesce(x.valor_texto, x.opcion::text, x.valor_numero::text || coalesce(' ' || x.moneda, ''),
                          x.valor_booleano::text, x.valor_fecha::text) as valor
            from (select t.*, case when t.pregunta is not null then 'formulario:' || t.pregunta
                                   else 'campo:' || coalesce(t.campo_clave, t.origen_clave) end as clave
                    from negocio.respuestas_del_lead_traducidas t
                   where t.org_id = p_org and t.cuenta_id = p_cuenta and t.contacto_id = p_contacto and not t.ignorada) x
           order by x.clave, x.observada_el desc, x.registrada_el desc) r
   where not r.vaciada and r.valor is not null
$$;

-- El primer y el último toque de marketing, sin identificadores de clic.
create or replace function agentes._atribucion(p_org uuid, p_cuenta uuid, p_contacto uuid) returns jsonb
language sql stable security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
  select coalesce(jsonb_object_agg('atribucion:' || t.posicion || '_toque', jsonb_strip_nulls(jsonb_build_object(
           'ocurrio_el', t.ocurrio_el, 'entrada', t.entrada, 'fuente', t.fuente, 'proveedor', t.proveedor,
           'campana', t.campana_id_externo, 'conjunto', t.conjunto_id_externo, 'anuncio', t.anuncio_id_externo,
           'formulario', t.formulario_nombre, 'utm_source', t.utm_source, 'utm_campaign', t.utm_campaign,
           'utm_content', t.utm_content, 'palabra_clave', t.palabra_clave, 'pieza_origen', t.pieza_origen))), '{}'::jsonb)
    from (select distinct on (x.posicion) x.* from negocio.toques_de_marketing x
           where x.org_id = p_org and x.cuenta_id = p_cuenta and x.contacto_id = p_contacto
           order by x.posicion, x.ocurrio_el desc) t
$$;

-- ─── 8 · Triage ──────────────────────────────────────────────────────────────────

create or replace function agentes.leer_triage(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v        negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_k      jsonb := agentes._conocimiento(v, array['icp', 'matriz_de_scoring', 'rutas']);
  v_fuentes jsonb := '{}'::jsonb;
  v_falta  jsonb := v_k -> 'faltantes';
  v_contacto negocio.contactos;
  v_lead   jsonb := null;
  v_rutas  jsonb;
  v_comp   jsonb;
  v_hist   jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('clave', r.clave, 'nombre', r.nombre, 'clase', r.clase,
           'precio_desde', r.precio_desde, 'precio_hasta', r.precio_hasta, 'moneda', r.moneda,
           'requiere_llamada', r.requiere_llamada, 'descripcion', r.descripcion) order by r.clave), '[]'::jsonb)
    into v_rutas from negocio.rutas_de_la_cuenta r
   where r.org_id = v.org_id and r.cuenta_id = v.cuenta_id and r.activa;
  if v_rutas = '[]'::jsonb then
    v_falta := v_falta || to_jsonb('rutas_de_la_cuenta'::text);
  end if;

  if v.contacto_id is not null then
    select * into v_contacto from negocio.contactos where org_id = v.org_id and cuenta_id = v.cuenta_id and id = v.contacto_id;
    v_fuentes := agentes._respuestas(v.org_id, v.cuenta_id, v.contacto_id) || agentes._atribucion(v.org_id, v.cuenta_id, v.contacto_id);
    if v_contacto.cuadrante is not null then
      v_fuentes := v_fuentes || jsonb_build_object('crm:cuadrante', v_contacto.cuadrante);
    end if;
    select jsonb_object_agg(e.tipo, e.n) into v_comp
      from (select tipo, count(*) as n from negocio.eventos
             where org_id = v.org_id and cuenta_id = v.cuenta_id and contacto_id = v.contacto_id
               and tipo in ('formulario_enviado', 'visita_landing', 'vsl_visto', 'clic_anuncio', 'respondio_video', 'mensaje_entrante')
             group by tipo) e;
    select coalesce(jsonb_agg(jsonb_build_object('cuadrante', c.cuadrante, 'anterior', c.cuadrante_anterior, 'origen', c.origen,
             'el', c.clasificado_el) order by c.clasificado_el), '[]'::jsonb)
      into v_hist from negocio.clasificaciones c
     where c.org_id = v.org_id and c.cuenta_id = v.cuenta_id and c.contacto_id = v.contacto_id;
    v_fuentes := v_fuentes || jsonb_build_object('comportamiento:conteos', coalesce(v_comp, '{}'::jsonb),
                                                 'historia:clasificaciones', v_hist);
    v_lead := jsonb_build_object(
      'cuadrante_del_crm', v_contacto.cuadrante, 'etapa', v_contacto.etapa_estandar, 'salida', v_contacto.salida,
      'canal_de_entrada', v_contacto.canal_de_entrada, 'fuente', v_contacto.fuente_estandar, 'pais', v_contacto.pais,
      'no_contactar', v_contacto.no_contactar_desde is not null, 'alta_en_el_crm', v_contacto.alta_en_el_crm);
    if not exists (select 1 from jsonb_object_keys(v_fuentes) k where k like 'formulario:%' or k like 'campo:%') then
      v_falta := v_falta || to_jsonb('respuestas_del_formulario'::text);
    elsif not exists (select 1 from jsonb_object_keys(v_fuentes) k where k like 'formulario:%') then
      -- Llegaron respuestas, pero ninguna se tradujo a una pregunta estándar: falta el mapeo «campo» de la cuenta.
      v_falta := v_falta || to_jsonb('respuestas_sin_traducir'::text);
    end if;
  else
    v_falta := v_falta || to_jsonb('contacto_en_la_base'::text);
  end if;

  perform agentes._anotar_lectura(v, v_fuentes || (v_k -> 'fuentes'), v_k -> 'versiones');
  return jsonb_build_object(
    'corrida_id', v.id, 'agente', 'triage', 'lead', v_lead,
    'fuentes', v_fuentes, 'conocimiento', v_k -> 'conocimiento', 'rutas', v_rutas,
    'cuadrantes', (select jsonb_agg(jsonb_build_object('clave', clave, 'encaje', encaje, 'capacidad', capacidad, 'descripcion', descripcion) order by orden) from catalogo.cuadrantes where vigente),
    'faltantes', v_falta,
    'contrato', 'agentes.registrar_triage(corrida_id, {prioridad 1-10, ruta | ruta_clase, razones[], datos_dudosos[], faltantes[], confianza, cuadrante_propuesto?, ejes?, knockouts?})');
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
    'escribir_en_ghl', jsonb_build_object('prioridad', v_prioridad, 'ruta', coalesce(v_ruta, v_clase)));
end $$;

-- ─── 9 · Sales Assistant ─────────────────────────────────────────────────────────

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
   where ci.org_id = v.org_id and ci.cuenta_id = v.cuenta_id
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

  -- Las objeciones más frecuentes de la cuenta en 90 días (sin texto: sólo la categoría).
  select coalesce(jsonb_object_agg(categoria, n), '{}'::jsonb) into v_obj
    from (select o.categoria, count(*) as n from negocio.objeciones_clasificadas o
           where o.org_id = v.org_id and o.cuenta_id = v.cuenta_id and o.clasificada_el > now() - interval '90 days'
           group by o.categoria) x;
  v_fuentes := v_fuentes || jsonb_build_object('objeciones_frecuentes', v_obj);

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

-- Cuando el closer abre la ficha (y, si quiere, dice si le sirvió). La llama la pantalla o el agente de GHL.
create or replace function agentes.marcar_ficha_leida(p_ficha uuid, p_usuario uuid default null,
  p_valoracion text default null, p_comentario text default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  f negocio.fichas_del_lead;
  v_sesion text := nullif(btrim(current_setting('app.org_id', true)), '');
begin
  select * into f from negocio.fichas_del_lead where id = p_ficha;
  if not found then raise exception using errcode = 'P0002', message = 'agentes: la ficha no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> f.org_id then
    raise exception using errcode = '42501', message = 'agentes: la ficha es de otra organización que la de la sesión';
  end if;
  update negocio.fichas_del_lead
     set leida_el = coalesce(leida_el, now()), leida_por = coalesce(leida_por, p_usuario),
         valoracion_del_closer = coalesce(p_valoracion, valoracion_del_closer),
         comentario_del_closer = coalesce(p_comentario, comentario_del_closer)
   where org_id = f.org_id and cuenta_id = f.cuenta_id and id = f.id;
  if f.leida_el is null then
    perform agentes._registrar_evento(f.org_id,
    f.cuenta_id,
    'ficha_leida',
    f.contacto_id,
    'persona',
    p_usuario::text,
    'comando_central',
    'ficha_leida:' || f.id,
    jsonb_build_object('ficha_id', f.id),
    now());
  end if;
  return jsonb_build_object('ok', true, 'ficha_id', f.id);
end $$;

-- Las rutas comerciales de una cuenta (Accelerator, low ticket, nutrición): las carga el equipo, con quién las aprueba.
-- p_rutas: [{clave, nombre, clase, precio_desde, precio_hasta, moneda, requiere_llamada, descripcion, activa}].
-- Las que no vienen no se tocan; para retirar una, activa = false.
create or replace function agentes.cargar_rutas(p_cuenta_id uuid, p_rutas jsonb, p_aprobado_por uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v_org    uuid;
  v_sesion text := nullif(btrim(current_setting('app.org_id', true)), '');
  x        jsonb;
  n        integer := 0;
begin
  select org_id into v_org from identidad.cuentas where id = p_cuenta_id;
  if v_org is null then raise exception using errcode = 'P0002', message = 'agentes: la cuenta no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> v_org then
    raise exception using errcode = '42501', message = 'agentes: la cuenta es de otra organización que la de la sesión';
  end if;
  if p_aprobado_por is null or not exists (select 1 from identidad.usuarios u where u.org_id = v_org and u.id = p_aprobado_por) then
    raise exception using errcode = '22023', message = 'agentes: las rutas las aprueba una persona de la organización';
  end if;
  if jsonb_typeof(p_rutas) <> 'array' then
    raise exception using errcode = '22023', message = 'agentes: las rutas son una lista';
  end if;
  for x in select value from jsonb_array_elements(p_rutas) loop
    if coalesce(x ->> 'clave', '') !~ '^[a-z0-9][a-z0-9_]{0,59}$' or not exists (select 1 from catalogo.clases_de_ruta where clave = x ->> 'clase')
       or coalesce(btrim(x ->> 'nombre'), '') = '' or agentes._numero_malo(x -> 'precio_desde', 0, 9999999999)
       or agentes._numero_malo(x -> 'precio_hasta', 0, 9999999999) or agentes._booleano_malo(x -> 'requiere_llamada')
       or agentes._booleano_malo(x -> 'activa') then
      raise exception using errcode = '22023',
        message = format('agentes: la ruta «%s» necesita clave (minúsculas y _), nombre, clase (alto_ticket, bajo_ticket o nutricion) y precios válidos', x ->> 'clave');
    end if;
    insert into negocio.rutas_de_la_cuenta (org_id, cuenta_id, clave, nombre, clase, precio_desde, precio_hasta, moneda,
                                            requiere_llamada, descripcion, activa)
    values (v_org, p_cuenta_id, x ->> 'clave', left(x ->> 'nombre', 120), x ->> 'clase', agentes._numero(x ->> 'precio_desde'),
            agentes._numero(x ->> 'precio_hasta'), upper(x ->> 'moneda'), coalesce(agentes._booleano(x -> 'requiere_llamada'), true),
            left(x ->> 'descripcion', 4000), coalesce(agentes._booleano(x -> 'activa'), true))
    on conflict (org_id, cuenta_id, clave) do update
       set nombre = excluded.nombre, clase = excluded.clase, precio_desde = excluded.precio_desde,
           precio_hasta = excluded.precio_hasta, moneda = excluded.moneda, requiere_llamada = excluded.requiere_llamada,
           descripcion = excluded.descripcion, activa = excluded.activa;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'rutas', n);
end $$;

-- ─── 10 · Registrar una llamada con su transcripción ─────────────────────────────
-- No necesita corrida: la llama el agente de GHL (o un workflow) cuando una llamada termina y su grabación está
-- transcrita. Es idempotente por (organización, id externo). Con transcripción, emite transcripcion_lista: el
-- disparador del Sales Coach (las de venta) y un dato nuevo para el Sales Assistant (las del agente de voz y el setter).
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
    select ci.id into v_cita from negocio.citas ci where ci.org_id = v_org and ci.cuenta_id = v_cuenta and ci.ghl_evento_id = p_ghl_evento_id;
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
      insert into negocio.transcripciones (org_id, cuenta_id, id, llamada_id, texto, segmentos, idioma, proveedor)
      values (v_org, v_cuenta, v_trans, v_id, p_transcripcion, coalesce(p_segmentos, '[]'::jsonb), p_idioma, coalesce(p_proveedor, 'ghl'));
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

-- ─── 11 · Permisos de las funciones nuevas ───────────────────────────────────────

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
