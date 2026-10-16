-- La cuenta en todo negocio, primera mitad: EXPANDIR. La columna, su clave foránea, el puente. Sin rellenar.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ EN TRES PASOS (modelo de datos multiempresa, Fase 0 · Paso 5, 2026-10-16)
--
-- La segunda llave de aislamiento, cuenta_id, entra a las 39 tablas de negocio que son de una cuenta. Rellenarla
-- desde una migración no se puede sin romper la doctrina: el migrador no ve filas (RLS forzada, sin política), y
-- quitarle el forzado a 39 tablas es justo lo que el revisor prohíbe. Así que va en tres pasos, cada uno se sube solo:
--
--   1. ESTA migración: cuenta_id NULA en las 39, con su clave foránea a identidad.cuentas, su índice, y el puente
--      (negocio.completar_cuenta) que la completa en toda fila nueva. La política sigue siendo la de hoy: nada cambia
--      para la aplicación.
--   2. La fase `cuenta-en-negocio` (db/arranque/005_la_cuenta_en_negocio.sql): rellena las filas que ya existen, como
--      app_inquilino, organización por organización. Un update que sólo toca cuenta_id no dispara ningún efecto: los
--      disparadores de update de negocio miran territorio, texto o columnas que el relleno no toca (medido el 2026-10-16).
--   3. La 083: not null en las 26 obligatorias y la política por organización Y cuenta. Si quedara una fila sin cuenta,
--      falla entera y no cambia nada.
--
-- Las claves foráneas «misma cuenta que la madre» (una cita en la cuenta de su contacto) NO van acá, y es a propósito:
-- entre esta migración y el relleno, un mensaje nuevo de un contacto viejo nace CON cuenta —el puente se la pone— y su
-- contacto todavía SIN ella, así que la clave compuesta no encontraría a su madre y rechazaría el insert: la ingesta
-- se cortaría hasta el relleno. Van en la 083, cuando todas las filas ya tienen cuenta.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · El aislamiento por cuenta (se usa en la 083) ──────────────────────────────────────────────

create or replace function negocio.aplicar_aislamiento_de_cuenta(p_tabla regclass, p_cuenta_obligatoria boolean)
returns void
language plpgsql as $$
declare
  v_problemas text[] := '{}';
begin
  -- Las cinco reglas de org_id, el `enable/force`, los grants y la política de organización: todo lo que ya
  -- garantiza aplicar_aislamiento, sin copiarlo.
  execute format('drop policy if exists aislamiento on %s', p_tabla);
  perform negocio.aplicar_aislamiento(p_tabla);

  -- Y las de cuenta_id.
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

  -- La política: la organización, y además la cuenta. app.cuentas = '*' ve todas las de la organización; una lista
  -- ve sólo ésas; sin app.cuentas, nada. Una fila con cuenta_id nulo (de la organización entera) la ve sólo '*'.
  execute format('drop policy if exists aislamiento on %s', p_tabla);
  execute format($politica$
    create policy aislamiento on %s for all to app_inquilino
      using (
        org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
        and ((select current_setting('app.cuentas', true)) = '*'
             or cuenta_id = any (cast((select string_to_array(nullif(current_setting('app.cuentas', true), '*'), ',')) as uuid[]))))
      with check (
        org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
        and ((select current_setting('app.cuentas', true)) = '*'
             or cuenta_id = any (cast((select string_to_array(nullif(current_setting('app.cuentas', true), '*'), ',')) as uuid[]))))
  $politica$, p_tabla);
end $$;
comment on function negocio.aplicar_aislamiento_de_cuenta(regclass, boolean) is
  'aplicar_aislamiento + las reglas de cuenta_id (existe, no nula si es obligatoria, referencia identidad.cuentas con org_id) + la política por organización Y cuenta. Falla cerrada sin app.cuentas.';

-- ─── 2 · El puente ──────────────────────────────────────────────────────────────

