-- ═══════════════════════════════════════════════════════════════════════════════
-- 056 · LAS SEIS TABLAS DE LOS ANALIZADORES HT Y OB
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- ARIA Brain guarda esto en `public.aria_brain_analyzer_*`, sin `org_id`, identificado por el
-- `cliente_id` de un alumno del hub. Comando Central NO las usa: tiene las suyas, por organización,
-- con el mismo régimen que toda tabla de negocio. Es el corte que Fundaciones ya hizo el 2026-09-07
-- (`docs/ETAPA-9.md:340-377`) y las razones son las mismas —el cliente de Comando Central no tiene
-- cuenta en el hub, y esas tablas no existen en la base local, así que nada de lo que dependa de
-- ellas se puede probar—. El detalle está en `docs/ANALIZADORES.md`.
--
-- La séptima tabla del origen, la configuración de tl;dv por cuenta, no tiene equivalente acá: su
-- llave es una credencial de la empresa y va con las demás (`identidad.organizaciones_credenciales`,
-- migración aparte).
--
-- ── LO QUE CAMBIA RESPECTO DEL ORIGEN, CADA COSA POR UN DEFECTO ──────────────
--
--   · `org_id` en todas, primera columna de la clave primaria, y claves foráneas compuestas: la
--     forma ADR-0212 que `negocio.aplicar_aislamiento` exige.
--   · El motivo de un NOT_MATCH va en `motivo`, no en `error`. El origen usaba `error` para las dos
--     cosas, y un descarte limpio («es una reunión interna») se leía igual que un fallo.
--   · CHECK sobre los estados. El origen no tenía ninguno en `estado`: una errata en un `update`
--     dejaba la llamada en un estado que ningún listado mostraba.
--   · Los tokens de caché, y los del VETO. El origen no dejaba costo en las NOT_MATCH.
--   · El correo del prospecto se guarda ya en minúsculas, con un CHECK que lo garantiza. Así el
--     único es una columna simple y el `on conflict` no necesita repetir una expresión.
--
-- Todas nacen vacías. El historial se copia una sola vez, aparte, con aprobación.

-- ─── 1 · El prospecto ─────────────────────────────────────────────────────────
--
-- La persona del otro lado de una llamada. Varias llamadas de la misma persona comparten fila, y de
-- ahí sale «reunión N de M» en la ficha.
create table if not exists negocio.analizador_prospectos (
  org_id uuid not null references identidad.organizaciones(id),
  id uuid not null default gen_random_uuid(),
  nombre text,
  email text check (email is null or email = lower(btrim(email))),
  empresa text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, email)
);

comment on table negocio.analizador_prospectos is
  'La persona del otro lado de una llamada analizada. Se identifica por correo dentro de la empresa; sin correo, cada llamada manual crea la suya.';
comment on column negocio.analizador_prospectos.email is
  'En minusculas y sin espacios, garantizado por el CHECK. Nulo = la llamada no trajo correo: dos nulos no chocan en el unico.';

drop policy if exists aislamiento on negocio.analizador_prospectos;
select negocio.aplicar_aislamiento('negocio.analizador_prospectos');

