-- 124 · Research y Estratega en la tabla de respuestas: un output cada uno, y se borra lo viejo.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (reunión del 23/11 y decisiones del usuario del 2026-11-24; MANAGED-AGENTS-FASE-2-RESEARCH-Y-ESTRATEGA.md)
--
-- Los agentes 5 (Research) y 6 (Estratega) pasan al modelo de la 118: un solo output, en una columna de
-- negocio.respuestas_de_los_agentes, al lado de los anteriores.
--   · Research lee la ficha del lead 2 (sales_coach_ficha_de_lead_2) y la ficha de cliente 2 (la del Brief, que guarda
--     el n8n de Walter en public.aria_cc_icp_oferta), investiga con Apify y guarda el market research en
--     research_market_research.
--   · Estratega lee el research y guarda la oferta en estratega_oferta. No investiga.
--   · Los dos son HTML que no pasan a PDF.
--
-- POR SECCIONES. El research entero no entra en una respuesta del agente (el problema que la 120 resolvió para las
-- fichas). El agente manda sus secciones con agentes.guardar_secciones y la base arma el documento: la envoltura de
-- su columna + la plantilla con sus marcadores {{seccion:<id>}} (o, sin plantilla, una <section> por cada una en el
-- orden recibido) + </body></html>. Las plantillas (Med Spas y Boss Lady Mind) se cargan cuando estén: mientras,
-- plantilla y secciones_obligatorias quedan en null y la envoltura es una simple provisoria.
--
-- LA FICHA DE CLIENTE 2. agentes.leer_ficha_de_cliente_2 la busca en public.aria_cc_icp_oferta por el correo del lead,
-- con el Brief completo (form_completo = 'SI'). Medido en producción el 2026-11-24: las filas del Brief nuevo tienen
-- org_id NULL (las que tienen org_id son de otras organizaciones y no tienen correo), así que se acepta org_id NULL
-- (sólo para la organización principal, ARIA, que es la del Brief) o el de la corrida. La tabla es de postgres (el flujo de Walter) y los managed agents corren el SQL por el MCP como
-- postgres, su dueño: la función (security invoker) la lee sin ningún permiso nuevo. No se toca la tabla de Walter.
-- Sin la tabla (en local) o sin permiso (como el inquilino), devuelve el motivo en vez de un error.
--
-- SE BORRA LO VIEJO (decisión del usuario: Research, Estratega, Funnel Builder, Kickoff y el Brief estructurado). Sólo
-- tenían datos de prueba: 8 entregables, 19 versiones, 23 respuestas del Brief, 16 segmentos, 11 dolores, 26
-- referentes y 23 citas del mercado. leer_brief queda (el Brief Agent lo usa para leer sus fuentes) sin lo borrado.
-- Un agente sin salida definida (hoy, el Funnel Builder) ya no puede abrir una corrida.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · El expediente sale primero (lee lo que se borra); se vuelve a crear al final ─

drop view if exists negocio.expediente_del_lead;

-- ─── 2 · Las dos salidas nuevas: el catálogo, las columnas y la vista ──────────────

alter table catalogo.salidas_de_los_agentes add column if not exists por_secciones boolean not null default false;
alter table catalogo.salidas_de_los_agentes add column if not exists plantilla text;
alter table catalogo.salidas_de_los_agentes add column if not exists secciones_obligatorias text[];
comment on column catalogo.salidas_de_los_agentes.por_secciones is
  'true: la salida se guarda sólo con agentes.guardar_secciones (Research y Estratega, 124); guardar_respuesta la rechaza. false: sólo con guardar_respuesta (las fichas, que tienen su propio armado, como la ficha 2 que incluye la 1).';
comment on column catalogo.salidas_de_los_agentes.plantilla is
  'El cuerpo del documento (lo que va dentro de <body>) con un marcador {{seccion:<id>}} por sección (124). Si está, la columna se guarda con agentes.guardar_secciones, que reemplaza cada marcador por la sección del agente. Null: sin plantilla.';
comment on column catalogo.salidas_de_los_agentes.secciones_obligatorias is
  'Los ids de sección que guardar_secciones exige (124). Sólo con plantilla, y cada uno tiene que ser un marcador de ella.';
alter table catalogo.salidas_de_los_agentes drop constraint if exists salidas_la_plantilla_va_con_su_envoltura;
alter table catalogo.salidas_de_los_agentes add constraint salidas_la_plantilla_va_con_su_envoltura check (
  plantilla is null
  or (tipo = 'html' and por_secciones and envoltura is not null and agentes._reglas_del_html(plantilla) = '[]'::jsonb
      and plantilla ~ '\{\{seccion:[a-z][a-z0-9_]{0,59}\}\}'
      and plantilla !~* '<!doctype' and plantilla !~* '<[[:space:]]*/?[[:space:]]*(html|head|body|title|style)([[:space:]>/]|$)'));
alter table catalogo.salidas_de_los_agentes drop constraint if exists salidas_por_secciones_sólo_html;
alter table catalogo.salidas_de_los_agentes add constraint salidas_por_secciones_sólo_html check (
  not por_secciones or (tipo = 'html' and incluye_antes is null));
alter table catalogo.salidas_de_los_agentes drop constraint if exists salidas_obligatorias_sólo_con_plantilla;
alter table catalogo.salidas_de_los_agentes add constraint salidas_obligatorias_sólo_con_plantilla check (
  secciones_obligatorias is null or (plantilla is not null and cardinality(secciones_obligatorias) >= 1));

