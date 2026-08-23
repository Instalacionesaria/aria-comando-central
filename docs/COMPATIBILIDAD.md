# Compatibilidad con la base real

La suite corre contra el contenedor efímero de la Etapa 0, y va a seguir así: escribe y borra a
propósito, y `lib/datos/anfitrion.ts` se niega a dejarla correr contra un proveedor administrado.

Este documento es lo que **no** se puede verificar ahí. Son consultas de **solo lectura de
catálogo**, para correr a mano contra el proyecto de Supabase con conexión directa.

## Antes de tocar nada

Estas siete son la línea base. **Hay que correrlas y guardar la salida antes del primer DDL**, porque
son la única forma de demostrar después que la convivencia no rompió nada.

```sql
-- 1 · Decide si el arranque puede correr. En Supabase `postgres` NO es superusuario
--     real y REPLICATION está reservado a `supabase_admin`.
select rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolreplication
  from pg_roles order by 1;

-- 2 · Decide si `grant connect|create on database` pasa. Si el dueño es
--     `supabase_admin` y no `postgres`, esas dos líneas del arranque fallan.
select datdba::regrole from pg_database where datname = current_database();

-- 3 · Decide si `revoke create on schema public from public` es un no-op.
--     Es la ÚNICA sentencia del repo con radio de acción sobre los cinco sistemas.
--     Desde PostgreSQL 15 ya viene revocado: si `=UC/` no aparece acá, es demostrable.
select nspacl from pg_namespace where nspname = 'public';

-- 4 · El estado de RLS por tabla. No se puede averiguar con la clave `service_role`
--     (tiene `bypassrls`: toda consulta devuelve filas exista o no una política).
select c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
 order by 1;
select schemaname, tablename, policyname, cmd from pg_policies order by 1, 2, 3;

-- 5 · Los esquemas y las extensiones que existen de verdad. PostgREST solo expone
--     `public` y `graphql_public`, así que desde afuera esto es invisible.
--     `vector` está en `public`, no en `extensions` — importa si algún día se mueven objetos.
select nspname, nspowner::regrole from pg_namespace order by 1;
select extname, extnamespace::regnamespace from pg_extension order by 1;

-- 6 · Decide la sección de paridad de versión mayor (abajo).
select version();

-- 7 · ¿Ya existen nuestros esquemas o nuestros roles? Si `identidad`, `negocio` o
--     `migraciones` existieran, o si `migrador`/`app_inquilino`/`app_identidad`
--     estuvieran en uso por otro sistema, el arranque los adoptaría en silencio
--     y `alter role … password` le cambiaría la contraseña a algo en producción.
select nspname from pg_namespace where nspname in ('identidad', 'negocio', 'migraciones');
select rolname from pg_roles where rolname in ('migrador', 'app_inquilino', 'app_identidad');
```

**Si la 7 devuelve una sola fila, parar y pensar.** Es el único paso irreversible del plan.

## La prueba de dos firmas, corrida a mano

`pruebas/base/10-migraciones.test.ts` tenía `public` en el filtro de esta consulta. Se lo quitamos —
ahora pregunta por las funciones cuyo esquema es de `migrador`— porque en `public` viven **catorce
funciones RPC de otros cinco sistemas** y barrerlas es medir código ajeno: la prueba fallaría
nombrando una función que no escribimos.

Pero **el hallazgo sigue valiendo**, y hay un sospechoso concreto: `match_documents`,
`match_documents_crm` y `match_documents_sofia` salen de la plantilla RAG de Supabase, que se
distribuye con variantes sobrecargadas.

```sql
select n.nspname as esquema, p.proname as nombre, count(*) as firmas,
       string_agg(pg_get_function_identity_arguments(p.oid), ' | ') as argumentos
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
 group by 1, 2 having count(*) > 1
 order by 1, 2;
```

Por qué importa, en las palabras del `07` § 1 que el comentario de la prueba cita:

> *"PostgreSQL resuelve las sobrecargas POR CANTIDAD DE ARGUMENTOS. Si existe `f(p_org_id)` y quedó
> una `f()` heredada, un llamador que se olvide el argumento NO FALLA: ejecuta la vieja, que ignora
> la organización."*

Y esas funciones están **expuestas por PostgREST**, así que el llamador puede ser cualquiera con la
clave anónima. Lo que devuelva esta consulta es un hallazgo sobre esa base, no una prueba de este
repositorio: anotarlo acá y decidir aparte.

Mientras se está mirando, las dos que van con ella:

