-- 118 · Las respuestas de los managed agents: una tabla, una fila por lead y una columna por agente (fase 1).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (reuniones del 18 y 19 de noviembre; decisiones del usuario del 2026-11-20;
-- Downloads/MANAGED-AGENTS-FASE-1-SUPABASE.md)
--
-- UN SOLO OUTPUT POR AGENTE. En la fase 1, los cuatro primeros agentes dejan una sola cosa cada uno: el Triage, el
-- cuadrante del lead; el Sales Assistant, la ficha del lead antes de la llamada (HTML); el Sales Coach, la ficha
-- después de la llamada (HTML); el Brief, la ficha de bienvenida del cliente (HTML). Las salidas estructuradas de la
-- 111 a la 115 (fichas con muchas columnas, resultado, evaluación, objeciones, Brief pregunta por pregunta) se dejan
-- de usar en esta fase: no se borran, quedan para cuando se quieran retomar.
--
-- UNA TABLA, UNA FILA POR LEAD, UNA COLUMNA POR AGENTE, EN EL ORDEN DEL FLUJO. Lo pidió el usuario: no una tabla por
-- agente ni varias columnas por salida, sino un lugar por agente al lado del de los demás, sin que uno pise al otro.
--   triage_cuadrante_de_clasificacion   el mismo valor que el campo contact.cuadrante_de_clasificacion de GHL
--   sales_assistant_ficha_de_lead_1     el HTML de la ficha previa a la llamada
--   sales_coach_ficha_de_lead_2         el HTML de la ficha después de la llamada
--   brief_ficha_de_cliente_1            el HTML de la ficha de bienvenida del cliente
-- Si un agente algún día saca un segundo dato, es una columna nueva, una fila en catalogo.salidas_de_los_agentes y
-- la vista negocio.respuestas_por_lead recreada con el orden nuevo: Postgres agrega las columnas al final de la
-- tabla, así que el orden para mirar lo da la vista.
--
-- NADA SE PIERDE. Una corrida nueva del mismo agente (un reagendamiento) reemplaza su columna; la versión anterior
-- queda entera en la salida de su corrida (negocio.corridas_de_agente), que guarda el HTML. `procedencia` dice, por
-- columna, qué corrida la escribió, cuándo y cuántas veces.
--
-- LA PUERTA SIGUE SIENDO `agentes.*`. guardar_respuesta (las tres fichas), registrar_cuadrante (el Triage) y
-- leer_respuesta. Cada agente escribe sólo su columna, que sale del catálogo según el agente de la corrida.
--   · El HTML se valida: no vacío, hasta 1 MB y sin contenido activo (script, iframe, object, embed, form, frame,
--     base, meta, link, svg, math ni atributos on…=), y los enlaces e imágenes sólo con https://, http://, mailto:,
--     tel: o #. Los agentes leen webs con Apify, y la ficha de bienvenida le llega al cliente. La regla es también un
--     CHECK de la tabla: el MCP de Supabase permite SQL libre, y un UPDATE directo tampoco la saltea. Quien dibuje
--     estas fichas en una pantalla tiene que hacerlo igual en un iframe con sandbox: la expresión regular es la
--     segunda línea de defensa, no la primera.
--   · Que cada agente escriba sólo su columna lo garantizan las funciones; con SQL libre por el MCP no (el mismo
--     riesgo aceptado de la 110 a la 117, hasta el ARIA MCP).
--   · registrar_cuadrante NO toca contactos.cuadrante: sigue teniendo un solo escritor, la sincronización desde el
--     campo de GHL que el Triage escribe (105). Así las clasificaciones y cuadrante_cambiado (106) salen solos.
--   · Las corridas de estas funciones cierran en `lista`: en la fase 1 no esperan una aprobación.
--   · Guardar no dispara nada (la regla de la 115): sin efectos en otras tablas fuera de la corrida y su evento.
--
-- LO PRIMERO QUE LLEGA DE GHL. Las preguntas estándar que faltaban para los campos del doc LEAD (a quién ayuda,
-- la confirmación por WhatsApp, la fuente del lead, cuánto vio del video previo y los datos de la cita), para que
-- el mapeo de la cuenta los traduzca y los agentes los reciban como formulario:<pregunta>. Y la empresa del lead
-- (contact.companyName), que la sincronización guarda en contactos.empresa.
--
-- Reaplicable: `if not exists`, `on conflict do nothing` y `create or replace`. La vista del expediente se recrea con
-- su cuerpo entero (el de la 117) y la sección nueva al final, con security_invoker (sin él, lee como su dueño y no
-- devuelve filas).
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · El catálogo de las salidas ───────────────────────────────────────────────