insert into catalogo.salidas_de_los_agentes (clave, agente, orden, tipo, nombre, descripcion, envoltura) values
  ('research_market_research', 'research', 5, 'html', 'Market research',
   'El market research del nicho del cliente: a quién le vende, qué le duele, quién ya lo resuelve, cuánto se cobra y qué segmento elegir (las 4 R), con sus fuentes. HTML que no pasa a PDF; el agente lo guarda por secciones (124).',
   $env$<!DOCTYPE html>
<html lang="es"><head>
<title>Market research · ARIA IA</title>
<style>
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #FFFFFF; color: #1A1F29; font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hoja { max-width: 780px; margin: 0 auto; padding: 24px 20px 32px; }
.top { border-bottom: 2px solid #0B6F93; padding-bottom: 10px; margin-bottom: 18px; overflow: hidden; }
.marca { float: left; font-size: 13px; font-weight: bold; color: #0B6F93; }
.marca small { font-weight: normal; color: #5B6576; }
.fecha { float: right; font-size: 11px; color: #5B6576; }
h1 { margin: 0 0 2px; font-size: 24px; line-height: 1.2; }
.sub { margin: 0 0 16px; font-size: 14px; color: #3D4654; }
h2 { margin: 0 0 10px; font-size: 15px; color: #04060A; }
.caja { border: 1px solid #DDE3EA; border-radius: 8px; padding: 14px 16px; margin: 0 0 14px; page-break-inside: avoid; break-inside: avoid; }
.destacada { border: 2px solid #0B6F93; background: #F2F8FB; }
.destacada p { margin: 0 0 8px; }
.enlace { font-size: 14px; font-weight: bold; }
.enlace a { color: #0B6F93; }
.cifras { width: 100%; border-collapse: collapse; margin: 0 0 14px; }
.cifras td { width: 33%; border: 1px solid #DDE3EA; padding: 10px 12px; vertical-align: top; }
.cifras b { display: block; font-size: 18px; color: #04060A; }
.cifras span { font-size: 11px; color: #5B6576; }
ul, ol { margin: 0; padding-left: 20px; }
li { margin: 0 0 5px; }
.seccion { margin: 18px 0 0; }
.seccion h2 { border-bottom: 1px solid #DDE3EA; padding-bottom: 6px; }
.n { display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 11px; background: #0B6F93; color: #FFFFFF; font-size: 12px; margin-right: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; vertical-align: top; padding: 7px 8px; border-bottom: 1px solid #EEF1F5; }
th { width: 40%; font-weight: normal; color: #3D4654; }
tr { page-break-inside: avoid; break-inside: avoid; }
.de { display: block; font-size: 10.5px; color: #7F8A9B; margin-top: 2px; }
.falta { color: #8A6A12; font-style: italic; }
.pie { margin-top: 24px; padding-top: 10px; border-top: 1px solid #DDE3EA; font-size: 10.5px; color: #7F8A9B; }
</style></head><body>$env$),
  ('estratega_oferta', 'estratega', 6, 'html', 'Oferta',
   'La oferta que sale del research aceptado: clienta ideal, dolores, big idea, mecanismo, fórmula, precio, garantía, auditoría y ajustes. HTML que no pasa a PDF; el agente la guarda por secciones (124).',
   $env$<!DOCTYPE html>
<html lang="es"><head>
<title>Oferta · ARIA IA</title>
<style>
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #FFFFFF; color: #1A1F29; font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hoja { max-width: 780px; margin: 0 auto; padding: 24px 20px 32px; }
.top { border-bottom: 2px solid #0B6F93; padding-bottom: 10px; margin-bottom: 18px; overflow: hidden; }
.marca { float: left; font-size: 13px; font-weight: bold; color: #0B6F93; }
.marca small { font-weight: normal; color: #5B6576; }
.fecha { float: right; font-size: 11px; color: #5B6576; }
h1 { margin: 0 0 2px; font-size: 24px; line-height: 1.2; }
.sub { margin: 0 0 16px; font-size: 14px; color: #3D4654; }
h2 { margin: 0 0 10px; font-size: 15px; color: #04060A; }
.caja { border: 1px solid #DDE3EA; border-radius: 8px; padding: 14px 16px; margin: 0 0 14px; page-break-inside: avoid; break-inside: avoid; }
.destacada { border: 2px solid #0B6F93; background: #F2F8FB; }
.destacada p { margin: 0 0 8px; }
.enlace { font-size: 14px; font-weight: bold; }
.enlace a { color: #0B6F93; }
.cifras { width: 100%; border-collapse: collapse; margin: 0 0 14px; }
.cifras td { width: 33%; border: 1px solid #DDE3EA; padding: 10px 12px; vertical-align: top; }
.cifras b { display: block; font-size: 18px; color: #04060A; }
.cifras span { font-size: 11px; color: #5B6576; }
ul, ol { margin: 0; padding-left: 20px; }
li { margin: 0 0 5px; }
.seccion { margin: 18px 0 0; }
.seccion h2 { border-bottom: 1px solid #DDE3EA; padding-bottom: 6px; }
.n { display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 11px; background: #0B6F93; color: #FFFFFF; font-size: 12px; margin-right: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; vertical-align: top; padding: 7px 8px; border-bottom: 1px solid #EEF1F5; }
th { width: 40%; font-weight: normal; color: #3D4654; }
tr { page-break-inside: avoid; break-inside: avoid; }
.de { display: block; font-size: 10.5px; color: #7F8A9B; margin-top: 2px; }
.falta { color: #8A6A12; font-style: italic; }
.pie { margin-top: 24px; padding-top: 10px; border-top: 1px solid #DDE3EA; font-size: 10.5px; color: #7F8A9B; }
</style></head><body>$env$)
on conflict (clave) do nothing;
update catalogo.salidas_de_los_agentes set por_secciones = true
 where clave in ('research_market_research', 'estratega_oferta') and not por_secciones;

update catalogo.agentes set disparadores = '{brief_completado}', requiere_aprobacion = false where clave = 'research';
update catalogo.agentes set disparadores = '{research_aprobado}', requiere_aprobacion = false where clave = 'estratega';

alter table negocio.respuestas_de_los_agentes
  add column if not exists research_market_research text check (research_market_research is null
                                                                 or octet_length(research_market_research) between 1 and 1048576),
  add column if not exists estratega_oferta text check (estratega_oferta is null
                                                         or octet_length(estratega_oferta) between 1 and 1048576);
comment on column negocio.respuestas_de_los_agentes.research_market_research is
  '5 · Research: el market research (124). Lo arma agentes.guardar_secciones; las secciones quedan en la salida de su corrida.';
comment on column negocio.respuestas_de_los_agentes.estratega_oferta is
  '6 · Estratega: la oferta (124). Lo arma agentes.guardar_secciones.';

-- El chequeo del HTML vale también para las dos columnas nuevas (la 118 lo creó con sus tres).
alter table negocio.respuestas_de_los_agentes drop constraint if exists respuestas_el_html_sin_contenido_activo;
alter table negocio.respuestas_de_los_agentes add constraint respuestas_el_html_sin_contenido_activo check (
  (sales_assistant_ficha_de_lead_1 is null or agentes._reglas_del_html(sales_assistant_ficha_de_lead_1) = '[]'::jsonb)
  and (sales_coach_ficha_de_lead_2 is null or agentes._reglas_del_html(sales_coach_ficha_de_lead_2) = '[]'::jsonb)
  and (brief_ficha_de_cliente_1 is null or agentes._reglas_del_html(brief_ficha_de_cliente_1) = '[]'::jsonb)
  and (research_market_research is null or agentes._reglas_del_html(research_market_research) = '[]'::jsonb)
  and (estratega_oferta is null or agentes._reglas_del_html(estratega_oferta) = '[]'::jsonb));

grant update (research_market_research, estratega_oferta) on negocio.respuestas_de_los_agentes to app_inquilino;
grant update (research_market_research, estratega_oferta) on negocio.respuestas_de_los_agentes to agente_mcp;

drop view if exists negocio.respuestas_por_lead;
create view negocio.respuestas_por_lead with (security_invoker = true) as
  select r.org_id, r.cuenta_id, r.contacto_id, k.ghl_contact_id, k.nombre, k.email,
         r.triage_cuadrante_de_clasificacion,
         r.sales_assistant_ficha_de_lead_1,
         r.sales_coach_ficha_de_lead_2,
         r.brief_ficha_de_cliente_1,
         r.research_market_research,
         r.estratega_oferta,
         r.procedencia, r.creado_el, r.actualizado_el
    from negocio.respuestas_de_los_agentes r
    join negocio.contactos k on k.org_id = r.org_id and k.cuenta_id = r.cuenta_id and k.id = r.contacto_id;
comment on view negocio.respuestas_por_lead is
  'Una fila por lead con lo que dejó cada managed agent, en el orden del flujo (118; 124 con Research y Estratega). Para agregar una salida, recrearla con la columna nueva al lado de la de su agente.';
revoke all on negocio.respuestas_por_lead from public, app_inquilino;
grant select on negocio.respuestas_por_lead to app_inquilino, agente_mcp;

-- ─── 3 · Lo que queda, corregido ─────────────────────────────────────────────────

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
  p_modelo               text default null,
  p_identificado_por    text default 'workflow'
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
  -- 124: un agente sin una salida vigente (hoy, el Funnel Builder) no se abre: no tendría dónde guardar. Va antes de
  -- la vuelta por idempotencia, así tampoco se reutiliza una corrida vieja suya.
  if not exists (select 1 from catalogo.salidas_de_los_agentes s where s.agente = p_agente and s.vigente) then
    raise exception using errcode = '22023',
      message = format('agentes: el agente %s todavía no tiene salida definida (catalogo.salidas_de_los_agentes)', p_agente);
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
  if coalesce(p_identificado_por, 'workflow') not in ('workflow', 'correo', 'persona') then
    raise exception using errcode = '22023', message = 'agentes: identificado_por es workflow, correo o persona';
  end if;
  -- El modo sombra era del Triage estructurado, que se borró en la 119: hoy ningún agente lo tiene.
  if coalesce(p_modo, 'activo') = 'sombra' then
    raise exception using errcode = '22023', message = 'agentes: ningún agente corre en modo sombra (desde la 119)';
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
     where ci.org_id = v_org and ci.cuenta_id = v_cuenta and ci.ghl_evento_id = p_sujeto ->> 'ghl_evento_id'
       and ci.contacto_id = v_contacto.id;
    if v_cita is null then
      v_faltantes := v_faltantes || to_jsonb('cita_en_la_base'::text);
    end if;
  end if;
  if p_sujeto ? 'llamada_id' then
    select l.id into v_llamada from negocio.llamadas l
     where l.org_id = v_org and l.cuenta_id = v_cuenta and l.id = (p_sujeto ->> 'llamada_id')::uuid
       and l.contacto_id = v_contacto.id;
    if v_llamada is null then
      raise exception using errcode = 'P0002', message = 'agentes: la llamada no es de este lead';
    end if;
  end if;

  -- Todos trabajan en la cuenta de la location, sobre el lead (119: sin la rama del comprador).
  v_trab_org := v_org;
  v_trab_cta := v_cuenta;

  -- Los agentes del lead que compró o no (Brief, Research, Estratega, Funnel Builder) trabajan sobre el contacto, en la
  -- misma cuenta: su expediente. La venta, si la hubo, es sólo una referencia.
  if v_agente.cuenta_de_trabajo = 'contacto' then
    if v_contacto.id is null then
      raise exception using errcode = 'P0002',
        message = 'agentes: este agente trabaja sobre un lead que ya está en la base (identifícalo con agentes.buscar_contacto)';
    end if;
  end if;

  if v_sesion is not null and v_sesion::uuid <> v_trab_org then
    raise exception using errcode = '42501', message = 'agentes: la sesión es de otra organización que la de la corrida';
  end if;

  -- Sin carreras: dos aperturas simultáneas de la misma clave o del mismo sujeto se esperan.
  perform pg_advisory_xact_lock(hashtextextended('corrida:' || v_trab_cta || ':' || p_agente || ':' || p_clave_de_idempotencia, 0));
  -- La idempotencia: la misma clave devuelve la misma corrida.
  select * into v_existente from negocio.corridas_de_agente
   where org_id = v_trab_org and cuenta_id = v_trab_cta and agente = p_agente and clave_de_idempotencia = p_clave_de_idempotencia;
  if found and ((v_existente.contacto_id is not null and v_existente.contacto_id is distinct from v_contacto.id)
                 or (v_agente.cuenta_de_trabajo in ('vendedor', 'contacto')
                     and v_existente.ghl_contact_id is distinct from p_ghl_contact_id)) then
    raise exception using errcode = '42501', message = 'agentes: esa clave de idempotencia ya es de una corrida de otro lead';
  end if;
  if found then
    return jsonb_build_object('ok', true, 'corrida_id', v_existente.id, 'reutilizada', true, 'estado', v_existente.estado,
      'org_id', v_existente.org_id, 'cuenta_id', v_existente.cuenta_id, 'contacto_id', v_existente.contacto_id,
      'cita_id', v_existente.cita_id, 'llamada_id', v_existente.llamada_id);
  end if;

  v_sujeto := case
    when v_agente.cuenta_de_trabajo = 'contacto'
      then 'contacto:' || v_contacto.id || coalesce(':' || coalesce(p_sujeto ->> 'paso', p_sujeto ->> 'etapa', p_sujeto ->> 'pieza'), '')
    when v_agente.sujeto = 'llamada' and v_llamada is not null then 'llamada:' || v_llamada
    when v_agente.sujeto = 'cita' and v_cita is not null then 'cita:' || (p_sujeto ->> 'ghl_evento_id')
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
    org_id, cuenta_id, id, agente, modo, sujeto_clave, contacto_id, ghl_contact_id, cita_id, llamada_id,
    disparador, clave_de_idempotencia, motivo,
    entrada, entrada_huella, sesion_externa_id, version_del_agente, version_de_la_skill, modelo, identificado_por)
  values (
    v_trab_org, v_trab_cta, v_id, p_agente, coalesce(p_modo, 'activo'), left(v_sujeto, 300),
    v_contacto.id, p_ghl_contact_id, v_cita, v_llamada,
    p_disparador, p_clave_de_idempotencia, v_motivo, p_entrada, md5(p_entrada::text),
    p_sesion_externa_id, p_version_del_agente, p_version_de_la_skill, p_modelo, coalesce(p_identificado_por, 'workflow'));

  return jsonb_build_object('ok', true, 'corrida_id', v_id, 'reutilizada', false, 'estado', 'abierta', 'motivo', v_motivo,
    'org_id', v_trab_org, 'cuenta_id', v_trab_cta, 'contacto_id', v_contacto.id, 'cita_id', v_cita, 'llamada_id', v_llamada,
    'reemplazo_a', to_jsonb(v_reemplazo),
    'no_contactar', v_contacto.no_contactar_desde is not null, 'faltantes', v_faltantes,
    'identificado_por', coalesce(p_identificado_por, 'workflow'),
    -- Lo siguiente: cada agente lee lo suyo y guarda su columna (118 a 124).
    'siguiente', case
      when exists (select 1 from catalogo.salidas_de_los_agentes s where s.agente = p_agente and s.tipo = 'cuadrante' and s.vigente)
        then format('select agentes.expediente(%L, %L) y después agentes.registrar_cuadrante(%L, <cuadrante>, <razón>)', v_id, '{identidad,formulario}', v_id)
      when p_agente = 'sales_coach'
        then format('select agentes.leer_llamada(%L) y después agentes.guardar_respuesta(%L, <html>)', v_id, v_id)
      when p_agente = 'research'
        then format('select agentes.leer_respuesta(%L, %L) y agentes.leer_ficha_de_cliente_2(%L); después agentes.guardar_secciones(%L, <secciones>)',
                    v_id, 'sales_coach_ficha_de_lead_2', v_id, v_id)
      when p_agente = 'estratega'
        then format('select agentes.leer_respuesta(%L, %L) (o agentes.leer_secciones); después agentes.guardar_secciones(%L, <secciones>)',
                    v_id, 'research_market_research', v_id)
      else format('select agentes.expediente(%L) y después agentes.guardar_respuesta(%L, <html>)', v_id, v_id) end);
end $$;

create or replace function agentes.guardar_respuesta(p_corrida uuid, p_html text, p_columna text default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v           negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_columna   text := agentes._salida_del_agente(v, 'html', nullif(btrim(p_columna), ''));
  v_err       jsonb;
  v_version   integer;
  v_envoltura text;
  v_html      text := p_html;
  v_envuelta  boolean := false;
  v_contenido text;
  v_antes     text;
  v_previa    text;
  v_proc_prev jsonb;
  v_env_prev  text;
  v_cuerpo_prev text;
  v_incluye   jsonb;
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
  -- 124: una salida que se guarda por secciones (Research y Estratega) no entra entera: así nadie se saltea la plantilla.
  if exists (select 1 from catalogo.salidas_de_los_agentes s where s.clave = v_columna and s.por_secciones) then
    return agentes._rechazar(v, jsonb_build_array(format(
      'la salida «%s» se guarda por secciones: usa agentes.guardar_secciones', v_columna)));
  end if;
  -- Sin espacios ni saltos de línea en las puntas (btrim sólo quita espacios).
  v_contenido := regexp_replace(coalesce(p_html, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if v_contenido = '' then
    return agentes._rechazar(v, agentes._reglas_del_html(''));
  end if;
  select s.envoltura, s.incluye_antes into v_envoltura, v_antes from catalogo.salidas_de_los_agentes s where s.clave = v_columna;
  if v_envoltura is not null and p_html !~* '<[[:space:]]*html([[:space:]>/]|$)' then
    if p_html ~* '<!doctype' or p_html ~* '<[[:space:]]*/?[[:space:]]*(head|body|title|style)([[:space:]>/]|$)' then
      return agentes._rechazar(v, jsonb_build_array(
        'html: manda sólo lo que va dentro de <body>, sin <!DOCTYPE>, <head>, <body>, <title> ni <style>: el estilo lo pone la base'));
    end if;
    -- La ficha que va antes (121): la del Sales Assistant, sin su envoltura, si existe y quedó envuelta por la base.
    if v_antes is not null then
      execute format('select %I, procedencia -> %L from negocio.respuestas_de_los_agentes'
                     ' where org_id = $1 and cuenta_id = $2 and contacto_id = $3', v_antes, v_antes)
         into v_previa, v_proc_prev using v.org_id, v.cuenta_id, v.contacto_id;
      select s.envoltura into v_env_prev from catalogo.salidas_de_los_agentes s where s.clave = v_antes;
      if v_previa is not null and v_env_prev is not null
         and left(v_previa, length(v_env_prev) + 1) = v_env_prev || E'\n'
         and right(v_previa, 15) = E'\n</body></html>' then
        v_cuerpo_prev := substr(v_previa, length(v_env_prev) + 2, length(v_previa) - length(v_env_prev) - 16);
        v_incluye := jsonb_build_object('columna', v_antes, 'version', (v_proc_prev ->> 'version')::integer,
                                        'corrida_id', v_proc_prev ->> 'corrida_id');
      end if;
    end if;
    v_html := v_envoltura || E'\n' || coalesce(v_cuerpo_prev || E'\n', '') || v_contenido || E'\n</body></html>';
    v_envuelta := true;
  end if;
  v_err := agentes._reglas_del_html(v_html);
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;
  v_version := agentes._escribir_respuesta(v, v_columna, v_html,
    case when v_envuelta then jsonb_strip_nulls(jsonb_build_object('con_el_estilo_de_la_base', true, 'incluye', v_incluye)) end);
  perform agentes._cerrar(v, jsonb_build_object('columna', v_columna, 'version', v_version,
    'bytes', octet_length(v_html), 'con_el_estilo_de_la_base', v_envuelta, 'incluye', v_incluye, 'html', v_html), 0, 'lista');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'columna', v_columna, 'version', v_version,
    'bytes', octet_length(v_html), 'con_el_estilo_de_la_base', v_envuelta, 'incluye', v_incluye);
end $$;

-- El Brief Agent lee aquí sus fuentes: la llamada de venta, el formulario y lo público. 124: sin el entregable (lo
-- creaba como efecto), sin las preguntas del Brief ni lo ya respondido (se borraron); guarda con guardar_respuesta.
create or replace function agentes.leer_brief(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v         negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  vo        uuid := v.org_id;
  vc        uuid := v.cuenta_id;
  vk        uuid := v.contacto_id;
  v_fuentes jsonb := '{}'::jsonb;
  v_falta   jsonb := '[]'::jsonb;
  v_trans   record;
begin
  select t.texto, t.llamada_id into v_trans from negocio.transcripciones t
    join negocio.llamadas l on l.org_id = t.org_id and l.cuenta_id = t.cuenta_id and l.id = t.llamada_id
   where t.org_id = vo and t.cuenta_id = vc and l.contacto_id = vk and l.tipo = 'venta'
   order by t.creada_el desc limit 1;
  if v_trans.texto is not null then
    v_fuentes := v_fuentes || jsonb_build_object('llamada_venta:' || v_trans.llamada_id, left(v_trans.texto, 60000));
  else
    v_falta := v_falta || to_jsonb('transcripcion_de_venta'::text);
  end if;
  v_fuentes := v_fuentes || agentes._respuestas(vo, vc, vk);
  v_fuentes := v_fuentes || coalesce((select jsonb_object_agg('publica:' || p.id, p.extracto) from negocio.fuentes_publicas p
                                       where p.org_id = vo and p.cuenta_id = vc and p.contacto_id = vk
                                         and (p.vigente_hasta is null or p.vigente_hasta > now())
                                         and not exists (select 1 from negocio.corridas_de_agente cx where cx.org_id = p.org_id and cx.cuenta_id = p.cuenta_id
                      and cx.id = p.corrida_id and cx.estado in ('fallida', 'reemplazada', 'cancelada'))), '{}'::jsonb);

  perform agentes._anotar_lectura(v, v_fuentes);
  return jsonb_build_object('corrida_id', v.id, 'agente', 'brief', 'fuentes', v_fuentes, 'faltantes', v_falta,
    'contrato', 'agentes.guardar_respuesta(corrida_id, <el contenido de la ficha de cliente>): la base le pone el estilo y la guarda en brief_ficha_de_cliente_1.');
end $$;

-- ─── 4 · Guardar y leer por secciones ─────────────────────────────────────────────

-- El agente manda sus secciones, en orden: [{"id": "resumen", "html": "…"}, …]. La base arma el documento con la
-- envoltura y la plantilla de su columna, lo valida entero y lo guarda; las secciones quedan en la salida de la corrida.
create or replace function agentes.guardar_secciones(p_corrida uuid, p_secciones jsonb, p_columna text default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v           negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_columna   text := agentes._salida_del_agente(v, 'html', nullif(btrim(p_columna), ''));
  v_plantilla text;
  v_envoltura text;
  v_oblig     text[];
  v_err       jsonb := '[]'::jsonb;
  v_ids       text[] := '{}';
  v_mapa      jsonb := '{}'::jsonb;
  v_lista     jsonb := '[]'::jsonb;
  v_marcas    text[] := '{}';
  v_partes    text[];
  v_cuerpo    text := '';
  v_doc       text;
  v_version   integer;
  v_id        text;
  v_html      text;
  e           record;
  i           integer;
begin
  if v_columna is null then
    return agentes._rechazar(v, jsonb_build_array(format(
      'el agente %s no guarda un documento%s: las columnas de cada agente están en catalogo.salidas_de_los_agentes',
      v.agente, coalesce(' en «' || nullif(btrim(p_columna), '') || '»', ''))));
  end if;
  if v_columna = 'varias' then
    return agentes._rechazar(v, jsonb_build_array('el agente guarda más de un documento: di cuál con p_columna'));
  end if;
  if v.contacto_id is null then
    return agentes._rechazar(v, jsonb_build_array('el lead todavía no está en la base: vuelve a intentarlo en unos minutos'));
  end if;
  select s.plantilla, s.envoltura, s.secciones_obligatorias into v_plantilla, v_envoltura, v_oblig
    from catalogo.salidas_de_los_agentes s where s.clave = v_columna;
  -- Sólo las salidas que se arman por secciones (Research y Estratega): las fichas tienen su propio armado (la 2
  -- incluye la 1) y se guardan con guardar_respuesta.
  if not exists (select 1 from catalogo.salidas_de_los_agentes s where s.clave = v_columna and s.por_secciones) then
    return agentes._rechazar(v, jsonb_build_array(format(
      'la salida «%s» no se guarda por secciones: usa agentes.guardar_respuesta', v_columna)));
  end if;
  -- Un catálogo mal armado no es culpa del agente: no le gasta intentos.
  if v_oblig is not null and exists (select 1 from unnest(v_oblig) x
       where position('{{seccion:' || x || '}}' in coalesce(v_plantilla, '')) = 0) then
    raise exception using errcode = '22023', message = format(
      'agentes: el catálogo de «%s» pide secciones que su plantilla no tiene: hay que corregir catalogo.salidas_de_los_agentes', v_columna);
  end if;

  if p_secciones is null or jsonb_typeof(p_secciones) <> 'array' or jsonb_array_length(p_secciones) = 0 then
    return agentes._rechazar(v, jsonb_build_array(
      'secciones: un arreglo [{"id": "resumen", "html": "…"}, …] con al menos una sección, en el orden del documento'));
  end if;
  if jsonb_array_length(p_secciones) > 40 then
    return agentes._rechazar(v, jsonb_build_array('secciones: hasta 40'));
  end if;

  for e in select x.valor, x.n from jsonb_array_elements(p_secciones) with ordinality as x(valor, n) loop
    if jsonb_typeof(e.valor) <> 'object' then
      v_err := v_err || to_jsonb(format('secciones[%s]: cada sección es un objeto {"id": "…", "html": "…"}', e.n));
      continue;
    end if;
    v_id := e.valor ->> 'id';
    v_html := regexp_replace(coalesce(e.valor ->> 'html', ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if v_id is null or v_id !~ '^[a-z][a-z0-9_]{0,59}$' then
      v_err := v_err || to_jsonb(format('secciones[%s]: el id va en minúsculas, con letras, números y guion bajo, empieza con una letra y tiene hasta 60 caracteres', e.n));
      continue;
    end if;
    if v_id = any (v_ids) then
      v_err := v_err || to_jsonb(format('secciones[%s]: «%s» está repetida', e.n, v_id));
      continue;
    end if;
    if v_html = '' then
      v_err := v_err || to_jsonb(format('sección «%s»: está vacía', v_id));
    elsif v_html ~* '<!doctype' or v_html ~* '<[[:space:]]*/?[[:space:]]*(html|head|body|title|style)([[:space:]>/]|$)' then
      v_err := v_err || to_jsonb(format('sección «%s»: sólo el contenido, sin <!DOCTYPE>, <html>, <head>, <body>, <title> ni <style>: el estilo lo pone la base', v_id));
    elsif position('{{seccion:' in v_html) > 0 then
      v_err := v_err || to_jsonb(format('sección «%s»: no puede traer el texto «{{seccion:» (es el marcador de la plantilla)', v_id));
    end if;
    v_ids := v_ids || v_id;
    v_mapa := v_mapa || jsonb_build_object(v_id, v_html);
    v_lista := v_lista || jsonb_build_array(jsonb_build_object('id', v_id, 'html', v_html));
  end loop;

  if v_plantilla is not null then
    v_marcas := array(select m[1] from regexp_matches(v_plantilla, '\{\{seccion:([a-z][a-z0-9_]{0,59})\}\}', 'g') as m);
    v_err := v_err || coalesce((select jsonb_agg(to_jsonb(format('sección «%s»: la plantilla no la tiene (son: %s)', x, array_to_string(v_marcas, ', '))))
                                  from unnest(v_ids) x where not (x = any (v_marcas))), '[]'::jsonb);
    v_err := v_err || coalesce((select jsonb_agg(to_jsonb(format('falta la sección obligatoria «%s»', x)))
                                  from unnest(coalesce(v_oblig, '{}')) x where not (x = any (v_ids))), '[]'::jsonb);
  end if;
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  -- El cuerpo, en una sola pasada: la plantilla partida en sus marcadores, con cada sección en su lugar (un marcador
  -- sin sección queda vacío). Sin plantilla, una <section> por sección en el orden recibido.
  if v_plantilla is not null then
    v_partes := regexp_split_to_array(v_plantilla, '\{\{seccion:[a-z][a-z0-9_]{0,59}\}\}');
    v_cuerpo := v_partes[1];
    for i in 1 .. coalesce(array_length(v_marcas, 1), 0) loop
      v_cuerpo := v_cuerpo || coalesce(v_mapa ->> v_marcas[i], '') || v_partes[i + 1];
    end loop;
  else
    for i in 1 .. array_length(v_ids, 1) loop
      v_cuerpo := v_cuerpo || format('<section id="%s">', v_ids[i]) || E'\n' || (v_mapa ->> v_ids[i]) || E'\n</section>\n';
    end loop;
  end if;
  -- El cuerpo armado vuelve a pasar el mismo control que cada sección: una etiqueta partida entre dos secciones
  -- (`<sty` + `le>`) se rearma recién aquí.
  if v_cuerpo ~* '<!doctype' or v_cuerpo ~* '<[[:space:]]*/?[[:space:]]*(html|head|body|title|style)([[:space:]>/]|$)'
     or position('{{seccion:' in v_cuerpo) > 0 then
    return agentes._rechazar(v, jsonb_build_array(
      'el documento armado trae <!DOCTYPE>, <html>, <head>, <body>, <title>, <style> o un marcador: no partas etiquetas entre secciones'));
  end if;
  v_doc := coalesce(v_envoltura, E'<!DOCTYPE html>\n<html lang="es"><head><title>ARIA IA</title></head><body>')
           || E'\n' || btrim(v_cuerpo, E' \n') || E'\n</body></html>';

  v_err := agentes._reglas_del_html(v_doc);
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;
  v_version := agentes._escribir_respuesta(v, v_columna, v_doc,
    jsonb_build_object('secciones', to_jsonb(v_ids), 'con_plantilla', v_plantilla is not null));
  perform agentes._cerrar(v, jsonb_build_object('columna', v_columna, 'version', v_version, 'bytes', octet_length(v_doc),
    'con_plantilla', v_plantilla is not null, 'secciones', v_lista, 'html', v_doc), 0, 'lista');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'columna', v_columna, 'version', v_version,
    'bytes', octet_length(v_doc), 'secciones', to_jsonb(v_ids), 'con_plantilla', v_plantilla is not null);
end $$;

-- Las secciones con que se armó la columna vigente del lead de la corrida (las de la corrida que la escribió). El
-- Estratega puede leer así el research sin el HTML entero. Se anota en lo leído como secciones:<columna>@<corrida>.
create or replace function agentes.leer_secciones(p_corrida uuid, p_columna text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v       negocio.corridas_de_agente := agentes._corrida(p_corrida, false);
  v_col   text := nullif(btrim(p_columna), '');
  v_proc  jsonb;
  v_cid   uuid;
  v_sec   jsonb;
begin
  if v_col is null or not exists (select 1 from catalogo.salidas_de_los_agentes s where s.clave = v_col) then
    raise exception using errcode = '22023',
      message = format('agentes: «%s» no es una columna de negocio.respuestas_de_los_agentes (ver catalogo.salidas_de_los_agentes)', p_columna);
  end if;
  if v.contacto_id is null then
    return jsonb_build_object('ok', true, 'columna', v_col, 'secciones', null, 'motivo', 'el lead todavía no está en la base');
  end if;
  select r.procedencia -> v_col into v_proc from negocio.respuestas_de_los_agentes r
   where r.org_id = v.org_id and r.cuenta_id = v.cuenta_id and r.contacto_id = v.contacto_id;
  v_cid := nullif(v_proc ->> 'corrida_id', '')::uuid;
  if v_cid is null then
    return jsonb_build_object('ok', true, 'columna', v_col, 'secciones', null,
      'motivo', 'todavía no hay nada guardado en esa columna para este lead');
  end if;
  select c.salida -> 'secciones' into v_sec from negocio.corridas_de_agente c
   where c.org_id = v.org_id and c.cuenta_id = v.cuenta_id and c.id = v_cid and c.contacto_id = v.contacto_id;
  if v_sec is null or jsonb_typeof(v_sec) <> 'array' then
    return jsonb_build_object('ok', true, 'columna', v_col, 'secciones', null, 'corrida_id', v_cid,
      'motivo', 'esa columna no se guardó por secciones: léela con agentes.leer_respuesta');
  end if;
  if v.estado = 'abierta' then
    perform agentes._anotar_lectura(v, jsonb_build_object('secciones:' || v_col || '@' || v_cid, left(v_sec::text, 60000)));
  end if;
  return jsonb_build_object('ok', true, 'columna', v_col, 'version', (v_proc ->> 'version')::integer,
    'corrida_id', v_cid, 'guardado_el', v_proc ->> 'guardado_el', 'secciones', v_sec);
end $$;

-- ─── 5 · La ficha de cliente 2 (la del Brief, en la tabla del flujo de Walter) ───────

-- Por el correo del lead, con el Brief completo; org_id NULL (las filas del Brief nuevo) o el de la corrida. Consulta
-- dinámica y variables escalares: la tabla no existe en local, y no se toca (es de postgres, que es quien corre el
-- MCP). Las filas sin org_id (el Brief de ARIA) sólo las lee la organización principal. Devuelve {ok, valor,
-- encontrada_el, motivo}, como leer_respuesta, y se anota como ficha_de_cliente_2.
create or replace function agentes.leer_ficha_de_cliente_2(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v        negocio.corridas_de_agente := agentes._corrida(p_corrida, false);
  v_correo    text;
  v_html      text;
  v_el        timestamptz;
  v_principal boolean;
begin
  if v.contacto_id is null then
    return jsonb_build_object('ok', true, 'valor', null, 'motivo', 'el lead todavía no está en la base');
  end if;
  select nullif(lower(btrim(k.email)), '') into v_correo from negocio.contactos k
   where k.org_id = v.org_id and k.cuenta_id = v.cuenta_id and k.id = v.contacto_id;
  if v_correo is null then
    return jsonb_build_object('ok', true, 'valor', null,
      'motivo', 'el lead no tiene correo: la ficha de cliente 2 se busca por el correo con que llenó el Brief');
  end if;
  if to_regclass('public.aria_cc_icp_oferta') is null then
    return jsonb_build_object('ok', true, 'valor', null, 'motivo', 'no está la tabla de la ficha de cliente 2 (public.aria_cc_icp_oferta)');
  end if;
  begin
    -- Las filas sin org_id son del Brief de ARIA (welcome.ariaia.com): sólo las ve la organización principal. Otra
    -- organización sólo ve las suyas.
    select o.es_principal into v_principal from identidad.organizaciones o where o.id = v.org_id;
    execute $q$select a.html, coalesce(a.created_at, a.creado_el) from public.aria_cc_icp_oferta a
              where lower(btrim(a.email)) = $1 and upper(btrim(a.form_completo)) = 'SI'
                and a.html is not null and btrim(a.html) <> ''
                and (a.org_id = $2 or (a.org_id is null and $3))
              order by coalesce(a.created_at, a.creado_el) desc nulls last limit 1$q$
      into v_html, v_el using v_correo, v.org_id, coalesce(v_principal, false);
  exception when insufficient_privilege or undefined_table or undefined_column or undefined_function
                 or datatype_mismatch or invalid_text_representation then
    -- La tabla es de otro flujo (n8n) y puede cambiar: si no se puede leer, el motivo, no un error.
    return jsonb_build_object('ok', true, 'valor', null,
      'motivo', 'no se pudo leer la ficha de cliente 2 (' || sqlstate || ': ' || left(sqlerrm, 200) || ')');
  end;
  if v_html is null then
    return jsonb_build_object('ok', true, 'valor', null,
      'motivo', 'no hay una ficha de cliente 2 con el Brief completo para el correo del lead');
  end if;
  if v.estado = 'abierta' then
    perform agentes._anotar_lectura(v, jsonb_build_object('ficha_de_cliente_2', left(v_html, 60000)));
  end if;
  return jsonb_build_object('ok', true, 'valor', v_html, 'encontrada_el', v_el, 'bytes', octet_length(v_html));
end $$;

-- ─── 6 · Se borra lo viejo de Research, Estratega, Funnel Builder, Kickoff y el Brief estructurado ─

do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'agentes'
              and p.proname in ('leer_research', 'registrar_research', 'leer_estratega', 'registrar_estratega',
                                'leer_funnel_builder', 'registrar_funnel_builder', 'decidir_entregable',
                                'registrar_decisiones_de_kickoff', 'registrar_brief', 'responder_brief',
                                '_al_enviar_el_brief', '_al_aprobar', '_al_corregir', '_desactualizar', '_entregable',
                                '_entregables_vigentes', '_exigir_aprobado', '_proponer_version', '_leer_del_cliente',
                                '_tipo_de_la_corrida', '_entregable_del_lead', '_research_del_lead', '_otro_lead',
                                '_validar_datos') loop
    execute format('drop function %s', f.firma);
  end loop;
end $$;

drop view if exists negocio.entregable_vigente;
drop view if exists negocio.brief_vigente;

-- Sin cascade y con el nombre completo (negocio.citas, la agenda, se queda): si algo que queda dependiera de ellas,
-- la migración falla en vez de llevárselo.
drop table if exists negocio.piezas_de_contenido, negocio.citas_del_mercado, negocio.referentes_del_mercado,
  negocio.dolores_del_segmento, negocio.segmentos_del_mercado, negocio.decisiones_de_kickoff,
  negocio.respuestas_del_brief, negocio.versiones_de_entregable, negocio.entregables;
drop table if exists catalogo.tipos_de_entregable, catalogo.preguntas_del_brief;
drop function if exists negocio.las_citas_de_la_pieza_son_de_su_lead();
-- Sólo existían como destino de las FK de las citas y los referentes del mercado.
alter table negocio.fuentes_publicas drop constraint if exists fuentes_publicas_org_cuenta_id_contacto;
alter table negocio.fuentes_publicas drop constraint if exists fuentes_publicas_org_cuenta_id;

-- Los tipos de evento que sólo emitían las funciones borradas, si ningún evento los usa (los eventos no se borran):
-- uno por uno y atajando la FK, porque quien migra no ve negocio.eventos (RLS forzada).
do $$
declare
  k text;
begin
  foreach k in array array['brief_enviado', 'entregable_propuesto', 'entregable_aprobado', 'entregable_rechazado',
                           'entregable_corregido', 'entregable_desactualizado', 'kickoff_realizada'] loop
    begin
      delete from catalogo.tipos_de_evento where clave = k;
    exception when foreign_key_violation then
      null;
    end;
  end loop;
  begin
    delete from catalogo.vias_de_obtencion where clave = 'brief';
  exception when foreign_key_violation then
    null;
  end;
end $$;

-- ─── 7 · El expediente, sin lo que se borró ──────────────────────────────────────
create view negocio.expediente_del_lead with (security_invoker = true) as
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
      'clasificaciones', (select jsonb_agg(jsonb_build_object('cuadrante', c.cuadrante, 'origen', c.origen, 'el', c.clasificado_el)
                             order by c.clasificado_el)
                            from negocio.clasificaciones c where c.org_id = k.org_id and c.cuenta_id = k.cuenta_id and c.contacto_id = k.id)))
      as triaje,
    agentes._o(jsonb_build_object(
      'confirmados', (select jsonb_agg(jsonb_build_object('id', r.id, 'salida', r.salida, 'monto_usd', r.monto_usd, 'el', r.creado_el)
                         order by r.creado_el)
                        from negocio.resultados r where r.org_id = k.org_id and r.cuenta_id = k.cuenta_id and r.contacto_id = k.id)))
      as resultado,
    (select jsonb_agg(jsonb_build_object('fuente', 'publica:' || p.id, 'tipo', p.tipo, 'url', p.url, 'extracto', left(p.extracto, 1000),
              'observada_el', p.observada_el) order by p.observada_el)
       from negocio.fuentes_publicas p where p.org_id = k.org_id and p.cuenta_id = k.cuenta_id and p.contacto_id = k.id
         and not exists (select 1 from negocio.corridas_de_agente cx where cx.org_id = p.org_id and cx.cuenta_id = p.cuenta_id
                      and cx.id = p.corrida_id and cx.estado in ('fallida', 'reemplazada', 'cancelada')))
      as evidencia_publica,
    (select jsonb_agg(jsonb_build_object('corrida_id', c.id, 'agente', c.agente, 'estado', c.estado, 'modo', c.modo, 'motivo', c.motivo,
              'identificado_por', c.identificado_por, 'abierta_el', c.abierta_el, 'terminada_el', c.terminada_el) order by c.abierta_el)
       from negocio.corridas_de_agente c where c.org_id = k.org_id and c.cuenta_id = k.cuenta_id and c.contacto_id = k.id) as corridas,
    -- 118: qué dejó cada agente en respuestas_de_los_agentes y cuándo, sin el HTML (se lee con agentes.leer_respuesta).
    (select jsonb_strip_nulls(jsonb_build_object('triage_cuadrante_de_clasificacion', r.triage_cuadrante_de_clasificacion,
              'procedencia', r.procedencia))
       from negocio.respuestas_de_los_agentes r
      where r.org_id = k.org_id and r.cuenta_id = k.cuenta_id and r.contacto_id = k.id) as respuestas_de_los_agentes
  from negocio.contactos k;
comment on view negocio.expediente_del_lead is
  'El expediente de cada lead (115; 119 sin ficha, evaluación, objeciones ni seguimientos; 124 sin brief, research, kickoff, icp, categoría y oferta, precio ni embudo: esas salidas están en respuestas_de_los_agentes): una fila por contacto y una columna jsonb por sección, con lo vigente de cada una. Una sección vacía es null; lo largo se recorta y lo dice. Sin teléfono ni correo. Se lee siempre filtrando por contacto_id.';
revoke all on negocio.expediente_del_lead from public, app_inquilino;
grant select on negocio.expediente_del_lead to app_inquilino, agente_mcp;

-- ─── 8 · Permisos ────────────────────────────────────────────────────────────────
-- Nada para PUBLIC; el inquilino y el rol de los agentes ejecutan todo lo que queda (con las tres nuevas).
do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'agentes' loop
    execute format('revoke all on function %s from public', f.firma);
    execute format('grant execute on function %s to app_inquilino, agente_mcp', f.firma);
  end loop;
end $$;
