-- 104 · Lo que Meta pide borrar (Meta directo, M6).
--
-- Meta exige dos avisos a toda app con Facebook Login: cuando alguien quita la app de su negocio (desautorización) y
-- cuando pide que se borren sus datos (borrado). Los dos llegan firmados con el secreto de la app y nombran a la
-- persona —o al usuario del sistema de la integración— por su id en la app. Para encontrar sus conexiones, cada una
-- guarda ese id al conectarse (`/me?fields=id`).
--
-- El pedido de borrado se anota con un código de confirmación que Meta le muestra a quien lo pidió, y con el que una
-- página pública (`/meta/borrado/<código>`) dice en qué quedó. Se guarda su sha256, como el state del viaje a Meta:
-- el código en claro sólo viaja a Meta y en la URL de esa página.

alter table identidad.conexiones_de_meta add column if not exists usuario_de_meta_id text
  check (usuario_de_meta_id ~ '^[0-9]{1,30}$');
comment on column identidad.conexiones_de_meta.usuario_de_meta_id is
  'El id en la app de quien es dueño del token (por OAuth, el usuario del sistema de la integración): con él se encuentran sus conexiones cuando Meta avisa que quitaron la app o que piden borrar sus datos. Nulo en las manuales y en las de antes de la 104.';
create index if not exists conexiones_de_meta_por_usuario
  on identidad.conexiones_de_meta (usuario_de_meta_id) where usuario_de_meta_id is not null;


create table if not exists identidad.pedidos_de_borrado_de_meta (
  codigo_hash          text primary key check (codigo_hash ~ '^[0-9a-f]{64}$'),
  usuario_de_meta_id   text not null check (usuario_de_meta_id ~ '^[0-9]{1,30}$'),
  pedido_el            timestamptz not null default now(),
  conexiones           int not null check (conexiones >= 0),
  cuentas              int not null check (cuentas >= 0),
  borrado_el           timestamptz
);

comment on table identidad.pedidos_de_borrado_de_meta is
  'Cada pedido de borrado de datos que Meta reenvió (104): quién lo pidió (su id en la app), cuántas conexiones y cuentas publicitarias tenía, y cuándo quedó borrado. Es la constancia que la página pública de estado le muestra a quien tenga el código.';
comment on column identidad.pedidos_de_borrado_de_meta.codigo_hash is 'El sha256 en hexadecimal del código de confirmación: el valor en claro no se guarda.';
comment on column identidad.pedidos_de_borrado_de_meta.usuario_de_meta_id is 'El user_id del pedido firmado: el id en la app de quien pidió el borrado.';
comment on column identidad.pedidos_de_borrado_de_meta.conexiones is 'Cuántas conexiones de Meta se encontraron con ese id (cero es una respuesta válida: no había nada).';
comment on column identidad.pedidos_de_borrado_de_meta.cuentas is 'Cuántas cuentas publicitarias tenían esas conexiones: sus campañas, anuncios, métricas y gasto leídos de Meta se borran.';
comment on column identidad.pedidos_de_borrado_de_meta.borrado_el is 'Cuándo terminó el borrado. Nulo = pedido y todavía en curso.';

alter table identidad.pedidos_de_borrado_de_meta enable row level security;
alter table identidad.pedidos_de_borrado_de_meta force row level security;
revoke all on identidad.pedidos_de_borrado_de_meta from public;
grant select, insert, update on identidad.pedidos_de_borrado_de_meta to app_identidad;
drop policy if exists pedidos_de_borrado_de_meta_identidad on identidad.pedidos_de_borrado_de_meta;
create policy pedidos_de_borrado_de_meta_identidad on identidad.pedidos_de_borrado_de_meta
  for all to app_identidad using (true) with check (true);

-- Como en la 080 y la 101: el rol de servicio del proveedor administrado no los alcanza. Se le revoca a todo rol que
-- se salta la RLS y no es superusuario, ni `postgres` ni quien migra. En la base local no hay ninguno.
do $$
declare
  r record;
begin
  for r in select rolname from pg_roles
            where rolbypassrls and not rolsuper and rolname not in ('postgres', current_user) loop
    execute format('revoke all on identidad.pedidos_de_borrado_de_meta from %I', r.rolname);
  end loop;
end $$;
