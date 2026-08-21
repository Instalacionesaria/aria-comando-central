-- `identidad.organizaciones` e `identidad.usuarios`.
--
-- DDL: 01-ESQUEMA-DE-DATOS § 2 y § 3, literal.
-- Permisos y políticas: 09-ESCOTILLA-Y-ESTADOS § 2, bloques 1 y 2, literales.
--
-- POR QUÉ ESTAS DOS TABLAS ESTÁN EN LA ETAPA 0 y no en la 1 — es la decisión de
-- alcance más grande de la etapa, y está confirmada: el criterio de cierre de la
-- Etapa 0 exige "dos organizaciones sembradas con un usuario cada una", y sin
-- estas dos tablas ese criterio NO ES EXPRESABLE. La alternativa —sembrar en una
-- tabla provisional— sería inventar una tabla, que EJECUCION § 6 prohíbe.
--
-- Y vienen con sus permisos y políticas, no desnudas. Si nacieran sin RLS, la
-- prueba ⛔ del sembrado solo podría leerlas como `migrador` (el propietario), que
-- es exactamente el patrón que el 09 § 1 dice que mata estas pruebas: "hay que
-- correrlas con el rol real de la aplicación, nunca con el propietario ni con un
-- rol privilegiado: con ésos, casi nada de esto se manifiesta y todo se ve
-- perfecto". Así la prueba se escribe UNA vez y no se reescribe en la Etapa 2.
--
-- Quedan para la Etapa 1: las otras ocho tablas de identidad, los disparadores del
-- 01 § 6, el catálogo del 01 § 10, la función `aplicar_aislamiento` y el
-- `unique (org_id, id)` del 01 § 8.
--
-- Los nombres van CALIFICADOS. El 01 § 0 escribe sin calificar con la ruta de
-- búsqueda puesta; acá se califica a propósito, porque el 09 § 6 nombra la ruta de
-- búsqueda mal puesta como el mecanismo real por el que una tabla nace en el
-- esquema equivocado, y el `search_path` por rol solo aplica a sesiones abiertas
-- DESPUÉS del `alter role`. El código de la aplicación sí escribe sin calificar:
-- para eso está la ruta por rol.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · organizaciones — el inquilino
-- ═════════════════════════════════════════════════════════════════════════════

create table identidad.organizaciones (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  -- Identificador legible para URLs y para hablar de la empresa sin el uuid.
  slug            text not null unique,
  -- Una organización desactivada no opera: sus usuarios no entran y sus tareas
  -- programadas no corren. No se borra, para no perder su historia.
  activa          boolean not null default true,
  -- La organización que administra la plataforma. Hay UNA (ver el índice de abajo).
  es_principal    boolean not null default false,
  -- No es un lujo: si el producto tiene la noción de "hoy", ese día lo tiene que
  -- calcular la base con la zona de la organización, nunca el lenguaje con la zona
  -- del servidor. Un servidor en UTC y una empresa en UTC−5 cambian de día cinco
  -- horas antes.
  zona_horaria    text not null default 'UTC',
  creada_el       timestamptz not null default now(),
  actualizada_el  timestamptz not null default now()
);

-- Exactamente una organización principal. El índice parcial es más simple que un
-- disparador: dos filas con `true` no pueden existir, y el error viene de la base.
create unique index organizaciones_una_principal
  on identidad.organizaciones (es_principal) where es_principal;

create index organizaciones_activas
  on identidad.organizaciones (activa) where activa;

-- El centinela de todos-ceros no puede existir como dato, o la unicidad de las
-- claves de rol —que lo usa como `coalesce` para las plantillas globales— colisiona
-- de verdad (01 § 4). La tabla `roles` es de la Etapa 1; la restricción va acá
-- porque es de esta tabla.
alter table identidad.organizaciones add constraint org_no_nula
  check (id <> '00000000-0000-0000-0000-000000000000'::uuid);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · usuarios
-- ═════════════════════════════════════════════════════════════════════════════

