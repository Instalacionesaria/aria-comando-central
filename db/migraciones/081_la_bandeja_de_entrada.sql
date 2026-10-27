-- La bandeja de entrada: lo crudo, por una sola puerta. Los esquemas `sistema` e `ingesta`.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (modelo de datos multiempresa, Fase 0 · Paso 4, 2026-10-16)
--
-- Todo lo que llega de afuera —GoHighLevel por n8n o por aviso directo, Meta, Fathom, el script de las landings— se
-- va a guardar primero acá, tal cual, y después se interpreta. Así una regla que cambia se reprocesa hacia atrás sin
-- pedirle nada al proveedor, y un error del intérprete no pierde el dato. Hoy eso existe sólo para los avisos de
-- GoHighLevel (negocio.avisos_del_crm), que pasa a ser una fuente más cuando el normalizador llegue (Fase 1).
--
-- Nada usa esto todavía. La puerta, `ingesta.recibir`, la ejecuta sólo el rol `ingestor`, que no lee nada, ni lo que
-- él mismo entregó; y nace sin login (arranque, 1b): la credencial llega con el servicio que la use.
--
-- `sistema` trae la herramienta de las particiones mensuales, que usan esta bandeja y, después, los eventos.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── sistema ─────────────────────────────────────────────────────────────────────

create schema if not exists sistema;
comment on schema sistema is 'Cómo corre la plataforma: particiones, costos, y (más adelante) tareas, salud de la ingesta e incidentes.';

-- Crea las particiones mensuales que falten de una tabla particionada por rango de un timestamptz. Los límites van
-- en UTC: una partición es un mes UTC, y el «día local» de una cuenta se calcula al leer, no al particionar.
-- Idempotente: una partición que ya existe se saltea. La corre cada migración que crea una tabla particionada; hasta
-- 72 meses de una vez, para que una sola llamada cubra los meses pasados de un relleno y los tres años siguientes.
create or replace function sistema.crear_particiones(p_tabla regclass, p_desde date, p_meses int)
returns int
language plpgsql as $$
declare
  v_esquema  text;
  v_nombre   text;
  v_mes      date := date_trunc('month', p_desde)::date;
  v_creadas  int := 0;
  v_hija     text;
begin
  if p_meses < 1 or p_meses > 72 then
    raise exception 'crear_particiones: p_meses fuera de rango (%)', p_meses;
  end if;
  select n.nspname, c.relname into v_esquema, v_nombre
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.oid = p_tabla and c.relkind = 'p';
  if v_nombre is null then
    raise exception 'crear_particiones: % no es una tabla particionada', p_tabla;
  end if;
  for i in 0 .. p_meses - 1 loop
    v_hija := format('%s_%s', v_nombre, to_char(v_mes + make_interval(months => i), 'YYYY_MM'));
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = v_esquema and c.relname = v_hija) then
      execute format(
        'create table %I.%I partition of %s for values from (%L) to (%L)',
        v_esquema, v_hija, p_tabla,
        (v_mes + make_interval(months => i))::timestamp at time zone 'UTC',
        (v_mes + make_interval(months => i + 1))::timestamp at time zone 'UTC');
      -- Las particiones no se leen nunca directo: todo pasa por la tabla madre, que es la que tiene la RLS.
      execute format('revoke all on %I.%I from public', v_esquema, v_hija);
      v_creadas := v_creadas + 1;
    end if;
  end loop;
  return v_creadas;
end $$;
comment on function sistema.crear_particiones(regclass, date, int) is
  'Crea las particiones mensuales (UTC) que falten de una tabla particionada por rango. Idempotente. La corre una tarea mensual.';

-- ─── ingesta ─────────────────────────────────────────────────────────────────────

create schema if not exists ingesta;
comment on schema ingesta is 'Lo crudo: cada aviso, webhook o lectura de un proveedor, tal cual llegó. Se escribe sólo por ingesta.recibir().';

