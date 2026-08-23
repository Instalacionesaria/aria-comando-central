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
--
-- ── POR QUÉ ESTO VERIFICA Y NO IMPONE ──────────────────────────────────────────
--
-- Acá había tres `alter role … nosuperuser nobypassrls nocreatedb nocreaterole
-- noreplication`, y contra un proveedor administrado NO SE PUEDEN CORRER.
--
-- PostgreSQL valida estas opciones POR PRESENCIA, no por cambio de valor: si el
-- `DefElem` de SUPERUSER o REPLICATION está en la sentencia y el invocador no tiene
-- ese atributo, aborta — aunque el valor sea `NOSUPERUSER` y el rol ya no lo sea. En
-- Supabase el rol `postgres` NO es superusuario real y REPLICATION está reservado a
-- `supabase_admin`, así que el arranque moría en la primera de las tres. Y como
-- `scripts/db.mjs` manda el archivo entero en una `query()` sin parámetros
-- —protocolo simple, transacción implícita— se revertía TODO: ni los roles ni las
-- rutas de búsqueda ni los permisos quedaban puestos.
--
-- La intención del `alter` era "aunque alguien los haya tocado", o sea reafirmar.
-- Reafirmar es imposible sin superusuario; DETECTAR no. Esto detecta exactamente el
-- mismo estado y aborta el arranque entero antes de que se cree un solo objeto, que
-- es lo que un `alter` que no se puede correr nunca iba a lograr.
--
-- Lo que se pierde, dicho de frente: si un rol amaneciera con `bypassrls`, antes
-- esto lo arreglaba en un clúster propio. Ahora lo denuncia y para. Contra el
-- clúster local es un cambio a peor de un renglón; contra el administrado es la
-- diferencia entre tener arranque y no tenerlo.
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
             case when rolreplication then 'replicación'   end) || ')', '; ')
    into malo
    from pg_roles
   where rolname in ('migrador', 'app_inquilino', 'app_identidad')
     and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication);

  if malo is not null then
    raise exception
      'un rol de la aplicación tiene atributos que no debería tener: %. '
      'Con `bypassrls` o superusuario, `force row level security` no lo alcanza y el '
      'aislamiento se ve perfecto sin estar puesto. Corregilo con un rol que pueda '
      '(`alter role … nobypassrls nosuperuser`) y volvé a correr el arranque.', malo;
  end if;
end $$;

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

-- NO se instala `pgcrypto`, y acá está por qué.
--
-- Había un `create extension if not exists pgcrypto` con el comentario
-- "`gen_random_uuid()`. Necesita superusuario". Las dos mitades son falsas hoy:
--
--   1. `gen_random_uuid()` está en el NÚCLEO de PostgreSQL desde la versión 13. Es
--      lo único por lo que se instalaba, y no hace falta la extensión para tenerlo.
--   2. Ninguna migración usa una sola función de pgcrypto: ni `digest`, ni `hmac`,
--      ni `pgp_sym_*`, ni `crypt`, ni `gen_salt`. Las contraseñas se hashean con
--      `scrypt` de Node (`lib/datos/hash.ts`) y el cifrado de credenciales con
--      `node:crypto` (`lib/credenciales/cifrado.ts`), a propósito: el 02 § 1 pide el
--      lento de la biblioteca estándar del entorno, no uno del motor.
--
-- Y contra la base real la línea no era solo inútil: si la extensión no estuviera
-- instalada, se crearía en el primer esquema de la ruta de `postgres` —típicamente
-- `public`— metiendo ~30 funciones nuestras en el esquema de los otros cinco
-- sistemas. Exactamente lo que la convivencia existe para no hacer.

-- Los tres se conectan a esta base. El nombre lo sustituye scripts/db.mjs desde la
-- cadena de conexión, citado como identificador: `grant … on database` exige un
-- nombre literal, no acepta `current_database()`.
grant connect on database @BASE@ to migrador, app_inquilino, app_identidad;

-- Y `migrador` crea los esquemas, así que necesita CREATE sobre la base. Los dos
-- roles de aplicación NO: no crean nada, nunca.
grant create on database @BASE@ to migrador;

-- NO hay `grant create on schema public to migrador`, y es deliberado.
--
-- Lo había: la contabilidad de las migraciones vivía en `public` y ahí tenía que
-- poder crear sus dos tablas. Desde que la contabilidad tiene su propio esquema
-- (`lib/datos/migrador.ts`, ESQUEMA_CONTABILIDAD), ese grant no tiene ningún uso —
-- y era la ÚNICA razón por la que `migrador` podía crear objetos en `public`.
--
-- Importa porque `public` no es un esquema vacío: en la base real conviven ahí 59
-- tablas de cinco sistemas. Sin este grant, nuestro rol propietario no puede
-- escribir en el esquema de otros ni por accidente ni por una migración mal escrita.
-- El `usage` sí queda: alcanza para nombrar el esquema y no da acceso a ninguna tabla.
grant usage on schema public to migrador;

-- Y los dos roles de aplicación NO crean nada en `public`.
--
-- Desde PostgreSQL 15 esto ya viene revocado por omisión, así que contra un clúster
-- moderno es un no-op. Se deja porque es la única sentencia de este archivo con
-- radio de acción sobre objetos que no son nuestros, y quitarla en silencio sería
-- perder el registro de que alguien la pensó: antes de correr esto contra un clúster
-- compartido, mirar `select nspacl from pg_namespace where nspname = 'public'`. Si
-- `=UC/` no aparece, es demostrablemente un no-op.
revoke create on schema public from public;
grant usage on schema public to app_inquilino, app_identidad;
