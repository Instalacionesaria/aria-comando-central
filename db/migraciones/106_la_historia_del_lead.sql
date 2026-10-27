-- 106 · La historia del lead desde el día 1: cuadrantes, respuestas, toques y citas, con disparadores en la base.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (la revisión para producción, docs/modelo de datos/23-REVISION-PARA-PRODUCCION.md § 4.2, aprobada el
-- 2026-10-27)
--
-- GoHighLevel no guarda la historia de lo que le pasa a un lead: el cuadrante, los campos que respondió y la
-- atribución se PISAN en cada sincronización (contactos.cuadrante, campos_del_crm, atribucion_primera/ultima). Lo que no
-- se grabe desde el despliegue se pierde para siempre. Esta migración, de sólo agregar, guarda cada cambio:
--
--   · negocio.clasificaciones + el evento cuadrante_cambiado: cada cambio del cuadrante vigente;
--   · negocio.respuestas_del_lead: cada campo del CRM que cambia, con su valor y la etapa del lead en ese momento;
--   · negocio.toques_de_marketing: cada atribución nueva (primer y último toque), con sus campos ya separados;
--   · los eventos etiqueta_agregada y etiqueta_quitada: cada etiqueta que aparece o desaparece (varios hechos del
--     flujo —asistió, no-show, onboarding, la entrada— hoy llegan sólo como etiqueta);
--   · en las citas: el cuadrante al agendar y los eventos cita_agendada, cita_estado_cambiado (cada cambio de estado),
--     cita_cancelada, no_show, asistio y cita_reagendada (cada cambio de hora).
--
-- CON DISPARADORES y no en TypeScript, por tres razones medidas: (1) en PostgreSQL 17 (producción) un
-- `insert … on conflict do update` no devuelve el valor viejo, y el `update` masivo de recalcularLosCuadrantes
-- tampoco; (2) el disparador corre en la MISMA transacción que la escritura: si la sincronización se revierte, la
-- historia también; (3) cubre a todos los escritores de hoy y a los que vengan. El precedente es la 047 (los cambios
-- de territorio).
--
-- Reglas de los disparadores: `security invoker` (corren con el rol de quien escribe, bajo su RLS); org_id y cuenta_id
-- explícitos desde NEW (un insert sin ellos no los recibe); ids generados antes de insertar (clasificaciones y eventos
-- se cruzan sin ningún update: las dos son de sólo agregar); y `now()`, no `clock_timestamp()`: la pasada de la
-- sincronización es UNA transacción larga, y el check de eventos (ocurrio_el <= registrado_el + 5 min) haría fallar
-- todo el cron con el reloj de pared. Un historial no puede ser lo que frena la ingesta: nada aquí tiene un check que
-- un dato del CRM pueda violar (los textos se recortan).
--
-- La etapa y la Salida NO van por disparador: las mueve GoHighLevel y llegan por el aviso del CRM
-- (lib/negocio/etapaDelCrm.ts).
--
-- LA FOTO INICIAL. Los contactos que ya existían traen sus campos (039), su atribución (048) y sus etiquetas, y la
-- primera pasada después de subir vuelve a escribir los MISMOS valores: un disparador que mirara sólo «cambió» no
-- guardaría nada de ellos. Por eso `contactos.historia_desde`: nula en las filas de antes de la 106, la fija la
-- primera escritura de cada contacto, y esa escritura guarda primero lo que el contacto YA tenía (una respuesta por
-- campo, sus dos toques, una etiqueta_agregada por etiqueta) con la hora en que se vio (`sincronizado_el`), y después
-- el cambio, si lo hubo. El cuadrante no la necesita: la columna nace nula (105) y su primer valor ya es un cambio,
-- con primera_vez = true y la hora del despliegue («a más tardar»).
--
-- Además: el vínculo de la llamada analizada con el lead, las vistas de etapas, embudo, métricas de Meta y respuestas
-- traducidas a la pregunta estándar, una sola lectura de la trayectoria para la IA (sin teléfono, correo ni texto de
-- mensajes) y el diccionario de los inputs del flujo. Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── Los catálogos de la historia ───────────────────────────────────────────────
-- Lo que el flujo hace crecer (un recolector, un origen o un grano nuevos) es una fila de catálogo con su clave
-- foránea, no un CHECK cerrado: agregarlo después de subir es un INSERT, no un ALTER de una tabla con historia.

