-- Las conexiones con Meta: «Conectar con Meta» para los tres niveles (Meta directo, M1, 2026-10-26).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ
--
-- Hasta acá cada empresa —y desde el nivel 3, cada cliente— pegaba en Ajustes el token de un usuario del sistema creado
-- en SU propia app de Meta (`meta_token_cifrado` y `meta_cuenta_id` en `organizaciones_credenciales` y
-- `cuentas_credenciales`). Con «Conectar con Meta» todos se conectan a la app de ARIA por Facebook Login for Business:
-- el cliente elige su portfolio y sus cuentas publicitarias, y Meta nos da un token del usuario del sistema de la
-- integración (BISU), atado a SU negocio y no a una persona. El plan: `~/.claude/plans/la-idea-es-que-jazzy-origami.md`.
--
-- Tres tablas, las tres en `identidad` y sólo para `app_identidad`, como las credenciales (un token no se lee desde el
-- inquilino):
--
--   · `conexiones_de_meta`: una por cada vez que alguien conecta un negocio de Meta. Con `cuenta_id` nulo la conectó la
--     EMPRESA (una agencia que administra las cuentas de sus clientes conecta una vez para todos); con valor, la conectó
--     ese cliente con su propio portfolio. `origen` = `manual` son los tokens pegados de antes, copiados por la fase
--     `meta-manual-a-conexiones`: siguen sirviendo hasta que cada uno conecte por el botón.
--   · `cuentas_publicitarias_de_meta`: cada `act_…` que una conexión puede leer, y A QUÉ CLIENTE se asigna. Un cliente
--     puede tener varias; un `act_` es de un solo cliente por organización.
--   · `estados_de_oauth`: el `state` del viaje a Meta, de un solo uso, guardado como hash y atado a la sesión, la persona,
--     la organización y el cliente que pidió conectar, con un vencimiento corto.
--
-- Las columnas viejas `meta_*` NO se tocan: primero se suma, después se quita (el retiro va después de producción).
-- Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── Las conexiones ───────────────────────────────────────────────────────────

create table if not exists identidad.conexiones_de_meta (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references identidad.organizaciones (id) on delete cascade,
  cuenta_id            uuid,
  token_cifrado        text not null,
  negocio_de_meta_id   text check (negocio_de_meta_id ~ '^[0-9]{1,30}$'),
  origen               text not null check (origen in ('oauth', 'manual')),
  estado               text not null default 'activa' check (estado in ('activa', 'revocada', 'vencida')),
  conectada_por        uuid,
  conectada_el         timestamptz not null default now(),
  ultimo_error         text check (char_length(ultimo_error) <= 300),
  ultimo_error_el      timestamptz,
  unique (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id) on delete cascade,
  foreign key (org_id, conectada_por) references identidad.usuarios (org_id, id) on delete set null (conectada_por)
);

-- Una sola conexión manual por (organización, cliente o empresa), y una sola por negocio de Meta conectado por OAuth:
-- volver a conectar el mismo portfolio reemplaza el token en vez de sumar una conexión fantasma.
create unique index if not exists conexiones_de_meta_una_manual
  on identidad.conexiones_de_meta (org_id, cuenta_id) nulls not distinct where origen = 'manual';
create unique index if not exists conexiones_de_meta_un_negocio
  on identidad.conexiones_de_meta (org_id, cuenta_id, negocio_de_meta_id) nulls not distinct where origen = 'oauth';

comment on table identidad.conexiones_de_meta is
  'Cada negocio de Meta conectado a la app de ARIA (Meta directo, 101). Con cuenta_id nulo la conectó la empresa (puede asignar sus cuentas a cualquiera de sus clientes); con valor, ese cliente con su propio portfolio. El token está cifrado con CLAVE_MAESTRA y sólo lo lee app_identidad.';
