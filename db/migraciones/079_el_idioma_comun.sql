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
  'La escalera estándar del lead (la del flujo: Leads › Convo › Califica › Agenda › Asistencia › Venta). Cada etapa de cada pipeline se traduce a una de éstas.';
comment on column catalogo.etapas.orden is 'Posición en el embudo; las finales (perdido) van al final.';

create table if not exists catalogo.cuadrantes (
  clave                 catalogo.clave primary key,
  nombre                text not null,
  encaje                text check (encaje in ('alto', 'bajo')),
  capacidad             text check (capacidad in ('alta', 'baja')),
  sigue_en_seguimiento  boolean not null,
  orden                 smallint not null unique,
  descripcion           text not null,
  check ((encaje is null) = (capacidad is null))
);
comment on table catalogo.cuadrantes is
  'Encaje con el ICP × capacidad de compra: Prioriza, Valida, Financia, Descarta, y Rechazo (sin encaje ni capacidad: falta un dato obligatorio).';
comment on column catalogo.cuadrantes.sigue_en_seguimiento is 'false = sale de toda cadencia para agendar (Descarta y Rechazo van a su ruteo).';

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
  tipo        text not null check (tipo in ('pagada', 'organica', 'referido', 'directa', 'otra')),
  plataforma  text,
  vigente     boolean not null default true
);
comment on table catalogo.fuentes is 'De dónde viene el lead: Meta Ads, TikTok Ads, Instagram orgánico, referido, Google, directo.';
comment on column catalogo.fuentes.plataforma is 'La plataforma publicitaria cuando la fuente es pagada (meta, tiktok, google).';

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
  clave          catalogo.clave primary key,
  nombre         text not null,
  tipo_de_valor  text not null check (tipo_de_valor in ('texto', 'numero', 'moneda', 'opcion', 'opciones')),
  unidad         text,
  descripcion    text not null,
  vigente        boolean not null default true
);
comment on table catalogo.preguntas_estandar is
  'Lo que declara el lead, venga del formulario, del agente de DM, del de voz o del closer: tipo de negocio, clientes, ticket, inversión, meta, decisor.';
comment on column catalogo.preguntas_estandar.tipo_de_valor is 'opcion/opciones = la respuesta es una (o varias) de catalogo.opciones_de_pregunta.';

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

create table if not exists catalogo.dolores (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text,
  vigente      boolean not null default true
);
comment on table catalogo.dolores is 'El dolor que ataca una pieza (leads que se enfrían, depender de referidos…). Se lee del nombre del anuncio.';

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

create table if not exists catalogo.tipos_de_evento (
  clave              catalogo.clave not null,
  version            smallint not null default 1 check (version >= 1),
  dominio            text not null check (dominio in ('atribucion', 'conversacion', 'calificacion', 'agenda', 'llamada', 'venta', 'contenido', 'feedback', 'sistema')),
  nombre             text not null,
  descripcion        text not null,
  etapa_que_marca    catalogo.clave references catalogo.etapas (clave),
  esquema_de_datos   jsonb not null,
  vigente            boolean not null default true,
  creado_el          timestamptz not null default now(),
  primary key (clave, version),
  check (jsonb_typeof(esquema_de_datos) = 'object')
);
comment on table catalogo.tipos_de_evento is
  'Cada evento posible, versionado. Un cambio en la forma de `datos` es una versión nueva; la vieja queda para leer los eventos viejos.';
comment on column catalogo.tipos_de_evento.etapa_que_marca is 'Si el evento hace avanzar al lead a una etapa estándar (cita_agendada → agendado).';
comment on column catalogo.tipos_de_evento.esquema_de_datos is 'JSON Schema de negocio.eventos.datos para este tipo y versión. El normalizador valida contra esto.';

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

