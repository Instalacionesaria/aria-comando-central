-- Quién es EL closer de la organización. Uno, y elegido por quien administra.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- «CLOSER» NO ES UN ROL, Y ESTA TABLA EXISTE PORQUE NO LO ES
--
-- Se pidió con todas las letras: *"ya no es un closer, ahora es un usuario con acceso a la pestaña
-- closer"*, y *"el que configura a un usuario como closer no es un rol"*.
--
-- Y es coherente con lo que la base ya tenía. Los únicos roles sembrados en la `003` son
-- `superadministrador` y `administrador`; su propio comentario dice que *"los roles de OPERACIÓN
-- dependen del producto y se crean cuando exista el producto"*. Nunca se creó un rol `closer`: el
-- acceso a la pestaña sale de `identidad.usuarios_secciones` con `seccion = 'closer'`, que es un
-- PERMISO, no una identidad.
--
-- Así que la pregunta «¿quién es el closer?» no la contesta ninguna tabla de identidad, y no debería:
-- tener la pestaña habilitada y SER el closer del mes son dos hechos distintos. Varias personas
-- pueden tener la pestaña —un administrador que entra a configurar, alguien en capacitación— y los
-- números del cockpit son de UNA.
--
-- ── POR QUÉ `org_id` ES LA CLAVE PRIMARIA ENTERA ────────────────────────────
--
-- Es la línea que hace el trabajo. Con la clave primaria en `org_id` solo, **una organización no
-- puede tener dos closers asignados**: no es una convención que el código respete, es una fila que
-- la base no acepta. Designar a otro es un `insert … on conflict (org_id) do update`, o sea que el
-- cambio es atómico y no hay un instante con dos.
--
-- La alternativa era `(org_id, usuario_id)` con una bandera `activo`, y ahí «uno solo» pasa a
-- depender de que nadie escriba dos filas con la bandera puesta. El síntoma de ese defecto son dos
-- cockpits con números distintos para la misma empresa, y nada que falle.
--
-- ── Y POR QUÉ NO HAY FILA HASTA QUE ALGUIEN ELIJA ───────────────────────────
--
-- Sin fila = **nadie designó a nadie**. No hay valor por omisión y no se siembra a la primera
-- persona con la pestaña, y es por lo mismo que `comisiones.porcentaje` es nulo y no cero: elegir
-- por el administrador produciría un cockpit con el nombre y el sueldo de alguien que nadie eligió,
-- y se vería exactamente igual que una designación deliberada.
--
-- Lo que la pantalla muestra sin fila es `—` y un aviso, nunca `0`. La regla del `11` § 5.1 aplica
-- igual acá: un cero no medido no se dibuja como un cero.
--
-- ── LO QUE PASA SI SE BORRA A LA PERSONA ────────────────────────────────────
--
-- `on delete cascade`: se va la designación con ella. La organización queda SIN closer asignado, que
-- es un estado que la pantalla sabe decir.
--
-- La otra opción era bloquear el borrado, y acá sí habría frase honesta con acción detrás —«es el
-- closer asignado, designá a otro primero»—, a diferencia del caso de `comisiones.actualizado_por`
-- que la `015` resolvió con `set null` justamente porque no la había. Se eligió el cascade igual: el
-- estado que deja es visible y reparable en la misma pantalla, mientras que bloquear el borrado
-- convierte una tarea de administración en dos pasos con un rechazo en el medio.
--
-- Y no se pierde el rastro de quién designó a quién: eso vive en `identidad.auditoria_accesos`, que
-- sobrevive a la fila borrada.
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.closer_asignado (
  -- La clave primaria ENTERA. Una organización, un closer. Ver el encabezado.
  org_id uuid primary key references identidad.organizaciones(id) on delete cascade,

  usuario_id uuid not null,

  actualizado_el  timestamptz not null default now(),
  -- Quién lo designó. Nunca es la misma persona que el designado: un administrador no puede ser el
  -- closer —se pidió explícitamente— y eso lo comprueba el endpoint, no un `check`: la condición es
  -- «tiene la pestaña closer y no administra», y las dos mitades viven en tablas de identidad que
  -- esta tabla no puede consultar desde una restricción.
  actualizado_por uuid,

  -- ── LAS DOS CLAVES FORÁNEAS COMPUESTAS ────────────────────────────────────
  --
  -- Con `references identidad.usuarios(id)` a secas, nada impediría que la empresa A designara como
  -- closer a un usuario de la B. Es la misma forma que usan las nueve tablas de negocio que apuntan
  -- a una persona, y por el mismo motivo que la `015` deja anotado: `aplicar_aislamiento` NO exige
  -- esto —solo revisa las claves foráneas hacia el esquema `negocio`— así que una clave simple
  -- pasaría el aislamiento sin una palabra.
  foreign key (org_id, usuario_id) references identidad.usuarios (org_id, id) on delete cascade,
  -- `set null` CON LA LISTA DE COLUMNAS. Sin la lista, sobre una clave compuesta anula LAS DOS
  -- columnas —incluida `org_id`, que es `not null`— y borrar a quien alguna vez designó un closer
  -- reventaría con «null value in column "org_id"», un error que no menciona ni los closers. Lo
  -- encontró una prueba en la `015`, no la lectura del SQL.
  foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
    on delete set null (actualizado_por)
);

select negocio.aplicar_aislamiento('negocio.closer_asignado');
