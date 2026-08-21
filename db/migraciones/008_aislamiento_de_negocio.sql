-- ADR-0205, ADR-0206, ADR-0207, ADR-0212 — El régimen de aislamiento de las tablas de
-- negocio.
--
-- Fuente: 09-ESCOTILLA-Y-ESTADOS § 2, "Las tablas de negocio: una línea por tabla".
--
-- LO PEOR QUE PUEDE PASAR con una tabla de negocio es que alguien cree una nueva y se
-- olvide la política: con la seguridad activada y sin política, el rol del inquilino ve
-- CERO FILAS AL LEER y CERO FILAS AFECTADAS AL MODIFICAR, SIN UN SOLO ERROR. Una
-- pantalla vacía que parece un negocio vacío.
--
-- La defensa es hacer que lo correcto sea UNA LÍNEA. Y además el corredor de
-- migraciones se niega a aplicar un archivo que cree una tabla en `negocio` sin llamar
-- a esta función, así que la primera tabla de negocio no puede nacer sin su régimen.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · La función
--
-- Hace DOS cosas, y la primera importa tanto como la segunda:
--
--   a) EXIGE que la tabla esté en condiciones de ser aislada, y LANZA si no lo está.
--   b) Aplica el régimen.
--
-- El (a) existe porque hay dos verificaciones de PostgreSQL que **no pasan por la
-- seguridad a nivel de fila**: la de UNICIDAD y la de CLAVE FORÁNEA. Las dos corren por
-- debajo de las políticas, así que una tabla puede tener el régimen entero bien puesto y
-- seguir filtrando por ahí. La política no las cubre y no puede cubrirlas: la única
-- defensa es la FORMA de la tabla, y esta función es el único lugar por donde toda tabla
-- de negocio pasa obligatoriamente.
--
-- Las dos fugas, medidas en esta base, no deducidas:
--
--   · ORÁCULO DE EXISTENCIA. Con `id uuid primary key` —un índice único GLOBAL— el
--     inquilino de A puede preguntar si un id existe en CUALQUIER organización:
--     `insert … on conflict (id) do nothing` devuelve "0 filas" si ya existe y "1 fila"
--     si no. Sin error, sin ruido. Con `primary key (org_id, id)` la misma sonda
--     devuelve "1 fila" en los dos casos: el canal desaparece.
--
--   · REFERENCIA CRUZADA. Con `padre_id uuid references padre(id)`, el inquilino de A
--     puede insertar una fila propia que APUNTA a una fila de B — una fila que en la
--     misma transacción NO PUEDE VER. Medido: `¿el padre es visible? NO -> ACEPTADO`.
--     La validación de la clave foránea corre con los privilegios del DUEÑO de la tabla
--     referida, así que la política del inquilino no participa. Con la clave foránea
--     compuesta `(org_id, padre_id) references padre (org_id, id)` el mismo insert se
--     rechaza. Esto no es un canal lateral: es una fila de A que depende de una fila de
--     B, con todo lo que eso arrastra —un borrado de B que falla por una referencia
--     invisible, un informe de A que cuenta algo de B—.
--
-- Por qué acá y no en una prueba: una prueba DETECTA después de aplicar; esto PREVIENE
-- dentro de la misma transacción de la migración, que se revierte entera. La prueba de
-- catálogo existe igual (`pruebas/base/31-forma-de-las-tablas`) y cubre lo que esta función no
-- puede ver: una clave foránea o un índice único agregados por un `alter table`
-- POSTERIOR a la llamada.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function negocio.aplicar_aislamiento(p_tabla regclass) returns void as $funcion$
declare
  v_problemas text[] := '{}';
  v_lista     text;