create table if not exists catalogo.origenes_de_clasificacion (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.origenes_de_clasificacion is
  'Quién clasificó a un lead (negocio.clasificaciones.origen): el campo del CRM, el clasificador, el recalificador o una persona. Uno nuevo es un INSERT.';
insert into catalogo.origenes_de_clasificacion (clave, nombre, descripcion) values
  ('crm', 'CRM', 'El campo del cuadrante del CRM, leído por la sincronización.'),
  ('clasificador', 'Clasificador', 'El agente que clasifica al lead.'),
  ('recalificador', 'Recalificador', 'El agente que vuelve a clasificarlo.'),
  ('persona', 'Persona', 'Una persona, a mano.')
on conflict do nothing;

create table if not exists catalogo.vias_de_obtencion (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.vias_de_obtencion is
  'Cómo se obtuvo una respuesta del lead (negocio.respuestas_del_lead.obtenida_por): el formulario, un agente, el setter, el closer, el grabador, ManyChat, una importación o el CRM. Una vía nueva (otro agente, el formulario de Meta directo) es un INSERT.';
insert into catalogo.vias_de_obtencion (clave, nombre, descripcion) values
  ('formulario', 'Formulario', 'El formulario de la landing o de Meta.'),
  ('agente_dm', 'Agente de DM', 'El agente de IA de Instagram.'),
  ('agente_whatsapp', 'Agente de WhatsApp', 'El agente de IA de WhatsApp.'),
  ('agente_de_voz', 'Agente de voz', 'El agente de IA que llama.'),
  ('agente_admisiones', 'Agente de admisiones', 'El agente de IA de admisiones.'),
  ('ia_confirmacion', 'IA de confirmación', 'La IA que confirma la cita.'),
  ('setter', 'Setter', 'El setter, una persona.'),
  ('closer', 'Closer', 'El closer, una persona.'),
  ('grabador', 'Grabador', 'El analizador de la grabación de la llamada.'),
  ('manychat', 'ManyChat', 'Un flujo de ManyChat.'),
  ('importacion', 'Importación', 'Una carga masiva.'),
  ('crm', 'CRM', 'Un campo del CRM leído por la sincronización, sin saber quién lo llenó.')
on conflict do nothing;

create table if not exists catalogo.origenes_de_dato (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.origenes_de_dato is
  'De dónde viene un input del flujo (catalogo.inputs_del_flujo.origen): cada proveedor de catalogo.proveedores con su misma clave, más ia (lo juzga un agente), calculado (sale de otros datos) y persona (lo marca alguien a mano). Uno nuevo es un INSERT.';
insert into catalogo.origenes_de_dato (clave, nombre, descripcion)
  select p.clave, p.nombre, 'El proveedor ' || p.nombre || ' (catalogo.proveedores).' from catalogo.proveedores p
on conflict do nothing;
insert into catalogo.origenes_de_dato (clave, nombre, descripcion) values
  ('ia', 'IA', 'Lo juzga un agente de IA.'),
  ('calculado', 'Calculado', 'Sale de otros datos: una cuenta, una división o una moda.'),
  ('persona', 'Persona', 'Lo marca una persona a mano.')
on conflict do nothing;

create table if not exists catalogo.granos (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.granos is
  'De qué es cada valor de un input del flujo (catalogo.inputs_del_flujo.grano): de un lead, una cita, una llamada, un anuncio por día o una cuenta por día. Uno nuevo (un mensaje, una campaña por día) es un INSERT.';
insert into catalogo.granos (clave, nombre, descripcion) values
  ('lead', 'Lead', 'Un valor por lead.'),
  ('cita', 'Cita', 'Un valor por cita.'),
  ('llamada', 'Llamada', 'Un valor por llamada.'),
  ('anuncio_dia', 'Anuncio por día', 'Un valor por anuncio y día.'),
  ('cuenta_dia', 'Cuenta por día', 'Un valor por cuenta y día.')
on conflict do nothing;

-- ─── Las clasificaciones: la historia del cuadrante ─────────────────────────────

create table if not exists negocio.clasificaciones (
  org_id              uuid not null references identidad.organizaciones (id),
  cuenta_id           uuid not null,
  id                  uuid not null default gen_random_uuid(),
  contacto_id         uuid not null,
  cita_id             uuid,
  cuadrante           catalogo.clave references catalogo.cuadrantes (clave),
  cuadrante_anterior  catalogo.clave references catalogo.cuadrantes (clave),
  origen              catalogo.clave not null references catalogo.origenes_de_clasificacion (clave),
  primera_vez         boolean not null default false,
  dolor_principal     catalogo.clave references catalogo.dolores_comunes (clave),
  clasificado_el      timestamptz not null default now(),
  evento_id           uuid,
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint clasificaciones_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint clasificaciones_misma_cuenta_que_la_cita
    foreign key (org_id, cuenta_id, cita_id) references negocio.citas (org_id, cuenta_id, id) on delete set null (cita_id)
);
create index if not exists clasificaciones_por_contacto
  on negocio.clasificaciones (org_id, cuenta_id, contacto_id, clasificado_el desc);
comment on table negocio.clasificaciones is
  'Cada cambio del cuadrante de un lead (106), de sólo agregar: el vigente está en contactos.cuadrante. Hoy la escribe sólo el disparador de contactos (origen crm); los knockouts y juicios del clasificador llegan después como columnas.';
comment on column negocio.clasificaciones.cuenta_id is 'La subcuenta (identidad.cuentas) a la que pertenece la fila: la del contacto.';
comment on column negocio.clasificaciones.cita_id is 'La cita en la que se clasificó, si fue al agendar. Nula en las del CRM.';
comment on column negocio.clasificaciones.cuadrante is 'El cuadrante nuevo. Nulo = el lead quedó sin clasificar (el CRM vació el campo).';
comment on column negocio.clasificaciones.cuadrante_anterior is 'El cuadrante que tenía antes. Nulo = no tenía (o es la primera vez).';
comment on column negocio.clasificaciones.origen is 'Quién lo clasificó (catalogo.origenes_de_clasificacion): crm (el campo del CRM, leído por la sincronización), clasificador, recalificador o persona.';
comment on column negocio.clasificaciones.primera_vez is 'true = la primera clasificación registrada del lead. La primera pasada después del despliegue es la foto inicial: su hora es «a más tardar».';
comment on column negocio.clasificaciones.dolor_principal is 'El dolor principal según el clasificador (catalogo.dolores_comunes). Nulo hasta que el clasificador lo escriba.';
comment on column negocio.clasificaciones.clasificado_el is 'Cuándo se registró el cambio: la hora de la transacción que lo vio (la pasada de la sincronización).';
comment on column negocio.clasificaciones.evento_id is 'El evento cuadrante_cambiado de este cambio. Referencia blanda: la clave de eventos lleva ocurrio_el.';

drop trigger if exists completar_cuenta on negocio.clasificaciones;
create trigger completar_cuenta before insert or update on negocio.clasificaciones
  for each row execute function negocio.completar_cuenta('obligatoria');
select negocio.aplicar_aislamiento_de_cuenta('negocio.clasificaciones', true);
revoke update, delete, truncate on negocio.clasificaciones from app_inquilino;

-- ─── Las respuestas del lead: los campos del CRM, con historia ──────────────────

create table if not exists negocio.respuestas_del_lead (
  org_id          uuid not null references identidad.organizaciones (id),
  cuenta_id       uuid not null,
  id              uuid not null default gen_random_uuid(),
  contacto_id     uuid not null,
  pregunta        catalogo.clave references catalogo.preguntas_estandar (clave),
  origen_clave    text not null check (length(origen_clave) between 1 and 200),
  valor_texto     text check (length(valor_texto) <= 2000),
  valor_numero    numeric(16, 2),
  valor_booleano  boolean,
  valor_fecha     timestamptz,
  moneda          char(3) references catalogo.monedas (codigo),
  opcion          catalogo.clave,
  vaciada         boolean not null default false,
  proveedor       catalogo.clave not null references catalogo.proveedores (clave),
  obtenida_por    catalogo.clave not null references catalogo.vias_de_obtencion (clave),
  etapa           catalogo.clave references catalogo.etapas (clave),
  observada_el    timestamptz not null,
  registrada_el   timestamptz not null default now(),
  recibido_id     uuid,
  evento_id       uuid,
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint respuestas_del_lead_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint respuestas_del_lead_opcion_de_su_pregunta
    foreign key (pregunta, opcion) references catalogo.opciones_de_pregunta (pregunta, clave),
  check (vaciada = (num_nonnulls(valor_texto, valor_numero, valor_booleano, valor_fecha, opcion) = 0)),
  check (moneda is null or valor_numero is not null)
);
create index if not exists respuestas_del_lead_vigentes
  on negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, origen_clave, observada_el desc);
create index if not exists respuestas_del_lead_por_pregunta
  on negocio.respuestas_del_lead (org_id, cuenta_id, pregunta, observada_el) where pregunta is not null;
comment on table negocio.respuestas_del_lead is
  'Lo que declaró cada lead, con historia (106): una fila cada vez que un valor cambia, de sólo agregar. La vigente de cada dato es la más nueva. Hoy la escribe el disparador de contactos.campos_del_crm (un campo del CRM, sin traducir): la pregunta estándar se resuelve al leer, en negocio.respuestas_del_lead_traducidas.';
comment on column negocio.respuestas_del_lead.cuenta_id is 'La subcuenta (identidad.cuentas) a la que pertenece la fila: la del contacto.';
comment on column negocio.respuestas_del_lead.pregunta is 'La pregunta estándar (catalogo.preguntas_estandar) cuando quien escribe ya la sabe (un formulario, un agente). Nula en las del CRM: se sabe origen_clave, y la pregunta la resuelve al leer negocio.respuestas_del_lead_traducidas con el mapeo «campo» (también para las filas viejas).';
comment on column negocio.respuestas_del_lead.origen_clave is 'De dónde salió el dato en su proveedor: el id del campo personalizado de GoHighLevel (negocio.campos_del_crm.campo_id), o el campo de Meta.';
comment on column negocio.respuestas_del_lead.valor_texto is 'El valor tal cual, recortado a 2000 caracteres. Los del CRM llegan siempre como texto.';
comment on column negocio.respuestas_del_lead.valor_numero is 'El valor como número (un conteo, o un monto con su moneda).';
comment on column negocio.respuestas_del_lead.valor_booleano is 'El valor como sí o no.';
comment on column negocio.respuestas_del_lead.valor_fecha is 'El valor como fecha.';
comment on column negocio.respuestas_del_lead.moneda is 'La moneda de valor_numero cuando es un monto.';
comment on column negocio.respuestas_del_lead.opcion is 'La opción elegida (catalogo.opciones_de_pregunta de la pregunta).';
comment on column negocio.respuestas_del_lead.vaciada is 'true = el campo se vació (tenía valor y ya no): la fila no lleva ningún valor. Así «lo borró» no se confunde con «nunca respondió».';
comment on column negocio.respuestas_del_lead.proveedor is 'Qué sistema trajo el dato (catalogo.proveedores).';
comment on column negocio.respuestas_del_lead.obtenida_por is 'Cómo se obtuvo (catalogo.vias_de_obtencion): el formulario, un agente (DM, WhatsApp, voz, admisiones, confirmación), el setter, el closer, el grabador, ManyChat, una importación, o el CRM (un campo leído por la sincronización, sin saber quién lo llenó).';
comment on column negocio.respuestas_del_lead.etapa is 'La etapa estándar del lead cuando se registró (contactos.etapa_estandar). Nula si todavía no tenía.';
comment on column negocio.respuestas_del_lead.observada_el is 'Cuándo se vio el valor: la hora de la transacción que lo leyó. No es cuándo lo respondió el lead (el CRM no lo dice).';
comment on column negocio.respuestas_del_lead.registrada_el is 'Cuándo se insertó la fila.';
comment on column negocio.respuestas_del_lead.recibido_id is 'Lo recibido de donde salió (ingesta.recibidos), si vino por la bandeja. Referencia blanda.';
comment on column negocio.respuestas_del_lead.evento_id is 'El evento que la registró, si hubo. Referencia blanda: la clave de eventos lleva ocurrio_el.';

drop trigger if exists completar_cuenta on negocio.respuestas_del_lead;
create trigger completar_cuenta before insert or update on negocio.respuestas_del_lead
  for each row execute function negocio.completar_cuenta('obligatoria');
select negocio.aplicar_aislamiento_de_cuenta('negocio.respuestas_del_lead', true);
revoke update, delete, truncate on negocio.respuestas_del_lead from app_inquilino;

-- ─── Los toques de marketing ────────────────────────────────────────────────────

create table if not exists negocio.toques_de_marketing (
  org_id               uuid not null references identidad.organizaciones (id),
  cuenta_id            uuid not null,
  id                   uuid not null default gen_random_uuid(),
  contacto_id          uuid,
  visitante_id         uuid,
  posicion             text not null check (posicion in ('primera', 'ultima', 'otra')),
  ocurrio_el           timestamptz not null,
  registrado_el        timestamptz not null default now(),
  entrada              catalogo.clave references catalogo.entradas (clave),
  fuente               catalogo.clave references catalogo.fuentes (clave),
  proveedor            catalogo.clave not null references catalogo.proveedores (clave),
  campana_id_externo   text check (length(campana_id_externo) <= 100),
  conjunto_id_externo  text check (length(conjunto_id_externo) <= 100),
  anuncio_id_externo   text check (length(anuncio_id_externo) <= 100),
  formulario_id        text check (length(formulario_id) <= 200),
  formulario_nombre    text check (length(formulario_nombre) <= 300),
  meta_lead_id         text check (length(meta_lead_id) <= 100),
  fbclid               text check (length(fbclid) <= 500),
  url                  text check (length(url) <= 2000),
  session_source       text check (length(session_source) <= 200),
  utm_source           text check (length(utm_source) <= 300),
  utm_medium           text check (length(utm_medium) <= 300),
  utm_campaign         text check (length(utm_campaign) <= 300),
  utm_content          text check (length(utm_content) <= 300),
  ig_sid               text check (length(ig_sid) <= 100),
  palabra_clave        text check (length(palabra_clave) <= 100),
  pieza_origen         text check (length(pieza_origen) <= 300),
  datos                jsonb not null default '{}'::jsonb,
  primary key (org_id, id),
  constraint toques_de_marketing_cuenta_id_unico unique (org_id, cuenta_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint toques_de_marketing_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  check (contacto_id is not null or visitante_id is not null),
  check (jsonb_typeof(datos) = 'object' and octet_length(datos::text) <= 65536)
);
create index if not exists toques_de_marketing_por_contacto
  on negocio.toques_de_marketing (org_id, cuenta_id, contacto_id, ocurrio_el) where contacto_id is not null;
create index if not exists toques_de_marketing_por_anuncio
  on negocio.toques_de_marketing (org_id, cuenta_id, anuncio_id_externo) where anuncio_id_externo is not null;
comment on table negocio.toques_de_marketing is
  'Cada toque de marketing de un lead (106), de sólo agregar: de dónde llegó, con los campos de la atribución ya separados. Hoy la escribe el disparador de contactos.atribucion_primera y atribucion_ultima, una fila cada vez que cambian.';
comment on column negocio.toques_de_marketing.cuenta_id is 'La subcuenta (identidad.cuentas) a la que pertenece la fila: la del contacto.';
comment on column negocio.toques_de_marketing.contacto_id is 'El lead. Nulo = todavía es un visitante (visitante_id).';
comment on column negocio.toques_de_marketing.visitante_id is 'El visitante de la landing antes de dejar sus datos.';
comment on column negocio.toques_de_marketing.posicion is 'Qué atribución del CRM es: primera (attributionSource), ultima (lastAttributionSource) u otra.';
comment on column negocio.toques_de_marketing.ocurrio_el is 'Cuándo fue el toque: el alta en el CRM para la primera atribución, y la hora en que se vio para la última.';
comment on column negocio.toques_de_marketing.registrado_el is 'Cuándo se insertó la fila.';
comment on column negocio.toques_de_marketing.entrada is 'Por qué puerta entró (catalogo.entradas), si se sabe. Nula hasta que un mapeo la traduzca.';
comment on column negocio.toques_de_marketing.fuente is 'El origen de marketing (catalogo.fuentes), si se sabe. Nulo hasta que un mapeo lo traduzca.';
comment on column negocio.toques_de_marketing.proveedor is 'Qué sistema mandó la atribución (catalogo.proveedores): ghl para la del CRM.';
comment on column negocio.toques_de_marketing.campana_id_externo is 'El id de la campaña de Meta (campaignId).';
comment on column negocio.toques_de_marketing.conjunto_id_externo is 'El id del conjunto de anuncios de Meta (utmTerm, el mismo de negocio.conjuntos_de_anuncios).';
comment on column negocio.toques_de_marketing.anuncio_id_externo is 'El id del anuncio de Meta (adId).';
comment on column negocio.toques_de_marketing.formulario_id is 'El id del formulario (formId), si la atribución lo trae.';
comment on column negocio.toques_de_marketing.formulario_nombre is 'El nombre del formulario (formName), si la atribución lo trae.';
comment on column negocio.toques_de_marketing.meta_lead_id is 'El Meta Lead ID del Lead Form, si la atribución lo trae (hoy suele llegar como campo del CRM).';
comment on column negocio.toques_de_marketing.fbclid is 'El fbclid del clic. Identifica el navegador: no se muestra ni sale en la trayectoria.';
comment on column negocio.toques_de_marketing.url is 'La URL de la landing. Puede llevar identificadores: no se muestra ni sale en la trayectoria.';
comment on column negocio.toques_de_marketing.session_source is 'El sessionSource del CRM (Paid Social, Direct traffic…).';
comment on column negocio.toques_de_marketing.utm_source is 'utmSource.';
comment on column negocio.toques_de_marketing.utm_medium is 'utmMedium.';
comment on column negocio.toques_de_marketing.utm_campaign is 'utmCampaign, o campaign (el nombre de la campaña) si no viene.';
comment on column negocio.toques_de_marketing.utm_content is 'utmContent (el nombre del anuncio).';
comment on column negocio.toques_de_marketing.ig_sid is 'El IGSID (mediumId) cuando la atribución es de Instagram. Sin verificar contra el CRM: el mediumId de un formulario o del calendario es otra cosa.';
comment on column negocio.toques_de_marketing.palabra_clave is 'La palabra clave del CTA, si se sabe.';
comment on column negocio.toques_de_marketing.pieza_origen is 'La publicación de donde vino (la pieza de contenido o el post), si se sabe.';
comment on column negocio.toques_de_marketing.datos is 'La atribución cruda tal como la mandó el proveedor (hasta 64 KB). Puede tener ip o userAgent: no se muestra.';

drop trigger if exists completar_cuenta on negocio.toques_de_marketing;
create trigger completar_cuenta before insert or update on negocio.toques_de_marketing
  for each row execute function negocio.completar_cuenta('obligatoria');
select negocio.aplicar_aislamiento_de_cuenta('negocio.toques_de_marketing', true);
revoke update, delete, truncate on negocio.toques_de_marketing from app_inquilino;

-- El primer y el último toque del lead, con su clave foránea (reemplazan a los primer_toque_id/ultimo_toque_id que la
-- 084 declaraba sin tabla). `set null` SÓLO de la columna: org_id y cuenta_id no admiten nulos.
alter table negocio.contactos
  add column if not exists primer_toque_de_marketing_id uuid,
  add column if not exists ultimo_toque_de_marketing_id uuid;
comment on column negocio.contactos.primer_toque_de_marketing_id is 'El toque de su primera atribución (negocio.toques_de_marketing). Lo pone el disparador de la atribución.';
comment on column negocio.contactos.ultimo_toque_de_marketing_id is 'El toque de su última atribución (negocio.toques_de_marketing). Lo pone el disparador de la atribución.';
alter table negocio.contactos drop constraint if exists contactos_primer_toque_de_marketing;
alter table negocio.contactos add constraint contactos_primer_toque_de_marketing
  foreign key (org_id, cuenta_id, primer_toque_de_marketing_id)
  references negocio.toques_de_marketing (org_id, cuenta_id, id) on delete set null (primer_toque_de_marketing_id);
alter table negocio.contactos drop constraint if exists contactos_ultimo_toque_de_marketing;
alter table negocio.contactos add constraint contactos_ultimo_toque_de_marketing
  foreign key (org_id, cuenta_id, ultimo_toque_de_marketing_id)
  references negocio.toques_de_marketing (org_id, cuenta_id, id) on delete set null (ultimo_toque_de_marketing_id);

-- Desde cuándo se guarda la historia de cada contacto: la marca de la foto inicial (el encabezado). Se agrega SIN
-- default, para que las filas que ya existían queden nulas; el default va después y sólo lo reciben las altas nuevas.
alter table negocio.contactos add column if not exists historia_desde timestamptz;
alter table negocio.contactos alter column historia_desde set default now();
comment on column negocio.contactos.historia_desde is
  'Desde cuándo se guarda la historia de este contacto (106). Nula = es de antes de la 106 y todavía no se volvió a escribir: su primera escritura guarda primero lo que ya tenía (campos, atribución, etiquetas) y la fija.';

create or replace function negocio.fijar_historia_desde() returns trigger
language plpgsql as $$
begin
  new.historia_desde := now();
  return new;
end $$;
comment on function negocio.fijar_historia_desde() is
  'Disparador de negocio.contactos (antes de actualizar, sólo si historia_desde es nula): la primera escritura de un contacto de antes de la 106 fija desde cuándo se guarda su historia.';
drop trigger if exists contactos_fija_la_historia_desde on negocio.contactos;
create trigger contactos_fija_la_historia_desde before update on negocio.contactos
  for each row when (old.historia_desde is null)
  execute function negocio.fijar_historia_desde();

-- ─── La llamada analizada, unida al lead ─────────────────────────────────────────

alter table negocio.analizador_llamadas
  add column if not exists contacto_id    uuid,
  add column if not exists cita_id        uuid,
  add column if not exists vinculado_por  text check (vinculado_por in ('correo', 'cita', 'persona')),
  add column if not exists vinculado_el   timestamptz;
comment on column negocio.analizador_llamadas.contacto_id is 'El lead de la llamada (negocio.contactos). Nulo = todavía sin vincular. Exige cuenta_id: la llamada queda en la cuenta del lead.';
comment on column negocio.analizador_llamadas.cita_id is 'La cita de la llamada (negocio.citas), si se sabe.';
comment on column negocio.analizador_llamadas.vinculado_por is 'Cómo se unió al lead: por correo, por la cita o a mano (persona).';
comment on column negocio.analizador_llamadas.vinculado_el is 'Cuándo se unió al lead.';
-- La cuenta es nulable acá (una llamada de la propia agencia), y una clave compuesta con un nulo no comprueba nada
-- (MATCH SIMPLE): por eso vincular exige la cuenta, y con ella la clave compara el contacto contra SU cuenta.
alter table negocio.analizador_llamadas drop constraint if exists analizador_llamadas_vinculo_con_cuenta;
alter table negocio.analizador_llamadas add constraint analizador_llamadas_vinculo_con_cuenta
  check ((contacto_id is null and cita_id is null) or cuenta_id is not null);
alter table negocio.analizador_llamadas drop constraint if exists analizador_llamadas_vinculo_fechado;
alter table negocio.analizador_llamadas add constraint analizador_llamadas_vinculo_fechado
  check ((vinculado_por is null) = (vinculado_el is null));
alter table negocio.analizador_llamadas drop constraint if exists analizador_llamadas_misma_cuenta_que_el_contacto;
alter table negocio.analizador_llamadas add constraint analizador_llamadas_misma_cuenta_que_el_contacto
  foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete set null (contacto_id);
alter table negocio.analizador_llamadas drop constraint if exists analizador_llamadas_misma_cuenta_que_la_cita;
alter table negocio.analizador_llamadas add constraint analizador_llamadas_misma_cuenta_que_la_cita
  foreign key (org_id, cuenta_id, cita_id) references negocio.citas (org_id, cuenta_id, id) on delete set null (cita_id);
create index if not exists analizador_llamadas_por_contacto
  on negocio.analizador_llamadas (org_id, cuenta_id, contacto_id) where contacto_id is not null;

-- ─── El disparador del cuadrante ────────────────────────────────────────────────

create or replace function negocio.registrar_cambio_de_cuadrante() returns trigger
language plpgsql as $$
declare
  v_anterior       text;
  v_clasificacion  uuid := gen_random_uuid();
  v_evento         uuid := gen_random_uuid();
  v_primera        boolean;
begin
  -- En un INSERT, `old` no está asignado: se decide en plpgsql, como en la 047.
  if tg_op = 'UPDATE' then
    v_anterior := old.cuadrante;
  end if;
  -- Con la cuenta: es el prefijo del índice (org_id, cuenta_id, contacto_id…). Sin ella, PostgreSQL 17 no tiene skip
  -- scan y recorre todas las clasificaciones de la organización en cada cambio.
  v_primera := not exists (select 1 from negocio.clasificaciones k
                            where k.org_id = new.org_id and k.cuenta_id = new.cuenta_id and k.contacto_id = new.id);
  insert into negocio.clasificaciones (org_id, cuenta_id, id, contacto_id, cuadrante, cuadrante_anterior, origen,
                                       primera_vez, clasificado_el, evento_id)
  values (new.org_id, new.cuenta_id, v_clasificacion, new.id, new.cuadrante, v_anterior, 'crm', v_primera, now(), v_evento);
  insert into negocio.eventos (org_id, cuenta_id, id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                               id_externo, datos)
  values (new.org_id, new.cuenta_id, v_evento, now(), 'cuadrante_cambiado', 1, new.id, 'sistema', 'ghl',
          'cuadrante:' || v_clasificacion,
          jsonb_build_object('cuadrante', new.cuadrante, 'cuadrante_anterior', v_anterior,
                             'clasificacion_id', v_clasificacion, 'origen', 'crm', 'primera_vez', v_primera))
  on conflict do nothing;
  return null;
end $$;
comment on function negocio.registrar_cambio_de_cuadrante() is
  'Disparador de negocio.contactos: cada cambio de cuadrante (también el alta con cuadrante, y el que lo vacía) deja una fila en negocio.clasificaciones y un evento cuadrante_cambiado, en la misma transacción.';
drop trigger if exists contactos_registra_el_cuadrante_del_alta on negocio.contactos;
create trigger contactos_registra_el_cuadrante_del_alta after insert on negocio.contactos
  for each row when (new.cuadrante is not null)
  execute function negocio.registrar_cambio_de_cuadrante();
drop trigger if exists contactos_registra_el_cuadrante on negocio.contactos;
create trigger contactos_registra_el_cuadrante after update of cuadrante on negocio.contactos
  for each row when (old.cuadrante is distinct from new.cuadrante)
  execute function negocio.registrar_cambio_de_cuadrante();

-- ─── El disparador de las respuestas (los campos del CRM) ───────────────────────

create or replace function negocio.registrar_respuestas_del_crm() returns trigger
language plpgsql as $$
declare
  v_viejo  jsonb := '{}'::jsonb;
  v_nuevo  jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(new.campos_del_crm) = 'object' then
    v_nuevo := new.campos_del_crm;
  end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.campos_del_crm) = 'object' then
    v_viejo := old.campos_del_crm;
  end if;
  -- La foto inicial de un contacto de antes de la 106: lo que ya tenía, con la hora en que se vio (siempre antes que
  -- el cambio de esta misma escritura, para que la vigente sea la más nueva).
  if tg_op = 'UPDATE' and old.historia_desde is null then
    insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, origen_clave, valor_texto, vaciada,
                                             proveedor, obtenida_por, etapa, observada_el)
    select new.org_id, new.cuenta_id, new.id, left(o.key, 200), left(nullif(btrim(o.value), ''), 2000), false,
           'ghl', 'crm', old.etapa_estandar,
           least(coalesce(old.sincronizado_el, old.creado_el), now() - interval '1 millisecond')
      from jsonb_each_text(v_viejo) o
     where btrim(o.key) <> '' and nullif(btrim(o.value), '') is not null;
  end if;
  -- Un campo que pasa a vacío (o desaparece) es una fila vaciada; uno que sigue igual no deja nada.
  insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, origen_clave, valor_texto, vaciada,
                                           proveedor, obtenida_por, etapa, observada_el)
  select new.org_id, new.cuenta_id, new.id, left(x.campo, 200), left(x.nuevo, 2000), x.nuevo is null,
         'ghl', 'crm', new.etapa_estandar, now()
    from (select coalesce(n.key, o.key) as campo,
                 nullif(btrim(n.value), '') as nuevo,
                 nullif(btrim(o.value), '') as viejo
            from jsonb_each_text(v_nuevo) n
            full join jsonb_each_text(v_viejo) o on o.key = n.key) x
   where btrim(x.campo) <> '' and x.nuevo is distinct from x.viejo;
  return null;
end $$;
comment on function negocio.registrar_respuestas_del_crm() is
  'Disparador de negocio.contactos: por cada campo de campos_del_crm cuyo valor cambió (o se vació), una fila en negocio.respuestas_del_lead, sin pregunta (la resuelve al leer negocio.respuestas_del_lead_traducidas). En la primera escritura de un contacto de antes de la 106, antes guarda los que ya tenía.';
drop trigger if exists contactos_registra_las_respuestas_del_alta on negocio.contactos;
create trigger contactos_registra_las_respuestas_del_alta after insert on negocio.contactos
  for each row when (new.campos_del_crm <> '{}'::jsonb)
  execute function negocio.registrar_respuestas_del_crm();
-- Sin lista de columnas: la primera escritura de un contacto de antes de la 106 toma su foto aunque no traiga campos.
drop trigger if exists contactos_registra_las_respuestas on negocio.contactos;
create trigger contactos_registra_las_respuestas after update on negocio.contactos
  for each row when (old.campos_del_crm is distinct from new.campos_del_crm or old.historia_desde is null)
  execute function negocio.registrar_respuestas_del_crm();

-- ─── El disparador de los toques (la atribución del CRM) ────────────────────────

-- Separa una atribución del CRM en sus campos y la guarda como un toque. Devuelve su id. Las claves son las que manda
-- GoHighLevel (lib/ghl/cliente.ts, atribucionDelContacto): todo se recorta, para que un valor raro no frene la ingesta.
create or replace function negocio.registrar_toque(
  p_org        uuid,
  p_cuenta     uuid,
  p_contacto   uuid,
  p_posicion   text,
  p_a          jsonb,
  p_ocurrio    timestamptz
) returns uuid
language plpgsql as $$
declare
  v_id  uuid := gen_random_uuid();
begin
  insert into negocio.toques_de_marketing (
    org_id, cuenta_id, id, contacto_id, posicion, ocurrio_el, proveedor,
    campana_id_externo, conjunto_id_externo, anuncio_id_externo, formulario_id, formulario_nombre, meta_lead_id,
    fbclid, url, session_source, utm_source, utm_medium, utm_campaign, utm_content, ig_sid, datos)
  values (
    p_org, p_cuenta, v_id, p_contacto, p_posicion, p_ocurrio, 'ghl',
    left(p_a ->> 'campaignId', 100),
    left(p_a ->> 'utmTerm', 100),
    left(p_a ->> 'adId', 100),
    left(p_a ->> 'formId', 200),
    left(p_a ->> 'formName', 300),
    left(p_a ->> 'metaLeadId', 100),
    left(p_a ->> 'fbclid', 500),
    left(p_a ->> 'url', 2000),
    left(p_a ->> 'sessionSource', 200),
    left(p_a ->> 'utmSource', 300),
    left(p_a ->> 'utmMedium', 300),
    left(coalesce(p_a ->> 'utmCampaign', p_a ->> 'campaign'), 300),
    left(p_a ->> 'utmContent', 300),
    case when coalesce(p_a ->> 'medium', '') || ' ' || coalesce(p_a ->> 'sessionSource', '') ilike '%instagram%'
         then left(p_a ->> 'mediumId', 100) end,
    case when octet_length(p_a::text) <= 65536 then p_a else '{}'::jsonb end);
  return v_id;
end $$;
comment on function negocio.registrar_toque(uuid, uuid, uuid, text, jsonb, timestamptz) is
  'Guarda una atribución del CRM como un toque de marketing, con sus campos separados, y devuelve su id. La usa el disparador de la atribución de negocio.contactos.';

create or replace function negocio.registrar_toques_del_crm() returns trigger
language plpgsql as $$
declare
  v_primero  uuid;
  v_ultimo   uuid;
begin
  -- La foto inicial de un contacto de antes de la 106: las atribuciones que ya tenía. La primera, con su alta en el
  -- CRM; la última, con la hora en que se vio (antes que un cambio de esta misma escritura).
  if tg_op = 'UPDATE' and old.historia_desde is null then
    if old.atribucion_primera is not null and old.atribucion_primera <> '{}'::jsonb
       and jsonb_typeof(old.atribucion_primera) = 'object' then
      v_primero := negocio.registrar_toque(new.org_id, new.cuenta_id, new.id, 'primera', old.atribucion_primera,
                                           least(coalesce(old.alta_en_el_crm, old.creado_el), now()));
    end if;
    if old.atribucion_ultima is not null and old.atribucion_ultima <> '{}'::jsonb
       and jsonb_typeof(old.atribucion_ultima) = 'object' then
      v_ultimo := negocio.registrar_toque(new.org_id, new.cuenta_id, new.id, 'ultima', old.atribucion_ultima,
                                          least(coalesce(old.sincronizado_el, old.creado_el), now() - interval '1 millisecond'));
    end if;
  end if;
  -- Cada atribución que trae algo y cambió (en un alta, la que trae algo) es un toque.
  if new.atribucion_primera is not null and new.atribucion_primera <> '{}'::jsonb
     and jsonb_typeof(new.atribucion_primera) = 'object'
     and (tg_op = 'INSERT' or old.atribucion_primera is distinct from new.atribucion_primera) then
    v_primero := negocio.registrar_toque(new.org_id, new.cuenta_id, new.id, 'primera', new.atribucion_primera,
                                         least(coalesce(new.alta_en_el_crm, now()), now()));
  end if;
  if new.atribucion_ultima is not null and new.atribucion_ultima <> '{}'::jsonb
     and jsonb_typeof(new.atribucion_ultima) = 'object'
     and (tg_op = 'INSERT' or old.atribucion_ultima is distinct from new.atribucion_ultima) then
    v_ultimo := negocio.registrar_toque(new.org_id, new.cuenta_id, new.id, 'ultima', new.atribucion_ultima, now());
  end if;
  -- El contacto apunta a sus toques. Un update aparte, después de que la fila existe (el toque la referencia): no
  -- toca ninguna de las columnas que disparan éste ni los otros disparadores de historia.
  if v_primero is not null or v_ultimo is not null then
    update negocio.contactos
       set primer_toque_de_marketing_id = coalesce(v_primero, primer_toque_de_marketing_id),
           ultimo_toque_de_marketing_id = coalesce(v_ultimo, ultimo_toque_de_marketing_id)
     where org_id = new.org_id and id = new.id;
  end if;
  return null;
end $$;
comment on function negocio.registrar_toques_del_crm() is
  'Disparador de negocio.contactos: cada atribución nueva o cambiada (atribucion_primera, atribucion_ultima) es un toque de marketing, y el contacto apunta al primero y al último. En la primera escritura de un contacto de antes de la 106, antes guarda las que ya tenía.';
drop trigger if exists contactos_registra_los_toques_del_alta on negocio.contactos;
create trigger contactos_registra_los_toques_del_alta after insert on negocio.contactos
  for each row when (new.atribucion_primera <> '{}'::jsonb or new.atribucion_ultima <> '{}'::jsonb)
  execute function negocio.registrar_toques_del_crm();
-- Sin lista de columnas, por la foto inicial (como el de las respuestas).
drop trigger if exists contactos_registra_los_toques on negocio.contactos;
create trigger contactos_registra_los_toques after update on negocio.contactos
  for each row when (old.atribucion_primera is distinct from new.atribucion_primera
                     or old.atribucion_ultima is distinct from new.atribucion_ultima
                     or old.historia_desde is null)
  execute function negocio.registrar_toques_del_crm();

-- ─── El disparador de las etiquetas ─────────────────────────────────────────────

-- GoHighLevel no fecha las etiquetas y la sincronización pisa contactos.etiquetas: cada etiqueta que aparece o
-- desaparece es un evento, y con él su hora. Varios hechos del flujo (asistió, no-show, onboarding hecho, la entrada)
-- hoy llegan sólo así; un escritor futuro que los traduzca necesita esta historia, que no se puede recuperar después.
create or replace function negocio.registrar_etiquetas_del_crm() returns trigger
language plpgsql as $$
declare
  v_viejas  text[] := '{}';
  v_nuevas  text[] := coalesce(new.etiquetas, '{}');
  v_sufijo  text := ':' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MISSUS');
begin
  if tg_op = 'UPDATE' then
    v_viejas := coalesce(old.etiquetas, '{}');
    -- La foto inicial de un contacto de antes de la 106: las etiquetas que ya tenía, con la hora en que se vieron
    -- (nunca antes de la partición más vieja de eventos, 24 meses).
    if old.historia_desde is null then
      insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                                   id_externo, datos)
      select new.org_id, new.cuenta_id,
             greatest(least(coalesce(old.sincronizado_el, old.creado_el), now() - interval '1 millisecond'),
                      date_trunc('month', now()) - interval '24 months'),
             'etiqueta_agregada', 1, new.id, 'sistema', 'ghl',
             'etiqueta:' || new.id || ':foto:' || md5(v.e),
             jsonb_build_object('etiqueta', left(v.e, 200), 'foto_inicial', true)
        from (select distinct btrim(x) as e from unnest(v_viejas) x) v
       where v.e <> ''
      on conflict do nothing;
    end if;
  end if;
  insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                               id_externo, datos)
  select new.org_id, new.cuenta_id, now(), d.tipo, 1, new.id, 'sistema', 'ghl',
         'etiqueta:' || new.id || ':' || d.tipo || ':' || md5(d.e) || v_sufijo,
         jsonb_build_object('etiqueta', left(d.e, 200))
    from (select 'etiqueta_agregada' as tipo, n.e
            from (select distinct btrim(x) as e from unnest(v_nuevas) x) n
           where n.e <> '' and not exists (select 1 from unnest(v_viejas) y where btrim(y) = n.e)
          union all
          select 'etiqueta_quitada', o.e
            from (select distinct btrim(x) as e from unnest(v_viejas) x) o
           where o.e <> '' and not exists (select 1 from unnest(v_nuevas) y where btrim(y) = o.e)) d
  on conflict do nothing;
  return null;
