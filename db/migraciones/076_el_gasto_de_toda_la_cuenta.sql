-- El gasto de TODA la cuenta publicitaria, y lo ya leído de cada campaña por día.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA FUGA QUE ESTO CIERRA
--
-- El 2026-10-07 la app decía 0 de inversión en 7 días y 865,58 en 30, y el Administrador de anuncios de la
-- MISMA cuenta decía 200,19 y 2.234,55. No era una suma mal hecha: el colector pedía sólo las campañas que
-- aparecían en nuestra atribución (13 de 61), y una campaña de mensajes, cuyos contactos llegan sin
-- `campaignId`, no podía entrar nunca. Y nadie lo vio porque «gasto entero» quería decir «el día tiene
-- filas»: las filas nulas de las campañas pausadas tapaban a la única que gastó.
--
-- Esta migración da las dos piezas que faltaban:
--
--   · `gasto_de_la_cuenta`: el total diario de la cuenta, de `/ad-publishing/facebook/reporting?groupBy=day`.
--     Es la referencia: un día está completo cuando la suma por anuncio cuadra con este total.
--   · `lecturas_de_gasto`: qué (campaña, día) ya se leyó y cuánto dio. Lo pendiente se calcula por par, y no
--     por empresa: con el conjunto de días por empresa, una campaña que entraba tarde sólo recibía tres días.
--
-- Las escribe sólo `lib/negocio/recolectarAnuncios.ts` (la prueba 180). No se rellenan acá: con RLS forzada
-- el migrador ve cero filas (`050`), así que el relleno lo hace la aplicación.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.gasto_de_la_cuenta (
  -- Sin `on delete cascade`, como `negocio.anuncios` (`050`): borrar una empresa se frena antes, con la frase
  -- de `QUE_LO_IMPIDE`.
  org_id uuid not null references identidad.organizaciones(id),

  -- El día de la cuenta publicitaria, tal como lo devuelve el proveedor. Medido el 2026-10-07: las sumas por
  -- día coinciden al centavo con el Administrador de anuncios en 7 y en 30 días.
  fecha date not null,

  -- El proveedor OMITE los días sin gasto: una fila que no viene, dentro de un tramo que sí vino, es un cero
  -- medido y se guarda 0. NULL queda para una fila que vino sin `spend`, que no se vio nunca.
  gasto numeric(14, 4),
  impresiones bigint,
  clics bigint,

  -- La última lectura de este día. Un día está cerrado cuando se leyó después de terminar.
  leido_el timestamptz not null default now(),

  -- La última vez que el total de este día CAMBIÓ entre dos lecturas. Meta corrige hacia atrás: un par
  -- (campaña, día) con gasto leído antes de este momento se vuelve a pedir.
  cambio_el timestamptz,

  -- Un día que no cuadra con todas sus campañas ya leídas. La primera vez se borran sus ceros de rango y se
  -- vuelven a descubrir (`redescubierto_el`), porque un vacío del proveedor pudo ser un silencio y no un cero.
  -- Si después sigue sin cuadrar, se declara residuo (`residuo_el`): gasto de la cuenta que ninguna campaña
  -- listada explica, por ejemplo de una campaña borrada. Los dos vuelven a NULL cuando el total cambia.
  redescubierto_el timestamptz,
  residuo_el timestamptz,

  primary key (org_id, fecha)
);

comment on table negocio.gasto_de_la_cuenta is
  'El gasto diario de toda la cuenta publicitaria, de /ad-publishing/facebook/reporting?groupBy=day de GoHighLevel. Es la referencia: un dia esta completo cuando la suma por anuncio cuadra con este total. La escribe solo lib/negocio/recolectarAnuncios.ts.';

comment on column negocio.gasto_de_la_cuenta.gasto is
  '0 = el proveedor omitio el dia dentro de un tramo leido (asi manda los dias sin gasto). NULL = la fila vino sin spend.';

comment on column negocio.gasto_de_la_cuenta.cambio_el is
  'La ultima vez que el total cambio entre dos lecturas (Meta corrige hacia atras). Los pares con gasto leidos antes se vuelven a pedir.';

create table if not exists negocio.lecturas_de_gasto (
  org_id uuid not null references identidad.organizaciones(id),

  -- SIN foránea a `negocio.campanas`, y a propósito: un id puede venir de `metricas` o de un rango y no
  -- estar en una lista de `/entity` que vino recortada o que ya no la lista. Una foránea abortaría la
  -- pasada del cron entera por un dato que sí es verdadero.
  meta_campana_id text not null,
  fecha date not null,

  -- Lo que gastó esa campaña ese día. Nunca NULL: una lectura que falló no se escribe, y un fallo nunca
  -- se guarda como un cero.
  gasto numeric(14, 4) not null,

  -- `false` = una lectura del día, con sus métricas por anuncio guardadas. `true` = un cero probado con un
  -- rango (`/reporting/list` suma cuando se le pide un rango): no hay métricas que guardar porque no gastó.
  -- Un rango nunca pisa una lectura del día; una lectura del día sí pisa un rango.
  por_rango boolean not null,

  leido_el timestamptz not null default now(),

  primary key (org_id, meta_campana_id, fecha)
);

create index if not exists lecturas_de_gasto_por_fecha on negocio.lecturas_de_gasto (org_id, fecha);

comment on table negocio.lecturas_de_gasto is
  'Que (campana, dia) ya se leyo y cuanto gasto. por_rango = un cero probado con un rango. Lo pendiente se calcula por par contra gasto_de_la_cuenta. La escribe solo lib/negocio/recolectarAnuncios.ts.';

drop policy if exists aislamiento on negocio.gasto_de_la_cuenta;
select negocio.aplicar_aislamiento('negocio.gasto_de_la_cuenta');
drop policy if exists aislamiento on negocio.lecturas_de_gasto;
select negocio.aplicar_aislamiento('negocio.lecturas_de_gasto');

-- La tarea horaria que rellena los días que no cuadran.
alter table negocio.tareas_programadas
  drop constraint if exists tareas_programadas_tarea_check;
alter table negocio.tareas_programadas
  add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos', 'auditoria', 'mejora', 'anuncios', 'analizadores', 'reintentos', 'senales', 'anuncios_relleno'));

-- Dos comentarios que dejaron de ser verdad: desde esta migración el colector pide todas las campañas de la
-- cuenta, y la lista de campañas se lee al principio de cada pasada.
comment on table negocio.anuncios is
  'Que anuncio de Meta es cada meta_anuncio_id, para poder nombrarlo en pantalla. Se llena desde /ad-publishing/facebook/reporting/list de GoHighLevel, no desde Meta. Entran los anuncios de las campanas que gastaron, de toda la cuenta (076).';

comment on table negocio.campanas is
  'Que campana de Meta es cada meta_campana_id: nombre y estado, para las tablas de Acquisition. Se llena desde /ad-publishing/facebook/entity?entityType=CAMPAIGN de GoHighLevel, al principio de cada pasada del colector de anuncios. Es el universo de campanas que el colector pide (076).';