```sql
-- Las cinco RPC `security definer` de closer_* saltean RLS por diseño. Hoy es correcto
-- allá (sus tablas tienen RLS sin políticas), pero si alguna vez se migran, cada una
-- necesita revisión. `proconfig` tiene que traer `search_path=public` en todas.
select proname, prosecdef, proconfig, provolatile
  from pg_proc where pronamespace = 'public'::regnamespace and prosecdef
 order by 1;

-- Las tres vistas: una vista `security definer` sobre una tabla con RLS es un agujero.
select c.relname, c.reloptions
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
 order by 1;
```

## Después de migrar: la prueba de que la convivencia se sostiene

Volver a correr **1 a 7** y diffear. El criterio de éxito es un diff vacío en `public`: mismo
inventario de relaciones, mismos permisos, mismas políticas.

Y las afirmaciones que solo tienen sentido allá:

```sql
-- Ninguna tabla nuestra en `public`. Es la afirmación que prueba la convivencia.
select c.relname from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relowner = 'migrador'::regrole;
-- Se espera: cero filas.

-- Ninguna tabla de `public` recibió permisos nuestros.
select c.relname, c.relacl from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
   and array_to_string(c.relacl, ',') ~ '(migrador|app_inquilino|app_identidad)';
-- Se espera: cero filas.

-- Nuestros tres roles, sin atributos que no deberían tener. El arranque ya lo verifica
-- y aborta; esto lo confirma desde afuera.
select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
  from pg_roles where rolname in ('migrador', 'app_inquilino', 'app_identidad');

-- El `search_path` por rol quedó puesto. Es el punto exacto donde muerde la advertencia
-- de Supabase de que `SET search_path` no sobrevive en conexiones agrupadas: su propia
-- solución es ponerlo a nivel de rol, que es lo que hace `db/arranque/000_cluster.sql`.
select r.rolname, s.setconfig
  from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
 where r.rolname in ('migrador', 'app_inquilino', 'app_identidad');

-- Y la de fondo: el agrupador está en modo TRANSACCIÓN, así que la variable sobrevive
-- toda la transacción. En modo sentencia esto devuelve null y `conOrganizacion()` lanza
-- con el mensaje que ya trae escrito.
begin;
select set_config('app.org_id', '00000000-0000-0000-0000-000000000001', true);
select current_setting('app.org_id', true);  -- tiene que devolver el uuid
commit;
select current_setting('app.org_id', true);  -- tiene que devolver null o vacío
```

## Paridad de versión mayor — y las once vías sin medir

`docker-compose.yml` fija `postgres:18-alpine`. `docs/ETAPA-0.md` ya declaraba la paridad de versión
mayor como requisito *"contra el proveedor administrado, que todavía no existe"*. Ahora existe, y
Supabase corre 15 o 17.

No es una preferencia de prolijidad. `docs/ETAPA-2.md` afirma que *"PostgreSQL 18 exige privilegio
sobre todas las columnas para cualquier referencia de fila completa, así que el permiso por columna
es hermético"*. **Toda la defensa por columna sobre `identidad.usuarios.password_hash` se validó
contra un comportamiento de PG18.** De las doce vías indirectas documentadas, **una sola está en la
suite**.

Las otras once, para reproducir contra la versión real como `app_inquilino`:

```sql
select * from identidad.usuarios;
select to_jsonb(u) from identidad.usuarios u;
select row_to_json(u) from identidad.usuarios u;
select u from identidad.usuarios u;
select json_agg(u) from identidad.usuarios u;
select max(password_hash) from identidad.usuarios;
select id from identidad.usuarios order by password_hash;
select id from identidad.usuarios where password_hash is not null;
update identidad.usuarios set nombre = nombre returning password_hash;
update identidad.usuarios set nombre = password_hash;
select count(*) from identidad.usuarios group by password_hash;
```

Las once tienen que fallar con *permiso denegado*. **Si alguna devuelve datos en PG15 o PG17, es un
hallazgo de seguridad, no un ajuste de configuración**, y hay que resolverlo antes de desplegar.

## Lo que no se puede averiguar con la clave `service_role`

Queda escrito porque el intento ya se hizo y no vale repetirlo: la clave `sb_secret_` se resuelve a
`service_role`, que tiene `bypassrls`. Toda consulta devuelve filas independientemente de si RLS está
activo, si hay políticas, o si las políticas son permisivas — y no hay cabecera ni error que lo
delate. PostgREST tampoco expone `pg_roles`, `pg_policies` ni `pg_proc`.

Con la clave anónima se puede aproximar comparando conteos, pero **no distingue "RLS apagado" de
"política `using (true)`"**, que es justo la diferencia que importa. La única respuesta completa es
conexión directa, que es la que este documento asume.
