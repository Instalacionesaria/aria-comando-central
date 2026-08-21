-- ADR-0103, ADR-0104 — El catálogo de capacidades y el modelo extensible de roles.
--
-- DDL: 01-ESQUEMA-DE-DATOS § 4, con la columna de organización y el índice
--      centinela del 08 § 6.
-- Datos iniciales: 01 § 10.
-- Permisos y políticas: 09-ESCOTILLA-Y-ESTADOS § 2, bloques 4, 5, 6 y 7.
--
-- LOS ROLES SON DATOS, no un tipo enumerado del código. Lo que el código consulta
-- es la CAPACIDAD (`usuarios.crear`), nunca el nombre del rol. Comparar nombres de
-- rol esparce la definición de cada rol por todo el código: agregar un rol nuevo
-- obliga a buscar cada `if` y decidir si entra. Con capacidades, un rol nuevo es una
-- fila de configuración y CERO cambios de código (03 § 1).
--
-- ORDEN DENTRO DE ESTA MIGRACIÓN, y no es cosmético: primero las tablas, después
-- los DATOS INICIALES, y recién al final `enable`/`force row level security`.
--
-- Con el forzado puesto y sin política que nombre a `migrador`, un `insert` desde una
-- migración FALLA POR POLÍTICA. Insertar antes de encender el forzado es la única vía
-- que no exige darle una política al rol que migra —prohibido por EJECUCION § 3— y
-- **no** es "quitar el forzado y reponerlo": el forzado se enciende UNA vez y no se
-- apaga nunca.
--
-- Y la distinción con el sembrado de `db/sembrado/`, que es la que importa:
--
--   · El catálogo de capacidades y los dos roles de sistema son DATOS DE REFERENCIA:
--     los necesita TODO entorno, producción incluida. Van en la migración.
--   · Las organizaciones de desarrollo son DATOS DE ENTORNO: no deben existir en
--     producción. Van por `conIdentidad()`, fuera de las migraciones.
--
-- Las migraciones corren también en producción. Ésa es toda la diferencia.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · El catálogo de capacidades
-- ═════════════════════════════════════════════════════════════════════════════

-- Una fila por cosa que se puede hacer. Una capacidad es una acción concreta sobre
-- un recurso, con un nombre estable: `recurso.accion`.
create table identidad.permisos (
  clave        text primary key,          -- 'usuarios.crear', 'reportes.ver'
  descripcion  text not null
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · Roles
-- ═════════════════════════════════════════════════════════════════════════════

create table identidad.roles (
  id           uuid primary key default gen_random_uuid(),
  -- `not null` es un REQUISITO del índice centinela de abajo, no una preferencia:
  -- la regla de que los nulos no se comparan aplica a TODAS las columnas del índice,
  -- así que con `clave` nula la fila queda exenta igual y el centinela no sirve de
  -- nada (08 § 6).
  clave        text not null,             -- 'administrador', 'operador'
  -- Nulo = plantilla global de la plataforma. Con valor = rol PRIVADO de esa
  -- organización.
  --
  -- Se crea VACÍA desde el primer día aunque al principio definamos todos los roles
  -- nosotros (EJECUCION § 3): agregarla sin datos cuesta cero, y agregarla cuando ya
  -- hay asignaciones repartidas entre clientes cuesta una migración de datos que hay
  -- que pensar caso por caso.
  org_id       uuid references identidad.organizaciones(id) on delete cascade,
  nombre       text not null,             -- para mostrar
  descripcion  text,
  -- Un rol de sistema no se puede borrar ni renombrar desde la interfaz. Protege a
  -- los dos que el sistema necesita para funcionar: sin esto, un administrador puede
  -- borrar su propio rol y dejar la organización sin nadie que administre.
  es_sistema   boolean not null default false,
  -- Solo puede existir en la organización principal. Es LA BARRERA contra la
  -- escalada entre inquilinos: sin ella, el administrador de una empresa cliente
  -- podría otorgarse un rol de plataforma dentro de su propia empresa y con él ver a
  -- todas las demás. La hace cumplir un disparador (007), no un condicional.
  solo_principal boolean not null default false,
  -- Si este rol exige segundo factor. Va en el ROL y no en el código: un rol nuevo y
  -- sensible se marca con una fila, sin tocar el login.
  exige_segundo_factor boolean not null default false,
  creado_el    timestamptz not null default now()
);

-- La unicidad NO puede ser `clave unique` a secas: dos organizaciones tienen que
-- poder tener un rol con la misma clave. El centinela es lo que hace que la regla
-- valga también para las plantillas globales, porque en un índice único los nulos no
-- se comparan entre sí — sin él, dos plantillas globales podrían compartir clave.
--
-- Y el centinela no puede existir como dato: eso lo garantiza la restricción
-- `org_no_nula` de la migración 002.
create unique index roles_clave_unica
  on identidad.roles (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), clave);