begin
  -- 1 · La columna del inquilino existe y no admite nulos. Se llama IGUAL en todas las
  -- tablas: la capa de datos la inyecta por nombre, y si en una tabla se llamara
  -- distinto, esa tabla queda sin aislar.
  if not exists (
    select 1 from pg_attribute
     where attrelid = p_tabla and attname = 'org_id' and attnum > 0 and not attisdropped
  ) then
    v_problemas := array_append(v_problemas, 'no tiene columna org_id');
  elsif not (
    select attnotnull from pg_attribute where attrelid = p_tabla and attname = 'org_id'
  ) then
    -- `org_id = <uuid>` con org_id nulo es NULL, que no es true: la fila queda
    -- invisible para TODAS las organizaciones, y para el dueño también por el `force`.
    -- No se puede leer, ni corregir, ni borrar.
    v_problemas := array_append(v_problemas, 'org_id admite nulos: una fila con org_id nulo no la ve nadie');
  end if;

  -- 2 · org_id nombra una organización que existe.
  if not exists (
    select 1
      from pg_constraint c
      join pg_attribute  a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = p_tabla and c.contype = 'f'
       and c.confrelid = 'identidad.organizaciones'::regclass
       and a.attname = 'org_id'
  ) then
    v_problemas := array_append(v_problemas, 'org_id no referencia identidad.organizaciones(id)');
  end if;

  -- 3 · TODO índice único lleva org_id adentro. `pg_index` los cubre a los tres:
  -- clave primaria, restricción `unique` y `create unique index` a secas.
  select string_agg(i.indexrelid::regclass::text, ', ')
    into v_lista
    from pg_index i
   where i.indrelid = p_tabla
     and i.indisunique
     and not exists (
       select 1
         from unnest(i.indkey) as k(attnum)
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        where a.attname = 'org_id'
     );
  if v_lista is not null then
    v_problemas := array_append(v_problemas, format(
      'índices únicos sin org_id adentro (%s): la verificación de unicidad no pasa por RLS, '
      'así que "ya existe una fila con ese valor" confirma un registro de otra organización',
      v_lista));
  end if;

  -- 4 · org_id es la PRIMERA columna de la clave primaria. Que esté adentro cierra la
  -- fuga; que esté primera es lo que hace que la base vaya directo a las filas de una
  -- organización en vez de recorrerlas todas antes de filtrar.
  if not exists (
    select 1
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where i.indrelid = p_tabla and i.indisprimary and a.attname = 'org_id'
  ) then
    v_problemas := array_append(v_problemas, 'org_id no es la primera columna de la clave primaria');
  end if;

  -- 5 · Toda clave foránea hacia otra tabla de negocio lleva org_id DE LOS DOS LADOS, y
  -- en la misma posición del par. No alcanza con que la columna esté: tiene que ser
  -- org_id local apuntando a org_id remoto, que es lo que ata la fila hija a la
  -- organización de la madre.
  select string_agg(c.conname, ', ')
    into v_lista
    from pg_constraint c
    join pg_class      rf on rf.oid = c.confrelid
    join pg_namespace  nf on nf.oid = rf.relnamespace
   where c.conrelid = p_tabla and c.contype = 'f' and nf.nspname = 'negocio'
     and not exists (
       select 1
         from generate_subscripts(c.conkey, 1) as k(i)
         join pg_attribute al on al.attrelid = c.conrelid  and al.attnum = c.conkey[k.i]
         join pg_attribute ar on ar.attrelid = c.confrelid and ar.attnum = c.confkey[k.i]
        where al.attname = 'org_id' and ar.attname = 'org_id'
     );
  if v_lista is not null then
    v_problemas := array_append(v_problemas, format(
      'claves foráneas a negocio sin org_id de los dos lados (%s): la validación de una '
      'clave foránea no pasa por RLS, así que una fila propia puede apuntar a una fila ajena',
      v_lista));
  end if;

  if array_length(v_problemas, 1) > 0 then
    raise exception 'aplicar_aislamiento(%) rechazada: %',
      p_tabla, array_to_string(v_problemas, ' | ');
  end if;

  -- ─── Y ahora sí, el régimen ───
  execute format('alter table %s enable row level security', p_tabla);
  execute format('alter table %s force  row level security', p_tabla);
  execute format('revoke all on %s from public', p_tabla);
  execute format('grant select, insert, update, delete on %s to app_inquilino', p_tabla);
  execute format($politica$
    create policy aislamiento on %s for all to app_inquilino
      using      (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid))
      with check (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid))
  $politica$, p_tabla);
end $funcion$ language plpgsql;

