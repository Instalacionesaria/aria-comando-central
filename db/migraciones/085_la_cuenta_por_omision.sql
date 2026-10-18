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

create or replace function identidad.crear_cuenta_inicial() returns trigger
language plpgsql as $$
begin
  insert into identidad.cuentas (org_id, nombre, slug, zona_horaria, es_por_omision)
  values (new.id, new.nombre,
          left(btrim(regexp_replace(lower(new.slug), '[^a-z0-9-]+', '-', 'g'), '-'), 60),
          coalesce(nullif(new.zona_horaria, ''), 'UTC'),
          true);
  return null;
end $$;
comment on function identidad.crear_cuenta_inicial() is
  'PUENTE de la Fase 0: cada organización nueva nace con una cuenta, que es su cuenta por omisión. Se retira cuando el alta de organizaciones cree sus cuentas.';

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
