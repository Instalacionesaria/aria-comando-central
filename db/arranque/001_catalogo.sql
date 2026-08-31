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

  -- ── La pantalla `tools` ────────────────────────────────────────────────────
  --
  -- DOS y no una, con el mismo criterio que las de Fundaciones: ver un plan de prospección es
  -- leer un documento; generarlo de nuevo gasta tokens de la organización.
  --
  -- Y separadas de `fundaciones.%` a propósito. Reusarlas era la salida barata: `tools` no es
  -- Fundaciones —sus herramientas no son parte del método, son lo que se hace después— y
  -- unificarlas significaría que darle Tools a alguien le da también ICP & Oferta, sin que nadie
  -- lo decida y sin que nada falle.
  --
  -- El reparto de abajo es DERIVADO, así que estas dos llegan solas a los tres roles: el
  -- superadministrador las recibe por «todas», y el administrador y el usuario porque `tools.%`
  -- no está entre las familias que se les niegan.
  ('tools.ver',          'Ver las herramientas de la pantalla Tools y sus documentos'),
  ('tools.editar',       'Generar y editar los documentos de Tools (consume tokens de la organización)'),

  -- ── El Panel de Monitoreo ──────────────────────────────────────────────────
  --
  -- UNA sola y de lectura: el panel no escribe nada, mira cuántos scrapeos hizo cada empresa y
  -- con qué scraper. Una `monitoreo.editar` sería una capacidad sin puerta.
  --
  -- **Es la primera capacidad de este archivo que el reparto NO puede derivar sola**, y por eso
  -- se le niega a mano a DOS roles abajo. Conviene entender por qué antes de tocarlo: el reparto
  -- deriva por exclusión de prefijos, así que una familia nueva cae en LOS TRES roles. Sin esas
  -- dos líneas, el panel que mide a todas las empresas lo vería cualquier persona de cualquier
  -- empresa cliente — y no fallaría nada, que es la forma de defecto que este archivo persigue
  -- en todas partes.
  --
  -- ── QUIÉN LA TIENE: EL SUPERADMINISTRADOR Y UN ROL PROPIO ──────────────────
  --
  -- Se pidió que el panel lo vean TRES PERSONAS de ARIA, no «los administradores». Un rol no
  -- puede expresar eso —`administrador` es el mismo rol en ARIA y en cada empresa cliente, y el
  -- mismo para todos los administradores de ARIA— así que la capacidad va a un rol propio,
  -- `monitoreo`, que se le asigna a esas personas. El razonamiento largo está en su `insert`.
  --
  -- Y una mitad más, que ninguna fila de esta tabla puede expresar: la sección está marcada
  -- `soloDesdeLaPrincipal`, y `app/api/monitoreo/route.ts` rechaza a quien no pertenece a la
  -- organización principal. Es la red que atrapa el error de asignarle el rol a alguien de una
  -- empresa cliente — un error de una sola fila, que sin ella no falla y le muestra a un cliente
  -- los números de sus competidores.
  ('monitoreo.ver',      'Ver el Panel de Monitoreo: los scrapeos de todas las empresas, por empresa y por scraper'),

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
  -- La tuvo el administrador y NO los dos roles operativos que existían antes, y de eso
  -- dependía que un closer viera una entrada de menú y no ocho. **Con el reparto de tres roles
  -- la tiene también `usuario`**, y es el ensanchamiento que se aceptó con el efecto a la
  -- vista: quien opera ve además los siete tableros. Ver el bloque 2.
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
  ('conversaciones.responder', 'Enviar mensajes y encender o apagar el agente de un contacto'),

  -- ── Etapa 13 · El auditor ──────────────────────────────────────────────────
  --
  -- Resolver una intervención: cerrar el aviso del auditor y quitarle al CRM las etiquetas que
  -- lo tienen pausado. NO se reusa `contactos.avanzar` — avanzar registra un RESULTADO, que
  -- cambia la etapa y alimenta la comisión; esto cierra un aviso. Con una sola capacidad,
  -- conceder lo primero concedería lo segundo sin que nadie lo decida, que es exactamente la
  -- lección que la Etapa 12 escribió arriba para borrar y desactivar.
  --
  -- El reparto de abajo la da por EXCLUSIÓN de prefijos, así que `contactos.%` cae sola en
  -- `usuario` y en `administrador`: no hace falta tocar nada más.
  ('contactos.resolver', 'Resolver una intervención del auditor de IA y reactivar el agente'),

  -- ── Etapa 12 · Borrar ──────────────────────────────────────────────────────
  --
  -- DOS capacidades nuevas, y no se reusan las de editar ni las de desactivar.
  --
  -- Desactivar es reversible y borrar no lo es, así que autorizar lo primero no puede
  -- autorizar lo segundo: quien recibe `usuarios.desactivar` está recibiendo *"puede sacar a
  -- alguien de circulación"*, no *"puede hacer desaparecer su rastro"*. Con una sola
  -- capacidad para las dos, ampliar la operación ampliaría en silencio lo que ya se concedió.
  --
  -- Las tiene solo el superadministrador. El administrador no, por la regla del reparto de
  -- abajo, que le niega `usuarios.%` y `organizaciones.%` completos.
  ('usuarios.borrar',       'Eliminar una persona de la base, cuando no tiene ningún historial asociado'),
  ('organizaciones.borrar', 'Eliminar una empresa de la base, cuando no tiene ningún dato asociado')