-- ─── 2 · La llamada ───────────────────────────────────────────────────────────
create table if not exists negocio.analizador_llamadas (
  org_id uuid not null references identidad.organizaciones(id),
  id uuid not null default gen_random_uuid(),
  prospecto_id uuid,
  tipo text not null check (tipo in ('HT', 'OB', 'OTRO')),
  proveedor text not null check (proveedor in ('MANUAL', 'TLDV')),
  reunion_externa_id text,
  titulo text,
  prospecto_nombre text,
  prospecto_email text,
  estado text not null default 'PENDING'
    check (estado in ('PENDING', 'ANALYZING', 'DONE', 'NOT_MATCH', 'FAILED')),
  motivo text,
  error text,
  tomada_el timestamptz,
  fecha_de_la_reunion timestamptz,
  duracion_seg integer check (duracion_seg is null or duracion_seg > 0),
  organizador_nombre text,
  organizador_email text,
  url_de_la_grabacion text,
  invitados jsonb,
  meta_del_proveedor jsonb,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now(),
  primary key (org_id, id),
  -- Sin `where`: en PostgreSQL dos nulos no chocan en un único, así que las manuales —que no
  -- tienen identificador externo— conviven, y el `on conflict` del descubrimiento puede nombrar
  -- estas tres columnas sin repetir un predicado.
  unique (org_id, proveedor, reunion_externa_id),
  -- Una OTRO es un descarte: siempre NOT_MATCH. Reencaminarla cambia el tipo Y el estado juntos.
  check (tipo <> 'OTRO' or estado = 'NOT_MATCH'),
  -- `set null (prospecto_id)` CON LA LISTA: sin ella, anular una clave foránea compuesta anula
  -- también `org_id`, que es `not null`, y borrar un prospecto revienta. Es el mismo defecto que la
  -- `015` encontró en las comisiones (`015_comisiones.sql:96-108`).
  foreign key (org_id, prospecto_id)
    references negocio.analizador_prospectos (org_id, id) on delete set null (prospecto_id)
);

comment on table negocio.analizador_llamadas is
  'Una reunion descubierta en tl;dv o pegada a mano, con su tipo (HT, OB, OTRO) y en que punto del analisis esta. Los datos duros (fecha, duracion, organizador, enlace) salen del proveedor, nunca del modelo.';
comment on column negocio.analizador_llamadas.motivo is
  'Por que NO corresponde: lo dice el clasificador (OTRO) o el veto del analisis (match:false). Un descarte limpio, no un fallo: los fallos van en error.';
comment on column negocio.analizador_llamadas.error is
  'Por que fallo el analisis (FAILED). Recortado a 500 caracteres.';
comment on column negocio.analizador_llamadas.tomada_el is
  'Cuando paso a ANALYZING. Una llamada que lleva mas de 15 minutos ahi se colgo, y la pantalla ofrece reintentarla.';
comment on column negocio.analizador_llamadas.reunion_externa_id is
  'El identificador de la reunion en el proveedor. Es la clave del descarte: una reunion ya guardada o con lapida no vuelve a entrar.';

create index if not exists analizador_llamadas_por_lista
  on negocio.analizador_llamadas (org_id, tipo, creado_el desc);
create index if not exists analizador_llamadas_por_prospecto
  on negocio.analizador_llamadas (org_id, prospecto_id, fecha_de_la_reunion desc nulls last)
  where prospecto_id is not null;
create index if not exists analizador_llamadas_pendientes
  on negocio.analizador_llamadas (org_id, creado_el)
  where estado = 'PENDING';

drop policy if exists aislamiento on negocio.analizador_llamadas;
select negocio.aplicar_aislamiento('negocio.analizador_llamadas');

-- ─── 3 · La transcripción ─────────────────────────────────────────────────────
create table if not exists negocio.analizador_transcripciones (
  org_id uuid not null references identidad.organizaciones(id),
  llamada_id uuid not null,
  texto text not null,
  segmentos jsonb not null,
  idioma text,
  con_marcas_de_tiempo boolean not null,
  creado_el timestamptz not null default now(),
  primary key (org_id, llamada_id),
  foreign key (org_id, llamada_id)
    references negocio.analizador_llamadas (org_id, id) on delete cascade
);

comment on table negocio.analizador_transcripciones is
  'La transcripcion de una llamada, una por llamada. En una OTRO se guarda solo para poder reencaminarla: ninguna respuesta de la API la devuelve.';
comment on column negocio.analizador_transcripciones.con_marcas_de_tiempo is
  'False cuando el texto pegado a mano no traia [mm:ss]: ahi el parser usa el NUMERO DE LINEA como segundos, y la evidencia citada muestra tiempos que no son reales.';

drop policy if exists aislamiento on negocio.analizador_transcripciones;
select negocio.aplicar_aislamiento('negocio.analizador_transcripciones');

