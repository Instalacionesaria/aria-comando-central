-- Las ocho tablas de negocio de las pestañas Closer y Setter (`11` § 2).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LAS COLUMNAS SALEN DE LO QUE LA FUENTE DE VERDAD TIENE, NO DE LO QUE SERÍA LINDO
--
-- El `11` § 2 dice qué entidades existen y "lo que no puede faltar", y aclara que *"los
-- nombres finales de columnas se deciden al escribir la migración"*. Esta migración los
-- decide, y los decide contra el contrato REAL de GoHighLevel — extraído del sistema
-- que hoy hace esta integración, no supuesto.
--
-- Consecuencia que hay que decir por adelantado: **tres campos que el `11` § 2 lista como
-- "no puede faltar" tienen que admitir nulos**, porque la fuente no los tiene:
--
--   · `contactos.score` — el `11` lo pide. GHL no lo trae y NADA lo calcula: en el
--     sistema anterior la columna existe, ningún archivo la escribe, y el frontend pasa
--     `undefined` con el comentario *"el motor aún no calificó — sin inventar"*. Nace
--     nula, y la fila muestra `—`. Exigirla sería inventar una calificación.
--   · `contactos.responsable_id` — el `11` lo pide. **GHL no da asignación.** Las
--     etiquetas de territorio dicen *"está en el mundo del closer"*, no *"es del closer
--     Juan"*; el contrato del sistema anterior lo escribe así: *"Es TERRITORIO, no
--     asignación […] Con más de uno hará falta otra señal (owner de la oportunidad)."*
--   · `contactos.etapa` — el `11` § 2 regla 3 dice "la etapa manda". Pero en GHL **no hay
--     campo de etapa que leer**: la mueve un workflow disparado por una etiqueta, y la
--     búsqueda de contactos devuelve etiquetas, no etapas. Así que la etapa se DEDUCE de
--     las etiquetas al leer, y esta columna solo la escribe Avanzar. Nula = "todavía no
--     recibió ningún Avanzar", y ahí la lectura la deriva.
--
-- Y el `11` § 9 regla 1 es exactamente para esto: *"un cero medido y un cero no medido no
-- son el mismo hecho"*. Una columna obligatoria con un valor de relleno convierte el
-- segundo en el primero.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LO QUE NO SE GUARDA, Y ES LA MITAD DEL DISEÑO
--
-- El `11` § 2 tiene cuatro reglas y las cuatro son sobre lo que NO existe acá:
--
--   1 · **No hay columna "está en el buzón" ni "es urgente".** Las colas son consultas.
--       Un estado guardado se desincroniza del hecho que representa; una consulta no.
--   2 · **No hay columnas para los seis íconos de la fila.** Se calculan de estas mismas
--       tablas. Cuando fueron columnas, la ficha decía una cosa y la fila otra.
--   3 · **No hay columna "tiene cita".** La etapa manda; la cita es un dato.
--   4 · La ÚNICA excepción es `contactos.sello_setter_id`, y se justifica abajo.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- Y POR QUÉ NINGUNA TABLA GUARDA LA CONVERSACIÓN COMPLETA DE GHL
--
-- `mensajes` guarda lo que hace falta para las colas y la ficha. No es un espejo de GHL:
-- la búsqueda de conversaciones de GHL ignora el filtro por etiqueta y devuelve las
-- ~15.000 de la cuenta —medido contra la cuenta real en el sistema anterior— así que
-- espejarla no es viable ni útil.
-- ═════════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · contactos — la entidad central
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.contactos (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  -- El identificador en GoHighLevel. Es la identidad externa y la clave de la
  -- sincronización, pero NO la clave primaria: eso lo decide `aplicar_aislamiento`, y por
  -- un motivo medido. Un índice único global sobre este campo filtraría existencia entre
  -- organizaciones vía `23505` — un `insert` que choca con la fila invisible de otro
  -- cliente devuelve error en vez de fila. Por eso es único POR ORGANIZACIÓN.
  ghl_contact_id  text not null,

  nombre    text not null,
  telefono  text,
  email     text,

  -- Las etiquetas de GHL, crudas y sin normalizar. De acá se derivan el territorio, la
  -- fuente, el estado del bot y —cuando `etapa` es nula— la etapa. Guardarlas crudas es
  -- lo que permite derivar sin volver a preguntarle a GHL.
  etiquetas  text[] not null default '{}',

  -- El territorio: de qué pestaña es este contacto. Se DERIVA de las etiquetas en cada
  -- sincronización, y se guarda porque es el filtro de toda consulta de las dos pantallas
  -- — derivarlo en cada lectura obligaría a desarmar un arreglo por fila.
  --
  -- `null` significa "en ningún territorio", y eso NO es un hueco: es el estado que el
  -- sistema anterior llama `congelado`. Sigue visible y movible, y no se gasta ni una
  -- llamada de GHL más en él.
  --
  -- La precedencia cuando aparecen las dos etiquetas —posible durante el traspaso— es
  -- CLOSER, porque es la etapa más avanzada.
  territorio  text check (territorio in ('closer', 'setter')),

  -- La fuente. LA CALCULA LA APLICACIÓN desde las etiquetas: GHL no tiene este campo.
  -- `not null` con valor de reserva a propósito: el `11` § 7.1 exige *"ninguna fila sin
  -- fuente: si no se sabe, va un valor de reserva visible"*.
  fuente  text not null default 'DIRECTO',

  -- La etapa del embudo. Solo la escribe Avanzar (`11` § 5.5). Nula = todavía no recibió
  -- ninguno, y la lectura la deriva de las etiquetas. La sincronización NO la toca: en el
  -- sistema anterior eso está escrito como contrato, y pisarla borraría un resultado
  -- registrado por una persona con uno derivado de una etiqueta.
  etapa  text,

  -- La letra de calificación. Nula porque nada la calcula todavía — ver el encabezado.
  score  char(1) check (score in ('A', 'B', 'C', 'D')),

  -- El responsable y su rol. Nulos porque GHL no da asignación — ver el encabezado.
  -- El rol se guarda aparte del usuario porque el `11` § 2 lo pide como campo propio: una
  -- persona puede ser closer en una organización y setter en otra.
  responsable_id   uuid,
  responsable_rol  text check (responsable_rol in ('closer', 'setter')),

  -- ── LA ÚNICA EXCEPCIÓN A "LO CALCULADO NO SE GUARDA" ──────────────────────
  --
  -- El sello de atribución del setter. El `11` § 2 regla 4 lo justifica y exige que la
  -- justificación esté por escrito:
  --
  --   "Se enciende con la primera intervención manual de un setter, y NO SE APAGA NI SE
  --    SOBREESCRIBE. Se escribe solo si está vacío: el segundo setter que toque el
  --    contacto no le roba la atribución al primero. Si se recalculara, cambiaría con los
  --    datos — y de ese sello depende una comisión."
  --
  -- Lo hace cumplir un disparador más abajo, no la disciplina de quien escriba la
  -- consulta: un `update` que lo pise no falla, y el que pierde la comisión no se entera.
  sello_setter_id  uuid,
  sello_setter_el  timestamptz,

  -- Las dos marcas que deciden el Buzón: escribieron y nadie contestó.
  --
  -- `ultimo_entrante_el` SOLO AVANZA, nunca retrocede, y lo hace cumplir un disparador.
  -- En el sistema anterior esa regla está escrita con su motivo: esa marca decide la cola,
  -- así que retroceder puede hacer desaparecer de ella a alguien que sí escribió.
  ultimo_entrante_el      timestamptz,
  ultimo_entrante_texto   text,
  ultimo_saliente_el      timestamptz,

  -- Cuándo se sincronizó con GHL por última vez. Es la marca que distingue "no hay datos"
  -- de "no se preguntó": una fila sin sincronizar nunca es distinta de una sincronizada y
  -- vacía. En el sistema anterior una columna así existía y NADIE la escribía, así que su
  -- fecha no probaba nada — y una foto vieja con cara de foto de hoy es peor que ninguna.
  sincronizado_el  timestamptz,

  creado_el  timestamptz not null default now(),

  primary key (org_id, id),

  -- La organización ADENTRO de la clave única, no al lado. Ver el encabezado.
  constraint contactos_ghl_por_org unique (org_id, ghl_contact_id),

  -- El responsable es de la MISMA organización. Clave foránea compuesta, no simple: con
  -- `references usuarios(id)` a secas, nada impide que el contacto de la organización A
  -- quede a cargo de un usuario de la B.
  foreign key (org_id, responsable_id) references identidad.usuarios (org_id, id),
  foreign key (org_id, sello_setter_id) references identidad.usuarios (org_id, id)
);