create table if not exists catalogo.salidas_de_los_agentes (
  clave        catalogo.clave primary key,
  agente       catalogo.clave not null references catalogo.agentes (clave),
  orden        smallint not null unique,
  tipo         text not null check (tipo in ('cuadrante', 'html')),
  nombre       text not null,
  descripcion  text not null,
  vigente      boolean not null default true
);
comment on table catalogo.salidas_de_los_agentes is
  'Las columnas de negocio.respuestas_de_los_agentes (118): la clave es el nombre de la columna; el orden, el del flujo. Una función de agentes.* escribe sólo la columna del agente de su corrida.';
insert into catalogo.salidas_de_los_agentes (clave, agente, orden, tipo, nombre, descripcion) values
  ('triage_cuadrante_de_clasificacion', 'triage', 1, 'cuadrante', 'Cuadrante de clasificación',
   'El cuadrante que puso el Triage: el mismo valor que escribe en el campo contact.cuadrante_de_clasificacion de GHL.'),
  ('sales_assistant_ficha_de_lead_1', 'sales_assistant', 2, 'html', 'Ficha del lead 1',
   'La ficha del lead antes de la llamada, para que el closer la prepare. HTML.'),
  ('sales_coach_ficha_de_lead_2', 'sales_coach', 3, 'html', 'Ficha del lead 2',
   'La ficha del lead después de la llamada: la misma ficha más el análisis, los compromisos y los próximos pasos. HTML.'),
  ('brief_ficha_de_cliente_1', 'brief', 4, 'html', 'Ficha del cliente 1',
   'La ficha de bienvenida del cliente, con el enlace al formulario del Brief. La lee el cliente. HTML.')
on conflict do nothing;
grant select on catalogo.salidas_de_los_agentes to agente_mcp;

insert into catalogo.tipos_de_evento (clave, version, dominio, nombre, descripcion, etapa_que_marca, esquema_de_datos) values
  ('respuesta_de_agente_guardada', 1, 'agentes', 'Respuesta de agente guardada',
   'Un managed agent guardó su salida en negocio.respuestas_de_los_agentes (118).', null,
   '{"type":"object","required":["columna","version"],"properties":{"columna":{"type":"string"},"version":{"type":"integer"},"corrida_id":{"type":"string","format":"uuid"}}}')
on conflict do nothing;

-- ─── 2 · La tabla ─────────────────────────────────────────────────────────────────

create table if not exists negocio.respuestas_de_los_agentes (
  org_id                             uuid not null references identidad.organizaciones (id),
  cuenta_id                          uuid not null,
  contacto_id                        uuid not null,
  -- 1 · Triage
  triage_cuadrante_de_clasificacion  catalogo.clave references catalogo.cuadrantes (clave),
  -- 2 · Sales Assistant
  sales_assistant_ficha_de_lead_1    text check (sales_assistant_ficha_de_lead_1 is null
                                                 or octet_length(sales_assistant_ficha_de_lead_1) between 1 and 1048576),
  -- 3 · Sales Coach
  sales_coach_ficha_de_lead_2        text check (sales_coach_ficha_de_lead_2 is null
                                                 or octet_length(sales_coach_ficha_de_lead_2) between 1 and 1048576),
  -- 4 · Brief
  brief_ficha_de_cliente_1           text check (brief_ficha_de_cliente_1 is null
                                                 or octet_length(brief_ficha_de_cliente_1) between 1 and 1048576),
  procedencia                        jsonb not null default '{}'::jsonb check (jsonb_typeof(procedencia) = 'object'),
  creado_el                          timestamptz not null default now(),
  actualizado_el                     timestamptz not null default now(),
  primary key (org_id, cuenta_id, contacto_id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint respuestas_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade
);
comment on table negocio.respuestas_de_los_agentes is
  'Lo que deja cada managed agent en la fase 1 (118): una fila por lead y una columna por agente, en el orden del flujo (catalogo.salidas_de_los_agentes). Escriben sólo las funciones agentes.guardar_respuesta y agentes.registrar_cuadrante; la versión anterior de una columna queda en la salida de su corrida.';
comment on column negocio.respuestas_de_los_agentes.triage_cuadrante_de_clasificacion is
  'El cuadrante que puso el Triage. El vigente del lead sigue siendo contactos.cuadrante, que trae la sincronización desde el campo de GHL.';
comment on column negocio.respuestas_de_los_agentes.procedencia is
  'Por columna: {corrida_id, agente, guardado_el, version, bytes} y, en el Triage, la razón. Sin el HTML.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.respuestas_de_los_agentes', true);
