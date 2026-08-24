-- El catálogo de capacidades y los roles, para lo que una migración no puede escribir.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ESTO NO ES UNA MIGRACIÓN, Y POR QUÉ ESTÁ EN `db/arranque/`
--
-- `identidad.permisos` tiene `force row level security` desde la migración 003 y no hay
-- política para `migrador`. Así que **una migración no puede insertar una capacidad
-- nueva**: el `insert` es rechazado por política. Medido, no supuesto — es exactamente lo
-- que rompe `009_fundaciones`, que intenta justamente eso.
--
-- La 003 sí pudo, porque insertó el catálogo inicial ANTES de encender el régimen. Su
-- propio comentario lo dice: *"Datos iniciales — ANTES de encender el forzado"*. Ese
-- momento pasó y no vuelve.
--
-- ── LAS SIETE SALIDAS, Y POR QUÉ ÉSTA ────────────────────────────────────────
--
-- Se midieron todas contra la base, no se razonaron:
--
--   · `insert` desde una migración          → rechazado por política. No funciona.
--   · editar la 003 en su lugar             → funciona en base nueva, y las bases que ya
--     corrieron la 003 nunca reciben el cambio. Kysely guarda el NOMBRE de la migración,
--     no un hash, así que nada lo detecta: local quedaría en 13 capacidades y una base
--     nueva nacería con 19. Divergencia silenciosa.
--   · `disable` / `enable row level security` dentro de la migración → funciona, y el
--     guardia del corredor NO LO ATRAPA: `revisarMigraciones()` rechaza
--     `no force row level security`, no `disable`. Elegir el camino que el guardia no ve
--     es peor que el que necesita un permiso.
--   · política de mantenimiento para `migrador` → funciona y deja la integración en verde.
--     Viola `EJECUCION` § 3, la prohibición más citada del repositorio.
--   · `security definer` propiedad de `migrador` → NO funciona: `force` alcanza al dueño
--     también dentro de la función.
--   · `copy from`                            → `COPY FROM not supported with row-level
--     security`.
--   · `grant insert` a `app_identidad` + política → funciona. Y ensancha: desde ese momento
--     cualquier petición HTTP servida por la conexión de identidad puede escribir en el
--     catálogo de capacidades. El catálogo decide quién puede qué en todo el sistema.
--
-- ── LA ELEGIDA: el rol del clúster, que es el que ya hace esto ───────────────
--
-- Este archivo corre con la MISMA credencial que `000_cluster.sql`, que es un rol con
-- omisión de RLS: en local el superusuario del contenedor, y en Supabase el rol `postgres`
-- por la Management API — verificado, tiene `rolbypassrls`.
--
-- Ventajas sobre la de `grant insert`, y son la razón de la elección:
--
--   · **no ensancha nada.** `app_identidad` sigue con solo `select` sobre `permisos`, y la
--     afirmación de diseño de la 003 —*"solo lectura: la escritura es una migración"*—
--     sigue siendo cierta salvo por este archivo, que no es alcanzable desde la red.
--   · **no es un camino nuevo.** El arranque ya es "las operaciones de nivel clúster van
--     con la credencial de nivel clúster", y esto es una de ellas: el catálogo de
--     capacidades es tan estructural como los roles de base.
--
-- El costo, dicho de frente: agregar una capacidad deja de ser "escribir una migración" y
-- pasa a ser "escribir acá y correr el arranque". Es un paso más en el despliegue, y está
-- documentado en `docs/DESPLIEGUE.md`.
--
-- ── Y ES IDEMPOTENTE, QUE NO ES OPCIONAL ────────────────────────────────────
--
-- El arranque se corre más de una vez —para reponer las organizaciones de control de la
-- sonda, por ejemplo— así que cada sentencia de acá tiene que poder correr diez veces. Va
-- con `on conflict do nothing`, no con `if not exists` a mano: la condición y la escritura
-- en dos pasos tiene una carrera entre las dos.
-- ═════════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · Las capacidades que faltan
--
-- El catálogo en código es `lib/autorizacion/capacidades.ts`, y una prueba de base lo cruza
-- con esta tabla EN LAS DOS DIRECCIONES: agregar acá y olvidar allá —o al revés— rompe la
-- suite. Es a propósito, porque una errata en una capacidad no falla como errata: rechaza a
-- todo el mundo con 403 y el síntoma que llega es "la pantalla está vacía".
-- ═════════════════════════════════════════════════════════════════════════════

