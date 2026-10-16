-- Las cuentas: el nivel 2 del modelo multiempresa, la subcuenta de GoHighLevel dentro de su agencia.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (modelo de datos multiempresa, Fase 0 · Paso 3, 2026-10-16)
--
-- Hoy cada organización ES una subcuenta: el token del CRM, su calendario, su cuenta de Meta viven en
-- organizaciones_credenciales. Una agencia real tiene muchas subcuentas —una por cliente final—, y sin la cuenta como
-- entidad no hay nivel 2, ni agencias con varias subcuentas, ni nicho por negocio. Esta migración la crea:
--
--   · identidad.cuentas, una por organización por ahora (la misma location del CRM), y el puente que hace nacer
--     la cuenta junto con cada organización nueva. Las que ya existen reciben la suya con la fase `cuentas` del
--     arranque (`db/arranque/004_las_cuentas_iniciales.sql`), como app_identidad;
--   · identidad.cuentas_credenciales, con las credenciales COPIADAS: organizaciones_credenciales sigue intacta y el
--     código la sigue leyendo. Se borra de allá en la contracción, cuando nada la lea;
--   · identidad.usuarios_cuentas (sin filas = un usuario entra a todas las cuentas de su organización) y
--     identidad.acuerdos (lo que firmó cada organización, con la participación en benchmarks);
--   · tipo, nicho_principal y pais en organizaciones.
--
-- Sólo agrega. No toca negocio: la cuenta en cada tabla de negocio es otra migración.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── La organización: qué tipo es y de qué nicho ─────────────────────────────────

-- La principal es la plataforma (ARIA, nivel 0); todas las demás son agencias (nivel 1). `tipo` es GENERADA desde
-- `es_principal` y no una columna con su propio valor: con un valor por omisión 'agencia' y un `check` que la ate a
-- `es_principal`, el alta de la organización principal —el sembrado, o cualquier alta que no mande `tipo`— fallaría.
-- Generada, no puede contradecirla, y ningún código tiene que aprender a mandarla.
alter table identidad.organizaciones
  add column if not exists tipo text generated always as (case when es_principal then 'plataforma' else 'agencia' end) stored,
  add column if not exists nicho_principal catalogo.clave references catalogo.nichos (clave),
  add column if not exists pais char(2) references catalogo.paises (codigo);

comment on column identidad.organizaciones.tipo is
  'plataforma = ARIA (nivel 0, la organización principal); agencia = un cliente de ARIA (nivel 1). Generada desde es_principal: no se escribe.';
comment on column identidad.organizaciones.nicho_principal is
  'El nicho al que más se dedica la agencia («las agencias DE clínicas»). Se calcula desde sus cuentas y se puede fijar a mano.';
comment on column identidad.organizaciones.pais is 'País de la agencia (no el de sus clientes, que va en cada cuenta).';

-- ─── La cuenta: el nivel 2 ───────────────────────────────────────────────────────

create table if not exists identidad.cuentas (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references identidad.organizaciones (id) on delete cascade,
  nombre                 text not null check (length(btrim(nombre)) between 1 and 120),
  slug                   text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  crm                    text not null default 'ghl' check (crm in ('ghl')),
  crm_cuenta_id          text check (crm_cuenta_id is null or length(crm_cuenta_id) between 1 and 100),
  nicho                  catalogo.clave references catalogo.nichos (clave),
  nicho_confirmado_el    timestamptz,
  nicho_confirmado_por   uuid,
  modelo_de_negocio      catalogo.clave references catalogo.modelos_de_negocio (clave),
  pais                   char(2) references catalogo.paises (codigo),
  moneda                 char(3) references catalogo.monedas (codigo),
  zona_horaria           text not null default 'UTC',
  snapshot_version_id    uuid references catalogo.snapshot_versiones (id),
  es_prueba              boolean not null default false,
  estado                 text not null default 'activa' check (estado in ('activa', 'pausada', 'baja')),
  alta_el                timestamptz not null default now(),
  baja_el                timestamptz,
  creado_el              timestamptz not null default now(),
  actualizado_el         timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, slug),
  unique (crm, crm_cuenta_id),
  foreign key (org_id, nicho_confirmado_por) references identidad.usuarios (org_id, id),
  check ((estado = 'baja') = (baja_el is not null)),
  check ((nicho_confirmado_el is null) = (nicho_confirmado_por is null)),
  check (nicho_confirmado_el is null or nicho is not null)
);
comment on table identidad.cuentas is
  'Cada subcuenta del CRM: un negocio (la clínica, la inmobiliaria). Es el nivel 2 del flujo y la segunda llave (cuenta_id) de toda fila de negocio. ARIA tiene las suyas, como cualquier agencia.';