-- Qué catálogos puede tener como destino cada tipo de mapeo. Una clave foránea no puede apuntar a «la tabla que
-- diga otra columna», así que la validación es una función, usada por los dos mapeos (el de snapshot y el de cuenta).
create or replace function catalogo.destino_valido(p_catalogo text, p_clave text) returns boolean
language sql stable as $$
  select case p_catalogo
    when 'etapas'             then exists (select 1 from catalogo.etapas             where clave = p_clave)
    when 'cuadrantes'         then exists (select 1 from catalogo.cuadrantes         where clave = p_clave)
    when 'preguntas_estandar' then exists (select 1 from catalogo.preguntas_estandar where clave = p_clave)
    when 'canales'            then exists (select 1 from catalogo.canales            where clave = p_clave)
    when 'fuentes'            then exists (select 1 from catalogo.fuentes            where clave = p_clave)
    when 'motivos'            then exists (select 1 from catalogo.motivos            where clave = p_clave)
    when 'tipos_de_evento'    then exists (select 1 from catalogo.tipos_de_evento    where clave = p_clave)
    when 'ignorar'            then p_clave is null
    else false
  end
$$;
comment on function catalogo.destino_valido(text, text) is
  'true si la clave existe en el catálogo nombrado. "ignorar" = el valor de origen se reconoce y se descarta a propósito (no queda «sin mapear»).';

create table if not exists catalogo.mapeos_de_snapshot (
  snapshot_version_id  uuid not null references catalogo.snapshot_versiones (id),
  tipo                 text not null check (tipo in ('etapa_del_pipeline', 'etiqueta', 'campo', 'valor_de_campo', 'calendario', 'pregunta')),
  valor_origen         text not null check (length(valor_origen) between 1 and 300),
  destino_catalogo     text not null check (destino_catalogo in ('etapas', 'cuadrantes', 'preguntas_estandar', 'canales', 'fuentes', 'motivos', 'tipos_de_evento', 'ignorar')),
  destino_clave        text,
  notas                text,
  primary key (snapshot_version_id, tipo, valor_origen),
  check (catalogo.destino_valido(destino_catalogo, destino_clave))
);
comment on table catalogo.mapeos_de_snapshot is
  'Cómo se traduce lo de una versión de snapshot al idioma común: la etapa «Agendó» del pipeline → etapas.agendado. Se define UNA vez por versión, no por cuenta.';
comment on column catalogo.mapeos_de_snapshot.valor_origen is 'Lo que manda el CRM tal cual: el nombre de la etapa, la etiqueta, la clave del campo.';

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

insert into catalogo.etapas (clave, nombre, orden, es_final, descripcion) values
  ('lead', 'Lead', 1, false, 'Dejó sus datos o escribió por primera vez.'),
  ('conversacion', 'Conversación', 2, false, 'Respondió: hay una conversación en curso.'),
  ('calificado', 'Calificado', 3, false, 'Tiene cuadrante Prioriza, Valida o Financia.'),
  ('agendado', 'Agendado', 4, false, 'Tiene una cita de venta futura.'),
  ('asistio', 'Asistió', 5, false, 'Se presentó a la llamada de venta.'),
  ('venta', 'Venta', 6, true, 'Compró.'),
  ('perdido', 'Perdido', 99, true, 'Salió del embudo sin comprar: descartado, rechazado, no-show sin reagendar o no compró.')
on conflict do nothing;

insert into catalogo.cuadrantes (clave, nombre, encaje, capacidad, sigue_en_seguimiento, orden, descripcion) values
  ('prioriza', 'Prioriza', 'alto', 'alta', true, 1, 'Encaje alto y capacidad alta: se avisa al closer en el momento.'),
  ('valida', 'Valida', 'bajo', 'alta', true, 2, 'Encaje bajo y capacidad alta: hay que validar que el programa le sirve.'),
  ('financia', 'Financia', 'alto', 'baja', true, 3, 'Encaje alto y capacidad baja: candidato a financiamiento o downsell.'),
  ('descarta', 'Descarta', 'bajo', 'baja', false, 4, 'Encaje bajo y capacidad baja: sale del seguimiento para agendar.'),
  ('rechazo', 'Rechazo', null, null, false, 5, 'No se puede clasificar: falta un dato obligatorio (agendó sin responder la pregunta 2).')
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
  ('otra', 'Otra', 'otra', null), ('sin_dato', 'Sin dato', 'otra', null)
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