insert into identidad.permisos (clave, descripcion) values

  -- ── Etapa 9 · Fundaciones ──────────────────────────────────────────────────
  --
  -- Estas dos las intentaba cargar `009_fundaciones` y no podía. Sin ellas, la pantalla
  -- `icp` responde 403 a todo el mundo — y como ya están en `capacidades.ts`, la prueba
  -- que cruza el catálogo con la tabla también falla.
  ('fundaciones.ver',    'Ver el trabajo de Fundaciones: ficha, research, ICP, categoría, oferta, precio y mapa'),
  ('fundaciones.editar', 'Generar y editar los entregables de Fundaciones (consume tokens de la organización)'),

  -- ── Etapa 11 · Closer y Setter ─────────────────────────────────────────────
  --
  -- UNA capacidad de lectura POR PESTAÑA, y acá está la decisión que hubo que tomar.
  --
  -- El `11` § 8 lista `tablero.ver` para los dos Inicio y `agenda.ver` para la Agenda del
  -- closer. Son sub-pestañas de la MISMA pantalla, y el mismo § 8 prohíbe eso dos párrafos
  -- después: *"todas las llamadas que llenan una misma pantalla piden el mismo conjunto de
  -- capacidades. Si una pide algo distinto, esa parte se ve vacía para alguien que ve el
  -- resto, y no hay forma de darse cuenta mirando."* `ADR-0304` dice lo mismo.
  --
  -- Las dos mitades del documento no pueden valer a la vez. Gana la regla, porque describe
  -- un defecto medido y la tabla solo reparte nombres. Así que `tablero.ver` y `agenda.ver`
  -- NO se catalogan: sus operaciones piden la capacidad de su pestaña.
  --
  -- Y son DOS y no una porque de eso depende que un closer no vea la pestaña del setter.
  -- Con una sola capacidad de lectura compartida, los dos roles verían las dos pestañas.
  -- Las siete pantallas del prototipo sin operaciones. UNA para las siete: no tienen nada
  -- que proteger del lado del servidor, y lo que decide es si aparecen en el menú.
  --
  -- La tiene el administrador y NO la tienen closer ni setter, y de eso depende que un
  -- closer no vea los siete tableros de inteligencia además de su pestaña.
  ('tablero.ver', 'Ver los tableros de inteligencia del prototipo'),

  ('closer.ver',  'Ver la pestaña Closer: su tablero, su día, su pipeline y su agenda'),
  ('setter.ver',  'Ver la pestaña Setter: su tablero, su día y su pipeline'),

  -- La ficha del contacto. Es de las DOS pestañas y de la de contactos, así que no puede
  -- pedir la capacidad de una: un closer abriendo una ficha y un setter abriendo la misma
  -- ficha piden lo mismo. Sus rutas van en `SIN_PANTALLA`, como las de la propia sesión.
  ('contactos.ver',  'Abrir la ficha de un contacto: conversación, llamadas, perfil, historial y notas'),

  -- Las tres de MUTACIÓN. Éstas sí pueden ser distintas de la lectura de la pantalla, y no
  -- contradice la regla de arriba: el defecto que esa regla previene es *"una sección con
  -- datos y cuatro en blanco"*, que es de LECTURAS. Un botón deshabilitado no es un panel
  -- vacío — se ve que está y se ve que no se puede.
  ('contactos.avanzar',        'Registrar el resultado de un contacto con Avanzar'),
  ('contactos.comentar',       'Escribir notas en la ficha de un contacto'),
  ('conversaciones.responder', 'Enviar mensajes y encender o apagar el agente de un contacto')

on conflict (clave) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · Los dos roles
--
-- `solo_principal` en FALSO: un closer o un setter existe en cualquier organización, no
-- solo en la que administra la plataforma. Y `exige_segundo_factor` en falso porque la
-- migración 010 lo dejó opcional para todos.
-- ═════════════════════════════════════════════════════════════════════════════

insert into identidad.roles (clave, nombre, es_sistema, solo_principal, exige_segundo_factor) values
  ('closer', 'Closer', true, false, false),
  ('setter', 'Setter', true, false, false)
