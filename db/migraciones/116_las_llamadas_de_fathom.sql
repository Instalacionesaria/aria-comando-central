-- 116 · Las llamadas de Fathom: la recepción de cada grabación que manda su webhook, y el título y los participantes
-- de cada llamada en la familia única (`negocio.llamadas`).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (decisiones del usuario del 2026-11-13; la investigación de Fathom en docs/5-pendiente/prueba-fathom.md)
--
-- Fathom graba las llamadas del equipo EN PARALELO a tl;dv, que sigue igual: esto no toca el analizador, ni sus tablas,
-- ni el CHECK de proveedor de la 056. Cuando una grabación termina de procesarse, Fathom manda UN webhook con la
-- reunión entera (título, título del calendario, invitados con su correo y si son externos, quién grabó y la
-- transcripción). La ruta `app/api/fathom/webhook` lo recibe y:
--
--   · reconoce la LLAMADA DE VENTA por el título: empieza con «HT» (por ejemplo «HT_Juan Pérez - ARIA»). Lo demás
--     (onboarding, coaching, internas) queda sólo acá, como `no_es_venta`, sin transcripción;
--   · busca al LEAD por el correo de un invitado externo, y si ninguno casa, por la ÚNICA cita a ±12 h. Sólo en la
--     subcuenta de ARIA: por ahora es nuestra y de nadie más;
--   · guarda la llamada y su transcripción en la familia única (`negocio.llamadas` + `negocio.transcripciones`, 111 y
--     115), con `tipo = 'venta'` y `proveedor = 'fathom'`. Ahí la leen el expediente y los agentes cuando corren: no
--     se emite ningún evento (la 332), así que no se despierta a nadie.
--
-- UNA TABLA PROPIA Y NO LA BANDEJA DE LA 081. `ingesta.recibidos` es la bandeja prevista para lo crudo de Fathom, pero
-- sólo la ejecuta `ingestor`, que nace sin login, y nada la procesa todavía. Además el usuario decidió NO guardar el
-- JSON crudo: acá queda lo normalizado (títulos, quién grabó, los correos de los participantes, el estado y el motivo),
-- y la transcripción sólo existe si es una venta con lead.
--
-- EL SECRETO DEL WEBHOOK EN EL ENTORNO (`FATHOM_SECRETO_WEBHOOK`), como excepción a ADR-0604. Es un secreto de
-- plataforma de UNA sola empresa (ARIA), no la credencial de un cliente, y valida la firma ANTES de tocar la base: es
-- el mismo razonamiento que la pimienta del aviso del CRM. Cuando la función sea de cada cliente, va cifrado por cuenta.
--
-- EL EFECTO ACEPTADO EN CLOSER. La primera llamada de Fathom en `negocio.llamadas` hace que el ícono de llamadas
-- contestadas de la fila deje de decir «sin datos» en la organización, y la llamada de venta aparece en la pestaña de
-- llamadas de la ficha del lead. El usuario decidió no tocar Closer (2026-11-13).
--
-- Reaplicable: `if not exists` y las restricciones agregadas con su guarda. Sin relleno de filas.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · La recepción de cada grabación ──────────────────────────────────────────