-- Todo rol de plataforma exige segundo factor. Es una INVARIANTE, no una convención:
-- ese rol ve los datos de TODAS las organizaciones, y una contraseña filtrada sin
-- segundo factor es una brecha de todos los clientes a la vez.
alter table identidad.roles add constraint roles_plataforma_exige_2fo
  check (not solo_principal or exige_segundo_factor);

create table identidad.roles_permisos (
  rol_id       uuid not null references identidad.roles(id) on delete cascade,
  permiso      text not null references identidad.permisos(clave) on delete cascade,
  primary key (rol_id, permiso)
);

create table identidad.usuarios_roles (
  usuario_id   uuid not null references identidad.usuarios(id) on delete cascade,
  rol_id       uuid not null references identidad.roles(id),
  asignado_el  timestamptz not null default now(),
  asignado_por uuid references identidad.usuarios(id),
  primary key (usuario_id, rol_id)
);

create index usuarios_roles_por_usuario on identidad.usuarios_roles (usuario_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · Los permisos efectivos, en una consulta
--
-- La unión de los permisos de todos los roles del usuario. SOLO SUMA, NUNCA RESTA:
-- no hay permisos negativos. Un modelo con "permitir" y "denegar" necesita reglas de
-- precedencia, y esas reglas se vuelven imposibles de razonar en cuanto un usuario
-- tiene tres roles. Si hace falta que alguien tenga CASI un rol, la respuesta es un
-- rol nuevo — que con este modelo cuesta una fila.
-- ═════════════════════════════════════════════════════════════════════════════

-- `security_invoker = true` no es opcional y es la única vista del proyecto.
--
-- Por omisión una vista corre con los permisos de SU DUEÑO, y una vista sobre tablas
-- protegidas creada por el rol de las migraciones EVADE las políticas de fila y
-- devuelve todo (09 § 2, "lo que ninguna política cubre", punto 2). Con
-- `security_invoker` corre con los permisos de quien la invoca.
--
-- Consecuencia de esa misma decisión: solo la puede usar un rol con permiso sobre las
-- tres tablas que lee, y ése es `app_identidad`. Está bien así: los permisos
-- efectivos se resuelven en el portero, que corre por identidad.
--
-- `distinct` y no `group by` sin agregación: hacen lo mismo, pero un `group by` sin
-- función de agregado se lee como un error en una revisión.
create or replace view identidad.usuarios_permisos with (security_invoker = true) as
  select distinct ur.usuario_id, rp.permiso
    from identidad.usuarios_roles ur
    join identidad.roles_permisos rp on rp.rol_id = ur.rol_id;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · Datos iniciales (01 § 10) — ANTES de encender el forzado
-- ═════════════════════════════════════════════════════════════════════════════

insert into identidad.permisos (clave, descripcion) values
  ('organizaciones.crear',    'Dar de alta organizaciones'),
  ('organizaciones.editar',   'Editar cualquier organización'),
  -- Necesaria para el cambio de organización activa del rol de plataforma: ese
  -- endpoint tiene que exigir una capacidad explícita, no "ninguna".
  ('organizaciones.listar',   'Ver y cambiar entre todas las organizaciones'),
  -- Necesaria si los administradores de cada cliente van a crear roles propios. Hoy
  -- no lo van a hacer —EJECUCION § 3: la columna existe y queda vacía— pero la
  -- capacidad se cataloga porque el rol de administrador la necesita para que el
  -- catálogo no cambie cuando se habilite.
  ('roles.administrar',       'Crear y editar roles de su organización'),
  ('usuarios.ver',            'Ver los usuarios de su organización'),
  ('usuarios.crear',          'Crear usuarios en su organización'),
  ('usuarios.editar',         'Editar usuarios de su organización'),
  ('usuarios.desactivar',     'Desactivar usuarios de su organización'),
  ('roles.asignar',           'Asignar y quitar roles'),
  ('credenciales.ver',        'Ver el estado de las credenciales (enmascaradas)'),
  ('credenciales.editar',     'Cargar y rotar credenciales'),
  ('configuracion.editar',    'Editar la configuración de su organización'),
  ('auditoria.ver',           'Ver el registro de accesos');

-- El rol de plataforma nace exigiendo segundo factor: la restricción
-- `roles_plataforma_exige_2fo` no lo deja nacer de otra forma.
insert into identidad.roles (clave, nombre, es_sistema, solo_principal, exige_segundo_factor) values
  ('superadministrador', 'Superadministrador', true, true,  true),
  ('administrador',      'Administrador',      true, false, false);

-- El superadministrador recibe todo.
--
-- EJECUCION § 3 cerró que el rol de plataforma tiene TODAS las capacidades cargadas
-- en la tabla, SIN atajo en el portero: con cuatro roles y veinte usuarios el atajo
-- ahorra poco y crea un camino de código que se ejercita distinto que el normal. Con
-- las capacidades en la tabla hay un solo camino, y una prueba de catálogo garantiza
-- que las tenga todas.
insert into identidad.roles_permisos (rol_id, permiso)
  select r.id, p.clave
    from identidad.roles r, identidad.permisos p
   where r.clave = 'superadministrador';

-- El administrador, todo lo de su organización.
insert into identidad.roles_permisos (rol_id, permiso)
  select r.id, p.clave
    from identidad.roles r, identidad.permisos p
   where r.clave = 'administrador'
     and p.clave not like 'organizaciones.%';

-- Los roles de OPERACIÓN —los que usa la gente para trabajar— no van acá: dependen
-- del producto y se crean cuando exista el producto. Eso es exactamente lo que este
-- modelo permite hacer sin tocar código.

-- ═════════════════════════════════════════════════════════════════════════════
-- 5 · Permisos y políticas — 09 § 2, bloques 4 a 7
-- ═════════════════════════════════════════════════════════════════════════════

-- ── permisos · catálogo global de capacidades. Solo identidad, y solo lectura:
--    la escritura es una migración.
alter table identidad.permisos enable row level security;
alter table identidad.permisos force  row level security;
revoke all on identidad.permisos from public;

grant select on identidad.permisos to app_identidad;

create policy permisos_lectura on identidad.permisos for select to app_identidad
  using (true);

-- ── roles · pueden ser globales (organización nula) o privados de una organización.
--    Los DOS casos, escritos.
alter table identidad.roles enable row level security;
alter table identidad.roles force  row level security;
revoke all on identidad.roles from public;

grant select                         on identidad.roles to app_inquilino;
grant select, insert, update, delete on identidad.roles to app_identidad;

-- El inquilino ve las plantillas globales y SUS roles privados. Nada más. Alcanza
-- para mostrar el nombre del rol de una persona en una lista.
create policy roles_visibles on identidad.roles for select to app_inquilino
  using (org_id is null
         or org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

create policy roles_identidad on identidad.roles for all to app_identidad
  using (true) with check (true);

-- ── roles_permisos y usuarios_roles · SOLO identidad.
--
-- POR QUÉ NO LLEVAN UNA POLÍTICA QUE HAGA JOIN, que es lo que parece correcto:
-- ninguna de las dos tiene columna de organización, así que la política "correcta"
-- sería un `exists` contra `roles` o contra `usuarios`. Eso trae dos problemas: las
-- políticas de ESA tabla se aplican también dentro de la subconsulta, y si una
-- política entra en ciclo PostgreSQL falla con RECURSIÓN INFINITA DETECTADA EN LA
-- POLÍTICA — un error de EJECUCIÓN en producción, no de migración.
--
-- La salida es que el rol del inquilino NO ACCEDA a estas tablas en absoluto. No las
-- necesita: los permisos efectivos se resuelven UNA sola vez, en el portero, con la
-- conexión de identidad, antes de abrir el contexto del inquilino.
--
-- Y la consecuencia que hay que decir en vez de dejar implícita: la pantalla que
-- ADMINISTRA roles y permisos de un cliente es una operación del dominio de
-- identidad. Corre por la conexión sin filtro, así que TIENE QUE FILTRAR POR
-- ORGANIZACIÓN EN EL CÓDIGO, va en la lista de archivos autorizados, y necesita su
-- propia prueba. Es la única parte de este diseño donde el aislamiento depende del
-- código y no de la base.
alter table identidad.roles_permisos enable row level security;
alter table identidad.roles_permisos force  row level security;
revoke all on identidad.roles_permisos from public;
grant select, insert, delete on identidad.roles_permisos to app_identidad;
create policy roles_permisos_identidad on identidad.roles_permisos
  for all to app_identidad using (true) with check (true);

alter table identidad.usuarios_roles enable row level security;
alter table identidad.usuarios_roles force  row level security;
revoke all on identidad.usuarios_roles from public;
grant select, insert, delete on identidad.usuarios_roles to app_identidad;
create policy usuarios_roles_identidad on identidad.usuarios_roles
  for all to app_identidad using (true) with check (true);

-- La vista de permisos efectivos: solo identidad. Quien la invoca necesita permiso
-- sobre las tres tablas que lee, y el inquilino no lo tiene sobre dos de ellas.
grant select on identidad.usuarios_permisos to app_identidad;

-- El cinturón además del tirante, idempotente, y NUNCA `in schema identidad`.
grant select, insert, update, delete on all tables    in schema negocio to app_inquilino;
grant usage, select                  on all sequences in schema negocio to app_inquilino;