on conflict (clave) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · El rol base
--
-- ── DE CUATRO ROLES A TRES, Y QUÉ SE PERDIÓ AL HACERLO ──────────────────────
--
-- Había `closer` y `setter`, cada uno con SU pestaña y no la del otro. Se pidió reemplazarlos
-- por un único `usuario`, y hay que decir con qué se paga: **desaparece la distinción entre
-- quien agenda y quien cierra.** Un `usuario` ve las dos pestañas.
--
-- Lo que lo hace aceptable no es que sea gratis, es que **nadie los tenía asignados**: medido
-- en producción antes de tocar nada, las tres personas eran superadministrador, administrador
-- y administrador. Se retiran sin quitarle nada a nadie — y `003_retiro_de_roles.sql` se
-- encarga de que si alguien los tuviera, pase a `usuario` en vez de quedarse sin ninguno.
--
-- `solo_principal` en FALSO: un usuario existe en cualquier organización, no solo en la que
-- administra la plataforma. Y `exige_segundo_factor` en falso porque la migración 010 lo dejó
-- opcional para todos.
-- ═════════════════════════════════════════════════════════════════════════════

insert into identidad.roles
    (clave, nombre, es_sistema, solo_principal, exige_segundo_factor, secciones_restringidas) values
  ('usuario', 'Usuario', true, false, false, true),

  -- ── EL ROL DEL PANEL DE MONITOREO, Y POR QUÉ ES UN ROL Y NO UNA CAPACIDAD MÁS ──
  --
  -- Se pidió que el Panel de Monitoreo lo vean TRES PERSONAS. No «los administradores»: tres
  -- personas concretas de ARIA.
  --
  -- Eso no lo puede expresar el reparto de abajo, y conviene entender por qué antes de intentar
  -- resolverlo ahí: los roles de sistema son GLOBALES (`org_id is null`), así que `administrador`
  -- es el mismo rol en ARIA y en cada empresa cliente, y dentro de ARIA es el mismo rol para
  -- todos sus administradores. Darle `monitoreo.ver` al rol `administrador` se la da a los tres
  -- de hoy **y al cuarto que se dé de alta mañana**, sin que nadie lo decida.
  --
  -- La salida es la que la migración 003 escribe como regla general: *"si hace falta que alguien
  -- tenga CASI un rol, la respuesta es un rol nuevo — que con este modelo cuesta una fila"*. Los
  -- roles SUMAN, así que alguien con `administrador` + `monitoreo` tiene la unión de los dos, y
  -- conceder o quitar el panel pasa a ser una fila en `identidad.usuarios_roles`.
  --
  -- ── LAS TRES BANDERAS, Y LA QUE PARECE OBVIA Y ESTÁ MAL ────────────────────
  --
  -- `solo_principal` en FALSO, y es lo que más tienta poner en `true`: la bandera existe para los
  -- roles de plataforma y un disparador de la base hace cumplir que quien la tenga viva en la
  -- organización principal — justo la garantía que este panel quiere. **Y sería una escalada.**
  -- `resolverSesion` calcula `esRolDePlataforma` con `bool_or(solo_principal)`, y ese booleano es
  -- lo único que decide si se respeta `sesiones.org_activa`: marcarla convertiría a estas tres
  -- personas en gente que puede conmutar su sesión a cualquier empresa cliente. Se paga con un
  -- eje distinto —`Seccion.soloDesdeLaPrincipal`— que no toca la identidad de nadie.
  --
  -- `secciones_restringidas` en FALSO: el alcance por persona se combina con `bool_and`, así que
  -- marcarlo no restringiría a nadie que además sea `administrador` —y sí dejaría sin ninguna
  -- pestaña a quien tuviera SOLO este rol—. El `update` de más abajo lo reafirma.
  ('monitoreo', 'Panel de Monitoreo', true, false, false, false)
