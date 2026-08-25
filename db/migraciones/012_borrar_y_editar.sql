-- Etapa 12 · los privilegios que faltaban para editar el correo y para borrar.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- TRES `grant`, Y CADA UNO RESPONDE A UNA OPERACIÓN QUE NO SE PODÍA HACER
--
-- Se pidió poder editar y eliminar usuarios y empresas, salvo el administrador principal y la
-- organización principal. Casi todo estaba: editar el nombre, desactivar, restablecer la
-- contraseña y asignar roles ya existen, y la protección del fundador y de ARIA ya está en la
-- base desde `007_invariantes.sql`.
--
-- Lo que no existía eran tres cosas, y las tres estaban bloqueadas por privilegios ausentes
-- **a propósito**. Cada uno se abre con su motivo, y ninguno se abre de más.
-- ═════════════════════════════════════════════════════════════════════════════


-- ── 1 · El correo, y por qué al INQUILINO y no a identidad ───────────────────
--
-- `PATCH /api/admin/usuarios/[id]` solo editaba el nombre porque `email` no estaba entre las
-- columnas otorgadas al inquilino: `grant update (nombre, activo)`. Y un correo mal escrito no
-- es un detalle cosmético — la persona no puede entrar, y la única salida era borrarla y
-- crearla de nuevo.
--
-- La tentación era mover esa ruta al dominio de identidad, donde la política es `using (true)`
-- y se puede tocar cualquier columna. **Sería un retroceso.** El `09` § 7.16 pone editar y
-- desactivar en el dominio del inquilino por una razón que se sostiene: ahí la consulta **no
-- lleva `where org_id`**, porque lo pone la política. Es la base la que impide tocar a alguien
-- de otra empresa, no una línea que alguien tiene que acordarse de escribir.
--
-- Así que se otorga la columna en vez de cambiar de dominio. La política
-- `usuarios_edita_inquilino` sigue siendo la red: `org_id = current_setting('app.org_id')`.
--
-- Lo que esto NO abre: `password_hash`, `es_admin_principal`, `org_id` y las marcas de bloqueo
-- siguen fuera del alcance del inquilino. Y el correo del fundador es inmutable por el
-- disparador `usuarios_admin_protegido`, que no depende de este privilegio.
--
-- El índice único de correo es global, así que un duplicado de OTRA empresa devuelve `23505`.
-- Eso lo maneja la ruta devolviendo `email_duplicado` sin el mensaje de la base — si lo
-- devolviera, sería un canal que confirma la existencia de una fila de otro inquilino.
grant update (email) on identidad.usuarios to app_inquilino;


-- ── 2 · Borrar una persona ───────────────────────────────────────────────────
--
-- `app_identidad` tenía `select, insert, update` y **ningún `delete`**, con este motivo escrito
-- en `002`: borrar deja registros huérfanos o fuerza una cascada que destruye historia.
--
-- El motivo era bueno y sigue valiendo, pero describe el borrado en cascada. Éste no lo es:
-- las claves foráneas que apuntan a `identidad.usuarios` desde el negocio son **`no action`**
-- —notas, resultados, tareas, contactos a cargo, mensajes, hallazgos, y `usuarios.creado_por`—
-- así que la base **rechaza** el borrado en cuanto la persona hizo algo. Lo único que cae con
-- ella son sus sesiones y sus asignaciones de rol, las dos en cascada, y las dos son estado de
-- acceso, no historia.
--
-- O sea que este privilegio permite exactamente una cosa: borrar a alguien que no dejó rastro.
-- Es el caso que se pidió —una persona dada de alta por error— y el único que la base permite.
--
-- ── AL INQUILINO, Y ESA ES LA DECISIÓN QUE IMPORTA ──────────────────────────
--
-- La opción cómoda era `app_identidad`, que ya se usa para el alta. Se descartó, y el motivo es
-- el mismo `09` § 7.16 que puso editar y desactivar en el dominio del inquilino: **la política
-- del inquilino filtra por organización; la de identidad es `using (true)`.**
--
-- Entonces, con identidad, el único filtro sería un `where org_id` escrito a mano, y el peor
-- fallo posible de esta operación —borrar a alguien de OTRA empresa— pasaría a depender de una
-- línea que se puede borrar sin que nada falle. Con el inquilino, ese fallo es imposible: la
-- política no deja ver la fila, así que el `delete` toca cero y responde 404.
--
-- Lo que se acepta a cambio: la conexión del inquilino atiende TODAS las peticiones, no solo
-- las de administración, así que la superficie es más ancha. Es un intercambio consciente —
-- superficie más ancha con un límite duro, contra superficie angosta sin ninguno— y se elige el
-- límite duro, porque es el que protege del error catastrófico.
--
-- Y hace falta la política, no solo el privilegio: con `force row level security` y sin política
-- de `delete`, el borrado no toca ninguna fila **sin dar error**. O sea que reportaría 404
-- siempre, y el síntoma sería «el botón no hace nada».
grant delete on identidad.usuarios to app_inquilino;

create policy usuarios_borra_inquilino on identidad.usuarios
  for delete to app_inquilino
  using (org_id = nullif(btrim(current_setting('app.org_id', true)), '')::uuid);


-- ── 3 · Borrar una empresa ───────────────────────────────────────────────────
--
-- Mismo razonamiento y el mismo resultado: todas las tablas de negocio apuntan a
-- `identidad.organizaciones` con `no action`, y `identidad.usuarios` también. Así que una
-- empresa con un solo contacto, o con una sola persona, no se puede borrar — y eso es correcto.
-- Lo que sí cae en cascada son sus credenciales y sus roles privados.
--
-- La organización principal está protegida por el disparador `organizaciones_protegida`, que
-- rechaza borrarla, desmarcarla y desactivarla. No hace falta repetirlo en la aplicación, y
-- repetirlo sería peor: dos definiciones de la misma regla.
--
-- `update` ya lo tenía `app_identidad`, así que editar el nombre y activar o desactivar una
-- empresa no necesita nada nuevo. Van por identidad y no por el inquilino porque la política
-- del inquilino solo alcanza la organización PROPIA (`id = app.org_id`), y esto es una
-- operación de plataforma sobre una empresa que no es la propia.
grant delete on identidad.organizaciones to app_identidad;