create index contactos_por_territorio
  on negocio.contactos (org_id, territorio, etapa);

-- El índice del Buzón. Parcial a propósito: la cola son los que tienen algo entrante, y
-- un índice sobre las 255 filas para encontrar 72 recorre lo que no hace falta.
create index contactos_buzon
  on negocio.contactos (org_id, ultimo_entrante_el desc)
  where ultimo_entrante_el is not null;

select negocio.aplicar_aislamiento('negocio.contactos');


-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · citas
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.citas (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  -- El identificador del evento en GHL.
  ghl_evento_id  text not null,

  contacto_id  uuid not null,

  -- La fecha. `timestamptz` y no `timestamp`: GHL devuelve la hora con el desplazamiento
  -- de la subcuenta, y guardar sin zona convierte una cita de las 11:00 en Lima en una
  -- de las 11:00 en donde esté el servidor.
  inicio_el  timestamptz not null,
  fin_el     timestamptz,

  titulo  text,

  -- El estado que devuelve GHL. **No es un enumerado nuestro**: los valores los define
  -- GHL y agregar uno nuevo del lado de ellos no puede romper una sincronización. Se
  -- guarda como texto y se interpreta al leer.
  estado_ghl  text,

  -- La sala de la videollamada. **Puede ser nula, y el `11` § 5.4 hace algo con eso**: el
  -- botón de video se activa solo si hay sala, y sin sala el ícono se atenúa CON LA
  -- EXPLICACIÓN AL LADO — no desaparece.
  sala_url  text,

  sincronizado_el  timestamptz,
  creado_el        timestamptz not null default now(),

  primary key (org_id, id),
  constraint citas_ghl_por_org unique (org_id, ghl_evento_id),
  -- El par completo: una cita no puede apuntar al contacto de otra organización.
  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade
);

