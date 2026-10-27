-- Lo que trae Meta directo y GoHighLevel no daba (Meta directo, M3, 2026-10-26).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ
--
-- Desde «Conectar con Meta», los anuncios, las campañas y el gasto de cada cliente se leen de la Marketing API de Meta,
-- no del Ad Manager de GoHighLevel. Las tablas son las mismas —`campanas`, `anuncios`, `metricas_de_anuncio`,
-- `gasto_de_la_cuenta`—, con las mismas claves (los ids que traía GoHighLevel ya eran los de Meta), así que las
-- pantallas siguen leyendo donde leían. Meta trae lo que GoHighLevel no podía (`docs/creative/14`, C14-04 a C14-08;
-- `docs/acquisition/08`, A8-23, A8-25 y A8-31), y esta migración le hace lugar:
--
--   · en `campanas`: el objetivo, el presupuesto, las fechas, el estado efectivo, la cuenta publicitaria y su moneda;
--   · en `anuncios`: el estado y el estado efectivo (la entrega), y la cuenta publicitaria;
--   · `conjuntos_de_anuncios`: el conjunto con su presupuesto y su optimización (GoHighLevel no lo daba);
--   · en `metricas_de_anuncio`: el video (cuartiles, thruplay, tiempo medio), el cpm, la moneda, el gasto en USD, los
--     valores de las acciones, y de qué fuente salió la fila;
--   · en `gasto_de_la_cuenta`: la moneda, el gasto en USD, el alcance, la frecuencia, el cpm y la fuente;
--   · `gasto_por_cuenta_publicitaria`: el gasto de cada `act_…` por día —un cliente puede tener varias, en monedas
--     distintas—; `gasto_de_la_cuenta` sigue siendo el total del cliente, que es lo que leen las pantallas;
--   · `metricas_por_desglose`: lo de cada anuncio por ubicación, plataforma, edad y género, dispositivo y país.
--
-- Las cuatro tablas nuevas son de una cuenta (`cuenta_id not null`), con el puente que les pone la cuenta y la política
-- de la organización más la cuenta. Como todas las de negocio, su org_id NO cascadea: una empresa con datos de Meta no
-- se borra de un clic (lib/administracion/borrado.ts dice por qué). Nada se borra: las columnas y tablas de
-- GoHighLevel (`lecturas_de_gasto`, los sellos del cuadre) se retiran después de producción. Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── Las campañas y los anuncios ────────────────────────────────────────────────

alter table negocio.campanas add column if not exists objetivo text;
alter table negocio.campanas add column if not exists presupuesto_diario numeric(14, 4) check (presupuesto_diario >= 0);
alter table negocio.campanas add column if not exists presupuesto_total numeric(14, 4) check (presupuesto_total >= 0);
alter table negocio.campanas add column if not exists inicio timestamptz;
alter table negocio.campanas add column if not exists fin timestamptz;
alter table negocio.campanas add column if not exists estado_efectivo text;
alter table negocio.campanas add column if not exists act_id text check (act_id ~ '^act_[0-9]{1,30}$');
alter table negocio.campanas add column if not exists moneda text check (moneda ~ '^[A-Z]{3}$');
comment on column negocio.campanas.objetivo is 'El objetivo de la campaña en Meta (OUTCOME_LEADS, OUTCOME_TRAFFIC…). De Meta directo.';
comment on column negocio.campanas.presupuesto_diario is 'El presupuesto diario de la campaña, en la moneda de su cuenta publicitaria. Nulo si el presupuesto es del conjunto o total.';
comment on column negocio.campanas.presupuesto_total is 'El presupuesto total de la campaña, en la moneda de su cuenta. Nulo si es diario o del conjunto.';
comment on column negocio.campanas.inicio is 'Cuándo empieza la campaña en Meta (start_time).';
comment on column negocio.campanas.fin is 'Cuándo termina la campaña en Meta (stop_time). Nulo = sin fin.';
comment on column negocio.campanas.estado_efectivo is 'El effective_status de Meta: si de verdad entrega (ACTIVE) o por qué no (PAUSED, CAMPAIGN_PAUSED, WITH_ISSUES…).';
comment on column negocio.campanas.act_id is 'La cuenta publicitaria de Meta de la campaña.';
comment on column negocio.campanas.moneda is 'La moneda de su cuenta publicitaria: el presupuesto está en ésta.';

alter table negocio.anuncios add column if not exists estado text;
alter table negocio.anuncios add column if not exists estado_efectivo text;
alter table negocio.anuncios add column if not exists act_id text check (act_id ~ '^act_[0-9]{1,30}$');
comment on column negocio.anuncios.estado is 'El status del anuncio en Meta (ACTIVE, PAUSED, ARCHIVED…). GoHighLevel no lo daba (050).';
comment on column negocio.anuncios.estado_efectivo is 'El effective_status del anuncio: si de verdad entrega, o qué lo frena (su conjunto o campaña en pausa, en revisión, rechazado).';
comment on column negocio.anuncios.act_id is 'La cuenta publicitaria de Meta del anuncio.';