-- Mientras el código no mande cuenta_id en cada insert, este disparador la completa. Corre como quien inserta
-- (app_inquilino, con app.org_id y app.cuentas puestas por conOrganizacion), que ve sus contactos y sus cuentas:
--   · si la fila tiene contacto_id, con la cuenta del contacto (la única correcta);
--   · si no, con la ÚNICA cuenta activa de la organización. Con dos o más, falla con un mensaje claro: a partir de
--     ahí, quien inserta tiene que decir de qué cuenta es.
-- Y en un update, impide cambiar la cuenta de una fila: una fila no se muda de negocio.
-- Se retira en la contracción, cuando todo el código mande cuenta_id.
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
    select count(*), min(id::text)::uuid into v_cuantas, v_cuenta
      from identidad.cuentas where org_id = new.org_id and estado = 'activa';
    if v_cuantas <> 1 then
      raise exception '%: falta cuenta_id y la organización % tiene % cuentas activas.', tg_table_name, new.org_id, v_cuantas;
    end if;
  end if;
  new.cuenta_id := v_cuenta;
  return new;
end $$;
comment on function negocio.completar_cuenta() is
  'PUENTE de la Fase 0: completa cuenta_id (desde el contacto o desde la única cuenta de la organización) e impide cambiarla. Se retira cuando todo el código la mande.';

-- ─── 3 · cuenta_id en cada tabla, NULA por ahora, con su clave foránea y el puente ─────────

-- Las listas son las de pruebas/apoyo/regimenes-de-negocio.ts, y la prueba 257 exige que coincidan.
do $$
declare
  -- Siempre de una cuenta: el lead, su conversación, su agenda, sus ventas, la publicidad.
  v_obligatorias text[] := array[
    'contactos', 'citas', 'mensajes', 'notas', 'tareas', 'resultados',
    'comisiones', 'closer_asignado', 'briefs_del_closer', 'cambios_de_territorio', 'miniaturas_del_contacto', 'llamadas',
    'analisis_del_agente', 'hallazgos', 'campos_del_crm', 'carpetas_del_crm', 'avisos_del_crm', 'ingesta_pulso',
    'campanas', 'anuncios', 'metricas_de_anuncio', 'gasto_de_la_cuenta', 'lecturas_de_gasto', 'funnels_de_campana',
    'enlaces_de_pieza', 'activos_de_anuncio'];
  -- De una cuenta o de la organización entera: lo analizado de la propia agencia, lo que producen los agentes.
  v_opcionales text[] := array[
    'analizador_llamadas', 'analizador_transcripciones', 'analizador_analisis', 'analizador_fichas', 'analizador_prospectos', 'analizador_lapidas',
    'objeciones_clasificadas', 'senales', 'planes_de_accion', 'reuniones_del_dia', 'tareas_programadas', 'uso_de_ia',
    'incidentes'];
  t text;
  v_tabla regclass;
  v_obligatoria boolean;
begin
  foreach t in array v_obligatorias || v_opcionales loop
    v_tabla := format('negocio.%I', t)::regclass;
    v_obligatoria := t = any (v_obligatorias);

    -- Sin valor por omisión: no reescribe la tabla.
    execute format('alter table %s add column if not exists cuenta_id uuid', v_tabla);
    execute format('alter table %s drop constraint if exists %I', v_tabla, t || '_cuenta_fk');
    execute format(
      'alter table %s add constraint %I foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id)',
      v_tabla, t || '_cuenta_fk');
    execute format('create index if not exists %I on %s (org_id, cuenta_id)', t || '_por_cuenta', v_tabla);
    execute format('comment on column %s.cuenta_id is %L', v_tabla, case when v_obligatoria
      then 'La subcuenta (identidad.cuentas) a la que pertenece la fila. Segunda llave de aislamiento; no cambia nunca.'
      else 'La subcuenta, o nulo si es de la organización entera (sólo la ve una sesión con app.cuentas = ''*''). No cambia nunca.' end);

    -- El puente: desde ahora, toda fila nueva nace con su cuenta, y ninguna se muda de cuenta.
    execute format('drop trigger if exists completar_cuenta on %s', v_tabla);
    execute format(
      'create trigger completar_cuenta before insert or update on %s for each row execute function negocio.completar_cuenta(%L)',
      v_tabla, case when v_obligatoria then 'obligatoria' else 'opcional' end);
  end loop;
end $$;