-- El índice de la Agenda: el día en curso y los próximos.
create index citas_por_fecha on negocio.citas (org_id, inicio_el);
create index citas_por_contacto on negocio.citas (org_id, contacto_id, inicio_el desc);

select negocio.aplicar_aislamiento('negocio.citas');


-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · mensajes
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.mensajes (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  ghl_mensaje_id  text not null,
  contacto_id     uuid not null,

  -- El canal. El `11` § 6.3 lo usa para los filtros del buzón del setter, y explica por
  -- qué importa: *"según el canal el lead llegó de forma distinta — en Instagram no hay
  -- formulario, es mensaje directo"*. Texto y no enumerado: GHL nombra los canales con
  -- constantes propias y agregar una no puede romper la sincronización.
  canal  text,

  -- Entrante o saliente. Decide el Buzón entero.
  direccion  text not null check (direccion in ('entrante', 'saliente')),

  cuerpo  text,

  -- El autor. **Tres estados, no dos**, y la distinción sale del contrato de GHL: un
  -- mensaje saliente con usuario detrás lo escribió una persona; sin usuario, lo escribió
  -- el bot. Y un entrante lo escribió el contacto.
  --
  -- `autor_usuario_id` es nulo cuando el autor no es una persona nuestra, y entonces
  -- `autor` dice quién fue. Colapsar los dos en un booleano perdería la diferencia entre
  -- "lo escribió el bot" y "lo escribió alguien que ya no está en el sistema".
  autor             text not null check (autor in ('contacto', 'agente', 'persona')),
  autor_usuario_id  uuid,

  enviado_el  timestamptz not null,
  creado_el   timestamptz not null default now(),

  primary key (org_id, id),
  constraint mensajes_ghl_por_org unique (org_id, ghl_mensaje_id),
  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade,
  foreign key (org_id, autor_usuario_id) references identidad.usuarios (org_id, id)
);