-- Idempotencia. n8n y los proveedores reintentan: el mismo aviso puede llegar tres veces. La tabla de lo recibido
-- está particionada por mes y una restricción única allí tendría que incluir la fecha de llegada (que cambia en
-- cada reintento), así que la unicidad vive en esta tabla chica, sin particionar, que se poda junto con las
-- particiones viejas.
create table if not exists ingesta.claves (
  fuente          catalogo.clave not null references catalogo.proveedores (clave),
  ambito          text not null check (length(ambito) between 1 and 200),
  id_externo      text not null,
  recibido_id     uuid not null,
  primera_vez_el  timestamptz not null default now(),
  primary key (fuente, ambito, id_externo)
);
comment on table ingesta.claves is
  'Una fila por (fuente, ámbito, id_externo) ya recibido: lo que hace que un reintento no se guarde dos veces. Se poda a los 90 días, con las particiones.';
comment on column ingesta.claves.ambito is
  'Dentro de qué se repite el id del proveedor: la location del CRM, o la organización (su id en texto) para un proveedor sin location (n8n, la landing). Dos empresas con el mismo id son dos avisos. Texto y no org_id: fuera de negocio e identidad no hay org_id.';

create table if not exists ingesta.recibidos (
  id            uuid not null default gen_random_uuid(),
  recibido_el   timestamptz not null default now(),
  fuente        catalogo.clave not null references catalogo.proveedores (clave),
  tipo          text not null check (length(tipo) between 1 and 120),
  org_id        uuid references identidad.organizaciones (id),
  cuenta_id     uuid,
  crm_cuenta_id text check (crm_cuenta_id is null or length(crm_cuenta_id) between 1 and 100),
  id_externo    text not null check (length(id_externo) between 1 and 300),
  huella        text not null check (huella ~ '^[0-9a-f]{64}$'),
  payload       jsonb not null,
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'procesado', 'descartado', 'error')),
  procesado_el  timestamptz,
  error         text,
  intentos      smallint not null default 0 check (intentos >= 0),
  primary key (id, recibido_el),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  check ((estado in ('procesado', 'descartado')) = (procesado_el is not null)),
  check ((estado = 'error') = (error is not null)),
  check (octet_length(payload::text) <= 1048576)
) partition by range (recibido_el);
comment on table ingesta.recibidos is
  'Todo lo que llega, tal cual. Particionada por mes; se conserva 90 días. Reemplaza a negocio.avisos_del_crm, que hace esto sólo para GoHighLevel.';
comment on column ingesta.recibidos.fuente is 'Qué sistema lo mandó (catalogo.proveedores). Un proveedor nuevo es un INSERT en el catálogo, no un cambio de esta tabla.';
comment on column ingesta.recibidos.tipo is 'El tipo según el proveedor (ContactCreate, OpportunityStageUpdate, call.completed…). La traducción al catálogo la hace el normalizador.';
comment on column ingesta.recibidos.cuenta_id is 'La resuelve el normalizador, desde crm_cuenta_id o el secreto del aviso. Nulo = todavía no se supo de qué cuenta es.';
comment on column ingesta.recibidos.crm_cuenta_id is 'La location del CRM tal como la mandó el proveedor. recibir no la traduce: la puerta no lee identidad.';
comment on column ingesta.recibidos.huella is 'SHA-256 del payload: dos avisos con distinto id y el mismo contenido se ven iguales.';
comment on column ingesta.recibidos.payload is 'El cuerpo tal cual, hasta 1 MB. Puede tener datos personales: por eso vive 90 días.';
comment on column ingesta.recibidos.estado is 'pendiente → procesado (ya está en negocio) | descartado (se reconoce y no se usa) | error (el normalizador falló; ver error).';

create index if not exists recibidos_pendientes on ingesta.recibidos (recibido_el) where estado in ('pendiente', 'error');
create index if not exists recibidos_por_cuenta on ingesta.recibidos (cuenta_id, recibido_el);
create table if not exists ingesta.recibidos_resto partition of ingesta.recibidos default;
comment on table ingesta.recibidos_resto is 'La partición por omisión: sólo debería tener filas si faltó crear la del mes. La vigila la prueba 257.';
-- Desde el mes en que se aplica y no desde una fecha fija: aplicada en otro mes, nacería sin la partición del mes en
-- curso. Lo recibido vive 90 días, así que no hay meses pasados que rellenar: el mes en curso y 36 más. Lo que llegue
-- fuera de ellas cae en la de por omisión, que la 257 vigila.
select sistema.crear_particiones('ingesta.recibidos', current_date, 37);