insert into catalogo.preguntas_estandar (clave, nombre, tipo_de_valor, unidad, descripcion) values
  ('tipo_de_negocio', 'Tipo de negocio', 'opcion', null, 'Qué es su negocio. En el flujo de ARIA, la pregunta 2.'),
  ('clientes_actuales', 'Clientes actuales', 'numero', 'clientes', 'Cuántos clientes atiende hoy.'),
  ('facturacion_mensual', 'Facturación mensual', 'opcion', null, 'En qué tramo factura por mes.'),
  ('ticket_promedio', 'Ticket promedio', 'moneda', null, 'Cuánto cobra por cliente o por venta.'),
  ('inversion_disponible', 'Cómo invertiría', 'opcion', null, 'Si puede invertir y cómo. En el flujo de ARIA, la pregunta 8.'),
  ('meta_a_6_meses', 'Meta a 6 meses', 'texto', null, 'Qué quiere lograr en seis meses, en sus palabras.'),
  ('quien_decide', 'Quién decide', 'opcion', null, 'Si decide solo o con alguien más.'),
  ('cuello_de_botella', 'Cuello de botella', 'texto', null, 'Qué lo frena hoy, en sus palabras.')
on conflict do nothing;

insert into catalogo.opciones_de_pregunta (pregunta, clave, nombre, orden) values
  ('tipo_de_negocio', 'agencia_de_marketing', 'Agencia de marketing', 1),
  ('tipo_de_negocio', 'freelancer', 'Freelancer', 2),
  ('tipo_de_negocio', 'consultor_o_coach', 'Consultor o coach', 3),
  ('tipo_de_negocio', 'negocio_local', 'Negocio local', 4),
  ('tipo_de_negocio', 'otro', 'Otro', 5),
  ('facturacion_mensual', 'menos_de_2k', 'Menos de USD 2.000', 1),
  ('facturacion_mensual', 'de_2k_a_5k', 'USD 2.000 a 5.000', 2),
  ('facturacion_mensual', 'de_5k_a_10k', 'USD 5.000 a 10.000', 3),
  ('facturacion_mensual', 'de_10k_a_20k', 'USD 10.000 a 20.000', 4),
  ('facturacion_mensual', 'mas_de_20k', 'Más de USD 20.000', 5),
  ('inversion_disponible', 'no_puede', 'No puede invertir ahora', 1),
  ('inversion_disponible', 'con_financiamiento', 'Con financiamiento', 2),
  ('inversion_disponible', 'en_cuotas', 'En cuotas', 3),
  ('inversion_disponible', 'de_contado', 'De contado', 4),
  ('quien_decide', 'solo', 'Decide solo', 1),
  ('quien_decide', 'con_socio', 'Con un socio', 2),
  ('quien_decide', 'con_pareja', 'Con su pareja', 3),
  ('quien_decide', 'otro', 'Otra persona', 4)
on conflict do nothing;

-- ─── El creativo ────────────────────────────────────────────────────────────────