comment on column identidad.cuentas.crm_cuenta_id is 'La location de GoHighLevel. Única en toda la plataforma: una subcuenta es de una sola cuenta.';
comment on column identidad.cuentas.nicho is 'El nicho del negocio. Lo sugiere la IA desde Fundaciones y lo confirma una persona; sin confirmar, la cuenta no entra a benchmarks.';
comment on column identidad.cuentas.zona_horaria is 'Zona IANA de la cuenta: define el «día» de todos sus hechos diarios.';
comment on column identidad.cuentas.snapshot_version_id is 'La versión de S0 instalada: de ahí salen sus mapeos al idioma común.';
comment on column identidad.cuentas.es_prueba is 'true = sandbox o demo. No entra a ninguna métrica agregada ni a ningún benchmark.';

create index if not exists cuentas_por_nicho on identidad.cuentas (nicho) where estado = 'activa' and not es_prueba;

-- La zona horaria tiene que existir: un día local mal calculado corre todos los hechos de la cuenta.
create or replace function identidad.cuenta_zona_valida() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.zona_horaria) then
    raise exception 'La zona horaria «%» no existe.', new.zona_horaria;
  end if;
  new.actualizado_el := now();
  return new;
end $$;
drop trigger if exists cuentas_zona_valida on identidad.cuentas;
create trigger cuentas_zona_valida before insert or update on identidad.cuentas
  for each row execute function identidad.cuenta_zona_valida();

alter table identidad.cuentas enable row level security;
alter table identidad.cuentas force row level security;
revoke all on identidad.cuentas from public;
grant select, insert, update, delete on identidad.cuentas to app_identidad;
grant select, update (nombre, nicho, nicho_confirmado_el, nicho_confirmado_por, modelo_de_negocio, pais, moneda, zona_horaria)
  on identidad.cuentas to app_inquilino;

drop policy if exists cuentas_identidad on identidad.cuentas;
create policy cuentas_identidad on identidad.cuentas for all to app_identidad using (true) with check (true);

-- El inquilino ve las cuentas de su organización, y si la sesión está limitada a algunas (nivel 2), sólo ésas.
drop policy if exists cuentas_propias_lee on identidad.cuentas;
create policy cuentas_propias_lee on identidad.cuentas for select to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
         and ((select current_setting('app.cuentas', true)) = '*'
              or id = any (cast((select string_to_array(nullif(current_setting('app.cuentas', true), '*'), ',')) as uuid[]))));