create table if not exists negocio.recepciones_de_fathom (
  org_id                  uuid not null references identidad.organizaciones (id),
  cuenta_id               uuid not null,
  id                      uuid not null default gen_random_uuid(),
  recording_id            bigint not null,
  webhook_id              text check (webhook_id is null or length(webhook_id) <= 300),
  recibido_el             timestamptz not null default now(),
  procesado_el            timestamptz,
  intentos                integer not null default 1 check (intentos >= 1),
  titulo                  text check (titulo is null or length(titulo) <= 1000),
  titulo_del_calendario   text check (titulo_del_calendario is null or length(titulo_del_calendario) <= 1000),
  tipo_de_reunion_fathom  text check (tipo_de_reunion_fathom is null or length(tipo_de_reunion_fathom) <= 300),
  fecha_de_la_reunion     timestamptz,
  duracion_seg            integer check (duracion_seg is null or duracion_seg >= 0),
  url_de_la_grabacion     text check (url_de_la_grabacion is null or length(url_de_la_grabacion) <= 2000),
  idioma                  text check (idioma is null or length(idioma) <= 20),
  grabado_por_email       text check (grabado_por_email is null or length(grabado_por_email) <= 320),
  grabado_por_nombre      text check (grabado_por_nombre is null or length(grabado_por_nombre) <= 300),
  participantes           jsonb not null default '[]'::jsonb,
  correo_del_lead         text check (correo_del_lead is null or length(correo_del_lead) <= 320),
  contacto_id             uuid,
  cita_id                 uuid,
  llamada_id              uuid,
  vinculada_por           text check (vinculada_por is null or vinculada_por in ('correo', 'cita')),
  ambiguo                 boolean not null default false,
  estado                  text not null check (estado in (
                            'guardada', 'no_es_venta', 'sin_correo_externo', 'sin_lead', 'sin_transcripcion', 'error')),
  motivo                  text check (motivo is null or length(motivo) <= 2000),
  primary key (org_id, id),
  constraint recepciones_de_fathom_una_por_grabacion unique (org_id, recording_id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint recepciones_de_fathom_del_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id)
    on delete set null (contacto_id),
  constraint recepciones_de_fathom_de_la_cita
    foreign key (org_id, cuenta_id, cita_id) references negocio.citas (org_id, cuenta_id, id)
    on delete set null (cita_id),
  constraint recepciones_de_fathom_de_la_llamada
    foreign key (org_id, cuenta_id, llamada_id) references negocio.llamadas (org_id, cuenta_id, id)
    on delete set null (llamada_id),
  check (jsonb_typeof(participantes) = 'array'),
  -- Sólo la guardada tiene llamada. Al revés no se exige: si se borra el lead, su llamada se va en cascada (011) y la
  -- recepción queda guardada sin llamada ni contacto, como registro de que llegó.
  check (estado = 'guardada' or llamada_id is null)
);
create index if not exists recepciones_de_fathom_por_contacto
  on negocio.recepciones_de_fathom (org_id, cuenta_id, contacto_id) where contacto_id is not null;
create index if not exists recepciones_de_fathom_por_cita
  on negocio.recepciones_de_fathom (org_id, cuenta_id, cita_id) where cita_id is not null;
create index if not exists recepciones_de_fathom_por_llamada
  on negocio.recepciones_de_fathom (org_id, cuenta_id, llamada_id) where llamada_id is not null;
create index if not exists recepciones_de_fathom_por_estado
  on negocio.recepciones_de_fathom (org_id, cuenta_id, estado, recibido_el desc);

comment on table negocio.recepciones_de_fathom is
  'Cada grabación que mandó el webhook de Fathom (116), sea o no de venta: lo normalizado (sin el JSON crudo ni la transcripción), el estado y el motivo. La de venta con lead además está en negocio.llamadas y negocio.transcripciones.';