insert into catalogo.dolores (clave, nombre, descripcion) values
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
     {"parte":"dolor","catalogo":"dolores","obligatoria":true},
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
  -- conversación
  ('lead_creado', 1, 'conversacion', 'Lead creado', 'El contacto apareció en el CRM.', 'lead',
   '{"type":"object","properties":{"crm_contacto_id":{"type":"string"}}}'),
  ('mensaje_entrante', 1, 'conversacion', 'Mensaje del lead', 'El lead escribió.', 'conversacion',
   '{"type":"object","required":["mensaje_id"],"properties":{"mensaje_id":{"type":"string","format":"uuid"}}}'),
  ('mensaje_saliente', 1, 'conversacion', 'Mensaje al lead', 'Se le escribió al lead.', null,
   '{"type":"object","required":["mensaje_id"],"properties":{"mensaje_id":{"type":"string","format":"uuid"},"plantilla":{"type":"string"}}}'),
  ('traspaso_a_persona', 1, 'conversacion', 'Pasó a una persona', 'Un agente de IA le pasó la conversación a una persona.', null,
   '{"type":"object","required":["motivo"],"properties":{"motivo":{"enum":["lo_pidio","no_sabe_responder","prioriza_listo","otro"]}}}'),
  ('pidio_no_contacto', 1, 'conversacion', 'Pidió no ser contactado', 'Se detiene todo, en todos los canales.', 'perdido',
   '{"type":"object","properties":{}}'),
  -- calificación
  ('pregunta_respondida', 1, 'calificacion', 'Respondió una pregunta', 'Hay una respuesta estándar nueva.', null,
   '{"type":"object","required":["pregunta","respuesta_id"],"properties":{"pregunta":{"type":"string"},"respuesta_id":{"type":"string","format":"uuid"}}}'),
  ('clasificado', 1, 'calificacion', 'Clasificado', 'Recibió un cuadrante por primera vez.', 'calificado',
   '{"type":"object","required":["clasificacion_id","cuadrante"],"properties":{"clasificacion_id":{"type":"string","format":"uuid"},"cuadrante":{"type":"string"}}}'),
  ('recalificado', 1, 'calificacion', 'Recalificado', 'Cambió de cuadrante.', null,
   '{"type":"object","required":["clasificacion_id","cuadrante","cuadrante_anterior"],"properties":{"clasificacion_id":{"type":"string","format":"uuid"},"cuadrante":{"type":"string"},"cuadrante_anterior":{"type":"string"}}}'),
  -- agenda
  ('cita_agendada', 1, 'agenda', 'Agendó', 'Tiene una cita.', 'agendado',
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"},"para_el":{"type":"string","format":"date-time"}}}'),
  ('cita_confirmada', 1, 'agenda', 'Confirmó', 'Confirmó la cita.', null,
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"}}}'),
  ('cita_reagendada', 1, 'agenda', 'Reagendó', 'Movió la cita.', null,
   '{"type":"object","required":["cita_id","para_el"],"properties":{"cita_id":{"type":"string","format":"uuid"},"para_el":{"type":"string","format":"date-time"},"antes_para_el":{"type":"string","format":"date-time"}}}'),
  ('cita_cancelada', 1, 'agenda', 'Canceló', 'Canceló la cita.', null,
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"}}}'),
  ('precall_abierto', 1, 'agenda', 'Abrió el pre-call', 'Abrió el video previo a la llamada.', null,
   '{"type":"object","properties":{"porcentaje":{"type":"integer","minimum":0,"maximum":100}}}'),
  ('asistio', 1, 'agenda', 'Asistió', 'Se presentó a la llamada de venta.', 'asistio',
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"}}}'),
  ('no_show', 1, 'agenda', 'No se presentó', 'No se presentó a la llamada.', null,
   '{"type":"object","required":["cita_id"],"properties":{"cita_id":{"type":"string","format":"uuid"},"motivo":{"type":"string"}}}'),
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
  ('pago_recibido', 1, 'venta', 'Pago recibido', 'Entró un pago.', null,
   '{"type":"object","required":["monto","moneda"],"properties":{"monto":{"type":"number","minimum":0},"moneda":{"type":"string","pattern":"^[A-Z]{3}$"}}}'),
  ('perdido', 1, 'venta', 'Perdido', 'Salió del embudo sin comprar.', 'perdido',
   '{"type":"object","properties":{"motivo":{"type":"string"}}}'),
  -- contenido
  ('brief_propuesto', 1, 'contenido', 'Brief propuesto', 'El Analista propuso una pieza.', null,
   '{"type":"object","required":["brief_id"],"properties":{"brief_id":{"type":"string","format":"uuid"}}}'),
  ('pieza_aprobada', 1, 'contenido', 'Pieza aprobada', 'Una persona aprobó una pieza.', null,
   '{"type":"object","required":["pieza_de_contenido_id"],"properties":{"pieza_de_contenido_id":{"type":"string","format":"uuid"}}}'),
  ('pieza_publicada', 1, 'contenido', 'Pieza publicada', 'La pieza salió como orgánico o como anuncio.', null,
   '{"type":"object","required":["pieza_de_contenido_id"],"properties":{"pieza_de_contenido_id":{"type":"string","format":"uuid"},"destino":{"enum":["anuncio","organico"]}}}'),
  -- feedback
  ('onboarding_hecho', 1, 'feedback', 'Onboarding hecho', 'El cliente completó su onboarding.', null, '{"type":"object","properties":{}}'),
  ('sesion_de_coaching', 1, 'feedback', 'Sesión de coaching', 'Hubo una sesión de coaching.', null,
   '{"type":"object","properties":{"llamada_id":{"type":"string","format":"uuid"}}}'),
  ('mensaje_de_slack_relevante', 1, 'feedback', 'Mensaje de Slack', 'Un mensaje del cliente en Slack que el cerebro marcó como relevante.', null,
   '{"type":"object","required":["resumen"],"properties":{"resumen":{"type":"string","maxLength":1000}}}')
on conflict do nothing;