-- ─── Los conjuntos ──────────────────────────────────────────────────────────────

create table if not exists negocio.conjuntos_de_anuncios (
  org_id               uuid not null references identidad.organizaciones (id),
  cuenta_id            uuid not null,
  meta_conjunto_id     text not null check (meta_conjunto_id ~ '^[0-9]{1,30}$'),
  meta_campana_id      text check (meta_campana_id ~ '^[0-9]{1,30}$'),
  act_id               text check (act_id ~ '^act_[0-9]{1,30}$'),
  nombre               text check (char_length(nombre) <= 500),
  estado               text,
  estado_efectivo      text,
  presupuesto_diario   numeric(14, 4) check (presupuesto_diario >= 0),
  presupuesto_total    numeric(14, 4) check (presupuesto_total >= 0),
  optimizacion         text,
  sincronizado_el      timestamptz not null default now(),
  primary key (org_id, meta_conjunto_id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id)
);
create index if not exists conjuntos_de_anuncios_por_cuenta on negocio.conjuntos_de_anuncios (org_id, cuenta_id);
comment on table negocio.conjuntos_de_anuncios is 'Los conjuntos de anuncios (ad sets) de Meta de cada cliente, con su presupuesto y su optimización (102). Los escribe sólo el recolector de Meta.';
comment on column negocio.conjuntos_de_anuncios.cuenta_id is 'La subcuenta (identidad.cuentas) a la que pertenece la fila. Segunda llave de aislamiento; no cambia nunca.';
comment on column negocio.conjuntos_de_anuncios.meta_conjunto_id is 'El id del conjunto en Meta: el mismo que llega como utmTerm en la atribución del contacto.';
comment on column negocio.conjuntos_de_anuncios.meta_campana_id is 'La campaña del conjunto.';
comment on column negocio.conjuntos_de_anuncios.act_id is 'La cuenta publicitaria de Meta del conjunto.';
comment on column negocio.conjuntos_de_anuncios.nombre is 'El nombre del conjunto en Meta.';
comment on column negocio.conjuntos_de_anuncios.estado is 'El status del conjunto en Meta.';
comment on column negocio.conjuntos_de_anuncios.estado_efectivo is 'El effective_status del conjunto: si entrega o qué lo frena.';
comment on column negocio.conjuntos_de_anuncios.presupuesto_diario is 'El presupuesto diario del conjunto, en la moneda de su cuenta publicitaria.';
comment on column negocio.conjuntos_de_anuncios.presupuesto_total is 'El presupuesto total del conjunto, en la moneda de su cuenta.';
comment on column negocio.conjuntos_de_anuncios.optimizacion is 'Para qué optimiza Meta la entrega (optimization_goal: LEAD_GENERATION, LINK_CLICKS…).';
comment on column negocio.conjuntos_de_anuncios.sincronizado_el is 'La última vez que Meta lo devolvió.';

drop trigger if exists completar_cuenta on negocio.conjuntos_de_anuncios;
create trigger completar_cuenta before insert or update on negocio.conjuntos_de_anuncios
  for each row execute function negocio.completar_cuenta('obligatoria');
select negocio.aplicar_aislamiento_de_cuenta('negocio.conjuntos_de_anuncios', true);

-- ─── Las métricas de cada anuncio ─────────────────────────────────────────────────

alter table negocio.metricas_de_anuncio add column if not exists video jsonb check (video is null or jsonb_typeof(video) = 'object');
alter table negocio.metricas_de_anuncio add column if not exists valores jsonb check (valores is null or jsonb_typeof(valores) = 'object');
alter table negocio.metricas_de_anuncio add column if not exists cpm numeric(14, 4);
alter table negocio.metricas_de_anuncio add column if not exists moneda text check (moneda ~ '^[A-Z]{3}$');
alter table negocio.metricas_de_anuncio add column if not exists gasto_usd numeric(14, 4);
alter table negocio.metricas_de_anuncio add column if not exists fuente text check (fuente in ('ghl', 'meta'));
comment on column negocio.metricas_de_anuncio.video is 'Lo del video, de Meta directo: p25, p50, p75, p95, p100 (reproducciones que llegaron a cada cuartil), thruplay, reproducciones (video_play_actions) y tiempo medio visto en segundos. Nulo si la fila es de GoHighLevel, que no lo daba.';
comment on column negocio.metricas_de_anuncio.valores is 'El valor de cada acción (action_values de Meta), con las mismas claves que acciones. En la moneda de la fila.';
comment on column negocio.metricas_de_anuncio.cpm is 'El costo por mil impresiones que informa Meta, en la moneda de la fila.';
comment on column negocio.metricas_de_anuncio.moneda is 'La moneda del gasto de la fila: la de su cuenta publicitaria. Nula en las filas de GoHighLevel.';
comment on column negocio.metricas_de_anuncio.gasto_usd is 'El gasto en USD, con el tipo de cambio del día (catalogo.tipos_de_cambio). Nulo si no hay tipo de ese día.';
comment on column negocio.metricas_de_anuncio.fuente is 'De dónde salió la fila: meta (Meta directo) o ghl (el Ad Manager de GoHighLevel, hasta Meta directo). Nula en las de antes de la 102, que son de GoHighLevel.';