comment on column identidad.conexiones_de_meta.cuenta_id is 'Quién conectó: nulo = la empresa; un cliente = ese cliente con su propio Business Manager.';
comment on column identidad.conexiones_de_meta.token_cifrado is 'El token de Meta cifrado (AES-256-GCM, CLAVE_MAESTRA). Por OAuth es el del usuario del sistema de la integración (BISU): del negocio, no de una persona.';
comment on column identidad.conexiones_de_meta.negocio_de_meta_id is 'El client_business_id que Meta devuelve con el token: el portfolio comercial que se conectó. Nulo en las manuales.';
comment on column identidad.conexiones_de_meta.origen is 'oauth = por el botón «Conectar con Meta»; manual = un token pegado en Ajustes antes del botón (respaldo transitorio).';
comment on column identidad.conexiones_de_meta.estado is 'activa, revocada (el cliente la quitó en Meta o Meta respondió 190) o vencida. Sólo una activa se usa para leer.';
comment on column identidad.conexiones_de_meta.conectada_por is 'La persona que conectó. Nulo en las copiadas de un token manual o si la persona ya no existe.';
comment on column identidad.conexiones_de_meta.ultimo_error is 'El último error de Meta al usarla, en texto corto y sin secretos. Nulo si la última vez anduvo.';

alter table identidad.conexiones_de_meta enable row level security;
alter table identidad.conexiones_de_meta force row level security;
revoke all on identidad.conexiones_de_meta from public;
grant select, insert, update, delete on identidad.conexiones_de_meta to app_identidad;
drop policy if exists conexiones_de_meta_identidad on identidad.conexiones_de_meta;
create policy conexiones_de_meta_identidad on identidad.conexiones_de_meta for all to app_identidad using (true) with check (true);

-- ─── Las cuentas publicitarias y a qué cliente van ─────────────────────────────────

create table if not exists identidad.cuentas_publicitarias_de_meta (
  org_id           uuid not null references identidad.organizaciones (id) on delete cascade,
  act_id           text not null check (act_id ~ '^act_[0-9]{1,30}$'),
  conexion_id      uuid not null,
  nombre           text check (char_length(nombre) <= 200),
  moneda           text check (moneda ~ '^[A-Z]{3}$'),
  zona_horaria     text check (char_length(zona_horaria) <= 64),
  estado_en_meta   int,
  cuenta_id        uuid,
  asignada_por     uuid,
  asignada_el      timestamptz,
  vista_el         timestamptz not null default now(),
  primary key (org_id, act_id),
  foreign key (org_id, conexion_id) references identidad.conexiones_de_meta (org_id, id) on delete cascade,
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id) on delete set null (cuenta_id),
  foreign key (org_id, asignada_por) references identidad.usuarios (org_id, id) on delete set null (asignada_por)
);
create index if not exists cuentas_publicitarias_de_meta_por_cliente
  on identidad.cuentas_publicitarias_de_meta (org_id, cuenta_id) where cuenta_id is not null;
create index if not exists cuentas_publicitarias_de_meta_por_conexion
  on identidad.cuentas_publicitarias_de_meta (org_id, conexion_id);

comment on table identidad.cuentas_publicitarias_de_meta is
  'Cada cuenta publicitaria (act_…) que una conexión de Meta puede leer, y a qué cliente se asigna (Meta directo, 101). Un act_ es de un solo cliente por organización; un cliente puede tener varias.';
comment on column identidad.cuentas_publicitarias_de_meta.act_id is 'El id de la cuenta publicitaria, siempre con el prefijo act_.';
comment on column identidad.cuentas_publicitarias_de_meta.conexion_id is 'La conexión con cuyo token se lee esta cuenta.';
comment on column identidad.cuentas_publicitarias_de_meta.nombre is 'El nombre de la cuenta publicitaria en Meta (de la cuenta, no de una persona).';
comment on column identidad.cuentas_publicitarias_de_meta.moneda is 'La moneda de la cuenta publicitaria (currency de Meta, ISO 4217): todo su gasto está en ésta.';
comment on column identidad.cuentas_publicitarias_de_meta.zona_horaria is 'La zona horaria de la cuenta publicitaria (timezone_name de Meta): define dónde empieza y termina cada día de su gasto.';
comment on column identidad.cuentas_publicitarias_de_meta.estado_en_meta is 'El account_status de Meta: 1 activa; 2 deshabilitada; 3 sin pagar; 7 en revisión de riesgo; 101 cerrada; etc.';
comment on column identidad.cuentas_publicitarias_de_meta.cuenta_id is 'A qué cliente se asigna. Nulo = conectada y sin asignar: no se lee hasta que alguien la asigne.';
comment on column identidad.cuentas_publicitarias_de_meta.vista_el is 'La última vez que Meta la devolvió al listar las cuentas de la conexión.';

