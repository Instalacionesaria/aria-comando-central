-- 110 · Los managed agents y sus corridas: el catálogo de los siete, el registro de cada corrida, el conocimiento de
-- cada cuenta, la evidencia pública, lo que el agente hizo afuera y la puerta `agentes` por donde leen y escriben.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (MANAGED-AGENTS-REQUISITOS-DEL-MODELO-DE-DATOS.md, decisiones del usuario del 2026-11-10; el diseño entero en
-- docs/_privado/modelo-de-datos/27-MANAGED-AGENTS.md)
--
-- Siete herramientas pasan a ser managed agents de GoHighLevel: Triage, Sales Assistant, Sales Coach, Brief, Research,
-- Estratega y Funnel Builder. Corren DENTRO de GHL (los dispara un workflow; leen todo GHL con su API) y tienen que
-- dejar sus salidas en esta base, con estructura, para que el siguiente agente, el cerebro y las pantallas las lean.
--
-- LA PUERTA. Durante la prueba, el agente entra por el MCP de Supabase, que corre como `postgres`: omite la RLS y ve
-- TODAS las organizaciones. Por eso un agente no escribe en las tablas: llama a las funciones del esquema `agentes`,
-- y cada función se ata a la cuenta de su corrida y filtra por ella explícitamente (no confía en la RLS, que ese rol
-- no tiene). El día del ARIA MCP, nuestro servidor llama a ESTAS MISMAS funciones como `app_inquilino` dentro de
-- `conOrganizacion()`: la RLS se suma y nada cambia de forma. Las funciones son `security invoker` (corren con el rol
-- de quien llama) y nunca ponen `app.org_id`: si la sesión ya tiene una organización, exigen que sea la de la corrida.
--
-- LA CORRIDA. Cada vez que un agente trabaja sobre un sujeto (un lead, una cita, una llamada, un comprador) abre una
-- corrida: guarda lo que leyó en GHL (la entrada), lo que le dimos de acá (lo leído), lo que devolvió (la salida), con
-- qué versión, cuánto tardó y cómo terminó. Es el registro, la idempotencia (una clave por disparador) y la auditoría:
-- sin ella no se puede explicar por qué un lead quedó donde quedó ni comparar dos versiones de una skill.
--
-- EL DATO CON PROCEDENCIA. Todo lo que un agente afirma de una persona o un negocio lleva estado, valor, fuente, cita
-- y confianza, y la cita se coteja EN LA BASE contra el texto de la fuente: un «detectado» cuya cita no aparece baja a
-- «ambiguo» (el patrón de lib/agentes/brief/brief.ts). Una fuente que no estaba ni en la entrada ni en lo leído
-- rechaza la salida entera.
--
-- LO QUE NO HAY. No hay cola hacia GHL ni hacia Slack: el agente de GHL escribe en el contacto y avisa por sí mismo, y
-- acá queda el registro de lo que hizo (`acciones_externas`). No hay orquestador en Comando Central: la corrida la
-- abre el agente.
--
-- Reaplicable: `if not exists`, `create or replace`, `on conflict do nothing`. Sin relleno de filas de negocio.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · El idioma de los agentes ────────────────────────────────────────────────

create table if not exists catalogo.agentes (
  clave              catalogo.clave primary key,
  nombre             text not null,
  departamento       catalogo.clave references catalogo.departamentos (clave),
  sujeto             text not null check (sujeto in ('contacto', 'cita', 'llamada', 'comprador')),
  cuenta_de_trabajo  text not null check (cuenta_de_trabajo in ('vendedor', 'comprador')),
  objetivo           text not null,
  disparadores       text[] not null default '{}',
  requiere_aprobacion boolean not null default false,
  orden              smallint not null,
  vigente            boolean not null default true
);
comment on table catalogo.agentes is
  'Los managed agents (110). Uno nuevo es un INSERT. cuenta_de_trabajo dice dónde quedan sus salidas: en la cuenta del vendedor (los del lead) o en la del comprador (los del cliente que compró).';
comment on column catalogo.agentes.sujeto is 'Sobre qué trabaja una corrida: un contacto, una cita, una llamada o un comprador (el cliente que compró).';
comment on column catalogo.agentes.disparadores is 'Los hechos del recorrido que lo arrancan (claves de catalogo.tipos_de_evento o descripciones del workflow de GHL). Informativo: lo dispara GHL.';
comment on column catalogo.agentes.requiere_aprobacion is 'true = su salida queda esperando que una persona (closer, coach, cliente) la apruebe.';

insert into catalogo.agentes (clave, nombre, departamento, sujeto, cuenta_de_trabajo, objetivo, disparadores, requiere_aprobacion, orden) values
  ('triage', 'Triage', 'sales', 'contacto', 'vendedor',
   'Que el equipo priorice primero a los leads que más encajan y pueden comprar.', '{formulario_enviado,pregunta_respondida,respondio_video}', false, 1),
  ('sales_assistant', 'Sales Assistant', 'sales', 'cita', 'vendedor',
   'Que el closer llegue preparado.', '{cita_agendada,mensaje_entrante,cita_reagendada,cuadrante_cambiado,transcripcion_lista}', false, 2),
  ('sales_coach', 'Sales Coach', 'sales', 'llamada', 'vendedor',
   'Que ninguna llamada termine sin resultado registrado ni next steps.', '{transcripcion_lista}', true, 3),
  ('brief', 'Brief Agent', 'client_success', 'comprador', 'comprador',
   'Que el cliente sólo tenga que confirmar y completar el Brief, no responderlo desde cero.', '{venta_cerrada,pago_recibido}', true, 4),
  ('research', 'Research', 'research', 'comprador', 'comprador',
   'Que el cliente llegue a la Kickoff con su mercado investigado, listo para aprobar.', '{brief_enviado}', true, 5),
  ('estratega', 'Estratega', 'research', 'comprador', 'comprador',
   'Convertir el research en una oferta que el mercado ya está buscando.', '{entregable_aprobado}', true, 6),
  ('funnel_builder', 'Funnel Builder', 'marketing', 'comprador', 'comprador',
   'Que el cliente tenga todo lo que necesita para lanzar su embudo.', '{entregable_aprobado}', true, 7)
on conflict do nothing;

