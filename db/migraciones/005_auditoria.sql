-- ADR-0105 — La auditoría es inmutable.
--
-- DDL e índices: 01-ESQUEMA-DE-DATOS § 7.
-- Permisos y políticas: 09-ESCOTILLA-Y-ESTADOS § 2, bloque 8.
--
-- Dos capas para la inmutabilidad, como todo lo demás: el disparador la rechaza, Y
-- ningún rol tiene el permiso. La prueba afirma las dos.

create table identidad.auditoria_accesos (
  -- Columna de IDENTIDAD y no `bigserial`: con `bigserial`, insertar exige además
  -- permiso de USO sobre la secuencia, y olvidarlo hace que TODO registro de
  -- auditoría falle con "permiso denegado para la secuencia" — incluido el del
  -- intento de acceso fallido, que es el que más falta cuando algo pasa.
  id           bigint generated always as identity primary key,
  -- Nulificable A PROPÓSITO: un intento con un email inexistente no tiene usuario, y
  -- ése es justo el evento que hay que poder investigar. Exigirlo obligaría a
  -- descartar el intento o a inventar una referencia.
  usuario_id   uuid,
  -- Nulificable por el mismo motivo: un intento con un email inexistente no
  -- pertenece a ninguna organización.
  org_id       uuid,
  accion       text not null,     -- 'login' | 'login_fallido' | 'usuario_creado' | …
  -- El motivo real y el contexto, estructurado. NUNCA una contraseña, ni la fallida,
  -- ni la temporal. Un registro de contraseñas fallidas es un diccionario de
  -- contraseñas reales de tus usuarios, con sus emails al lado.
  detalle      jsonb,
  ip           text,
  creado_el    timestamptz not null default now()
);

create index auditoria_por_fecha on identidad.auditoria_accesos (creado_el desc);
create index auditoria_por_org   on identidad.auditoria_accesos (org_id, creado_el desc);
-- EL TERCER ÍNDICE ES LA TRAMPA. Es habitual contar los intentos fallidos por IP
-- sobre esta tabla para no crear otra: funciona bien y evita una dependencia — pero
-- si los índices son solo por fecha y por organización, esa consulta hace un
-- RECORRIDO COMPLETO EN CADA INTENTO DE LOGIN. Con la tabla chica no se nota; con
-- cien mil filas, sí (01 § 7).
create index auditoria_por_ip_accion on identidad.auditoria_accesos (ip, accion, creado_el desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- La función de inmutabilidad (01 § 6) y su disparador
--
-- Si alguna tabla es la fuente de un número que alguien va a mirar —dinero,
-- cantidades, auditoría— hacela inmutable. Corregir un error se hace con una fila
-- nueva, como en un libro contable. Una auditoría que se puede editar no sirve para
-- auditar.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function identidad.evitar_mutacion() returns trigger as $$
begin
  raise exception 'La tabla % es de solo inserción (intento de %).', tg_table_name, tg_op;
end;
$$ language plpgsql;

create trigger auditoria_solo_insercion
  before update or delete on identidad.auditoria_accesos
  for each row execute function identidad.evitar_mutacion();

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos y políticas — 09 § 2, bloque 8
-- ─────────────────────────────────────────────────────────────────────────────

alter table identidad.auditoria_accesos enable row level security;
alter table identidad.auditoria_accesos force  row level security;
revoke all on identidad.auditoria_accesos from public;

-- Los DOS roles escriben. Y NUNCA `update` ni `delete`, para NADIE: la inmutabilidad
-- va en el permiso además del disparador.
grant insert, select on identidad.auditoria_accesos to app_inquilino;
grant insert, select on identidad.auditoria_accesos to app_identidad;

create policy auditoria_escribe_inquilino on identidad.auditoria_accesos
  for insert to app_inquilino
  with check (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

-- La lectura acotada es NECESARIA, no un lujo: hay una capacidad (`auditoria.ver`)
-- para que un administrador de cliente vea la auditoría de SU organización, y un
-- endpoint que le muestra los accesos de soporte a su organización. Sin esta política,
-- esa lectura tendría que correr por identidad — sin filtro y con el código como única
-- barrera. Las filas de organización nula quedan solo para identidad, que es
-- exactamente lo que se quiere.
--
-- Para que esto sirva de verdad: la fila del acceso de soporte se guarda con la
-- organización VISITADA, y la de origen va en el detalle. Al revés, el administrador
-- de ese cliente no puede ver los accesos a sus propios datos — que es justamente
-- para lo que sirve este registro (08 § 8).
create policy auditoria_lee_inquilino on identidad.auditoria_accesos
  for select to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

create policy auditoria_identidad on identidad.auditoria_accesos
  for all to app_identidad using (true) with check (true);
