-- Los tres roles del modelo multiempresa (Fase 0, 2026-10-16), SIN login. Lo aplica el superusuario, NO `migrador`.
--
--   ingestor       la puerta de n8n, los webhooks y las landings: sólo va a poder llamar a la función que recibe
--                  lo crudo, y no va a poder leer nada, ni lo que él mismo entregó.
--   app_ingesta    el normalizador: va a leer la bandeja cruda y marcar lo que procesó.
--   app_analista   el cálculo de benchmarks entre agencias: va a leer los hechos sin datos personales de las
--                  empresas que participan, y nada de negocio. Es el único rol que va a cruzar organizaciones.
--
-- Son tres y no uno porque cada uno es una puerta distinta con un riesgo distinto: la credencial del ingestor vive
-- en n8n y es la que más fácil se filtra, por eso no lee nada.
--
-- Nacen NOLOGIN y sin contraseña, a propósito: en la Fase 0 ningún servicio se conecta con ellos. Existen para que
-- las migraciones les den sus permisos —que se prueban leyendo el catálogo, sin conectarse— y para que el día que
-- un servicio los use (Fase 1) baste con darles login y una contraseña propia, que pone una persona en el entorno
-- de ese servicio. Una credencial que nadie usa es una credencial que se puede filtrar sin que nadie lo note.
--
-- ── POR QUÉ ES UN ARCHIVO APARTE Y NO SIGUE DENTRO DE `000_cluster.sql` ──────────
--
-- Hasta el 2026-10-27 este bloque vivía en `000_cluster.sql` (el «1b»). Producción no tiene estos tres roles, la `079`
-- les da permisos y sin ellos falla con «role does not exist» (documento 23 § 2, B1). Y el `000` no se puede correr
-- allá: lleva marcas de contraseña y del nombre de la base, `scripts/supabase.mjs correr` rechaza cualquier archivo
-- con marcas, y sustituirlas a mano vuelve a fijar las contraseñas de los tres roles con login (si no coinciden con
-- las de Vercel, se cae el login). Este archivo no lleva NINGUNA marca, no toca ningún otro rol y no fija ninguna
-- contraseña, así que corre por los dos caminos:
--
--   · en local, `node scripts/db.mjs arranque` lo corre a continuación del `000`, en la misma transacción;
--   · en Supabase, como `postgres` por la Management API, en el modo de pedir permiso:
--
--       node --env-file=.env.supabase scripts/supabase.mjs correr --archivo db/arranque/008_los_roles_del_modelo.sql
--
--     y después, de sólo lectura:
--
--       node --env-file=.env.supabase scripts/supabase.mjs leer "select rolname, rolcanlogin, rolbypassrls from pg_roles where rolname in ('ingestor', 'app_ingesta', 'app_analista')"
--
--     tres filas, las tres con `rolcanlogin = false` y `rolbypassrls = false`.
--
-- No va en una migración: los roles son objetos del CLÚSTER, no de la base (el mismo motivo que el `000`), y
-- `migrador` no puede crear roles.
--
-- Es idempotente y se puede correr diez veces seguidas. Lo cuida la prueba `pruebas/codigo/315-*`.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ingestor') then
    create role ingestor nologin noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_ingesta') then
    create role app_ingesta nologin noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_analista') then
    create role app_analista nologin noinherit nobypassrls;
  end if;
end $$;

-- Y SIN login aunque ya existieran: el `if not exists` de arriba no corrige un rol que alguien creó antes con login
-- (la validación del modelo del 2026-10-14 los creó así en la base de trabajo). El día que un servicio use uno, esta
-- línea cambia a `login` con su contraseña, que NO se escribe acá.
alter role ingestor     nologin;
alter role app_ingesta  nologin;
alter role app_analista nologin;

-- Y ninguno superusuario ni con omisión de RLS, aunque alguien los haya tocado. Se DETECTA y no se impone, por lo
-- mismo que en el `000` (su sección 1, «por qué esto verifica y no impone»): contra un proveedor administrado un
-- `alter role … nosuperuser nobypassrls` aborta por la sola presencia de la opción, y como el archivo va en una sola
-- transacción, se revertiría todo. Si un rol amaneció mal, esto lo denuncia y no deja nada a medias.
do $$
declare
  malo text;
begin
  select string_agg(rolname || ' (' ||
           concat_ws(', ',
             case when rolsuper      then 'superusuario'   end,
             case when rolbypassrls  then 'omite RLS'      end,
             case when rolcreatedb   then 'crea bases'     end,
             case when rolcreaterole then 'crea roles'     end,
             case when rolreplication then 'replicación'   end,
             case when rolcanlogin   then 'puede entrar'   end) || ')', '; ')
    into malo
    from pg_roles
   where rolname in ('ingestor', 'app_ingesta', 'app_analista')
     and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolcanlogin);

  if malo is not null then
    raise exception
      'un rol del modelo tiene atributos que no debería tener: %. '
      'Con `bypassrls` o superusuario, `force row level security` no lo alcanza y el '
      'aislamiento se ve perfecto sin estar puesto. Corrígelo con un rol que pueda '
      '(`alter role … nobypassrls nosuperuser`) y vuelve a correr este archivo.', malo;
  end if;
end $$;
