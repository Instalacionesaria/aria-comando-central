-- El cliente final: una persona limitada a sus cuentas, y el cliente que la empresa tiene enfocado.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, Paso 4, 2026-10-18)
--
-- La Fase 0 creó `identidad.usuarios_cuentas` con una regla: SIN filas, la persona entra a TODAS las cuentas de su
-- organización; con filas, sólo a ésas. Esa regla falla ABIERTO, y el camino es normal: la clave foránea hacia la cuenta
-- es `on delete cascade`, así que borrar el único cliente de una persona limitada —o quitarle la última fila— la deja
-- viendo la empresa entera. Es el mismo error que el alcance por pestañas ya pagó una vez (`secciones.ts`, «cero
-- filas: dos hechos distintos, y no los separa la presencia de filas»), y se arregla igual: con un hecho AFIRMADO.
--
--   · `usuarios.limitado_a_cuentas`: la persona es un cliente final. Sus filas en `usuarios_cuentas` son sus cuentas, y
--     sin filas no ve NINGUNA. Una persona que no está limitada no tiene filas (un disparador lo exige), así que la
--     tabla sólo habla de clientes finales;
--   · un cliente final sólo tiene roles restringidos por pestañas y ninguno de plataforma: no administra nada;
--   · no se le quita el límite mientras tenga cuentas asignadas: «dejar de ser cliente final» es una decisión que se
--     toma vaciando primero sus cuentas, no un efecto de otra edición;
--   · `sesiones.cuenta_activa`: el cliente que la empresa tiene enfocado. La clave foránea es simple, sin la
--     organización: que la cuenta sea de la organización de la sesión lo comprueba la sesión al leerla, y una que no
--     lo sea se ignora.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.usuarios add column if not exists limitado_a_cuentas boolean not null default false;
comment on column identidad.usuarios.limitado_a_cuentas is
  'La persona es un cliente final: sólo entra a las cuentas que tiene en usuarios_cuentas, y sin ninguna no entra a nada.';

alter table identidad.sesiones add column if not exists cuenta_activa uuid references identidad.cuentas (id) on delete set null;
comment on column identidad.sesiones.cuenta_activa is
  'El cliente enfocado en esta sesión. Sólo vale si es de la organización de la sesión y la persona lo ve; si no, se ignora.';

comment on table identidad.usuarios_cuentas is
  'Las cuentas de un cliente final (usuarios.limitado_a_cuentas). Sin filas, no ve NINGUNA. Una persona que no está limitada no tiene filas acá.';

-- ─── Sólo un cliente final tiene cuentas asignadas ─────────────────────────────

create or replace function identidad.solo_el_limitado_tiene_cuentas() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from identidad.usuarios u where u.id = new.usuario_id and u.limitado_a_cuentas) then
    raise exception 'usuarios_cuentas: la persona % no está limitada a sus cuentas; sin el límite, una fila acá no significa nada.',
      new.usuario_id;
  end if;
  return new;
end $$;
drop trigger if exists usuarios_cuentas_solo_limitados on identidad.usuarios_cuentas;
create trigger usuarios_cuentas_solo_limitados before insert on identidad.usuarios_cuentas
  for each row execute function identidad.solo_el_limitado_tiene_cuentas();

-- ─── El cliente final no administra, y no deja de serlo por accidente ──────────

-- INMEDIATA, en cada fila, y no diferida al confirmar. El alta inserta primero a la persona y después sus roles, así que
-- mirar fila por fila alcanza. Diferida, la regla corría en el COMMIT: fuera del `try` de la ruta (un 500 en vez del
-- rechazo legible del disparador), y en PostgreSQL 17 con el rol de quien confirma y no con el de la función
-- `security definer` que escribió, que es como entra el alta externa de Fundaciones.
create or replace function identidad.el_limitado_no_administra() returns trigger
language plpgsql as $$
declare
  v_usuario uuid;
begin
  -- Cada rama en su propia sentencia: PL/pgSQL prepara la expresión entera, y `new.usuario_id` no existe en una fila
  -- de `usuarios` (ni `old.limitado_a_cuentas` en una de `usuarios_roles`).
  if tg_table_name = 'usuarios' then
    v_usuario := new.id;
  else
    v_usuario := new.usuario_id;
  end if;
  if exists (
    select 1
      from identidad.usuarios u
      join identidad.usuarios_roles ur on ur.usuario_id = u.id
      join identidad.roles r on r.id = ur.rol_id
     where u.id = v_usuario and u.limitado_a_cuentas and (r.solo_principal or not r.secciones_restringidas)
  ) then
    raise exception 'la persona % está limitada a sus cuentas y sólo puede tener roles restringidos por pestañas, ninguno de plataforma.',
      v_usuario;
  end if;
  if tg_table_name = 'usuarios' and tg_op = 'UPDATE' then
    if old.limitado_a_cuentas and not new.limitado_a_cuentas
       and exists (select 1 from identidad.usuarios_cuentas uc where uc.usuario_id = new.id) then
      raise exception 'la persona % tiene cuentas asignadas: para quitarle el límite, primero hay que quitarle sus cuentas.', new.id;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists usuarios_el_limitado_no_administra on identidad.usuarios;
create trigger usuarios_el_limitado_no_administra after insert or update of limitado_a_cuentas on identidad.usuarios
  for each row execute function identidad.el_limitado_no_administra();

drop trigger if exists usuarios_roles_el_limitado_no_administra on identidad.usuarios_roles;
create trigger usuarios_roles_el_limitado_no_administra after insert on identidad.usuarios_roles
  for each row execute function identidad.el_limitado_no_administra();

-- El alta externa de organizaciones (la de Fundaciones, por n8n) escribe personas y roles en una función
-- `security definer` de `postgres`: estos disparadores corren con ese rol y leen estas tablas. Mismo motivo que el
-- permiso de la 080 sobre las cuentas.
grant select on identidad.usuarios, identidad.usuarios_roles, identidad.roles, identidad.usuarios_cuentas to postgres;