on conflict do nothing;

-- ── LA BANDERA DE LA RESTRICCIÓN POR SECCIÓN, DECLARATIVA ────────────────────
--
-- El `insert` de arriba solo sirve la primera vez —lleva `on conflict do nothing`— así que la bandera
-- se afirma acá, con el MISMO criterio que el reparto de capacidades de abajo: **se declara el estado
-- completo y converge**. Un `update … where clave = 'usuario'` daría la mitad: marcaría, y no
-- desmarcaría si alguien marcó de más.
--
-- Y va en el arranque y no en la migración 017 por un motivo medido: `identidad.roles` tiene
-- `force row level security` sin política para `migrador`, así que desde una migración este `update`
-- **afectaría cero filas informando éxito**. El arranque corre con un rol que omite las políticas.
--
-- Qué significa `true`: las personas con ese rol ven **solo** las secciones que tengan concedidas, y
-- cero filas concedidas son cero pestañas. Qué significa `false`: sin restricción, y las filas de
-- alcance se ignoran por completo. Es lo que expresa «el administrador está desbloqueado» sin
-- escribir el nombre de ningún rol en el código — `ADR-0302`.
update identidad.roles
   set secciones_restringidas = (clave = 'usuario')
 where org_id is null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · El reparto, y es DECLARATIVO
--
-- ── POR QUÉ DEJÓ DE SER UNA LISTA DE `insert` ───────────────────────────────
--
-- La versión anterior eran cuatro `insert … on conflict do nothing`, uno por rol. Funcionaba
-- para dar capacidades y **no podía quitar ninguna**: el reparto derivaba en un solo sentido.
--
-- Se pagó al primer recorte real. Se pidió que el administrador dejara de administrar
-- personas, o sea quitarle `usuarios.%` y `roles.%`. Cambiar el `where` de su `insert` no
-- quita nada: las filas viejas siguen ahí, el rol conserva las capacidades, y **el archivo
-- describe un reparto que no es el real** — que es peor que no describirlo, porque se lee
-- como si fuera la verdad.
--
-- Ahora cada rol declara su conjunto COMPLETO: lo que no está se borra, lo que falta se
-- inserta. Reejecutar converge, y el archivo es la fuente de verdad de quién puede qué.
--
-- Eso exige `delete` sobre `identidad.roles_permisos`, concedido en
-- `002_escritura_del_catalogo.sql` — y solo sobre esa tabla, no sobre el catálogo.
--
-- ── POR QUÉ UN BLOQUE Y NO OCHO SENTENCIAS ──────────────────────────────────
--
-- Porque cada conjunto tiene que estar escrito UNA vez. Con un `delete … not in (…)` y un
-- `insert … in (…)` sueltos, cada lista aparecería dos veces, y dos listas que tienen que
-- coincidir son dos listas que se desincronizan: la del `delete` con una clave de menos
-- borra una capacidad que el `insert` acaba de poner, y el rol la pierde en cada corrida.
--
-- Acá el conjunto se nombra una vez, en `v_reparto.permisos`, y las dos sentencias lo leen.
--
-- ── Y LOS DOS ADMINISTRATIVOS SE DERIVAN, NO SE ENUMERAN ────────────────────
--
-- `superadministrador` es *"todas"* y `administrador` es *"todas menos tres familias"*, así
-- que se calculan sobre `identidad.permisos`. Enumerarlos obligaría a editar este archivo
-- cada vez que se agrega una capacidad, y olvidarse no falla: deja al superadministrador sin
-- ella y el síntoma es un 403 en una pantalla suelta.
-- ═════════════════════════════════════════════════════════════════════════════