drop policy if exists cuentas_propias_edita on identidad.cuentas;
create policy cuentas_propias_edita on identidad.cuentas for update to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
         and (select current_setting('app.cuentas', true)) = '*')
  with check (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

-- ─── Las credenciales de la cuenta ──────────────────────────────────────────────

create table if not exists identidad.cuentas_credenciales (
  org_id                 uuid not null,
  cuenta_id              uuid not null,
  crm_token_cifrado      text,
  crm_refresh_cifrado    text,
  crm_expira_el          timestamptz,
  crm_estado             text not null default 'ausente' check (crm_estado in ('ausente', 'activa', 'vencida', 'revocada')),
  crm_calendario_id      text,
  crm_dominio_reservas   text,
  crm_agente_usuario_id  text,
  aviso_secreto_hash     text,
  meta_cuenta_id         text,
  meta_token_cifrado     text,
  actualizado_el         timestamptz not null default now(),
  actualizado_por        uuid,
  primary key (cuenta_id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id) on delete cascade,
  foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
);
comment on table identidad.cuentas_credenciales is
  'Las credenciales que son de la subcuenta (el token del CRM, su calendario, su cuenta de Meta, el secreto de sus avisos). Hasta hoy vivían en organizaciones_credenciales porque cada organización tenía una sola subcuenta. Todo cifrado con CLAVE_MAESTRA.';
comment on column identidad.cuentas_credenciales.aviso_secreto_hash is 'Hash del secreto con el que el CRM firma los avisos de ESTA subcuenta: dice de qué cuenta es un aviso.';

alter table identidad.cuentas_credenciales enable row level security;
alter table identidad.cuentas_credenciales force row level security;
revoke all on identidad.cuentas_credenciales from public;
grant select, insert, update, delete on identidad.cuentas_credenciales to app_identidad;
drop policy if exists cuentas_credenciales_identidad on identidad.cuentas_credenciales;
create policy cuentas_credenciales_identidad on identidad.cuentas_credenciales for all to app_identidad using (true) with check (true);

-- ─── Qué cuentas ve un usuario (nivel 2) ─────────────────────────────────────────

create table if not exists identidad.usuarios_cuentas (
  org_id         uuid not null,
  usuario_id     uuid not null,
  cuenta_id      uuid not null,
  concedida_el   timestamptz not null default now(),
  concedida_por  uuid,
  primary key (usuario_id, cuenta_id),
  foreign key (org_id, usuario_id) references identidad.usuarios (org_id, id) on delete cascade,
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id) on delete cascade,
  foreign key (org_id, concedida_por) references identidad.usuarios (org_id, id)
);
comment on table identidad.usuarios_cuentas is
  'Sin filas para un usuario = entra a todas las cuentas de su organización. Con filas = sólo a ésas (el usuario de un cliente final). La sesión lo traduce a app.cuentas.';

alter table identidad.usuarios_cuentas enable row level security;
alter table identidad.usuarios_cuentas force row level security;
revoke all on identidad.usuarios_cuentas from public;
grant select, insert, delete on identidad.usuarios_cuentas to app_identidad;
drop policy if exists usuarios_cuentas_identidad on identidad.usuarios_cuentas;
create policy usuarios_cuentas_identidad on identidad.usuarios_cuentas for all to app_identidad using (true) with check (true);

-- ─── Los acuerdos firmados ──────────────────────────────────────────────────────

create table if not exists identidad.acuerdos (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references identidad.organizaciones (id) on delete cascade,
  tipo                      text not null check (tipo in ('terminos', 'tratamiento_de_datos', 'benchmarks')),
  version                   text not null check (version ~ '^[0-9]{4}-[0-9]{2}(-[0-9]+)?$'),
  aceptado_el               timestamptz not null default now(),
  aceptado_por              uuid,
  participa_en_benchmarks   boolean,
  revocado_el               timestamptz,
  unique (org_id, tipo, version),
  foreign key (org_id, aceptado_por) references identidad.usuarios (org_id, id),
  check ((tipo = 'benchmarks') = (participa_en_benchmarks is not null))
);
comment on table identidad.acuerdos is
  'Lo que firmó cada organización y en qué versión: términos, tratamiento de datos (DPA) y la participación en benchmarks. Nunca se edita: un cambio es una fila nueva; una baja, revocado_el.';
comment on column identidad.acuerdos.version is 'La versión del texto firmado, por fecha: 2026-11 o 2026-11-2.';
comment on column identidad.acuerdos.participa_en_benchmarks is 'Sólo en los acuerdos de tipo benchmarks: si los datos agregados de la organización entran al cálculo.';

