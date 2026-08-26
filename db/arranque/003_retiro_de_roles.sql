-- El retiro de roles que ya no existen, y la gente que los tenía.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ESTE ARCHIVO EXISTE, Y POR QUÉ NO ES UNA MIGRACIÓN
--
-- `001_catalogo.sql` es declarativo para las CAPACIDADES de cada rol: lo que no está en su
-- lista se borra. Pero un nivel más arriba solo sabe **agregar roles**: un `insert … on
-- conflict do nothing`. Nunca quitó ninguno.
--
-- Es exactamente la asimetría que el reparto de capacidades ya había pagado una vez, escrita
-- en el bloque 3 de ese archivo: *"funcionaba para dar capacidades y no podía quitar
-- ninguna… el archivo describe un reparto que no es el real, que es peor que no describirlo,
-- porque se lee como si fuera la verdad"*. Con `closer` y `setter` fuera del catálogo pero
-- vivos en la base, ese archivo diría que hay tres roles y habría cinco.
--
-- ── Y NO ES UNA MIGRACIÓN. ESTO SE MIDIÓ ANTES DE ESCRIBIRLO ────────────────
--
-- El lugar natural sería `db/migraciones/014_…`. **No funcionaría, y lo peor es que no
-- fallaría:** las migraciones corren como `migrador`, que no tiene política sobre
-- `identidad.roles` ni sobre `identidad.usuarios_roles` y sí tiene el forzado de RLS encima.
-- Medido en la base local:
--
--     migrador → select count(*) from identidad.usuarios_roles  →  0 filas
--     migrador → select count(*) from identidad.roles           →  0 filas
--
-- O sea: el `update` afectaría cero filas, el `delete` cero filas, y la migración quedaría
-- marcada como aplicada. Es el modo de falla que este repositorio persigue en todas partes —
-- un cero que significa «no se midió» leído como «ya está hecho»— y acá se llevaría puesto el
-- acceso de una persona.
--
-- Tampoco va en `001_catalogo.sql`: ese archivo corre con el rol del catálogo, que tiene
-- `insert` sobre `identidad.roles` y **nada** sobre `usuarios_roles`. Dárselo ensancharía la
-- escotilla de `002_escritura_del_catalogo.sql` —cuyo propósito es que esa lista no crezca por
-- comodidad— para que pueda REVOCAR accesos. Eso es demasiado poder para un archivo de
-- catálogo.
--
-- Entonces corre con `app_identidad`, que es el rol que administra personas todos los días y
-- tiene `ALL … using (true)` sobre las dos tablas. Ni más ni menos que lo que ya podía hacer.
-- ═════════════════════════════════════════════════════════════════════════════

do $retiro$
declare
  -- ── LOS DOS LADOS DEL CAMBIO, DECLARADOS ────────────────────────────────────
  --
  -- Qué se retira y a dónde va la gente. Se nombra acá arriba, una sola vez, para que
  -- agregar un retiro futuro sea agregar una clave y no leer el archivo entero.
  v_retirados text[] := array['closer', 'setter'];
  v_destino   text   := 'usuario';
  v_destino_id uuid;
  v_movidos   int;
  v_borrados  int;