-- ─── El gasto de cada cliente, y el de cada cuenta publicitaria ───────────────────────

alter table negocio.gasto_de_la_cuenta add column if not exists moneda text check (moneda ~ '^[A-Z]{3}$');
alter table negocio.gasto_de_la_cuenta add column if not exists gasto_usd numeric(14, 4);
alter table negocio.gasto_de_la_cuenta add column if not exists alcance bigint check (alcance >= 0);
alter table negocio.gasto_de_la_cuenta add column if not exists frecuencia numeric(10, 4);
alter table negocio.gasto_de_la_cuenta add column if not exists cpm numeric(14, 4);
alter table negocio.gasto_de_la_cuenta add column if not exists fuente text check (fuente in ('ghl', 'meta'));
comment on column negocio.gasto_de_la_cuenta.moneda is 'La moneda del total del día. Si el cliente tiene cuentas publicitarias en monedas distintas, el total va en USD (moneda = USD).';
comment on column negocio.gasto_de_la_cuenta.gasto_usd is 'El total del día en USD, con el tipo de cambio del día. Nulo si falta el tipo de alguna moneda.';
comment on column negocio.gasto_de_la_cuenta.alcance is 'Personas alcanzadas en el día (reach). Con varias cuentas publicitarias es la suma, que puede contar dos veces a la misma persona.';
comment on column negocio.gasto_de_la_cuenta.frecuencia is 'Impresiones por persona alcanzada en el día. De Meta directo.';
comment on column negocio.gasto_de_la_cuenta.cpm is 'Costo por mil impresiones del día, en la moneda del total.';
comment on column negocio.gasto_de_la_cuenta.fuente is 'De dónde salió el día: meta (Meta directo) o ghl. Nula en las de antes de la 102.';

create table if not exists negocio.gasto_por_cuenta_publicitaria (
  org_id        uuid not null references identidad.organizaciones (id),
  cuenta_id     uuid not null,
  act_id        text not null check (act_id ~ '^act_[0-9]{1,30}$'),
  fecha         date not null,
  gasto         numeric(14, 4) not null check (gasto >= 0),
  moneda        text check (moneda ~ '^[A-Z]{3}$'),
  gasto_usd     numeric(14, 4),
  impresiones   bigint check (impresiones >= 0),
  clics         bigint check (clics >= 0),
  alcance       bigint check (alcance >= 0),
  frecuencia    numeric(10, 4),
  cpm           numeric(14, 4),
  leido_el      timestamptz not null default now(),
  primary key (org_id, act_id, fecha),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id)
);
create index if not exists gasto_por_cuenta_publicitaria_por_cuenta on negocio.gasto_por_cuenta_publicitaria (org_id, cuenta_id, fecha);
comment on table negocio.gasto_por_cuenta_publicitaria is 'El gasto de cada cuenta publicitaria de Meta por día, en su moneda (102). gasto_de_la_cuenta es el total del cliente; esta tabla dice de qué cuenta salió.';
comment on column negocio.gasto_por_cuenta_publicitaria.cuenta_id is 'La subcuenta (identidad.cuentas) a la que pertenece la fila. Segunda llave de aislamiento; no cambia nunca.';
comment on column negocio.gasto_por_cuenta_publicitaria.act_id is 'La cuenta publicitaria de Meta.';
comment on column negocio.gasto_por_cuenta_publicitaria.fecha is 'El día, en la zona horaria de la cuenta publicitaria (Meta corta los días en esa zona).';
comment on column negocio.gasto_por_cuenta_publicitaria.gasto is 'Lo gastado ese día, en la moneda de la cuenta. Un día sin entrega es 0 y no falta.';
comment on column negocio.gasto_por_cuenta_publicitaria.moneda is 'La moneda de la cuenta publicitaria.';
comment on column negocio.gasto_por_cuenta_publicitaria.gasto_usd is 'El gasto en USD con el tipo de cambio del día. Nulo si no hay tipo de ese día.';
comment on column negocio.gasto_por_cuenta_publicitaria.impresiones is 'Impresiones del día.';
comment on column negocio.gasto_por_cuenta_publicitaria.clics is 'Clics del día (todos, no sólo al enlace).';
comment on column negocio.gasto_por_cuenta_publicitaria.alcance is 'Personas alcanzadas en el día.';
comment on column negocio.gasto_por_cuenta_publicitaria.frecuencia is 'Impresiones por persona alcanzada.';
comment on column negocio.gasto_por_cuenta_publicitaria.cpm is 'Costo por mil impresiones, en la moneda de la cuenta.';
comment on column negocio.gasto_por_cuenta_publicitaria.leido_el is 'Cuándo se leyó de Meta por última vez: Meta corrige la atribución hasta 28 días después.';