end $$;
comment on function negocio.registrar_etiquetas_del_crm() is
  'Disparador de negocio.contactos: cada etiqueta que aparece es un etiqueta_agregada y cada una que desaparece un etiqueta_quitada, con la hora de la escritura. En la primera escritura de un contacto de antes de la 106, antes guarda las que ya tenía (foto_inicial).';
drop trigger if exists contactos_registra_las_etiquetas_del_alta on negocio.contactos;
create trigger contactos_registra_las_etiquetas_del_alta after insert on negocio.contactos
  for each row when (cardinality(new.etiquetas) > 0)
  execute function negocio.registrar_etiquetas_del_crm();
drop trigger if exists contactos_registra_las_etiquetas on negocio.contactos;
create trigger contactos_registra_las_etiquetas after update on negocio.contactos
  for each row when (old.etiquetas is distinct from new.etiquetas or old.historia_desde is null)
  execute function negocio.registrar_etiquetas_del_crm();

-- ─── Las citas: el cuadrante al agendar y sus hechos ────────────────────────────

-- Antes de insertar: el cuadrante vigente del lead, y si la cita es calificada. En un upsert este BEFORE INSERT corre
-- también cuando después hay conflicto, pero ese valor se descarta porque la sincronización de citas no lo pone en su
-- `do update`: queda fijo desde la PRIMERA vez que se ve la cita. Es «el cuadrante cuando vimos la cita» (el barrido
-- de citas es horario): hasta una hora después de reservada.
create or replace function negocio.fijar_cuadrante_al_agendar() returns trigger
language plpgsql as $$
begin
  -- El tipo cambió en una cita ya guardada (su calendario se mapeó después, o se corrigió): calificada se rehace con el
  -- cuadrante AL AGENDAR, que ya quedó fijo. Así una cita vista con tipo nulo que resulta de onboarding no se queda
  -- calificada, y una que pasa a venta lo es según el cuadrante que tenía al agendar, no el de hoy.
  if tg_op = 'UPDATE' then
    if new.cuadrante_al_agendar is null
       or (new.tipo is not null
           and not exists (select 1 from catalogo.tipos_de_cita t where t.clave = new.tipo and t.es_de_venta)) then
      new.calificada := null;
    else
      new.calificada := new.cuadrante_al_agendar in ('prioriza', 'valida', 'financia');
    end if;
    return new;
  end if;
  if new.cuadrante_al_agendar is null then
    select c.cuadrante into new.cuadrante_al_agendar
      from negocio.contactos c where c.org_id = new.org_id and c.id = new.contacto_id;
  end if;
  -- Sólo una cita de venta (o de tipo todavía sin mapear) puede ser calificada: una de onboarding de un cliente que
  -- compró siendo Prioriza no es una cita calificada. Qué tipo es de venta lo dice el catálogo, no esta función.
  if new.calificada is null and new.cuadrante_al_agendar is not null
     and (new.tipo is null
          or exists (select 1 from catalogo.tipos_de_cita t where t.clave = new.tipo and t.es_de_venta)) then
    new.calificada := new.cuadrante_al_agendar in ('prioriza', 'valida', 'financia');
  end if;
  return new;