alter table identidad.acuerdos enable row level security;
alter table identidad.acuerdos force row level security;
revoke all on identidad.acuerdos from public;
grant select, insert, update (revocado_el) on identidad.acuerdos to app_identidad;
drop policy if exists acuerdos_identidad on identidad.acuerdos;
create policy acuerdos_identidad on identidad.acuerdos for all to app_identidad using (true) with check (true);

-- Lo vigente: el último acuerdo de benchmarks no revocado de cada organización. Sin fila = no participa.
create or replace view identidad.participacion_en_benchmarks with (security_invoker = true) as
  select distinct on (a.org_id) a.org_id, a.participa_en_benchmarks as participa, a.version, a.aceptado_el
    from identidad.acuerdos a
   where a.tipo = 'benchmarks' and a.revocado_el is null
   order by a.org_id, a.aceptado_el desc;
comment on view identidad.participacion_en_benchmarks is
  'Si cada organización participa HOY en los benchmarks. La lee la política de app_analista: una organización sin fila no participa.';

-- `security_invoker`: la vista corre con los permisos de QUIEN la lee, no de su dueño. Con el dueño (migrador, sin
-- política en acuerdos y con la RLS forzada) devolvería cero filas sin error, y nadie participaría nunca. Quien la
-- lee es el cálculo de benchmarks, con una política propia de sólo lectura sobre los acuerdos de benchmarks.
grant usage on schema identidad to app_analista;
grant select on identidad.acuerdos, identidad.cuentas to app_analista;
grant select on identidad.participacion_en_benchmarks to app_analista;
drop policy if exists acuerdos_analista on identidad.acuerdos;
create policy acuerdos_analista on identidad.acuerdos for select to app_analista using (tipo = 'benchmarks');
drop policy if exists cuentas_analista on identidad.cuentas;
create policy cuentas_analista on identidad.cuentas for select to app_analista using (true);

-- ─── El puente: la organización nace con su cuenta ───────────────────────────────

-- Las organizaciones que ya existen reciben la suya con `db/arranque/004_las_cuentas_iniciales.sql`, que corre
-- como app_identidad (`node scripts/db.mjs cuentas`): escribir en una tabla con la RLS forzada no se hace desde
-- una migración, porque el migrador no tiene política y quitarle el forzado deja la tabla evadible.

-- Y toda organización que nazca desde ahora nace con su cuenta, mientras el alta de organizaciones (Ajustes, el
-- alta externa, el sembrado) no sepa de cuentas. Sin esto, cuando la cuenta pase a ser obligatoria en negocio, el
-- primer contacto de una organización nueva no tendría de qué cuenta ser (lo encontró la corrida de la suite contra
-- el modelo: las pruebas crean organizaciones).
-- Corre como quien crea la organización (app_identidad), que tiene política sobre cuentas.
create or replace function identidad.crear_cuenta_inicial() returns trigger
language plpgsql as $$
begin
  insert into identidad.cuentas (org_id, nombre, slug, zona_horaria)
  values (new.id, new.nombre,
          left(btrim(regexp_replace(lower(new.slug), '[^a-z0-9-]+', '-', 'g'), '-'), 60),
          coalesce(nullif(new.zona_horaria, ''), 'UTC'));
  return null;
end $$;
comment on function identidad.crear_cuenta_inicial() is
  'PUENTE de la Fase 0: cada organización nueva nace con una cuenta. Se retira cuando el alta de organizaciones cree sus cuentas.';
drop trigger if exists organizaciones_crean_su_cuenta on identidad.organizaciones;
create trigger organizaciones_crean_su_cuenta after insert on identidad.organizaciones
  for each row execute function identidad.crear_cuenta_inicial();

-- El alta externa de organizaciones (la de Fundaciones, por n8n) corre en una función `security definer` de
-- `postgres`, que se salta la RLS pero necesita permiso sobre cada tabla. Sin éste, el puente de arriba haría fallar
-- esa alta entera. Medido en producción el 2026-10-16: `postgres` tiene `insert` sobre identidad.organizaciones.
grant select, insert on identidad.cuentas to postgres;