on conflict do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · El reparto
--
-- ── NO SE ESCRIBE `insert … select … from roles, permisos` ───────────────────
--
-- Que es la forma natural, y es la que tiene `009_fundaciones`. El problema es OTRO y es
-- peor que un rechazo: con esa forma, corrida por un rol sin política de lectura sobre esas
-- dos tablas, **los dos `select` devuelven cero filas y el `insert` entra CERO FILAS SIN
-- ERROR**. Reporta éxito y no reparte nada, y el síntoma es que todos los roles quedan sin
-- capacidades — o sea 403 en todas partes, sin una línea de error que lo explique.
--
-- Acá el rol que corre SÍ omite RLS, así que la forma natural funcionaría. Se escribe con
-- subconsultas explícitas de todas formas, para que copiar este archivo a un contexto con
-- menos permisos falle en vez de mentir.
-- ═════════════════════════════════════════════════════════════════════════════

-- El closer: su pestaña, la ficha, y las tres acciones. No ve la del setter.
insert into identidad.roles_permisos (rol_id, permiso)
select r.id, p.clave
  from identidad.roles r, identidad.permisos p
 where r.clave = 'closer' and r.org_id is null
   and p.clave in ('closer.ver', 'contactos.ver', 'contactos.avanzar',
                   'contactos.comentar', 'conversaciones.responder')
on conflict do nothing;

-- El setter: lo mismo, con su pestaña. No ve la del closer.
insert into identidad.roles_permisos (rol_id, permiso)
select r.id, p.clave
  from identidad.roles r, identidad.permisos p
 where r.clave = 'setter' and r.org_id is null
   and p.clave in ('setter.ver', 'contactos.ver', 'contactos.avanzar',
                   'contactos.comentar', 'conversaciones.responder')
on conflict do nothing;

-- El superadministrador recibe TODO, sin atajo en el portero. La prueba "el rol de
-- plataforma tiene todas las capacidades cargadas en la tabla" lo verifica, y sin estas
-- líneas fallaría — que es exactamente lo que tiene que pasar cuando alguien agrega una
-- capacidad y se olvida de repartirla.
insert into identidad.roles_permisos (rol_id, permiso)
select r.id, p.clave
  from identidad.roles r, identidad.permisos p
 where r.clave = 'superadministrador' and r.org_id is null
on conflict do nothing;

-- El administrador: todo lo de su organización, o sea todo salvo `organizaciones.%`. Misma
-- regla que la migración 003.
insert into identidad.roles_permisos (rol_id, permiso)
select r.id, p.clave
  from identidad.roles r, identidad.permisos p
 where r.clave = 'administrador' and r.org_id is null
   and p.clave not like 'organizaciones.%'
on conflict do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · La comprobación que hace que esto no reporte un éxito que no ocurrió
--
-- Todo lo de arriba es `on conflict do nothing`, así que **no falla si no escribe**. Eso es
-- lo que lo hace idempotente y es también su peor modo de fallar: una clave mal escrita, un
-- rol que no existe, o un permiso sin política entran cero filas y salen en silencio.
--
-- Esto lo convierte en un error ruidoso. No verifica un número fijo —eso obligaría a
-- editarlo cada vez— sino la INVARIANTE: ningún rol de sistema puede quedar sin
-- capacidades, y `ADR-0303` exige que todo rol asignable tenga al menos una pantalla.
-- ═════════════════════════════════════════════════════════════════════════════

do $comprobar$
declare
  v_sin_capacidades text;
  v_faltan          int;
begin
  select string_agg(r.clave, ', ')
    into v_sin_capacidades
    from identidad.roles r
   where r.es_sistema and r.org_id is null
     and not exists (select 1 from identidad.roles_permisos rp where rp.rol_id = r.id);

  if v_sin_capacidades is not null then
    raise exception
      'roles de sistema sin ninguna capacidad: %. El reparto entró cero filas en silencio: '
      'revisá que las claves de `permisos` existan y que el rol que corre este archivo '
      'pueda LEER identidad.roles y identidad.permisos.', v_sin_capacidades;
  end if;

  -- Y que el superadministrador tenga TODAS. Es la invariante que el 03 § 2 pide sin
  -- atajo en el portero, y la que se rompe cuando alguien agrega una capacidad y no la
  -- reparte.
  select count(*)
    into v_faltan
    from identidad.permisos p
   where not exists (
     select 1 from identidad.roles_permisos rp
       join identidad.roles r on r.id = rp.rol_id
      where rp.permiso = p.clave and r.clave = 'superadministrador' and r.org_id is null);

  if v_faltan > 0 then
    raise exception
      '% capacidad(es) del catálogo no están asignadas al superadministrador. Ese rol las '
      'tiene TODAS por diseño, sin atajo en el portero.', v_faltan;
  end if;
end
$comprobar$;
