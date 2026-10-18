-- La organización entera: lo que es de la organización sólo lo ve quien la ve entera.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, Paso 3, 2026-10-18)
--
-- El nivel 3 son los clientes de cada empresa. Desde la Fase 0 cada fila de negocio dice de qué cuenta es, y la
-- política filtra por `app.cuentas`: `'*'` ve todas, una lista sólo ésas. Eso alcanza para enfocar a la EMPRESA en un
-- cliente, pero no para el CLIENTE FINAL —el usuario de una de esas cuentas—, porque hay datos que no son de ninguna
-- cuenta y que la Fase 0 dejó filtrados sólo por organización:
--
--   · las 10 tablas «de la organización» (el chat del cerebro, sus topes, los prompts, los umbrales, el Espía…);
--   · las filas con cuenta nula de las 13 opcionales (las señales, los sellos del cron, el uso de la IA);
--   · en identidad, las personas de la empresa, su auditoría y la edición de la organización.
--
-- Esta migración las cierra con una tercera variable, `app.toda_la_organizacion` (`'si'`/`'no'`), que pone
-- `conOrganizacion` y nadie más (ADR-0201): `'si'` es la empresa o el sistema; `'no'`, el cliente final. Y `'*'` sólo
-- vale con `'si'`: el cliente final nunca ve «todas las cuentas», aunque alguien le arme mal la variable.
--
-- La empresa enfocada en un cliente (`app.cuentas = [uno]`, `'si'`) sigue viendo y ESCRIBIENDO lo de la organización:
-- sin la tercera variable, el foco le habría escondido sus propias señales y el `with check` le habría rechazado un
-- sello del cron.
--
-- Funciones:
--   · `negocio.aplicar_aislamiento` (de la 008) queda igual —las cinco reglas, los permisos— y su política pide la
--     organización entera; ahora se puede volver a llamar sobre una tabla que ya tiene la política;
--   · `negocio.politica_de_cuenta` y `negocio.politica_de_la_organizacion` reemplazan SÓLO la política: volver a llamar
--     `aplicar_aislamiento` sobre una tabla existente le devolvería permisos que se le quitaron a propósito (los
--     eventos son de sólo agregar desde la 084);
--   · `negocio.aplicar_aislamiento_de_cuenta` (de la 082) termina en `politica_de_cuenta`.
--
-- El código ya pone la variable desde el commit anterior a esta migración: se sube DESPUÉS de ese despliegue. Al revés,
-- la aplicación dejaría de ver lo de la organización hasta el siguiente despliegue.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · Las políticas de negocio ───────────────────────────────────────────────

-- Lo de una cuenta: la organización, y además, o todas las cuentas con la organización entera, o una cuenta de la
-- lista. En las opcionales, una fila sin cuenta (de la organización) la ve sólo quien ve la organización entera.
create or replace function negocio.politica_de_cuenta(p_tabla regclass, p_cuenta_obligatoria boolean)
returns void
language plpgsql as $$
declare
  v_condicion text;
begin
  v_condicion := $c$
        org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
        and (((select current_setting('app.cuentas', true)) = '*'
              and (select current_setting('app.toda_la_organizacion', true)) = 'si')
             or cuenta_id = any (cast((select string_to_array(nullif(current_setting('app.cuentas', true), '*'), ',')) as uuid[]))$c$;
  if not p_cuenta_obligatoria then
    v_condicion := v_condicion || $c$
             or (cuenta_id is null and (select current_setting('app.toda_la_organizacion', true)) = 'si')$c$;
  end if;
  v_condicion := v_condicion || ')';
  execute format('drop policy if exists aislamiento on %s', p_tabla);
  execute format('create policy aislamiento on %s for all to app_inquilino using (%s) with check (%s)',
                 p_tabla, v_condicion, v_condicion);
end $$;
comment on function negocio.politica_de_cuenta(regclass, boolean) is
  'Reemplaza SÓLO la política de una tabla de cuenta (no toca permisos): la organización, y todas sus cuentas con la organización entera, o las cuentas de la lista; en las opcionales, la fila sin cuenta sólo con la organización entera.';

-- Lo de la organización: la organización, y verla entera.
create or replace function negocio.politica_de_la_organizacion(p_tabla regclass)
returns void
language plpgsql as $$
begin
  execute format('drop policy if exists aislamiento on %s', p_tabla);
  execute format($p$
    create policy aislamiento on %s for all to app_inquilino
      using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
             and (select current_setting('app.toda_la_organizacion', true)) = 'si')
      with check (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
                  and (select current_setting('app.toda_la_organizacion', true)) = 'si')
  $p$, p_tabla);