create table if not exists catalogo.tipos_de_conocimiento (
  clave        catalogo.clave primary key,
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.tipos_de_conocimiento is
  'Lo que cada cuenta sabe de sí misma y usan sus agentes (negocio.conocimiento_de_la_cuenta): ICP, matriz de scoring, script, manual de objeciones, rutas, preguntas del Brief, reglas de agentes. Uno nuevo es un INSERT.';
insert into catalogo.tipos_de_conocimiento (clave, nombre, descripcion) values
  ('icp', 'ICP', 'El cliente ideal de la cuenta: a quién sí y a quién no venderle, con criterios legibles por máquina.'),
  ('matriz_de_scoring', 'Matriz de lead scoring', 'Criterios, pesos y knockouts con los que se califica a un lead.'),
  ('script_de_ventas', 'Script de ventas', 'Las fases de la llamada de venta y lo que se espera en cada una.'),
  ('manual_de_objeciones', 'Manual de objeciones', 'Cada objeción, su categoría y la respuesta recomendada.'),
  ('rutas', 'Rutas comerciales', 'Las ofertas a las que se dirige un lead (Accelerator, low ticket, nutrición).'),
  ('preguntas_del_brief', 'Preguntas del Brief', 'El formulario de onboarding, si la cuenta tiene uno propio.'),
  ('reglas_de_agentes', 'Reglas de agentes', 'Lo que se define en la Kickoff y el Coaching: tono, preguntas de calificación, umbrales.')
on conflict do nothing;

create table if not exists catalogo.tipos_de_fuente_publica (
  clave        catalogo.clave primary key,
  nombre       text not null,
  vigente      boolean not null default true
);
comment on table catalogo.tipos_de_fuente_publica is 'De dónde salió una evidencia pública (negocio.fuentes_publicas). Uno nuevo es un INSERT.';
insert into catalogo.tipos_de_fuente_publica (clave, nombre) values
  ('web', 'Web'), ('instagram', 'Instagram'), ('google_maps', 'Google Maps'), ('google_resena', 'Reseña de Google'),
  ('anuncio_meta', 'Anuncio de Meta'), ('foro', 'Foro'), ('competidor', 'Competidor'), ('otro', 'Otro')
on conflict do nothing;

insert into catalogo.proveedores (clave, nombre) values
  ('ghl_managed_agents', 'Managed Agents de GoHighLevel'), ('slack', 'Slack')
on conflict do nothing;

insert into catalogo.vias_de_obtencion (clave, nombre, descripcion) values
  ('brief', 'Brief', 'Lo confirmó o lo escribió el cliente en el Brief de onboarding.'),
  ('agente_ia', 'Managed agent', 'Lo extrajo un managed agent (la corrida dice cuál y de qué fuente).')
on conflict do nothing;

insert into catalogo.tipos_de_cita (clave, nombre, descripcion, es_de_venta) values
  ('kickoff', 'Kickoff', 'La primera llamada con el coach después del Brief: se revisa y aprueba el Research.', false)
on conflict do nothing;

insert into catalogo.dominios_de_evento (clave, nombre, descripcion) values
  ('agentes', 'Agentes', 'Las corridas de los managed agents, sus salidas, sus aprobaciones y lo que hicieron afuera.')
on conflict do nothing;

-- Los tipos de evento nuevos (§ 9.1 del documento de requisitos). Los que ya existen se reusan.
insert into catalogo.tipos_de_evento (clave, version, dominio, nombre, descripcion, etapa_que_marca, esquema_de_datos) values
  ('agente_corrida_lista', 1, 'agentes', 'Corrida de agente lista', 'Un managed agent entregó una salida válida.', null,
   '{"type":"object","required":["corrida_id","agente"],"properties":{"corrida_id":{"type":"string","format":"uuid"},"agente":{"type":"string"},"estado":{"type":"string"}}}'),
  ('agente_corrida_fallida', 1, 'agentes', 'Corrida de agente fallida', 'Un managed agent no pudo terminar.', null,
   '{"type":"object","required":["corrida_id","agente"],"properties":{"corrida_id":{"type":"string","format":"uuid"},"agente":{"type":"string"},"error":{"type":"string"}}}'),
  ('accion_externa_registrada', 1, 'agentes', 'Acción del agente afuera', 'El agente escribió en GHL, avisó por Slack o mandó un mensaje.', null,
   '{"type":"object","required":["accion_id","tipo"],"properties":{"accion_id":{"type":"string","format":"uuid"},"tipo":{"type":"string"},"corrida_id":{"type":"string","format":"uuid"}}}'),
  ('conocimiento_publicado', 1, 'agentes', 'Conocimiento publicado', 'Una versión nueva del ICP, la matriz, el script u otro conocimiento de la cuenta.', null,
   '{"type":"object","required":["tipo","version"],"properties":{"tipo":{"type":"string"},"version":{"type":"integer"}}}'),
  ('triaje_registrado', 1, 'calificacion', 'Triaje registrado', 'El Triage guardó prioridad, ruta, razones y faltantes del lead.', null,
   '{"type":"object","required":["triaje_id","corrida_id"],"properties":{"triaje_id":{"type":"string","format":"uuid"},"corrida_id":{"type":"string","format":"uuid"},"prioridad":{"type":"integer"},"ruta":{"type":"string"},"cuadrante_propuesto":{"type":"string"}}}'),
  ('ruta_asignada', 1, 'calificacion', 'Ruta asignada', 'El lead quedó dirigido a una ruta comercial de la cuenta.', null,
   '{"type":"object","required":["ruta"],"properties":{"ruta":{"type":"string"},"corrida_id":{"type":"string","format":"uuid"}}}'),
  ('ficha_generada', 1, 'venta', 'Ficha del lead generada', 'El Sales Assistant preparó (o actualizó) la ficha para el closer.', null,
   '{"type":"object","required":["ficha_id","version"],"properties":{"ficha_id":{"type":"string","format":"uuid"},"version":{"type":"integer"},"cita_id":{"type":"string","format":"uuid"}}}'),
  ('ficha_leida', 1, 'venta', 'Ficha leída por el closer', 'El closer abrió la ficha del lead.', null,
   '{"type":"object","required":["ficha_id"],"properties":{"ficha_id":{"type":"string","format":"uuid"}}}'),
  ('transcripcion_lista', 1, 'llamada', 'Transcripción lista', 'La transcripción de una llamada quedó guardada.', null,
   '{"type":"object","required":["llamada_id","tipo"],"properties":{"llamada_id":{"type":"string","format":"uuid"},"tipo":{"type":"string"}}}'),
  ('llamada_vinculada', 1, 'llamada', 'Llamada vinculada', 'Una llamada quedó unida a su lead y a su cita.', null,
   '{"type":"object","required":["llamada_id"],"properties":{"llamada_id":{"type":"string","format":"uuid"},"vinculada_por":{"type":"string"}}}'),
  ('resultado_propuesto', 1, 'venta', 'Resultado propuesto', 'El Sales Coach propuso el resultado de la llamada; falta que el closer lo confirme.', null,
   '{"type":"object","required":["resultado_propuesto_id"],"properties":{"resultado_propuesto_id":{"type":"string","format":"uuid"},"compro":{"type":"boolean"}}}'),
  ('seguimiento_redactado', 1, 'conversacion', 'Seguimiento redactado', 'Un agente redactó un mensaje de seguimiento para el lead.', null,
   '{"type":"object","required":["borrador_id","motivo"],"properties":{"borrador_id":{"type":"string","format":"uuid"},"motivo":{"type":"string"}}}'),
  ('llamada_evaluada', 1, 'llamada', 'Llamada evaluada', 'El Sales Coach evaluó la llamada contra el script.', null,
   '{"type":"object","required":["evaluacion_id"],"properties":{"evaluacion_id":{"type":"string","format":"uuid"},"puntaje":{"type":"number"}}}'),
  ('objecion_registrada', 1, 'venta', 'Objeción registrada', 'Una objeción de la llamada, con su texto y si se superó.', null,
   '{"type":"object","required":["objecion_id","categoria"],"properties":{"objecion_id":{"type":"string","format":"uuid"},"categoria":{"type":"string"},"resuelta":{"type":"boolean"}}}'),
  ('cliente_creado', 1, 'onboarding', 'Cliente creado', 'El lead compró: quedó el registro de la venta y su cuenta de cliente.', null,
   '{"type":"object","required":["cliente_id"],"properties":{"cliente_id":{"type":"string","format":"uuid"},"ruta":{"type":"string"},"nivel":{"type":"integer"}}}'),
  ('contrato_firmado', 1, 'onboarding', 'Contrato firmado', 'El cliente firmó el contrato.', null,
   '{"type":"object","required":["cliente_id"],"properties":{"cliente_id":{"type":"string","format":"uuid"}}}'),
  ('brief_enviado', 1, 'onboarding', 'Brief enviado', 'El cliente confirmó y envió su Brief.', null,
   '{"type":"object","required":["entregable_id","version"],"properties":{"entregable_id":{"type":"string","format":"uuid"},"version":{"type":"integer"}}}'),
  ('entregable_propuesto', 1, 'onboarding', 'Entregable propuesto', 'Un agente entregó una versión de un entregable del cliente.', null,
   '{"type":"object","required":["entregable_id","tipo","version"],"properties":{"entregable_id":{"type":"string","format":"uuid"},"tipo":{"type":"string"},"version":{"type":"integer"}}}'),
  ('entregable_aprobado', 1, 'onboarding', 'Entregable aprobado', 'Una persona aprobó una versión de un entregable.', null,
   '{"type":"object","required":["entregable_id","tipo","version"],"properties":{"entregable_id":{"type":"string","format":"uuid"},"tipo":{"type":"string"},"version":{"type":"integer"}}}'),
  ('entregable_rechazado', 1, 'onboarding', 'Entregable rechazado', 'Una persona rechazó una versión de un entregable.', null,
   '{"type":"object","required":["entregable_id","tipo","version"],"properties":{"entregable_id":{"type":"string","format":"uuid"},"tipo":{"type":"string"},"version":{"type":"integer"},"motivo":{"type":"string"}}}'),
  ('entregable_corregido', 1, 'onboarding', 'Entregable corregido', 'Una persona o el cliente escribió una versión corregida.', null,
   '{"type":"object","required":["entregable_id","tipo","version"],"properties":{"entregable_id":{"type":"string","format":"uuid"},"tipo":{"type":"string"},"version":{"type":"integer"}}}'),
  ('entregable_desactualizado', 1, 'onboarding', 'Entregable desactualizado', 'Cambió un entregable del que dependía.', null,
   '{"type":"object","required":["entregable_id","tipo"],"properties":{"entregable_id":{"type":"string","format":"uuid"},"tipo":{"type":"string"},"por":{"type":"string"}}}'),
  ('kickoff_realizada', 1, 'onboarding', 'Kickoff realizada', 'Se hizo la Kickoff con el coach y quedaron sus decisiones.', null,
   '{"type":"object","properties":{"cita_id":{"type":"string","format":"uuid"},"decisiones":{"type":"integer"}}}')
on conflict do nothing;

-- ─── 2 · El esquema de la puerta ─────────────────────────────────────────────────

create schema if not exists agentes;
comment on schema agentes is
  'La puerta de los managed agents (110): funciones para abrir una corrida, leer lo que la base sabe y registrar cada salida validada. Sin tablas. Hoy las llama el MCP de Supabase (como postgres); mañana, el ARIA MCP (como app_inquilino).';
revoke all on schema agentes from public;
-- Ninguna función de este esquema es de PUBLIC: lo hace el bucle del final de CADA migración que crea funciones acá
-- (una regla por omisión POR ESQUEMA no sirve: sólo puede sumar permisos, no quitar el de PUBLIC), y lo vigila la 500.
grant usage on schema agentes to app_inquilino, agente_mcp;
grant usage on schema negocio, identidad, catalogo to agente_mcp;

-- ─── 3 · Las corridas ────────────────────────────────────────────────────────────

-- Las llamadas (la 011) no tenían la terna única que piden las claves foráneas «misma cuenta».
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'negocio.llamadas'::regclass and conname = 'llamadas_org_cuenta_id') then
    alter table negocio.llamadas add constraint llamadas_org_cuenta_id unique (org_id, cuenta_id, id);
  end if;
