-- El rol de los managed agents (2026-11-10), SIN login. Lo aplica el superusuario (en local) o `postgres` (en
-- Supabase), NO `migrador`: los roles son objetos del clúster y `migrador` no puede crearlos (el motivo del 008).
--
-- ── POR QUÉ HACE FALTA UN ROL ───────────────────────────────────────────────────
--
-- Los managed agents de GoHighLevel entran a la base, durante la prueba, por el MCP de Supabase. Ese MCP corre como
-- `postgres`, que en Supabase NO es superusuario: omite la RLS y lee todo (`pg_read_all_data`), pero no puede
-- escribir en las tablas de negocio (son de `migrador`, y su membresía en `app_inquilino` es sin herencia). Medido en
-- producción el 2026-11-10: `has_table_privilege('negocio.eventos', 'insert') = false`.
--
-- `agente_mcp` junta los permisos de ESCRITURA que necesitan las funciones del esquema `agentes` (la `110` en
-- adelante se los da) y se le concede a `postgres` con herencia. Así, el agente escribe sólo lo que esas tablas
-- permiten, y la lista de lo que un agente puede tocar vive en un solo lugar: los `grant … to agente_mcp` de las
-- migraciones. El día del ARIA MCP, nuestro servidor llama a las mismas funciones como `app_inquilino` dentro de
-- `conOrganizacion()`, y este rol deja de usarse.
--
-- No tiene login, ni omite RLS: el aislamiento por cuenta lo hacen las funciones (cada una se ata a la cuenta de su
-- corrida), y la RLS se le suma cuando quien llama es el inquilino.
--
-- Corre por los dos caminos, sin marcas:
--   · en local, `node scripts/db.mjs arranque` lo corre después del `008`;
--   · en Supabase, como `postgres`, en el modo de pedir permiso:
--       node --env-file=.env.supabase scripts/supabase.mjs correr --archivo db/arranque/011_el_rol_de_los_agentes.sql
--
-- Es idempotente.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agente_mcp') then
    create role agente_mcp nologin noinherit nobypassrls;
  end if;
end $$;

alter role agente_mcp nologin;

-- `postgres` hereda sus permisos: es quien corre el SQL del MCP de Supabase. En local, `postgres` es el superusuario
-- y la concesión no cambia nada, pero deja la base igual a producción.
--
-- Se mira `inherit_option` y no sólo que la membresía exista: en PG 16 o más, cuando un rol con CREATEROLE que no es
-- superusuario (el `postgres` de Supabase) crea un rol, Postgres le concede ese rol AUTOMÁTICAMENTE, pero con
-- `inherit_option = false`. Esa fila existe y no sirve: hace falta otra concesión, con herencia.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'postgres')
     and not exists (
       select 1 from pg_auth_members m
        where m.roleid = (select oid from pg_roles where rolname = 'agente_mcp')
          and m.member = (select oid from pg_roles where rolname = 'postgres')
          and m.inherit_option
     ) then
    grant agente_mcp to postgres with inherit true;
  end if;
end $$;

-- Y el mismo control que el 008: si alguien le dio atributos de más, se denuncia y no se deja nada a medias.
do $$
declare
  malo text;
begin
  select rolname into malo
    from pg_roles
   where rolname = 'agente_mcp'
     and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolcanlogin);
  if malo is not null then
    raise exception 'el rol agente_mcp tiene atributos que no debería tener (superusuario, omite RLS, crea, replica o entra). Corrígelo y vuelve a correr este archivo.';
  end if;
end $$;