-- ─── 4 · El análisis ──────────────────────────────────────────────────────────
--
-- Una fila por llamada y por corrida del modelo que la analizó, gane o pierda: el veto también se
-- guarda, porque también se pagó.
create table if not exists negocio.analizador_analisis (
  org_id uuid not null references identidad.organizaciones(id),
  llamada_id uuid not null,
  tipo text not null check (tipo in ('HT', 'OB')),
  coincide boolean not null,
  analisis jsonb,
  modelo text not null,
  tokens_entrada integer,
  tokens_salida integer,
  tokens_escritura_cache integer,
  tokens_lectura_cache integer,
  costo_usd numeric(12, 6),
  version_de_rubrica text not null,
  puntaje smallint check (puntaje is null or puntaje between 1 and 10),
  resultado text,
  color_del_puntaje text,
  preparacion text,
  resumen text,
  analizado_el timestamptz not null default now(),
  primary key (org_id, llamada_id),
  -- El análisis existe si y solo si coincidió: un veto no tiene informe, y un informe sin
  -- coincidencia sería un análisis inventado sobre algo que no era.
  check (coincide = (analisis is not null)),
  foreign key (org_id, llamada_id)
    references negocio.analizador_llamadas (org_id, id) on delete cascade
);

comment on table negocio.analizador_analisis is
  'Lo que devolvio el modelo al analizar una llamada, coincida o no. Reanalizar pisa la fila.';
comment on column negocio.analizador_analisis.tokens_escritura_cache is
  'Nulo en el historial copiado de ARIA Brain: alla no se guardaba. Nulo = no se sabe, distinto de 0.';
comment on column negocio.analizador_analisis.costo_usd is
  'Nulo mientras la tarifa del modelo no este confirmada contra la facturacion. Nunca 0 por omision: un 0 dice que no costo nada.';
comment on column negocio.analizador_analisis.version_de_rubrica is
  'Con que prompt se juzgo. rubric.es.md@v8 perdia las fases (todas apertura_rapport); v8.1 las conserva.';

drop policy if exists aislamiento on negocio.analizador_analisis;
select negocio.aplicar_aislamiento('negocio.analizador_analisis');

-- ─── 5 · La ficha del prospecto ───────────────────────────────────────────────
create table if not exists negocio.analizador_fichas (
  org_id uuid not null references identidad.organizaciones(id),
  llamada_id uuid not null,
  tipo_derivado text not null check (tipo_derivado in ('PROSPECT_CARD')),
  estado text not null check (estado in ('OK', 'FAILED')),
  ficha jsonb,
  error text,
  modelo text,
  tokens_entrada integer,
  tokens_salida integer,
  tokens_escritura_cache integer,
  tokens_lectura_cache integer,
  costo_usd numeric(12, 6),
  version_de_rubrica text,
  intencion text,
  decisor text,
  riesgos smallint,
  titular text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now(),
  primary key (org_id, llamada_id, tipo_derivado),
  check ((estado = 'OK') = (ficha is not null)),
  foreign key (org_id, llamada_id)
    references negocio.analizador_llamadas (org_id, id) on delete cascade
);

comment on table negocio.analizador_fichas is
  'El segundo analisis de una HT: mira al prospecto, no al closer. Una ficha FAILED deja la llamada en DONE con su analisis intacto.';

drop policy if exists aislamiento on negocio.analizador_fichas;
select negocio.aplicar_aislamiento('negocio.analizador_fichas');

-- ─── 6 · La lápida ────────────────────────────────────────────────────────────
create table if not exists negocio.analizador_lapidas (
  org_id uuid not null references identidad.organizaciones(id),
  proveedor text not null check (proveedor in ('MANUAL', 'TLDV')),
  reunion_externa_id text not null,
  borrada_el timestamptz not null default now(),
  primary key (org_id, proveedor, reunion_externa_id)
);

comment on table negocio.analizador_lapidas is
  'Las reuniones que alguien borro. Sin esto, la siguiente corrida del descubrimiento las vuelve a traer de tl;dv, las clasifica y las analiza de nuevo, pagando otra vez.';

drop policy if exists aislamiento on negocio.analizador_lapidas;
select negocio.aplicar_aislamiento('negocio.analizador_lapidas');