end $$;
comment on function negocio.fijar_cuadrante_al_agendar() is
  'Disparador de negocio.citas (antes de insertar): fija cuadrante_al_agendar con el cuadrante vigente del contacto, y calificada (Prioriza, Valida o Financia) sólo si la cita es de venta (catalogo.tipos_de_cita.es_de_venta) o de tipo todavía nulo. Un update no cambia el cuadrante al agendar; un cambio de tipo rehace calificada con ese cuadrante (nula si el tipo nuevo no es de venta).';
drop trigger if exists citas_fija_el_cuadrante on negocio.citas;
create trigger citas_fija_el_cuadrante before insert on negocio.citas
  for each row execute function negocio.fijar_cuadrante_al_agendar();
drop trigger if exists citas_recalifica_por_el_tipo on negocio.citas;
create trigger citas_recalifica_por_el_tipo before update of tipo on negocio.citas
  for each row when (old.tipo is distinct from new.tipo)
  execute function negocio.fijar_cuadrante_al_agendar();

-- Después: los hechos de la cita, como eventos. Son señales: ninguno mueve la etapa (la mueve GoHighLevel).
--
-- La sincronización de citas PISA el estado y la hora (lib/negocio/citas.ts guarda sólo el último salto): lo que no se
-- grabe como evento desde el despliegue no se recupera. Por eso TODO cambio del estado del CRM deja un
-- cita_estado_cambiado con el anterior (sin depender de una lista de estados), y los que son un hecho del flujo dejan
-- además el suyo: cancelled → cita_cancelada, noshow → no_show, showed → asistio (del CRM: actor sistema). Un cambio
-- de hora deja cita_reagendada con la de antes. Cada id_externo lleva la hora, como los demás: el mismo cambio repetido
-- en la misma transacción no se duplica (on conflict do nothing) y uno posterior es otro hecho.
create or replace function negocio.registrar_hechos_de_la_cita() returns trigger
language plpgsql as $$
declare
  v_estado  text := lower(btrim(coalesce(new.estado_ghl, '')));
  v_hecho   text;
  v_base    text := 'cita:' || new.ghl_evento_id;
  v_sufijo  text := ':' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MISSUS');
