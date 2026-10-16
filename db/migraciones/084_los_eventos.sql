-- Los eventos: todo lo que le pasa a cada lead, de sólo agregar. Y los mapeos al idioma común, y sus columnas.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (modelo de datos multiempresa, Fase 0 · Paso 6, 2026-10-16)
--
-- Sin historia no se puede medir velocidad, toques ni cambios de cuadrante, ni entrenar el scoring. negocio.eventos
-- guarda cada hecho del lead —de todos los canales, en orden— y no se edita: un hecho que cambia es un evento nuevo.
-- Particionada por mes, con el tipo y la forma de sus datos en el catálogo (079).
--
-- Con ellos llegan los mapeos de cada cuenta al idioma común (lo que se aparta de su snapshot) y la lista de lo que
-- todavía no se traduce; y las columnas estándar de las tablas de hoy (la etapa, el cuadrante, el canal y la fuente
-- en el idioma común), todas nulas: las llena el normalizador (Fase 1).
--
-- Nada escribe en los eventos todavía. Esta migración crea las particiones de los seis meses siguientes; la tarea
-- mensual que crea las demás llega con la Fase 1, junto con lo primero que escriba acá. No puede ser una tarea del
-- cron común: crear una partición exige ser dueño de la tabla madre (el migrador), y el cron corre con los roles de
-- la aplicación. Si llegara un evento sin su partición, cae en la de por omisión y la prueba 257 lo ve.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── Las particiones nacen cerradas ─────────────────────────────────────────────

create or replace function sistema.crear_particiones(p_tabla regclass, p_desde date, p_meses int)
returns int
language plpgsql as $$
declare
  v_esquema  text;
  v_nombre   text;
  v_mes      date := date_trunc('month', p_desde)::date;
  v_creadas  int := 0;
  v_hija     text;
begin
  if p_meses < 1 or p_meses > 36 then
    raise exception 'crear_particiones: p_meses fuera de rango (%)', p_meses;
  end if;
  select n.nspname, c.relname into v_esquema, v_nombre
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.oid = p_tabla and c.relkind = 'p';
  if v_nombre is null then
    raise exception 'crear_particiones: % no es una tabla particionada', p_tabla;
  end if;
  for i in 0 .. p_meses - 1 loop
    v_hija := format('%s_%s', v_nombre, to_char(v_mes + make_interval(months => i), 'YYYY_MM'));
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = v_esquema and c.relname = v_hija) then
      execute format(
        'create table %I.%I partition of %s for values from (%L) to (%L)',
        v_esquema, v_hija, p_tabla,
        (v_mes + make_interval(months => i))::timestamp at time zone 'UTC',
        (v_mes + make_interval(months => i + 1))::timestamp at time zone 'UTC');
      -- Las particiones no se leen nunca directo: todo pasa por la tabla madre, que es la que tiene la política. Pero
      -- una partición NO hereda la RLS de su madre, y en `negocio` la regla de permisos por omisión le da al inquilino
      -- toda tabla nueva del migrador, particiones incluidas: leída directo, mostraría las filas de todas las
      -- organizaciones. Así que nace cerrada: sin ningún permiso para los roles de la aplicación, y con la RLS
      -- encendida y forzada sin política, por si alguien le diera uno. Leída a través de la madre, Postgres aplica las
      -- políticas de la madre y no las de la partición.
      execute format('revoke all on %I.%I from public, app_inquilino, app_identidad, app_ingesta, app_analista', v_esquema, v_hija);
      execute format('alter table %I.%I enable row level security', v_esquema, v_hija);
      execute format('alter table %I.%I force row level security', v_esquema, v_hija);
      v_creadas := v_creadas + 1;
    end if;
  end loop;
  return v_creadas;
end $$;
comment on function sistema.crear_particiones(regclass, date, int) is
  'Crea las particiones mensuales (UTC) que falten de una tabla particionada por rango, cerradas: sin permisos para la aplicación y con la RLS forzada. Idempotente. La corre cada migración que crea una tabla particionada, y desde la Fase 1 una tarea mensual.';