-- Una cuenta que conectó un CLIENTE con su propio portfolio sólo se asigna a ese cliente: la empresa no puede mover lo
-- que otro negocio le dio a uno de sus clientes. La regla la cumple la base, no la pantalla.
create or replace function identidad.cuenta_de_meta_en_su_cliente() returns trigger
language plpgsql security invoker as $$
declare
  v_cliente uuid;
begin
  if new.cuenta_id is null then
    return new;
  end if;
  select c.cuenta_id into v_cliente from identidad.conexiones_de_meta c
   where c.org_id = new.org_id and c.id = new.conexion_id;
  if v_cliente is not null and v_cliente <> new.cuenta_id then
    raise exception 'la cuenta % la conectó un cliente y sólo se asigna a ese cliente', new.act_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists cuenta_de_meta_en_su_cliente on identidad.cuentas_publicitarias_de_meta;
create trigger cuenta_de_meta_en_su_cliente
  before insert or update of cuenta_id, conexion_id on identidad.cuentas_publicitarias_de_meta
  for each row execute function identidad.cuenta_de_meta_en_su_cliente();

alter table identidad.cuentas_publicitarias_de_meta enable row level security;
alter table identidad.cuentas_publicitarias_de_meta force row level security;
revoke all on identidad.cuentas_publicitarias_de_meta from public;
grant select, insert, update, delete on identidad.cuentas_publicitarias_de_meta to app_identidad;
drop policy if exists cuentas_publicitarias_de_meta_identidad on identidad.cuentas_publicitarias_de_meta;
create policy cuentas_publicitarias_de_meta_identidad on identidad.cuentas_publicitarias_de_meta
  for all to app_identidad using (true) with check (true);

-- ─── El estado del viaje a Meta ─────────────────────────────────────────────────

create table if not exists identidad.estados_de_oauth (
  hash         text primary key check (hash ~ '^[0-9a-f]{64}$'),
  org_id       uuid not null references identidad.organizaciones (id) on delete cascade,
  sesion_id    uuid not null references identidad.sesiones (id) on delete cascade,
  usuario_id   uuid not null,
  cuenta_id    uuid,
  creado_el    timestamptz not null default now(),
  vence_el     timestamptz not null,
  check (vence_el > creado_el),
  foreign key (org_id, usuario_id) references identidad.usuarios (org_id, id) on delete cascade,
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id) on delete cascade
);
create index if not exists estados_de_oauth_por_vencimiento on identidad.estados_de_oauth (vence_el);

comment on table identidad.estados_de_oauth is
  'El state del viaje a Meta de «Conectar con Meta» (101): de un solo uso, guardado como sha256 (el valor viaja sólo en la URL de Meta), atado a la sesión, la persona, la organización y el cliente que pidió conectar. Vence a los pocos minutos.';
comment on column identidad.estados_de_oauth.hash is 'El sha256 en hexadecimal del state: el valor en claro no se guarda.';
comment on column identidad.estados_de_oauth.cuenta_id is 'El cliente para el que se conecta. Nulo = conecta la empresa.';

alter table identidad.estados_de_oauth enable row level security;
alter table identidad.estados_de_oauth force row level security;
revoke all on identidad.estados_de_oauth from public;
grant select, insert, delete on identidad.estados_de_oauth to app_identidad;
drop policy if exists estados_de_oauth_identidad on identidad.estados_de_oauth;
create policy estados_de_oauth_identidad on identidad.estados_de_oauth for all to app_identidad using (true) with check (true);