do $reparto$
declare
  v_reparto record;
begin
  for v_reparto in
    select * from (values
      -- El superadministrador: TODAS. El `03` § 2 lo pide sin atajo en el portero, así que
      -- las capacidades tienen que estar cargadas en la tabla de verdad.
      ('superadministrador', (select array_agg(clave) from identidad.permisos)),

      -- ── EL USUARIO: todo lo del administrador MENOS las credenciales ────────
      --
      -- Se pidió así, con esas palabras: *"la diferencia entre administrador y usuario será
      -- que el administrador sí puede modificar las credenciales de su empresa"*.
      --
      -- Y se DERIVA en vez de enumerarse, por el mismo motivo que los otros dos: enumerarlo
      -- obligaría a editar este archivo cada vez que se agrega una capacidad, y olvidarse no
      -- falla — deja al usuario sin ella y el síntoma es un 403 en una pantalla suelta.
      --
      -- Hay que decir qué implica, porque es un ensanchamiento respecto de los roles que
      -- reemplaza: **un usuario ve los siete tableros de inteligencia, Fundaciones y la
      -- auditoría.** El `closer` no los veía. Es la consecuencia directa de «todo menos
      -- credenciales» y se eligió con el efecto a la vista.
      --
      -- Se le niega `credenciales.%` COMPLETO, no solo `credenciales.editar`. Con `.ver` le
      -- quedaría la pestaña Ajustes mostrando un panel que no puede tocar, y eso es el `07`
      -- § 4 —*"mostrar un control que no puede cumplir"*— con la agravante de que ahí se ven
      -- los estados de conexión de la empresa.
      --
      -- ── Y LA CUARTA EXCLUSIÓN, QUE NO SE DERIVA DE «TODO MENOS CREDENCIALES» ──
      --
      -- `monitoreo.%` está acá **a mano**, y es la primera vez que este reparto necesita una
      -- exclusión que la frase de arriba no explica. El Panel de Monitoreo mira el consumo de
      -- TODAS las empresas: si cayera sola en este rol —que es lo que hace la derivación por
      -- prefijos— cualquier persona de cualquier empresa cliente vería los números de las demás,
      -- y no fallaría nada. Es exactamente lo que `app/api/admin/comisiones/route.ts` anticipó
      -- que costaría una capacidad propia: *"excluirla exigiría agregar a mano un cuarto `not
      -- like` al reparto y volver a correr `db/arranque` contra producción"*. Este es ese cuarto.
      ('usuario', (select array_agg(clave) from identidad.permisos
                    where clave not like 'organizaciones.%'
                      and clave not like 'usuarios.%'
                      and clave not like 'roles.%'
                      and clave not like 'credenciales.%'
                      and clave not like 'monitoreo.%')),

      -- El administrador: todo lo de SU empresa. Se le niegan tres familias completas:
      --
      --   · `organizaciones.%` — no ve ni crea ni borra empresas. Es lo que lo mantiene
      --     zonificado: sin `organizaciones.listar` no puede conmutarse a otra.
      --   · `usuarios.%`       — no administra personas. Hasta ahora SÍ las tenía y la
      --     frontera vivía solo en la interfaz: la pestaña se filtraba por
      --     `organizaciones.listar`, así que no la veía, pero una petición a mano a
      --     `POST /api/admin/usuarios` funcionaba. La regla era cosmética.
      --   · `roles.%`          — ni asignar ni administrar. `roles.administrar` además no la
      --     exige ninguna ruta (la barrera del rol de plataforma usa `organizaciones.listar`),
      --     así que dejársela era una capacidad sin puerta.
      --
      -- Le queda lo que se pidió: credenciales, configuración, auditoría, fundaciones, los
      -- tableros y las dos pestañas de operación con sus acciones.
      --
      -- ── Y LA CUARTA FAMILIA NEGADA: `monitoreo.%` ───────────────────────────
      --
      -- Ésta no se deduce de «todo lo de SU empresa», porque el Panel de Monitoreo no es de su
      -- empresa: mide TODAS. Y la línea es necesaria aunque parezca redundante con la regla de
      -- la organización principal, porque las dos protegen contra cosas distintas — aquélla
      -- contra el administrador de una empresa cliente, ésta contra el administrador NÚMERO
      -- CUATRO de ARIA, que la regla de la principal deja pasar.
      --
      -- Se pidió que el panel lo vean tres personas concretas. Eso es un rol —`monitoreo`, más
      -- abajo— que se asigna de a una fila, no una capacidad de `administrador`.
      ('administrador', (select array_agg(clave) from identidad.permisos
                          where clave not like 'organizaciones.%'
                            and clave not like 'usuarios.%'
                            and clave not like 'roles.%'
                            and clave not like 'monitoreo.%')),

      -- ── El rol del Panel de Monitoreo: UNA capacidad, enumerada ──────────────
      --
      -- El único de los cuatro que NO se deriva, y es a propósito. Los otros tres se calculan
      -- sobre `identidad.permisos` porque son «todas» o «todas menos N familias», y enumerarlos
      -- obligaría a editar este archivo cada vez que se agrega una capacidad. Éste es al revés:
      -- su definición ES una capacidad concreta, y una derivación que le diera más lo convertiría
      -- en un rol que hace algo que su nombre no dice.
      --
      -- `ADR-0303` pide que todo rol asignable tenga al menos una pantalla. Ésta tiene una:
      -- `monitoreo.ver` habilita la sección `monitoreo` y ninguna otra.
      ('monitoreo', array['monitoreo.ver'])
    ) as t(rol, permisos)
  loop
    -- Un conjunto nulo significa que el catálogo no se pudo leer, y las dos sentencias de
    -- abajo lo tratarían como "no hacer nada" **en silencio**: `<> all (null)` es nulo y
    -- `= any (null)` no devuelve filas. O sea que el rol se quedaría como estaba y este
    -- archivo reportaría éxito. Es el modo de falla que persigue todo el archivo.
    if v_reparto.permisos is null or cardinality(v_reparto.permisos) = 0 then
      raise exception
        'el conjunto de capacidades de «%» salió vacío. Si es uno de los derivados, el '
        '`select` sobre identidad.permisos devolvió cero filas: el rol que corre este '
        'archivo no puede leer el catálogo. Ver db/arranque/002_escritura_del_catalogo.sql.',
        v_reparto.rol;
    end if;

    -- Quitar lo que ya no corresponde. Acotado a `org_id is null`: los roles privados de una
    -- organización —la columna existe y hoy está vacía— no los reparte este archivo, y
    -- borrarles filas sería tocar algo que no declara.
    delete from identidad.roles_permisos rp
     using identidad.roles r
     where r.id = rp.rol_id
       and r.clave = v_reparto.rol
       and r.org_id is null
       and rp.permiso <> all (v_reparto.permisos);

    -- Y poner lo que falta. Con subconsultas explícitas sobre las dos tablas: si alguien
    -- copia este archivo a un contexto sin lectura, el `insert` entra cero filas y el bloque
    -- de comprobación del final lo grita, en vez de que la falta pase inadvertida.
    insert into identidad.roles_permisos (rol_id, permiso)
    select r.id, p.clave
      from identidad.roles r, identidad.permisos p
     where r.clave = v_reparto.rol and r.org_id is null
       and p.clave = any (v_reparto.permisos)
    on conflict do nothing;
  end loop;
end
$reparto$;


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
  v_falta_rol       text;
  v_sobran          text;
begin
  -- ── PRIMERO: QUE LOS ROLES EXISTAN ─────────────────────────────────────────
  --
  -- Sin esta comprobación, todo lo de abajo **pasa vacío justo cuando falla**. La lógica
  -- es "ningún rol de sistema puede quedar sin capacidades", y si el `insert` de los roles
  -- entró cero filas, los roles no existen: la consulta no los encuentra, no encuentra
  -- ninguno sin capacidades, y reporta éxito.
  --
  -- Es el mismo modo de falla que este archivo persigue en todas partes —un cero que
  -- significa "no se midió" leído como "está bien"— y lo tenía en su propia verificación.
  select string_agg(esperado, ', ')
    into v_falta_rol
    from unnest(array['superadministrador','administrador','usuario','monitoreo']) as esperado
   where not exists (
     select 1 from identidad.roles r where r.clave = esperado and r.org_id is null);

  if v_falta_rol is not null then
    raise exception
      'faltan roles de sistema que este archivo tenía que crear: %. El `insert` entró cero '
      'filas en silencio, probablemente porque el rol que corre no tiene privilegio de '
      'inserción sobre identidad.roles. Ver db/arranque/002_escritura_del_catalogo.sql.',
      v_falta_rol;
  end if;

  -- ── ACOTADO A LOS ROLES QUE ESTE ARCHIVO DECLARA, Y SE APRENDIÓ FALLANDO ───
  --
  -- Antes miraba TODOS los roles de sistema, y eso rompió el camino de actualización. Al
  -- retirar `closer` y `setter` quedan, por un instante, roles de sistema que este archivo ya
  -- no reparte: la verificación los encontraba sin capacidades y **abortaba el despliegue
  -- antes de que `003_retiro_de_roles.sql` llegara a retirarlos**. O sea que el archivo que
  -- iba a limpiar el estado no corría nunca, por culpa del estado que venía a limpiar.
  --
  -- La invariante correcta es más chica y más honesta: este archivo puede responder por los
  -- roles que DECLARA. Uno que no declara no es su asunto — y el `raise warning` de abajo se
  -- encarga de que tampoco pase inadvertido.
  select string_agg(r.clave, ', ')
    into v_sin_capacidades
    from identidad.roles r
   where r.es_sistema and r.org_id is null
     and r.clave in ('superadministrador', 'administrador', 'usuario', 'monitoreo')
     and not exists (select 1 from identidad.roles_permisos rp where rp.rol_id = r.id);

  if v_sin_capacidades is not null then
    raise exception
      'roles de sistema sin ninguna capacidad: %. El reparto entró cero filas en silencio: '
      'revisá que las claves de `permisos` existan y que el rol que corre este archivo '
      'pueda LEER identidad.roles y identidad.permisos.', v_sin_capacidades;
  end if;

  -- Y lo que la acotación de arriba dejaría pasar: un rol de sistema que existe y que este
  -- archivo no reparte. No es un error —es exactamente el estado intermedio de un retiro— pero
  -- **tiene que verse**: un rol vivo que nadie reparte se puede asignar y no da ninguna
  -- pantalla. Avisa, y `003_retiro_de_roles.sql` es quien lo resuelve.
  select string_agg(r.clave, ', ')
    into v_sin_capacidades
    from identidad.roles r
   where r.es_sistema and r.org_id is null
     and r.clave not in ('superadministrador', 'administrador', 'usuario');

  if v_sin_capacidades is not null then
    raise warning
      'hay roles de sistema que este archivo ya no reparte: %. Si es un retiro en curso, '
      'db/arranque/003_retiro_de_roles.sql los va a quitar y va a mover a su gente. Si no lo '
      'hace, quedan asignables sin dar ninguna pantalla.', v_sin_capacidades;
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

  -- ── LA FRONTERA DEL USUARIO: las credenciales, y NADA MÁS ─────────────────
  --
  -- Es la única diferencia entre `usuario` y `administrador`, así que es la única cosa que
  -- puede estar mal de una forma que nadie note. Se verifica en las DOS direcciones, porque
  -- se rompe de las dos:
  --
  --   · **de más** — el usuario conserva `credenciales.%` y entonces los dos roles son el
  --     mismo rol con dos nombres. Nada falla: la pantalla se dibuja igual para ambos.
  --   · **de menos** — al usuario le falta algo que el administrador sí tiene y que no son
  --     credenciales. Ahí la diferencia dejó de ser la que se pidió, y el síntoma es un 403
  --     en una pantalla suelta que alguien va a reportar como «no me carga».
  --
  -- Se verifica acá y no solo en la suite porque este archivo es lo que corre contra
  -- producción: la suite mide la base local.
  select string_agg(rp.permiso, ', ' order by rp.permiso)
    into v_sobran
    from identidad.roles r
    join identidad.roles_permisos rp on rp.rol_id = r.id
   where r.clave = 'usuario' and r.org_id is null
     and rp.permiso like 'credenciales.%';

  if v_sobran is not null then
    raise exception
      'el usuario conserva capacidades de credenciales: %. Con eso `usuario` y '
      '`administrador` son el mismo rol con dos nombres, y nada falla al mirar.', v_sobran;
  end if;

  -- Y la otra dirección: la diferencia tiene que ser EXACTAMENTE las credenciales.
  select string_agg(rp.permiso, ', ' order by rp.permiso)
    into v_sobran
    from identidad.roles a
    join identidad.roles_permisos rp on rp.rol_id = a.id
   where a.clave = 'administrador' and a.org_id is null
     and rp.permiso not like 'credenciales.%'
     and not exists (
       select 1 from identidad.roles u
         join identidad.roles_permisos ru on ru.rol_id = u.id
        where u.clave = 'usuario' and u.org_id is null and ru.permiso = rp.permiso);

  if v_sobran is not null then
    raise exception
      'el administrador tiene capacidades que el usuario no, y que no son credenciales: %. '
      'La diferencia entre los dos roles dejó de ser la que se pidió.', v_sobran;
  end if;

  -- ── Y QUE EL USUARIO VEA ALGO ─────────────────────────────────────────────
  --
  -- `ADR-0303`: todo rol asignable tiene al menos una pantalla. Un rol que se puede asignar y
  -- no muestra nada es una persona que puede entrar y no ve nada — y eso se descubre cuando
  -- ella lo dice, no antes.
  if not exists (
    select 1 from identidad.roles r
      join identidad.roles_permisos rp on rp.rol_id = r.id
     where r.clave = 'usuario' and r.org_id is null
       and rp.permiso in ('closer.ver', 'setter.ver')
  ) then
    raise exception
      'el rol `usuario` no recibió ninguna capacidad de pestaña operativa: quien lo tenga '
      'puede entrar y no ve dónde trabajar.';
  end if;

  -- ── LA FRONTERA DEL ADMINISTRADOR ──────────────────────────────────────────
  --
  -- Se pidió que el administrador vea credenciales y NO Empresas ni Usuarios. Que no las vea
  -- ya se cumplía en la interfaz; lo que faltaba es que el servidor lo haga cumplir.
  --
  -- Se verifica acá y no solo en la suite porque este archivo es lo que corre contra
  -- producción: la suite mide la base local. Si el reparto declarativo no borró las filas
  -- viejas —porque falta el `delete` del 002, por ejemplo— esto tiene que fallar en el
  -- despliegue, no descubrirse leyendo la tabla tres semanas después.
  select string_agg(rp.permiso, ', ' order by rp.permiso)
    into v_sobran
    from identidad.roles r
    join identidad.roles_permisos rp on rp.rol_id = r.id
   where r.clave = 'administrador' and r.org_id is null
     and (rp.permiso like 'organizaciones.%'
       or rp.permiso like 'usuarios.%'
       or rp.permiso like 'roles.%');

  if v_sobran is not null then
    raise exception
      'el administrador conserva capacidades que no le corresponden: %. El reparto '
      'declarativo no borró las filas viejas — comprobá que el rol que corre este archivo '
      'tenga `delete` sobre identidad.roles_permisos (db/arranque/002_escritura_del_catalogo.sql).',
      v_sobran;
  end if;

  -- Y la otra mitad, que es la que se rompe por exceso de celo: quitarle de más lo deja sin
  -- Ajustes entero. TODA la pantalla de Ajustes cuelga de `credenciales.ver` —es la única
  -- sección de Ajustes con entrada de menú— así que sin esa capacidad el administrador no
  -- tiene dónde cargar el token de su CRM, que es lo único que se pidió que sí pudiera hacer.
  if not exists (
    select 1 from identidad.roles r
      join identidad.roles_permisos rp on rp.rol_id = r.id
     where r.clave = 'administrador' and r.org_id is null and rp.permiso = 'credenciales.ver'
  ) then
    raise exception
      'el administrador quedó sin `credenciales.ver`: se queda sin la pantalla de Ajustes '
      'completa, que es lo único que se pidió que sí pudiera ver.';
  end if;
end
$comprobar$;
