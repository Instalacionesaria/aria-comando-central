-- El alcance por persona: qué pestañas ve cada uno.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ESTO PARECE VIOLAR UNA REGLA DE ESTE MISMO ARCHIVO, Y HAY QUE DECIRLO ENTERO
--
-- La migración 003, sobre los permisos efectivos, dice:
--
--   *"SOLO SUMA, NUNCA RESTA: no hay permisos negativos. Un modelo con «permitir» y «denegar»
--   necesita reglas de precedencia, y esas reglas se vuelven imposibles de razonar en cuanto un
--   usuario tiene tres roles. Si hace falta que alguien tenga CASI un rol, la respuesta es un rol
--   nuevo — que con este modelo cuesta una fila."*
--
-- Y un alcance por persona **parece** exactamente eso: el rol da diez pestañas y el alcance deja
-- tres. Tres razones por las que no es lo mismo, y el día que alguna deje de ser cierta hay que
-- volver a discutir esta tabla:
--
--   1 · **No toca ninguna capacidad.** Dos personas con el mismo rol y alcances distintos tienen el
--       MISMO conjunto de capacidades. El alcance es una intersección, nunca una unión: no habilita
--       nada que el rol no habilite, así que no existe la pregunta «¿gana el permiso o la negación?».
--   2 · **No hay precedencia que razonar**, que es el problema concreto que la regla nombra. El
--       alcance es UNO por persona, no uno por rol: no se combinan tres alcances, no hay orden.
--   3 · **La alternativa que la regla propone no puede expresar el pedido.** Siete secciones
--       —executive, contacts, acquisition, creative, conversion, conversation, sales— comparten la
--       capacidad `tablero.ver`. Un rol nuevo por combinación NO las separa: ninguna combinación de
--       capacidades puede, porque la capacidad no distingue esas siete pantallas.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- Y LA DECISIÓN MÁS IMPORTANTE: LA RESTRICCIÓN ES UN HECHO DEL ROL, NO LA PRESENCIA DE FILAS
--
-- El primer diseño decía: «si la persona tiene filas, solo esas secciones; si no tiene, sin
-- restricción». **Eso falla ABIERTO**, y el camino es un clic normal:
--
--   `POST /api/admin/usuarios/{id}/roles` reemplaza los roles y **no toca nada más**. Degradar a
--   alguien de `administrador` a `usuario` lo deja con cero filas — o sea, con las diez pestañas.
--
-- Y al revés era peor: promover de `usuario` a `administrador` dejaba un administrador restringido a
-- una pestaña, sin Ajustes, y **sin ninguna operación para arreglarlo**.
--
-- Con la bandera en el rol los dos estados son inalcanzables, y además se cumple `ADR-0302` de
-- verdad: «el administrador está desbloqueado» no se escribe como un `if` por nombre de rol en
-- ningún lado. Es el patrón exacto de `solo_principal` y `exige_segundo_factor`, cuyo comentario en
-- la 003 dice: *"Va en el ROL y no en el código: un rol nuevo y sensible se marca con una fila, sin
-- tocar el login."*
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1 · LA BANDERA DEL ROL ───────────────────────────────────────────────────
--
-- `default false` es el transitorio seguro: si esta migración corre y el arranque todavía no, el rol
-- `usuario` se comporta **exactamente como hoy** en vez de dejar a alguien sin pestañas. El VALOR lo
-- pone `db/arranque/001_catalogo.sql`, y no puede ponerlo esta migración: `identidad.roles` tiene
-- `force row level security` sin política para `migrador`, así que el `update` afectaría **cero filas
-- informando éxito** — el modo de falla que este repositorio persigue.
alter table identidad.roles
  add column if not exists secciones_restringidas boolean not null default false;

comment on column identidad.roles.secciones_restringidas is
  'true = las personas con este rol solo ven las secciones que tengan concedidas en '
  'identidad.usuarios_secciones, y cero filas significa cero pestañas. false = sin restricción, y '
  'las filas de alcance se ignoran. Es lo que expresa «el administrador está desbloqueado» sin '
  'nombrar ningún rol en el código.';

-- ── 2 · LA TABLA DE ALCANCE ──────────────────────────────────────────────────