-- ─── Las columnas estándar de las tablas de hoy ─────────────────────────────────

alter table negocio.contactos
  add column if not exists etapa_estandar     catalogo.clave references catalogo.etapas (clave),
  add column if not exists cuadrante          catalogo.clave references catalogo.cuadrantes (clave),
  add column if not exists puntaje            smallint check (puntaje between 0 and 100),
  add column if not exists canal_de_entrada   catalogo.clave references catalogo.canales (clave),
  add column if not exists fuente_estandar    catalogo.clave references catalogo.fuentes (clave),
  add column if not exists primer_toque_id    uuid,
  add column if not exists ultimo_toque_id    uuid,
  add column if not exists no_contactar_desde timestamptz;
comment on column negocio.contactos.etapa_estandar is 'La etapa en el idioma común (catalogo.etapas). La columna etapa sigue siendo la del Pipeline del closer/setter.';
comment on column negocio.contactos.cuadrante is 'El cuadrante VIGENTE; su historia completa está en negocio.clasificaciones.';
comment on column negocio.contactos.puntaje is 'El puntaje vigente de 0 a 100, del último origen que clasificó.';
comment on column negocio.contactos.canal_de_entrada is 'Por dónde entró: formulario, Instagram DM, WhatsApp…';
comment on column negocio.contactos.fuente_estandar is 'De dónde vino, en el idioma común. La columna fuente guarda el texto del CRM tal cual.';
comment on column negocio.contactos.primer_toque_id is 'El primer toque de marketing (negocio.toques). Reemplaza de a poco a atribucion_primera.';
comment on column negocio.contactos.ultimo_toque_id is 'El último toque de marketing antes de convertirse (negocio.toques). Reemplaza de a poco a atribucion_ultima.';
comment on column negocio.contactos.no_contactar_desde is 'Si pidió no ser contactado: desde cuándo. Detiene todo, en todos los canales.';

alter table negocio.citas
  add column if not exists tipo                  text check (tipo in ('venta', 'onboarding', 'coaching', 'otra')),
  add column if not exists cuadrante_al_agendar  catalogo.clave references catalogo.cuadrantes (clave),
  add column if not exists calificada            boolean;
comment on column negocio.citas.tipo is 'Qué cita es, según el calendario mapeado. Nulo en las anteriores al mapeo.';
comment on column negocio.citas.cuadrante_al_agendar is 'El cuadrante que tenía el lead al agendar: el eje de «show-up por cuadrante».';
comment on column negocio.citas.calificada is 'Si es una cita calificada (Prioriza, Valida o Financia al agendar). La métrica estrella del flujo.';

alter table negocio.resultados
  add column if not exists moneda     char(3) references catalogo.monedas (codigo),
  add column if not exists monto_usd  numeric(14, 2) check (monto_usd >= 0),
  add column if not exists motivo     catalogo.clave references catalogo.motivos (clave);
comment on column negocio.resultados.moneda is 'La moneda de monto. Nula en las filas anteriores al modelo multiempresa: se asume la de la cuenta.';
comment on column negocio.resultados.monto_usd is 'monto convertido con el tipo de cambio del día de creado_el. No se recalcula.';
comment on column negocio.resultados.motivo is 'Si no compró: por qué (catalogo.motivos de tipo perdida).';

alter table negocio.mensajes
  add column if not exists canal_estandar catalogo.clave references catalogo.canales (clave);
comment on column negocio.mensajes.canal_estandar is 'El canal en el idioma común. La columna canal guarda el tipo del CRM tal cual.';

alter table negocio.campanas
  add column if not exists plataforma text not null default 'meta' check (plataforma in ('meta', 'tiktok', 'google')),
  add column if not exists funnel     text check (funnel in ('leadform', 'profile', 'booking'));
comment on column negocio.campanas.plataforma is 'Dónde corre la campaña. Hoy todas son de Meta; el nombre meta_campana_id queda por compatibilidad.';
comment on column negocio.campanas.funnel is 'A qué funnel de Acquisition pertenece. Absorbe a negocio.funnels_de_campana, que se retira en la contracción.';
-- campanas.funnel queda nula: copiarla desde funnels_de_campana es escribir filas, y eso no va en una migración. La
-- copia la hace la contracción, que es también cuando funnels_de_campana se retira; hasta entonces manda ésa.