drop trigger if exists completar_cuenta on negocio.gasto_por_cuenta_publicitaria;
create trigger completar_cuenta before insert or update on negocio.gasto_por_cuenta_publicitaria
  for each row execute function negocio.completar_cuenta('obligatoria');
select negocio.aplicar_aislamiento_de_cuenta('negocio.gasto_por_cuenta_publicitaria', true);

-- ─── Los desgloses ──────────────────────────────────────────────────────────────

create table if not exists negocio.metricas_por_desglose (
  org_id            uuid not null references identidad.organizaciones (id),
  cuenta_id         uuid not null,
  meta_anuncio_id   text not null check (meta_anuncio_id ~ '^[0-9]{1,30}$'),
  fecha             date not null,
  desglose          text not null check (desglose in ('ubicacion', 'plataforma', 'edad_genero', 'dispositivo', 'pais')),
  valor             text not null check (char_length(valor) between 1 and 120),
  gasto             numeric(14, 4) check (gasto >= 0),
  impresiones       bigint check (impresiones >= 0),
  clics             bigint check (clics >= 0),
  alcance           bigint check (alcance >= 0),
  acciones          jsonb check (acciones is null or jsonb_typeof(acciones) = 'object'),
  moneda            text check (moneda ~ '^[A-Z]{3}$'),
  leido_el          timestamptz not null default now(),
  primary key (org_id, meta_anuncio_id, fecha, desglose, valor),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id)
);
create index if not exists metricas_por_desglose_por_cuenta on negocio.metricas_por_desglose (org_id, cuenta_id, fecha);
comment on table negocio.metricas_por_desglose is 'Lo de cada anuncio por día, partido por un desglose de Meta: dónde se vio, en qué plataforma, a qué edad y género, en qué dispositivo y en qué país (102). Sin datos de personas: son totales de Meta.';
comment on column negocio.metricas_por_desglose.cuenta_id is 'La subcuenta (identidad.cuentas) a la que pertenece la fila. Segunda llave de aislamiento; no cambia nunca.';
comment on column negocio.metricas_por_desglose.meta_anuncio_id is 'El anuncio de Meta.';
comment on column negocio.metricas_por_desglose.fecha is 'El día, en la zona de la cuenta publicitaria.';
comment on column negocio.metricas_por_desglose.desglose is 'Cómo se partió: ubicacion (platform_position), plataforma (publisher_platform), edad_genero (age, gender), dispositivo (device_platform), pais (country).';
comment on column negocio.metricas_por_desglose.valor is 'El valor del desglose: «facebook · feed», «instagram», «25-34 · female», «mobile_app», «PE». Las edades y géneros son rangos de Meta, nunca de una persona.';
comment on column negocio.metricas_por_desglose.gasto is 'Lo gastado en ese pedazo, en la moneda de la fila.';
comment on column negocio.metricas_por_desglose.impresiones is 'Impresiones en ese pedazo.';
comment on column negocio.metricas_por_desglose.clics is 'Clics en ese pedazo.';
comment on column negocio.metricas_por_desglose.alcance is 'Personas alcanzadas en ese pedazo.';
comment on column negocio.metricas_por_desglose.acciones is 'Las acciones de ese pedazo, con las mismas claves que metricas_de_anuncio.acciones.';
comment on column negocio.metricas_por_desglose.moneda is 'La moneda del gasto: la de la cuenta publicitaria.';
comment on column negocio.metricas_por_desglose.leido_el is 'Cuándo se leyó de Meta por última vez.';

drop trigger if exists completar_cuenta on negocio.metricas_por_desglose;
create trigger completar_cuenta before insert or update on negocio.metricas_por_desglose
  for each row execute function negocio.completar_cuenta('obligatoria');
select negocio.aplicar_aislamiento_de_cuenta('negocio.metricas_por_desglose', true);