end $$;

create table if not exists negocio.corridas_de_agente (
  org_id               uuid not null references identidad.organizaciones (id),
  cuenta_id            uuid not null,
  id                   uuid not null default gen_random_uuid(),
  agente               catalogo.clave not null references catalogo.agentes (clave),
  modo                 text not null default 'activo' check (modo in ('activo', 'sombra')),
  sujeto_clave         text not null check (length(sujeto_clave) between 1 and 300),
  contacto_id          uuid,
  ghl_contact_id       text check (ghl_contact_id is null or length(ghl_contact_id) between 1 and 100),
  cita_id              uuid,
  llamada_id           uuid,
  cliente_id           uuid,
  vendedor_org_id      uuid references identidad.organizaciones (id),
  vendedor_cuenta_id   uuid,
  vendedor_contacto_id uuid,
  disparador           text check (disparador is null or length(disparador) <= 200),
  clave_de_idempotencia text not null check (length(clave_de_idempotencia) between 1 and 300),
  motivo               text not null default 'primera_vez'
                         check (motivo in ('primera_vez', 'datos_nuevos', 'reintento', 'manual', 'reproceso')),
  estado               text not null default 'abierta'
                         check (estado in ('abierta', 'lista', 'esperando_aprobacion', 'aprobada', 'rechazada',
                                           'fallida', 'cancelada', 'reemplazada')),
  entrada              jsonb not null default '{}'::jsonb,
  entrada_huella       text not null,
  leido                jsonb not null default '{}'::jsonb,
  conocimiento         jsonb not null default '{}'::jsonb,
  salida               jsonb,
  degradados           integer not null default 0 check (degradados >= 0),
  errores              jsonb,
  intentos             integer not null default 0 check (intentos >= 0),
  ultimo_error         text,
  sesion_externa_id    text check (sesion_externa_id is null or length(sesion_externa_id) <= 300),
  version_del_agente   text check (version_del_agente is null or length(version_del_agente) <= 100),
  version_de_la_skill  text check (version_de_la_skill is null or length(version_de_la_skill) <= 100),
  modelo               text check (modelo is null or length(modelo) <= 100),
  tokens_entrada       integer check (tokens_entrada >= 0),
  tokens_salida        integer check (tokens_salida >= 0),
  costo_usd            numeric(12,6) check (costo_usd >= 0),
  abierta_el           timestamptz not null default now(),
  terminada_el         timestamptz,
  duracion_ms          integer check (duracion_ms >= 0),
  reemplazada_por      uuid,
  primary key (org_id, id),
  unique (org_id, cuenta_id, id),
  unique (org_id, cuenta_id, agente, clave_de_idempotencia),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  foreign key (vendedor_org_id, vendedor_cuenta_id) references identidad.cuentas (org_id, id),
  constraint corridas_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete set null (contacto_id),
  constraint corridas_misma_cuenta_que_la_cita
    foreign key (org_id, cuenta_id, cita_id) references negocio.citas (org_id, cuenta_id, id) on delete set null (cita_id),
  constraint corridas_misma_cuenta_que_la_llamada
    foreign key (org_id, cuenta_id, llamada_id) references negocio.llamadas (org_id, cuenta_id, id) on delete set null (llamada_id),
  check (jsonb_typeof(entrada) = 'object' and octet_length(entrada::text) <= 1048576),
  check (jsonb_typeof(leido) = 'object'),
  check ((vendedor_org_id is null) = (vendedor_cuenta_id is null)),
  check ((estado in ('abierta')) = (terminada_el is null) or estado = 'reemplazada')
);
create index if not exists corridas_por_id on negocio.corridas_de_agente (id);
create unique index if not exists corridas_una_abierta_por_sujeto
  on negocio.corridas_de_agente (org_id, cuenta_id, agente, sujeto_clave) where estado = 'abierta';
create index if not exists corridas_por_agente on negocio.corridas_de_agente (org_id, cuenta_id, agente, abierta_el desc);
create index if not exists corridas_por_contacto on negocio.corridas_de_agente (org_id, cuenta_id, contacto_id, abierta_el desc) where contacto_id is not null;
create index if not exists corridas_sin_contacto on negocio.corridas_de_agente (org_id, cuenta_id, ghl_contact_id) where contacto_id is null and ghl_contact_id is not null;
comment on table negocio.corridas_de_agente is
  'Cada vez que un managed agent trabaja sobre un sujeto (110): lo que leyó en GHL, lo que le dio la base, lo que devolvió, con qué versión y cómo terminó. Registro, idempotencia y auditoría. Vive en la cuenta donde quedan sus salidas.';
comment on column negocio.corridas_de_agente.modo is 'activo = sus salidas cuentan; sombra = se guardan para comparar y no se publican en el contacto.';
comment on column negocio.corridas_de_agente.sujeto_clave is 'El sujeto de la corrida (contacto:…, cita:…, llamada:…, comprador:…:paso). Una sola corrida abierta por agente y sujeto: abrir otra reemplaza a la anterior.';
comment on column negocio.corridas_de_agente.ghl_contact_id is 'El contacto de GHL con el que se abrió. Si el lead todavía no había llegado a la base, contacto_id queda nulo y el disparador de contactos lo completa al llegar.';
comment on column negocio.corridas_de_agente.cliente_id is 'El registro de la venta (negocio.clientes, en la cuenta del VENDEDOR) en los agentes del comprador. Referencia blanda: vive en otra organización.';
comment on column negocio.corridas_de_agente.vendedor_cuenta_id is 'En los agentes del comprador, la cuenta del vendedor donde está el lead que compró (de donde se leen la ficha, el resultado y la llamada).';
comment on column negocio.corridas_de_agente.vendedor_contacto_id is 'El lead que compró, en la cuenta del vendedor. Referencia blanda (otra organización).';
comment on column negocio.corridas_de_agente.clave_de_idempotencia is 'La da el agente desde su disparador (p. ej. triage:{contact_id}:{form_submission_id}). Repetirla devuelve la misma corrida.';
comment on column negocio.corridas_de_agente.entrada is 'Lo que el agente leyó en GHL y nos manda, con sus fuentes citables en entrada.fuentes {clave: texto}. Es lo que permite reproducir la corrida y cotejar cada cita.';
comment on column negocio.corridas_de_agente.leido is 'Lo que la base le dio (agentes.leer_*), con sus fuentes citables en leido.fuentes {clave: texto}.';
comment on column negocio.corridas_de_agente.conocimiento is 'Las versiones del conocimiento de la cuenta que usó: {"icp": 3, "matriz_de_scoring": 2}.';
comment on column negocio.corridas_de_agente.salida is 'La salida tal cual quedó después de validarla (con los datos degradados ya marcados).';
comment on column negocio.corridas_de_agente.degradados is 'Cuántos datos «detectado» bajaron a «ambiguo» porque su cita no estaba en la fuente. Indicador de calidad de la skill.';
comment on column negocio.corridas_de_agente.errores is 'Los errores del último intento rechazado (la salida no cumplía el contrato). La corrida sigue abierta para que el agente corrija.';

select negocio.aplicar_aislamiento_de_cuenta('negocio.corridas_de_agente', true);
revoke delete, truncate on negocio.corridas_de_agente from app_inquilino;
grant select, insert on negocio.corridas_de_agente to agente_mcp;
-- Lo que cambia mientras corre; la entrada, la clave, el agente y las cuentas no se reescriben.
grant update (estado, contacto_id, leido, conocimiento, salida, degradados, errores, intentos, ultimo_error,
              terminada_el, duracion_ms, reemplazada_por) on negocio.corridas_de_agente to agente_mcp;

-- ─── 4 · El conocimiento de la cuenta ────────────────────────────────────────────