end $$;
comment on function negocio.politica_de_la_organizacion(regclass) is
  'Reemplaza SÓLO la política de una tabla de la organización (no toca permisos): la organización, vista entera. El cliente final no la ve.';

-- La de la 008, con la política nueva. Las cinco reglas y los permisos no cambian.
create or replace function negocio.aplicar_aislamiento(p_tabla regclass) returns void as $funcion$
declare
  v_problemas text[] := '{}';
  v_lista     text;
begin
  -- 1 · La columna del inquilino existe y no admite nulos.
  if not exists (
    select 1 from pg_attribute
     where attrelid = p_tabla and attname = 'org_id' and attnum > 0 and not attisdropped
  ) then
    v_problemas := array_append(v_problemas, 'no tiene columna org_id');
  elsif not (
    select attnotnull from pg_attribute where attrelid = p_tabla and attname = 'org_id'
  ) then
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

  -- 3 · TODO índice único lleva org_id adentro.
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

  -- 4 · org_id es la PRIMERA columna de la clave primaria.
  if not exists (
    select 1
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where i.indrelid = p_tabla and i.indisprimary and a.attname = 'org_id'
  ) then
    v_problemas := array_append(v_problemas, 'org_id no es la primera columna de la clave primaria');
  end if;

  -- 5 · Toda clave foránea hacia otra tabla de negocio lleva org_id DE LOS DOS LADOS.
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
  perform negocio.politica_de_la_organizacion(p_tabla);
end $funcion$ language plpgsql;

-- La de la 082, que termina con la política nueva.
create or replace function negocio.aplicar_aislamiento_de_cuenta(p_tabla regclass, p_cuenta_obligatoria boolean)
returns void
language plpgsql as $$
declare
  v_problemas text[] := '{}';
begin
  perform negocio.aplicar_aislamiento(p_tabla);

  if not exists (select 1 from pg_attribute where attrelid = p_tabla and attname = 'cuenta_id' and attnum > 0 and not attisdropped) then
    v_problemas := array_append(v_problemas, 'no tiene columna cuenta_id');
  elsif p_cuenta_obligatoria and not (select attnotnull from pg_attribute where attrelid = p_tabla and attname = 'cuenta_id') then
    v_problemas := array_append(v_problemas, 'cuenta_id admite nulos y la tabla es de una cuenta');
  end if;
  if not exists (
    select 1 from pg_constraint c
     where c.conrelid = p_tabla and c.contype = 'f' and c.confrelid = 'identidad.cuentas'::regclass
       and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
             where a.attrelid = c.conrelid and a.attnum = any (c.conkey)) = array['cuenta_id', 'org_id']
  ) then
    v_problemas := array_append(v_problemas, '(org_id, cuenta_id) no referencia identidad.cuentas(org_id, id)');
  end if;
  if array_length(v_problemas, 1) > 0 then
    raise exception 'aplicar_aislamiento_de_cuenta(%) rechazada: %', p_tabla, array_to_string(v_problemas, ' | ');
  end if;

  perform negocio.politica_de_cuenta(p_tabla, p_cuenta_obligatoria);
end $$;
comment on function negocio.aplicar_aislamiento_de_cuenta(regclass, boolean) is
  'aplicar_aislamiento + las reglas de cuenta_id (existe, no nula si es obligatoria, referencia identidad.cuentas con org_id) + la política de cuenta. Falla cerrada sin app.cuentas.';