-- Insertar sólo crea la fila vacía del lead (las salidas entran por update, con su chequeo); actualizar, sólo las salidas;
-- borrar, nadie.
revoke insert, update, delete, truncate on negocio.respuestas_de_los_agentes from app_inquilino, agente_mcp;
grant insert (org_id, cuenta_id, contacto_id) on negocio.respuestas_de_los_agentes to app_inquilino, agente_mcp;
grant update (triage_cuadrante_de_clasificacion, sales_assistant_ficha_de_lead_1, sales_coach_ficha_de_lead_2,
              brief_ficha_de_cliente_1, procedencia, actualizado_el)
  on negocio.respuestas_de_los_agentes to app_inquilino;
grant select on negocio.respuestas_de_los_agentes to agente_mcp;
grant update (triage_cuadrante_de_clasificacion, sales_assistant_ficha_de_lead_1, sales_coach_ficha_de_lead_2,
              brief_ficha_de_cliente_1, procedencia, actualizado_el)
  on negocio.respuestas_de_los_agentes to agente_mcp;

-- La vista para mirar: una fila por lead, con quién es y las columnas en el orden del flujo.
create or replace view negocio.respuestas_por_lead with (security_invoker = true) as
  select r.org_id, r.cuenta_id, r.contacto_id, k.ghl_contact_id, k.nombre, k.email,
         r.triage_cuadrante_de_clasificacion,
         r.sales_assistant_ficha_de_lead_1,
         r.sales_coach_ficha_de_lead_2,
         r.brief_ficha_de_cliente_1,
         r.procedencia, r.creado_el, r.actualizado_el
    from negocio.respuestas_de_los_agentes r
    join negocio.contactos k on k.org_id = r.org_id and k.cuenta_id = r.cuenta_id and k.id = r.contacto_id;
comment on view negocio.respuestas_por_lead is
  'Una fila por lead con lo que dejó cada managed agent, en el orden del flujo (118). Para agregar una salida, recrearla con la columna nueva al lado de la de su agente.';
revoke all on negocio.respuestas_por_lead from public, app_inquilino;
grant select on negocio.respuestas_por_lead to app_inquilino, agente_mcp;

-- ─── 3 · Las funciones ────────────────────────────────────────────────────────────

-- Qué columna le toca al agente de la corrida. Devuelve null si no tiene ninguna de ese tipo (o la pedida no es
-- suya) y 'varias' si tiene más de una y no dijo cuál.
create or replace function agentes._salida_del_agente(p_corrida negocio.corridas_de_agente, p_tipo text, p_columna text)
returns text
language sql stable security invoker set search_path = pg_catalog, catalogo, pg_temp
as $$
  select case when count(*) = 0 then null when count(*) > 1 then 'varias' else min(s.clave) end
    from catalogo.salidas_de_los_agentes s
   where s.agente = p_corrida.agente and s.tipo = p_tipo and s.vigente
     and (p_columna is null or s.clave = p_columna)
$$;

-- Lo que no puede tener un HTML que va a un closer o a un cliente. Devuelve la lista de errores (vacía si pasa).
create or replace function agentes._reglas_del_html(p_html text) returns jsonb
language plpgsql immutable security invoker set search_path = pg_catalog, pg_temp
as $$
declare
  v_err jsonb := '[]'::jsonb;