-- La única puerta.
create or replace function ingesta.recibir(
  p_fuente         text,
  p_ambito         text,
  p_tipo           text,
  p_id_externo     text,
  p_payload        jsonb,
  p_crm_cuenta_id  text default null
) returns table (recibido_id uuid, ya_estaba boolean)
language plpgsql
-- La ruta de búsqueda FIJA de la función, no la de la sesión: una función `security definer` sin ella se puede
-- secuestrar con un objeto del mismo nombre en un esquema de la ruta de quien la llama. Todo adentro va calificado.
security definer set search_path = pg_catalog
as $$
declare
  v_id      uuid := gen_random_uuid();
  v_previo  uuid;
begin
  -- La cuenta NO se averigua acá: la puerta corre como su dueño (el migrador), y el migrador no ve filas de identidad.
  -- La location se guarda tal cual y la traduce el normalizador.
  insert into ingesta.claves (fuente, ambito, id_externo, recibido_id)
  values (p_fuente, p_ambito, p_id_externo, v_id)
  on conflict (fuente, ambito, id_externo) do nothing;
  if not found then
    select k.recibido_id into v_previo from ingesta.claves k
     where k.fuente = p_fuente and k.ambito = p_ambito and k.id_externo = p_id_externo;
    return query select v_previo, true;
    return;
  end if;

  insert into ingesta.recibidos (id, fuente, tipo, crm_cuenta_id, id_externo, huella, payload)
  values (v_id, p_fuente, p_tipo, p_crm_cuenta_id, p_id_externo,
          encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex'), p_payload);
  return query select v_id, false;
end $$;
comment on function ingesta.recibir(text, text, text, text, jsonb, text) is
  'La única puerta de entrada. Guarda lo recibido tal cual y devuelve su id; si ya se había recibido (mismos fuente, ámbito e id_externo), devuelve el id anterior y ya_estaba = true. El ámbito es la location del CRM o la organización. La ejecuta sólo el rol ingestor.';

revoke all on function ingesta.recibir(text, text, text, text, jsonb, text) from public;
grant usage on schema ingesta to ingestor, app_ingesta;
grant execute on function ingesta.recibir(text, text, text, text, jsonb, text) to ingestor;

-- El normalizador lee y marca. No inserta ni borra.
grant select on ingesta.recibidos, ingesta.claves to app_ingesta;
grant update (estado, procesado_el, error, intentos, org_id, cuenta_id) on ingesta.recibidos to app_ingesta;

alter table ingesta.recibidos enable row level security;
alter table ingesta.recibidos force row level security;
alter table ingesta.claves enable row level security;
alter table ingesta.claves force row level security;
drop policy if exists normalizador on ingesta.recibidos;
create policy normalizador on ingesta.recibidos for all to app_ingesta using (true) with check (true);
drop policy if exists normalizador_lee on ingesta.claves;
create policy normalizador_lee on ingesta.claves for select to app_ingesta using (true);
-- La función de recibir corre como su dueño (migrador). Con la RLS forzada, el dueño necesita su propia política
-- para escribir; si no, cada aviso fallaría sin dejar rastro. Lo MÍNIMO: insertar lo recibido (sin poder leerlo), y
-- leer e insertar las claves, que es como sabe si un aviso ya llegó. Las claves no tienen datos personales: la
-- fuente y el id del proveedor. Ninguna política del migrador toca identidad ni negocio.
drop policy if exists recibir_inserta on ingesta.recibidos;
create policy recibir_inserta on ingesta.recibidos for insert to migrador with check (true);
drop policy if exists recibir_claves on ingesta.claves;
drop policy if exists recibir_claves_lee on ingesta.claves;
create policy recibir_claves_lee on ingesta.claves for select to migrador using (true);
drop policy if exists recibir_claves_inserta on ingesta.claves;
create policy recibir_claves_inserta on ingesta.claves for insert to migrador with check (true);
