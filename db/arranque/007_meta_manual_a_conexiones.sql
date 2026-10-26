-- Los tokens de Meta pegados a mano, copiados a las conexiones de la `101`. Corre como `app_identidad`.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ES UNA FASE Y NO UNA MIGRACIÓN (Meta directo, M1, 2026-10-26)
--
-- La `101` crea `identidad.conexiones_de_meta` y `identidad.cuentas_publicitarias_de_meta`. Los tokens que ya están
-- cargados (`meta_token_cifrado` + `meta_cuenta_id` en `organizaciones_credenciales`, la del cliente principal, y en
-- `cuentas_credenciales`, la de cada otro cliente) se copian acá a conexiones `manual`, con su cuenta publicitaria ya
-- asignada a su cliente. El migrador no tiene política en `identidad` y la RLS está forzada: su `insert … select` leería
-- cero filas y terminaría «bien». Mismo camino que `006_la_cuenta_por_omision.sql`.
--
--   local:        node scripts/db.mjs meta-manual-a-conexiones   (también lo corre `reset`)
--   producción:   node --env-file=.env.supabase scripts/db.mjs meta-manual-a-conexiones   (después de la `101`)
--
-- El token se copia CIFRADO tal cual: la clave es la misma (`CLAVE_MAESTRA`), así que no hace falta descifrarlo, y esta
-- fase nunca lo ve en claro. Una cuenta `act_` mal escrita (algo que no son dígitos) no se copia: se cuenta y se avisa.
--
-- Idempotente: correrla diez veces deja lo mismo que correrla una. Si el token manual cambió, la conexión manual toma el
-- nuevo; una cuenta ya asignada a otro cliente o tomada por una conexión OAuth no se pisa.
-- ═════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_conexiones int;
  v_cuentas    int;
  v_malas      int;
begin
  -- Lo que hay que copiar: la empresa (su cliente principal) y cada cliente con su propio token.
  create temporary table manuales on commit drop as
  select o.org_id, p.id as cliente, o.meta_token_cifrado as token, btrim(o.meta_cuenta_id) as cuenta
    from identidad.organizaciones_credenciales o
    join identidad.cuentas p on p.org_id = o.org_id and p.es_por_omision
   where nullif(btrim(o.meta_token_cifrado), '') is not null and nullif(btrim(o.meta_cuenta_id), '') is not null
  union all
  select c.org_id, c.cuenta_id, c.meta_token_cifrado, btrim(c.meta_cuenta_id)
    from identidad.cuentas_credenciales c
    join identidad.cuentas k on k.org_id = c.org_id and k.id = c.cuenta_id and not k.es_por_omision
   where nullif(btrim(c.meta_token_cifrado), '') is not null and nullif(btrim(c.meta_cuenta_id), '') is not null;

  select count(*) into v_malas from manuales where cuenta !~ '^(act_)?[0-9]{5,25}$';

  -- Una conexión manual por cliente: el token de la empresa queda como conexión del CLIENTE PRINCIPAL (era para él), no
  -- de la empresa entera, así su cuenta no se puede reasignar a otro cliente por accidente.
  insert into identidad.conexiones_de_meta (org_id, cuenta_id, token_cifrado, origen)
  select m.org_id, m.cliente, m.token, 'manual' from manuales m
   where m.cuenta ~ '^(act_)?[0-9]{5,25}$'
  on conflict (org_id, cuenta_id) where origen = 'manual'
  do update set token_cifrado = excluded.token_cifrado
          where identidad.conexiones_de_meta.token_cifrado is distinct from excluded.token_cifrado;
  get diagnostics v_conexiones = row_count;

  insert into identidad.cuentas_publicitarias_de_meta (org_id, act_id, conexion_id, cuenta_id, asignada_el)
  select m.org_id, 'act_' || regexp_replace(m.cuenta, '^act_', ''), x.id, m.cliente, now()
    from manuales m
    join identidad.conexiones_de_meta x on x.org_id = m.org_id and x.cuenta_id = m.cliente and x.origen = 'manual'
   where m.cuenta ~ '^(act_)?[0-9]{5,25}$'
  on conflict (org_id, act_id) do nothing;
  get diagnostics v_cuentas = row_count;

  raise notice '% conexión(es) manual(es) creada(s) o actualizada(s), % cuenta(s) publicitaria(s) nueva(s), % cuenta(s) mal escrita(s) sin copiar',
    v_conexiones, v_cuentas, v_malas;

  -- La comprobación que los `insert` no pueden dar por sí solos: si este rol no viera las credenciales, copiarían cero
  -- filas y la fase terminaría «bien». Todo token manual bien escrito tiene que tener su conexión.
  if exists (select 1 from manuales m
              where m.cuenta ~ '^(act_)?[0-9]{5,25}$'
                and not exists (select 1 from identidad.conexiones_de_meta x
                                 where x.org_id = m.org_id and x.cuenta_id = m.cliente and x.origen = 'manual')) then
    raise exception 'quedaron tokens manuales de Meta sin su conexión: la fase no se aplicó entera';
  end if;
  if (select count(*) from identidad.organizaciones) = 0 then
    raise exception 'app_identidad no ve ninguna organización: la fase no puede comprobar nada';
  end if;
end $$;