-- ─── Los eventos ────────────────────────────────────────────────────────────────

create table if not exists negocio.eventos (
  org_id         uuid not null references identidad.organizaciones (id),
  cuenta_id      uuid not null,
  id             uuid not null default gen_random_uuid(),
  ocurrio_el     timestamptz not null,
  registrado_el  timestamptz not null default now(),
  tipo           catalogo.clave not null,
  tipo_version   smallint not null default 1,
  contacto_id    uuid,
  visitante_id   uuid,
  canal          catalogo.clave references catalogo.canales (clave),
  actor_tipo     text not null check (actor_tipo in ('lead', 'agente_ia', 'persona', 'sistema')),
  actor_id       text,
  fuente         text not null check (fuente in ('ghl', 'meta', 'tiktok', 'fathom', 'tldv', 'landing', 'n8n', 'elevenlabs', 'comando_central')),
  id_externo     text not null check (length(id_externo) between 1 and 300),
  recibido_id    uuid,
  datos          jsonb not null default '{}'::jsonb,
  primary key (org_id, id, ocurrio_el),
  unique (org_id, cuenta_id, fuente, id_externo, ocurrio_el),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  foreign key (tipo, tipo_version) references catalogo.tipos_de_evento (clave, version),
  check (jsonb_typeof(datos) = 'object' and octet_length(datos::text) <= 65536),
  check (ocurrio_el <= registrado_el + interval '5 minutes')
) partition by range (ocurrio_el);
comment on table negocio.eventos is
  'TODO lo que le pasó a cada lead, en orden y de todos los canales. De sólo agregar: no se edita ni se borra (salvo en cascada, al borrar a la persona). Particionada por mes de ocurrio_el.';
comment on column negocio.eventos.ocurrio_el is 'Cuándo pasó, según la fuente. Puede ser anterior a registrado_el (un aviso que llega tarde) pero no posterior.';
comment on column negocio.eventos.tipo is 'catalogo.tipos_de_evento; con tipo_version dice qué forma tiene datos.';
comment on column negocio.eventos.visitante_id is 'Antes de que el lead deje sus datos, el evento es del visitante; al unirse, sigue así y la identidad los enlaza.';
comment on column negocio.eventos.actor_tipo is 'Quién lo hizo: el lead, un agente de IA, una persona del equipo o el sistema (un workflow).';
comment on column negocio.eventos.actor_id is 'El usuario (uuid) si fue una persona; la clave del agente si fue IA; el workflow si fue el sistema.';
comment on column negocio.eventos.id_externo is 'Idempotencia: el id del proveedor, o «<recibido_id>:<orden>» si sale de un aviso crudo. Reprocesar no duplica.';
comment on column negocio.eventos.datos is 'Lo particular del tipo, validado contra catalogo.tipos_de_evento.esquema_de_datos. Sin textos largos: el mensaje vive en negocio.mensajes y aquí va su id.';
create index if not exists eventos_por_contacto on negocio.eventos (org_id, cuenta_id, contacto_id, ocurrio_el) where contacto_id is not null;
create index if not exists eventos_por_tipo on negocio.eventos (org_id, cuenta_id, tipo, ocurrio_el);
create index if not exists eventos_por_fecha on negocio.eventos using brin (ocurrio_el);
create table if not exists negocio.eventos_resto partition of negocio.eventos default;
comment on table negocio.eventos_resto is 'La partición por omisión: sólo debería tener filas si faltó crear la del mes. La vigila la prueba 257.';
-- Desde el mes en que se aplica, como la bandeja.
select sistema.crear_particiones('negocio.eventos', current_date, 6);

-- ─── Los mapeos propios de cada cuenta, y lo que todavía no se traduce ───────────

