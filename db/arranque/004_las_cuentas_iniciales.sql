-- Una cuenta para cada organización que todavía no tiene, con sus credenciales copiadas. Corre como `app_identidad`.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ES UNA FASE Y NO UNA MIGRACIÓN (modelo multiempresa, Fase 0 · Paso 3, 2026-10-16)
--
-- La `080` crea `identidad.cuentas` y un puente que hace nacer la cuenta con cada organización NUEVA. Las que ya
-- existen necesitan la suya, y escribirla desde una migración no se puede: el migrador no tiene política en
-- `identidad` y la RLS está forzada, así que su `insert … select from identidad.organizaciones` leería cero
-- organizaciones y terminaría «bien» sin crear ninguna cuenta. La salida de quitarle el forzado a la tabla la
-- rechaza el revisor del migrador a propósito: una tabla que queda sin forzar la evade su dueño sin que se vea.
--
-- `app_identidad` sí tiene política sobre las cuentas y ve todas las organizaciones: es el rol del alta de
-- organizaciones, y esto es un alta. Mismo camino que `003_retiro_de_roles.sql`.
--
--   local:        node scripts/db.mjs cuentas        (también lo corre `reset`, después de sembrar)
--   producción:   node --env-file=.env.supabase scripts/db.mjs cuentas
--
-- Idempotente: crea sólo las cuentas que faltan y copia sólo las credenciales que faltan. Correrla diez veces deja
-- lo mismo que correrla una.
--
-- Hoy cada organización ES una subcuenta: su cuenta toma la location del CRM y la zona horaria de la organización, y
-- sus credenciales se COPIAN. `organizaciones_credenciales` sigue intacta, y el código la sigue leyendo hasta la
-- contracción. Lo que se cargue en Ajustes mientras tanto se escribe sólo allá, y esta fase copia sólo lo que falta:
-- no actualiza lo ya copiado. Así que ese día, antes de cambiar la lectura, las credenciales se vuelven a copiar
-- pisando las de la cuenta.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_cuentas      int;
  v_credenciales int;
begin
  insert into identidad.cuentas (org_id, nombre, slug, crm, crm_cuenta_id, zona_horaria, es_prueba)
  select o.id,
         o.nombre,
         left(btrim(regexp_replace(lower(o.slug), '[^a-z0-9-]+', '-', 'g'), '-'), 60),
         'ghl',
         cr.crm_cuenta_id,
         coalesce(nullif(o.zona_horaria, ''), 'UTC'),
         false
    from identidad.organizaciones o
    left join identidad.organizaciones_credenciales cr on cr.org_id = o.id
   where not exists (select 1 from identidad.cuentas c where c.org_id = o.id);
  get diagnostics v_cuentas = row_count;

  insert into identidad.cuentas_credenciales (
    org_id, cuenta_id, crm_token_cifrado, crm_refresh_cifrado, crm_expira_el, crm_estado, crm_calendario_id,
    crm_dominio_reservas, crm_agente_usuario_id, aviso_secreto_hash, meta_cuenta_id, meta_token_cifrado,
    actualizado_el, actualizado_por)
  select cr.org_id, c.id, cr.crm_token_cifrado, cr.crm_refresh_cifrado, cr.crm_expira_el, cr.crm_estado,
         cr.crm_calendario_id, cr.crm_dominio_reservas, cr.crm_agente_usuario_id, cr.aviso_secreto_hash,
         cr.meta_cuenta_id, cr.meta_token_cifrado, cr.actualizado_el, cr.actualizado_por
    from identidad.organizaciones_credenciales cr
    join identidad.cuentas c on c.org_id = cr.org_id
   where not exists (select 1 from identidad.cuentas_credenciales x where x.cuenta_id = c.id);
  get diagnostics v_credenciales = row_count;

  raise notice '% cuenta(s) creada(s), % juego(s) de credenciales copiado(s)', v_cuentas, v_credenciales;

  -- La comprobación que el `insert` no puede dar por sí solo: si este rol no viera las organizaciones (una política
  -- que cambió), los dos `insert` copiarían cero filas y la fase terminaría «bien». Toda organización tiene que
  -- terminar con su cuenta.
  if exists (select 1 from identidad.organizaciones o where not exists (select 1 from identidad.cuentas c where c.org_id = o.id)) then
    raise exception 'quedaron organizaciones sin cuenta: la fase no se aplicó entera';
  end if;
  if (select count(*) from identidad.organizaciones) = 0 then
    raise exception 'app_identidad no ve ninguna organización: la fase no puede comprobar nada';
  end if;
end $$;