begin
  if p_html is null or btrim(p_html) = '' then
    return jsonb_build_array('html: el documento está vacío');
  end if;
  if octet_length(p_html) > 1048576 then
    v_err := v_err || to_jsonb(format('html: pesa %s bytes y el máximo es 1048576 (1 MB)', octet_length(p_html)));
  end if;
  if p_html ~* '<[[:space:]]*(script|iframe|object|embed|form|frame|frameset|base|meta|link|applet|svg|math)([[:space:]>/]|$)' then
    v_err := v_err || to_jsonb('html: sin <script>, <iframe>, <object>, <embed>, <form>, <frame>, <base>, <meta>, <link>, <applet>, <svg> ni <math> (el estilo va en <style>)'::text);
  end if;
  -- Un atributo de evento, también pegado a una comilla (src="x"onerror=…).
  if p_html ~* '<[^>]*[[:space:]/"'']on[a-z]+[[:space:]]*=' then
    v_err := v_err || to_jsonb('html: sin atributos de evento (onclick, onload, onerror…)'::text);
  end if;
  -- Lista blanca de esquemas en todo lo que carga o abre una dirección: cierra javascript:, vbscript: y data:, también
  -- escritos con entidades (jav&#x61;script:) o con espacios adentro, sin rechazar un texto que nombre «JavaScript:».
  if p_html ~* '[[:space:]/"''](href|src|srcset|action|formaction|xlink:href|poster|background)[[:space:]]*=(?![[:space:]]*["'']?[[:space:]]*(https?://|mailto:|tel:|#))' then
    v_err := v_err || to_jsonb('html: los enlaces y las imágenes sólo con https://, http://, mailto:, tel: o # (sin javascript:, data: ni rutas relativas)'::text);
  end if;
  return v_err;
end $$;

-- Las reglas del HTML son también un CHECK de la tabla: valen aunque alguien escriba la columna con un UPDATE directo
-- por el MCP (con SQL libre), sin pasar por guardar_respuesta. La función es inmutable, por eso puede ir en un CHECK.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'negocio.respuestas_de_los_agentes'::regclass
                    and conname = 'respuestas_el_html_sin_contenido_activo') then
    alter table negocio.respuestas_de_los_agentes add constraint respuestas_el_html_sin_contenido_activo check (
      (sales_assistant_ficha_de_lead_1 is null or agentes._reglas_del_html(sales_assistant_ficha_de_lead_1) = '[]'::jsonb)
      and (sales_coach_ficha_de_lead_2 is null or agentes._reglas_del_html(sales_coach_ficha_de_lead_2) = '[]'::jsonb)
      and (brief_ficha_de_cliente_1 is null or agentes._reglas_del_html(brief_ficha_de_cliente_1) = '[]'::jsonb));
  end if;
end $$;

-- Escribe una columna de la fila del lead y su procedencia, y cierra la corrida. Lo común de guardar_respuesta y
-- registrar_cuadrante. La versión anterior de la columna ya quedó en la salida de la corrida que la escribió.
create or replace function agentes._escribir_respuesta(p_corrida negocio.corridas_de_agente, p_columna text,
  p_valor text, p_extra jsonb) returns integer
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v_version integer;
begin
  if not exists (select 1 from catalogo.salidas_de_los_agentes s where s.clave = p_columna and s.agente = p_corrida.agente) then
    raise exception using errcode = '42501', message = format('agentes: «%s» no es una columna del agente %s', p_columna, p_corrida.agente);
  end if;
  insert into negocio.respuestas_de_los_agentes (org_id, cuenta_id, contacto_id)
  values (p_corrida.org_id, p_corrida.cuenta_id, p_corrida.contacto_id)
  on conflict do nothing;
  select coalesce((r.procedencia -> p_columna ->> 'version')::integer, 0) + 1 into v_version
    from negocio.respuestas_de_los_agentes r
   where r.org_id = p_corrida.org_id and r.cuenta_id = p_corrida.cuenta_id and r.contacto_id = p_corrida.contacto_id
     for update;
  execute format(
    'update negocio.respuestas_de_los_agentes set %I = $1, procedencia = procedencia || jsonb_build_object($2::text, $3::jsonb),'
    ' actualizado_el = now() where org_id = $4 and cuenta_id = $5 and contacto_id = $6', p_columna)
  using p_valor, p_columna,
        jsonb_build_object('corrida_id', p_corrida.id, 'agente', p_corrida.agente, 'guardado_el', now(),
                           'version', v_version, 'bytes', octet_length(p_valor)) || coalesce(p_extra, '{}'::jsonb),
        p_corrida.org_id, p_corrida.cuenta_id, p_corrida.contacto_id;
  perform agentes._evento(p_corrida, 'respuesta_de_agente_guardada',
    jsonb_build_object('columna', p_columna, 'version', v_version, 'corrida_id', p_corrida.id));
  return v_version;
end $$;