create table if not exists negocio.mapeos_de_cuenta (
  org_id            uuid not null references identidad.organizaciones (id),
  cuenta_id         uuid not null,
  tipo              text not null check (tipo in ('etapa_del_pipeline', 'etiqueta', 'campo', 'valor_de_campo', 'calendario', 'pregunta')),
  valor_origen      text not null check (length(valor_origen) between 1 and 300),
  destino_catalogo  text not null check (destino_catalogo in ('etapas', 'cuadrantes', 'preguntas_estandar', 'canales', 'fuentes', 'motivos', 'tipos_de_evento', 'ignorar')),
  destino_clave     text,
  sugerido_por_ia   boolean not null default false,
  creado_por        uuid,
  creado_el         timestamptz not null default now(),
  primary key (org_id, cuenta_id, tipo, valor_origen),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  foreign key (org_id, creado_por) references identidad.usuarios (org_id, id),
  check (catalogo.destino_valido(destino_catalogo, destino_clave))
);
comment on table negocio.mapeos_de_cuenta is
  'Las EXCEPCIONES de una cuenta al mapeo de su snapshot: la agencia que agregó una etapa propia. Gana sobre catalogo.mapeos_de_snapshot.';

create table if not exists negocio.valores_sin_mapear (
  org_id              uuid not null references identidad.organizaciones (id),
  cuenta_id           uuid not null,
  tipo                text not null,
  valor_origen        text not null,
  apariciones         integer not null default 1 check (apariciones >= 1),
  primera_vez_el      timestamptz not null default now(),
  ultima_vez_el       timestamptz not null default now(),
  sugerencia_catalogo text,
  sugerencia_clave    text,
  primary key (org_id, cuenta_id, tipo, valor_origen),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id)
);
comment on table negocio.valores_sin_mapear is
  'Lo que llegó y el idioma común todavía no traduce, con cuántas veces apareció y la sugerencia de la IA. Se vacía al crear el mapeo. Su peso define la cobertura del idioma común en la cuenta.';

-- Y lo mismo, a mano, con las particiones que ya existen: las de la bandeja (081) y las de por omisión.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as esquema, c.relname as tabla
      from pg_inherits i
      join pg_class c on c.oid = i.inhrelid
      join pg_namespace n on n.oid = c.relnamespace
     where i.inhparent in ('ingesta.recibidos'::regclass, 'negocio.eventos'::regclass)
  loop
    execute format('revoke all on %I.%I from public, app_inquilino, app_identidad, app_ingesta, app_analista', r.esquema, r.tabla);
    execute format('alter table %I.%I enable row level security', r.esquema, r.tabla);
    execute format('alter table %I.%I force row level security', r.esquema, r.tabla);
  end loop;
end $$;

-- ─── El aislamiento de lo nuevo ─────────────────────────────────────────────────

-- Una llamada por tabla, nombrada: es lo que el revisor del migrador exige, para que una tabla que se quede afuera no
-- nazca con el permiso por omisión y sin política. El puente completa la cuenta en cada insert, como en las 39.
drop trigger if exists completar_cuenta on negocio.eventos;
create trigger completar_cuenta before insert or update on negocio.eventos
  for each row execute function negocio.completar_cuenta('obligatoria');
select negocio.aplicar_aislamiento_de_cuenta('negocio.eventos', true);

drop trigger if exists completar_cuenta on negocio.mapeos_de_cuenta;
create trigger completar_cuenta before insert or update on negocio.mapeos_de_cuenta
  for each row execute function negocio.completar_cuenta('obligatoria');
select negocio.aplicar_aislamiento_de_cuenta('negocio.mapeos_de_cuenta', true);

drop trigger if exists completar_cuenta on negocio.valores_sin_mapear;
create trigger completar_cuenta before insert or update on negocio.valores_sin_mapear
  for each row execute function negocio.completar_cuenta('obligatoria');
select negocio.aplicar_aislamiento_de_cuenta('negocio.valores_sin_mapear', true);

-- De sólo agregar: un evento no se edita ni se borra. El borrado en cascada al borrar a la persona lo hace la base al
-- borrar el contacto, que sí tiene permiso de delete.
revoke update, delete, truncate on negocio.eventos from app_inquilino;
