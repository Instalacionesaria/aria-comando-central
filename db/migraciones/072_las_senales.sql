-- Las señales de los detectores, el Plan de acción de cada departamento y los umbrales firmados.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ EXISTE
--
-- Plan de los agentes de IA (`docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-20 a AG-35), etapa AG8.
-- Una sola tabla para lo que detectan Acquisition, Creative Insights, Conversion y Conversation (`D-10`),
-- con la alerta de 14 campos de la arquitectura de producto; el Plan de acción que la pasada diaria arma
-- con ellas; y la firma de los umbrales, que nacen provisionales en el código y el Admin pasa a firmes
-- (`D-11`).
--
-- Los escriben tres archivos y nadie más: `lib/agentes/senales/escritura.ts` las señales,
-- `lib/agentes/plan/guardar.ts` los planes y `lib/agentes/senales/umbrales.ts` las firmas.
--
-- ── LA HUELLA, Y POR QUÉ EL ÍNDICE ÚNICO ES PARCIAL ──────────────────────────
--
-- `huella` = departamento · regla · entidad_tipo · entidad_id · ventana (AG-22). Una sola fila por huella
-- entre las que BLOQUEAN: las vivas (`abierta`, `vista`, `sin_medicion`) y también las que una persona
-- descartó o resolvió **mientras su condición siga** (`condicion_apagada_el is null`). Así una descartada
-- no renace cada mañana: la pasada la encuentra y la actualiza en vez de crear otra. Cuando la condición
-- se apaga, se anota la fecha y deja de bloquear; si vuelve, es un hecho nuevo y nace otra fila.
--
-- ── LO QUE LA TABLA NO GUARDA ────────────────────────────────────────────────
--
-- Texto libre de personas (AG-38): la entidad es un identificador, nunca un nombre (AG-21), y la evidencia
-- es la foto de lo que midió la función —filas, total, ventana y avisos—, con ids y cifras.
--
-- ── «YA CORRIÓ» ES EL PLAN ───────────────────────────────────────────────────
--
-- `planes_de_accion` guarda una fila por empresa, departamento, ventana y día local, también vacía (AG-32):
-- el plan vacío dice que se miró y no hubo nada. Y por eso mismo es la marca de «este departamento ya
-- corrió hoy» (AG-35): un departamento que falló no deja plan y se reintenta en la hora siguiente, sin una
-- tabla de control aparte que pueda decir otra cosa que el plan.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.senales (
  org_id uuid not null references identidad.organizaciones(id),
  id uuid not null default gen_random_uuid(),
  creada_el timestamptz not null default now(),

  -- Origen. La regla es el código del catálogo de umbrales (`ACQ-CPL-SOSTENIDO`).
  departamento text not null check (departamento in ('acquisition', 'creative', 'conversion', 'conversation')),
  detector text not null check (detector ~ '^[a-z_]+$'),
  regla text not null check (regla ~ '^[A-Z]+(-[A-Z0-9]+)+$'),

  -- La entidad, de un juego cerrado (AG-21), y siempre un identificador.
  entidad_tipo text not null check (entidad_tipo in (
    'campana', 'conjunto', 'anuncio', 'pieza', 'funnel', 'par_de_etapas', 'familia_de_entrada',
    'patron', 'agente', 'closer', 'llamada', 'empresa')),
  entidad_id text not null check (char_length(entidad_id) between 1 and 200),

  -- La medida. `muestra` es el denominador que declara la regla: debajo de 10 no hay señal (AG-26), se
  -- cuenta en el plan. Nula sólo en una regla de ausencia, que no tiene denominador («sin entrega»).
  metrica text not null,
  linea_base numeric,
  valor_actual numeric,
  cambio_pct numeric,
  muestra integer check (muestra is null or muestra >= 10),
  ventana text not null check (ventana in ('7d', '30d')),
  periodo_desde date,
  periodo_hasta date not null,
  datos_desde date,

  -- El juicio. La confianza sale de la muestra: alta con 30 o más, media de 10 a 29 (AG-26).
  gravedad text not null check (gravedad in ('critica', 'alta', 'media', 'info')),
  confianza text not null check (confianza in ('alta', 'media')),
  causas_posibles text[] not null default '{}',
  revision_recomendada text not null,

  -- El contrato con las otras áreas y con Executive.
  perdida_contactos numeric check (perdida_contactos is null or perdida_contactos >= 0),
  destino_departamento text check (destino_departamento is null or destino_departamento ~ '^[a-z_-]+$'),
  requiere_validacion_ejecutiva boolean not null default false,
  -- En foto: el valor con que se calculó y si era provisional (AG-33), y lo que midió (AG-28).
  umbral jsonb not null,
  evidencia jsonb not null,
  -- Sólo Conversation (AG-37), con la taxonomía de la arquitectura de producto.
  issue_source text check (issue_source in (
    'prompt_design', 'agent_execution', 'missing_data', 'missing_tool', 'workflow_configuration', 'external_failure')),

  -- La vida (AG-23).
  estado text not null default 'abierta'
    check (estado in ('abierta', 'vista', 'resuelta', 'descartada', 'cerrada_sola', 'sin_medicion')),
  huella text not null,
  ultima_deteccion_el timestamptz not null default now(),
  vista_el timestamptz,
  vista_por uuid,
  cerrada_el timestamptz,
  cerrada_por uuid,
  motivo_cierre text check (motivo_cierre is null or char_length(motivo_cierre) between 1 and 500),
  condicion_apagada_el timestamptz,

  primary key (org_id, id),
  check (issue_source is null or departamento = 'conversation'),
  -- Quien la vio sin fecha, no; la fecha sin quien, sí: la persona se puede haber borrado.
  check (vista_por is null or vista_el is not null),
  -- Lo que cierra una persona lleva motivo y fecha; lo que cierra la pasada, sólo la fecha.
  check (estado not in ('resuelta', 'descartada') or (cerrada_el is not null and motivo_cierre is not null)),
  check (estado <> 'cerrada_sola' or (cerrada_el is not null and cerrada_por is null)),
  check (estado in ('resuelta', 'descartada', 'cerrada_sola') or (cerrada_el is null and motivo_cierre is null)),
  -- La condición se apaga sólo sobre una decisión de una persona: una viva que deja de detectarse se
  -- cierra sola o queda sin medición, no queda viva con la condición apagada.
  check (condicion_apagada_el is null or estado in ('resuelta', 'descartada')),
  -- Quién la vio o la cerró. `set null` con la lista de columnas: sin ella, sobre una clave compuesta
  -- anularía también `org_id` (la lección de la `015`). Se borra la persona y la señal sigue.
  foreign key (org_id, vista_por) references identidad.usuarios (org_id, id) on delete set null (vista_por),
  foreign key (org_id, cerrada_por) references identidad.usuarios (org_id, id) on delete set null (cerrada_por)
);

-- Una fila por huella entre las que bloquean. Ver «LA HUELLA» arriba.
create unique index if not exists senales_una_por_huella
  on negocio.senales (org_id, huella)
  where estado in ('abierta', 'vista', 'sin_medicion')
     or (estado in ('resuelta', 'descartada') and condicion_apagada_el is null);

-- La lectura de una pantalla: las de su departamento y su ventana, las vivas primero.
create index if not exists senales_por_departamento
  on negocio.senales (org_id, departamento, ventana, estado);

create table if not exists negocio.planes_de_accion (
  org_id uuid not null references identidad.organizaciones(id),
  id uuid not null default gen_random_uuid(),
  departamento text not null check (departamento in ('acquisition', 'creative', 'conversion', 'conversation')),
  ventana text not null check (ventana in ('7d', '30d')),
  -- El día local de la empresa en que corrió la pasada.
  dia date not null,
  -- El plan armado con plantillas, con el formato de su departamento (AG-32). Siempre está.
  plan jsonb not null,
  -- Lo que redactó el modelo dentro de los huecos de la plantilla, ya validado. Nulo sin llave o si no
  -- llegó: entonces se muestra el de plantillas.
  redaccion jsonb,
  -- Las detecciones por debajo del piso de muestra (AG-27), con su detalle.
  bajo_el_piso integer not null default 0 check (bajo_el_piso >= 0),
  bajo_el_piso_detalle jsonb not null default '[]',
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, departamento, ventana, dia)
);

create table if not exists negocio.umbrales (
  org_id uuid not null references identidad.organizaciones(id),
  -- El código de la regla del catálogo (`lib/agentes/senales/umbrales.ts`).
  regla text not null check (regla ~ '^[A-Z]+(-[A-Z0-9]+)+$'),
  valor numeric not null,
  firmado_el timestamptz not null default now(),
  -- Quién lo firmó (`D-11`). `set null` con la lista de columnas: se borra la persona y la firma sigue,
  -- con su fecha.
  firmado_por uuid,
  primary key (org_id, regla),
  foreign key (org_id, firmado_por) references identidad.usuarios (org_id, id) on delete set null (firmado_por)
);

comment on table negocio.senales is
  'Lo que detectan Acquisition, Creative Insights, Conversion y Conversation, con la alerta de 14 campos, su evidencia en foto y su ciclo de vida. La escribe sólo lib/agentes/senales/escritura.ts.';
comment on table negocio.planes_de_accion is
  'El Plan de acción de cada departamento, por ventana y día local, también vacío; es la marca de que la pasada de ese departamento corrió ese día. La escribe sólo lib/agentes/plan/guardar.ts.';
comment on table negocio.umbrales is
  'Los umbrales que el Admin firmó, por regla del catálogo; los que no están aquí son los provisionales del código. La escribe sólo lib/agentes/senales/umbrales.ts.';

drop policy if exists aislamiento on negocio.senales;
select negocio.aplicar_aislamiento('negocio.senales');
drop policy if exists aislamiento on negocio.planes_de_accion;
select negocio.aplicar_aislamiento('negocio.planes_de_accion');
drop policy if exists aislamiento on negocio.umbrales;
select negocio.aplicar_aislamiento('negocio.umbrales');

-- La tarea diaria de los detectores (AG-35).
alter table negocio.tareas_programadas
  drop constraint if exists tareas_programadas_tarea_check;
alter table negocio.tareas_programadas
  add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos', 'auditoria', 'mejora', 'anuncios', 'analizadores', 'reintentos', 'senales'));