-- Las tres fichas (Sales Assistant, Sales Coach y Brief): el HTML entero, en la columna del agente de la corrida.
create or replace function agentes.guardar_respuesta(p_corrida uuid, p_html text, p_columna text default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v          negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_columna  text := agentes._salida_del_agente(v, 'html', nullif(btrim(p_columna), ''));
  v_err      jsonb;
  v_version  integer;
begin
  if v_columna is null then
    return agentes._rechazar(v, jsonb_build_array(format(
      'el agente %s no guarda una ficha%s: las columnas de cada agente están en catalogo.salidas_de_los_agentes',
      v.agente, coalesce(' en «' || nullif(btrim(p_columna), '') || '»', ''))));
  end if;
  if v_columna = 'varias' then
    return agentes._rechazar(v, jsonb_build_array('el agente guarda más de una ficha: di cuál con p_columna'));
  end if;
  if v.contacto_id is null then
    return agentes._rechazar(v, jsonb_build_array('el lead todavía no está en la base: vuelve a intentarlo en unos minutos'));
  end if;
  v_err := agentes._reglas_del_html(p_html);
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;
  v_version := agentes._escribir_respuesta(v, v_columna, p_html, null);
  perform agentes._cerrar(v, jsonb_build_object('columna', v_columna, 'version', v_version,
    'bytes', octet_length(p_html), 'html', p_html), 0, 'lista');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'columna', v_columna, 'version', v_version,
    'bytes', octet_length(p_html));
end $$;

-- El Triage: el cuadrante y su razón. No toca contactos.cuadrante (lo trae la sincronización desde GHL).
create or replace function agentes.registrar_cuadrante(p_corrida uuid, p_cuadrante text, p_razon text)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v          negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_columna  text := agentes._salida_del_agente(v, 'cuadrante', null);
  v_cuad     text := lower(btrim(p_cuadrante));
  v_razon    text := nullif(btrim(p_razon), '');
  v_err      jsonb := '[]'::jsonb;
  v_version  integer;
begin
  if v_columna is null or v_columna = 'varias' then
    return agentes._rechazar(v, jsonb_build_array(format('el agente %s no registra un cuadrante: sólo el Triage', v.agente)));
  end if;
  if v.contacto_id is null then
    return agentes._rechazar(v, jsonb_build_array('el lead todavía no está en la base: vuelve a intentarlo en unos minutos'));
  end if;
  if v_cuad is null or not exists (select 1 from catalogo.cuadrantes c where c.clave = v_cuad and c.vigente) then
    v_err := v_err || to_jsonb(format('cuadrante: «%s» no es uno de prioriza, valida, financia o descarta', p_cuadrante));
  end if;
  if v_razon is null or length(v_razon) > 2000 then
    v_err := v_err || to_jsonb('razon: por qué ese cuadrante, en un texto de hasta 2000 caracteres'::text);
  end if;
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;
  v_version := agentes._escribir_respuesta(v, v_columna, v_cuad, jsonb_build_object('razon', v_razon));
  perform agentes._cerrar(v, jsonb_build_object('columna', v_columna, 'version', v_version, 'cuadrante', v_cuad,
    'razon', v_razon), 0, 'lista');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'columna', v_columna, 'cuadrante', v_cuad, 'version', v_version);
end $$;