create table identidad.usuarios_secciones (
  -- FK SIMPLE, y el criterio es el de este esquema, no el de `negocio`: en `identidad` la tabla que
  -- tiene `org_id` propio usa clave compuesta (`organizaciones_credenciales`) y la que no lo tiene
  -- usa simple (`usuarios_roles.usuario_id`, `usuarios_segundo_factor.usuario_id`). Ésta no lleva
  -- `org_id`: el aislamiento entre inquilinos de las tablas de identidad lo pone el CÓDIGO, con
  -- `usuarioObjetivo(db, id, orgEfectiva)`, y eso ya está escrito en la 003.
  --
  -- `on delete cascade` NO es preferencia, son dos consecuencias medidas de no ponerlo:
  --   (a) la prueba que recorre `pg_constraint` buscando claves que bloqueen un borrado se pone roja
  --       hasta que alguien escriba la traducción en `lib/administracion/borrado.ts`, y
  --   (b) se pierde el único borrado real que la Etapa 12 conquistó: como el alta va a exigir al
  --       menos una sección, TODA persona nueva tendría filas y **ninguna volvería a ser borrable**.
  usuario_id uuid not null references identidad.usuarios(id) on delete cascade,

  -- ── `check` Y NO UNA TABLA DE CATÁLOGO ────────────────────────────────────
  --
  -- El argumento es de EVOLUCIÓN y está medido: desde que una tabla de identidad tiene `force row
  -- level security` sin política para `migrador`, **una migración no puede insertarle una fila**. Con
  -- un catálogo, agregar la pestaña número catorce exigiría escribir en `db/arranque/`, un `grant`
  -- nuevo y un paso más por la Management API. El DDL, en cambio, no está bloqueado:
  -- `drop constraint` / `add constraint` funciona en todos los entornos.
  --
  -- Y lo que el `check` da NO es contención —una clave inválida no concede nada, falla cerrado— sino
  -- DIAGNÓSTICO: con él, renombrar una sección **obliga** a escribir la migración que mueve las
  -- filas; sin él, el renombre deja filas huérfanas que nadie nota.
  seccion text not null check (seccion in (
    'usuarios', 'empresas', 'credenciales',
    'executive', 'contacts', 'icp',
    'acquisition', 'creative', 'conversion', 'conversation', 'sales',
    'setter', 'closer'
  )),

  concedida_el timestamptz not null default now(),
  -- Quién la concedió, como `usuarios_roles.asignado_por`. Nace `no action`, así que **sí** dispara
  -- la prueba de traducciones de borrado: hay que agregar su nombre a `QUE_LO_IMPIDE`. Se acepta a
  -- propósito y con simetría: hoy quien le asignó un rol a otro tampoco es borrable.
  concedida_por uuid references identidad.usuarios(id),

  -- Sin `org_id` en la clave primaria, y es legítimo en `identidad`: la prueba de forma de las tablas
  -- que lo exige está acotada al esquema `negocio`.
  primary key (usuario_id, seccion)
);

-- El portero filtra por `usuario_id` en CADA petición de una persona restringida. Es el único índice
-- extra que lleva la tabla hermana.
create index usuarios_secciones_por_usuario on identidad.usuarios_secciones (usuario_id);

-- ── 3 · EL RÉGIMEN, copiado de `usuarios_roles` ──────────────────────────────
--
-- `enable` + `force`: sin `force`, el dueño de la tabla la evade. La prueba de migraciones exige las
-- tres cosas para toda tabla de identidad — habilitada, forzada, y al menos una política.
alter table identidad.usuarios_secciones enable row level security;
alter table identidad.usuarios_secciones force  row level security;
revoke all on identidad.usuarios_secciones from public;

-- `select, insert, delete` y NO `update`: es lo que tienen las dos tablas de asignación, porque una
-- fila de asignación no se edita — se pone y se quita. Y la prueba de permisos por rol compara los
-- privilegios EXACTOS, así que un `update` otorgado sin declararlo se ve.
grant select, insert, delete on identidad.usuarios_secciones to app_identidad;

-- UNA política permisiva dirigida SOLO a `app_identidad`. Al rol del inquilino no se le otorga nada,
-- y con eso alcanza: en `identidad` no hay `alter default privileges`, así que una tabla nueva nace
-- sin acceso para nadie. Sin `grant`, el inquilino falla con «permission denied» —fuerte y a la
-- vista— en vez de devolver vacío.
--
-- PROHIBIDO escribirle una política con `exists` contra `identidad.usuarios` para filtrar por
-- organización: las políticas de la tabla consultada se aplican también dentro de la subconsulta, y
-- el ciclo hace que PostgreSQL falle con «recursión infinita detectada en la política» EN
-- PRODUCCIÓN, no en la migración. Está escrito en la 003.
create policy usuarios_secciones_identidad on identidad.usuarios_secciones
  for all to app_identidad using (true) with check (true);
