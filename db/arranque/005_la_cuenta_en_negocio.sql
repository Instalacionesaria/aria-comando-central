-- La cuenta en las filas de negocio que ya existen, de UNA organización. Corre como `app_inquilino`.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ES UNA FASE (modelo multiempresa, Fase 0 · Paso 5, 2026-10-16)
--
-- La `082` agrega cuenta_id NULA a las 39 tablas de negocio que son de una cuenta, con el puente que la completa en
-- toda fila nueva. Las filas que ya existen la reciben acá. No va en una migración porque el migrador no ve filas
-- (RLS forzada, sin política) y quitarle el forzado a 39 tablas es lo que el revisor del migrador prohíbe.
--
-- `app_inquilino` sí ve las filas de su organización. Lo corre `node scripts/db.mjs cuenta-en-negocio`, que abre una
-- transacción por organización y le pone `app.org_id` y `app.cuentas = '*'`, como `conOrganizacion`. Así la política
-- de hoy hace el trabajo de no tocar nada de otra organización.
--
-- Un update que sólo toca cuenta_id no dispara ningún efecto: los disparadores de update de negocio miran
-- `territorio` (el archivo de cambios), `texto` (los prompts), `estado_entrega_familia` (los mensajes) o protegen
-- columnas que esto no toca (medido el 2026-10-16). El puente (`completar_cuenta`) deja pasar de nula a una cuenta,
-- y no deja cambiar una que ya está.
--
-- Hoy cada organización tiene UNA cuenta (la `080` y la fase `cuentas`), así que el relleno es directo: todo lo que
-- existe es de la única subcuenta de su organización, también lo de las tablas donde la cuenta es opcional.
--
-- Idempotente: toca sólo lo que sigue nulo. Y termina comprobando que en las obligatorias no quedó ninguna fila sin
-- cuenta: después viene la `083`, que las vuelve `not null`.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
declare
  -- Las listas son las de pruebas/apoyo/regimenes-de-negocio.ts, y la prueba 257 exige que coincidan.
  v_obligatorias text[] := array[
    'contactos', 'citas', 'mensajes', 'notas', 'tareas', 'resultados',
    'comisiones', 'closer_asignado', 'briefs_del_closer', 'cambios_de_territorio', 'miniaturas_del_contacto', 'llamadas',
    'analisis_del_agente', 'hallazgos', 'campos_del_crm', 'carpetas_del_crm', 'avisos_del_crm', 'ingesta_pulso',
    'campanas', 'anuncios', 'metricas_de_anuncio', 'gasto_de_la_cuenta', 'lecturas_de_gasto', 'funnels_de_campana',
    'enlaces_de_pieza', 'activos_de_anuncio'];
  v_opcionales text[] := array[
    'analizador_llamadas', 'analizador_transcripciones', 'analizador_analisis', 'analizador_fichas', 'analizador_prospectos', 'analizador_lapidas',
    'objeciones_clasificadas', 'senales', 'planes_de_accion', 'reuniones_del_dia', 'uso_de_ia',
    'incidentes'];
  -- `tareas_programadas` NO (el nivel 3): los sellos del cron que existen son de la empresa y quedan sin cuenta. Si se
  -- etiquetaran con la única cuenta, el sello de la empresa (sin cuenta) que escribe el cron desde la 090 no los
  -- encontraría, y la clave vieja (org_id, tarea) lo rechazaría: los sellos quedarían congelados.
  v_org     uuid := nullif(btrim(current_setting('app.org_id', true)), '')::uuid;
  v_cuenta  uuid;
  v_cuantas int;
  v_filas   int;
  v_total   int := 0;
  v_nulas   int;
  t text;
begin
  if v_org is null then
    raise exception 'cuenta-en-negocio: falta app.org_id; esta fase corre por organización, como conOrganizacion';
  end if;
  select count(*), min(id::text)::uuid into v_cuantas, v_cuenta from identidad.cuentas where org_id = v_org;
  if v_cuantas <> 1 then
    raise exception 'cuenta-en-negocio: la organización % tiene % cuentas; el relleno directo supone una sola', v_org, v_cuantas;
  end if;

  foreach t in array v_obligatorias || v_opcionales loop
    execute format('update negocio.%I set cuenta_id = $1 where cuenta_id is null', t) using v_cuenta;
    get diagnostics v_filas = row_count;
    v_total := v_total + v_filas;
  end loop;

  foreach t in array v_obligatorias loop
    execute format('select count(*) from negocio.%I where cuenta_id is null', t) into v_nulas;
    if v_nulas > 0 then
      raise exception 'cuenta-en-negocio: negocio.% quedó con % fila(s) sin cuenta', t, v_nulas;
    end if;
  end loop;

  raise notice 'organización %: % fila(s) con su cuenta', v_org, v_total;
end $$;