create index mensajes_por_contacto on negocio.mensajes (org_id, contacto_id, enviado_el desc);

select negocio.aplicar_aislamiento('negocio.mensajes');


-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · llamadas
--
-- NO salen de GHL. En el sistema anterior las escribe un webhook de la plataforma de voz.
-- Nacen vacías y se llenan cuando esa integración exista; la pantalla tiene que mostrar
-- eso como "no hay datos", no como "cero llamadas".
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.llamadas (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  -- El identificador en la plataforma de voz.
  externa_id   text not null,
  contacto_id  uuid not null,

  -- El tipo de agente. El `11` § 2 lo pide y el § 7.3 lo usa: la ficha muestra cada
  -- llamada *"con su tipo de agente"*.
  agente  text,

  -- Si fue contestada. El `11` § 7.2 lo usa para el tercer ícono, que cuenta llamadas
  -- **contestadas** — no llamadas hechas. Son dos números distintos y solo uno vale.
  contestada  boolean not null default false,

  inicio_el          timestamptz not null,
  duracion_segundos  integer,
  resumen            text,

  creado_el  timestamptz not null default now(),

  primary key (org_id, id),
  constraint llamadas_externa_por_org unique (org_id, externa_id),
  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade
);

create index llamadas_por_contacto on negocio.llamadas (org_id, contacto_id, inicio_el desc);

select negocio.aplicar_aislamiento('negocio.llamadas');


-- ═════════════════════════════════════════════════════════════════════════════
-- 5 · tareas — los seguimientos que vencen
--
-- Las escribe Avanzar, no la sincronización. Nacen vacías.
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.tareas (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  contacto_id  uuid not null,

  -- Cuándo vence. `date` y no `timestamptz`: un seguimiento vence UN DÍA, no a una hora,
  -- y la frontera del día la calcula la consulta con la zona de la organización.
  vence_el  date not null,

  -- La situación y el modo que el `11` § 5.5 pide para la salida "Seguimiento".
  situacion  text,
  modo       text,
  nota       text,

  -- Completada. **Fecha y no booleano**: la cola "Completadas hoy" del `11` § 5.2 se
  -- calcula por fecha, y por eso *"a medianoche se vacía sola"*. Con un booleano habría
  -- que borrarlo con una tarea programada, y una cola que depende de que algo corra a
  -- medianoche es una cola que un día no se vacía.
  completada_el   timestamptz,
  completada_por  uuid,

  -- El autor. `null` significa que lo registró el sistema, y el `11` § 9 regla 5 lo exige:
  -- *"los eventos automáticos no pasan por Avanzar. Se registran solos, con autor Sistema."*
  creada_por  uuid,
  creado_el   timestamptz not null default now(),

  primary key (org_id, id),
  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade,
  foreign key (org_id, creada_por) references identidad.usuarios (org_id, id),
  foreign key (org_id, completada_por) references identidad.usuarios (org_id, id)
);

-- El índice de "Seguimientos de hoy": parcial sobre las pendientes, que son las que la
-- cola busca. Las completadas se acumulan para siempre y no se consultan por vencimiento.
create index tareas_pendientes
  on negocio.tareas (org_id, vence_el)
  where completada_el is null;

create index tareas_completadas_hoy
  on negocio.tareas (org_id, completada_el desc)
  where completada_el is not null;

select negocio.aplicar_aislamiento('negocio.tareas');