-- Lo que dejó otro agente sobre el mismo lead (el Sales Coach lee la ficha 1; el Brief, la ficha 2). Se anota en lo
-- leído de la corrida como respuesta:<columna>@<corrida que la escribió>.
create or replace function agentes.leer_respuesta(p_corrida uuid, p_columna text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v        negocio.corridas_de_agente := agentes._corrida(p_corrida, false);
  v_col    text := nullif(btrim(p_columna), '');
  v_valor  text;
  v_proc   jsonb;
begin
  if v_col is null or not exists (select 1 from catalogo.salidas_de_los_agentes s where s.clave = v_col) then
    raise exception using errcode = '22023',
      message = format('agentes: «%s» no es una columna de negocio.respuestas_de_los_agentes (ver catalogo.salidas_de_los_agentes)', p_columna);
  end if;
  if v.contacto_id is null then
    return jsonb_build_object('ok', true, 'columna', v_col, 'valor', null,
      'motivo', 'el lead todavía no está en la base');
  end if;
  execute format('select %I::text, procedencia -> $1 from negocio.respuestas_de_los_agentes'
                 ' where org_id = $2 and cuenta_id = $3 and contacto_id = $4', v_col)
     into v_valor, v_proc
    using v_col, v.org_id, v.cuenta_id, v.contacto_id;
  if v_valor is not null and v.estado = 'abierta' then
    perform agentes._anotar_lectura(v,
      jsonb_build_object('respuesta:' || v_col || '@' || coalesce(v_proc ->> 'corrida_id', 'sin_corrida'), left(v_valor, 20000)));
  end if;
  return jsonb_build_object('ok', true, 'columna', v_col, 'valor', v_valor,
    'version', (v_proc ->> 'version')::integer, 'guardado_el', v_proc ->> 'guardado_el', 'corrida_id', v_proc ->> 'corrida_id',
    'motivo', case when v_valor is null then 'todavía no hay nada guardado en esa columna para este lead' end);
end $$;

-- ─── 4 · Lo primero que llega de GHL: las preguntas que faltaban y la empresa ─────

insert into catalogo.preguntas_estandar (clave, nombre, tipo_de_valor, unidad, descripcion, etapa, clase, eje, vigencia_dias, origen_esperado) values
  ('a_quien_ayuda', 'A quién ayuda y qué resultado entrega', 'texto', null, '¿A qué clientes ayudas y qué resultado les entregas? (abierta, del formulario Accelerator).', 'calificado', 'identidad', 'encaje', null, 'formulario'),
  ('confirmacion_por_whatsapp', 'Confirmación por WhatsApp', 'opcion', null, 'Te escribiremos por WhatsApp para confirmar tu llamada: si no respondes, se libera el horario.', 'calificado', 'compromiso', null, null, 'formulario'),
  ('fuente_del_lead', 'Fuente del lead', 'opcion', null, 'De dónde vino el lead, según el workflow de GHL que lo agendó.', 'agendado', 'trazabilidad', null, null, 'crm'),
  ('video_precall_visto', 'Cuánto vio del video previo', 'opcion', null, 'El tramo del video previo a la llamada que el lead vio (20 %, 20–40 %, 40–60 %, 60–80 %, +80 %).', 'agendado', 'confirmacion', null, null, 'crm'),
  ('cita_fecha', 'Fecha de la reunión', 'texto', null, 'La fecha de la llamada agendada, como la escribe el workflow de GHL.', 'agendado', 'cita', null, null, 'crm'),
  ('cita_hora', 'Hora de la reunión', 'texto', null, 'La hora de la llamada agendada, como la escribe el workflow de GHL.', 'agendado', 'cita', null, null, 'crm'),
  ('cita_link', 'Link de la reunión', 'texto', null, 'El enlace de la videollamada agendada.', 'agendado', 'cita', null, null, 'crm'),
  ('cita_link_reagenda', 'Link para reagendar', 'texto', null, 'El enlace para que el lead reagende la llamada.', 'agendado', 'cita', null, null, 'crm')
on conflict do nothing;

alter table negocio.contactos add column if not exists empresa text check (empresa is null or length(empresa) <= 300);
comment on column negocio.contactos.empresa is
  'El nombre de la empresa del lead en GHL (companyName). Lo pisa cada sincronización, como el nombre y el correo (118).';

-- ─── 5 · El expediente: la sección respuestas_de_los_agentes ──────────────────────
-- El cuerpo es el de la 117 sin cambios, con la columna nueva al final (create or replace sólo deja agregar al final).
create or replace view negocio.expediente_del_lead with (security_invoker = true) as
  select k.org_id, k.cuenta_id, k.id as contacto_id, k.ghl_contact_id,
    jsonb_strip_nulls(jsonb_build_object('nombre', k.nombre, 'etapa', k.etapa_estandar, 'salida', k.salida,
      'cuadrante_del_crm', k.cuadrante, 'canal_de_entrada', k.canal_de_entrada, 'fuente', k.fuente_estandar, 'pais', k.pais,
      'alta_en_el_crm', k.alta_en_el_crm, 'no_contactar', k.no_contactar_desde is not null)) as identidad,
    nullif(agentes._respuestas(k.org_id, k.cuenta_id, k.id), '{}'::jsonb) as formulario,
    (select jsonb_object_agg(e.tipo, e.n) from (select ev.tipo, count(*) as n from negocio.eventos ev
       where ev.org_id = k.org_id and ev.cuenta_id = k.cuenta_id and ev.contacto_id = k.id
         and ev.fuente not in ('ghl_managed_agents', 'comando_central') group by ev.tipo) e) as comportamiento,
    nullif(agentes._atribucion(k.org_id, k.cuenta_id, k.id), '{}'::jsonb) as atribucion,
    (select jsonb_build_object('total', count(*), 'recortado', count(*) > 50,
              'ultimos', (select jsonb_agg(jsonb_build_object('el', m2.enviado_el, 'canal', coalesce(m2.canal_estandar::text, m2.canal),
                                 'autor', m2.autor, 'texto', left(m2.cuerpo, 1000)) order by m2.enviado_el)
                            from (select * from negocio.mensajes m3 where m3.org_id = k.org_id and m3.cuenta_id = k.cuenta_id
                                     and m3.contacto_id = k.id order by m3.enviado_el desc limit 50) m2))
       from negocio.mensajes m where m.org_id = k.org_id and m.cuenta_id = k.cuenta_id and m.contacto_id = k.id
     having count(*) > 0) as conversacion,
    (select jsonb_agg(jsonb_build_object('cita_id', ci.id, 'inicio_el', ci.inicio_el, 'tipo', ci.tipo, 'estado', ci.estado_ghl,
              'asistio', ci.asistio, 'cuadrante_al_agendar', ci.cuadrante_al_agendar) order by ci.inicio_el)
       from negocio.citas ci where ci.org_id = k.org_id and ci.cuenta_id = k.cuenta_id and ci.contacto_id = k.id) as agenda,
    (select jsonb_agg(jsonb_build_object('llamada_id', l.id, 'tipo', l.tipo, 'inicio_el', l.inicio_el,
              'duracion_segundos', l.duracion_segundos, 'resumen', l.resumen,
              'transcripcion', (select left(t.texto, 4000) from negocio.transcripciones t where t.org_id = l.org_id
                                   and t.cuenta_id = l.cuenta_id and t.llamada_id = l.id order by t.creada_el desc limit 1),
              'transcripcion_recortada', (select length(t.texto) > 4000 from negocio.transcripciones t where t.org_id = l.org_id
                                   and t.cuenta_id = l.cuenta_id and t.llamada_id = l.id order by t.creada_el desc limit 1))
              order by l.inicio_el)
       from negocio.llamadas l where l.org_id = k.org_id and l.cuenta_id = k.cuenta_id and l.contacto_id = k.id) as llamadas,
    agentes._o(jsonb_build_object(
      'vigente', (select to_jsonb(tv) - 'org_id' - 'cuenta_id' from negocio.triaje_vigente tv
                   where tv.org_id = k.org_id and tv.cuenta_id = k.cuenta_id and tv.contacto_id = k.id),
      'clasificaciones', (select jsonb_agg(jsonb_build_object('cuadrante', c.cuadrante, 'origen', c.origen, 'el', c.clasificado_el)
                             order by c.clasificado_el)
                            from negocio.clasificaciones c where c.org_id = k.org_id and c.cuenta_id = k.cuenta_id and c.contacto_id = k.id)))
      as triaje,
    (select to_jsonb(fv) - 'org_id' - 'cuenta_id' from negocio.ficha_vigente fv
      where fv.org_id = k.org_id and fv.cuenta_id = k.cuenta_id and fv.contacto_id = k.id) as ficha,
    agentes._o(jsonb_build_object(
      'propuestos', (select jsonb_agg(jsonb_build_object('id', p.id, 'compro', p.compro, 'salida', p.salida, 'monto_usd', p.monto_usd,
                        'estado', p.estado, 'next_steps', p.next_steps, 'creado_el', p.creado_el) order by p.creado_el)
                       from negocio.resultados_propuestos p where p.org_id = k.org_id and p.cuenta_id = k.cuenta_id and p.contacto_id = k.id),
      'confirmados', (select jsonb_agg(jsonb_build_object('id', r.id, 'salida', r.salida, 'monto_usd', r.monto_usd, 'el', r.creado_el)
                         order by r.creado_el)
                        from negocio.resultados r where r.org_id = k.org_id and r.cuenta_id = k.cuenta_id and r.contacto_id = k.id)))
      as resultado,
    (select jsonb_agg(jsonb_build_object('id', ev.id, 'puntaje', ev.puntaje, 'fases', ev.fases, 'donde_se_perdio', ev.donde_se_perdio)
              order by ev.creada_el)
       from negocio.evaluaciones_de_llamada ev where ev.org_id = k.org_id and ev.cuenta_id = k.cuenta_id and ev.contacto_id = k.id)
      as evaluacion,
    (select jsonb_agg(jsonb_build_object('categoria', o.categoria, 'texto', o.texto, 'resuelta', o.resuelta) order by o.creada_el)
       from negocio.objeciones_de_llamada o where o.org_id = k.org_id and o.cuenta_id = k.cuenta_id and o.contacto_id = k.id) as objeciones,
    (select jsonb_agg(jsonb_build_object('id', b.id, 'motivo', b.motivo, 'canal', b.canal, 'estado', b.estado, 'cuerpo', b.cuerpo)
              order by b.creado_el)
       from negocio.borradores_de_mensaje b where b.org_id = k.org_id and b.cuenta_id = k.cuenta_id and b.contacto_id = k.id)
      as seguimientos,
    (select jsonb_agg(jsonb_build_object('fuente', 'publica:' || p.id, 'tipo', p.tipo, 'url', p.url, 'extracto', left(p.extracto, 1000),
              'observada_el', p.observada_el) order by p.observada_el)
       from negocio.fuentes_publicas p where p.org_id = k.org_id and p.cuenta_id = k.cuenta_id and p.contacto_id = k.id
         and not exists (select 1 from negocio.corridas_de_agente cx where cx.org_id = p.org_id and cx.cuenta_id = p.cuenta_id
                      and cx.id = p.corrida_id and cx.estado in ('fallida', 'reemplazada', 'cancelada')))
      as evidencia_publica,
    agentes._o(jsonb_build_object(
      'entregable', agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'brief'),
      'respuestas', (select jsonb_object_agg(bv.pregunta, jsonb_build_object('valor', coalesce(bv.valor_json, to_jsonb(bv.valor_texto)),
                        'estado', bv.estado, 'autor', bv.autor_tipo, 'fuente', bv.fuente))
                       from negocio.brief_vigente bv where bv.org_id = k.org_id and bv.cuenta_id = k.cuenta_id and bv.contacto_id = k.id)))
      as brief,
    agentes._research_del_lead(k.org_id, k.cuenta_id, k.id) as research,
    (select jsonb_agg(jsonb_build_object('sobre', d.sobre, 'decision', d.decision, 'autor', d.autor, 'el', d.creada_el) order by d.creada_el)
       from negocio.decisiones_de_kickoff d where d.org_id = k.org_id and d.cuenta_id = k.cuenta_id and d.contacto_id = k.id) as kickoff,
    agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'icp') as icp_del_lead,
    agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'categoria_y_oferta') as categoria_y_oferta,
    agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'precio_y_process_map') as precio_y_process_map,
    agentes._o(jsonb_build_object(
      'guion_vsl', agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'guion_vsl'),
      'anuncios', agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'anuncios'),
      'prompt_landing', agentes._entregable_del_lead(k.org_id, k.cuenta_id, k.id, 'prompt_landing'),
      'piezas', (select jsonb_agg(jsonb_build_object('pieza_id', pc.id, 'tipo', pc.tipo, 'codigo', pc.codigo_de_nomenclatura,
                    'titular', pc.titular, 'estado', pc.estado) order by pc.creada_el)
                   from negocio.piezas_de_contenido pc where pc.org_id = k.org_id and pc.cuenta_id = k.cuenta_id and pc.contacto_id = k.id)))
      as embudo,
    (select jsonb_agg(jsonb_build_object('corrida_id', c.id, 'agente', c.agente, 'estado', c.estado, 'modo', c.modo, 'motivo', c.motivo,
              'identificado_por', c.identificado_por, 'abierta_el', c.abierta_el, 'terminada_el', c.terminada_el) order by c.abierta_el)
       from negocio.corridas_de_agente c where c.org_id = k.org_id and c.cuenta_id = k.cuenta_id and c.contacto_id = k.id) as corridas,
    -- 118: qué dejó cada agente en respuestas_de_los_agentes y cuándo, sin el HTML (se lee con agentes.leer_respuesta).
    (select jsonb_strip_nulls(jsonb_build_object('triage_cuadrante_de_clasificacion', r.triage_cuadrante_de_clasificacion,
              'procedencia', r.procedencia))
       from negocio.respuestas_de_los_agentes r
      where r.org_id = k.org_id and r.cuenta_id = k.cuenta_id and r.contacto_id = k.id) as respuestas_de_los_agentes
  from negocio.contactos k;

-- ─── 6 · Permisos ────────────────────────────────────────────────────────────────
-- El mismo cierre de la 115: nada para PUBLIC, el inquilino ejecuta todo, y el rol de los agentes todo menos lo que
-- cambia el conocimiento de la cuenta o crea cuentas.
do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as firma, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'agentes' loop
    execute format('revoke all on function %s from public', f.firma);
    execute format('grant execute on function %s to app_inquilino', f.firma);
    if f.proname in ('cargar_conocimiento', 'cargar_rutas', 'alta_del_comprador') then
      execute format('revoke execute on function %s from agente_mcp', f.firma);
    else
      execute format('grant execute on function %s to agente_mcp', f.firma);
    end if;
  end loop;
end $$;
