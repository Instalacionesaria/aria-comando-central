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
  -- ── EL TERCERO, Y NO SE RETIRA POR LO MISMO QUE LOS DOS PRIMEROS ──────────
  --
  -- `closer` y `setter` se retiraron porque los reemplazó un rol más ancho: sus capacidades
  -- caen en `usuario` por derivación, así que su gente no perdió nada al moverse.
  --
  -- `monitoreo` es distinto y hay que decirlo: su única capacidad estaba **excluida a mano** del
  -- reparto de `usuario`. Moverlo sin más le habría quitado el panel a quien lo tenía. Por eso el
  -- retiro viene en dos mitades que hay que leer juntas:
  --
  --   · `001_catalogo.sql` quitó esa exclusión, así que `monitoreo.ver` ahora cae en `usuario`;
  --   · y acá abajo, el bloque de la PESTAÑA le concede el alcance a quien tenía el rol — porque
  --     `usuario` sí restringe por sección, y sin esa fila la capacidad no muestra nada.
  --
  -- Fue el pedido, con estas palabras: *«desactiva el rol de monitoreo, lo que debe ser es el rol
  -- de usuario con acceso a monitoreo»*.
  v_retirados text[] := array['closer', 'setter', 'monitoreo'];
  v_destino   text   := 'usuario';
  v_destino_id uuid;
  v_movidos   int;
  v_borrados  int;
  v_pestanas  int;
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

  -- ── LA PESTAÑA, Y VA ANTES DEL `delete` PORQUE ÉL BORRA LA EVIDENCIA ───────
  --
  -- Quien tenía el rol `monitoreo` tenía el panel por su ROL. El rol se va, y el acceso se
  -- traduce al otro eje: una fila de alcance con la pestaña. Sin esto, el retiro le saca el panel
  -- a esa persona y **no falla nada** — es el modo de falla que todo este archivo persigue.
  --
  -- Va acá, entre el traspaso y el borrado, porque `usuarios_roles` es lo único que dice QUIÉN
  -- tenía el rol: después del `delete` esa lista no existe.
  --
  -- ── SE ESCRIBE LA FILA AUNQUE HOY NO HAGA FALTA, Y ESO ES DELIBERADO ──────
  --
  -- El alcance se combina con `bool_and`, así que a alguien que además sea `administrador` —un
  -- rol sin restricción— esta fila no le cambia nada hoy: ya ve el panel por la capacidad.
  -- `app/api/admin/usuarios/route.ts` tiene escrita la regla contraria para el alta: *«un rol NO
  -- restringido ignora las secciones que vengan, y no las guarda»*.
  --
  -- Acá se guarda igual, y el motivo es que estas filas **no son un alcance que nadie eligió**:
  -- son el único registro de que esa persona tenía el panel. El día que se le cambie el rol a
  -- `usuario` a secas —una operación de una sola pantalla— la fila es lo que hace que no lo
  -- pierda en silencio.
  --
  -- La clave de sección tiene que existir en el `check` de la tabla, y existe desde
  -- `db/migraciones/023_seccion_monitoreo.sql`.
  insert into identidad.usuarios_secciones (usuario_id, seccion, concedida_por)
  select distinct ur.usuario_id, 'monitoreo', null::uuid
    from identidad.usuarios_roles ur
    join identidad.roles r on r.id = ur.rol_id
   where r.org_id is null and r.clave = 'monitoreo'
  on conflict do nothing;

  get diagnostics v_pestanas = row_count;

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
  if v_pestanas > 0 then
    raise notice
      '% persona(s) que tenían el rol `monitoreo` recibieron la pestaña como alcance.',
      v_pestanas;
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
  v_quedan        text;
  v_sin_rol       text;
  v_sin_pestanas  text;
begin
  -- ── SE DERIVA, Y ANTES ERA UNA SEGUNDA LISTA ESCRITA A MANO ───────────────
  --
  -- Acá decía `clave in ('closer', 'setter')`: una copia de `v_retirados` que este bloque no
  -- puede ver, porque `v_retirados` vive en el `do` de arriba y los bloques no comparten
  -- variables. Agregar un retiro exigía editar las dos, y **olvidarse de la segunda no falla**:
  -- deja el rol nuevo sin comprobar, que es justo el archivo donde eso importa.
  --
  -- La invariante correcta no necesita la lista: **los roles de sistema globales son TRES.** Los
  -- nombra `001_catalogo.sql`, que es quien los reparte, y cualquier otro que exista es un retiro
  -- que no terminó. Así esto también atrapa el cuarto que alguien agregue mañana y no retire.
  --
  -- Un rol de una organización (`org_id is not null`) o uno que no sea de sistema no es asunto de
  -- este archivo y no se cuenta.
  select string_agg(clave, ', ')
    into v_quedan
    from identidad.roles
   where org_id is null and es_sistema
     and clave not in ('superadministrador', 'administrador', 'usuario');

  if v_quedan is not null then
    raise exception
      'siguen existiendo roles de sistema que este archivo tenía que retirar: %. O el `delete` '
      'afectó cero filas —probablemente el rol que corre este archivo no tiene política sobre '
      'identidad.roles y el forzado de RLS lo dejó sin ver nada— o alguien agregó un rol y no lo '
      'sumó a `v_retirados`.', v_quedan;
  end if;

  -- ── LA OTRA FORMA DE QUEDAR SIN NINGUNA PANTALLA, Y ES LA QUE ESTE ARCHIVO CAUSA ──
  --
  -- El traspaso mueve gente a `usuario`, que es el único rol con `secciones_restringidas`. Para
  -- ese rol, **cero filas de alcance son cero pestañas**: la persona entra, se autentica bien, y
  -- el menú está vacío. Tener rol no alcanza, y la comprobación de abajo —que mira si tiene
  -- alguno— pasa igual.
  --
  -- Es un agujero de este archivo desde que existe el alcance por sección, y no se notó porque
  -- nadie tenía `closer` ni `setter` cuando se retiraron. El retiro de `monitoreo` sí mueve a una
  -- persona real, así que ahora se comprueba.
  --
  -- Se pregunta por `bool_and`, que es la misma fórmula con la que la sesión decide si restringe:
  -- alguien que además tenga un rol sin restricción no está restringido, y sus filas se ignoran.
  select string_agg(u.email, ', ')
    into v_sin_pestanas
    from identidad.usuarios u
   where u.email is not null
     and (select bool_and(r.secciones_restringidas)
            from identidad.usuarios_roles ur
            join identidad.roles r on r.id = ur.rol_id
           where ur.usuario_id = u.id)
     and not exists (
       select 1 from identidad.usuarios_secciones us where us.usuario_id = u.id);

  if v_sin_pestanas is not null then
    raise warning
      'hay personas con un rol restringido y NINGUNA pestaña concedida: %. Pueden entrar y el '
      'menú les queda vacío. Concedeles el alcance desde Ajustes → Usuarios.', v_sin_pestanas;
  end if;

  -- Y que nadie haya quedado sin rol por el camino. Una persona sin rol puede entrar y no ve
  -- ninguna pantalla, y lo descubre ella, no nosotros.
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
