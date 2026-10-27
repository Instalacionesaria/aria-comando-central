-- El idioma común: el esquema `catalogo`, con sus valores iniciales.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (modelo de datos multiempresa, Fase 0 · Paso 2, 2026-10-16)
--
-- ARIA recibe datos de muchas agencias de muchos nichos, y su diferencial es compararlas: «las agencias de clínicas
-- estéticas reciben N leads al mes con un show-up de X %». Eso sólo es posible si dos agencias distintas dicen lo
-- mismo con la misma palabra. Cada una tiene sus etiquetas, sus etapas y sus campos; este esquema define los
-- estándares —nicho, etapa, cuadrante, canal, fuente, objeción, ángulo del creativo— y, más adelante, los mapeos que
-- traducen lo de cada cuenta.
--
-- Son tablas de referencia COMPARTIDAS por todas las empresas: no llevan org_id ni RLS por empresa. Las escribe sólo
-- el migrador (estas semillas, y las migraciones que cambien un valor) y las leen todos los roles.
--
-- Reglas de todo el esquema:
--   · la llave es un texto estable en minúsculas (`clinicas_esteticas`, dominio `catalogo.clave`), y el nombre
--     visible va aparte;
--   · nada se borra: un valor que deja de usarse queda `vigente = false`, porque los hechos históricos lo citan;
--   · un cambio a un valor ya sembrado va en una migración propia, nunca editando esta.
--
-- No toca ninguna tabla existente. Los permisos nombran a los dos roles del modelo que crea el arranque
-- (`app_ingesta`, `app_analista`): el arranque corre antes que las migraciones.
-- ═════════════════════════════════════════════════════════════════════════════

create schema if not exists catalogo;
comment on schema catalogo is
  'El idioma común: taxonomías y mapeos compartidos por todas las empresas. Sin org_id. Lo escribe el migrador (semillas) y el nivel 0.';

-- Un dominio para las llaves: minúsculas, dígitos y guion bajo, de 2 a 60.
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'catalogo' and t.typname = 'clave') then
    create domain catalogo.clave as text check (value ~ '^[a-z0-9][a-z0-9_]{1,59}$');
  end if;
end $$;
comment on domain catalogo.clave is 'Llave estable de un valor de catálogo: minúsculas, dígitos y guion bajo. Nunca cambia.';

-- ─── Geografía y dinero ─────────────────────────────────────────────────────────

create table if not exists catalogo.monedas (
  codigo    char(3) primary key check (codigo ~ '^[A-Z]{3}$'),
  nombre    text not null,
  decimales smallint not null default 2 check (decimales between 0 and 4),
  vigente   boolean not null default true
);
comment on table catalogo.monedas is 'Monedas ISO 4217 en las que una cuenta puede cobrar o gastar.';
comment on column catalogo.monedas.codigo is 'Código ISO 4217 (USD, MXN, EUR…).';
comment on column catalogo.monedas.decimales is 'Decimales con los que se muestra (CLP y COP sin decimales).';

create table if not exists catalogo.paises (
  codigo         char(2) primary key check (codigo ~ '^[A-Z]{2}$'),
  nombre         text not null,
  region         text not null check (region in ('norteamerica', 'centroamerica', 'caribe', 'andina', 'cono_sur', 'iberia', 'resto_de_europa', 'otra')),
  moneda         char(3) not null references catalogo.monedas (codigo),
  zona_horaria   text not null,
  vigente        boolean not null default true
);
comment on table catalogo.paises is 'Países ISO 3166-1 con su región (eje de los benchmarks), su moneda y su zona horaria principal.';
comment on column catalogo.paises.region is 'Agrupación para benchmarks: un país con pocas cuentas se compara por región.';
comment on column catalogo.paises.zona_horaria is 'Zona IANA principal (America/Lima). La cuenta puede tener otra.';

create table if not exists catalogo.tipos_de_cambio (
  moneda          char(3) not null references catalogo.monedas (codigo),
  dia             date not null,
  usd_por_unidad  numeric(20, 10) not null check (usd_por_unidad > 0),
  fuente          text not null,
  registrado_el   timestamptz not null default now(),
  primary key (moneda, dia)
);
comment on table catalogo.tipos_de_cambio is
  'Cuántos USD vale una unidad de cada moneda, por día. Un monto_usd se calcula con el del día del hecho y NO se recalcula si el tipo cambia después.';
comment on column catalogo.tipos_de_cambio.fuente is 'De dónde salió el valor: el proveedor diario del tipo de cambio. Nunca se recalcula hacia atrás.';

-- ─── Las cuentas: nicho y modelo de negocio ─────────────────────────────────────

create table if not exists catalogo.nichos (
  clave        catalogo.clave primary key,
  padre        catalogo.clave references catalogo.nichos (clave),
  nivel        smallint not null check (nivel between 1 and 3),
  nombre       text not null,
  descripcion  text,
  vigente      boolean not null default true,
  creado_el    timestamptz not null default now(),
  check ((padre is null) = (nivel = 1)),
  check (padre is distinct from clave)
);
comment on table catalogo.nichos is
  'Árbol de nichos: 1 sector › 2 nicho › 3 subnicho (Salud › Clínicas estéticas › Depilación láser). Es el eje de todo benchmark.';
comment on column catalogo.nichos.nivel is '1 = sector, 2 = nicho, 3 = subnicho. Un nivel 2 o 3 siempre tiene padre.';

create index if not exists nichos_por_padre on catalogo.nichos (padre);

-- El nivel del hijo es el del padre más uno: una regla entre filas, que un `check` no puede expresar.
create or replace function catalogo.nicho_nivel_coherente() returns trigger
language plpgsql as $$
begin
  if new.padre is not null and new.nivel <> (select nivel + 1 from catalogo.nichos where clave = new.padre) then
    raise exception 'El nicho % es de nivel % pero su padre % es de nivel %.',
      new.clave, new.nivel, new.padre, (select nivel from catalogo.nichos where clave = new.padre);
  end if;
  return new;
end $$;
drop trigger if exists nichos_nivel_coherente on catalogo.nichos;
create trigger nichos_nivel_coherente before insert or update on catalogo.nichos
  for each row execute function catalogo.nicho_nivel_coherente();

create table if not exists catalogo.modelos_de_negocio (
  clave              catalogo.clave primary key,
  nombre             text not null,
  descripcion        text,
  ticket_minimo_usd  numeric(12, 2) check (ticket_minimo_usd >= 0),
  ticket_maximo_usd  numeric(12, 2) check (ticket_maximo_usd >= 0),
  vigente            boolean not null default true,
  check (ticket_maximo_usd is null or ticket_minimo_usd is null or ticket_maximo_usd >= ticket_minimo_usd)
);
comment on table catalogo.modelos_de_negocio is
  'Cómo vende la cuenta: high ticket, low ticket, recurrente, servicio local. Un lead de USD 50 no se compara con uno de USD 8.000.';

-- ─── El viaje del lead ──────────────────────────────────────────────────────────