-- ═════════════════════════════════════════════════════════════════════════════
-- 6 · resultados — lo que registra Avanzar
--
-- La tabla de la que salen los tableros. Nace vacía: **por eso el Inicio del closer va a
-- mostrar `—` y no `$0`** (`11` § 4).
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.resultados (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  contacto_id  uuid not null,

  -- La salida. Enumerado NUESTRO —a diferencia de los estados de GHL— porque el `11` § 5.5
  -- y § 6.4 las listan y cada una decide qué pide el formulario. Un valor nuevo acá es un
  -- cambio de producto, no un cambio de la fuente externa.
  --
  -- Las seis del closer más las cinco del setter, sin repetir las compartidas.
  salida  text not null check (salida in (
    'venta', 'acuerdo_sin_pago', 'seguimiento', 'no_interesa', 'no_show', 'nurture',
    'agendo', 'venta_chica', 'no_califica'
  )),

  -- El rol que lo registró. El `11` distingue la venta chica del setter de la grande del
  -- closer, y las dos comisiones se calculan distinto: sin esto habría que deducir el rol
  -- del autor, y el rol de una persona puede cambiar.
  rol  text not null check (rol in ('closer', 'setter')),

  -- El monto. Nulo cuando la salida no lo pide, y **no cero**: cero es un monto medido.
  monto        numeric(12, 2),
  forma_pago   text,

  -- El detalle de la salida: la razón, la situación, el motivo. Texto libre porque cada
  -- salida pide algo distinto y un enumerado por salida serían nueve columnas nulas.
  detalle  text,
  nota     text,

  -- El autor. Nulo = Sistema, igual que en `tareas`.
  registrado_por  uuid,
  creado_el       timestamptz not null default now(),

  primary key (org_id, id),
  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade,
  foreign key (org_id, registrado_por) references identidad.usuarios (org_id, id)
);

-- El índice de los tableros: lo cobrado del mes, por rol.
create index resultados_por_fecha on negocio.resultados (org_id, creado_el desc);
create index resultados_por_contacto on negocio.resultados (org_id, contacto_id, creado_el desc);

select negocio.aplicar_aislamiento('negocio.resultados');


-- ═════════════════════════════════════════════════════════════════════════════
-- 7 · notas
--
-- UNA tabla para los dos roles, y el `11` § 7.4 explica por qué está escrito como regla:
--
--   "No hay endpoint de notas por rol y no debería haberlo: es el mismo dato sobre el
--    mismo lead. Es el error más fácil de cometer al construir la segunda pestaña. Cuando
--    pasó, las notas del setter vivían solo en memoria y SE PERDÍAN AL RECARGAR LA PÁGINA,
--    sin que nada fallara."
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.notas (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  contacto_id  uuid not null,
  cuerpo       text not null,

  -- El autor REAL, que el `11` § 2 exige. Nulo solo para las notas importadas de GHL: su
  -- endpoint de notas devuelve cuerpo y fecha, **no autor**. Poner un autor de relleno ahí
  -- convertiría "no sabemos quién la escribió" en "la escribió tal persona".
  autor_id  uuid,

  -- Y por eso hace falta este campo: distingue "importada, sin autor conocido" de
  -- "escrita acá por alguien". Sin él, un `autor_id` nulo tendría dos significados.
  origen  text not null default 'plataforma'
    check (origen in ('plataforma', 'importada')),

  creado_el  timestamptz not null default now(),

  primary key (org_id, id),
  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade,
  foreign key (org_id, autor_id) references identidad.usuarios (org_id, id)
);

create index notas_por_contacto on negocio.notas (org_id, contacto_id, creado_el desc);

select negocio.aplicar_aislamiento('negocio.notas');


