-- La cuenta por omisión: la que recibe todo lo que entra con las credenciales de la empresa.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, Paso 1, 2026-10-18)
--
-- El nivel 3 son los clientes de cada empresa: varias cuentas (subcuentas del CRM) dentro de una organización. La Fase
-- 0 dejó un puente, `negocio.completar_cuenta`, que pone la cuenta de cada fila nueva que no la trae: la del contacto,
-- o la ÚNICA cuenta activa de la organización. Con dos cuentas activas falla («falta cuenta_id … tiene 2 cuentas
-- activas»), y eso, hoy, es casi toda la ingesta: los contactos, el pulso, las campañas, el gasto. Dar de alta el
-- segundo cliente de una empresa cortaría su ingesta.
--
-- Mientras la ingesta siga siendo por empresa —un token del CRM, una cuenta de Meta—, lo que entra es de la cuenta que
-- tiene esas credenciales: la que nació con la organización. Esta migración la nombra:
--
--   · `es_por_omision`, una por organización (índice único parcial), y siempre activa (un `check`): una por omisión
--     pausada dejaría a la empresa sin dónde poner lo que entra;
--   · el puente de la organización (`crear_cuenta_inicial`) la crea marcada;
--   · y `completar_cuenta` cae en ella cuando hay más de una activa visible. Las cuentas que ve son las de la sesión
--     (la política `cuentas_propias_lee` corre como quien inserta): con una sola cuenta en la sesión —el foco de la
--     empresa en un cliente, o el barrido de un cliente— elige ésa; con varias, la por omisión; si la por omisión no se
--     ve, falla, como antes. Nada mal archivado queda en silencio.
--
-- Las cuentas que ya existen reciben su marca con la fase `cuenta-por-omision` (`db/arranque/006_la_cuenta_por_omision.sql`,
-- como app_identidad): el migrador no ve filas.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.cuentas add column if not exists es_por_omision boolean not null default false;
comment on column identidad.cuentas.es_por_omision is
  'La cuenta que recibe lo que entra con las credenciales de la organización, y la que el puente elige cuando una fila no dice de qué cuenta es. Una por organización, siempre activa.';

create unique index if not exists cuentas_una_por_omision on identidad.cuentas (org_id) where es_por_omision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cuentas_la_por_omision_esta_activa'
                   and conrelid = 'identidad.cuentas'::regclass) then
    alter table identidad.cuentas
      add constraint cuentas_la_por_omision_esta_activa check (not es_por_omision or estado = 'activa');
  end if;
end $$;

-- ─── La organización nace con su cuenta, y ésa es la por omisión ─────────────────

-- Un alta no se cae por la cuenta: el nombre se recorta a los 120 que admite la cuenta, un slug que queda vacío (una
-- organización con sólo símbolos) pasa a uno de respaldo, y una zona que no existe pasa a UTC (el disparador de la
-- cuenta la rechazaría). La location del CRM se copia si la organización ya tiene sus credenciales; casi nunca las
-- tiene al nacer, así que la copia de verdad la hace el disparador de abajo, al cargarlas.
create or replace function identidad.crear_cuenta_inicial() returns trigger
language plpgsql as $$
declare
  v_slug  text;
  v_zona  text;
  v_crm   text;
begin
  v_slug := left(btrim(regexp_replace(lower(coalesce(new.slug, '')), '[^a-z0-9-]+', '-', 'g'), '-'), 60);
  if v_slug !~ '^[a-z0-9][a-z0-9-]{0,59}$' then
    v_slug := 'cuenta-' || left(replace(new.id::text, '-', ''), 12);
  end if;
  v_zona := coalesce(nullif(btrim(new.zona_horaria), ''), 'UTC');
  if not exists (select 1 from pg_timezone_names where name = v_zona) then
    v_zona := 'UTC';
  end if;
  -- Quien da el alta externa (una función de `postgres`) puede no tener permiso sobre las credenciales: entonces no se
  -- copia nada, y el alta sigue.
  begin
    select cr.crm_cuenta_id into v_crm
      from identidad.organizaciones_credenciales cr
     where cr.org_id = new.id and cr.crm_cuenta_id is not null
       and not exists (select 1 from identidad.cuentas c where c.crm = 'ghl' and c.crm_cuenta_id = cr.crm_cuenta_id);
  exception when insufficient_privilege then
    v_crm := null;
  end;
  insert into identidad.cuentas (org_id, nombre, slug, zona_horaria, es_por_omision, crm_cuenta_id)
  values (new.id, coalesce(nullif(left(btrim(new.nombre), 120), ''), 'Cuenta'), v_slug, v_zona, true, v_crm);
  return null;
