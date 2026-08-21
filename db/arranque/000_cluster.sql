-- Arranque del CLÚSTER. Lo aplica el superusuario, NO `migrador`.
--
-- Fuente: 09-ESCOTILLA-Y-ESTADOS § 2, con dos ajustes que EJECUCION cierra:
-- el esquema `comun` NO se crea (§ 2 y § 3), así que desaparece de los tres
-- `search_path`.
--
-- POR QUÉ ESTE ARCHIVO ESTÁ FUERA DE LAS MIGRACIONES, y no es un detalle de
-- organización: los roles son objetos del CLÚSTER, no de la base. El 10 § 4 lo
-- convierte en criterio de restauración — "un volcado de una base NO INCLUYE los
-- roles ni sus contraseñas… El respaldo lleva un volcado de roles APARTE, y el
-- simulacro lo restaura PRIMERO". Este archivo ES ese volcado aparte. Restaurar
-- una copia en un servidor limpio sin correr esto primero deja una base cuyas
-- políticas nombran roles que no existen.
--
-- Las marcas @CLAVE_*@ las reemplaza scripts/db.mjs con el literal citado por
-- `escapeLiteral()`, tomado de las DATABASE_URL_* del entorno. Nunca hay una
-- contraseña escrita en este archivo.
--
-- Es idempotente y se puede correr diez veces seguidas.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Los tres roles
--
-- `noinherit` y `nobypassrls` explícitos. `nobypassrls` ya es el valor por
-- omisión: se escribe igual para que quede dicho en la migración que alguien va a
-- revisar, porque es la propiedad de la que depende que exista una segunda capa.
-- Ninguno es superusuario.
-- ─────────────────────────────────────────────────────────────────────────────

-- El propietario de las tablas. Corre las migraciones y NADA más.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'migrador') then
    create role migrador login noinherit nobypassrls;
  end if;
end $$;

-- El dominio del inquilino: datos de negocio, siempre filtrados por la política.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_inquilino') then
    create role app_inquilino login noinherit nobypassrls;
  end if;
end $$;

-- El dominio de identidad: consulta sin filtro de organización, y NO llega a
-- ninguna tabla de negocio.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_identidad') then
    create role app_identidad login noinherit nobypassrls;
  end if;
end $$;

-- Las contraseñas se fijan SIEMPRE, no solo al crear: así la contraseña del rol
-- sigue a la cadena de conexión y las dos no pueden divergir.
alter role migrador      password @CLAVE_MIGRADOR@;
alter role app_inquilino password @CLAVE_INQUILINO@;
alter role app_identidad password @CLAVE_IDENTIDAD@;

-- Y ninguno superusuario ni con omisión de RLS, aunque alguien los haya tocado.
alter role migrador      nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
alter role app_inquilino nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
alter role app_identidad nosuperuser nobypassrls nocreatedb nocreaterole noreplication;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · La ruta de búsqueda POR ROL
--
-- Se aplica al INICIAR SESIÓN, no al cambiar de rol (09 § 6). Por eso un `set
-- role` NO es una frontera entre dominios y no aparece en ninguna parte del
-- proyecto: son dos cadenas de conexión, dos agrupadores, dos contraseñas.
--
-- Vive acá y no en una migración porque es un atributo de ROL
-- (`pg_db_role_setting`), otra cosa que no viaja en un volcado de la base.
--
-- `comun` no aparece: EJECUCION § 3 lo cerró. Un `search_path` que nombra un
-- esquema que no existe NO da error — se ignora en silencio, que es peor que uno
-- roto, porque documenta algo que no está.
-- ─────────────────────────────────────────────────────────────────────────────

alter role app_inquilino set search_path = negocio, identidad;
alter role app_identidad set search_path = identidad;
alter role migrador      set search_path = identidad, negocio;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Extensión y permisos de base
-- ─────────────────────────────────────────────────────────────────────────────

-- `gen_random_uuid()`. Necesita superusuario, así que va acá y no en una
-- migración (01 § 1).
create extension if not exists pgcrypto;

-- Los tres se conectan a esta base. El nombre lo sustituye scripts/db.mjs desde la
-- cadena de conexión, citado como identificador: `grant … on database` exige un
-- nombre literal, no acepta `current_database()`.
grant connect on database @BASE@ to migrador, app_inquilino, app_identidad;

-- Y `migrador` crea los esquemas, así que necesita CREATE sobre la base. Los dos
-- roles de aplicación NO: no crean nada, nunca.
grant create on database @BASE@ to migrador;

-- Desde PostgreSQL 15 nadie salvo el dueño de la base tiene CREATE sobre
-- `public`. Sin esto, la tabla de contabilidad de las migraciones —que vive en
-- `public` a propósito, para que no contamine `identidad`— no se puede crear.
grant usage, create on schema public to migrador;

-- Y los dos roles de aplicación NO crean nada en `public`.
revoke create on schema public from public;
grant usage on schema public to app_inquilino, app_identidad;
