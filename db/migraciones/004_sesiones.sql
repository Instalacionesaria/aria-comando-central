-- Sesiones.
--
-- DDL: 01-ESQUEMA-DE-DATOS § 5, con el vencimiento absoluto del 08 § 5.1 y la
--      columna de estado del 08 § 10 ya dentro del `create table` (no como `alter`:
--      el esquema se crea desde cero).
-- Permisos y políticas: 09-ESCOTILLA-Y-ESTADOS § 2, bloque 3.
--
-- EL ROL DEL INQUILINO NO TIENE NINGÚN ACCESO A ESTA TABLA. Ni `select`. Es la tabla
-- que decide quién sos, y no tiene columna de organización porque se busca por hash
-- de token ANTES de saber quién es nadie.

create table identidad.sesiones (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references identidad.usuarios(id) on delete cascade,
  -- El HASH del token, NUNCA el token. Si alguien se lleva una copia de la base no
  -- puede hacerse pasar por nadie: tiene los hashes, y de un SHA-256 de 32 bytes
  -- aleatorios no se vuelve.
  token_hash      text not null unique,
  -- Solo para el rol de plataforma: sobre qué organización está trabajando.
  --
  -- `on delete set null` y NO cascada: si se borra la organización que alguien estaba
  -- mirando, la sesión sobrevive y vuelve a la propia. La cascada cerraría la sesión
  -- del administrador justo cuando acaba de borrar algo, que es el peor momento.
  org_activa      uuid references identidad.organizaciones(id) on delete set null,
  -- El estado de la sesión. Se guarda POR SESIÓN y no por usuario: dos sesiones de la
  -- misma persona, una con el segundo factor verificado y otra sin verificar, son
  -- estados distintos y NO se pueden derivar de la fila de `usuarios`.
  --
  -- Sin esta columna todo el mecanismo de estados es INIMPLEMENTABLE — y falla en la
  -- dirección peligrosa: si el estado no se persiste, el encierro por contraseña
  -- temporal desaparece y nada falla (08 § 10).
  estado          text not null default 'activa'
    check (estado in ('activa', 'pendiente_2fo',
                      'debe_cambiar_password', 'debe_configurar_2fo')),
  -- Vencimiento deslizante: se extiende al usar la sesión.
  expira_el       timestamptz not null,
  -- Techo DURO: la sesión muere a los 30 días de creada aunque se use todos los días.
  -- Sin esto, una sesión usada a diario NUNCA VENCE, y un token robado vive para
  -- siempre mientras el ladrón lo siga usando (08 § 5.1).
  --
  -- La renovación deslizante nunca toca esta columna.
  expira_absoluto timestamptz not null default now() + interval '30 days',
  ip              text,
  user_agent      text,
  creada_el       timestamptz not null default now()
);

-- Para el trabajo de limpieza. Aunque no se escriba hoy, el índice cuesta nada y
-- evita tener que agregarlo con la tabla ya grande.
create index sesiones_por_expiracion on identidad.sesiones (expira_el);
create index sesiones_por_usuario    on identidad.sesiones (usuario_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos y políticas — 09 § 2, bloque 3
-- ─────────────────────────────────────────────────────────────────────────────

alter table identidad.sesiones enable row level security;
alter table identidad.sesiones force  row level security;
revoke all on identidad.sesiones from public;

-- Solo identidad. El inquilino no aparece: una prueba de la Etapa 2 afirma que
-- consultar `sesiones` con el rol del inquilino LANZA permiso denegado — falla
-- fuerte y a la vista, no devuelve vacío.
grant select, insert, update, delete on identidad.sesiones to app_identidad;

create policy sesiones_identidad on identidad.sesiones for all to app_identidad
  using (true) with check (true);
