-- ADR-0101, ADR-0102, ADR-0103, ADR-0104 — Las invariantes que NO pueden vivir en el
-- backend.
--
-- Fuente: 01-ESQUEMA-DE-DATOS § 6, más el disparador de asignación cruzada del
--         08-ENDURECIMIENTO § 6.
--
-- "Un condicional se saltea con un script, una consola de administración, un endpoint
-- nuevo o una sentencia a mano un domingo. Un disparador no."
--
-- ─────────────────────────────────────────────────────────────────────────────
-- UNA DESVIACIÓN DELIBERADA DEL 01 § 6, Y ES LA QUE HACE QUE ESTO FUNCIONE:
--
-- Los cuerpos de estas funciones CALIFICAN cada tabla (`identidad.usuarios`), donde el
-- documento escribe sin calificar confiando en la ruta de búsqueda.
--
-- Motivo, y es concreto: una función sin calificar resuelve sus tablas con el
-- `search_path` DE QUIEN LA INVOCA. Los roles de la aplicación tienen `identidad` en
-- su ruta, así que ahí funcionaría. Pero estos disparadores existen precisamente para
-- detener lo que NO pasa por la aplicación — "una sentencia a mano un domingo" — y esa
-- sesión es un superusuario con `search_path = "$user", public`, donde `usuarios` NO
-- RESUELVE. El disparador fallaría con "relation usuarios does not exist" en vez de con
-- su mensaje, o peor, no se escribiría la protección donde hace falta.
--
-- Es la misma clase de problema que el 09 § 6 nombra: la ruta de búsqueda mal puesta
-- como mecanismo real de falla. Calificar cuesta once caracteres.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · El administrador principal es inmutable en lo que importa
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function identidad.proteger_admin_principal() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    if old.es_admin_principal then
      raise exception 'El administrador principal no se puede eliminar (usuario %).', old.id;
    end if;
    return old;
  end if;

  if old.es_admin_principal then
    -- Su CONTRASEÑA sí se puede cambiar: lo inmutable es QUIÉN ES y QUÉ PUEDE HACER.
    -- Si no se pudiera rotar, una filtración sería permanente.
    if not new.es_admin_principal then
      raise exception 'El administrador principal no se puede degradar (usuario %).', old.id;
    end if;
    if not new.activo then
      raise exception 'El administrador principal no se puede desactivar (usuario %).', old.id;
    end if;
    if lower(coalesce(new.email,'')) is distinct from lower(coalesce(old.email,'')) then
      raise exception 'El email del administrador principal es inmutable (usuario %).', old.id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger usuarios_admin_protegido
  before update or delete on identidad.usuarios
  for each row execute function identidad.proteger_admin_principal();

-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · La organización principal no se puede apagar
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function identidad.proteger_org_principal() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    if old.es_principal then
      raise exception 'La organización principal no se puede eliminar (org %).', old.id;
    end if;
    return old;
  end if;
  if old.es_principal and not new.es_principal then
    raise exception 'La organización principal no se puede desmarcar (org %).', old.id;
  end if;
  -- Desactivarla equivale a apagar la plataforma entera.
  if old.es_principal and not new.activa then
    raise exception 'La organización principal no se puede desactivar (org %).', old.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger organizaciones_protegida
  before update or delete on identidad.organizaciones
  for each row execute function identidad.proteger_org_principal();

-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · Un rol de plataforma solo existe en la organización principal
--
-- Es LA BARRERA contra la escalada entre inquilinos: sin ella, el administrador de una
-- empresa cliente podría otorgarse un rol de plataforma dentro de su propia empresa y
-- con él ver a todas las demás. El condicional del backend no alcanza — se saltea con
-- un script de mantenimiento.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function identidad.rol_de_plataforma_acotado() returns trigger as $$
declare
  v_org uuid;
  v_solo_principal boolean;
begin
  select org_id         into v_org             from identidad.usuarios where id = new.usuario_id;
  select solo_principal into v_solo_principal  from identidad.roles    where id = new.rol_id;

  if v_solo_principal and not exists (
       select 1 from identidad.organizaciones o where o.id = v_org and o.es_principal
     ) then
    raise exception 'Ese rol solo existe en la organización principal (org %).', v_org;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger usuarios_roles_plataforma_acotado
  before insert or update on identidad.usuarios_roles
  for each row execute function identidad.rol_de_plataforma_acotado();

-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · Al fundador no se le puede quitar el rol por la puerta de atrás
--
-- El disparador que protege al fundador mira la tabla de USUARIOS: impide borrarlo,
-- desactivarlo y cambiarle el correo. Pero SU ROL NO VIVE AHÍ, vive en la tabla de
-- asignaciones — y un `delete` sobre esa tabla lo deja sin permisos sin tocar ni una
-- fila protegida.
--
-- Es la misma pérdida de acceso que los otros disparadores evitan, por una puerta que
-- ninguno cubre: los dos que hay sobre las asignaciones son `before insert or update` y
-- NINGUNO MIRA EL BORRADO.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function identidad.proteger_rol_del_fundador() returns trigger as $$
declare
  v_es_fundador    boolean;
  v_solo_principal boolean;
begin
  select es_admin_principal into v_es_fundador    from identidad.usuarios where id = old.usuario_id;
  select solo_principal     into v_solo_principal from identidad.roles    where id = old.rol_id;

  if v_es_fundador and v_solo_principal then
    raise exception 'No se le puede quitar el rol de plataforma al administrador fundador.';
  end if;
  return old;
end;
$$ language plpgsql;

create trigger usuarios_roles_fundador
  before delete on identidad.usuarios_roles
  for each row execute function identidad.proteger_rol_del_fundador();

-- ═════════════════════════════════════════════════════════════════════════════
-- 5 · Un rol privado de una organización no se asigna a un usuario de otra
--
-- 08 § 6. La clave foránea se satisface —el identificador existe— así que nada más lo
-- impide.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function identidad.roles_no_cruzan_organizaciones() returns trigger as $$
declare
  rol_org     uuid;
  usuario_org uuid;
begin
  select org_id into rol_org     from identidad.roles    where id = new.rol_id;
  select org_id into usuario_org from identidad.usuarios where id = new.usuario_id;

  -- Un rol global (org_id nulo) se puede asignar a cualquiera.
  -- Un rol privado, solo a usuarios de su propia organización.
  if rol_org is not null and rol_org is distinct from usuario_org then
    raise exception 'Ese rol pertenece a otra organización';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger usuarios_roles_no_cruzan
  before insert or update on identidad.usuarios_roles
  for each row execute function identidad.roles_no_cruzan_organizaciones();