begin
  -- El estado del CRM que es un hecho del flujo.
  if v_estado in ('cancelled', 'canceled', 'cancelada') then
    v_hecho := 'cita_cancelada';
  elsif v_estado in ('noshow', 'no_show') then
    v_hecho := 'no_show';
  elsif v_estado = 'showed' then
    v_hecho := 'asistio';
  end if;

  if tg_argv[0] = 'alta' then
    -- Cuándo la reservó, si el CRM lo dice; nunca en el futuro, y nunca antes de la partición más vieja (24 meses):
    -- una cita vieja que aparece recién no cae en la partición por omisión. La hora real queda en datos.
    insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                                 id_externo, datos)
    values (new.org_id, new.cuenta_id,
            greatest(least(coalesce(new.reservada_el, now()), now()), date_trunc('month', now()) - interval '24 months'),
            'cita_agendada', 1, new.contacto_id, 'sistema', 'ghl', left(v_base, 300),
            jsonb_build_object('cita_id', new.id, 'para_el', new.inicio_el, 'reservada_el', new.reservada_el,
                               'tipo', new.tipo, 'ghl_calendario_id', new.ghl_calendario_id))
    on conflict do nothing;
    -- Una cita que se ve por primera vez ya cancelada, en no-show o atendida (el barrido la encuentra así al conectar
    -- una cuenta, o todo pasó dentro de la misma hora) deja también ese hecho, con un id propio del alta.
    if v_hecho is not null then
      insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                                   id_externo, datos)
      values (new.org_id, new.cuenta_id, now(), v_hecho, 1, new.contacto_id, 'sistema', 'ghl',
              left(v_base || ':' || v_hecho || ':alta', 300),
              jsonb_build_object('cita_id', new.id, 'estado', new.estado_ghl, 'estado_anterior', null))
      on conflict do nothing;
    end if;

  elsif tg_argv[0] = 'estado' then
    insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                                 id_externo, datos)
    values (new.org_id, new.cuenta_id, now(), 'cita_estado_cambiado', 1, new.contacto_id, 'sistema', 'ghl',
            left(v_base || ':estado' || v_sufijo, 300),
            jsonb_build_object('cita_id', new.id, 'estado', new.estado_ghl, 'estado_anterior', old.estado_ghl))
    on conflict do nothing;
    if v_hecho is not null then
      insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                                   id_externo, datos)
      values (new.org_id, new.cuenta_id, now(), v_hecho, 1, new.contacto_id, 'sistema', 'ghl',
              left(v_base || ':' || v_hecho || v_sufijo, 300),
              jsonb_build_object('cita_id', new.id, 'estado', new.estado_ghl, 'estado_anterior', old.estado_ghl))
      on conflict do nothing;
    end if;

  elsif tg_argv[0] = 'hora' then
    insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                                 id_externo, datos)
    values (new.org_id, new.cuenta_id, now(), 'cita_reagendada', 1, new.contacto_id, 'sistema', 'ghl',
            left(v_base || ':cita_reagendada' || v_sufijo, 300),
            jsonb_build_object('cita_id', new.id, 'para_el', new.inicio_el, 'antes_para_el', old.inicio_el))
    on conflict do nothing;

  else
    -- La asistencia que marca una persona (el closer, en Avanzar), en Comando Central.
    insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                                 id_externo, datos)
    values (new.org_id, new.cuenta_id, now(), 'asistio', 1, new.contacto_id, 'persona', 'comando_central',
            left(v_base || ':asistio' || v_sufijo, 300), jsonb_build_object('cita_id', new.id))
    on conflict do nothing;
  end if;
  return null;
end $$;
comment on function negocio.registrar_hechos_de_la_cita() is
  'Disparador de negocio.citas: cita_agendada al insertar, con el tipo y el calendario (y cita_cancelada, no_show o asistio si ya llega así); en cada cambio del estado del CRM, cita_estado_cambiado con el anterior, y además cita_cancelada (cancelled), no_show (noshow) o asistio (showed, actor sistema); cita_reagendada cuando cambia la hora; asistio (actor persona) cuando se marca la asistencia. Ninguno marca etapa.';
drop trigger if exists citas_registra_el_alta on negocio.citas;
create trigger citas_registra_el_alta after insert on negocio.citas
  for each row execute function negocio.registrar_hechos_de_la_cita('alta');
drop trigger if exists citas_registra_el_estado on negocio.citas;
create trigger citas_registra_el_estado after update of estado_ghl on negocio.citas
  for each row when (old.estado_ghl is distinct from new.estado_ghl)
  execute function negocio.registrar_hechos_de_la_cita('estado');
drop trigger if exists citas_registra_la_hora on negocio.citas;
create trigger citas_registra_la_hora after update of inicio_el on negocio.citas
  for each row when (old.inicio_el is distinct from new.inicio_el)
  execute function negocio.registrar_hechos_de_la_cita('hora');
drop trigger if exists citas_registra_la_asistencia on negocio.citas;
create trigger citas_registra_la_asistencia after update of asistio on negocio.citas
  for each row when (new.asistio is true and old.asistio is not true)
  execute function negocio.registrar_hechos_de_la_cita('asistio');

-- ─── Las vistas ─────────────────────────────────────────────────────────────────
-- `security_invoker`: corren con los permisos de QUIEN las lee (bajo su RLS), no de su dueño. Sólo se leen.

create or replace view negocio.etapas_del_lead with (security_invoker = true) as
  select e.org_id, e.cuenta_id, e.contacto_id, e.datos ->> 'etapa' as etapa, et.orden, min(e.ocurrio_el) as entro_el
    from negocio.eventos e
    join catalogo.etapas et on et.clave = e.datos ->> 'etapa'
   where e.tipo = 'etapa_cambiada' and e.contacto_id is not null
   group by e.org_id, e.cuenta_id, e.contacto_id, e.datos ->> 'etapa', et.orden;
comment on view negocio.etapas_del_lead is
  'Una fila por lead y etapa del Pipeline Maestro, con la PRIMERA vez que entró. Lee SÓLO los eventos etapa_cambiada (la etapa la mueve GoHighLevel); etapa_que_marca de los demás tipos es una señal esperada, no se mezcla.';
comment on column negocio.etapas_del_lead.etapa is 'La etapa (catalogo.etapas).';
comment on column negocio.etapas_del_lead.orden is 'Su orden en el embudo (1 a 7).';
comment on column negocio.etapas_del_lead.entro_el is 'La primera vez que el lead entró a esa etapa.';
revoke all on negocio.etapas_del_lead from app_inquilino;
grant select on negocio.etapas_del_lead to app_inquilino;

-- La pregunta estándar de cada respuesta, resuelta AL LEER. El disparador del CRM guarda el campo (origen_clave) y no
-- la pregunta: así un mapeo que se carga o se corrige después vale también para las filas viejas, sin UPDATE (la tabla
-- es de sólo agregar). `pregunta` de la tabla queda para el escritor que ya la sabe (un formulario, un agente) y gana.
-- Si no, la precedencia es la de lib/negocio/idiomaComun.ts: el mapeo de la cuenta antes que el del snapshot, el de un
-- campo antes que el vacío, y un mapeo a «ignorar» es reconocido y descartado. El mapeo es de tipo «campo» y su
-- valor_origen es el fieldKey (negocio.campos_del_crm.clave, con o sin «contact.») o el id del campo.
create or replace view negocio.respuestas_del_lead_traducidas with (security_invoker = true) as
  select r.org_id, r.cuenta_id, r.id, r.contacto_id,
         coalesce(r.pregunta, case when m.destino_catalogo = 'preguntas_estandar' then m.destino_clave end) as pregunta,
         case when r.pregunta is not null then 'fila' when m.destino_catalogo = 'preguntas_estandar' then m.via end
           as pregunta_por,
         coalesce(r.pregunta is null and m.destino_catalogo = 'ignorar', false) as ignorada,
         r.origen_clave, cc.clave as campo_clave, cc.nombre as campo_nombre, cc.tipo as campo_tipo,
         r.valor_texto, r.valor_numero, r.valor_booleano, r.valor_fecha, r.moneda, r.opcion, r.vaciada,
         r.proveedor, r.obtenida_por, r.etapa, r.observada_el, r.registrada_el, r.recibido_id, r.evento_id
    from negocio.respuestas_del_lead r
    left join negocio.campos_del_crm cc
           on r.proveedor = 'ghl' and cc.org_id = r.org_id and cc.cuenta_id = r.cuenta_id and cc.campo_id = r.origen_clave
    left join lateral (
      select x.via, x.destino_catalogo, x.destino_clave
        from (select 'cuenta' as via, 1 as nivel, mc.campo, mc.valor_origen, mc.destino_catalogo, mc.destino_clave
                from negocio.mapeos_de_cuenta mc
               where mc.org_id = r.org_id and mc.cuenta_id = r.cuenta_id and mc.tipo = 'campo'
                 and mc.valor_origen in (r.origen_clave, cc.clave,
                                         case when cc.clave like 'contact.%' then substr(cc.clave, 9) end)
              union all
              select 'snapshot', 2, ms.campo, ms.valor_origen, ms.destino_catalogo, ms.destino_clave
                from identidad.cuentas k
                join catalogo.mapeos_de_snapshot ms on ms.snapshot_version_id = k.snapshot_version_id
               where k.org_id = r.org_id and k.id = r.cuenta_id and ms.tipo = 'campo'
                 and ms.valor_origen in (r.origen_clave, cc.clave,
                                         case when cc.clave like 'contact.%' then substr(cc.clave, 9) end)) x
       where x.destino_catalogo in ('preguntas_estandar', 'ignorar')
       order by x.nivel, x.campo desc, x.valor_origen
       limit 1) m on true;
