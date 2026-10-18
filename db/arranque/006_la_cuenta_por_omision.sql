-- La cuenta por omisión de cada organización que todavía no la tiene. Corre como `app_identidad`.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ES UNA FASE Y NO UNA MIGRACIÓN (el nivel 3, Paso 1, 2026-10-18)
--
-- La `085` crea `identidad.cuentas.es_por_omision` y hace nacer marcada la cuenta de cada organización NUEVA. Las que
-- ya existen se marcan acá: el migrador no tiene política en `identidad` y la RLS está forzada, así que su `update`
-- tocaría cero filas y terminaría «bien». Mismo camino que `004_las_cuentas_iniciales.sql`.
--
--   local:        node scripts/db.mjs cuenta-por-omision   (también lo corre `reset`, después de `cuentas`)
--   producción:   node --env-file=.env.supabase scripts/db.mjs cuenta-por-omision   (después de la `085`)
--
-- Marca, en cada organización sin cuenta por omisión, su cuenta activa más vieja: hoy cada organización tiene una sola,
-- la que nació con ella y tiene sus credenciales. Y le iguala la zona horaria a la de la organización, que es la que
-- usan todas las pantallas: la cuenta la copió al nacer, y Ajustes › Empresas pudo cambiarla después.
--
-- Idempotente: correrla diez veces deja lo mismo que correrla una.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_marcadas int;
  v_zonas    int;
begin
  update identidad.cuentas c
     set es_por_omision = true
   where c.id = (select x.id from identidad.cuentas x
                  where x.org_id = c.org_id and x.estado = 'activa'
                  order by x.alta_el, x.id limit 1)
     and not exists (select 1 from identidad.cuentas y where y.org_id = c.org_id and y.es_por_omision);
  get diagnostics v_marcadas = row_count;

  update identidad.cuentas c
     set zona_horaria = o.zona_horaria
    from identidad.organizaciones o
   where o.id = c.org_id and c.es_por_omision
     and nullif(o.zona_horaria, '') is not null and c.zona_horaria is distinct from o.zona_horaria;
  get diagnostics v_zonas = row_count;

  raise notice '% cuenta(s) marcada(s) por omisión, % zona(s) igualada(s)', v_marcadas, v_zonas;

  -- La comprobación que los `update` no pueden dar por sí solos: si este rol no viera las organizaciones, marcarían
  -- cero cuentas y la fase terminaría «bien». Toda organización tiene que terminar con exactamente una.
  if exists (select 1 from identidad.organizaciones o
              where (select count(*) from identidad.cuentas c where c.org_id = o.id and c.es_por_omision) <> 1) then
    raise exception 'quedaron organizaciones sin su cuenta por omisión: la fase no se aplicó entera';
  end if;
  if (select count(*) from identidad.organizaciones) = 0 then
    raise exception 'app_identidad no ve ninguna organización: la fase no puede comprobar nada';
  end if;
end $$;
