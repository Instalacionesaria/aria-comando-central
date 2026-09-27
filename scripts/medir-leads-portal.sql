-- ═══════════════════════════════════════════════════════════════════════════════
-- LA COHORTE DE LEADS PORTAL EN PRODUCCIÓN · solo lectura
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   node --env-file=.env.supabase scripts/supabase.mjs leer --archivo scripts/medir-leads-portal.sql
--
-- Cuenta lo mismo que `lib/negocio/leadsDelPortal.ts`, en las cuatro ventanas de `periodo.ts`, para
-- cotejar la pestaña contra la base sin pasar por ella: es el paso 3 de la verificación del plan, y la
-- medición que contestó `LP09-P01` el 2026-09-27 (docs/leads-portal/09-DE-DONDE-VIENE-CADA-DATO.md).
--
-- ── LOS PREDICADOS ESTÁN COPIADOS, Y ESO HAY QUE SABERLO ─────────────────────
--
-- Un archivo SQL no puede importar TypeScript, así que acá están escritos a mano: el corte 75/50 de
-- `tramosDelIcp.ts`, las seis etiquetas de `ETIQUETAS_DE_DESCARTE`, las tres grafías de
-- `ESTADOS_CANCELADOS` y la «cita cerrable» de `citaCerrable`. Si alguno cambia en el código y no
-- acá, esta consulta deja de medir lo que la pestaña muestra — y la diferencia se ve al cotejar, que
-- es justamente para lo que existe.
--
-- La ventana «hoy» no aparece cuando no entró nadie en 24 horas: se agrupa por ventana, y una ventana
-- sin filas no tiene grupo.
--
-- ── NO IMPRIME DATOS DE NADIE ────────────────────────────────────────────────
--
-- Sólo conteos. Ni nombres, ni correos, ni teléfonos, ni la atribución.
-- ═══════════════════════════════════════════════════════════════════════════════
with org as (select id from identidad.organizaciones where slug = 'aria'),
ventanas(clave, dias) as (values ('hoy', 1), ('7d', 7), ('30d', 30), ('completo', 3650)),
filas as (
  select v.clave,
         case when c.score is null or c.score = 0 then 'sin_calificar'
              when c.score >= 75 then 'alto' when c.score >= 50 then 'medio' else 'bajo' end as tramo,
         c.score,
         exists (select 1 from unnest(c.etiquetas) e
                  where lower(e) = any(array['icp_rechazado','rechazado','rechazado_positivo','rechazado_negativo','no calificado','descalificado'])) as descartado,
         case when exists (select 1 from negocio.citas ci where ci.org_id = c.org_id and ci.contacto_id = c.id and ci.ghl_calendario_id is not null) then 'agendo'
              when exists (select 1 from negocio.citas ci where ci.org_id = c.org_id and ci.contacto_id = c.id) then 'solo_congeladas'
              else 'sin_cita' end as cita,
         case when exists (select 1 from negocio.citas ci where ci.org_id = c.org_id and ci.contacto_id = c.id and ci.asistio is true) then 'asistio'
              when exists (select 1 from negocio.citas ci where ci.org_id = c.org_id and ci.contacto_id = c.id and ci.asistio is false) then 'no_asistio'
              when exists (select 1 from negocio.citas ci where ci.org_id = c.org_id and ci.contacto_id = c.id
                             and ci.ghl_calendario_id is not null
                             and not lower(coalesce(ci.estado_ghl, '')) = any(array['cancelled','canceled','cancelada'])
                             and ci.inicio_el < now()) then 'sin_registrar' end as asistencia,
         exists (select 1 from negocio.citas ci where ci.org_id = c.org_id and ci.contacto_id = c.id
                  and lower(coalesce(ci.estado_ghl, '')) = 'noshow') as planton,
         exists (select 1 from negocio.resultados r where r.org_id = c.org_id and r.contacto_id = c.id and r.salida = 'venta') as vendio
    from negocio.contactos c, ventanas v
   where c.org_id = (select id from org)
     and c.alta_en_el_crm >= now() - make_interval(days => v.dias)
)
select jsonb_build_object(
  'medido_el', now(),
  'por_ventana', (select jsonb_object_agg(clave, x) from (
     select clave, jsonb_build_object(
       'total', count(*),
       'agendados', count(*) filter (where cita = 'agendo'),
       'solo_congeladas', count(*) filter (where cita = 'solo_congeladas'),
       'asistio', count(*) filter (where asistencia = 'asistio'),
       'no_asistio', count(*) filter (where asistencia = 'no_asistio'),
       'sin_registrar', count(*) filter (where asistencia = 'sin_registrar'),
       'planton', count(*) filter (where planton),
       'vendidos', count(*) filter (where vendio),
       'descartados', count(*) filter (where descartado),
       'sin_puntaje', count(*) filter (where score is null),
       'en_cero', count(*) filter (where score = 0),
       'por_tramo', (select jsonb_object_agg(tramo, n) from (
          select f2.tramo, jsonb_build_object('contactos', count(*),
                   'agendados', count(*) filter (where f2.cita = 'agendo'),
                   'sin_registrar', count(*) filter (where f2.asistencia = 'sin_registrar')) n
            from filas f2 where f2.clave = f1.clave group by f2.tramo) t)
     ) x
     from filas f1 group by clave) y),
  'ceros_recientes', (select count(*) from negocio.contactos where org_id = (select id from org) and score = 0 and alta_en_el_crm >= now() - interval '14 days'),
  'sin_alta', (select count(*) from negocio.contactos where org_id = (select id from org) and alta_en_el_crm is null),
  'hay_ventas', (select exists (select 1 from negocio.resultados where org_id = (select id from org) and salida = 'venta'))
) as cotejo;
