-- Las conversaciones del cerebro, sus mensajes, las preguntas del día y los topes.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ EXISTE
--
-- Plan de los agentes de IA (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-51, y `06`, AG-96), etapa AG5. El
-- cerebro —el agente global del Inicio, `executive` en el código— guarda cada hilo para que la persona
-- vuelva a él, y cuenta las preguntas del día contra un tope por persona y otro por empresa.
--
-- La escriben dos archivos y nadie más: `lib/agentes/executive/conversaciones.ts` las conversaciones y
-- los mensajes, y `lib/agentes/executive/topes.ts` los topes y las preguntas del día.
--
-- El plan las numeraba `070`; esa la usó AG2 para la clave de los incidentes, y todo lo que seguía corre
-- un número.
--
-- ── LAS CONVERSACIONES SON DE QUIEN LAS ESCRIBIÓ ─────────────────────────────
--
-- `D-14`: un hilo es de su autor, y se borra en cascada con la persona —`on delete cascade` en la clave
-- compuesta hacia `identidad.usuarios (org_id, id)`, la que impide que un hilo apunte a alguien de otra
-- empresa—. La lectura filtra siempre por autor en el código; la RLS separa empresas, no personas.
--
-- ── LO QUE SE GUARDA DE CADA RESPUESTA ───────────────────────────────────────
--
-- La pregunta, tal como la escribió la persona. De la respuesta, la forma validada de `responder`
-- (`respuesta`) y la evidencia (`evidencia`), con los nombres de personas que trajo la evidencia
-- reemplazados en las dos: en el hilo guardado quedan los identificadores y las cifras, no los nombres
-- (`AG-48`). Ningún bloque de pensamiento del modelo.
--
-- ── EL TOPE SE CUENTA EN UN REGISTRO APARTE DE LOS HILOS ─────────────────────
--
-- `preguntas_del_executive` guarda una fila por pregunta, sin texto, y no cuelga del hilo: borrar un hilo
-- no devuelve sus preguntas al tope. La primera versión contaba los mensajes, y como los mensajes caen en
-- cascada con su hilo, borrar los hilos reiniciaba el tope de la persona y el de la empresa (lo encontró la
-- revisión de AG5). Cuentan las `respondida`, las `fallida_pagada` —el proveedor contestó y se pagó, aunque
-- la respuesta no sirviera— y las `reservada` de los últimos diez minutos: una reserva más vieja es de una
-- función que la plataforma cortó, y no puede ocupar un lugar hasta la medianoche. Una `fallida` sin pago
-- no cuenta (`AG-96`). La reserva se hace bajo `select … for update` sobre la fila de `topes_del_executive`
-- de la empresa, así dos preguntas en paralelo no pasan juntas el último lugar.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.conversaciones_del_executive (
  org_id uuid not null references identidad.organizaciones(id),
  id uuid not null default gen_random_uuid(),
  usuario_id uuid not null,
  -- La primera pregunta, recortada (`AG-51`).
  titulo text not null check (char_length(titulo) between 1 and 120),
  -- Desde dónde se abrió: el chat del Inicio, la caja del pie de un departamento o un tema de la Reunión.
  origen text not null check (origen in ('inicio', 'pie', 'reunion')),
  -- La sección de la caja del pie. Nula en el Inicio.
  seccion text,
  -- Lo que la pantalla sabía al abrirlo (`AG-44`): la entrada, la sub-pestaña y el período.
  contexto jsonb not null default '{}',
  creada_el timestamptz not null default now(),
  actualizada_el timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, usuario_id) references identidad.usuarios (org_id, id) on delete cascade
);

create index if not exists conversaciones_del_executive_por_autor
  on negocio.conversaciones_del_executive (org_id, usuario_id, actualizada_el desc);