comment on view negocio.respuestas_del_lead_traducidas is
  'negocio.respuestas_del_lead con la pregunta estándar resuelta al leer (106): la de la fila, o la del mapeo «campo» de la cuenta o de su snapshot (el fieldKey o el id del campo → catalogo.preguntas_estandar). Vale para las filas viejas sin UPDATE. Es lo que nombra «pregunta:<clave>» en catalogo.inputs_del_flujo.';
comment on column negocio.respuestas_del_lead_traducidas.pregunta is 'La pregunta estándar: la de la fila, o la del mapeo. Nula = el campo todavía no está mapeado (o se ignora).';
comment on column negocio.respuestas_del_lead_traducidas.pregunta_por is 'De dónde salió la pregunta: fila (la escribió quien la sabía), cuenta (negocio.mapeos_de_cuenta) o snapshot (catalogo.mapeos_de_snapshot). Nulo = sin pregunta.';
comment on column negocio.respuestas_del_lead_traducidas.ignorada is 'true = el campo tiene un mapeo a «ignorar»: se reconoce y se descarta a propósito (la trayectoria no lo muestra).';
comment on column negocio.respuestas_del_lead_traducidas.campo_clave is 'El fieldKey del campo del CRM (negocio.campos_del_crm.clave), si se conoce.';
comment on column negocio.respuestas_del_lead_traducidas.campo_nombre is 'El nombre del campo del CRM, si se conoce.';
comment on column negocio.respuestas_del_lead_traducidas.campo_tipo is 'El dataType del campo del CRM (PHONE, EMAIL, TEXT…), si se conoce.';
revoke all on negocio.respuestas_del_lead_traducidas from app_inquilino;
grant select on negocio.respuestas_del_lead_traducidas to app_inquilino;

-- Por dónde llegó el lead sale de su PRIMER toque, no de eventos.fuente: el etapa_cambiada lo registra siempre
-- GoHighLevel, y esa columna no distinguiría Meta de un orgánico. Se borra antes de crearla porque cambió de columnas.
drop view if exists negocio.embudo_por_dia;
create view negocio.embudo_por_dia with (security_invoker = true) as
  with primera as (
    select distinct on (e.org_id, e.cuenta_id, e.contacto_id, e.datos ->> 'etapa')
           e.org_id, e.cuenta_id, e.contacto_id, e.datos ->> 'etapa' as etapa, e.ocurrio_el
      from negocio.eventos e
     where e.tipo = 'etapa_cambiada' and e.contacto_id is not null and e.datos ? 'etapa'
     order by e.org_id, e.cuenta_id, e.contacto_id, e.datos ->> 'etapa', e.ocurrio_el)
  select p.org_id, p.cuenta_id, (p.ocurrio_el at time zone cu.zona_horaria)::date as dia, p.etapa, et.orden,
         c.entrada, coalesce(c.fuente_estandar, t.fuente) as fuente,
         lower(left(coalesce(nullif(btrim(t.utm_source), ''), nullif(btrim(t.session_source), '')), 100)) as origen,
         count(*)::int as leads
    from primera p
    join identidad.cuentas cu on cu.org_id = p.org_id and cu.id = p.cuenta_id
    join catalogo.etapas et on et.clave = p.etapa
    left join negocio.contactos c on c.org_id = p.org_id and c.id = p.contacto_id
    left join negocio.toques_de_marketing t
           on t.org_id = c.org_id and t.cuenta_id = c.cuenta_id and t.id = c.primer_toque_de_marketing_id
   group by 1, 2, 3, 4, 5, 6, 7, 8;
comment on view negocio.embudo_por_dia is
  'Cuántos leads entraron a cada etapa por día LOCAL de la cuenta (identidad.cuentas.zona_horaria), por entrada, fuente y origen de su primer toque. Cada lead cuenta una vez por etapa, el día en que entró por primera vez.';
comment on column negocio.embudo_por_dia.dia is 'El día en la zona horaria de la cuenta.';
comment on column negocio.embudo_por_dia.entrada is 'La entrada vigente del lead (contactos.entrada). Nula si no se sabe: todavía nada la escribe (docs/modelo de datos/23 § 9).';
comment on column negocio.embudo_por_dia.fuente is 'El origen de marketing (catalogo.fuentes) del lead, o de su primer toque. Nulo hasta que un mapeo lo escriba (docs/modelo de datos/23 § 9).';
comment on column negocio.embudo_por_dia.origen is 'Por dónde llegó, tal cual lo dice su primer toque: utm_source o, si no hay, el sessionSource del CRM (facebook, paid social, direct traffic…), en minúsculas. Nulo sin atribución.';
comment on column negocio.embudo_por_dia.leads is 'Cuántos leads entraron ese día a esa etapa.';
revoke all on negocio.embudo_por_dia from app_inquilino;
grant select on negocio.embudo_por_dia to app_inquilino;

create or replace view negocio.metricas_meta_del_dia with (security_invoker = true) as
  select m.org_id, m.cuenta_id, m.meta_anuncio_id, m.fecha, m.moneda, m.gasto, m.gasto_usd, m.impresiones, m.alcance,
         m.clics as clics_totales,
         (m.acciones ->> 'linkClick')::numeric as clics_en_el_enlace,
         round((m.acciones ->> 'linkClick')::numeric / nullif(m.impresiones, 0), 6) as ctr_del_enlace,
         round(m.gasto / nullif((m.acciones ->> 'linkClick')::numeric, 0), 4) as cpc_del_enlace,
         (m.acciones ->> 'lead')::numeric as leads,
         (m.acciones ->> 'onsiteConversion.messagingConversationStarted7d')::numeric as mensajes_iniciados,
         round(m.gasto / nullif(coalesce((m.acciones ->> 'lead')::numeric,
                                         (m.acciones ->> 'onsiteConversion.messagingConversationStarted7d')::numeric), 0), 4)
           as costo_por_resultado
    from negocio.metricas_de_anuncio m;
comment on view negocio.metricas_meta_del_dia is
  'Las métricas de cada anuncio por día con las del ENLACE (no las de todos los clics): CTR y CPC del enlace con acciones.linkClick, y el costo por resultado (leads del Lead Form o, si no hay, conversaciones iniciadas). En la moneda de la fila.';
comment on column negocio.metricas_meta_del_dia.clics_totales is 'Todos los clics que informa Meta (incluye los que no van al enlace).';
comment on column negocio.metricas_meta_del_dia.clics_en_el_enlace is 'acciones.linkClick. Nulo = ese día no hubo (no es cero).';
comment on column negocio.metricas_meta_del_dia.ctr_del_enlace is 'clics en el enlace / impresiones (una fracción, no un porcentaje).';
comment on column negocio.metricas_meta_del_dia.cpc_del_enlace is 'gasto / clics en el enlace.';
comment on column negocio.metricas_meta_del_dia.leads is 'acciones.lead: los del Lead Form de Meta.';
comment on column negocio.metricas_meta_del_dia.mensajes_iniciados is 'Las conversaciones iniciadas en 7 días (acciones.onsiteConversion.messagingConversationStarted7d).';
comment on column negocio.metricas_meta_del_dia.costo_por_resultado is 'gasto / leads, o, sin leads, gasto / conversaciones iniciadas. Nulo si no hubo ninguno.';
revoke all on negocio.metricas_meta_del_dia from app_inquilino;
grant select on negocio.metricas_meta_del_dia to app_inquilino;

-- ─── La trayectoria del lead: una sola lectura para la IA ───────────────────────

-- Si una respuesta del CRM es un dato de contacto, y por eso no sale en la trayectoria: un campo de teléfono, de
-- correo o de nombre (por su tipo o por su nombre); un valor con un correo; uno con una secuencia de 7 o más dígitos
-- separados sólo por espacios, guiones, paréntesis o «+» (un teléfono, sea del lead o de otro; los montos con puntos o
-- comas pasan, y los campos numéricos no se miran así); uno con los últimos 7 dígitos del teléfono del lead, escritos
-- como sea; y uno con el nombre del lead (sus dos primeras palabras seguidas, su primer nombre si tiene 4 letras o
-- más, o un valor que es entero una parte del nombre), sin mayúsculas ni tildes. Prefiere esconder de más: lo que no
-- sale, la IA no lo ve.
create or replace function negocio.es_dato_de_contacto(p_valor text, p_campo text, p_tipo text, p_telefono text,
                                                       p_nombre text) returns boolean