create table identidad.usuarios (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references identidad.organizaciones(id),
  nombre                 text not null,

  -- Credenciales. Ver el CHECK de abajo: van juntas o no van.
  email                  text,
  password_hash          text,

  activo                 boolean not null default true,
  -- El administrador fundador. Hay UNO y es inmutable en lo que importa.
  es_admin_principal     boolean not null default false,
  -- Nace en true con una contraseña temporal; el portero lo encierra hasta que la
  -- cambie.
  debe_cambiar_password  boolean not null default false,

  -- Bloqueo por intentos fallidos.
  intentos_fallidos      integer not null default 0,
  bloqueado_hasta        timestamptz,

  ultimo_acceso_el       timestamptz,
  creado_por             uuid references identidad.usuarios(id),
  creado_el              timestamptz not null default now(),

  -- Una cuenta tiene email y contraseña, o ninguno de los dos. Existe porque en un
  -- sistema así suele haber usuarios SIN acceso: personas importadas de otro
  -- sistema que solo sirven para atribuir trabajo. Un usuario con email y sin
  -- contraseña sería una cuenta que no puede entrar y nadie sabría por qué.
  constraint usuarios_credenciales_completas check (
    (email is null and password_hash is null) or
    (email is not null and password_hash is not null)
  )
);

-- Email único SIN importar mayúsculas, y solo cuando existe.
--
-- `lower(...)` porque nadie escribe su email igual dos veces. `where email is not
-- null` es lo que permite convivir con los usuarios sin acceso: sin el `where`,
-- todos ellos colisionarían entre sí en el valor nulo.
--
-- TRAMPA a recordar en la Etapa 4: la consulta del login TIENE QUE USAR LA MISMA
-- EXPRESIÓN (`where lower(email) = lower($1)`). Buscar por la columna cruda
-- funciona solo mientras todos los caminos guarden en minúsculas.
create unique index usuarios_email_unico
  on identidad.usuarios (lower(email)) where email is not null;

create unique index usuarios_un_admin_principal
  on identidad.usuarios (es_admin_principal) where es_admin_principal;

create index usuarios_por_org on identidad.usuarios (org_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · Permisos y políticas — 09 § 2, bloque 1: organizaciones
--
-- El inquilino ve y edita SU fila; identidad las ve todas (login, alta, soporte).
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.organizaciones enable row level security;
alter table identidad.organizaciones force  row level security;
revoke all on identidad.organizaciones from public;

grant select                        on identidad.organizaciones to app_inquilino;
grant update (nombre, zona_horaria) on identidad.organizaciones to app_inquilino;
grant select, insert, update        on identidad.organizaciones to app_identidad;

create policy org_propia_lee on identidad.organizaciones for select to app_inquilino
  using (id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

-- Escritura acotada a la propia fila: la configuración la edita el cliente, pero
-- `activa` y `es_principal` NO están entre las columnas otorgadas.
create policy org_propia_edita on identidad.organizaciones for update to app_inquilino
  using      (id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid))
  with check (id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

create policy org_identidad on identidad.organizaciones for all to app_identidad
  using (true) with check (true);

-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · Permisos y políticas — 09 § 2, bloque 2: usuarios
--
-- PERMISO POR COLUMNA. El dominio del inquilino necesita nombre y correo para
-- mostrar autores y listas. NO necesita el hash de la contraseña ni las marcas de
-- bloqueo. Si una consulta de negocio tuviera una inyección, el hash NO ESTÁ A SU
-- ALCANCE.
--
-- Las políticas filtran FILAS; los permisos filtran COLUMNAS. Son dos ejes
-- distintos y hacen falta los dos.
--
-- CONSECUENCIA: con permisos por columna, `select *` deja de funcionar desde el
-- dominio del inquilino — falla con permiso denegado. Falla fuerte, que está bien,
-- pero muchos constructores de consultas emiten `select *` por omisión. La
-- convención del proyecto es explícita: desde el dominio del inquilino, LAS
-- COLUMNAS SE NOMBRAN SIEMPRE.
--
-- Verificado en la compuerta del controlador: `has_table_privilege` NO ve los
-- permisos por columna, así que la prueba de catálogo usa `has_column_privilege`
-- para estas tablas.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.usuarios enable row level security;
alter table identidad.usuarios force  row level security;
revoke all on identidad.usuarios from public;

grant select (id, org_id, nombre, email, activo) on identidad.usuarios to app_inquilino;
-- Y la ESCRITURA de lo que no toca credenciales, también por columna. Sin esto,
-- editar y desactivar usuarios correrían por el dominio de identidad —sin filtro de
-- base— y el único control sería un condicional del backend: el administrador del
-- cliente A llamando a la operación de edición con el identificador de un usuario
-- del cliente B, y la base sin detenerlo.
grant update (nombre, activo) on identidad.usuarios to app_inquilino;
grant select, insert, update  on identidad.usuarios to app_identidad;

create policy usuarios_del_inquilino on identidad.usuarios for select to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

create policy usuarios_edita_inquilino on identidad.usuarios for update to app_inquilino
  using      (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid))
  with check (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

create policy usuarios_identidad on identidad.usuarios for all to app_identidad
  using (true) with check (true);