create table if not exists negocio.conocimiento_de_la_cuenta (
  org_id                 uuid not null references identidad.organizaciones (id),
  cuenta_id              uuid not null,
  id                     uuid not null default gen_random_uuid(),
  tipo                   catalogo.clave not null references catalogo.tipos_de_conocimiento (clave),
  version                integer not null check (version >= 1),
  contenido              jsonb not null default '{}'::jsonb,
  contenido_texto        text check (contenido_texto is null or length(contenido_texto) <= 200000),
  origen                 text not null default 'manual' check (origen in ('manual', 'entregable', 'importado')),
  entregable_version_id  uuid,
  aprobado_por           uuid,
  aprobado_el            timestamptz,
  creado_el              timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, cuenta_id, tipo, version),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  foreign key (org_id, aprobado_por) references identidad.usuarios (org_id, id),
  check (jsonb_typeof(contenido) in ('object', 'array')),
  check (contenido <> '{}'::jsonb or contenido_texto is not null)
);
comment on table negocio.conocimiento_de_la_cuenta is
  'Lo que la cuenta sabe de sí misma y usan sus agentes (110), de sólo agregar y versionado por tipo: ICP, matriz de scoring, script de ventas, manual de objeciones, rutas, reglas. La vigente es la última aprobada (vista conocimiento_vigente).';
comment on column negocio.conocimiento_de_la_cuenta.contenido is 'La forma estructurada (la matriz con criterios, pesos y knockouts; el ICP con a_quien_si / a_quien_no).';
comment on column negocio.conocimiento_de_la_cuenta.contenido_texto is 'El mismo conocimiento en markdown, para el agente y para leer. Un pdf o un documento se guarda convertido a md.';
comment on column negocio.conocimiento_de_la_cuenta.origen is 'manual (lo cargó el equipo), entregable (se publicó desde un entregable aprobado, p. ej. el ICP del Estratega) o importado.';
comment on column negocio.conocimiento_de_la_cuenta.aprobado_el is 'Nula = borrador: no lo lee ningún agente.';
create index if not exists conocimiento_vigente_por_tipo
  on negocio.conocimiento_de_la_cuenta (org_id, cuenta_id, tipo, version desc) where aprobado_el is not null;
select negocio.aplicar_aislamiento_de_cuenta('negocio.conocimiento_de_la_cuenta', true);
revoke update, delete, truncate on negocio.conocimiento_de_la_cuenta from app_inquilino;
grant select, insert on negocio.conocimiento_de_la_cuenta to agente_mcp;

create or replace view negocio.conocimiento_vigente with (security_invoker = true) as
  select distinct on (k.org_id, k.cuenta_id, k.tipo)
         k.org_id, k.cuenta_id, k.tipo, k.version, k.id, k.contenido, k.contenido_texto, k.origen, k.aprobado_el
    from negocio.conocimiento_de_la_cuenta k
   where k.aprobado_el is not null
   order by k.org_id, k.cuenta_id, k.tipo, k.version desc;
comment on view negocio.conocimiento_vigente is 'La última versión aprobada de cada conocimiento de cada cuenta (110). Lo que leen los agentes.';
revoke all on negocio.conocimiento_vigente from public, app_inquilino;
grant select on negocio.conocimiento_vigente to app_inquilino, agente_mcp;

-- ─── 5 · La evidencia pública ────────────────────────────────────────────────────

create table if not exists negocio.fuentes_publicas (
  org_id        uuid not null references identidad.organizaciones (id),
  cuenta_id     uuid not null,
  id            uuid not null default gen_random_uuid(),
  corrida_id    uuid,
  contacto_id   uuid,
  cliente_id    uuid,
  tipo          catalogo.clave not null references catalogo.tipos_de_fuente_publica (clave),
  url           text check (url is null or length(url) <= 2000),
  titulo        text check (titulo is null or length(titulo) <= 500),
  extracto      text not null check (length(extracto) between 1 and 8000),
  datos         jsonb not null default '{}'::jsonb,
  obtenida_por  text not null check (length(obtenida_por) between 1 and 200),
  observada_el  timestamptz not null default now(),
  vigente_hasta timestamptz,
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint fuentes_publicas_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete set null (corrida_id),
  constraint fuentes_publicas_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  check (jsonb_typeof(datos) = 'object' and octet_length(datos::text) <= 65536)
);
create index if not exists fuentes_publicas_por_contacto on negocio.fuentes_publicas (org_id, cuenta_id, contacto_id, observada_el desc) where contacto_id is not null;
create index if not exists fuentes_publicas_por_cliente on negocio.fuentes_publicas (org_id, cuenta_id, cliente_id, observada_el desc) where cliente_id is not null;
comment on table negocio.fuentes_publicas is
  'La evidencia que un agente encontró afuera (web, Instagram, Google, anuncios, foros, Apify), registrada antes de citarla (110). El Brief reusa lo que encontró el Sales Assistant; el Funnel Builder, las citas del Research.';
comment on column negocio.fuentes_publicas.extracto is 'El texto relevante, recortado. Es lo que se coteja cuando el agente cita «publica:{id}».';
comment on column negocio.fuentes_publicas.obtenida_por is 'Cómo se obtuvo: apify:{actor}, web_fetch, ghl, scraper_cc:{trabajo_id}.';
comment on column negocio.fuentes_publicas.vigente_hasta is 'Hasta cuándo se puede reusar sin volver a mirar (la web cambia). Nula = sin vencimiento.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.fuentes_publicas', true);
revoke update, delete, truncate on negocio.fuentes_publicas from app_inquilino;
grant select, insert on negocio.fuentes_publicas to agente_mcp;

-- ─── 6 · Lo que el agente hizo afuera ────────────────────────────────────────────

create table if not exists negocio.acciones_externas (
  org_id        uuid not null references identidad.organizaciones (id),
  cuenta_id     uuid not null,
  id            uuid not null default gen_random_uuid(),
  corrida_id    uuid not null,
  contacto_id   uuid,
  tipo          text not null check (tipo in ('campo_del_crm', 'etiqueta', 'nota', 'mensaje', 'aviso_slack', 'workflow', 'otra')),
  destino       text not null check (length(destino) between 1 and 300),
  contenido     jsonb not null default '{}'::jsonb,
  id_externo    text check (id_externo is null or length(id_externo) <= 300),
  ocurrio_el    timestamptz not null default now(),
  registrada_el timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint acciones_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete cascade,
  constraint acciones_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  check (jsonb_typeof(contenido) = 'object' and octet_length(contenido::text) <= 65536)
);
create index if not exists acciones_por_corrida on negocio.acciones_externas (org_id, cuenta_id, corrida_id);
comment on table negocio.acciones_externas is
  'Lo que un managed agent hizo FUERA de la base (110): el campo de GHL que escribió, la etiqueta, el aviso de Slack, el mensaje. El agente de GHL lo hace por sí mismo; acá queda el registro para auditar y medir (no es una cola).';
comment on column negocio.acciones_externas.destino is 'Dónde: el fieldKey (contact.prioridad_de_llamada), el canal de Slack, el canal del mensaje.';
comment on column negocio.acciones_externas.contenido is 'Qué escribió, sin teléfono ni correo. Para Slack, el resumen y el enlace; no la ficha completa.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.acciones_externas', true);
revoke update, delete, truncate on negocio.acciones_externas from app_inquilino;
grant select, insert on negocio.acciones_externas to agente_mcp;

grant insert on negocio.eventos to agente_mcp;

-- ─── 7 · Las piezas internas de la puerta ────────────────────────────────────────

-- La corrida, validada contra la sesión: si quien llama ya tiene una organización (el ARIA MCP, dentro de
-- conOrganizacion), tiene que ser la de la corrida. Nunca se cambia de organización.
create or replace function agentes._corrida(p_corrida uuid, p_para_escribir boolean default true)
returns negocio.corridas_de_agente
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v       negocio.corridas_de_agente;
  v_sesion text := nullif(btrim(current_setting('app.org_id', true)), '');
begin
  if p_corrida is null then
    raise exception using errcode = '22004', message = 'agentes: falta el id de la corrida';
  end if;
  if p_para_escribir then
    -- La fila bloqueada: dos registrar_* de la misma corrida a la vez se esperan, y el segundo la ve cerrada.
    select * into v from negocio.corridas_de_agente c where c.id = p_corrida for update;
  else
    select * into v from negocio.corridas_de_agente c where c.id = p_corrida;
  end if;
  if not found then
    raise exception using errcode = 'P0002', message = format('agentes: la corrida %s no existe', p_corrida);
  end if;
  if v_sesion is not null and v_sesion::uuid <> v.org_id then
    raise exception using errcode = '42501', message = 'agentes: la corrida es de otra organización que la de la sesión';
  end if;
  if p_para_escribir and v.estado <> 'abierta' then
    raise exception using errcode = '55000',
      message = format('agentes: la corrida %s está «%s» y ya no recibe salidas (abre una nueva)', p_corrida, v.estado);
  end if;
  return v;
end $$;