-- ═════════════════════════════════════════════════════════════════════════════
-- 8 · hallazgos — lo que la IA escala a un humano
--
-- Nacen vacíos: los escribe un analizador que este sistema todavía no tiene. La cola
-- "Intervenciones urgentes" del `11` § 5.2 va a estar vacía hasta que exista, y tiene que
-- decir "no hay datos", no "cero urgencias".
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.hallazgos (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  contacto_id  uuid not null,

  -- El motivo, que el `11` § 2 pide. `titulo` es la línea corta de la fila; `diagnostico`
  -- es la explicación que la cola muestra debajo.
  titulo       text not null,
  categoria    text,
  severidad    text,
  diagnostico  text,

  -- Si está abierto. **Fecha de resolución y no booleano**, por lo mismo que en `tareas`:
  -- "abierto" es la ausencia de una fecha, y así la cola no depende de que alguien apague
  -- una bandera.
  resuelto_el   timestamptz,
  resuelto_por  uuid,

  detectado_el  timestamptz not null default now(),

  primary key (org_id, id),
  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade,
  foreign key (org_id, resuelto_por) references identidad.usuarios (org_id, id)
);

create index hallazgos_abiertos
  on negocio.hallazgos (org_id, detectado_el desc)
  where resuelto_el is null;

select negocio.aplicar_aislamiento('negocio.hallazgos');


-- ═════════════════════════════════════════════════════════════════════════════
-- LOS DOS DISPARADORES QUE PROTEGEN LO QUE UNA CONSULTA PUEDE PISAR EN SILENCIO
-- ═════════════════════════════════════════════════════════════════════════════

-- 1 · El sello del setter no se apaga ni se sobreescribe.
--
-- El `11` § 2 regla 4: *"Se escribe solo si está vacío: el segundo setter que toque el
-- contacto no le roba la atribución al primero."* Va en un disparador y no en un
-- condicional del código porque un `update` que lo pise **no falla**, y quien pierde la
-- comisión no se entera.
create or replace function negocio.proteger_sello_setter() returns trigger as $sello$
begin
  -- Ya estaba puesto: se conserva el original, pase lo que pase. No se lanza excepción
  -- —un alta legítima puede intentar escribirlo sin saber que ya está— pero tampoco se
  -- cambia. El valor viejo gana en silencio, que es lo correcto acá: lo que importa es
  -- que la atribución no se mueva.
  if old.sello_setter_id is not null then
    new.sello_setter_id := old.sello_setter_id;
    new.sello_setter_el := old.sello_setter_el;
  elsif new.sello_setter_id is not null and new.sello_setter_el is null then
    -- Se enciende ahora: la fecha la pone la base, no quien escribe. Dos relojes para el
    -- mismo hecho es cómo se llega a un sello con fecha del futuro.
    new.sello_setter_el := now();
  end if;
  return new;
end;
$sello$ language plpgsql;

create trigger contactos_sello_setter
  before update on negocio.contactos
  for each row execute function negocio.proteger_sello_setter();

-- 2 · `ultimo_entrante_el` solo AVANZA.
--
-- Esa marca decide el Buzón. En el sistema anterior la regla está escrita con su motivo:
-- retroceder puede hacer desaparecer de la cola a alguien que sí escribió — y el síntoma
-- es una cola más corta, que nadie reporta.
create or replace function negocio.entrante_solo_avanza() returns trigger as $entrante$
begin
  if old.ultimo_entrante_el is not null
     and (new.ultimo_entrante_el is null or new.ultimo_entrante_el < old.ultimo_entrante_el)
  then
    new.ultimo_entrante_el    := old.ultimo_entrante_el;
    new.ultimo_entrante_texto := old.ultimo_entrante_texto;
  end if;
  return new;
end;
$entrante$ language plpgsql;

create trigger contactos_entrante_solo_avanza
  before update on negocio.contactos
  for each row execute function negocio.entrante_solo_avanza();

-- Las dos funciones no las ejecuta nadie más que sus disparadores.
revoke all on function negocio.proteger_sello_setter() from public;
revoke all on function negocio.entrante_solo_avanza() from public;


-- El cinturón además del tirante, idempotente. NUNCA `in schema identidad`.
grant select, insert, update, delete on all tables    in schema negocio to app_inquilino;
grant usage, select                  on all sequences in schema negocio to app_inquilino;