end $$;
comment on function identidad.crear_cuenta_inicial() is
  'PUENTE de la Fase 0: cada organización nueva nace con una cuenta, que es su cuenta por omisión (nombre recortado a 120, slug de respaldo, zona válida o UTC, y la location del CRM si ya está cargada). Se retira cuando el alta de organizaciones cree sus cuentas.';

-- La location del CRM de la empresa llega cuando se cargan sus credenciales (Ajustes › Credenciales), después de que
-- la organización nació. Se copia a su cuenta por omisión si todavía no tiene una y si ninguna otra cuenta la usa (la
-- location es única en la plataforma): es lo mismo que hace la fase `cuentas` con las que ya existían. Corre como
-- quien carga las credenciales (app_identidad), que tiene política sobre las cuentas.
create or replace function identidad.copiar_location_a_la_cuenta() returns trigger
language plpgsql as $$
begin
  update identidad.cuentas c
     set crm_cuenta_id = new.crm_cuenta_id
   where c.org_id = new.org_id
     and c.es_por_omision
     and c.crm_cuenta_id is null
     and not exists (select 1 from identidad.cuentas x where x.crm = c.crm and x.crm_cuenta_id = new.crm_cuenta_id);
  return null;
end $$;
comment on function identidad.copiar_location_a_la_cuenta() is
  'Copia organizaciones_credenciales.crm_cuenta_id a la cuenta por omisión de la organización, si no tiene location y nadie más la usa.';
drop trigger if exists credenciales_copian_la_location on identidad.organizaciones_credenciales;
create trigger credenciales_copian_la_location
  after insert or update of crm_cuenta_id on identidad.organizaciones_credenciales
  for each row when (new.crm_cuenta_id is not null)
  execute function identidad.copiar_location_a_la_cuenta();

-- ─── El puente de negocio: la cuenta visible, o la por omisión ──────────────────

create or replace function negocio.completar_cuenta() returns trigger
language plpgsql as $$
declare
  v_contacto uuid;
  v_cuenta   uuid;
  v_cuantas  int;
begin
  if tg_op = 'UPDATE' then
    if old.cuenta_id is not null and new.cuenta_id is distinct from old.cuenta_id then
      raise exception '%.cuenta_id no se puede cambiar (fila de la cuenta %).', tg_table_name, old.cuenta_id;
    end if;
    return new;
  end if;
  if new.cuenta_id is not null then
    return new;
  end if;
  v_contacto := nullif(to_jsonb(new) ->> 'contacto_id', '')::uuid;
  if v_contacto is not null then
    select c.cuenta_id into v_cuenta from negocio.contactos c where c.org_id = new.org_id and c.id = v_contacto;
  end if;
  if v_cuenta is null and tg_argv[0] = 'obligatoria' then
    -- Las cuentas activas que ve la sesión: con una sola, ésa.
    select count(*), min(id::text)::uuid into v_cuantas, v_cuenta
      from identidad.cuentas where org_id = new.org_id and estado = 'activa';
    if v_cuantas <> 1 then
      -- Con varias (o ninguna), la por omisión, si la sesión la ve.
      select id into v_cuenta from identidad.cuentas where org_id = new.org_id and es_por_omision;
      if v_cuenta is null then
        raise exception '%: falta cuenta_id y la organización % tiene % cuentas activas y ninguna por omisión a la vista.',
          tg_table_name, new.org_id, v_cuantas;
      end if;
    end if;
  end if;
  new.cuenta_id := v_cuenta;
  return new;
end $$;
comment on function negocio.completar_cuenta() is
  'PUENTE de la Fase 0: completa cuenta_id (desde el contacto, la única cuenta activa a la vista o la cuenta por omisión) e impide cambiarla. Se retira cuando todo el código la mande.';
