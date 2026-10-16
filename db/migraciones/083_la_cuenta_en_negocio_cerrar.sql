-- La cuenta en todo negocio, segunda mitad: CERRAR. Obligatoria, la cuenta de la madre, y la política por cuenta.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- QUÉ CIERRA (modelo de datos multiempresa, Fase 0 · Paso 5, 2026-10-16)
--
-- Va DESPUÉS de la `082` (la columna y el puente) y de la fase `cuenta-en-negocio` (el relleno, como app_inquilino):
--
--   1. cuenta_id NOT NULL en las 26 tablas que siempre son de una cuenta;
--   2. las claves foráneas «misma cuenta que la madre»: una cita no puede quedar en otra cuenta que su contacto, ni la
--      métrica de un anuncio en otra cuenta que su anuncio. Con org_id solo la base no lo impedía;
--   3. la política nueva en las 39: la organización Y la cuenta. Con `app.cuentas = '*'` (lo que pone
--      conOrganizacion desde el Paso 1) se ven todas las cuentas de la organización, como hoy; sin la variable, nada.
--
-- Vuelta atrás sin perder datos: en cada una de las 39, `drop policy aislamiento` y `negocio.aplicar_aislamiento`,
-- la política de sólo organización. Las columnas y las claves pueden quedarse.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · Obligatoria en las 26 que siempre son de una cuenta ──────────────────────

-- `set not null` recorre la tabla una vez como su dueño: si la fase `cuenta-en-negocio` dejó una fila sin cuenta, esto
-- falla, y como migrar aplica todo en una transacción, no queda nada a medias.
do $$
declare
  t text;
begin
  foreach t in array array[
    'contactos', 'citas', 'mensajes', 'notas', 'tareas', 'resultados',
    'comisiones', 'closer_asignado', 'briefs_del_closer', 'cambios_de_territorio', 'miniaturas_del_contacto', 'llamadas',
    'analisis_del_agente', 'hallazgos', 'campos_del_crm', 'carpetas_del_crm', 'avisos_del_crm', 'ingesta_pulso',
    'campanas', 'anuncios', 'metricas_de_anuncio', 'gasto_de_la_cuenta', 'lecturas_de_gasto', 'funnels_de_campana',
    'enlaces_de_pieza', 'activos_de_anuncio'] loop
    execute format('alter table negocio.%I alter column cuenta_id set not null', t);
  end loop;
end $$;

-- ─── 2 · La fila hija tiene la cuenta de su madre ────────────────────────────────

-- Una cita de un contacto de la cuenta A no puede quedar en la cuenta B. Con org_id solo, la base no lo impide;
-- con (org_id, cuenta_id, contacto_id) contra (org_id, cuenta_id, id), sí.
-- Sólo si falta: al reaplicar, de esta restricción ya dependen las claves foráneas de abajo, y un `drop … if exists`
-- fallaría.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contactos_cuenta_id_unico') then
    alter table negocio.contactos add constraint contactos_cuenta_id_unico unique (org_id, cuenta_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'citas_cuenta_id_unico') then
    alter table negocio.citas add constraint citas_cuenta_id_unico unique (org_id, cuenta_id, id);
  end if;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['citas', 'mensajes', 'notas', 'tareas', 'resultados', 'cambios_de_territorio',
                           'miniaturas_del_contacto', 'llamadas', 'analisis_del_agente', 'hallazgos'] loop
    execute format('alter table negocio.%I drop constraint if exists %I', t, t || '_misma_cuenta_que_el_contacto');
    execute format(
      'alter table negocio.%I add constraint %I foreign key (org_id, cuenta_id, contacto_id) '
      'references negocio.contactos (org_id, cuenta_id, id) on delete cascade',
      t, t || '_misma_cuenta_que_el_contacto');
  end loop;
end $$;

alter table negocio.briefs_del_closer drop constraint if exists briefs_del_closer_misma_cuenta_que_la_cita;
alter table negocio.briefs_del_closer add constraint briefs_del_closer_misma_cuenta_que_la_cita
  foreign key (org_id, cuenta_id, cita_id) references negocio.citas (org_id, cuenta_id, id) on delete cascade;
alter table negocio.resultados drop constraint if exists resultados_misma_cuenta_que_la_cita;
alter table negocio.resultados add constraint resultados_misma_cuenta_que_la_cita
  foreign key (org_id, cuenta_id, cita_id) references negocio.citas (org_id, cuenta_id, id) on delete set null (cita_id);

-- Lo mismo para lo que cuelga de un anuncio: sus métricas diarias y lo leído de Meta (078). Un anuncio es de UNA
-- cuenta publicitaria, y por lo tanto de una subcuenta; su métrica de otra subcuenta sería gasto contado dos veces.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'anuncios_cuenta_id_unico') then
    alter table negocio.anuncios add constraint anuncios_cuenta_id_unico unique (org_id, cuenta_id, meta_anuncio_id);
  end if;
end $$;
do $$
declare
  t text;
begin
  foreach t in array array['metricas_de_anuncio', 'activos_de_anuncio'] loop
    execute format('alter table negocio.%I drop constraint if exists %I', t, t || '_misma_cuenta_que_el_anuncio');
    execute format(
      'alter table negocio.%I add constraint %I foreign key (org_id, cuenta_id, meta_anuncio_id) '
      'references negocio.anuncios (org_id, cuenta_id, meta_anuncio_id) on delete cascade',
      t, t || '_misma_cuenta_que_el_anuncio');
  end loop;
end $$;

-- ─── 3 · La política nueva en cada tabla ────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'contactos', 'citas', 'mensajes', 'notas', 'tareas', 'resultados', 'comisiones', 'closer_asignado',
    'briefs_del_closer', 'cambios_de_territorio', 'miniaturas_del_contacto', 'llamadas',
    'analisis_del_agente', 'hallazgos', 'campos_del_crm', 'carpetas_del_crm', 'avisos_del_crm', 'ingesta_pulso',
    'campanas', 'anuncios', 'metricas_de_anuncio', 'gasto_de_la_cuenta', 'lecturas_de_gasto',
    'funnels_de_campana', 'enlaces_de_pieza', 'activos_de_anuncio'] loop
    perform negocio.aplicar_aislamiento_de_cuenta(format('negocio.%I', t)::regclass, true);
  end loop;
  foreach t in array array[
    'analizador_llamadas', 'analizador_transcripciones', 'analizador_analisis', 'analizador_fichas',
    'analizador_prospectos', 'analizador_lapidas', 'objeciones_clasificadas',
    'senales', 'planes_de_accion', 'reuniones_del_dia', 'tareas_programadas', 'uso_de_ia', 'incidentes'] loop
    perform negocio.aplicar_aislamiento_de_cuenta(format('negocio.%I', t)::regclass, false);
  end loop;
end $$;