comment on column negocio.recepciones_de_fathom.cuenta_id is 'La subcuenta de ARIA (la cuenta por omisión de la organización principal): la función es sólo nuestra por ahora.';
comment on column negocio.recepciones_de_fathom.recording_id is 'El id de la grabación en Fathom. NO es el número del link /calls/…: son identificadores distintos. Es la idempotencia ante los reintentos.';
comment on column negocio.recepciones_de_fathom.webhook_id is 'La cabecera webhook-id del envío: igual entre los reintentos de Fathom.';
comment on column negocio.recepciones_de_fathom.recibido_el is 'Cuándo llegó el primer envío.';
comment on column negocio.recepciones_de_fathom.procesado_el is 'Cuándo se procesó por última vez (un error se reprocesa si Fathom reintenta).';
comment on column negocio.recepciones_de_fathom.intentos is 'Cuántas veces se procesó: sube cuando un envío que había quedado en error vuelve a llegar.';
comment on column negocio.recepciones_de_fathom.titulo is 'El título de la grabación en Fathom (title). Se puede editar en Fathom después, y eso no vuelve a disparar el webhook.';
comment on column negocio.recepciones_de_fathom.titulo_del_calendario is 'El título del evento de calendario (meeting_title). Es el primero que se mira para reconocer la venta (empieza con HT).';
comment on column negocio.recepciones_de_fathom.tipo_de_reunion_fathom is 'El tipo de reunión que asigna Fathom (meeting_type, planes Team). Sólo se guarda; no decide nada.';
comment on column negocio.recepciones_de_fathom.fecha_de_la_reunion is 'Cuándo empezó la grabación (recording_start_time), o la hora agendada si no vino.';
comment on column negocio.recepciones_de_fathom.duracion_seg is 'La duración de la grabación, en segundos.';
comment on column negocio.recepciones_de_fathom.url_de_la_grabacion is 'El enlace para compartir de la grabación (share_url).';
comment on column negocio.recepciones_de_fathom.idioma is 'El idioma de la transcripción según Fathom (transcript_language).';
comment on column negocio.recepciones_de_fathom.grabado_por_email is 'Quién grabó (recorded_by.email): alguien del equipo en Fathom.';
comment on column negocio.recepciones_de_fathom.grabado_por_nombre is 'El nombre de quien grabó.';
comment on column negocio.recepciones_de_fathom.participantes is 'Los participantes: [{nombre, email, externo, del_equipo, hablo}]. «externo» lo dice Fathom; «del_equipo» = no externo o un usuario de la organización; «hablo» = un orador de la transcripción casó con su correo.';
comment on column negocio.recepciones_de_fathom.correo_del_lead is 'El correo con que se encontró al lead, o el primer candidato si no se encontró.';
comment on column negocio.recepciones_de_fathom.contacto_id is 'El lead, si se encontró. Queda aunque la llamada no se guarde (por ejemplo, una que no es de venta).';
comment on column negocio.recepciones_de_fathom.cita_id is 'La única cita del lead a ±12 h de la llamada, si la hay.';
comment on column negocio.recepciones_de_fathom.llamada_id is 'La llamada de negocio.llamadas que se creó. Sólo en las guardadas.';
comment on column negocio.recepciones_de_fathom.vinculada_por is 'Cómo se encontró al lead: correo (un invitado externo) o cita (la única cita a ±12 h, cuando ningún correo casó).';
comment on column negocio.recepciones_de_fathom.ambiguo is 'El correo casó con más de un contacto y ninguna cita desempató: se eligió el de alta más reciente. Para revisar.';
comment on column negocio.recepciones_de_fathom.estado is 'guardada (venta con lead y transcripción), no_es_venta, sin_correo_externo (ni correo ni cita única), sin_lead (había correo y ningún contacto casó, ni cita única), sin_transcripcion o error.';
comment on column negocio.recepciones_de_fathom.motivo is 'El detalle del estado, en castellano. En un error, el mensaje (nunca la transcripción).';
select negocio.aplicar_aislamiento_de_cuenta('negocio.recepciones_de_fathom', true);

-- ─── 2 · El título y los participantes de cada llamada ───────────────────────────
--
-- Sirven para cualquier proveedor, por eso van en la llamada y no sólo en la recepción. Nulos en las de antes.

alter table negocio.llamadas add column if not exists titulo text;
alter table negocio.llamadas add column if not exists participantes jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'llamadas_titulo_acotado') then
    alter table negocio.llamadas add constraint llamadas_titulo_acotado check (titulo is null or length(titulo) <= 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'llamadas_participantes_es_arreglo') then
    alter table negocio.llamadas add constraint llamadas_participantes_es_arreglo
      check (participantes is null or jsonb_typeof(participantes) = 'array');
  end if;
end $$;
comment on column negocio.llamadas.titulo is 'El título de la llamada en su proveedor (116). En Fathom, el del calendario si lo hay; si no, el de la grabación.';
comment on column negocio.llamadas.participantes is 'Quiénes estuvieron (116): [{nombre, email, externo, del_equipo, hablo}]. Nula en las de antes.';