create table if not exists negocio.mensajes_del_executive (
  org_id uuid not null references identidad.organizaciones(id),
  id uuid not null default gen_random_uuid(),
  conversacion_id uuid not null,
  rol text not null check (rol in ('persona', 'cerebro')),
  -- La pregunta de la persona, o la conclusión del cerebro.
  texto text not null,
  -- Sólo las preguntas: `reservada` mientras el cerebro piensa, y después `respondida` o `fallida`.
  estado text check (estado in ('reservada', 'respondida', 'fallida')),
  -- Sólo las respuestas: la forma validada de `responder` y la evidencia como identificadores y cifras.
  respuesta jsonb,
  evidencia jsonb,
  -- Sólo las preguntas fallidas: la situación `IA-*` y la referencia del incidente. Nulas cuando lo que
  -- falló no fue el modelo (una escritura de la base).
  situacion text check (situacion is null or situacion ~ '^IA-[A-Z-]+$'),
  ref text check (char_length(ref) <= 64),
  -- Sólo las respuestas: la pregunta que contestan. Con dos preguntas seguidas en el mismo hilo, el orden
  -- de llegada no alcanza para emparejarlas.
  responde_a uuid,
  creado_el timestamptz not null default now(),
  primary key (org_id, id),
  check ((rol = 'persona') = (estado is not null)),
  check ((rol = 'cerebro') = (responde_a is not null)),
  check (rol = 'cerebro' or (respuesta is null and evidencia is null)),
  foreign key (org_id, conversacion_id)
    references negocio.conversaciones_del_executive (org_id, id) on delete cascade,
  foreign key (org_id, responde_a) references negocio.mensajes_del_executive (org_id, id) on delete cascade
);

create index if not exists mensajes_del_executive_por_hilo
  on negocio.mensajes_del_executive (org_id, conversacion_id, creado_el);
-- Las preguntas del día, para el tope. Sin texto y sin hilo: ver «EL TOPE SE CUENTA EN UN REGISTRO APARTE».
create table if not exists negocio.preguntas_del_executive (
  org_id uuid not null references identidad.organizaciones(id),
  id uuid not null default gen_random_uuid(),
  -- Quién preguntó. `set null` con la lista de columnas: se borra la persona y la pregunta sigue
  -- contando para la empresa ese día.
  usuario_id uuid,
  estado text not null default 'reservada'
    check (estado in ('reservada', 'respondida', 'fallida', 'fallida_pagada')),
  creada_el timestamptz not null default now(),
  terminada_el timestamptz,
  primary key (org_id, id),
  foreign key (org_id, usuario_id) references identidad.usuarios (org_id, id) on delete set null (usuario_id)
);

create index if not exists preguntas_del_executive_por_fecha
  on negocio.preguntas_del_executive (org_id, creada_el);

create table if not exists negocio.topes_del_executive (
  org_id uuid not null references identidad.organizaciones(id),
  -- 50 y 300 por omisión (`D-16`). Los ajusta el Admin desde Ajustes (AG7).
  por_persona integer not null default 50 check (por_persona > 0),
  por_empresa integer not null default 300 check (por_empresa > 0),
  actualizado_el timestamptz not null default now(),
  -- Quién los cambió. `set null` con la lista de columnas: sin ella, sobre una clave compuesta anularía
  -- también `org_id` (la lección de la `015`).
  actualizado_por uuid,
  primary key (org_id),
  foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
    on delete set null (actualizado_por)
);

comment on table negocio.conversaciones_del_executive is
  'Los hilos del cerebro, uno por conversación, de quien los escribió. Los escribe sólo lib/agentes/executive/conversaciones.ts.';
comment on table negocio.mensajes_del_executive is
  'Las preguntas y las respuestas de cada hilo del cerebro. De la respuesta, la forma validada y la evidencia como identificadores y cifras. Los escribe sólo lib/agentes/executive/conversaciones.ts.';
comment on table negocio.preguntas_del_executive is
  'Una fila por pregunta al cerebro, sin texto, para contar el tope del día. No cuelga del hilo: borrar un hilo no devuelve sus preguntas. La escribe sólo lib/agentes/executive/topes.ts.';
comment on table negocio.topes_del_executive is
  'Cuántas preguntas por día local admite el cerebro, por persona y por empresa. La escribe sólo lib/agentes/executive/topes.ts.';

drop policy if exists aislamiento on negocio.conversaciones_del_executive;
select negocio.aplicar_aislamiento('negocio.conversaciones_del_executive');
drop policy if exists aislamiento on negocio.mensajes_del_executive;
select negocio.aplicar_aislamiento('negocio.mensajes_del_executive');
drop policy if exists aislamiento on negocio.topes_del_executive;
select negocio.aplicar_aislamiento('negocio.topes_del_executive');
drop policy if exists aislamiento on negocio.preguntas_del_executive;
select negocio.aplicar_aislamiento('negocio.preguntas_del_executive');