-- Un evento del agente, en la cuenta de la corrida. Idempotente por (corrida, tipo, sufijo).
-- EL ÚNICO ESCRITOR DE EVENTOS de los agentes (la prueba 332 lo exige). Idempotente de verdad: la clave única de
-- negocio.eventos lleva ocurrio_el, así que un reintento con otra hora la esquivaría; acá se busca por
-- (cuenta, fuente, id_externo) antes de escribir, con un candado para dos llamadas simultáneas.
create or replace function agentes._registrar_evento(
  p_org uuid, p_cuenta uuid, p_tipo text, p_contacto uuid, p_actor_tipo text, p_actor_id text, p_fuente text,
  p_id_externo text, p_datos jsonb default '{}'::jsonb, p_ocurrio_el timestamptz default null)
returns uuid
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v_id   uuid;
  v_ext  text := left(p_id_externo, 300);
begin
  perform pg_advisory_xact_lock(hashtextextended('evento:' || p_cuenta || ':' || p_fuente || ':' || v_ext, 0));
  select e.id into v_id from negocio.eventos e
   where e.org_id = p_org and e.cuenta_id = p_cuenta and e.fuente = p_fuente and e.id_externo = v_ext
   limit 1;
  if v_id is not null then
    return v_id;
  end if;
  v_id := gen_random_uuid();
  insert into negocio.eventos (org_id, cuenta_id, id, ocurrio_el, tipo, contacto_id, actor_tipo, actor_id, fuente, id_externo, datos)
  values (p_org, p_cuenta, v_id, least(coalesce(p_ocurrio_el, now()), now()), p_tipo, p_contacto, p_actor_tipo, p_actor_id,
          p_fuente, v_ext, coalesce(p_datos, '{}'::jsonb))
  on conflict do nothing;
  return v_id;
end $$;

-- Un evento del agente, en la cuenta de la corrida. Idempotente por (corrida, tipo, sufijo).
create or replace function agentes._evento(
  p_corrida negocio.corridas_de_agente, p_tipo text, p_datos jsonb default '{}'::jsonb,
  p_contacto uuid default null, p_sufijo text default null, p_actor_tipo text default 'agente_ia', p_actor_id text default null)
returns uuid
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
begin
  return agentes._registrar_evento(p_corrida.org_id, p_corrida.cuenta_id, p_tipo, coalesce(p_contacto, p_corrida.contacto_id),
    p_actor_tipo, coalesce(p_actor_id, p_corrida.agente), 'ghl_managed_agents',
    'corrida:' || p_corrida.id || ':' || p_tipo || coalesce(':' || p_sufijo, ''),
    coalesce(p_datos, '{}'::jsonb) || jsonb_build_object('corrida_id', p_corrida.id));
end $$;