create table if not exists catalogo.etapas (
  clave        catalogo.clave primary key,
  nombre       text not null,
  orden        smallint not null unique,
  es_final     boolean not null default false,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.etapas is
  'Las 7 etapas del Pipeline Maestro (Lead › Conversación › Calificado › Agendado › Asistió › Venta › Onboarding), las mismas en todas las cuentas. La etapa sólo avanza. La mueve un workflow de GoHighLevel y Comando Central la REGISTRA con su hora (evento etapa_cambiada). Por qué se detuvo un lead no es una etapa: es su Salida (catalogo.salidas).';
comment on column catalogo.etapas.orden is 'Posición en el embudo, de 1 (lead) a 7 (onboarding). Avanzar es pasar a un orden mayor.';
comment on column catalogo.etapas.es_final is 'true = no hay etapa después (onboarding). Venta no es final: después viene el onboarding.';

create table if not exists catalogo.cuadrantes (
  clave                 catalogo.clave primary key,
  nombre                text not null,
  encaje                text check (encaje in ('alto', 'bajo')),
  capacidad             text check (capacidad in ('alta', 'baja')),
  sigue_en_seguimiento  boolean not null,
  orden                 smallint not null unique,
  descripcion           text not null,
  vigente               boolean not null default true,
  check ((encaje is null) = (capacidad is null))
);
comment on table catalogo.cuadrantes is
  'Encaje con el ICP × capacidad de compra: Prioriza, Valida, Financia y Descarta. Sin cuadrante = NULL (sin clasificar): no hay una quinta clave para eso.';
comment on column catalogo.cuadrantes.sigue_en_seguimiento is 'false = sale de toda cadencia para agendar (Descarta va a Nutrición).';
comment on column catalogo.cuadrantes.vigente is 'false = ya no se usa; queda porque los hechos históricos la citan.';

create table if not exists catalogo.canales (
  clave               catalogo.clave primary key,
  nombre              text not null,
  es_conversacional   boolean not null,
  vigente             boolean not null default true
);
comment on table catalogo.canales is 'Por dónde ocurre un toque: llamada, voz IA, WhatsApp, Instagram DM, email, SMS, formulario, aviso interno.';

create table if not exists catalogo.fuentes (
  clave       catalogo.clave primary key,
  nombre      text not null,
  tipo        text not null check (tipo in ('pagada', 'organica', 'referido', 'directa', 'outbound', 'alianza', 'otra')),
  plataforma  text,
  vigente     boolean not null default true
);
comment on table catalogo.fuentes is
  'De dónde viene el lead, como ORIGEN DE MARKETING: Meta Ads, Instagram orgánico, outbound, referido, alianza, directo. No confundir con catalogo.proveedores (qué sistema mandó el dato).';
comment on column catalogo.fuentes.tipo is 'El tipo de origen: pagada, organica, referido, directa, outbound (listas de prospección), alianza u otra.';
comment on column catalogo.fuentes.plataforma is 'La plataforma publicitaria cuando la fuente es pagada (meta, tiktok, google).';

-- El canal dice POR DÓNDE ocurre un toque; la entrada, por qué puerta del Pipeline Maestro entró el lead (comentó una
-- palabra clave, escribió por DM, llenó el formulario). Dos entradas pueden compartir canal.
create table if not exists catalogo.entradas (
  clave        catalogo.clave primary key,
  nombre       text not null,
  canal        catalogo.clave references catalogo.canales (clave),
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.entradas is
  'Por qué puerta entró el lead al Pipeline Maestro (formulario de la landing, Meta Lead Form, comentario en una publicación, palabra clave por DM, nuevo seguidor, WhatsApp directo…). Es una entrada, no una etapa.';
comment on column catalogo.entradas.canal is 'El canal de esa entrada (catalogo.canales). Nulo si el SOP no lo define.';

-- Por qué se detuvo un lead, sin cambiar su etapa. La etapa sólo avanza: un lead que no compra queda en la etapa más
-- alta a la que llegó, con su Salida. Avanzar de nuevo la vacía.
create table if not exists catalogo.salidas (
  clave              catalogo.clave primary key,
  nombre             text not null,
  entra_a_nutricion  boolean not null default false,
  orden              smallint not null unique,
  descripcion        text not null,
  vigente            boolean not null default true
);
comment on table catalogo.salidas is
  'Las Salidas comunes del Pipeline Maestro: por qué se detuvo el lead sin cambiar su etapa (Descarta, No-show, Seguimiento, Adelanto, Nurture, Descalificado, Nutrición, NO rotundo). La marca un workflow de GoHighLevel; se vacía cuando el lead vuelve a avanzar.';
comment on column catalogo.salidas.entra_a_nutricion is 'true = el lead con esta Salida entra a la secuencia de Nutrición (Seguimiento, sólo si no decide en 14 días).';

-- El proveedor técnico: QUÉ SISTEMA mandó el dato. No es catalogo.fuentes (el origen de marketing).
create table if not exists catalogo.proveedores (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text,
  vigente      boolean not null default true
);
comment on table catalogo.proveedores is
  'Qué sistema mandó un dato (GoHighLevel, Meta, Fathom, la landing, ManyChat, la pasarela de pagos…). Lo citan negocio.eventos.fuente, ingesta.recibidos.fuente, ingesta.claves.fuente y respuestas_del_lead.proveedor. No es catalogo.fuentes, que es el origen de marketing del lead. Un proveedor nuevo es un INSERT.';

create table if not exists catalogo.motivos (
  clave    catalogo.clave primary key,
  tipo     text not null check (tipo in ('no_show', 'descalificacion', 'perdida')),
  nombre   text not null,
  vigente  boolean not null default true,
  unique (tipo, clave)
);
comment on table catalogo.motivos is 'Por qué no asistió, por qué se descalificó o por qué no compró.';

create table if not exists catalogo.categorias_de_objecion (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.categorias_de_objecion is
  'Las categorías de objeción. Hoy viven en código (lib/analizadores/categorias.ts): precio, momento, decisor, confianza, encaje, otra.';

create table if not exists catalogo.preguntas_estandar (
  clave            catalogo.clave primary key,
  nombre           text not null,
  tipo_de_valor    text not null check (tipo_de_valor in ('texto', 'numero', 'moneda', 'opcion', 'opciones', 'booleano', 'fecha')),
  unidad           text,
  descripcion      text not null,
  etapa            catalogo.clave references catalogo.etapas (clave),
  clase            text check (clase ~ '^[a-z_]{2,40}$'),
  eje              text check (eje in ('encaje', 'capacidad')),
  vigencia_dias    smallint check (vigencia_dias > 0),
  origen_esperado  text,
  vigente          boolean not null default true
);
comment on table catalogo.preguntas_estandar is
  'Lo que declara el lead, venga del formulario, del agente de DM, del de WhatsApp, del de voz o del closer (las preguntas del SOP del 2026-10-22). Los tramos propios de cada cliente se traducen por mapeo, no se siembran acá.';
comment on column catalogo.preguntas_estandar.tipo_de_valor is
  'opcion/opciones = la respuesta es una (o varias) de catalogo.opciones_de_pregunta; moneda = un monto mensual con su moneda; booleano = sí o no; fecha = un día.';
comment on column catalogo.preguntas_estandar.etapa is 'En qué etapa del Pipeline Maestro se espera la respuesta (catalogo.etapas).';
comment on column catalogo.preguntas_estandar.clase is
  'La clase de la pregunta según el SOP: identidad, evidencia, dolor, decisor, capacidad, compromiso o trazabilidad (las del formulario), y confirmacion o post_call (las de después). Texto documentado y no lista cerrada.';
comment on column catalogo.preguntas_estandar.eje is 'Qué eje del cuadrante alimenta: encaje o capacidad. Nulo = ninguno de los dos.';
comment on column catalogo.preguntas_estandar.vigencia_dias is 'Cuántos días vale la respuesta antes de volver a preguntarla (la inversión, 30). Nulo = el SOP no la define.';
comment on column catalogo.preguntas_estandar.origen_esperado is
  'Quién se espera que la obtenga, como lista de claves separadas por coma (formulario, agente_dm, agente_whatsapp, agente_admisiones, ia_confirmacion, closer).';

create table if not exists catalogo.opciones_de_pregunta (
  pregunta  catalogo.clave not null references catalogo.preguntas_estandar (clave),
  clave     catalogo.clave not null,
  nombre    text not null,
  orden     smallint not null,
  vigente   boolean not null default true,
  primary key (pregunta, clave),
  unique (pregunta, orden)
);
comment on table catalogo.opciones_de_pregunta is 'Las respuestas cerradas de cada pregunta estándar (los tramos de facturación, de inversión…).';

-- ─── El creativo ────────────────────────────────────────────────────────────────

create table if not exists catalogo.dolores_del_creativo (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text,
  vigente      boolean not null default true
);
comment on table catalogo.dolores_del_creativo is
  'El dolor que ataca una PIEZA (leads que se enfrían, depender de referidos…). Se lee del nombre del anuncio. No es el dolor que declara el lead: ése es catalogo.dolores_comunes.';

create table if not exists catalogo.dolores_comunes (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  orden        smallint not null unique,
  vigente      boolean not null default true
);
comment on table catalogo.dolores_comunes is
  'La lista corta de dolores que declara el lead (D10): velocidad de respuesta, ausencias, precio, dependencia del dueño, nicho, adquisición, retención. Es la base del «dolor más común»; el texto propio de cada cliente se traduce por mapeo.';

create table if not exists catalogo.niveles_de_consciencia (
  clave   catalogo.clave primary key,
  nombre  text not null,
  orden   smallint not null unique
);
comment on table catalogo.niveles_de_consciencia is 'Los cinco niveles de consciencia del comprador, de inconsciente a muy consciente.';

create table if not exists catalogo.formatos (
  clave    catalogo.clave primary key,
  nombre   text not null,
  vigente  boolean not null default true
);
comment on table catalogo.formatos is 'El formato de la pieza: video UGC, video del dueño, carrusel, imagen, VSL…';

create table if not exists catalogo.etapas_del_creativo (
  clave        catalogo.clave primary key,
  nombre       text not null,
  orden        smallint not null unique,
  descripcion  text not null
);
comment on table catalogo.etapas_del_creativo is 'TOFU, MOFU y BOFU: a qué temperatura de audiencia apunta la pieza. Comando Central ya la lee del nombre (etapaDelNombre).';

create table if not exists catalogo.reglas_de_nomenclatura (
  clave           catalogo.clave primary key,
  descripcion     text not null,
  separador       text not null default '_',
  partes          jsonb not null,
  vigente_desde   date not null,
  vigente_hasta   date,
  check (jsonb_typeof(partes) = 'array' and jsonb_array_length(partes) > 0)
);
comment on table catalogo.reglas_de_nomenclatura is
  'El contrato del nombre de un anuncio: qué partes tiene, en qué orden y de qué catálogo sale cada una. Ej.: {etapa}_{dolor}_{consciencia}_{formato}_{version}.';
comment on column catalogo.reglas_de_nomenclatura.partes is
  'Arreglo ordenado: [{"parte":"etapa","catalogo":"etapas_del_creativo","obligatoria":true}, …]. "catalogo": null = texto libre (la versión).';

-- ─── Los agentes ────────────────────────────────────────────────────────────────

create table if not exists catalogo.departamentos (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.departamentos is
  'A quién va cada señal o insight. Reúne los que ya usa Comando Central (acquisition, creative, conversion, conversation, sales, reunion) y los del flujo (research, marketing, systems, client_success).';

create table if not exists catalogo.dominios_de_evento (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.dominios_de_evento is 'A qué parte del flujo pertenece cada tipo de evento (atribución, conversación, pipeline, agenda, venta, pago, nutrición…). Un dominio nuevo es un INSERT.';

create table if not exists catalogo.tipos_de_evento (
  clave              catalogo.clave not null,
  version            smallint not null default 1 check (version >= 1),
  dominio            catalogo.clave not null references catalogo.dominios_de_evento (clave),
  nombre             text not null,
  descripcion        text not null,
  etapa_que_marca    catalogo.clave references catalogo.etapas (clave),
  esquema_de_datos   jsonb not null,
  vigente            boolean not null default true,
  para_la_trayectoria boolean not null default false,
  creado_el          timestamptz not null default now(),
  primary key (clave, version),
  check (jsonb_typeof(esquema_de_datos) = 'object')
);
comment on table catalogo.tipos_de_evento is
  'Cada evento posible, versionado. Un cambio en la forma de `datos` es una versión nueva; la vieja queda para leer los eventos viejos.';
comment on column catalogo.tipos_de_evento.etapa_que_marca is
  'La etapa que este hecho DEBERÍA implicar (cita_agendada → agendado): una señal esperada para controles de consistencia, no un escritor. La etapa la mueve GoHighLevel y se registra sólo con etapa_cambiada (la de datos.etapa), que es lo único que lee negocio.etapas_del_lead.';
comment on column catalogo.tipos_de_evento.esquema_de_datos is
  'JSON Schema de negocio.eventos.datos para este tipo y versión. Es el contrato del escritor: la base NO lo valida al insertar (lo cruzan las pruebas).';
comment on column catalogo.tipos_de_evento.para_la_trayectoria is
  'true = la IA ve los eventos de este tipo en la sección «eventos» de negocio.trayectoria_del_lead (106), ordenados por hora y sin datos de contacto. Que la IA vea un tipo nuevo es un INSERT (o un UPDATE de esta columna), no otra función. etapa_cambiada y salida_marcada van en false: tienen sus propias secciones (etapas, salidas).';

-- ─── Los snapshots y sus mapeos ─────────────────────────────────────────────────

create table if not exists catalogo.snapshots (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null
);
comment on table catalogo.snapshots is 'Los snapshots de GoHighLevel del flujo: S0 Core, S1 Leadflow Call … S6 Contenidos.';

create table if not exists catalogo.snapshot_versiones (
  id            uuid primary key default gen_random_uuid(),
  snapshot      catalogo.clave not null references catalogo.snapshots (clave),
  version       text not null check (version ~ '^v[0-9]+(\.[0-9]+)*$'),
  publicada_el  date not null,
  notas         text,
  unique (snapshot, version)
);
comment on table catalogo.snapshot_versiones is 'Cada versión publicada de un snapshot. La cuenta dice qué versión de S0 tiene instalada.';

-- Qué se puede traducir y a qué. Dos catálogos chicos en vez de dos listas cerradas en un CHECK: un tipo de mapeo o un
-- catálogo de destino nuevo es un INSERT (más, para un destino, su rama en destino_valido).
create table if not exists catalogo.tipos_de_mapeo (
  clave        catalogo.clave primary key,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.tipos_de_mapeo is
  'Qué clase de valor del CRM se traduce: la etapa de un pipeline, una etiqueta, un campo, el valor de un campo, un calendario, una pregunta, la Salida de la oportunidad, la opción de un campo, una palabra clave.';

create table if not exists catalogo.catalogos_mapeables (
  clave        catalogo.clave primary key,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.catalogos_mapeables is
  'A qué catálogo puede apuntar un mapeo (destino_catalogo). «ignorar» = el valor se reconoce y se descarta a propósito.';

-- Qué cita es: el destino del mapeo «calendario» (cada calendario del CRM → un tipo). Un catálogo y no un CHECK en
-- negocio.citas.tipo: un tipo nuevo (una llamada de seguimiento, una de upsell) es un INSERT.
create table if not exists catalogo.tipos_de_cita (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  es_de_venta  boolean not null default false,
  vigente      boolean not null default true
);
comment on table catalogo.tipos_de_cita is
  'Qué cita es (negocio.citas.tipo), según el calendario del CRM mapeado (tipo de mapeo «calendario»): venta, onboarding, coaching u otra. Uno nuevo es un INSERT.';
comment on column catalogo.tipos_de_cita.es_de_venta is
  'true = es una llamada de venta: sólo éstas (o las de tipo todavía desconocido) pueden ser citas calificadas (negocio.citas.calificada). Una de onboarding o de coaching no cuenta en Agendado.';

-- Una clave foránea no puede apuntar a «la tabla que diga otra columna», así que la validación de la clave de destino
-- es una función, usada por el disparador de los dos mapeos (el de snapshot y el de cuenta). Un CHECK que lee otras
-- tablas va contra lo que asume PostgreSQL (un volcado y su restauración pueden fallar): por eso es un disparador.
create or replace function catalogo.destino_valido(p_catalogo text, p_clave text) returns boolean
language sql stable as $$
  select case p_catalogo
    when 'etapas'               then exists (select 1 from catalogo.etapas               where clave = p_clave)
    when 'cuadrantes'           then exists (select 1 from catalogo.cuadrantes           where clave = p_clave)
    when 'preguntas_estandar'   then exists (select 1 from catalogo.preguntas_estandar   where clave = p_clave)
    when 'opciones_de_pregunta' then exists (select 1 from catalogo.opciones_de_pregunta
                                              where pregunta || '.' || clave = p_clave)
    when 'canales'              then exists (select 1 from catalogo.canales              where clave = p_clave)
    when 'fuentes'              then exists (select 1 from catalogo.fuentes              where clave = p_clave)
    when 'motivos'              then exists (select 1 from catalogo.motivos              where clave = p_clave)
    when 'tipos_de_evento'      then exists (select 1 from catalogo.tipos_de_evento      where clave = p_clave)
    when 'salidas'              then exists (select 1 from catalogo.salidas              where clave = p_clave)
    when 'entradas'             then exists (select 1 from catalogo.entradas             where clave = p_clave)
    when 'dolores_comunes'      then exists (select 1 from catalogo.dolores_comunes      where clave = p_clave)
    when 'tipos_de_cita'        then exists (select 1 from catalogo.tipos_de_cita        where clave = p_clave)
    when 'ignorar'              then p_clave is null
    else false
  end
$$;
comment on function catalogo.destino_valido(text, text) is
  'true si la clave existe en el catálogo nombrado. La opción de una pregunta se escribe «pregunta.opcion». "ignorar" = el valor de origen se reconoce y se descarta a propósito (no queda «sin mapear»).';

create or replace function catalogo.exigir_destino_valido() returns trigger
language plpgsql as $$
begin
  -- Un catálogo que no es mapeable lo rechaza su clave foránea (23503), con su nombre; acá sólo la clave de destino.
  if not exists (select 1 from catalogo.catalogos_mapeables where clave = new.destino_catalogo) then
    return new;
  end if;
  if not catalogo.destino_valido(new.destino_catalogo, new.destino_clave) then
    raise exception 'El mapeo de «%» apunta a %.%, que no existe.', new.valor_origen, new.destino_catalogo, coalesce(new.destino_clave, '(nulo)')
      using errcode = '23514';
  end if;
  return new;
end $$;
comment on function catalogo.exigir_destino_valido() is
  'Disparador de los mapeos (catalogo.mapeos_de_snapshot y negocio.mapeos_de_cuenta): rechaza, con 23514, un destino que no existe en su catálogo.';

create table if not exists catalogo.mapeos_de_snapshot (
  snapshot_version_id  uuid not null references catalogo.snapshot_versiones (id),
  tipo                 catalogo.clave not null references catalogo.tipos_de_mapeo (clave),
  campo                text not null default '' check (length(campo) <= 200),
  valor_origen         text not null check (length(valor_origen) between 1 and 300),
  destino_catalogo     catalogo.clave not null references catalogo.catalogos_mapeables (clave),
  destino_clave        text,
  notas                text,
  primary key (snapshot_version_id, tipo, campo, valor_origen)
);
comment on table catalogo.mapeos_de_snapshot is
  'Cómo se traduce lo de una versión de snapshot al idioma común: la etapa «Agendó» del pipeline → etapas.agendado. Se define UNA vez por versión, no por cuenta.';
comment on column catalogo.mapeos_de_snapshot.campo is
  'A qué campo pertenece el valor (el fieldKey del CRM, o el pipeline en una etapa). Vacío = no depende del campo. Dos preguntas con la misma opción «No en este momento» son dos filas.';
comment on column catalogo.mapeos_de_snapshot.valor_origen is 'Lo que manda el CRM tal cual: el nombre de la etapa, la etiqueta, la clave del campo.';
drop trigger if exists mapeos_de_snapshot_destino_valido on catalogo.mapeos_de_snapshot;
create trigger mapeos_de_snapshot_destino_valido before insert or update on catalogo.mapeos_de_snapshot
  for each row execute function catalogo.exigir_destino_valido();

-- ─── Grants: todos leen, nadie más escribe ──────────────────────────────────────

grant usage on schema catalogo to app_inquilino, app_identidad, app_ingesta, app_analista;
grant select on all tables in schema catalogo to app_inquilino, app_identidad, app_ingesta, app_analista;
alter default privileges for role migrador in schema catalogo
  grant select on tables to app_inquilino, app_identidad, app_ingesta, app_analista;

-- ─── Los valores iniciales (idempotentes: `on conflict do nothing`) ─────────────

insert into catalogo.monedas (codigo, nombre, decimales) values
  ('USD', 'Dólar estadounidense', 2), ('EUR', 'Euro', 2), ('MXN', 'Peso mexicano', 2), ('COP', 'Peso colombiano', 0),
  ('PEN', 'Sol peruano', 2), ('CLP', 'Peso chileno', 0), ('ARS', 'Peso argentino', 2), ('BOB', 'Boliviano', 2),
  ('UYU', 'Peso uruguayo', 2), ('PYG', 'Guaraní', 0), ('GTQ', 'Quetzal', 2), ('CRC', 'Colón costarricense', 2),
  ('DOP', 'Peso dominicano', 2), ('HNL', 'Lempira', 2), ('NIO', 'Córdoba', 2), ('PAB', 'Balboa', 2),
  ('VES', 'Bolívar', 2), ('BRL', 'Real', 2)
on conflict do nothing;

insert into catalogo.paises (codigo, nombre, region, moneda, zona_horaria) values
  ('US', 'Estados Unidos', 'norteamerica', 'USD', 'America/New_York'),
  ('MX', 'México', 'norteamerica', 'MXN', 'America/Mexico_City'),
  ('GT', 'Guatemala', 'centroamerica', 'GTQ', 'America/Guatemala'),
  ('SV', 'El Salvador', 'centroamerica', 'USD', 'America/El_Salvador'),
  ('HN', 'Honduras', 'centroamerica', 'HNL', 'America/Tegucigalpa'),
  ('NI', 'Nicaragua', 'centroamerica', 'NIO', 'America/Managua'),
  ('CR', 'Costa Rica', 'centroamerica', 'CRC', 'America/Costa_Rica'),
  ('PA', 'Panamá', 'centroamerica', 'USD', 'America/Panama'),
  ('DO', 'República Dominicana', 'caribe', 'DOP', 'America/Santo_Domingo'),
  ('PR', 'Puerto Rico', 'caribe', 'USD', 'America/Puerto_Rico'),
  ('CO', 'Colombia', 'andina', 'COP', 'America/Bogota'),
  ('VE', 'Venezuela', 'andina', 'VES', 'America/Caracas'),
  ('EC', 'Ecuador', 'andina', 'USD', 'America/Guayaquil'),
  ('PE', 'Perú', 'andina', 'PEN', 'America/Lima'),
  ('BO', 'Bolivia', 'andina', 'BOB', 'America/La_Paz'),
  ('CL', 'Chile', 'cono_sur', 'CLP', 'America/Santiago'),
  ('AR', 'Argentina', 'cono_sur', 'ARS', 'America/Argentina/Buenos_Aires'),
  ('UY', 'Uruguay', 'cono_sur', 'UYU', 'America/Montevideo'),
  ('PY', 'Paraguay', 'cono_sur', 'PYG', 'America/Asuncion'),
  ('BR', 'Brasil', 'cono_sur', 'BRL', 'America/Sao_Paulo'),
  ('ES', 'España', 'iberia', 'EUR', 'Europe/Madrid')
on conflict do nothing;

-- ─── Nichos v1: una primera versión para acordar con el equipo comercial ──────────────────────────────────────────────────

insert into catalogo.nichos (clave, padre, nivel, nombre) values
  ('salud', null, 1, 'Salud'),
  ('estetica_y_belleza', null, 1, 'Estética y belleza'),
  ('inmobiliario', null, 1, 'Inmobiliario'),
  ('servicios_profesionales', null, 1, 'Servicios profesionales'),
  ('educacion_y_formacion', null, 1, 'Educación y formación'),
  ('fitness_y_bienestar', null, 1, 'Fitness y bienestar'),
  ('marketing_y_agencias', null, 1, 'Marketing y agencias'),
  ('comercio', null, 1, 'Comercio'),
  ('hogar_y_construccion', null, 1, 'Hogar y construcción'),
  ('automotriz', null, 1, 'Automotriz'),
  ('finanzas_y_seguros', null, 1, 'Finanzas y seguros'),
  ('otro', null, 1, 'Otro')
on conflict do nothing;

insert into catalogo.nichos (clave, padre, nivel, nombre) values
  ('odontologia', 'salud', 2, 'Odontología'),
  ('cirugia_plastica', 'salud', 2, 'Cirugía plástica'),
  ('psicologia_y_salud_mental', 'salud', 2, 'Psicología y salud mental'),
  ('nutricion', 'salud', 2, 'Nutrición'),
  ('fisioterapia', 'salud', 2, 'Fisioterapia'),
  ('medicina_general_y_especialidades', 'salud', 2, 'Medicina general y especialidades'),
  ('clinicas_esteticas', 'estetica_y_belleza', 2, 'Clínicas estéticas'),
  ('salones_y_spas', 'estetica_y_belleza', 2, 'Salones y spas'),
  ('venta_de_propiedades', 'inmobiliario', 2, 'Venta de propiedades'),
  ('alquileres', 'inmobiliario', 2, 'Alquileres'),
  ('desarrolladoras', 'inmobiliario', 2, 'Desarrolladoras'),
  ('abogados', 'servicios_profesionales', 2, 'Abogados'),
  ('contadores', 'servicios_profesionales', 2, 'Contadores'),
  ('consultores', 'servicios_profesionales', 2, 'Consultores'),
  ('coaches', 'educacion_y_formacion', 2, 'Coaches'),
  ('infoproductos', 'educacion_y_formacion', 2, 'Infoproductos y cursos'),
  ('academias', 'educacion_y_formacion', 2, 'Academias e institutos'),
  ('gimnasios', 'fitness_y_bienestar', 2, 'Gimnasios'),
  ('entrenadores_personales', 'fitness_y_bienestar', 2, 'Entrenadores personales'),
  ('agencias_de_marketing', 'marketing_y_agencias', 2, 'Agencias de marketing'),
  ('freelancers_de_marketing', 'marketing_y_agencias', 2, 'Freelancers de marketing'),
  ('ecommerce', 'comercio', 2, 'E-commerce'),
  ('tiendas_locales', 'comercio', 2, 'Tiendas locales'),
  ('remodelacion', 'hogar_y_construccion', 2, 'Remodelación'),
  ('energia_solar', 'hogar_y_construccion', 2, 'Energía solar'),
  ('concesionarias', 'automotriz', 2, 'Concesionarias'),
  ('talleres', 'automotriz', 2, 'Talleres'),
  ('seguros', 'finanzas_y_seguros', 2, 'Seguros'),
  ('asesores_financieros', 'finanzas_y_seguros', 2, 'Asesores financieros')
on conflict do nothing;

insert into catalogo.nichos (clave, padre, nivel, nombre) values
  ('depilacion_laser', 'clinicas_esteticas', 3, 'Depilación láser'),
  ('medicina_estetica', 'clinicas_esteticas', 3, 'Medicina estética'),
  ('ortodoncia', 'odontologia', 3, 'Ortodoncia'),
  ('implantes_dentales', 'odontologia', 3, 'Implantes dentales')
on conflict do nothing;

insert into catalogo.modelos_de_negocio (clave, nombre, descripcion, ticket_minimo_usd, ticket_maximo_usd) values
  ('high_ticket', 'High ticket', 'Una venta de USD 2.000 o más, con llamada de venta.', 2000, null),
  ('mid_ticket', 'Ticket medio', 'Entre USD 300 y 2.000.', 300, 2000),
  ('low_ticket', 'Low ticket', 'Menos de USD 300; suele cerrarse sin llamada.', 0, 300),
  ('recurrente', 'Recurrente', 'Una suscripción o servicio mensual: el valor está en la permanencia.', null, null),
  ('servicio_local', 'Servicio local', 'Una cita o tratamiento en un lugar físico (clínicas, salones, talleres).', null, null),
  ('ecommerce', 'E-commerce', 'Venta de productos en línea.', null, null)
on conflict do nothing;

-- ─── El viaje del lead ──────────────────────────────────────────────────────────

-- Las 7 del Pipeline Maestro (SOP del 2026-10-22). Las mueve GoHighLevel con sus workflows (PM-01 Entrada, PM-02
-- Avance) y Comando Central registra cada cambio con su hora (etapa_cambiada).
insert into catalogo.etapas (clave, nombre, orden, es_final, descripcion) values
  ('lead', 'Lead', 1, false, 'Entra por cualquier fuente: formulario, Meta Lead Form, primer DM o primer WhatsApp. La pone el workflow PM-01 de GoHighLevel.'),
  ('conversacion', 'Conversación', 2, false, 'El lead responde por primera vez, por cualquier canal. La pone el workflow PM-02 de GoHighLevel.'),
  ('calificado', 'Calificado', 3, false, 'El Lead Scoring lo deja en Prioriza, Valida o Financia. Descarta no avanza: queda en su etapa con Salida = Descarta.'),
  ('agendado', 'Agendado', 4, false, 'Agenda en un calendario de diagnóstico (cita de venta). Si no se presenta y reagenda, sigue en Agendado. Las citas de onboarding no cuentan.'),
  ('asistio', 'Asistió', 5, false, 'Se conecta a la llamada de venta (tag asistio, desde la grabación; el closer sólo corrige).'),
  ('venta', 'Venta', 6, false, 'Paga el total o la entrada completa. Un pago parcial NO es Venta: queda en Asistió con Salida = Adelanto.'),
  ('onboarding', 'Onboarding', 7, true, 'Se hace la llamada de onboarding con el cliente presente, o se agrega el tag onboarding_hecho.')
on conflict do nothing;

-- Sin cuadrante = NULL (sin clasificar): no se siembra una quinta clave para eso.
insert into catalogo.cuadrantes (clave, nombre, encaje, capacidad, sigue_en_seguimiento, orden, descripcion) values
  ('prioriza', 'Prioriza', 'alto', 'alta', true, 1, 'Encaje alto y capacidad alta: es el cliente ideal y puede pagar ahora. Aviso inmediato al closer cuando agenda.'),
  ('valida', 'Valida', 'bajo', 'alta', true, 2, 'Encaje bajo y capacidad alta: puede pagar, pero no es del todo el cliente ideal. La respuesta al video hace de validación.'),
  ('financia', 'Financia', 'alto', 'baja', true, 3, 'Encaje alto y capacidad baja: es el cliente ideal, pero hoy no tiene el dinero. El closer entra con la estructura de pago.'),
  ('descarta', 'Descarta', 'bajo', 'baja', false, 4, 'Encaje bajo y capacidad baja, o cayó en un knockout. No se le ofrece agendar y entra a Nutrición. No avanza de etapa: Salida = Descarta.')
on conflict do nothing;

insert into catalogo.salidas (clave, nombre, entra_a_nutricion, orden, descripcion) values
  ('descarta', 'Descarta', true, 1, 'El Lead Scoring lo clasifica en Descarta (tag descarta).'),
  ('no_show', 'No-show', true, 2, 'No se conectó a la llamada y no reagendó (tag noshow).'),
  ('seguimiento', 'Seguimiento', true, 3, 'En la llamada quedó en pensarlo (tag seguimiento). Entra a Nutrición sólo si no decide en 14 días.'),
  ('adelanto', 'Adelanto', false, 4, 'Pagó una parte; pasa a Venta cuando completa el pago (tag adelanto_ganado).'),
  ('nurture', 'Nurture', true, 5, 'Buen perfil, pero hoy no va a decidir (tag nurture_postcall).'),
  ('descalificado', 'Descalificado', false, 6, 'En la llamada se confirmó que no es el perfil (tag descalificado); la oportunidad se marca perdida.'),
  ('nutricion', 'Nutrición', true, 7, 'No agendó en el Leadflow, o canceló y no reagendó: entró a la etapa Nutrición del pipeline de trabajo.'),
  ('no_rotundo', 'NO rotundo', false, 8, 'Pidió que no le escriban más (tag no_rotundo + DND): sale de todos los flujos y la oportunidad se marca perdida.')
on conflict do nothing;

insert into catalogo.canales (clave, nombre, es_conversacional) values
  ('llamada', 'Llamada de una persona', true), ('voz_ia', 'Agente de voz', true), ('whatsapp', 'WhatsApp', true),
  ('instagram_dm', 'Instagram DM', true), ('facebook_messenger', 'Facebook Messenger', true), ('sms', 'SMS', true),
  ('email', 'Email', true), ('formulario', 'Formulario', false), ('calendario', 'Calendario (agendó solo)', false),
  ('aviso_interno', 'Aviso interno', false), ('sin_dato', 'Sin dato', false)
on conflict do nothing;

insert into catalogo.fuentes (clave, nombre, tipo, plataforma) values
  ('meta_ads', 'Meta Ads', 'pagada', 'meta'), ('tiktok_ads', 'TikTok Ads', 'pagada', 'tiktok'),
  ('google_ads', 'Google Ads', 'pagada', 'google'), ('instagram_organico', 'Instagram orgánico', 'organica', null),
  ('facebook_organico', 'Facebook orgánico', 'organica', null), ('tiktok_organico', 'TikTok orgánico', 'organica', null),
  ('youtube_organico', 'YouTube orgánico', 'organica', null), ('google_organico', 'Google orgánico', 'organica', null),
  ('referido', 'Referido', 'referido', null), ('directo', 'Directo', 'directa', null),
  ('outbound', 'Outbound', 'outbound', null), ('alianza', 'Alianza', 'alianza', null),
  ('otra', 'Otra', 'otra', null), ('sin_dato', 'Sin dato', 'otra', null)
on conflict do nothing;

insert into catalogo.entradas (clave, nombre, canal, descripcion) values
  ('formulario_landing', 'Formulario de la landing', 'formulario', 'Envía el formulario de la landing o del VSL (calendario + formulario de filtro). Se atribuye por FBCLID, email y teléfono.'),
  ('meta_lead_form', 'Meta Lead Form', 'formulario', 'Envía un formulario nativo de Meta Lead Ads. Se atribuye por el Meta Lead ID.'),
  ('ig_comentario', 'Comentario en una publicación', 'instagram_dm', 'Comenta una palabra clave en un post o reel (tag comentarioig); responde el agente CTA.'),
  ('ig_dm_palabra_clave', 'Palabra clave por DM', 'instagram_dm', 'Escribe la palabra clave por DM o respondiendo una historia (tag dm_cta); responde el agente CTA.'),
  ('ig_nuevo_seguidor', 'Nuevo seguidor', 'instagram_dm', 'Sigue la cuenta: ManyChat manda el primer DM y GoHighLevel entra cuando el lead responde (tag ig_nuevo_seguidor).'),
  ('ig_dm_directo', 'DM sin entrada previa', 'instagram_dm', 'Escribe por DM sin ninguno de los tags anteriores (tag ig_general); responde el agente General.'),
  ('whatsapp_directo', 'WhatsApp directo', 'whatsapp', 'Escribe directo por WhatsApp sin llenar el formulario; la IA Setter le hace las preguntas de encaje e inversión antes de ofrecer horarios.'),
  ('llamada_entrante', 'Llamada', 'llamada', 'Entra por una llamada. El SOP la nombra como entrada pero no define su flujo ni su tag.'),
  ('referido', 'Referido', 'sin_dato', 'Lo refiere alguien («referidos y alianzas»). El SOP no define flujo, tag ni canal.'),
  ('outbound', 'Outbound', 'email', 'Un negocio de una lista de prospección (tag outbound) responde con interés a la secuencia de emails (tag outbound_respondio).')
on conflict do nothing;

insert into catalogo.proveedores (clave, nombre) values
  ('ghl', 'GoHighLevel'), ('meta', 'Meta'), ('tiktok', 'TikTok'), ('fathom', 'Fathom'), ('tldv', 'tl;dv'),
  ('landing', 'Landing'), ('n8n', 'n8n'), ('elevenlabs', 'ElevenLabs'), ('comando_central', 'Comando Central'),
  ('manychat', 'ManyChat'), ('pasarela', 'Pasarela de pagos'), ('whatsapp_cloud', 'WhatsApp Cloud'),
  ('apify', 'Apify'), ('manual', 'Carga manual')
on conflict do nothing;

insert into catalogo.tipos_de_mapeo (clave, descripcion) values
  ('etapa_del_pipeline', 'El nombre (o el id) de una etapa de un pipeline del CRM. campo = el pipeline.'),
  ('etiqueta', 'Una etiqueta (tag) del CRM.'),
  ('campo', 'Un campo personalizado del CRM (su fieldKey), que se traduce a una pregunta estándar.'),
  ('valor_de_campo', 'El valor de un campo del CRM. campo = el fieldKey.'),
  ('calendario', 'Un calendario del CRM (su id), que se traduce a un tipo de cita (catalogo.tipos_de_cita: venta, onboarding, coaching).'),
  ('pregunta', 'Una pregunta de un formulario.'),
  ('salida_de_oportunidad', 'El valor del campo Salida de la oportunidad del Pipeline Maestro.'),
  ('opcion_de_campo', 'Una opción de un campo de opciones del CRM. campo = el fieldKey.'),
  ('palabra_clave', 'La palabra clave de un CTA (comentario o DM).')
on conflict do nothing;

insert into catalogo.catalogos_mapeables (clave, descripcion) values
  ('etapas', 'catalogo.etapas'), ('cuadrantes', 'catalogo.cuadrantes'), ('preguntas_estandar', 'catalogo.preguntas_estandar'),
  ('opciones_de_pregunta', 'catalogo.opciones_de_pregunta, con la clave «pregunta.opcion»'),
  ('canales', 'catalogo.canales'), ('fuentes', 'catalogo.fuentes'), ('motivos', 'catalogo.motivos'),
  ('tipos_de_evento', 'catalogo.tipos_de_evento'), ('salidas', 'catalogo.salidas'), ('entradas', 'catalogo.entradas'),
  ('dolores_comunes', 'catalogo.dolores_comunes'), ('tipos_de_cita', 'catalogo.tipos_de_cita (el destino del mapeo «calendario»)'),
  ('ignorar', 'El valor se reconoce y se descarta a propósito: no queda «sin mapear».')
on conflict do nothing;

insert into catalogo.tipos_de_cita (clave, nombre, descripcion, es_de_venta) values
  ('venta', 'Venta', 'La llamada de venta con el closer: la única que cuenta en Agendado y puede ser calificada.', true),
  ('onboarding', 'Onboarding', 'La llamada de onboarding después de la venta.', false),
  ('coaching', 'Coaching', 'Una sesión de coaching con un cliente.', false),
  ('otra', 'Otra', 'Cualquier otra cita del CRM.', false)
on conflict do nothing;

insert into catalogo.dominios_de_evento (clave, nombre, descripcion) values
  ('atribucion', 'Atribución', 'De dónde vino: visitas, clics, formularios, toques.'),
  ('conversacion', 'Conversación', 'Mensajes, aperturas, traspasos y pedidos de no contacto.'),
  ('calificacion', 'Calificación', 'Preguntas respondidas y cuadrantes.'),
  ('pipeline', 'Pipeline Maestro', 'Los cambios de etapa y de Salida que mueve GoHighLevel.'),
  ('agenda', 'Agenda', 'Citas: agendada, confirmada, reagendada, cancelada, asistencia y no-show.'),
  ('llamada', 'Llamadas', 'Llamadas realizadas y analizadas.'),
  ('venta', 'Venta', 'Resultados de la llamada, propuestas y ventas.'),
  ('pago', 'Pagos', 'Lo que entra por la pasarela, total o parcial.'),
  ('onboarding', 'Onboarding', 'La llamada de onboarding y lo que sigue a la venta.'),
  ('nutricion', 'Nutrición', 'La secuencia de Nutrición: entradas, correos, reactivaciones y salidas.'),
  ('contenido', 'Contenido', 'Briefs, piezas aprobadas y publicadas.'),
  ('feedback', 'Feedback', 'Coaching y mensajes del cliente.'),
  ('sistema', 'Sistema', 'Lo que hacen los workflows: etiquetas y automatismos.')
on conflict do nothing;

insert into catalogo.motivos (clave, tipo, nombre) values
  ('ns_olvido', 'no_show', 'Lo olvidó'), ('ns_conflicto_de_horario', 'no_show', 'Conflicto de horario'),
  ('ns_perdio_interes', 'no_show', 'Perdió el interés'), ('ns_no_contesta', 'no_show', 'No contesta'),
  ('ns_otro', 'no_show', 'Otro'),
  ('dq_sin_presupuesto', 'descalificacion', 'Sin presupuesto'), ('dq_fuera_de_icp', 'descalificacion', 'Fuera del ICP'),
  ('dq_no_decide', 'descalificacion', 'No es quien decide'), ('dq_datos_falsos', 'descalificacion', 'Datos falsos'),
  ('dq_otro', 'descalificacion', 'Otro'),
  ('pe_precio', 'perdida', 'Precio'), ('pe_momento', 'perdida', 'No es el momento'), ('pe_decisor', 'perdida', 'Lo tiene que consultar'),
  ('pe_confianza', 'perdida', 'Falta de confianza'), ('pe_encaje', 'perdida', 'No le sirve'),
  ('pe_eligio_otra_opcion', 'perdida', 'Eligió otra opción'), ('pe_otro', 'perdida', 'Otro')
on conflict do nothing;

insert into catalogo.categorias_de_objecion (clave, nombre, descripcion) values
  ('precio', 'Precio', 'El costo, la forma de pago o el retorno de la inversión.'),
  ('momento', 'Momento', 'No es ahora: otras prioridades, esperar resultados, temporada.'),
  ('decisor', 'Decisor', 'Lo tiene que hablar con un socio, la pareja u otra persona.'),
  ('confianza', 'Confianza', 'Duda de que funcione, de la empresa o de los resultados.'),
  ('encaje', 'Encaje', 'Duda de que le sirva a su caso (su nicho, su tamaño, su modelo).'),
  ('otra', 'Otra', 'Lo que no cae en las anteriores.')
on conflict do nothing;

-- Las preguntas del SOP del 2026-10-22: las 12 del formulario (las 6 clases), la respuesta al video y la conexión
-- (confirmación) y la fecha de decisión (post-call). Facturación, ticket e inversión en publicidad son montos en la
-- moneda del prospecto: los tramos de cada cliente se traducen por mapeo.
insert into catalogo.preguntas_estandar (clave, nombre, tipo_de_valor, unidad, descripcion, etapa, clase, eje, vigencia_dias, origen_esperado) values
  ('tipo_de_negocio', 'Tipo de negocio', 'opcion', null, '¿Qué tipo de negocio tienes? Mide si es del nicho y del nivel correcto.', 'calificado', 'identidad', 'encaje', null, 'formulario,agente_dm,agente_whatsapp'),
  ('clientes_activos', 'Clientes activos', 'numero', 'clientes', '¿Cuántos clientes activos tienes?', 'calificado', 'evidencia', 'encaje', null, 'formulario,agente_dm,agente_whatsapp'),
  ('facturacion_mensual', 'Facturación mensual', 'moneda', null, '¿Cuánto factura tu negocio al mes, aproximadamente?', 'calificado', 'evidencia', 'encaje', null, 'formulario,agente_dm,agente_whatsapp'),
  ('ticket_promedio', 'Ticket mensual por cliente', 'moneda', null, '¿Cuánto te deja (o te paga al mes), en promedio, cada cliente?', 'calificado', 'evidencia', 'encaje', null, 'formulario,agente_dm,agente_whatsapp'),
  ('inversion_en_publicidad', 'Inversión actual en publicidad', 'moneda', null, '¿Inviertes hoy en publicidad para conseguir clientes? ¿Cuánto al mes?', 'calificado', 'evidencia', 'encaje', null, 'formulario,agente_dm,agente_whatsapp'),
  ('freno_principal', 'Lo que frena el crecimiento', 'opciones', null, '¿Qué está frenando el crecimiento de tu negocio hoy? Selección múltiple: sus opciones son los dolores comunes.', 'calificado', 'dolor', null, null, 'formulario,agente_dm,agente_whatsapp'),
  ('ejemplo_real', 'Ejemplo real', 'texto', null, 'Elige el problema que más te pesa y cuéntanos un ejemplo real de los últimos 3 meses (abierta).', 'calificado', 'dolor', null, null, 'formulario'),
  ('meta_a_6_meses', 'Meta a 6 meses', 'texto', null, '¿A cuánto quieres llevar tu facturación (o qué quieres lograr) en los próximos 6 meses?', 'calificado', 'evidencia', null, null, 'formulario,agente_dm,agente_whatsapp'),
  ('quien_decide', 'Quién decide', 'opcion', null, '¿Quién decide la contratación de este servicio?', 'calificado', 'decisor', null, null, 'formulario,agente_dm,agente_whatsapp'),
  ('inversion_disponible', 'Inversión disponible este mes', 'opcion', null, 'Si somos una buena opción, ¿estás listo para empezar este mes con la inversión que pedirá el closer?', 'calificado', 'capacidad', 'capacidad', 30, 'formulario,agente_dm,agente_whatsapp'),
  ('compromiso_video', 'Compromiso de ver el video', 'opcion', null, 'Después de agendar recibe un video de 5 minutos: verlo y contar su caso es el requisito para confirmar la llamada.', 'calificado', 'compromiso', null, null, 'formulario'),
  ('perfil_del_negocio', 'Dónde ver el negocio', 'texto', null, '¿Dónde podemos ver tu negocio? (Google Maps, Instagram, web)', 'calificado', 'trazabilidad', null, null, 'formulario'),
  ('respuesta_video', 'Respuesta al video', 'texto', null, '¿Cuál de los problemas del video es el que más te está costando hoy? La respuesta escrita al video previo a la llamada.', 'agendado', 'confirmacion', null, null, 'agente_admisiones,ia_confirmacion'),
  ('conexion_llamada', 'Desde dónde se conecta', 'opcion', null, '¿Me confirmas que te vas a conectar desde tu computadora?', 'agendado', 'confirmacion', null, null, 'agente_admisiones'),
  ('fecha_decision', 'Fecha de decisión', 'fecha', null, 'La fecha de decisión acordada en la llamada de venta.', 'asistio', 'post_call', null, null, 'closer')
on conflict do nothing;

insert into catalogo.opciones_de_pregunta (pregunta, clave, nombre, orden) values
  ('tipo_de_negocio', 'nicho_nivel_correcto', 'Del nicho y del nivel correcto', 1),
  ('tipo_de_negocio', 'nicho_otro_nivel', 'Del nicho, de otro nivel (p. ej., odontología general)', 2),
  ('tipo_de_negocio', 'otro_rubro', 'Otro tipo de negocio', 3),
  ('tipo_de_negocio', 'sin_negocio_propio', 'Aún no tiene negocio propio (knockout)', 4),
  ('freno_principal', 'velocidad_de_respuesta', 'Velocidad de respuesta', 1),
  ('freno_principal', 'ausencias', 'Ausencias', 2),
  ('freno_principal', 'precio_commodity', 'Precio / commodity', 3),
  ('freno_principal', 'dependencia_del_dueno', 'Dependencia del dueño', 4),
  ('freno_principal', 'nicho', 'Nicho', 5),
  ('freno_principal', 'adquisicion', 'Adquisición', 6),
  ('freno_principal', 'retencion', 'Retención', 7),
  ('quien_decide', 'yo_dueno', 'Yo, soy el dueño', 1),
  ('quien_decide', 'con_socio', 'Yo, junto con mi socio', 2),
  ('quien_decide', 'decide_otro', 'Soy gerente o administrador; decide el dueño', 3),
  ('inversion_disponible', 'si_presupuesto_propio', 'Sí, con el presupuesto del negocio (capacidad alta)', 1),
  ('inversion_disponible', 'si_con_financiamiento', 'Sí, con financiamiento (capacidad alta)', 2),
  ('inversion_disponible', 'ver_pago_con_resultados', 'Me interesa, pero necesitaría ver cómo se paga con los resultados (capacidad baja)', 3),
  ('inversion_disponible', 'no_en_este_momento', 'No en este momento (knockout)', 4),
  ('compromiso_video', 'me_comprometo', 'Me comprometo a ver el video y contar mi caso', 1),
  ('compromiso_video', 'no_puedo_comprometerme', 'No puedo comprometerme a verlo (knockout)', 2),
  ('conexion_llamada', 'computadora', 'Computadora (tag compu_confirmada)', 1),
  ('conexion_llamada', 'solo_celular', 'Solo celular (tag solo_celular)', 2)
on conflict do nothing;

-- D10: la lista corta de dolores comunes. Las opciones de freno_principal son estas mismas claves.
insert into catalogo.dolores_comunes (clave, nombre, descripcion, orden) values
  ('velocidad_de_respuesta', 'Velocidad de respuesta', 'Los mensajes o los interesados se responden tarde o quedan sin respuesta, también fuera de horario.', 1),
  ('ausencias', 'Ausencias', 'Agendan la cita o la visita y no llegan.', 2),
  ('precio_commodity', 'Precio / commodity', 'Lo comparan por precio; su servicio se volvió un commodity.', 3),
  ('dependencia_del_dueno', 'Dependencia del dueño', 'El negocio depende del tiempo del dueño; el servicio no está productizado y no escala.', 4),
  ('nicho', 'Nicho', 'Le vende a todo tipo de negocio: le falta un nicho definido.', 5),
  ('adquisicion', 'Adquisición', 'No tiene un sistema para conseguir clientes todos los meses; depende de los referidos.', 6),
  ('retencion', 'Retención', 'Los clientes que ya compraron no vuelven y nadie los contacta.', 7)
on conflict do nothing;

-- ─── El creativo ────────────────────────────────────────────────────────────────

insert into catalogo.dolores_del_creativo (clave, nombre, descripcion) values
  ('leads_que_se_enfrian', 'Leads que se enfrían', 'Le llegan leads y se pierden antes de la llamada.'),
  ('depender_de_referidos', 'Depender de referidos', 'No controla cuántas reuniones de venta tiene al mes.'),
  ('si_paro_la_agencia_para', 'Si paro, la agencia para', 'Vende horas: cada cliente nuevo es más trabajo del dueño.'),
  ('precios_bajos', 'Precios bajos', 'Tickets bajos, en moneda local, con clientes que regatean.'),
  ('agencia_comoditizada', 'Una agencia más', 'Compite por precio porque el prospecto no ve diferencia.')
on conflict do nothing;

insert into catalogo.niveles_de_consciencia (clave, nombre, orden) values
  ('inconsciente', 'Inconsciente', 1), ('consciente_del_problema', 'Consciente del problema', 2),
  ('consciente_de_la_solucion', 'Consciente de la solución', 3), ('consciente_del_producto', 'Consciente del producto', 4),
  ('muy_consciente', 'Muy consciente', 5)
on conflict do nothing;

insert into catalogo.formatos (clave, nombre) values
  ('video_ugc', 'Video UGC'), ('video_del_dueno', 'Video del dueño'), ('vsl', 'VSL'), ('reel', 'Reel'),
  ('carrusel', 'Carrusel'), ('imagen', 'Imagen'), ('historia', 'Historia')
on conflict do nothing;

insert into catalogo.etapas_del_creativo (clave, nombre, orden, descripcion) values
  ('tofu', 'TOFU', 1, 'Audiencia fría: todavía no conoce el problema o la marca.'),
  ('mofu', 'MOFU', 2, 'Audiencia tibia: conoce el problema y evalúa soluciones.'),
  ('bofu', 'BOFU', 3, 'Audiencia caliente: lista para decidir.')
on conflict do nothing;

insert into catalogo.reglas_de_nomenclatura (clave, descripcion, separador, partes, vigente_desde) values
  ('anuncio_v1', '{etapa}_{dolor}_{consciencia}_{formato}_{version}  →  tofu_leads-que-se-enfrian_problema_video-ugc_v3', '_',
   '[{"parte":"etapa","catalogo":"etapas_del_creativo","obligatoria":true},
     {"parte":"dolor","catalogo":"dolores_del_creativo","obligatoria":true},
     {"parte":"consciencia","catalogo":"niveles_de_consciencia","obligatoria":true},
     {"parte":"formato","catalogo":"formatos","obligatoria":true},
     {"parte":"version","catalogo":null,"obligatoria":false}]'::jsonb,
   date '2026-11-01')
on conflict do nothing;

-- ─── Los agentes y los snapshots ────────────────────────────────────────────────

insert into catalogo.departamentos (clave, nombre, descripcion) values
  ('acquisition', 'Acquisition', 'Lo que hoy detecta Comando Central sobre la adquisición.'),
  ('creative', 'Creative', 'Lo que hoy detecta Comando Central sobre los creativos.'),
  ('conversion', 'Conversion', 'Lo que hoy detecta Comando Central sobre la conversión.'),
  ('conversation', 'Conversation', 'Lo que hoy detecta Comando Central sobre las conversaciones.'),
  ('sales', 'Sales', 'Ventas: llamadas, cierre, show-up.'),
  ('reunion', 'Reunión', 'Los temas de la reunión del día.'),
  ('research', 'Research', 'Del flujo: qué dolores y ángulos traen ventas.'),
  ('marketing', 'Marketing', 'Del flujo: anuncios, frecuencia, costo por lead.'),
  ('systems', 'Systems', 'Del flujo: workflows que no se dispararon, integraciones caídas.'),
  ('client_success', 'Client Success', 'Del flujo: la salud de cada agencia cliente.')
on conflict do nothing;

insert into catalogo.snapshots (clave, nombre, descripcion) values
  ('s0_core', 'S0 · Core', 'Campos, custom values, pipeline, calendarios, tags, plantillas, base de conocimiento y la Ficha de Lead.'),
  ('s1_leadflow_call', 'S1 · Leadflow Call', 'Leads de formulario hasta agendar: 5 workflows y el agente de WhatsApp.'),
  ('s2_leadflow_content', 'S2 · Leadflow Content', 'Leads de Instagram hasta agendar: 4 workflows y el agente de DM.'),
  ('s3_appflow', 'S3 · Appflow + Lead scoring', 'Clasificar, recalificar, confirmar y lograr la asistencia: 10 workflows, Recalificador y clasificador.'),
  ('s4_atribucion', 'S4 · Atribución', 'Eventos a Meta y datos de origen: 7 workflows.'),
  ('s5_post_call', 'S5 · Post-call', 'Seguimiento de cierre: 4 workflows y el Redactor post-call.'),
  ('s6_contenidos', 'S6 · Contenidos', 'Piezas nuevas desde las llamadas: 3 workflows y el Creador de contenido.')
on conflict do nothing;

-- ─── Los tipos de evento iniciales, cada uno con el JSON Schema de sus datos ───
--
-- etapa_que_marca es la etapa que el hecho DEBERÍA implicar (una señal esperada para los controles de consistencia):
-- la etapa vigente la mueve GoHighLevel y sólo etapa_cambiada la registra. Ninguno apunta a una etapa inexistente.

insert into catalogo.tipos_de_evento (clave, version, dominio, nombre, descripcion, etapa_que_marca, esquema_de_datos) values
  -- atribución
  ('visita_landing', 1, 'atribucion', 'Visita a la landing', 'El script registró una visita.', null,
   '{"type":"object","required":["visita_id"],"properties":{"visita_id":{"type":"string","format":"uuid"}}}'),
  ('vsl_visto', 1, 'atribucion', 'Vio el VSL', 'Alcanzó un porcentaje del video de ventas.', null,
   '{"type":"object","required":["porcentaje"],"properties":{"porcentaje":{"type":"integer","minimum":0,"maximum":100}}}'),
  ('clic_anuncio', 1, 'atribucion', 'Clic en un anuncio', 'Llegó desde un anuncio.', null,
   '{"type":"object","required":["anuncio_id_externo"],"properties":{"anuncio_id_externo":{"type":"string"},"ubicacion":{"type":"string"}}}'),
  ('formulario_enviado', 1, 'atribucion', 'Envió el formulario', 'Dejó sus datos.', 'lead',
   '{"type":"object","properties":{"formulario_id":{"type":"string"},"pagina":{"type":"string"}}}'),
  ('visitante_unido_a_contacto', 1, 'atribucion', 'Visitante unido', 'El id de visitante quedó unido a un contacto.', null,
   '{"type":"object","required":["visitante_id"],"properties":{"visitante_id":{"type":"string","format":"uuid"}}}'),
  ('entrada_registrada', 1, 'atribucion', 'Entrada registrada', 'Por qué puerta entró el lead (catalogo.entradas), con qué palabra clave y desde qué pieza.', 'lead',
   '{"type":"object","required":["entrada"],"properties":{"entrada":{"type":"string"},"palabra_clave":{"type":["string","null"],"maxLength":100},"pieza_origen":{"type":["string","null"]},"toque_id":{"type":["string","null"],"format":"uuid"},"fuente":{"type":["string","null"]}}}'),
  -- conversación
  ('lead_creado', 1, 'conversacion', 'Lead creado', 'El contacto apareció en el CRM.', 'lead',
   '{"type":"object","properties":{"crm_contacto_id":{"type":"string"}}}'),
  ('apertura_enviada', 1, 'conversacion', 'Apertura enviada', 'El primer mensaje automático al lead: el primer DM de cada entrada, el WhatsApp del minuto 0 o la bienvenida de ManyChat.', null,
   '{"type":"object","properties":{"variante":{"type":"string"},"cta":{"type":"string"},"agente":{"type":"string"},"paso":{"type":"string"}}}'),
  ('mensaje_entrante', 1, 'conversacion', 'Mensaje del lead', 'El lead escribió.', 'conversacion',
   '{"type":"object","required":["mensaje_id"],"properties":{"mensaje_id":{"type":"string","format":"uuid"}}}'),
  ('mensaje_saliente', 1, 'conversacion', 'Mensaje al lead', 'Se le escribió al lead.', null,
   '{"type":"object","required":["mensaje_id"],"properties":{"mensaje_id":{"type":"string","format":"uuid"},"plantilla":{"type":"string"}}}'),
  ('traspaso_a_persona', 1, 'conversacion', 'Pasó a una persona', 'Un agente de IA le pasó la conversación a una persona.', null,
   '{"type":"object","required":["motivo"],"properties":{"motivo":{"enum":["lo_pidio","no_sabe_responder","prioriza_listo","otro"]}}}'),
  ('pidio_no_contacto', 1, 'conversacion', 'Pidió no ser contactado', 'NO rotundo: se detiene todo, en todos los canales. La Salida (no_rotundo) la registra salida_marcada.', null,
   '{"type":"object","properties":{"canal":{"type":"string"}}}'),
  -- calificación
  ('pregunta_respondida', 1, 'calificacion', 'Respondió una pregunta', 'Hay una respuesta estándar nueva.', null,
   '{"type":"object","required":["pregunta","respuesta_id"],"properties":{"pregunta":{"type":"string"},"respuesta_id":{"type":"string","format":"uuid"}}}'),
  ('clasificado', 1, 'calificacion', 'Clasificado', 'El clasificador devolvió un cuadrante (también Descarta, que no avanza de etapa).', null,
   '{"type":"object","required":["cuadrante"],"properties":{"clasificacion_id":{"type":"string","format":"uuid"},"cuadrante":{"type":"string"}}}'),
  ('recalificado', 1, 'calificacion', 'Recalificado', 'Cambió de cuadrante.', null,
   '{"type":"object","required":["cuadrante","cuadrante_anterior"],"properties":{"clasificacion_id":{"type":"string","format":"uuid"},"cuadrante":{"type":"string"},"cuadrante_anterior":{"type":"string"}}}'),
  ('cuadrante_cambiado', 1, 'calificacion', 'Cambió el cuadrante', 'El cuadrante vigente del lead cambió (por primera vez o al recalificar). Lo escribe el disparador de negocio.contactos, con su fila en negocio.clasificaciones.', null,
   '{"type":"object","required":["clasificacion_id","origen"],"properties":{"cuadrante":{"type":["string","null"]},"cuadrante_anterior":{"type":["string","null"]},"clasificacion_id":{"type":"string","format":"uuid"},"origen":{"type":"string"},"primera_vez":{"type":"boolean"}}}'),
  ('calificado', 1, 'calificacion', 'Calificó', 'Quedó en Prioriza, Valida o Financia (Descarta no califica).', 'calificado',
   '{"type":"object","required":["cuadrante"],"properties":{"cuadrante":{"enum":["prioriza","valida","financia"]},"clasificacion_id":{"type":"string","format":"uuid"}}}'),
  -- pipeline: lo que mueve GoHighLevel y Comando Central registra
  ('etapa_cambiada', 1, 'pipeline', 'Cambió la etapa', 'Cambió la etapa del Pipeline Maestro: la mueve un workflow de GoHighLevel y Comando Central la registra con su hora. Es el ÚNICO evento que marca etapa (la de datos.etapa).', null,
   '{"type":"object","required":["etapa"],"properties":{"etapa":{"type":"string"},"etapa_anterior":{"type":["string","null"]},"oportunidad_id_externo":{"type":["string","null"]},"pipeline_id":{"type":["string","null"]},"via":{"enum":["aviso","conciliacion"]},"retrocede":{"type":"boolean"},"tardio":{"type":"boolean"},"etapa_origen":{"type":"string","maxLength":100}}}'),
  ('salida_marcada', 1, 'pipeline', 'Se marcó la Salida', 'Se llenó (o se vació: salida null) el campo Salida de la oportunidad. No cambia la etapa.', null,
   '{"type":"object","required":["salida"],"properties":{"salida":{"type":["string","null"]},"salida_anterior":{"type":["string","null"]},"etapa":{"type":["string","null"]},"tardio":{"type":"boolean"},"oportunidad_id_externo":{"type":["string","null"]},"via":{"enum":["aviso","conciliacion"]},"salida_origen":{"type":"string","maxLength":100}}}'),
  -- agenda
  ('cita_agendada', 1, 'agenda', 'Agendó', 'Tiene una cita (la de venta lleva a Agendado en GoHighLevel). Lo escribe el disparador de negocio.citas, con el tipo de la cita (nulo hasta mapear su calendario) y el calendario.', 'agendado',
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"},"para_el":{"type":"string","format":"date-time"},"reservada_el":{"type":["string","null"],"format":"date-time"},"tipo":{"type":["string","null"]},"ghl_calendario_id":{"type":["string","null"]}}}'),
  ('cita_estado_cambiado', 1, 'agenda', 'Cambió el estado de la cita', 'El estado de la cita en el CRM cambió (confirmed, showed, noshow, cancelled…), con el anterior. Lo escribe el disparador de negocio.citas en cada cambio, sin depender de una lista de estados.', null,
   '{"type":"object","required":["cita_id","estado"],"properties":{"cita_id":{"type":"string","format":"uuid"},"estado":{"type":["string","null"]},"estado_anterior":{"type":["string","null"]}}}'),
  ('cita_confirmada', 1, 'agenda', 'Confirmó', 'Confirmó la cita.', null,
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"}}}'),
  ('respondio_video', 1, 'agenda', 'Respondió al video', 'Contó por escrito su problema después del video previo a la llamada: la cita queda confirmada.', null,
   '{"type":"object","properties":{"cita_id":{"type":"string","format":"uuid"},"mensaje_id":{"type":"string","format":"uuid"},"canal":{"enum":["whatsapp","llamada_ia"]}}}'),
  ('conexion_confirmada', 1, 'agenda', 'Confirmó la conexión', 'Confirmó desde dónde se conecta a la llamada.', null,
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"},"conexion":{"enum":["computadora","solo_celular"]}}}'),
  ('cita_reagendada', 1, 'agenda', 'Reagendó', 'Movió la cita. Lo escribe el disparador de negocio.citas cuando cambia su hora (inicio_el), con la de antes.', null,
   '{"type":"object","required":["cita_id","para_el"],"properties":{"cita_id":{"type":"string","format":"uuid"},"para_el":{"type":"string","format":"date-time"},"antes_para_el":{"type":"string","format":"date-time"}}}'),
  ('cita_cancelada', 1, 'agenda', 'Canceló', 'La cita se cerró sin llamada. Lo escribe el disparador de negocio.citas cuando el estado del CRM pasa a cancelada.', null,
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"},"estado":{"type":"string"},"estado_anterior":{"type":["string","null"]}}}'),
  ('horario_liberado', 1, 'agenda', 'Se liberó el horario', 'A la hora límite no hubo respuesta al video y se liberó el horario.', null,
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"}}}'),
  ('asistio', 1, 'agenda', 'Asistió', 'Se presentó a la llamada de venta. Lo escribe el disparador de negocio.citas cuando una persona marca la asistencia (actor persona) o cuando el estado del CRM pasa a showed (actor sistema, con el estado).', 'asistio',
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"},"estado":{"type":"string"},"estado_anterior":{"type":["string","null"]}}}'),
  ('no_show', 1, 'agenda', 'No se presentó', 'No se presentó a la llamada. Lo escribe el disparador de negocio.citas cuando el estado del CRM pasa a noshow.', null,
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"},"motivo":{"type":"string"},"estado":{"type":"string"},"estado_anterior":{"type":["string","null"]}}}'),
  -- llamadas
  ('llamada_realizada', 1, 'llamada', 'Llamada realizada', 'Se llamó al lead (persona o agente de voz).', null,
   '{"type":"object","required":["llamada_id","contestada"],"properties":{"llamada_id":{"type":"string","format":"uuid"},"contestada":{"type":"boolean"},"tipo":{"type":"string"}}}'),
  ('llamada_analizada', 1, 'llamada', 'Llamada analizada', 'La llamada de venta tiene análisis y objeciones.', null,
   '{"type":"object","required":["llamada_id"],"properties":{"llamada_id":{"type":"string","format":"uuid"},"puntaje":{"type":"integer"}}}'),
  -- venta
  ('resultado_registrado', 1, 'venta', 'Resultado registrado', 'El closer registró el resultado de la llamada.', null,
   '{"type":"object","required":["resultado_id","salida"],"properties":{"resultado_id":{"type":"string","format":"uuid"},"salida":{"type":"string"}}}'),
  ('venta_cerrada', 1, 'venta', 'Venta cerrada', 'Compró.', 'venta',
   '{"type":"object","required":["resultado_id","monto_usd"],"properties":{"resultado_id":{"type":"string","format":"uuid"},"monto_usd":{"type":"number","minimum":0}}}'),
  ('propuesta_enviada', 1, 'venta', 'Propuesta enviada', 'El Redactor post-call o el closer envió la propuesta.', null,
   '{"type":"object","properties":{"canal":{"type":"string"}}}'),
  -- pago
  ('pago_recibido', 1, 'pago', 'Pago recibido', 'Entró un pago.', null,
   '{"type":"object","required":["monto","moneda"],"properties":{"monto":{"type":"number","minimum":0},"moneda":{"type":"string","pattern":"^[A-Z]{3}$"}}}'),
  -- nutrición (sin escritor todavía: el tipo y su esquema quedan listos para cuando se escriba Nutrición)
  ('entro_a_nutricion', 1, 'nutricion', 'Entró a Nutrición', 'Entró a la secuencia de Nutrición con su tag de origen.', null,
   '{"type":"object","required":["origen"],"properties":{"origen":{"enum":["leadflow","appflow","descarta","post_call"]},"paso":{"type":"string"}}}'),
  ('email_enviado', 1, 'nutricion', 'Email enviado', 'Se envió un email de la secuencia o de la newsletter. Las aperturas no cuentan.', null,
   '{"type":"object","properties":{"paso":{"type":"string"},"numero_de_email":{"type":"integer","minimum":1},"version":{"type":"string"}}}'),
  ('reactivado', 1, 'nutricion', 'Reactivado', 'El lead levantó la mano en Nutrición.', null,
   '{"type":"object","required":["senal"],"properties":{"senal":{"enum":["respondio_email","clic_agendar","respondio_whatsapp","dos_clics_en_una_semana","volvio_al_formulario"]}}}'),
  ('salio_de_nutricion', 1, 'nutricion', 'Salió de Nutrición', 'Salió de la secuencia de Nutrición.', null,
   '{"type":"object","required":["motivo"],"properties":{"motivo":{"enum":["agendo","no_rotundo","rebote_duro","sin_senales"]}}}'),
  -- onboarding
  ('onboarding_hecho', 1, 'onboarding', 'Onboarding hecho', 'Se hizo la llamada de onboarding o se agregó el tag onboarding_hecho.', 'onboarding',
   '{"type":"object","properties":{"llamada_id":{"type":"string","format":"uuid"},"fuente":{"enum":["grabacion","tag"]}}}'),
  -- contenido
  ('brief_propuesto', 1, 'contenido', 'Brief propuesto', 'El Analista propuso una pieza.', null,
   '{"type":"object","required":["brief_id"],"properties":{"brief_id":{"type":"string","format":"uuid"}}}'),
  ('pieza_aprobada', 1, 'contenido', 'Pieza aprobada', 'Una persona aprobó una pieza.', null,
   '{"type":"object","required":["pieza_de_contenido_id"],"properties":{"pieza_de_contenido_id":{"type":"string","format":"uuid"}}}'),
  ('pieza_publicada', 1, 'contenido', 'Pieza publicada', 'La pieza salió como orgánico o como anuncio.', null,
   '{"type":"object","required":["pieza_de_contenido_id"],"properties":{"pieza_de_contenido_id":{"type":"string","format":"uuid"},"destino":{"enum":["anuncio","organico"]}}}'),
  -- feedback
  ('sesion_de_coaching', 1, 'feedback', 'Sesión de coaching', 'Hubo una sesión de coaching.', null,
   '{"type":"object","properties":{"llamada_id":{"type":"string","format":"uuid"}}}'),
  ('mensaje_de_slack_relevante', 1, 'feedback', 'Mensaje de Slack', 'Un mensaje del cliente en Slack que el cerebro marcó como relevante.', null,
   '{"type":"object","required":["resumen"],"properties":{"resumen":{"type":"string","maxLength":1000}}}'),
  -- sistema
  ('etiqueta_agregada', 1, 'sistema', 'Etiqueta agregada', 'Un workflow agregó una etiqueta (tag) al lead: es la forma en que los sistemas se hablan en GoHighLevel. Lo escribe el disparador de negocio.contactos; foto_inicial = la tenía antes de la 106.', null,
   '{"type":"object","required":["etiqueta"],"properties":{"etiqueta":{"type":"string","maxLength":200},"foto_inicial":{"type":"boolean"}}}'),
  ('etiqueta_quitada', 1, 'sistema', 'Etiqueta quitada', 'Un workflow quitó una etiqueta (tag) del lead.', null,
   '{"type":"object","required":["etiqueta"],"properties":{"etiqueta":{"type":"string","maxLength":200}}}')
on conflict do nothing;

-- Lo que la IA ve en la trayectoria del lead (la sección «eventos»): los hechos de un lead. Quedan fuera los que no son
-- de un lead (contenido, feedback), el técnico visitante_unido_a_contacto, y etapa_cambiada y salida_marcada, que la
-- trayectoria ya trae enteros en sus secciones. Que la IA vea otro tipo es un UPDATE de esta columna. Sólo toca las
-- filas que acaba de sembrar esta transacción (creado_el = now()): reaplicarla no pisa lo que se cambió después.
update catalogo.tipos_de_evento set para_la_trayectoria = true
 where dominio in ('atribucion', 'conversacion', 'calificacion', 'agenda', 'llamada', 'venta', 'pago', 'nutricion',
                   'onboarding', 'sistema')
   and clave not in ('visitante_unido_a_contacto')
   and creado_el = now();