-- Las tablas que ya existen: sólo la política. Las listas son las de pruebas/apoyo/regimenes-de-negocio.ts, y la 257
-- exige que coincidan.
do $$
declare
  t text;
  v_obligatorias text[] := array[
    'contactos', 'citas', 'mensajes', 'notas', 'tareas', 'resultados', 'comisiones', 'closer_asignado',
    'briefs_del_closer', 'cambios_de_territorio', 'miniaturas_del_contacto', 'llamadas',
    'analisis_del_agente', 'hallazgos', 'campos_del_crm', 'carpetas_del_crm', 'avisos_del_crm', 'ingesta_pulso',
    'campanas', 'anuncios', 'metricas_de_anuncio', 'gasto_de_la_cuenta', 'lecturas_de_gasto',
    'funnels_de_campana', 'enlaces_de_pieza', 'activos_de_anuncio',
    'eventos', 'mapeos_de_cuenta', 'valores_sin_mapear'];
  v_opcionales text[] := array[
    'analizador_llamadas', 'analizador_transcripciones', 'analizador_analisis', 'analizador_fichas',
    'analizador_prospectos', 'analizador_lapidas', 'objeciones_clasificadas',
    'senales', 'planes_de_accion', 'reuniones_del_dia', 'tareas_programadas', 'uso_de_ia', 'incidentes'];
  v_de_la_organizacion text[] := array[
    'conversaciones_del_executive', 'mensajes_del_executive', 'preguntas_del_executive', 'topes_del_executive',
    'analisis_del_espia', 'enlaces_rapidos', 'prompts_del_agente', 'versiones_del_prompt', 'umbrales',
    'control_aislamiento'];
begin
  foreach t in array v_obligatorias loop
    perform negocio.politica_de_cuenta(format('negocio.%I', t)::regclass, true);
  end loop;
  foreach t in array v_opcionales loop
    perform negocio.politica_de_cuenta(format('negocio.%I', t)::regclass, false);
  end loop;
  foreach t in array v_de_la_organizacion loop
    perform negocio.politica_de_la_organizacion(format('negocio.%I', t)::regclass);
  end loop;
end $$;

-- ─── 2 · Identidad: las personas, su auditoría y la organización ────────────────

-- El cliente final no ve a las personas de la empresa ni la auditoría, y no edita la organización. Sí ve la fila de su
-- organización (`org_propia_lee`, sin cambios): las pantallas necesitan su nombre y su zona.
drop policy if exists usuarios_del_inquilino on identidad.usuarios;
create policy usuarios_del_inquilino on identidad.usuarios for select to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
         and (select current_setting('app.toda_la_organizacion', true)) = 'si');

drop policy if exists usuarios_edita_inquilino on identidad.usuarios;
create policy usuarios_edita_inquilino on identidad.usuarios for update to app_inquilino
  using      (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
              and (select current_setting('app.toda_la_organizacion', true)) = 'si')
  with check (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
              and (select current_setting('app.toda_la_organizacion', true)) = 'si');

drop policy if exists usuarios_borra_inquilino on identidad.usuarios;
create policy usuarios_borra_inquilino on identidad.usuarios for delete to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
         and (select current_setting('app.toda_la_organizacion', true)) = 'si');

drop policy if exists org_propia_edita on identidad.organizaciones;
create policy org_propia_edita on identidad.organizaciones for update to app_inquilino
  using      (id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
              and (select current_setting('app.toda_la_organizacion', true)) = 'si')
  with check (id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
              and (select current_setting('app.toda_la_organizacion', true)) = 'si');

drop policy if exists auditoria_lee_inquilino on identidad.auditoria_accesos;
create policy auditoria_lee_inquilino on identidad.auditoria_accesos for select to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
         and (select current_setting('app.toda_la_organizacion', true)) = 'si');

-- ─── 3 · Las cuentas: quién las ve, quién las crea y quién confirmó su nicho ────