-- Tres detalles del SQL de la política que son deliberados:
--
-- `nullif(btrim(…), '')` ANTES DEL CASTEO. El segundo argumento en `true` hace que
-- `current_setting` devuelva nulo cuando la variable NUNCA se puso — pero después del
-- primer `set_config` de esa conexión, el valor de reposo del parámetro NO VUELVE A
-- NULO: queda en CADENA VACÍA. Y `''::uuid` LANZA un error de sintaxis. Sin el
-- `nullif`, la política falla cerrado la primera vez y REVIENTA las siguientes. Está
-- afirmado como prueba en la compuerta de la Etapa 0, no solo comentado.
--
-- `with check` ADEMÁS de `using`: sin él se puede leer filtrado pero ESCRIBIR una fila
-- con la organización de otro.
--
-- La subconsulta escalar alrededor: sin ella la función se evalúa una vez por fila;
-- envuelta, normalmente se resuelve una sola vez por consulta. Es comportamiento del
-- planificador y no un contrato — hay que MEDIRLO con un plan de ejecución si algún día
-- hay una tabla grande, porque tiene contrapartida: el valor pasa a ser desconocido en
-- tiempo de plan y se pierde la estimación por estadísticas de la columna.

-- Nadie más que el propietario la ejecuta. Por omisión una función se otorga a PUBLIC,
-- y aunque a `app_inquilino` le fallaría igual (no es dueño de las tablas), una función
-- que crea políticas no tiene por qué estar al alcance de nadie más.
revoke all on function negocio.aplicar_aislamiento(regclass) from public;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · La tabla de control del aislamiento
--
-- POR QUÉ ESTA TABLA Y NO UNA DE NEGOCIO REAL: el criterio de cierre de esta etapa
-- exige que "con la organización A no se vea ni una fila de la B", y eso necesita una
-- tabla en `negocio` con filas de dos organizaciones. Cuál sea el modelo de datos del
-- producto todavía no está decidido, e inventarlo sería inventar (EJECUCION § 6).
--
-- El 10 § 1 ya describe esta tabla: la sonda de aislamiento de la Etapa 8 usa "dos
-- organizaciones de control, con una fila marcada cada una" sobre una "<tabla de
-- control>". Así que existe en la especificación, sirve a las pruebas de ahora y a la
-- sonda de producción después.
--
-- Existe para esto y para nada más. Ninguna métrica ni informe de negocio la cuenta.
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.control_aislamiento (
  id         uuid not null default gen_random_uuid(),
  org_id     uuid not null references identidad.organizaciones(id),
  marca      text not null,
  creado_el  timestamptz not null default now(),

  -- LA ORGANIZACIÓN VA PRIMERO, Y NO ES ESTILO. `id uuid primary key` es un índice
  -- único GLOBAL, y la verificación de unicidad no pasa por la seguridad a nivel de
  -- fila: deja abierto un oráculo de existencia entre organizaciones (medido; ver la
  -- función de arriba). `primary key (org_id, id)` lo cierra, y además es el orden que
  -- hace que un filtro por organización vaya directo.
  --
  -- El costo, dicho de frente: `id` deja de ser único por sí solo. Toda clave foránea
  -- que apunte acá tiene que llevar el par `(org_id, id)` — que es exactamente lo que
  -- hace falta para que una fila no pueda referenciar la de otra organización.
  primary key (org_id, id)
);

-- El orden importa: con `(creado_el, org_id)` la base recorre todas las organizaciones
-- antes de filtrar. Con `(org_id, creado_el)` va directo. La organización va PRIMERO.
create index control_aislamiento_por_org
  on negocio.control_aislamiento (org_id, creado_el desc);

-- Las claves únicas llevan la organización ADENTRO. `unique (marca)` y
-- `unique (org_id, marca)` no son lo mismo: con la primera, dos organizaciones no
-- pueden usar la misma marca — y peor, las verificaciones de unicidad NO PASAN por la
-- seguridad a nivel de fila, así que el mensaje "ya existe una fila con ese valor"
-- CONFIRMA LA EXISTENCIA DE UN REGISTRO DE OTRA ORGANIZACIÓN a alguien que no puede
-- verlo (01 § 8). Desde ahora la función de arriba lo EXIGE, no lo sugiere.
alter table negocio.control_aislamiento
  add constraint control_aislamiento_marca_por_org unique (org_id, marca);

-- Y la línea que aplica el régimen entero.
select negocio.aplicar_aislamiento('negocio.control_aislamiento');

-- El cinturón además del tirante, idempotente. NUNCA `in schema identidad`.
grant select, insert, update, delete on all tables    in schema negocio to app_inquilino;
grant usage, select                  on all sequences in schema negocio to app_inquilino;