language sql immutable as $$
  with x as (
    select ' ' || btrim(regexp_replace(translate(lower(coalesce(p_valor, '')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
                                       '[^a-z0-9]+', ' ', 'g')) || ' ' as v,
           btrim(regexp_replace(translate(lower(coalesce(p_nombre, '')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
                                '[^a-z0-9]+', ' ', 'g')) as n,
           regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g') as tel,
           regexp_replace(coalesce(p_valor, ''), '[^0-9]', '', 'g') as digitos,
           upper(coalesce(p_tipo, '')) as tipo,
           coalesce(p_campo, '') as campo)
  select x.tipo in ('PHONE', 'EMAIL')
      or x.campo ~* '(tel[eé]fono|celular|m[oó]vil|whats ?app|phone|correo|e-?mail)'
      or (x.campo ~* '(^|[^[:alpha:]])(nombres?|apellidos?|name|first ?name|last ?name|full ?name)([^[:alpha:]]|$)'
          and x.campo !~* '(negocio|empresa|marca|cl[ií]nica|compa[nñ]|business|company)')
      or coalesce(p_valor, '') ~* '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+'
      or (x.tipo not in ('NUMERICAL', 'MONETORY', 'MONETARY') and coalesce(p_valor, '') ~ '[0-9]([[:space:]()+-]*[0-9]){6,}')
      or (length(x.tel) >= 7 and position(right(x.tel, 7) in x.digitos) > 0)
      or (split_part(x.n, ' ', 2) <> ''
          and x.v like '% ' || split_part(x.n, ' ', 1) || ' ' || split_part(x.n, ' ', 2) || ' %')
      or (length(split_part(x.n, ' ', 1)) >= 4 and x.v like '% ' || split_part(x.n, ' ', 1) || ' %')
      or (length(btrim(x.v)) >= 3 and ' ' || x.n || ' ' like '%' || x.v || '%')
    from x
$$;
comment on function negocio.es_dato_de_contacto(text, text, text, text, text) is
  'true si una respuesta del CRM es un dato de contacto del lead (o lo parece): un campo de teléfono, correo o nombre, un valor con un correo, un teléfono o el nombre del lead. La usa trayectoria_del_lead para no dárselo a la IA.';

-- Los datos de un evento, como los ve la IA: sin nada que sea (o parezca) un dato de contacto del lead. Pasan los
-- números y los sí/no (salvo los que traen su teléfono), los ids (uuid) y las fechas; un texto pasa sólo si
-- negocio.es_dato_de_contacto no lo marca (la clave hace de nombre del campo); un objeto o una lista anidados no pasan.
-- Prefiere esconder de más.
create or replace function negocio.datos_para_la_trayectoria(p_datos jsonb, p_telefono text, p_nombre text)
returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(d.key, d.value), '{}'::jsonb)
    from jsonb_each(case when jsonb_typeof(p_datos) = 'object' then p_datos else '{}'::jsonb end) d
   where jsonb_typeof(d.value) in ('boolean', 'null')
      or (jsonb_typeof(d.value) = 'number'
          and not negocio.es_dato_de_contacto(d.value #>> '{}', d.key, 'NUMERICAL', p_telefono, p_nombre))
      or (jsonb_typeof(d.value) = 'string'
          and (d.value #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               or d.value #>> '{}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([T ][0-9:.]+)?(Z|[+-][0-9]{2}(:?[0-9]{2})?)?$'
               or not negocio.es_dato_de_contacto(d.value #>> '{}', d.key, null, p_telefono, p_nombre)))
$$;
comment on function negocio.datos_para_la_trayectoria(jsonb, text, text) is
  'Los datos de un evento sin nada que sea o parezca un dato de contacto del lead (negocio.es_dato_de_contacto): pasan ids, fechas, sí/no, números y textos limpios; los objetos anidados no. La usa trayectoria_del_lead.';

-- Security invoker y con la ruta de búsqueda fija: corre con la RLS de quien la llama, y todo va calificado. NUNCA
-- devuelve el teléfono, el correo, el nombre ni el texto de un mensaje: una respuesta que es un dato de contacto
-- (negocio.es_dato_de_contacto) se omite, y también la de un campo que no está en negocio.campos_del_crm ni tiene
-- pregunta (no se sabe qué es) o que se ignora a propósito. Cada lectura va con la cuenta del lead: es el prefijo de
-- los índices (org_id, cuenta_id, contacto_id…), y sin ella PostgreSQL 17 recorre la tabla entera de la organización.
--
-- «eventos» trae, ordenados por hora, los hechos de los tipos que el catálogo marca para la IA
-- (catalogo.tipos_de_evento.para_la_trayectoria): un tipo nuevo para la IA es un INSERT o un UPDATE del catálogo, no
-- otra versión de esta función. «etapas» trae TODOS los cambios de etapa (también los retrocesos, con la etapa de
-- antes); la vista etapas_del_lead sigue dando la primera entrada a cada una.
create or replace function negocio.trayectoria_del_lead(p_contacto uuid) returns jsonb
language sql stable security invoker set search_path = pg_catalog, pg_temp
as $$
  select jsonb_build_object(
    'contacto_id', c.id,
    'cuenta_id', c.cuenta_id,
    'alta_en_el_crm', c.alta_en_el_crm,
    'etapa', c.etapa_estandar,
    'etapa_el', c.etapa_estandar_el,
    'salida', c.salida,
    'salida_el', c.salida_el,
    'cuadrante', c.cuadrante,
    'entrada', c.entrada,
    'canal_de_entrada', c.canal_de_entrada,
    'fuente', c.fuente_estandar,
    'palabra_clave', c.palabra_clave,
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'etapa', e.datos ->> 'etapa', 'orden', et.orden, 'el', e.ocurrio_el,
               'etapa_anterior', e.datos ->> 'etapa_anterior',
               'retrocede', case when jsonb_typeof(e.datos -> 'retrocede') = 'boolean' then (e.datos -> 'retrocede')::boolean
                                 else false end)
             order by e.ocurrio_el, e.registrado_el, e.id)
        from negocio.eventos e
        left join catalogo.etapas et on et.clave = e.datos ->> 'etapa'
       where e.org_id = c.org_id and e.cuenta_id = c.cuenta_id and e.contacto_id = c.id and e.tipo = 'etapa_cambiada'),
      '[]'::jsonb),
    'salidas', coalesce((
      select jsonb_agg(jsonb_build_object('salida', e.datos ->> 'salida', 'etapa', e.datos ->> 'etapa', 'el', e.ocurrio_el)
                       order by e.ocurrio_el)
        from negocio.eventos e
       where e.org_id = c.org_id and e.cuenta_id = c.cuenta_id and e.contacto_id = c.id and e.tipo = 'salida_marcada'),
      '[]'::jsonb),
    'cuadrantes', coalesce((
      select jsonb_agg(jsonb_build_object('cuadrante', k.cuadrante, 'anterior', k.cuadrante_anterior, 'origen', k.origen,
                                          'primera_vez', k.primera_vez, 'el', k.clasificado_el) order by k.clasificado_el)
        from negocio.clasificaciones k
       where k.org_id = c.org_id and k.cuenta_id = c.cuenta_id and k.contacto_id = c.id), '[]'::jsonb),
    'respuestas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dato', coalesce(r.pregunta, r.campo_nombre, r.origen_clave), 'pregunta', r.pregunta, 'campo', r.origen_clave,
               'etapa', r.etapa, 'proveedor', r.proveedor, 'vaciada', r.vaciada, 'moneda', r.moneda,
               'valor', coalesce(r.opcion, r.valor_texto, r.valor_numero::text, r.valor_booleano::text, r.valor_fecha::text),
               'el', r.observada_el) order by r.observada_el)
        from negocio.respuestas_del_lead_traducidas r
       where r.org_id = c.org_id and r.cuenta_id = c.cuenta_id and r.contacto_id = c.id
         and not r.ignorada
         and (r.pregunta is not null or r.campo_nombre is not null)
         and not negocio.es_dato_de_contacto(r.valor_texto, r.campo_nombre, r.campo_tipo, c.telefono, c.nombre)
    ), '[]'::jsonb),
    'toques', coalesce((
      select jsonb_agg(jsonb_build_object(
               'posicion', t.posicion, 'el', t.ocurrio_el, 'entrada', t.entrada, 'fuente', t.fuente, 'proveedor', t.proveedor,
               'campana', t.campana_id_externo, 'conjunto', t.conjunto_id_externo, 'anuncio', t.anuncio_id_externo,
               'formulario', t.formulario_nombre, 'session_source', t.session_source, 'utm_source', t.utm_source,
               'utm_medium', t.utm_medium, 'utm_campaign', t.utm_campaign, 'utm_content', t.utm_content,
               'palabra_clave', t.palabra_clave, 'pieza_origen', t.pieza_origen) order by t.ocurrio_el)
        from negocio.toques_de_marketing t
       where t.org_id = c.org_id and t.cuenta_id = c.cuenta_id and t.contacto_id = c.id), '[]'::jsonb),
    'citas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'cita_id', ci.id, 'inicio_el', ci.inicio_el, 'reservada_el', ci.reservada_el, 'estado', ci.estado_ghl,
               'tipo', ci.tipo, 'cuadrante_al_agendar', ci.cuadrante_al_agendar, 'calificada', ci.calificada,
               'asistio', ci.asistio) order by ci.inicio_el)
        from negocio.citas ci
       where ci.org_id = c.org_id and ci.cuenta_id = c.cuenta_id and ci.contacto_id = c.id), '[]'::jsonb),
    'resultados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'resultado_id', re.id, 'salida', re.salida, 'salida_estandar', re.salida_estandar, 'monto', re.monto,
               'moneda', re.moneda, 'monto_usd', re.monto_usd, 'motivo', re.motivo, 'cita_id', re.cita_id,
               'el', re.creado_el) order by re.creado_el)
        from negocio.resultados re
       where re.org_id = c.org_id and re.cuenta_id = c.cuenta_id and re.contacto_id = c.id), '[]'::jsonb),
    'llamadas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'llamada_id', l.id, 'tipo', l.tipo, 'estado', l.estado, 'fecha', l.fecha_de_la_reunion,
               'duracion_seg', l.duracion_seg, 'cita_id', l.cita_id, 'vinculado_por', l.vinculado_por)
                       order by l.fecha_de_la_reunion)
        from negocio.analizador_llamadas l
       where l.org_id = c.org_id and l.cuenta_id = c.cuenta_id and l.contacto_id = c.id), '[]'::jsonb),
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', e.tipo, 'ocurrio_el', e.ocurrio_el, 'fuente', e.fuente, 'actor_tipo', e.actor_tipo,
               'datos', negocio.datos_para_la_trayectoria(e.datos, c.telefono, c.nombre))
             order by e.ocurrio_el, e.registrado_el, e.id)
        from negocio.eventos e
        join catalogo.tipos_de_evento te on te.clave = e.tipo and te.version = e.tipo_version and te.para_la_trayectoria
       where e.org_id = c.org_id and e.cuenta_id = c.cuenta_id and e.contacto_id = c.id), '[]'::jsonb)
  )
  from negocio.contactos c
  where c.id = p_contacto
$$;
comment on function negocio.trayectoria_del_lead(uuid) is
  'Todo lo que se sabe de un lead en un jsonb, para la IA: todos los cambios de etapa (con los retrocesos), Salida, cuadrantes, respuestas por etapa (con la pregunta estándar resuelta, o el nombre del campo del CRM), toques, citas, resultados, llamadas analizadas y, ordenados por hora, los eventos de los tipos que el catálogo marca para la IA (para_la_trayectoria). Security invoker: bajo la RLS de quien la llama. NUNCA devuelve teléfono, correo, nombre ni texto de mensajes. Nulo si el lead no existe o no se ve.';

-- ─── El diccionario de los inputs del flujo ─────────────────────────────────────

create table if not exists catalogo.inputs_del_flujo (
  clave        catalogo.clave primary key,
  nombre       text not null,
  etapa        catalogo.clave not null references catalogo.etapas (clave),
  origen       catalogo.clave not null references catalogo.origenes_de_dato (clave),
  grano        catalogo.clave not null references catalogo.granos (clave),
  donde_vive   text not null check (donde_vive ~ '^(pregunta|evento|columna|metrica|pendiente):.+'),
  descripcion  text,
  vigente      boolean not null default true
);
comment on table catalogo.inputs_del_flujo is
  'El diccionario de lo que espera el flujo de 7 etapas (106): por cada input, en qué etapa entra, de qué origen viene, con qué grano y DÓNDE VIVE. No guarda valores. Es lo que lee la IA para saber qué esperar en cada etapa. Un input nuevo es un INSERT.';
comment on column catalogo.inputs_del_flujo.etapa is 'La etapa del Pipeline Maestro en la que entra (los transversales, como la etapa y la Salida, van con lead).';
comment on column catalogo.inputs_del_flujo.origen is 'De dónde viene (catalogo.origenes_de_dato): un proveedor (meta, ghl, landing, tiktok…), ia, calculado o persona.';
comment on column catalogo.inputs_del_flujo.grano is 'De qué es cada valor (catalogo.granos): de un lead, una cita, una llamada, un anuncio por día o una cuenta por día.';
comment on column catalogo.inputs_del_flujo.donde_vive is
  'Dónde está el valor: pregunta:<clave de preguntas_estandar> (las filas de negocio.respuestas_del_lead_traducidas con esa pregunta, resuelta por la fila o por el mapeo «campo»), evento:<tipo de evento> (los de negocio.eventos; la IA los ve en la trayectoria si el tipo es para_la_trayectoria), columna:<esquema.tabla.columna>, metrica:<expresión> o pendiente:<lo que todavía no existe> (pagos, extracciones, métricas de perfil, puntos de partida).';