-- Casteos que devuelven nulo en vez de lanzar: con ellos, un valor mal escrito se rechaza con un error legible.
create or replace function agentes._numero(p text) returns numeric
language plpgsql immutable security invoker set search_path = pg_catalog, pg_temp
as $$ begin return p::numeric; exception when others then return null; end $$;
create or replace function agentes._fecha(p text) returns timestamptz
language plpgsql stable security invoker set search_path = pg_catalog, pg_temp
as $$ begin return p::timestamptz; exception when others then return null; end $$;
-- ¿El valor está y no es un número válido entre p_min y p_max?
create or replace function agentes._numero_malo(p jsonb, p_min numeric, p_max numeric) returns boolean
language sql immutable security invoker set search_path = pg_catalog, pg_temp
as $$ select p is not null and jsonb_typeof(p) <> 'null'
         and (agentes._numero(p #>> '{}') is null or agentes._numero(p #>> '{}') not between p_min and p_max) $$;
create or replace function agentes._booleano(p jsonb) returns boolean
language sql immutable security invoker set search_path = pg_catalog, pg_temp
as $$ select case when jsonb_typeof(p) = 'boolean' then (p #>> '{}')::boolean end $$;
-- ¿El valor está y no es un booleano JSON?
create or replace function agentes._booleano_malo(p jsonb) returns boolean
language sql immutable security invoker set search_path = pg_catalog, pg_temp
as $$ select p is not null and jsonb_typeof(p) not in ('null', 'boolean') $$;

-- El texto normalizado para cotejar una cita: minúsculas y espacios colapsados.
create or replace function agentes._normal(p_texto text) returns text
language sql immutable security invoker set search_path = pg_catalog, pg_temp
as $$ select btrim(regexp_replace(lower(coalesce(p_texto, '')), '\s+', ' ', 'g')) $$;

-- El texto de una fuente citable: en lo que mandó el agente (entrada.fuentes) o en lo que le dio la base
-- (leido.fuentes). Un valor que no es texto se coteja como su JSON.
create or replace function agentes._texto_de_la_fuente(p_corrida negocio.corridas_de_agente, p_fuente text) returns text
language sql stable security invoker set search_path = pg_catalog, pg_temp
as $$
  select case jsonb_typeof(f) when 'string' then f #>> '{}' else f::text end
    from (select coalesce(p_corrida.entrada -> 'fuentes' -> p_fuente, p_corrida.leido -> 'fuentes' -> p_fuente) as f) x
   where f is not null
$$;

-- Valida una lista de datos con procedencia (§ 5.4): devuelve {datos, degradados, errores}. Cada dato:
-- {campo, estado: detectado|inferido|ambiguo|no_consta, valor, fuente, cita, confianza: alta|media|baja}.
-- Un «detectado» cuya cita no aparece en su fuente baja a «ambiguo» (degradado = true). Una fuente que la corrida no
-- conoce es un error: el agente sólo cita lo que leyó.
create or replace function agentes._validar_datos(p_corrida negocio.corridas_de_agente, p_datos jsonb, p_donde text)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v_salida     jsonb := '[]'::jsonb;
  v_errores    jsonb := '[]'::jsonb;
  v_degradados integer := 0;
  v_dato       jsonb;
  v_i          integer := 0;
  v_estado     text;
  v_fuente     text;
  v_texto      text;
  v_cita       text;
begin
  if p_datos is null or jsonb_typeof(p_datos) = 'null' then
    return jsonb_build_object('datos', '[]'::jsonb, 'degradados', 0, 'errores', '[]'::jsonb);
  end if;
  if jsonb_typeof(p_datos) <> 'array' then
    return jsonb_build_object('datos', '[]'::jsonb, 'degradados', 0,
      'errores', jsonb_build_array(format('%s: tiene que ser una lista de datos con procedencia', p_donde)));
  end if;
  for v_dato in select value from jsonb_array_elements(p_datos) loop
    v_i := v_i + 1;
    if jsonb_typeof(v_dato) <> 'object' then
      v_errores := v_errores || to_jsonb(format('%s[%s]: no es un objeto', p_donde, v_i));
      continue;
    end if;
    v_estado := v_dato ->> 'estado';
    v_fuente := nullif(btrim(v_dato ->> 'fuente'), '');
    v_cita   := nullif(btrim(v_dato ->> 'cita'), '');
    if coalesce(btrim(v_dato ->> 'campo'), '') = '' then
      v_errores := v_errores || to_jsonb(format('%s[%s]: falta «campo»', p_donde, v_i));
    end if;
    if v_estado is null or v_estado not in ('detectado', 'inferido', 'ambiguo', 'no_consta') then
      v_errores := v_errores || to_jsonb(format('%s[%s]: «estado» tiene que ser detectado, inferido, ambiguo o no_consta', p_donde, v_i));
      continue;
    end if;
    if coalesce(v_dato ->> 'confianza', 'media') not in ('alta', 'media', 'baja') then
      v_errores := v_errores || to_jsonb(format('%s[%s]: «confianza» tiene que ser alta, media o baja', p_donde, v_i));
    end if;
    if v_estado <> 'no_consta' then
      if v_fuente is null then
        v_errores := v_errores || to_jsonb(format('%s[%s]: un dato %s necesita «fuente»', p_donde, v_i, v_estado));
        continue;
      end if;
      v_texto := agentes._texto_de_la_fuente(p_corrida, v_fuente);
      if v_texto is null then
        v_errores := v_errores || to_jsonb(format('%s[%s]: la fuente «%s» no está en la entrada ni en lo leído de la corrida', p_donde, v_i, v_fuente));
        continue;
      end if;
    end if;
    if v_estado = 'detectado' then
      if v_cita is null or position(agentes._normal(v_cita) in agentes._normal(v_texto)) = 0 then
        v_dato := v_dato || jsonb_build_object('estado', 'ambiguo', 'degradado', true,
                    'motivo_degradado', case when v_cita is null then 'sin cita' else 'la cita no está en la fuente' end);
        v_degradados := v_degradados + 1;
      end if;
    end if;
    v_dato := v_dato || jsonb_build_object('confianza', coalesce(v_dato ->> 'confianza', 'media'));
    v_salida := v_salida || jsonb_build_array(v_dato);
  end loop;
  return jsonb_build_object('datos', v_salida, 'degradados', v_degradados, 'errores', v_errores);
end $$;

-- Un intento rechazado: no escribe nada de negocio, anota el error en la corrida y devuelve {ok: false, errores}.
-- A los cinco intentos, la corrida queda fallida.
create or replace function agentes._rechazar(p_corrida negocio.corridas_de_agente, p_errores jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v_intentos integer := p_corrida.intentos + 1;
  v_estado   text := case when p_corrida.intentos + 1 >= 5 then 'fallida' else 'abierta' end;
begin
  update negocio.corridas_de_agente
     set intentos = v_intentos, errores = p_errores, ultimo_error = left(p_errores::text, 2000), estado = v_estado,
         terminada_el = case when v_estado = 'fallida' then now() end,
         duracion_ms = case when v_estado = 'fallida' then (extract(epoch from now() - abierta_el) * 1000)::integer end
   where org_id = p_corrida.org_id and cuenta_id = p_corrida.cuenta_id and id = p_corrida.id and estado = 'abierta';
  if not found then
    raise exception using errcode = '55000', message = 'agentes: la corrida ya no está abierta';
  end if;
  if v_estado = 'fallida' then
    perform agentes._evento(p_corrida, 'agente_corrida_fallida',
      jsonb_build_object('agente', p_corrida.agente, 'error', 'cinco intentos rechazados'));
  end if;
  return jsonb_build_object('ok', false, 'corrida_id', p_corrida.id, 'estado', v_estado, 'intentos', v_intentos,
    'errores', p_errores,
    'ayuda', 'Corrige la salida y vuelve a llamar a la misma función con la misma corrida. Nada se guardó.');
end $$;

-- Cierra una corrida con su salida validada.
create or replace function agentes._cerrar(p_corrida negocio.corridas_de_agente, p_salida jsonb, p_degradados integer,
  p_estado text default 'lista') returns void
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
begin
  update negocio.corridas_de_agente
     set salida = p_salida, degradados = coalesce(p_degradados, 0), errores = null, estado = p_estado,
         terminada_el = now(), duracion_ms = (extract(epoch from now() - abierta_el) * 1000)::integer,
         intentos = intentos + 1
   where org_id = p_corrida.org_id and cuenta_id = p_corrida.cuenta_id and id = p_corrida.id and estado = 'abierta';
  if not found then
    raise exception using errcode = '55000', message = 'agentes: la corrida ya no está abierta';
  end if;
  perform agentes._evento(p_corrida, 'agente_corrida_lista',
    jsonb_build_object('agente', p_corrida.agente, 'estado', p_estado));
end $$;

-- Lo que la base le dio al agente queda en la corrida: sus fuentes citables y las versiones del conocimiento.
create or replace function agentes._anotar_lectura(p_corrida negocio.corridas_de_agente, p_fuentes jsonb,
  p_conocimiento jsonb default '{}'::jsonb) returns void
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
begin
  update negocio.corridas_de_agente
     set leido = jsonb_set(leido, '{fuentes}', coalesce(leido -> 'fuentes', '{}'::jsonb) || coalesce(p_fuentes, '{}'::jsonb)),
         conocimiento = conocimiento || coalesce(p_conocimiento, '{}'::jsonb)
   where org_id = p_corrida.org_id and cuenta_id = p_corrida.cuenta_id and id = p_corrida.id;
end $$;

-- El conocimiento vigente de la cuenta de una corrida, de los tipos pedidos: {conocimiento: {tipo: {...}}, fuentes,
-- versiones, faltantes}. Las fuentes citables se llaman «conocimiento:{tipo}@v{n}».
create or replace function agentes._conocimiento(p_corrida negocio.corridas_de_agente, p_tipos text[]) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v_con      jsonb := '{}'::jsonb;
  v_fuentes  jsonb := '{}'::jsonb;
  v_vers     jsonb := '{}'::jsonb;
  v_falta    jsonb := '[]'::jsonb;
  v_tipo     text;
  r          record;
begin
  foreach v_tipo in array p_tipos loop
    select k.version, k.contenido, k.contenido_texto into r
      from negocio.conocimiento_vigente k
     where k.org_id = p_corrida.org_id and k.cuenta_id = p_corrida.cuenta_id and k.tipo = v_tipo;
    if found then
      v_con := v_con || jsonb_build_object(v_tipo, jsonb_build_object('version', r.version, 'contenido', r.contenido,
                 'texto', r.contenido_texto, 'fuente', format('conocimiento:%s@v%s', v_tipo, r.version)));
      v_fuentes := v_fuentes || jsonb_build_object(format('conocimiento:%s@v%s', v_tipo, r.version),
                     coalesce(r.contenido_texto, r.contenido::text));
      v_vers := v_vers || jsonb_build_object(v_tipo, r.version);
    else
      v_falta := v_falta || to_jsonb('conocimiento:' || v_tipo);
    end if;
  end loop;
  return jsonb_build_object('conocimiento', v_con, 'fuentes', v_fuentes, 'versiones', v_vers, 'faltantes', v_falta);
end $$;

-- ─── 8 · Las funciones públicas comunes ──────────────────────────────────────────

-- Abre una corrida. La cuenta sale de la location de GHL (identidad.cuentas.crm_cuenta_id, única); el lead, de su
-- contact_id. Los agentes del comprador trabajan en la cuenta del cliente que compró (negocio.clientes, la 112).
-- p_sujeto (opcional): {ghl_evento_id, llamada_id, paso, etapa, pieza, motivo}.
create or replace function agentes.abrir_corrida(
  p_agente               text,
  p_location_id          text,
  p_ghl_contact_id       text,
  p_clave_de_idempotencia text,
  p_entrada              jsonb default '{}'::jsonb,
  p_disparador           text default null,
  p_sujeto               jsonb default '{}'::jsonb,
  p_sesion_externa_id    text default null,
  p_version_del_agente   text default null,
  p_modo                 text default 'activo',
  p_version_de_la_skill  text default null,
  p_modelo               text default null
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v_agente     catalogo.agentes;
  v_org        uuid;
  v_cuenta     uuid;
  v_contacto   negocio.contactos;
  v_cita       uuid;
  v_llamada    uuid;
  v_cliente_id uuid;
  v_cli_org    uuid;
  v_cli_cta    uuid;
  v_trab_org   uuid;
  v_trab_cta   uuid;
  v_sujeto     text;
  v_existente  negocio.corridas_de_agente;
  v_id         uuid := gen_random_uuid();
  v_motivo     text;
  v_sesion     text := nullif(btrim(current_setting('app.org_id', true)), '');
  v_faltantes  jsonb := '[]'::jsonb;
  v_reemplazo  uuid[];
begin
  p_sujeto := coalesce(p_sujeto, '{}'::jsonb);
  p_entrada := coalesce(p_entrada, '{}'::jsonb);
  select * into v_agente from catalogo.agentes where clave = p_agente and vigente;
  if not found then
    raise exception using errcode = '22023', message = format('agentes: «%s» no es un agente (catalogo.agentes)', p_agente);
  end if;
  if jsonb_typeof(p_entrada) <> 'object' or jsonb_typeof(p_sujeto) <> 'object' then
    raise exception using errcode = '22023', message = 'agentes: la entrada y el sujeto tienen que ser objetos JSON';
  end if;
  if p_entrada ? 'fuentes' and jsonb_typeof(p_entrada -> 'fuentes') <> 'object' then
    raise exception using errcode = '22023', message = 'agentes: entrada.fuentes tiene que ser un objeto {clave_de_fuente: texto}';
  end if;
  if coalesce(btrim(p_clave_de_idempotencia), '') = '' then
    raise exception using errcode = '22023', message = 'agentes: falta la clave de idempotencia (sale del disparador)';
  end if;
  if coalesce(p_modo, 'activo') not in ('activo', 'sombra') then
    raise exception using errcode = '22023', message = 'agentes: el modo es activo o sombra';
  end if;
  -- Sólo el Triage marca sus salidas como no publicadas (triajes.aplicado). Los demás, hasta tener su marca, no
  -- corren en sombra: una ficha o un resultado «de prueba» se verían como reales.
  if coalesce(p_modo, 'activo') = 'sombra' and p_agente <> 'triage' then
    raise exception using errcode = '22023', message = 'agentes: por ahora sólo el Triage corre en modo sombra';
  end if;

  -- La cuenta del vendedor: la location de GHL desde donde corre el agente.
  select c.org_id, c.id into v_org, v_cuenta
    from identidad.cuentas c where c.crm = 'ghl' and c.crm_cuenta_id = p_location_id and c.estado = 'activa';
  if v_cuenta is null then
    raise exception using errcode = 'P0002',
      message = format('agentes: la location de GHL «%s» no es una cuenta activa de Comando Central', p_location_id);
  end if;

  -- El lead.
  if p_ghl_contact_id is not null then
    select * into v_contacto from negocio.contactos k where k.org_id = v_org and k.ghl_contact_id = p_ghl_contact_id;
    if found and v_contacto.cuenta_id <> v_cuenta then
      raise exception using errcode = '42501', message = 'agentes: el contacto es de otra cuenta que la location';
    end if;
    if not found then
      v_faltantes := v_faltantes || to_jsonb('contacto_en_la_base'::text);
    end if;
  end if;

  -- La cita y la llamada del sujeto, si vienen.
  if p_sujeto ? 'ghl_evento_id' then
    select ci.id into v_cita from negocio.citas ci
     where ci.org_id = v_org and ci.cuenta_id = v_cuenta and ci.ghl_evento_id = p_sujeto ->> 'ghl_evento_id';
    if v_cita is null then
      v_faltantes := v_faltantes || to_jsonb('cita_en_la_base'::text);
    end if;
  end if;
  if p_sujeto ? 'llamada_id' then
    select l.id into v_llamada from negocio.llamadas l
     where l.org_id = v_org and l.cuenta_id = v_cuenta and l.id = (p_sujeto ->> 'llamada_id')::uuid;
    if v_llamada is null then
      raise exception using errcode = 'P0002', message = 'agentes: la llamada no es de esta cuenta';
    end if;
  end if;

  -- Dónde trabaja: los del lead, en la cuenta del vendedor; los del comprador, en la cuenta del cliente que compró.
  v_trab_org := v_org;
  v_trab_cta := v_cuenta;
  if v_agente.cuenta_de_trabajo = 'comprador' then
    if v_contacto.id is null then
      raise exception using errcode = 'P0002', message = 'agentes: un agente del comprador necesita el contacto que compró';
    end if;
    execute $q$
      select id, organizacion_cliente_id, cuenta_cliente_id from negocio.clientes
       where org_id = $1 and cuenta_id = $2 and contacto_id = $3 and cuenta_cliente_id is not null
       order by creado_el desc limit 1 $q$
      into v_cliente_id, v_cli_org, v_cli_cta using v_org, v_cuenta, v_contacto.id;
    if v_cliente_id is null then
      raise exception using errcode = 'P0002',
        message = 'agentes: el contacto todavía no es cliente con su cuenta creada (agentes.confirmar_resultado y agentes.alta_del_comprador)';
    end if;
    v_trab_org := v_cli_org;
    v_trab_cta := v_cli_cta;
  end if;

  if v_sesion is not null and v_sesion::uuid <> v_trab_org then
    raise exception using errcode = '42501', message = 'agentes: la sesión es de otra organización que la de la corrida';
  end if;

  -- Sin carreras: dos aperturas simultáneas de la misma clave o del mismo sujeto se esperan.
  perform pg_advisory_xact_lock(hashtextextended('corrida:' || v_trab_cta || ':' || p_agente || ':' || p_clave_de_idempotencia, 0));
  -- La idempotencia: la misma clave devuelve la misma corrida.
  select * into v_existente from negocio.corridas_de_agente
   where org_id = v_trab_org and cuenta_id = v_trab_cta and agente = p_agente and clave_de_idempotencia = p_clave_de_idempotencia;
  if found then
    return jsonb_build_object('ok', true, 'corrida_id', v_existente.id, 'reutilizada', true, 'estado', v_existente.estado,
      'org_id', v_existente.org_id, 'cuenta_id', v_existente.cuenta_id, 'contacto_id', v_existente.contacto_id,
      'cita_id', v_existente.cita_id, 'llamada_id', v_existente.llamada_id, 'cliente_id', v_existente.cliente_id);
  end if;

  v_sujeto := case
    when v_agente.cuenta_de_trabajo = 'comprador'
      then 'comprador:' || v_cliente_id || coalesce(':' || coalesce(p_sujeto ->> 'paso', p_sujeto ->> 'etapa', p_sujeto ->> 'pieza'), '')
    when v_agente.sujeto = 'llamada' and v_llamada is not null then 'llamada:' || v_llamada
    when v_agente.sujeto = 'cita' and p_sujeto ? 'ghl_evento_id' then 'cita:' || (p_sujeto ->> 'ghl_evento_id')
    else 'contacto:' || coalesce(p_ghl_contact_id, p_clave_de_idempotencia)
  end;

  perform pg_advisory_xact_lock(hashtextextended('sujeto:' || v_trab_cta || ':' || p_agente || ':' || v_sujeto, 0));
  v_motivo := coalesce(p_sujeto ->> 'motivo', case when exists (
      select 1 from negocio.corridas_de_agente
       where org_id = v_trab_org and cuenta_id = v_trab_cta and agente = p_agente and sujeto_clave = v_sujeto)
    then 'datos_nuevos' else 'primera_vez' end);

  -- Una sola abierta por sujeto: la anterior queda reemplazada (su salida ya no se acepta).
  with r as (
    update negocio.corridas_de_agente
       set estado = 'reemplazada', reemplazada_por = v_id
     where org_id = v_trab_org and cuenta_id = v_trab_cta and agente = p_agente and sujeto_clave = v_sujeto and estado = 'abierta'
     returning id)
  select array_agg(id) into v_reemplazo from r;

  insert into negocio.corridas_de_agente (
    org_id, cuenta_id, id, agente, modo, sujeto_clave, contacto_id, ghl_contact_id, cita_id, llamada_id, cliente_id,
    vendedor_org_id, vendedor_cuenta_id, vendedor_contacto_id, disparador, clave_de_idempotencia, motivo,
    entrada, entrada_huella, sesion_externa_id, version_del_agente, version_de_la_skill, modelo)
  values (
    v_trab_org, v_trab_cta, v_id, p_agente, coalesce(p_modo, 'activo'), left(v_sujeto, 300),
    case when v_agente.cuenta_de_trabajo = 'vendedor' then v_contacto.id end,
    case when v_agente.cuenta_de_trabajo = 'vendedor' then p_ghl_contact_id end,
    case when v_agente.cuenta_de_trabajo = 'vendedor' then v_cita end,
    case when v_agente.cuenta_de_trabajo = 'vendedor' then v_llamada end,
    v_cliente_id,
    case when v_agente.cuenta_de_trabajo = 'comprador' then v_org end,
    case when v_agente.cuenta_de_trabajo = 'comprador' then v_cuenta end,
    case when v_agente.cuenta_de_trabajo = 'comprador' then v_contacto.id end,
    p_disparador, p_clave_de_idempotencia, v_motivo, p_entrada, md5(p_entrada::text),
    p_sesion_externa_id, p_version_del_agente, p_version_de_la_skill, p_modelo);

  return jsonb_build_object('ok', true, 'corrida_id', v_id, 'reutilizada', false, 'estado', 'abierta', 'motivo', v_motivo,
    'org_id', v_trab_org, 'cuenta_id', v_trab_cta, 'contacto_id', v_contacto.id, 'cita_id', v_cita, 'llamada_id', v_llamada,
    'cliente_id', v_cliente_id, 'reemplazo_a', to_jsonb(v_reemplazo),
    'no_contactar', v_contacto.no_contactar_desde is not null, 'faltantes', v_faltantes,
    'siguiente', format('select agentes.leer_%s(%L)', p_agente, v_id));
end $$;
comment on function agentes.abrir_corrida(text, text, text, text, jsonb, text, jsonb, text, text, text, text, text) is
  'Abre (o devuelve, si la clave se repite) la corrida de un managed agent. Traduce la location y el contacto de GHL a la cuenta y al lead de la base. La entrada es lo que el agente leyó en GHL, con sus fuentes citables en entrada.fuentes.';

-- Registra lo que el agente hizo afuera (escribir un campo de GHL, avisar por Slack, mandar un mensaje).
-- Se acepta también con la corrida ya cerrada: el agente suele escribir en GHL después de registrar su salida.
create or replace function agentes.registrar_accion_externa(
  p_corrida uuid, p_tipo text, p_destino text, p_contenido jsonb default '{}'::jsonb, p_id_externo text default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v  negocio.corridas_de_agente := agentes._corrida(p_corrida, false);
  v_id uuid := gen_random_uuid();
begin
  if v.estado in ('cancelada', 'reemplazada') then
    return jsonb_build_object('ok', false, 'errores', jsonb_build_array(format('la corrida está «%s»', v.estado)));
  end if;
  insert into negocio.acciones_externas (org_id, cuenta_id, id, corrida_id, contacto_id, tipo, destino, contenido, id_externo)
  values (v.org_id, v.cuenta_id, v_id, v.id, v.contacto_id, p_tipo, p_destino, coalesce(p_contenido, '{}'::jsonb), p_id_externo);
  perform agentes._evento(v, 'accion_externa_registrada', jsonb_build_object('accion_id', v_id, 'tipo', p_tipo), null, v_id::text);
  return jsonb_build_object('ok', true, 'accion_id', v_id);
end $$;

-- Registra una evidencia pública ANTES de citarla. Devuelve la clave citable «publica:{id}».
create or replace function agentes.registrar_fuente_publica(
  p_corrida uuid, p_tipo text, p_extracto text, p_url text default null, p_titulo text default null,
  p_datos jsonb default '{}'::jsonb, p_obtenida_por text default 'web_fetch', p_vigente_dias integer default 30)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v  negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_id uuid := gen_random_uuid();
begin
  insert into negocio.fuentes_publicas (org_id, cuenta_id, id, corrida_id, contacto_id, cliente_id, tipo, url, titulo,
                                        extracto, datos, obtenida_por, vigente_hasta)
  values (v.org_id, v.cuenta_id, v_id, v.id, v.contacto_id, v.cliente_id, p_tipo, p_url, p_titulo, left(p_extracto, 8000),
          coalesce(p_datos, '{}'::jsonb), coalesce(p_obtenida_por, 'web_fetch'),
          case when p_vigente_dias is not null then now() + make_interval(days => p_vigente_dias) end);
  perform agentes._anotar_lectura(v, jsonb_build_object('publica:' || v_id, left(p_extracto, 8000)));
  return jsonb_build_object('ok', true, 'fuente_publica_id', v_id, 'fuente', 'publica:' || v_id);
end $$;

-- El agente no pudo terminar.
create or replace function agentes.fallar_corrida(p_corrida uuid, p_error text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
begin
  update negocio.corridas_de_agente
     set estado = 'fallida', ultimo_error = left(coalesce(p_error, 'sin detalle'), 2000), terminada_el = now(),
         duracion_ms = (extract(epoch from now() - abierta_el) * 1000)::integer
   where org_id = v.org_id and cuenta_id = v.cuenta_id and id = v.id;
  perform agentes._evento(v, 'agente_corrida_fallida', jsonb_build_object('agente', v.agente, 'error', left(coalesce(p_error, ''), 300)));
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'estado', 'fallida');
end $$;

-- El sujeto ya no aplica (el lead canceló, pidió no contacto): la corrida no escribe salidas.
create or replace function agentes.cancelar_corrida(p_corrida uuid, p_motivo text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
begin
  update negocio.corridas_de_agente
     set estado = 'cancelada', ultimo_error = left(coalesce(p_motivo, 'cancelada'), 2000), terminada_el = now(),
         duracion_ms = (extract(epoch from now() - abierta_el) * 1000)::integer
   where org_id = v.org_id and cuenta_id = v.cuenta_id and id = v.id;
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'estado', 'cancelada');
end $$;

-- El estado de una corrida y su salida (sin la entrada, que puede ser grande).
create or replace function agentes.ver_corrida(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
declare
  v negocio.corridas_de_agente := agentes._corrida(p_corrida, false);
begin
  return jsonb_build_object('corrida_id', v.id, 'agente', v.agente, 'estado', v.estado, 'modo', v.modo, 'motivo', v.motivo,
    'contacto_id', v.contacto_id, 'cita_id', v.cita_id, 'llamada_id', v.llamada_id, 'cliente_id', v.cliente_id,
    'salida', v.salida, 'degradados', v.degradados, 'errores', v.errores, 'intentos', v.intentos,
    'abierta_el', v.abierta_el, 'terminada_el', v.terminada_el, 'conocimiento', v.conocimiento,
    'fuentes_citables', (select coalesce(jsonb_agg(k), '[]'::jsonb) from (
        select jsonb_object_keys(coalesce(v.entrada -> 'fuentes', '{}'::jsonb)) as k
        union select jsonb_object_keys(coalesce(v.leido -> 'fuentes', '{}'::jsonb))) x));
end $$;

-- Lee el conocimiento vigente de la cuenta de la corrida (los tipos pedidos, o todos).
create or replace function agentes.leer_conocimiento(p_corrida uuid, p_tipos text[] default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  r jsonb;
begin
  r := agentes._conocimiento(v, coalesce(p_tipos, (select array_agg(clave::text order by clave) from catalogo.tipos_de_conocimiento where vigente)));
  perform agentes._anotar_lectura(v, r -> 'fuentes', r -> 'versiones');
  return r;
end $$;

-- Carga una versión nueva del conocimiento de una cuenta (el ICP, la matriz, el script…). La usa el equipo (o el
-- publicador de entregables, la 114). Con p_aprobar, queda vigente al instante.
create or replace function agentes.cargar_conocimiento(
  p_cuenta_id uuid, p_tipo text, p_contenido jsonb, p_contenido_texto text default null, p_aprobar boolean default true,
  p_aprobado_por uuid default null, p_origen text default 'manual', p_entregable_version_id uuid default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v_org     uuid;
  v_version integer;
  v_id      uuid := gen_random_uuid();
  v_sesion  text := nullif(btrim(current_setting('app.org_id', true)), '');
begin
  select org_id into v_org from identidad.cuentas where id = p_cuenta_id;
  if v_org is null then
    raise exception using errcode = 'P0002', message = 'agentes: la cuenta no existe';
  end if;
  if v_sesion is not null and v_sesion::uuid <> v_org then
    raise exception using errcode = '42501', message = 'agentes: la cuenta es de otra organización que la de la sesión';
  end if;
  if p_origen not in ('manual', 'entregable', 'importado') then
    raise exception using errcode = '22023', message = 'agentes: el origen es manual, entregable o importado';
  end if;
  -- Lo que viene de un entregable vale sólo si la versión existe en esta cuenta, la aprobó una persona y es del mismo
  -- tipo (el ICP aprobado publica el conocimiento «icp»). Si no, se pide quién lo aprueba, como lo manual.
  if p_aprobar and (p_origen <> 'entregable' or p_entregable_version_id is null or not exists (
       select 1 from negocio.versiones_de_entregable ve
         join negocio.entregables en on en.org_id = ve.org_id and en.cuenta_id = ve.cuenta_id and en.id = ve.entregable_id
        where ve.org_id = v_org and ve.cuenta_id = p_cuenta_id and ve.id = p_entregable_version_id
          and ve.estado = 'aprobada' and ve.decidida_por is not null and en.tipo = p_tipo))
     and (p_aprobado_por is null or not exists (
       select 1 from identidad.usuarios u where u.org_id = v_org and u.id = p_aprobado_por)) then
    raise exception using errcode = '22023',
      message = 'agentes: para dejar vigente un conocimiento hace falta quién lo aprueba (un usuario de la organización)';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('conocimiento:' || p_cuenta_id || ':' || p_tipo, 0));
  select coalesce(max(version), 0) + 1 into v_version
    from negocio.conocimiento_de_la_cuenta where org_id = v_org and cuenta_id = p_cuenta_id and tipo = p_tipo;
  insert into negocio.conocimiento_de_la_cuenta (org_id, cuenta_id, id, tipo, version, contenido, contenido_texto, origen,
                                                 entregable_version_id, aprobado_por, aprobado_el)
  values (v_org, p_cuenta_id, v_id, p_tipo, v_version, coalesce(p_contenido, '{}'::jsonb), p_contenido_texto, p_origen,
          p_entregable_version_id, p_aprobado_por, case when p_aprobar then now() end);
  if p_aprobar then
    perform agentes._registrar_evento(v_org,
    p_cuenta_id,
    'conocimiento_publicado',
    null,
    case when p_aprobado_por is null then 'sistema' else 'persona' end,
    coalesce(p_aprobado_por::text, 'agentes.cargar_conocimiento'),
    'comando_central',
    'conocimiento:' || v_id,
    jsonb_build_object('tipo', p_tipo, 'version', v_version, 'conocimiento_id', v_id),
    now());
  end if;
  return jsonb_build_object('ok', true, 'conocimiento_id', v_id, 'tipo', p_tipo, 'version', v_version, 'vigente', p_aprobar);
end $$;

-- ─── 9 · El lead que llega después que el agente ─────────────────────────────────
-- El Triage corre apenas se envía el formulario; el aviso que crea el contacto puede llegar después. Las corridas
-- que se abrieron con su contact_id lo reciben al llegar. La 111 rehace esta función para sumar el triaje.
create or replace function negocio.vincular_lo_del_agente() returns trigger
language plpgsql security invoker set search_path = pg_catalog, negocio, pg_temp
as $$
begin
  update negocio.corridas_de_agente
     set contacto_id = new.id
   where org_id = new.org_id and cuenta_id = new.cuenta_id and ghl_contact_id = new.ghl_contact_id and contacto_id is null;
  return null;
end $$;
create or replace trigger contactos_vincula_lo_del_agente after insert on negocio.contactos
  for each row execute function negocio.vincular_lo_del_agente();

-- ─── 10 · Quién puede llamar a la puerta ─────────────────────────────────────────

do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as firma, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'agentes' loop
    -- Las internas (con «_») también: las públicas son security invoker y las llaman con el rol de quien llama.
    execute format('revoke all on function %s from public', f.firma);
    execute format('grant execute on function %s to app_inquilino, agente_mcp', f.firma);
  end loop;
end $$;