-- Las ve quien ve todas con la organización entera, o las de su lista.
drop policy if exists cuentas_propias_lee on identidad.cuentas;
create policy cuentas_propias_lee on identidad.cuentas for select to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
         and (((select current_setting('app.cuentas', true)) = '*'
               and (select current_setting('app.toda_la_organizacion', true)) = 'si')
              or id = any (cast((select string_to_array(nullif(current_setting('app.cuentas', true), '*'), ',')) as uuid[]))));

-- Las edita y las crea sólo la empresa, mirando la organización entera: el foco en un cliente no alcanza para dar de
-- alta otro, y el cliente final no toca ninguna.
drop policy if exists cuentas_propias_edita on identidad.cuentas;
create policy cuentas_propias_edita on identidad.cuentas for update to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
         and (select current_setting('app.cuentas', true)) = '*'
         and (select current_setting('app.toda_la_organizacion', true)) = 'si')
  with check (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

drop policy if exists cuentas_propias_crea on identidad.cuentas;
create policy cuentas_propias_crea on identidad.cuentas for insert to app_inquilino
  with check (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
              and (select current_setting('app.cuentas', true)) = '*'
              and (select current_setting('app.toda_la_organizacion', true)) = 'si');

-- Quién confirmó el nicho: la empresa (`organizacion`, con la persona) o ARIA (`plataforma`, sin persona: una
-- persona de ARIA no es de esta organización, y aflojar la clave foránea de `nicho_confirmado_por` a `usuarios(id)`
-- rompería el aislamiento que la ADR-0206 declara innegociable). Quién fue, en ese caso, queda en la auditoría.
alter table identidad.cuentas
  add column if not exists nicho_confirmado_desde text check (nicho_confirmado_desde in ('organizacion', 'plataforma'));
comment on column identidad.cuentas.nicho_confirmado_desde is
  'Quién confirmó el nicho: organizacion (una persona de la empresa, en nicho_confirmado_por) o plataforma (ARIA; la persona queda en la auditoría).';

-- La regla «confirmado el ↔ confirmado por» de la 080 no tiene nombre: se busca por su definición. Pasa a ser parte de
-- la regla nueva, que mira las tres columnas juntas.
do $$
declare
  v_nombre text;
begin
  for v_nombre in
    select conname from pg_constraint
     where conrelid = 'identidad.cuentas'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) = 'CHECK (((nicho_confirmado_el IS NULL) = (nicho_confirmado_por IS NULL)))'
  loop
    execute format('alter table identidad.cuentas drop constraint %I', v_nombre);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'cuentas_quien_confirmo_el_nicho'
                   and conrelid = 'identidad.cuentas'::regclass) then
    alter table identidad.cuentas add constraint cuentas_quien_confirmo_el_nicho check (
      (nicho_confirmado_el is null and nicho_confirmado_desde is null and nicho_confirmado_por is null)
      or (nicho_confirmado_el is not null and nicho_confirmado_desde is not distinct from 'organizacion'
          and nicho_confirmado_por is not null)
      or (nicho_confirmado_el is not null and nicho_confirmado_desde is not distinct from 'plataforma'
          and nicho_confirmado_por is null));
  end if;
end $$;

-- El alta por la empresa: sus columnas. La subcuenta del CRM, la marca de prueba, la versión del snapshot y la cuenta
-- por omisión las escribe sólo la plataforma (app_identidad): una empresa que pudiera escribir `crm_cuenta_id` podría
-- ocupar la location de otra, y una que marcara `es_prueba` sacaría sus cuentas de los benchmarks.
grant insert (org_id, nombre, slug, nicho, nicho_confirmado_el, nicho_confirmado_por, nicho_confirmado_desde,
              modelo_de_negocio, pais, moneda, zona_horaria)
  on identidad.cuentas to app_inquilino;
grant update (estado, baja_el, nicho_confirmado_desde) on identidad.cuentas to app_inquilino;