-- Los inputs del flujo de 7 etapas (la imagen del flujo y el SOP del 2026-10-22). Lo que todavía no tiene tabla va como
-- pendiente: (no se crean tablas sin escritor).
insert into catalogo.inputs_del_flujo (clave, nombre, etapa, origen, grano, donde_vive) values
  ('utm_campaign', 'Campaign Name (UTM Campaign)', 'lead', 'meta', 'lead', 'columna:negocio.toques_de_marketing.utm_campaign'),
  ('utm_content', 'Ad Name (UTM Content)', 'lead', 'meta', 'lead', 'columna:negocio.toques_de_marketing.utm_content'),
  ('campana_id', 'Campaign ID', 'lead', 'meta', 'lead', 'columna:negocio.toques_de_marketing.campana_id_externo'),
  ('conjunto_id', 'Ad set ID (Last UTM Adset)', 'lead', 'meta', 'lead', 'columna:negocio.toques_de_marketing.conjunto_id_externo'),
  ('anuncio_id', 'Ad ID', 'lead', 'meta', 'lead', 'columna:negocio.toques_de_marketing.anuncio_id_externo'),
  ('meta_lead_id', 'Meta Lead ID', 'lead', 'meta', 'lead', 'columna:negocio.toques_de_marketing.meta_lead_id'),
  ('session_source', 'Session Source', 'lead', 'ghl', 'lead', 'columna:negocio.toques_de_marketing.session_source'),
  ('formulario_id', 'Form ID', 'lead', 'meta', 'lead', 'columna:negocio.toques_de_marketing.formulario_id'),
  ('formulario_nombre', 'Form Name', 'lead', 'meta', 'lead', 'columna:negocio.toques_de_marketing.formulario_nombre'),
  ('fbclid', 'FBCLID (última atribución)', 'lead', 'landing', 'lead', 'columna:negocio.toques_de_marketing.fbclid'),
  ('ultima_url', 'Last Landing URL', 'lead', 'landing', 'lead', 'columna:negocio.toques_de_marketing.url'),
  ('utm_source', 'UTM Source', 'lead', 'landing', 'lead', 'columna:negocio.toques_de_marketing.utm_source'),
  ('ig_sid', 'IGSID (Medium ID)', 'lead', 'ghl', 'lead', 'columna:negocio.toques_de_marketing.ig_sid'),
  ('palabra_clave', 'Palabra clave del CTA', 'lead', 'ghl', 'lead', 'columna:negocio.contactos.palabra_clave'),
  ('pieza_origen', 'Pieza de origen (publicación)', 'lead', 'ghl', 'lead', 'columna:negocio.toques_de_marketing.pieza_origen'),
  ('entrada', 'Tipo de entrada', 'lead', 'ghl', 'lead', 'columna:negocio.contactos.entrada'),
  ('fuente_de_marketing', 'Fuente (pagada, orgánica, outbound, referido, alianza)', 'lead', 'ghl', 'lead', 'columna:negocio.toques_de_marketing.fuente'),
  ('nombre', 'Nombre', 'lead', 'ghl', 'lead', 'columna:negocio.contactos.nombre'),
  ('correo', 'Correo', 'lead', 'ghl', 'lead', 'columna:negocio.contactos.email'),
  ('telefono', 'Teléfono', 'lead', 'ghl', 'lead', 'columna:negocio.contactos.telefono'),
  ('campo_sin_mapear', 'Pregunta CF todavía sin mapear', 'lead', 'ghl', 'lead', 'columna:negocio.respuestas_del_lead.origen_clave'),
  ('gasto', 'Inversión (gasto)', 'lead', 'meta', 'anuncio_dia', 'metrica:negocio.metricas_de_anuncio.gasto_usd'),
  ('impresiones', 'Impresiones', 'lead', 'meta', 'anuncio_dia', 'metrica:negocio.metricas_de_anuncio.impresiones'),
  ('alcance', 'Alcance', 'lead', 'meta', 'anuncio_dia', 'metrica:negocio.metricas_de_anuncio.alcance'),
  ('frecuencia', 'Frecuencia', 'lead', 'meta', 'anuncio_dia', 'metrica:negocio.metricas_de_anuncio.frecuencia'),
  ('cpm', 'CPM', 'lead', 'meta', 'anuncio_dia', 'metrica:negocio.metricas_de_anuncio.cpm'),
  ('tiempo_medio_de_video', 'Tiempo medio de video', 'lead', 'meta', 'anuncio_dia', 'metrica:negocio.metricas_de_anuncio.video->>''segundosEnPromedio'''),
  ('clics_en_el_enlace', 'Clics en el enlace', 'lead', 'calculado', 'anuncio_dia', 'metrica:negocio.metricas_de_anuncio.acciones->>''linkClick'''),
  ('ctr_del_enlace', 'CTR del enlace', 'lead', 'calculado', 'anuncio_dia', 'metrica:(acciones->>''linkClick'') / impresiones (vista metricas_meta_del_dia)'),
  ('cpc_del_enlace', 'CPC del enlace', 'lead', 'calculado', 'anuncio_dia', 'metrica:gasto_usd / (acciones->>''linkClick'') (vista metricas_meta_del_dia)'),
  ('costo_por_resultado', 'Costo por resultado', 'lead', 'calculado', 'anuncio_dia', 'metrica:gasto_usd / (acciones->>''lead'' o mensajes iniciados, según el objetivo de la campaña)'),
  ('gasto_de_la_cuenta', 'Inversión total de la cuenta', 'lead', 'meta', 'cuenta_dia', 'metrica:negocio.gasto_de_la_cuenta.gasto_usd'),
  ('seguidores', 'Seguidores', 'lead', 'meta', 'cuenta_dia', 'pendiente:negocio.metricas_de_perfil.seguidores'),
  ('apertura', 'Aperturas (nuevo seguidor, CTA, general, WhatsApp del minuto 0)', 'conversacion', 'ghl', 'lead', 'evento:apertura_enviada'),
  ('respondio', 'Responden', 'conversacion', 'ghl', 'lead', 'evento:mensaje_entrante'),
  ('llamada_del_setter', 'Callfunnel: apertura y responden (llamadas #1 y #2)', 'conversacion', 'ghl', 'llamada', 'evento:llamada_realizada'),
  ('tipo_de_negocio', 'Tipo de negocio', 'calificado', 'ghl', 'lead', 'pregunta:tipo_de_negocio'),
  ('clientes_activos', 'Clientes activos', 'calificado', 'ghl', 'lead', 'pregunta:clientes_activos'),
  ('facturacion_mensual', 'Facturación mensual', 'calificado', 'ghl', 'lead', 'pregunta:facturacion_mensual'),
  ('ticket_promedio', 'Ticket mensual por cliente', 'calificado', 'ghl', 'lead', 'pregunta:ticket_promedio'),
  ('inversion_en_publicidad', 'Inversión actual en publicidad', 'calificado', 'ghl', 'lead', 'pregunta:inversion_en_publicidad'),
  ('freno_principal', 'Dolores / problemas (cerrada)', 'calificado', 'ghl', 'lead', 'pregunta:freno_principal'),
  ('ejemplo_real', 'Ejemplo real (abierta)', 'calificado', 'ghl', 'lead', 'pregunta:ejemplo_real'),
  ('meta_a_6_meses', 'Deseos / objetivos (meta a 6 meses)', 'calificado', 'ghl', 'lead', 'pregunta:meta_a_6_meses'),
  ('quien_decide', 'Decisor', 'calificado', 'ghl', 'lead', 'pregunta:quien_decide'),
  ('inversion_disponible', 'Presupuesto / intención (¿invierte este mes?)', 'calificado', 'ghl', 'lead', 'pregunta:inversion_disponible'),
  ('compromiso_video', 'Compromiso de ver el video', 'calificado', 'ghl', 'lead', 'pregunta:compromiso_video'),
  ('perfil_del_negocio', 'Trazabilidad (Maps, IG, web)', 'calificado', 'ghl', 'lead', 'pregunta:perfil_del_negocio'),
  ('dolor_principal_ia', 'Dolor principal (juicio de la IA)', 'calificado', 'ia', 'lead', 'columna:negocio.clasificaciones.dolor_principal'),
  ('dolor_mas_comun', 'Dolor más común', 'calificado', 'calculado', 'cuenta_dia', 'metrica:moda de negocio.respuestas_del_lead_traducidas (pregunta = freno_principal) traducida a catalogo.dolores_comunes'),
  ('cuadrante', 'Cuadrante (Prioriza / Valida / Financia / Descarta)', 'calificado', 'ia', 'lead', 'evento:cuadrante_cambiado'),
  ('califica', 'Sí / No califica', 'calificado', 'calculado', 'lead', 'columna:negocio.clasificaciones.cuadrante'),
  ('cita_de_venta', 'Agendan', 'agendado', 'ghl', 'cita', 'evento:cita_agendada'),
  ('cuadrante_al_agendar', 'Cuadrante al agendar', 'agendado', 'calculado', 'cita', 'columna:negocio.citas.cuadrante_al_agendar'),
  ('seguidores_vs_calificados', 'Seguidores frente a leads calificados que agendan', 'agendado', 'calculado', 'cuenta_dia', 'metrica:conteo de negocio.citas por negocio.contactos.entrada'),
  ('respondio_video', 'Vieron el video (respondieron)', 'agendado', 'ghl', 'cita', 'evento:respondio_video'),
  ('respuesta_video', 'Texto de la respuesta al video', 'agendado', 'ghl', 'lead', 'pregunta:respuesta_video'),
  ('conexion_llamada', 'Confirman (computadora o solo celular)', 'agendado', 'ghl', 'cita', 'evento:conexion_confirmada'),
  ('horario_liberado', 'Horarios liberados', 'agendado', 'ghl', 'cita', 'evento:horario_liberado'),
  ('no_show', 'No-show', 'agendado', 'ghl', 'cita', 'evento:no_show'),
  ('asistencia', 'Asistieron', 'asistio', 'ghl', 'cita', 'evento:asistio'),
  ('cuadrante_al_asistir', 'Cuadrante de quien asistió', 'asistio', 'calculado', 'cita', 'columna:negocio.clasificaciones.cuadrante'),
  ('transcripcion_de_venta', 'Transcripción de la llamada de venta', 'asistio', 'ia', 'llamada', 'columna:negocio.analizador_llamadas.contacto_id'),
  ('fecha_decision', 'Fecha de decisión', 'asistio', 'persona', 'cita', 'pregunta:fecha_decision'),
  ('objecion_principal', 'Objeción principal', 'asistio', 'ia', 'llamada', 'pendiente:negocio.extracciones.categoria'),
  ('resultado_de_la_llamada', 'Resultado de la llamada (los 5 valores del Post-Call)', 'venta', 'persona', 'cita', 'columna:negocio.resultados.salida_estandar'),
  ('pago', 'Pago (monto, adelanto, saldo)', 'venta', 'ghl', 'lead', 'pendiente:negocio.pagos.monto_usd'),
  ('onboarding_hecho', 'Onboarding hecho', 'onboarding', 'ghl', 'lead', 'evento:onboarding_hecho'),
  ('punto_de_partida', 'Punto de partida del cliente', 'onboarding', 'ia', 'llamada', 'pendiente:negocio.puntos_de_partida.contacto_id'),
  ('etapa_maestra', 'Etapa del Pipeline Maestro y su hora (transversal)', 'lead', 'ghl', 'lead', 'evento:etapa_cambiada'),
  ('salida', 'Salida y su hora (transversal)', 'lead', 'ghl', 'lead', 'evento:salida_marcada')
on conflict do nothing;

-- ─── La consulta de un aviso de oportunidad (el reproceso) ──────────────────────
--
-- La etapa y la Salida de cada rama de PM-02/PM-03 viajan en la URL (`&etapa=`, `&salida=`), no en el cuerpo, y la
-- huella de la cuarentena las tiene sólo hasheadas. Para reprocesar un aviso de oportunidad que quedó sin procesar
-- (un fallo transitorio, o por encima del tope por hora: lib/negocio/reprocesoDeAvisos.ts) hace falta la consulta tal
-- cual. Columna nula: los avisos que no son de oportunidad no la guardan.
alter table negocio.avisos_del_crm add column if not exists consulta text
  check (consulta is null or char_length(consulta) <= 2000);
comment on column negocio.avisos_del_crm.consulta is
  'La consulta de la URL de un aviso de oportunidad (evento, etapa o salida de la rama), sin el ?. La usa el reproceso. Nula en los demás avisos. Sin datos de la persona.';