begin
  -- ── PRIMERO: QUE EL DESTINO EXISTA ──────────────────────────────────────────
  --
  -- Sin esta comprobación todo lo de abajo pasa **justo cuando falla**: si `usuario` no se
  -- creó —porque `001_catalogo.sql` no corrió, o corrió sin privilegio— el `insert` de la
  -- reasignación entra cero filas, el `delete` se lleva las asignaciones viejas igual, y la
  -- gente queda **sin ningún rol**. Un archivo que se llama «retiro» dejando personas sin
  -- acceso y reportando éxito es el peor resultado posible de este cambio.
  select id into v_destino_id
    from identidad.roles
   where clave = v_destino and org_id is null;

  if v_destino_id is null then
    raise exception
      'el rol destino «%» no existe, así que no hay a dónde mover a nadie. Corré primero '
      'db/arranque/001_catalogo.sql: si ya corrió, su `insert` entró cero filas en silencio.',
      v_destino;
  end if;

  -- ── SEGUNDO: MOVER A LA GENTE, Y RECIÉN DESPUÉS BORRAR ─────────────────────
  --
  -- El orden no es preferencia. `usuarios_roles.rol_id` es `no action`, no `cascade`: borrar
  -- el rol con asignaciones vivas **falla** por la clave foránea. Y si fuera al revés —borrar
  -- primero— la reasignación ya no tendría de dónde saber a quién mover.
  --
  -- Se INSERTA el destino en vez de hacer `update … set rol_id`: alguien puede tener el rol
  -- viejo Y el nuevo a la vez, y un `update` chocaría contra el índice único. `on conflict do
  -- nothing` convierte ese caso en un no-op en vez de en un error.
  with afectados as (
    select distinct ur.usuario_id
      from identidad.usuarios_roles ur
      join identidad.roles r on r.id = ur.rol_id
     where r.org_id is null and r.clave = any (v_retirados)
  )
  insert into identidad.usuarios_roles (usuario_id, rol_id, asignado_por)
  select a.usuario_id, v_destino_id, null
    from afectados a
  on conflict do nothing;

  get diagnostics v_movidos = row_count;

  -- Y ahora sí, quitarles la asignación vieja.
  delete from identidad.usuarios_roles ur
   using identidad.roles r
   where r.id = ur.rol_id
     and r.org_id is null
     and r.clave = any (v_retirados);

  -- ── TERCERO: EL ROL, QUE AHORA SÍ SE PUEDE BORRAR ──────────────────────────
  --
  -- `roles_permisos` sí cascadea desde `roles`, así que sus filas se van solas.
  delete from identidad.roles
   where org_id is null and clave = any (v_retirados);

  get diagnostics v_borrados = row_count;

  if v_movidos > 0 then
    raise notice
      '% persona(s) que tenían un rol retirado pasaron a «%».', v_movidos, v_destino;
  end if;
  if v_borrados > 0 then
    raise notice 'roles retirados: %.', array_to_string(v_retirados, ', ');
  end if;
end
$retiro$;


-- ═════════════════════════════════════════════════════════════════════════════
-- La comprobación, porque todo lo de arriba es idempotente y por eso silencioso
--
-- Un `delete` que no encuentra filas sale con éxito. Eso es lo que hace que reejecutar sea
-- seguro y es también lo que hace que un fallo se vea igual que un éxito: si este archivo
-- corriera con un rol sin política, las tres sentencias afectarían cero filas y no diría
-- nada. Esto lo convierte en un error ruidoso.
-- ═════════════════════════════════════════════════════════════════════════════

do $comprobar$
declare
  v_quedan   text;
  v_sin_rol  text;
begin
  -- Que no quede ninguno de los retirados. Si queda, o el `delete` no vio filas o algo los
  -- volvió a crear entre medio.
  select string_agg(clave, ', ')
    into v_quedan
    from identidad.roles
   where org_id is null and clave in ('closer', 'setter');

  if v_quedan is not null then
    raise exception
      'siguen existiendo roles que este archivo tenía que retirar: %. El `delete` afectó cero '
      'filas: probablemente el rol que corre este archivo no tiene política sobre '
      'identidad.roles y el forzado de RLS lo dejó sin ver nada.', v_quedan;
  end if;

  -- Y —lo que de verdad importa— que nadie haya quedado sin rol por el camino. Una persona
  -- sin rol puede entrar y no ve ninguna pantalla, y lo descubre ella, no nosotros.
  select string_agg(u.email, ', ')
    into v_sin_rol
    from identidad.usuarios u
   where u.email is not null
     and not exists (
       select 1 from identidad.usuarios_roles ur where ur.usuario_id = u.id);

  if v_sin_rol is not null then
    raise warning
      'hay personas sin ningún rol: %. Pueden entrar y no ver ninguna pantalla. Si tenían un '
      'rol retirado, la reasignación falló; si nunca tuvieron, hay que darles uno.', v_sin_rol;
  end if;
end
$comprobar$;
