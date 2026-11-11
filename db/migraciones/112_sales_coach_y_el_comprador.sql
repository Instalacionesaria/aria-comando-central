-- 112 · El Sales Coach (el resultado propuesto, la evaluación, las objeciones con su texto y el seguimiento) y el paso
-- de lead a cliente: la venta confirmada, el pago y el alta del comprador en su propio nivel.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (docs/_privado/modelo-de-datos/27-MANAGED-AGENTS.md § Sales Coach y § El comprador)
--
-- LO PROPUESTO NO ES UNA VENTA. negocio.resultados alimenta comisiones, el dinero del mes y las métricas de cierre. Un
-- resultado que propuso el agente y nadie confirmó no puede contar: va a negocio.resultados_propuestos, y sólo cuando
-- el closer confirma (o corrige) se escribe la fila de negocio.resultados, con referencia a la propuesta y las
-- diferencias. Así lo que ya existe sigue correcto sin tocarlo, y se mide qué tan seguido acierta el agente.
--
-- LAS OBJECIONES, CON SU TEXTO. negocio.objeciones_clasificadas (del analizador de tl;dv) guarda la categoría y una
-- huella, colgada de negocio.analizador_llamadas. Las del Sales Coach van a negocio.objeciones_de_llamada, colgadas de
-- la familia de llamadas (la 111), con la frase del lead, si se superó y cómo respondió el closer: es lo que el cerebro
-- necesita para «¿qué objeción perdió más ventas?» y lo que mejora el manual de objeciones.
--
-- EL COMPRADOR VIVE EN SU PROPIO NIVEL (decisión del usuario del 2026-11-10). Quien le compra a ARIA (la organización
-- principal) pasa a ser una ORGANIZACIÓN de nivel 2, con su cuenta por omisión; quien le compra a una agencia (nivel 2)
-- pasa a ser una CUENTA de nivel 3 dentro de esa agencia. Se crea al confirmarse el pago. En la cuenta del vendedor
-- queda sólo negocio.clientes: el registro de la venta, que une al lead con su cuenta nueva. El Brief, el Research, la
-- estrategia y el embudo (la 113 y la 114) se escriben en la cuenta del comprador, y su Triage usará su propio ICP.
--
-- Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · El resultado propuesto ──────────────────────────────────────────────────

-- negocio.resultados no tenía la terna única que piden las claves foráneas «misma cuenta».
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'negocio.resultados'::regclass and conname = 'resultados_org_cuenta_id') then
    alter table negocio.resultados add constraint resultados_org_cuenta_id unique (org_id, cuenta_id, id);
  end if;
end $$;

create table if not exists negocio.resultados_propuestos (
  org_id            uuid not null references identidad.organizaciones (id),
  cuenta_id         uuid not null,
  id                uuid not null default gen_random_uuid(),
  contacto_id       uuid not null,
  cita_id           uuid,
  llamada_id        uuid,
  corrida_id        uuid not null,
  closer_id         uuid,
  compro            boolean not null,
  salida            text not null check (salida in ('venta', 'acuerdo_sin_pago', 'seguimiento', 'no_interesa', 'no_show',
                                                    'nurture', 'agendo', 'venta_chica', 'no_califica')),
  salida_estandar   catalogo.clave references catalogo.salidas (clave),
  ruta              text,
  ruta_clase        catalogo.clave references catalogo.clases_de_ruta (clave),
  monto             numeric(12,2) check (monto >= 0),
  moneda            char(3) references catalogo.monedas (codigo),
  monto_usd         numeric(14,2) check (monto_usd >= 0),
  forma_pago        text check (forma_pago is null or length(forma_pago) <= 100),
  motivo            catalogo.clave references catalogo.motivos (clave),
  objeciones        jsonb not null default '[]'::jsonb,
  next_steps        jsonb not null default '[]'::jsonb,
  evidencia         jsonb not null default '[]'::jsonb,
  datos_del_negocio jsonb not null default '[]'::jsonb,
  confianza         text not null check (confianza in ('alta', 'media', 'baja')),
  estado            text not null default 'propuesto' check (estado in ('propuesto', 'confirmado', 'corregido', 'rechazado')),
  resultado_id      uuid,
  decidido_por      uuid,
  decidido_el       timestamptz,
  motivo_decision   text check (motivo_decision is null or length(motivo_decision) <= 2000),
  diferencias       jsonb,
  creado_el         timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, cuenta_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  foreign key (org_id, closer_id) references identidad.usuarios (org_id, id),
  foreign key (org_id, decidido_por) references identidad.usuarios (org_id, id),
  constraint propuestos_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint propuestos_misma_cuenta_que_la_cita
    foreign key (org_id, cuenta_id, cita_id) references negocio.citas (org_id, cuenta_id, id) on delete set null (cita_id),
  constraint propuestos_misma_cuenta_que_la_llamada
    foreign key (org_id, cuenta_id, llamada_id) references negocio.llamadas (org_id, cuenta_id, id) on delete set null (llamada_id),
  constraint propuestos_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete cascade,
  constraint propuestos_misma_cuenta_que_el_resultado
    foreign key (org_id, cuenta_id, resultado_id) references negocio.resultados (org_id, cuenta_id, id) on delete set null (resultado_id),
  constraint propuestos_ruta_de_la_cuenta
    foreign key (org_id, cuenta_id, ruta) references negocio.rutas_de_la_cuenta (org_id, cuenta_id, clave),
  check ((estado = 'propuesto') = (decidido_el is null)),
  check (jsonb_typeof(next_steps) = 'array' and jsonb_typeof(evidencia) = 'array' and jsonb_typeof(datos_del_negocio) = 'array')
);
create index if not exists propuestos_por_contacto on negocio.resultados_propuestos (org_id, cuenta_id, contacto_id, creado_el desc);
create index if not exists propuestos_pendientes on negocio.resultados_propuestos (org_id, cuenta_id, creado_el) where estado = 'propuesto';
comment on table negocio.resultados_propuestos is
  'El resultado de una llamada de venta que PROPONE el Sales Coach (112). No cuenta como venta ni comisión: el closer lo confirma o lo corrige y recién ahí se escribe negocio.resultados (resultado_id).';
comment on column negocio.resultados_propuestos.next_steps is '[{accion, responsable: lead|closer|sistema, fecha, cita}] — lo que tiene que pasar después de la llamada.';
comment on column negocio.resultados_propuestos.evidencia is 'Los datos con procedencia que sostienen el resultado (citas de la transcripción con su marca de tiempo), ya cotejados.';
comment on column negocio.resultados_propuestos.datos_del_negocio is 'Lo que el lead contó de su negocio en la llamada, con procedencia. Al confirmar, los que son preguntas estándar van a respuestas_del_lead; el Brief los lee.';
comment on column negocio.resultados_propuestos.diferencias is 'Qué campos cambió el closer al corregir ({campo: {propuesto, confirmado}}): con esto se mejora la skill.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.resultados_propuestos', true);
revoke update, delete, truncate on negocio.resultados_propuestos from app_inquilino;
grant update (estado, resultado_id, decidido_por, decidido_el, motivo_decision, diferencias) on negocio.resultados_propuestos to app_inquilino;
grant select, insert on negocio.resultados_propuestos to agente_mcp;
grant update (estado, resultado_id, decidido_por, decidido_el, motivo_decision, diferencias) on negocio.resultados_propuestos to agente_mcp;
grant insert on negocio.resultados to agente_mcp;
grant insert on negocio.respuestas_del_lead to agente_mcp;

-- ─── 2 · La evaluación de la llamada ─────────────────────────────────────────────

create table if not exists negocio.evaluaciones_de_llamada (
  org_id             uuid not null references identidad.organizaciones (id),
  cuenta_id          uuid not null,
  id                 uuid not null default gen_random_uuid(),
  llamada_id         uuid not null,
  contacto_id        uuid not null,
  closer_id          uuid,
  corrida_id         uuid not null,
  version_script     integer,
  puntaje            numeric(4,2) not null check (puntaje between 0 and 10),
  fases              jsonb not null default '[]'::jsonb,
  lo_que_hizo_bien   jsonb not null default '[]'::jsonb,
  donde_se_perdio    jsonb,
  siguio_el_script   numeric(5,2) check (siguio_el_script between 0 and 100),
  vista_por_el_closer_el timestamptz,
  creada_el          timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  foreign key (org_id, closer_id) references identidad.usuarios (org_id, id),
  constraint evaluaciones_misma_cuenta_que_la_llamada
    foreign key (org_id, cuenta_id, llamada_id) references negocio.llamadas (org_id, cuenta_id, id) on delete cascade,
  constraint evaluaciones_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint evaluaciones_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete cascade,
  check (jsonb_typeof(fases) = 'array' and jsonb_typeof(lo_que_hizo_bien) = 'array')
);
create index if not exists evaluaciones_por_closer on negocio.evaluaciones_de_llamada (org_id, cuenta_id, closer_id, creada_el desc);
comment on table negocio.evaluaciones_de_llamada is
  'El feedback del Sales Coach al closer (112): puntaje de 0 a 10, cada fase del script (cumplida sí/parcial/no, con la cita y la marca de tiempo), lo que hizo bien y dónde se perdió la venta.';
comment on column negocio.evaluaciones_de_llamada.fases is '[{fase, cumplida: si|parcial|no, evidencia: [{cita, marca_de_tiempo}], comentario}].';
comment on column negocio.evaluaciones_de_llamada.donde_se_perdio is '{momento, marca_de_tiempo, cita, por_que, que_hacer_distinto}. Nulo si compró.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.evaluaciones_de_llamada', true);
revoke delete, truncate on negocio.evaluaciones_de_llamada from app_inquilino;
grant select, insert on negocio.evaluaciones_de_llamada to agente_mcp;

-- ─── 3 · Las objeciones, con su texto ────────────────────────────────────────────

create table if not exists negocio.objeciones_de_llamada (
  org_id                uuid not null references identidad.organizaciones (id),
  cuenta_id             uuid not null,
  id                    uuid not null default gen_random_uuid(),
  llamada_id            uuid not null,
  contacto_id           uuid not null,
  corrida_id            uuid not null,
  categoria             text not null check (categoria in ('precio', 'momento', 'decisor', 'confianza', 'encaje', 'otra')),
  texto                 text not null check (length(texto) between 1 and 1000),
  marca_de_tiempo_seg   numeric(10,2) check (marca_de_tiempo_seg >= 0),
  respuesta_del_closer  text check (respuesta_del_closer is null or length(respuesta_del_closer) <= 2000),
  resuelta              boolean,
  cita_verificada       boolean not null default false,
  creada_el             timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint objeciones_misma_cuenta_que_la_llamada
    foreign key (org_id, cuenta_id, llamada_id) references negocio.llamadas (org_id, cuenta_id, id) on delete cascade,
  constraint objeciones_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint objeciones_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete cascade
);
create index if not exists objeciones_de_llamada_por_categoria on negocio.objeciones_de_llamada (org_id, cuenta_id, categoria, creada_el desc);
comment on table negocio.objeciones_de_llamada is
  'Cada objeción de una llamada de venta que registró el Sales Coach (112), con la frase del lead, cómo respondió el closer y si se superó. Lo que el cerebro lee para «¿qué objeción perdió más ventas?». Las del analizador de tl;dv siguen en objeciones_clasificadas.';
comment on column negocio.objeciones_de_llamada.texto is 'La objeción en palabras del lead, recortada. Dato personal.';
comment on column negocio.objeciones_de_llamada.cita_verificada is 'true = el texto aparece tal cual en la transcripción de la llamada.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.objeciones_de_llamada', true);
revoke update, delete, truncate on negocio.objeciones_de_llamada from app_inquilino;
grant select, insert on negocio.objeciones_de_llamada to agente_mcp;

-- ─── 4 · El borrador del seguimiento ─────────────────────────────────────────────

create table if not exists negocio.borradores_de_mensaje (
  org_id          uuid not null references identidad.organizaciones (id),
  cuenta_id       uuid not null,
  id              uuid not null default gen_random_uuid(),
  contacto_id     uuid not null,
  corrida_id      uuid not null,
  motivo          text not null check (motivo in ('seguimiento_post_llamada', 'nutricion', 'no_show', 'bienvenida', 'otro')),
  canal           catalogo.clave not null references catalogo.canales (clave),
  asunto          text check (asunto is null or length(asunto) <= 300),
  cuerpo          text not null check (length(cuerpo) between 1 and 8000),
  programar_para  timestamptz,
  estado          text not null default 'borrador' check (estado in ('borrador', 'aprobado', 'enviado', 'descartado')),
  aprobado_por    uuid,
  aprobado_el     timestamptz,
  enviado_el      timestamptz,
  mensaje_ghl_id  text,
  creado_el       timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  foreign key (org_id, aprobado_por) references identidad.usuarios (org_id, id),
  constraint borradores_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint borradores_misma_cuenta_que_la_corrida
    foreign key (org_id, cuenta_id, corrida_id) references negocio.corridas_de_agente (org_id, cuenta_id, id) on delete cascade
);
comment on table negocio.borradores_de_mensaje is
  'El mensaje que un agente redactó para el lead (112): el seguimiento después de la llamada, el de Nutrición, el del no-show. Queda como borrador hasta que alguien lo aprueba o lo envía; un lead con no_contactar_desde no recibe ninguno.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.borradores_de_mensaje', true);
revoke delete, truncate on negocio.borradores_de_mensaje from app_inquilino;
grant select, insert on negocio.borradores_de_mensaje to agente_mcp;
grant update (estado, cuerpo, aprobado_por, aprobado_el, enviado_el, mensaje_ghl_id) on negocio.borradores_de_mensaje to agente_mcp;

-- ─── 5 · La venta: el cliente, en la cuenta del vendedor ─────────────────────────

create table if not exists negocio.clientes (
  org_id                  uuid not null references identidad.organizaciones (id),
  cuenta_id               uuid not null,
  id                      uuid not null default gen_random_uuid(),
  contacto_id             uuid not null,
  resultado_id            uuid,
  resultado_propuesto_id  uuid,
  ruta                    text,
  ruta_clase              catalogo.clave references catalogo.clases_de_ruta (clave),
  nivel                   smallint check (nivel in (2, 3)),
  estado                  text not null default 'vendido'
                            check (estado in ('vendido', 'pago_confirmado', 'contrato_firmado', 'en_onboarding', 'brief_enviado',
                                              'research_aprobado', 'estrategia_aprobada', 'funnel_listo', 'instalado',
                                              'activo', 'pausado', 'baja')),
  nombre_del_negocio      text check (nombre_del_negocio is null or length(nombre_del_negocio) <= 200),
  a_quien_vende           text check (a_quien_vende in ('negocios', 'consumidores')),
  coach_id                uuid,
  success_manager_id      uuid,
  organizacion_cliente_id uuid references identidad.organizaciones (id),
  cuenta_cliente_id       uuid,
  vendido_el              timestamptz not null default now(),
  pago_confirmado_el      timestamptz,
  contrato_firmado_el     timestamptz,
  kickoff_el              timestamptz,
  instalado_el            timestamptz,
  creado_el               timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, cuenta_id, id),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  foreign key (organizacion_cliente_id, cuenta_cliente_id) references identidad.cuentas (org_id, id),
  foreign key (org_id, coach_id) references identidad.usuarios (org_id, id),
  foreign key (org_id, success_manager_id) references identidad.usuarios (org_id, id),
  constraint clientes_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint clientes_misma_cuenta_que_el_resultado
    foreign key (org_id, cuenta_id, resultado_id) references negocio.resultados (org_id, cuenta_id, id) on delete set null (resultado_id),
  constraint clientes_misma_cuenta_que_la_propuesta
    foreign key (org_id, cuenta_id, resultado_propuesto_id) references negocio.resultados_propuestos (org_id, cuenta_id, id) on delete set null (resultado_propuesto_id),
  check ((organizacion_cliente_id is null) = (cuenta_cliente_id is null)),
  check ((cuenta_cliente_id is null) = (nivel is null))
);
create index if not exists clientes_por_contacto on negocio.clientes (org_id, cuenta_id, contacto_id, creado_el desc);
create index if not exists clientes_por_su_cuenta on negocio.clientes (cuenta_cliente_id) where cuenta_cliente_id is not null;
comment on table negocio.clientes is
  'El registro de cada venta (112), en la cuenta del VENDEDOR: une al lead que compró con su propia cuenta en Comando Central, que se crea al confirmarse el pago (nivel 2 si le compró a ARIA, nivel 3 si le compró a una agencia). Sus entregables viven en esa cuenta.';
comment on column negocio.clientes.nivel is '2 = el comprador es una organización nueva (le compró a ARIA); 3 = es una cuenta nueva dentro de la agencia que le vendió.';
comment on column negocio.clientes.a_quien_vende is 'La pregunta 9 del Brief: negocios (B2B) o consumidores (B2C). Define qué sección 2 del Brief recibe.';
comment on column negocio.clientes.cuenta_cliente_id is 'La cuenta del comprador: donde el Brief, el Research, el Estratega y el Funnel Builder escriben, y donde vivirán sus leads.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.clientes', true);
revoke delete, truncate on negocio.clientes from app_inquilino;
grant select, insert on negocio.clientes to agente_mcp;
grant update (estado, a_quien_vende, nombre_del_negocio, nivel, organizacion_cliente_id, cuenta_cliente_id, coach_id,
              success_manager_id, pago_confirmado_el, contrato_firmado_el, kickoff_el, instalado_el) on negocio.clientes to agente_mcp;
-- Una cuenta de cliente es de UNA venta: dos ventas atadas a la misma cuenta mezclarían sus Briefs.
create unique index if not exists clientes_una_venta_por_cuenta on negocio.clientes (org_id, cuenta_cliente_id) where cuenta_cliente_id is not null;

-- corridas_de_agente.cliente_id NO lleva clave foránea: la corrida de un agente del comprador vive en la cuenta del
-- comprador, y su cliente en la del vendedor (otra organización). Es una referencia blanda.

-- ─── 6 · El pago ─────────────────────────────────────────────────────────────────

create table if not exists negocio.pagos (
  org_id         uuid not null references identidad.organizaciones (id),
  cuenta_id      uuid not null,
  id             uuid not null default gen_random_uuid(),
  contacto_id    uuid not null,
  cliente_id     uuid,
  proveedor      catalogo.clave not null references catalogo.proveedores (clave),
  id_externo     text not null check (length(id_externo) between 1 and 300),
  monto          numeric(12,2) not null check (monto >= 0),
  moneda         char(3) not null references catalogo.monedas (codigo),
  monto_usd      numeric(14,2) check (monto_usd >= 0),
  concepto       text check (concepto is null or length(concepto) <= 300),
  cuota_numero   smallint check (cuota_numero >= 1),
  cuotas_total   smallint check (cuotas_total >= 1),
  estado         text not null check (estado in ('pendiente', 'pagado', 'fallido', 'reembolsado')),
  pagado_el      timestamptz,
  registrado_el  timestamptz not null default now(),
  primary key (org_id, id),
  unique (org_id, cuenta_id, proveedor, id_externo),
  foreign key (org_id, cuenta_id) references identidad.cuentas (org_id, id),
  constraint pagos_misma_cuenta_que_el_contacto
    foreign key (org_id, cuenta_id, contacto_id) references negocio.contactos (org_id, cuenta_id, id) on delete cascade,
  constraint pagos_misma_cuenta_que_el_cliente
    foreign key (org_id, cuenta_id, cliente_id) references negocio.clientes (org_id, cuenta_id, id) on delete set null (cliente_id),
  check (cuota_numero is null or cuotas_total is null or cuota_numero <= cuotas_total)
);
create index if not exists pagos_por_cliente on negocio.pagos (org_id, cuenta_id, cliente_id) where cliente_id is not null;
comment on table negocio.pagos is
  'Cada pago de un lead que compró (112): el proveedor (GHL Payments, Stripe, la pasarela), el monto, la cuota y su estado. Idempotente por (proveedor, id externo). El primer pago confirmado crea la cuenta del comprador.';
select negocio.aplicar_aislamiento_de_cuenta('negocio.pagos', true);
revoke delete, truncate on negocio.pagos from app_inquilino;
grant select, insert on negocio.pagos to agente_mcp;
grant update (estado, pagado_el, cliente_id, monto_usd) on negocio.pagos to agente_mcp;

grant insert on identidad.organizaciones, identidad.cuentas to agente_mcp;

-- El diccionario de inputs del flujo (la 106) tenía el pago como «pendiente»: ahora tiene su tabla.
update catalogo.inputs_del_flujo set donde_vive = 'columna:negocio.pagos.monto_usd'
 where clave = 'pago' and donde_vive = 'pendiente:negocio.pagos.monto_usd';
grant update (crm_cuenta_id) on identidad.cuentas to agente_mcp;

-- ─── 7 · Sales Coach: leer ───────────────────────────────────────────────────────

create or replace function agentes.leer_sales_coach(p_corrida uuid) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v         negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_k       jsonb := agentes._conocimiento(v, array['script_de_ventas', 'manual_de_objeciones', 'rutas', 'icp']);
  v_fuentes jsonb := '{}'::jsonb;
  v_falta   jsonb := v_k -> 'faltantes';
  v_llamada record;
  v_trans   record;
  v_ficha   negocio.fichas_del_lead;
  v_triaje  jsonb;
  v_rutas   jsonb;
  v_closer  jsonb;
begin
  if v.llamada_id is null then
    return agentes._rechazar(v, jsonb_build_array('el Sales Coach se abre con la llamada: p_sujeto = {"llamada_id": "…"} (agentes.registrar_llamada la devuelve)'));
  end if;
  select l.* into v_llamada from negocio.llamadas l where l.org_id = v.org_id and l.cuenta_id = v.cuenta_id and l.id = v.llamada_id;
  select t.* into v_trans from negocio.transcripciones t
   where t.org_id = v.org_id and t.cuenta_id = v.cuenta_id and t.llamada_id = v.llamada_id order by t.creada_el desc limit 1;
  if v_trans.id is not null then
    v_fuentes := v_fuentes || jsonb_build_object('llamada_venta:' || v.llamada_id, v_trans.texto);
  else
    v_falta := v_falta || to_jsonb('transcripcion'::text);
  end if;
  select f.* into v_ficha from negocio.ficha_vigente f
   where f.org_id = v.org_id and f.cuenta_id = v.cuenta_id and f.contacto_id = v.contacto_id;
  if v_ficha.id is not null then
    v_fuentes := v_fuentes || jsonb_build_object(format('ficha:%s@v%s', v_ficha.id, v_ficha.version),
      jsonb_build_object('resumen', v_ficha.resumen, 'quien_es', v_ficha.quien_es, 'que_dijo', v_ficha.que_dijo,
                         'estrategia', v_ficha.estrategia, 'alertas', v_ficha.alertas));
  else
    v_falta := v_falta || to_jsonb('ficha_del_lead'::text);
  end if;
  select to_jsonb(t) - 'org_id' - 'cuenta_id' into v_triaje from negocio.triaje_vigente t
   where t.org_id = v.org_id and t.cuenta_id = v.cuenta_id and t.contacto_id = v.contacto_id;
  if v_triaje is not null then
    v_fuentes := v_fuentes || jsonb_build_object('triage:' || (v_triaje ->> 'corrida_id'), v_triaje);
  end if;
  v_fuentes := v_fuentes || agentes._respuestas(v.org_id, v.cuenta_id, v.contacto_id);
  select coalesce(jsonb_agg(jsonb_build_object('clave', r.clave, 'nombre', r.nombre, 'clase', r.clase, 'precio_desde', r.precio_desde,
           'precio_hasta', r.precio_hasta, 'moneda', r.moneda)), '[]'::jsonb)
    into v_rutas from negocio.rutas_de_la_cuenta r where r.org_id = v.org_id and r.cuenta_id = v.cuenta_id and r.activa;
  if v_llamada.persona_id is not null then
    select jsonb_build_object('closer_id', u.id, 'nombre', u.nombre) into v_closer from identidad.usuarios u
     where u.org_id = v.org_id and u.id = v_llamada.persona_id;
  end if;
  perform agentes._anotar_lectura(v, v_fuentes || (v_k -> 'fuentes'), v_k -> 'versiones');
  return jsonb_build_object('corrida_id', v.id, 'agente', 'sales_coach',
    'llamada', jsonb_build_object('llamada_id', v_llamada.id, 'tipo', v_llamada.tipo, 'inicio_el', v_llamada.inicio_el,
      'duracion_segundos', v_llamada.duracion_segundos, 'cita_id', v_llamada.cita_id, 'segmentos', coalesce(v_trans.segmentos, '[]'::jsonb)),
    'closer', v_closer, 'rutas', v_rutas, 'no_contactar', exists (select 1 from negocio.contactos k where k.org_id = v.org_id
      and k.cuenta_id = v.cuenta_id and k.id = v.contacto_id and k.no_contactar_desde is not null),
    'fuentes', v_fuentes, 'conocimiento', v_k -> 'conocimiento', 'faltantes', v_falta,
    'contrato', 'agentes.registrar_sales_coach(corrida_id, {resultado{compro, salida, monto, moneda, forma_pago, motivo, ruta|ruta_clase, next_steps[], evidencia[], confianza}, evaluacion{puntaje 0-10, fases[], lo_que_hizo_bien[], donde_se_perdio, siguio_el_script}, objeciones[{categoria, texto, marca_de_tiempo_seg, respuesta_del_closer, resuelta}], seguimiento{canal, asunto, cuerpo, programar_para, motivo}, datos_del_negocio[]})');
end $$;

-- ─── 8 · Sales Coach: registrar ──────────────────────────────────────────────────

create or replace function agentes.registrar_sales_coach(p_corrida uuid, p_salida jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v          negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_err      jsonb := '[]'::jsonb;
  v_res      jsonb := coalesce(p_salida -> 'resultado', '{}'::jsonb);
  v_eval     jsonb := p_salida -> 'evaluacion';
  v_objs     jsonb := coalesce(p_salida -> 'objeciones', '[]'::jsonb);
  v_seg      jsonb := p_salida -> 'seguimiento';
  v_evid     jsonb;
  v_negocio  jsonb;
  v_ruta     text := nullif(btrim(v_res ->> 'ruta'), '');
  v_clase    text := nullif(btrim(v_res ->> 'ruta_clase'), '');
  v_transc   text;
  v_llamada  negocio.llamadas;
  v_no_contactar boolean;
  v_prop_id  uuid := gen_random_uuid();
  v_eval_id  uuid;
  v_borr_id  uuid;
  v_o        jsonb;
  v_o_id     uuid;
  v_n_obj    integer := 0;
  v_deg      integer;
  v_puntaje  numeric;
begin
  if p_salida is null or jsonb_typeof(p_salida) <> 'object' then
    return agentes._rechazar(v, jsonb_build_array('la salida tiene que ser un objeto JSON'));
  end if;
  if v.llamada_id is null or v.contacto_id is null then
    return agentes._rechazar(v, jsonb_build_array('la corrida no tiene llamada o lead'));
  end if;
  select * into v_llamada from negocio.llamadas where org_id = v.org_id and cuenta_id = v.cuenta_id and id = v.llamada_id;
  v_transc := agentes._texto_de_la_fuente(v, 'llamada_venta:' || v.llamada_id);
  select no_contactar_desde is not null into v_no_contactar from negocio.contactos
   where org_id = v.org_id and cuenta_id = v.cuenta_id and id = v.contacto_id;

  -- El resultado.
  if coalesce(jsonb_typeof(v_res -> 'compro'), '') <> 'boolean' then
    v_err := v_err || to_jsonb('resultado.compro: true o false'::text);
  end if;
  if coalesce(v_res ->> 'salida', '') not in ('venta', 'acuerdo_sin_pago', 'seguimiento', 'no_interesa', 'no_show', 'nurture', 'agendo', 'venta_chica', 'no_califica') then
    v_err := v_err || to_jsonb('resultado.salida: venta, acuerdo_sin_pago, seguimiento, no_interesa, no_show, nurture, venta_chica o no_califica'::text);
  end if;
  if agentes._numero_malo(v_res -> 'monto', 0, 9999999999) or agentes._numero_malo(v_res -> 'monto_usd', 0, 99999999999) then
    v_err := v_err || to_jsonb('resultado.monto y monto_usd: números, cero o más'::text);
  end if;
  if (v_res -> 'compro') = 'true'::jsonb and coalesce(v_res ->> 'salida', '') not in ('venta', 'venta_chica', 'acuerdo_sin_pago') then
    v_err := v_err || to_jsonb('resultado: si compró, la salida es venta, venta_chica o acuerdo_sin_pago'::text);
  end if;
  if v_res ? 'motivo' and not exists (select 1 from catalogo.motivos where clave = v_res ->> 'motivo') then
    v_err := v_err || to_jsonb(format('resultado.motivo: «%s» no está en catalogo.motivos', v_res ->> 'motivo'));
  end if;
  if v_res ? 'moneda' and not exists (select 1 from catalogo.monedas where codigo = v_res ->> 'moneda') then
    v_err := v_err || to_jsonb('resultado.moneda: un código ISO de 3 letras'::text);
  end if;
  if v_ruta is not null then
    select r.clase into v_clase from negocio.rutas_de_la_cuenta r where r.org_id = v.org_id and r.cuenta_id = v.cuenta_id and r.clave = v_ruta;
    if v_clase is null then v_err := v_err || to_jsonb(format('resultado.ruta: «%s» no es una ruta de la cuenta', v_ruta)); end if;
  elsif v_clase is not null and not exists (select 1 from catalogo.clases_de_ruta where clave = v_clase) then
    v_err := v_err || to_jsonb('resultado.ruta_clase: alto_ticket, bajo_ticket o nutricion'::text);
  end if;
  if length(coalesce(v_res ->> 'forma_pago', '')) > 100 then
    v_err := v_err || to_jsonb('resultado.forma_pago: hasta 100 caracteres'::text);
  end if;
  if jsonb_typeof(coalesce(v_res -> 'evidencia', '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_salida -> 'datos_del_negocio', '[]'::jsonb)) <> 'array'
     or (v_eval is not null and jsonb_typeof(coalesce(v_eval -> 'lo_que_hizo_bien', '[]'::jsonb)) <> 'array') then
    v_err := v_err || to_jsonb('evidencia, datos_del_negocio y lo_que_hizo_bien son listas'::text);
  end if;
  if coalesce(v_res ->> 'confianza', 'media') not in ('alta', 'media', 'baja') then
    v_err := v_err || to_jsonb('resultado.confianza: alta, media o baja'::text);
  end if;
  if jsonb_typeof(coalesce(v_res -> 'next_steps', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(v_res -> 'next_steps', '[]'::jsonb)) = 0 then
    v_err := v_err || to_jsonb('resultado.next_steps: al menos un paso siguiente (el objetivo del agente)'::text);
  end if;
  v_evid := agentes._validar_datos(v, coalesce(v_res -> 'evidencia', '[]'::jsonb), 'resultado.evidencia');
  v_negocio := agentes._validar_datos(v, coalesce(p_salida -> 'datos_del_negocio', '[]'::jsonb), 'datos_del_negocio');
  v_err := v_err || (v_evid -> 'errores') || (v_negocio -> 'errores');

  -- La evaluación.
  if v_eval is not null then
    begin
      v_puntaje := (v_eval ->> 'puntaje')::numeric;
    exception when others then v_puntaje := null;
    end;
    if v_puntaje is null or v_puntaje not between 0 and 10 then
      v_err := v_err || to_jsonb('evaluacion.puntaje: de 0 a 10'::text);
    end if;
    if agentes._numero_malo(v_eval -> 'siguio_el_script', 0, 100) then
      v_err := v_err || to_jsonb('evaluacion.siguio_el_script: de 0 a 100'::text);
    end if;
    if jsonb_typeof(coalesce(v_eval -> 'fases', '[]'::jsonb)) <> 'array' then
      v_err := v_err || to_jsonb('evaluacion.fases: una lista'::text);
    end if;
  end if;

  -- Las objeciones.
  if jsonb_typeof(v_objs) <> 'array' then
    v_err := v_err || to_jsonb('objeciones: una lista'::text);
    v_objs := '[]'::jsonb;
  end if;
  for v_o in select value from jsonb_array_elements(v_objs) loop
    if coalesce(v_o ->> 'categoria', '') not in ('precio', 'momento', 'decisor', 'confianza', 'encaje', 'otra') then
      v_err := v_err || to_jsonb('objeciones: categoria = precio, momento, decisor, confianza, encaje u otra'::text);
    end if;
    if agentes._numero_malo(v_o -> 'marca_de_tiempo_seg', 0, 99999999) or agentes._booleano_malo(v_o -> 'resuelta') then
      v_err := v_err || to_jsonb('objeciones: marca_de_tiempo_seg es un número (segundos) y resuelta, true o false'::text);
    end if;
    if coalesce(btrim(v_o ->> 'texto'), '') = '' then
      v_err := v_err || to_jsonb('objeciones: cada una con su texto (las palabras del lead)'::text);
    end if;
  end loop;

  -- El seguimiento.
  if v_seg is not null and jsonb_typeof(v_seg) = 'object' then
    if coalesce(btrim(v_seg ->> 'cuerpo'), '') = '' then
      v_err := v_err || to_jsonb('seguimiento.cuerpo: falta el texto'::text);
    end if;
    if v_seg ? 'programar_para' and jsonb_typeof(v_seg -> 'programar_para') <> 'null' and agentes._fecha(v_seg ->> 'programar_para') is null then
      v_err := v_err || to_jsonb('seguimiento.programar_para: una fecha ISO (2026-11-12T15:00:00-05:00)'::text);
    end if;
    if not exists (select 1 from catalogo.canales where clave = coalesce(v_seg ->> 'canal', '')) then
      v_err := v_err || to_jsonb('seguimiento.canal: whatsapp, email, sms, instagram_dm…'::text);
    end if;
  end if;

  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  insert into negocio.resultados_propuestos (org_id, cuenta_id, id, contacto_id, cita_id, llamada_id, corrida_id, closer_id,
    compro, salida, ruta, ruta_clase, monto, moneda, monto_usd, forma_pago, motivo, objeciones, next_steps, evidencia,
    datos_del_negocio, confianza)
  values (v.org_id, v.cuenta_id, v_prop_id, v.contacto_id, coalesce(v.cita_id, v_llamada.cita_id), v.llamada_id, v.id,
    v_llamada.persona_id, (v_res -> 'compro') = 'true'::jsonb, v_res ->> 'salida', v_ruta, v_clase,
    agentes._numero(v_res ->> 'monto'), v_res ->> 'moneda', agentes._numero(v_res ->> 'monto_usd'), v_res ->> 'forma_pago', v_res ->> 'motivo',
    coalesce((select jsonb_agg(jsonb_build_object('categoria', o ->> 'categoria', 'texto', left(o ->> 'texto', 300),
              'resuelta', o -> 'resuelta')) from jsonb_array_elements(v_objs) o), '[]'::jsonb),
    v_res -> 'next_steps', v_evid -> 'datos', v_negocio -> 'datos', coalesce(v_res ->> 'confianza', 'media'));
  perform agentes._evento(v, 'resultado_propuesto', jsonb_build_object('resultado_propuesto_id', v_prop_id, 'compro', (v_res -> 'compro') = 'true'::jsonb));

  if v_eval is not null then
    v_eval_id := gen_random_uuid();
    insert into negocio.evaluaciones_de_llamada (org_id, cuenta_id, id, llamada_id, contacto_id, closer_id, corrida_id,
      version_script, puntaje, fases, lo_que_hizo_bien, donde_se_perdio, siguio_el_script)
    values (v.org_id, v.cuenta_id, v_eval_id, v.llamada_id, v.contacto_id, v_llamada.persona_id, v.id,
      (v.conocimiento ->> 'script_de_ventas')::integer, v_puntaje, coalesce(v_eval -> 'fases', '[]'::jsonb),
      coalesce(v_eval -> 'lo_que_hizo_bien', '[]'::jsonb), v_eval -> 'donde_se_perdio', agentes._numero(v_eval ->> 'siguio_el_script'));
    perform agentes._evento(v, 'llamada_evaluada', jsonb_build_object('evaluacion_id', v_eval_id, 'puntaje', v_puntaje));
  end if;

  for v_o in select value from jsonb_array_elements(v_objs) loop
    v_o_id := gen_random_uuid();
    v_n_obj := v_n_obj + 1;
    insert into negocio.objeciones_de_llamada (org_id, cuenta_id, id, llamada_id, contacto_id, corrida_id, categoria, texto,
      marca_de_tiempo_seg, respuesta_del_closer, resuelta, cita_verificada)
    values (v.org_id, v.cuenta_id, v_o_id, v.llamada_id, v.contacto_id, v.id, v_o ->> 'categoria', left(v_o ->> 'texto', 1000),
      agentes._numero(v_o ->> 'marca_de_tiempo_seg'), left(v_o ->> 'respuesta_del_closer', 2000), agentes._booleano(v_o -> 'resuelta'),
      v_transc is not null and position(agentes._normal(v_o ->> 'texto') in agentes._normal(v_transc)) > 0);
    perform agentes._evento(v, 'objecion_registrada', jsonb_build_object('objecion_id', v_o_id, 'categoria', v_o ->> 'categoria',
      'resuelta', v_o -> 'resuelta'), null, v_n_obj::text);
  end loop;

  if v_seg is not null and jsonb_typeof(v_seg) = 'object' and not v_no_contactar then
    v_borr_id := gen_random_uuid();
    insert into negocio.borradores_de_mensaje (org_id, cuenta_id, id, contacto_id, corrida_id, motivo, canal, asunto, cuerpo, programar_para)
    values (v.org_id, v.cuenta_id, v_borr_id, v.contacto_id, v.id,
      coalesce(nullif(v_seg ->> 'motivo', ''), case when (v_res ->> 'salida') in ('nurture', 'no_interesa') then 'nutricion'
                                                   when (v_res ->> 'salida') = 'no_show' then 'no_show' else 'seguimiento_post_llamada' end),
      v_seg ->> 'canal', left(v_seg ->> 'asunto', 300), left(v_seg ->> 'cuerpo', 8000), agentes._fecha(v_seg ->> 'programar_para'));
    perform agentes._evento(v, 'seguimiento_redactado', jsonb_build_object('borrador_id', v_borr_id, 'motivo', 'seguimiento'));
  end if;

  v_deg := (v_evid ->> 'degradados')::integer + (v_negocio ->> 'degradados')::integer;
  perform agentes._cerrar(v, p_salida, v_deg, 'esperando_aprobacion');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'resultado_propuesto_id', v_prop_id, 'evaluacion_id', v_eval_id,
    'objeciones', v_n_obj, 'borrador_id', v_borr_id, 'seguimiento_omitido_por_no_contactar', v_seg is not null and v_no_contactar,
    'degradados', v_deg, 'siguiente', 'el closer confirma con agentes.confirmar_resultado(resultado_propuesto_id, ''confirmado'' | ''corregido'' | ''rechazado'', closer_id, correcciones)');
end $$;

-- ─── 9 · El closer confirma: la venta de verdad y el cliente ─────────────────────
-- p_correcciones: los campos que el closer cambia ({salida, monto, moneda, monto_usd, forma_pago, motivo, compro, ruta,
-- nombre_del_negocio}). Con 'corregido', se guardan las diferencias.
create or replace function agentes.confirmar_resultado(
  p_resultado_propuesto uuid, p_decision text, p_closer uuid default null, p_correcciones jsonb default '{}'::jsonb,
  p_motivo text default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  p          negocio.resultados_propuestos;
  v_sesion   text := nullif(btrim(current_setting('app.org_id', true)), '');
  c          jsonb := coalesce(p_correcciones, '{}'::jsonb);
  v_salida   text;
  v_compro   boolean;
  v_res_id   uuid;
  v_cli_id   uuid;
  v_dif      jsonb := '{}'::jsonb;
  v_campo    text;
  v_corrida  negocio.corridas_de_agente;
  v_nombre   text;
  d          jsonb;
  v_alta_error text;
begin
  select * into p from negocio.resultados_propuestos where id = p_resultado_propuesto;
  if not found then raise exception using errcode = 'P0002', message = 'agentes: el resultado propuesto no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> p.org_id then
    raise exception using errcode = '42501', message = 'agentes: el resultado es de otra organización que la de la sesión';
  end if;
  if p.estado <> 'propuesto' then
    return jsonb_build_object('ok', false, 'errores', jsonb_build_array(format('ya está «%s»', p.estado)), 'resultado_id', p.resultado_id);
  end if;
  if p_decision not in ('confirmado', 'corregido', 'rechazado') then
    raise exception using errcode = '22023', message = 'agentes: la decisión es confirmado, corregido o rechazado';
  end if;
  if p_closer is null or not exists (select 1 from identidad.usuarios u where u.org_id = p.org_id and u.id = p_closer) then
    raise exception using errcode = '22023',
      message = 'agentes: confirmar un resultado lo hace una persona: p_closer tiene que ser un usuario de la organización';
  end if;
  select * into v_corrida from negocio.corridas_de_agente where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.corrida_id;

  if p_decision = 'rechazado' then
    update negocio.resultados_propuestos set estado = 'rechazado', decidido_por = p_closer, decidido_el = now(), motivo_decision = p_motivo
     where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.id;
    update negocio.corridas_de_agente set estado = 'rechazada' where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.corrida_id;
    return jsonb_build_object('ok', true, 'estado', 'rechazado');
  end if;

  if c ? 'salida' and c ->> 'salida' not in ('venta', 'acuerdo_sin_pago', 'seguimiento', 'no_interesa', 'no_show', 'nurture', 'agendo', 'venta_chica', 'no_califica') then
    raise exception using errcode = '22023', message = 'agentes: la salida corregida no es válida';
  end if;
  if agentes._numero_malo(c -> 'monto', 0, 9999999999) or agentes._numero_malo(c -> 'monto_usd', 0, 99999999999) or agentes._booleano_malo(c -> 'compro') then
    raise exception using errcode = '22023', message = 'agentes: monto y monto_usd son números de cero o más, y compro es true o false';
  end if;
  if c ? 'motivo' and not exists (select 1 from catalogo.motivos where clave = c ->> 'motivo') then
    raise exception using errcode = '22023', message = 'agentes: el motivo corregido no está en catalogo.motivos';
  end if;
  if c ? 'moneda' and not exists (select 1 from catalogo.monedas where codigo = c ->> 'moneda') then
    raise exception using errcode = '22023', message = 'agentes: la moneda corregida no es un código ISO';
  end if;
  if c ? 'ruta' and not exists (select 1 from negocio.rutas_de_la_cuenta r where r.org_id = p.org_id and r.cuenta_id = p.cuenta_id
                                and r.clave = c ->> 'ruta') then
    raise exception using errcode = '22023', message = 'agentes: la ruta corregida no es una ruta de la cuenta (agentes.cargar_rutas)';
  end if;
  foreach v_campo in array array['salida', 'monto', 'moneda', 'monto_usd', 'forma_pago', 'motivo', 'compro', 'ruta'] loop
    if c ? v_campo and (case when v_campo in ('monto', 'monto_usd') then agentes._numero(c ->> v_campo) is distinct from agentes._numero(to_jsonb(p) ->> v_campo)
                            when v_campo = 'compro' then agentes._booleano(c -> v_campo) is distinct from p.compro
                            else (c ->> v_campo) is distinct from (to_jsonb(p) ->> v_campo) end) then
      v_dif := v_dif || jsonb_build_object(v_campo, jsonb_build_object('propuesto', to_jsonb(p) -> v_campo, 'confirmado', c -> v_campo));
    end if;
  end loop;
  v_salida := coalesce(c ->> 'salida', p.salida);
  v_compro := coalesce(agentes._booleano(c -> 'compro'), p.compro);

  v_res_id := gen_random_uuid();
  insert into negocio.resultados (org_id, cuenta_id, id, contacto_id, salida, rol, monto, forma_pago, detalle, registrado_por,
                                  cita_id, moneda, monto_usd, motivo, closer_id, clave_de_intento)
  values (p.org_id, p.cuenta_id, v_res_id, p.contacto_id, v_salida, 'closer',
          coalesce(agentes._numero(c ->> 'monto'), p.monto), coalesce(c ->> 'forma_pago', p.forma_pago),
          left('Propuesto por el Sales Coach (corrida ' || p.corrida_id || ')', 500), p_closer, p.cita_id,
          coalesce(c ->> 'moneda', p.moneda), coalesce(agentes._numero(c ->> 'monto_usd'), p.monto_usd), coalesce(c ->> 'motivo', p.motivo),
          coalesce(p_closer, p.closer_id), p.id);
  perform agentes._registrar_evento(p.org_id,
    p.cuenta_id,
    'resultado_registrado',
    p.contacto_id,
    'persona',
    coalesce(p_closer::text, 'closer'),
    'comando_central',
    'resultado:' || v_res_id,
    jsonb_build_object('resultado_id', v_res_id, 'salida', v_salida,
          'resultado_propuesto_id', p.id),
    now());

  update negocio.resultados_propuestos
     set estado = case when v_dif = '{}'::jsonb then 'confirmado' else 'corregido' end,
         decidido_por = p_closer, decidido_el = now(), motivo_decision = p_motivo,
         diferencias = nullif(v_dif, '{}'::jsonb), resultado_id = v_res_id
   where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.id;
  update negocio.corridas_de_agente set estado = 'aprobada' where org_id = p.org_id and cuenta_id = p.cuenta_id and id = p.corrida_id;

  -- Lo que el lead contó de su negocio y es una pregunta estándar, a sus respuestas (vía agente_ia).
  for d in select value from jsonb_array_elements(p.datos_del_negocio) loop
    if d ->> 'estado' = 'detectado' and nullif(btrim(d ->> 'valor'), '') is not null
       and exists (select 1 from catalogo.preguntas_estandar where clave = d ->> 'campo') then
      insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, pregunta, origen_clave, valor_texto, proveedor,
                                               obtenida_por, observada_el)
      values (p.org_id, p.cuenta_id, p.contacto_id, d ->> 'campo', left('sales_coach:' || p.corrida_id, 200),
              left(d ->> 'valor', 2000), 'ghl_managed_agents', 'agente_ia', now());
    end if;
  end loop;

  -- Si compró: el registro de la venta (el cliente). Su cuenta se crea al confirmarse el pago.
  if v_compro then
    select coalesce(nullif(btrim(c ->> 'nombre_del_negocio'), ''),
                    (select d2 ->> 'valor' from jsonb_array_elements(p.datos_del_negocio) d2 where d2 ->> 'campo' = 'nombre_del_negocio' limit 1))
      into v_nombre;
    v_cli_id := gen_random_uuid();
    insert into negocio.clientes (org_id, cuenta_id, id, contacto_id, resultado_id, resultado_propuesto_id, ruta, ruta_clase, nombre_del_negocio)
    values (p.org_id, p.cuenta_id, v_cli_id, p.contacto_id, v_res_id, p.id, coalesce(c ->> 'ruta', p.ruta),
            coalesce((select r.clase from negocio.rutas_de_la_cuenta r where r.org_id = p.org_id and r.cuenta_id = p.cuenta_id
                        and r.clave = c ->> 'ruta'), p.ruta_clase), v_nombre);
    perform agentes._registrar_evento(p.org_id,
    p.cuenta_id,
    'cliente_creado',
    p.contacto_id,
    'persona',
    coalesce(p_closer::text, 'closer'),
    'comando_central',
    'cliente:' || v_cli_id,
    jsonb_build_object('cliente_id', v_cli_id, 'ruta', coalesce(c ->> 'ruta', p.ruta, p.ruta_clase)),
    now());
    -- El pago pudo llegar antes que la confirmación: se une a esta venta y, si ya está pagado, se crea la cuenta.
    update negocio.pagos set cliente_id = v_cli_id
     where org_id = p.org_id and cuenta_id = p.cuenta_id and contacto_id = p.contacto_id and cliente_id is null;
    if exists (select 1 from negocio.pagos where org_id = p.org_id and cuenta_id = p.cuenta_id and cliente_id = v_cli_id and estado = 'pagado') then
      update negocio.clientes
         set pago_confirmado_el = (select min(pagado_el) from negocio.pagos where org_id = p.org_id and cuenta_id = p.cuenta_id
                                     and cliente_id = v_cli_id and estado = 'pagado'),
             estado = 'pago_confirmado'
       where org_id = p.org_id and cuenta_id = p.cuenta_id and id = v_cli_id;
      -- El alta puede fallar (por ejemplo, como inquilino, que no crea organizaciones): la confirmación igual queda.
      begin
        perform agentes.alta_del_comprador(v_cli_id);
      exception when others then
        v_alta_error := sqlerrm;
      end;
    end if;
    if coalesce(agentes._numero(c ->> 'monto_usd'), p.monto_usd) is not null then
      perform agentes._registrar_evento(p.org_id,
    p.cuenta_id,
    'venta_cerrada',
    p.contacto_id,
    'persona',
    coalesce(p_closer::text, 'closer'),
    'comando_central',
    'venta:' || v_res_id,
    jsonb_build_object('resultado_id', v_res_id, 'monto_usd', coalesce(agentes._numero(c ->> 'monto_usd'), p.monto_usd)),
    now());
    end if;
  end if;

  return jsonb_build_object('ok', true, 'estado', case when v_dif = '{}'::jsonb then 'confirmado' else 'corregido' end,
    'resultado_id', v_res_id, 'cliente_id', v_cli_id, 'diferencias', v_dif, 'alta_del_comprador_error', v_alta_error);
end $$;

-- El borrador del seguimiento: aprobado, enviado (con el id del mensaje en GHL) o descartado.
create or replace function agentes.decidir_borrador(p_borrador uuid, p_decision text, p_usuario uuid default null,
  p_cuerpo text default null, p_mensaje_ghl_id text default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, pg_temp
as $$
declare
  b negocio.borradores_de_mensaje;
  v_sesion text := nullif(btrim(current_setting('app.org_id', true)), '');
begin
  select * into b from negocio.borradores_de_mensaje where id = p_borrador;
  if not found then raise exception using errcode = 'P0002', message = 'agentes: el borrador no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> b.org_id then
    raise exception using errcode = '42501', message = 'agentes: el borrador es de otra organización que la de la sesión';
  end if;
  if p_decision not in ('aprobado', 'enviado', 'descartado') then
    raise exception using errcode = '22023', message = 'agentes: aprobado, enviado o descartado';
  end if;
  if b.estado in ('enviado', 'descartado')
     or (b.estado = 'aprobado' and p_decision not in ('enviado', 'descartado'))
     or (b.estado = 'borrador' and p_decision not in ('aprobado', 'descartado', 'enviado')) then
    raise exception using errcode = '55000', message = format('agentes: un borrador «%s» no pasa a «%s»', b.estado, p_decision);
  end if;
  if p_cuerpo is not null and p_decision <> 'aprobado' then
    raise exception using errcode = '22023', message = 'agentes: el texto del borrador sólo lo cambia quien lo aprueba';
  end if;
  if p_decision = 'aprobado' and (p_usuario is null or not exists (select 1 from identidad.usuarios u where u.org_id = b.org_id and u.id = p_usuario)) then
    raise exception using errcode = '22023', message = 'agentes: aprobar un borrador lo hace una persona de la organización';
  end if;
  if p_decision = 'enviado' and b.estado <> 'aprobado' and (p_usuario is null or not exists (
       select 1 from identidad.usuarios u where u.org_id = b.org_id and u.id = p_usuario)) then
    raise exception using errcode = '22023', message = 'agentes: sólo se envía un borrador aprobado (o lo envía una persona)';
  end if;
  if p_decision in ('aprobado', 'enviado') and exists (select 1 from negocio.contactos k where k.org_id = b.org_id
       and k.cuenta_id = b.cuenta_id and k.id = b.contacto_id and k.no_contactar_desde is not null) then
    return jsonb_build_object('ok', false, 'errores', jsonb_build_array('el lead pidió no ser contactado'));
  end if;
  update negocio.borradores_de_mensaje
     set estado = p_decision, cuerpo = coalesce(left(p_cuerpo, 8000), cuerpo),
         aprobado_por = case when p_decision in ('aprobado', 'enviado') then coalesce(aprobado_por, p_usuario) else aprobado_por end,
         aprobado_el = case when p_decision in ('aprobado', 'enviado') then coalesce(aprobado_el, now()) else aprobado_el end,
         enviado_el = case when p_decision = 'enviado' then now() else enviado_el end,
         mensaje_ghl_id = coalesce(p_mensaje_ghl_id, mensaje_ghl_id)
   where org_id = b.org_id and cuenta_id = b.cuenta_id and id = b.id;
  return jsonb_build_object('ok', true, 'borrador_id', b.id, 'estado', p_decision);
end $$;

-- ─── 10 · El alta del comprador ──────────────────────────────────────────────────
-- Crea la cuenta del cliente que compró, en su nivel: si el vendedor es la organización principal (ARIA), una
-- ORGANIZACIÓN nueva de nivel 2 (con su cuenta por omisión, que crea el disparador de organizaciones); si el vendedor es
-- una agencia, una CUENTA nueva de nivel 3 dentro de ella. Idempotente: si el cliente ya tiene su cuenta, la devuelve.
-- La llama agentes.registrar_pago con el primer pago confirmado; también se puede llamar a mano.
create or replace function agentes.alta_del_comprador(p_cliente uuid, p_nombre text default null,
  p_crm_cuenta_id text default null) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  k          negocio.clientes;
  v_sesion   text := nullif(btrim(current_setting('app.org_id', true)), '');
  v_principal boolean;
  v_nombre   text;
  v_base     text;
  v_slug     text;
  v_org      uuid;
  v_cuenta   uuid;
  v_nivel    smallint;
  v_zona     text;
  v_pais     char(2);
  v_moneda   char(3);
begin
  select * into k from negocio.clientes where id = p_cliente;
  if not found then raise exception using errcode = 'P0002', message = 'agentes: el cliente no existe'; end if;
  if v_sesion is not null and v_sesion::uuid <> k.org_id then
    raise exception using errcode = '42501', message = 'agentes: el cliente es de otra organización que la de la sesión';
  end if;
  if k.cuenta_cliente_id is not null then
    -- La location de GHL del cliente puede llegar después del alta: se pone si todavía no tenía.
    if p_crm_cuenta_id is not null then
      update identidad.cuentas set crm_cuenta_id = p_crm_cuenta_id
       where org_id = k.organizacion_cliente_id and id = k.cuenta_cliente_id and crm_cuenta_id is null;
    end if;
    return jsonb_build_object('ok', true, 'creada', false, 'nivel', k.nivel, 'organizacion_id', k.organizacion_cliente_id,
      'cuenta_id', k.cuenta_cliente_id);
  end if;
  -- El comprador se crea al PAGAR (decisión del usuario): sin el pago confirmado, no.
  if k.pago_confirmado_el is null then
    raise exception using errcode = '55000', message = 'agentes: la cuenta del comprador se crea con el pago confirmado (agentes.registrar_pago)';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('alta_del_comprador:' || k.id, 0));

  select o.es_principal into v_principal from identidad.organizaciones o where o.id = k.org_id;
  select c.zona_horaria, c.pais, c.moneda into v_zona, v_pais, v_moneda from identidad.cuentas c where c.id = k.cuenta_id;
  select coalesce(nullif(btrim(p_nombre), ''), k.nombre_del_negocio, nullif(btrim(ct.nombre), ''), 'Cliente')
    into v_nombre from negocio.contactos ct where ct.org_id = k.org_id and ct.cuenta_id = k.cuenta_id and ct.id = k.contacto_id;
  v_nombre := left(v_nombre, 120);
  v_base := left(btrim(regexp_replace(lower(translate(v_nombre, 'áéíóúüñàèìòùâêîôûçÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÇ', 'aeiouunaeiouaeioucAEIOUUNAEIOUAEIOUC')), '[^a-z0-9]+', '-', 'g'), '-'), 48);
  if v_base !~ '^[a-z0-9]' then v_base := 'cliente'; end if;
  v_slug := v_base || '-' || left(replace(k.id::text, '-', ''), 8);

  if v_principal then
    v_nivel := 2;
    v_org := gen_random_uuid();
    insert into identidad.organizaciones (id, nombre, slug, zona_horaria, pais)
    values (v_org, v_nombre, v_slug, coalesce(v_zona, 'UTC'), v_pais);
    select c.id into v_cuenta from identidad.cuentas c where c.org_id = v_org and c.es_por_omision;
    if p_crm_cuenta_id is not null then
      update identidad.cuentas set crm_cuenta_id = p_crm_cuenta_id where org_id = v_org and id = v_cuenta;
    end if;
  else
    v_nivel := 3;
    v_org := k.org_id;
    v_cuenta := gen_random_uuid();
    insert into identidad.cuentas (id, org_id, nombre, slug, crm_cuenta_id, zona_horaria, pais, moneda)
    values (v_cuenta, v_org, v_nombre, v_slug, p_crm_cuenta_id, coalesce(v_zona, 'UTC'), v_pais, v_moneda);
  end if;

  update negocio.clientes
     set organizacion_cliente_id = v_org, cuenta_cliente_id = v_cuenta, nivel = v_nivel,
         estado = case when estado in ('vendido', 'pago_confirmado', 'contrato_firmado') then 'en_onboarding' else estado end
   where org_id = k.org_id and cuenta_id = k.cuenta_id and id = k.id;
  return jsonb_build_object('ok', true, 'creada', true, 'nivel', v_nivel, 'organizacion_id', v_org, 'cuenta_id', v_cuenta, 'slug', v_slug);
end $$;

-- ─── 11 · El pago y el contrato ──────────────────────────────────────────────────
-- Los registra el agente de GHL (o un workflow) cuando la pasarela avisa. El primer pago confirmado de un cliente crea
-- su cuenta (agentes.alta_del_comprador): con eso, el Brief ya puede abrir su corrida.
-- La firma vieja (cuotas en smallint) no queda: un número literal es integer, y con dos firmas la llamada sería ambigua.
drop function if exists agentes.registrar_pago(text, text, text, text, numeric, text, text, timestamptz, text, smallint, smallint, numeric);
create or replace function agentes.registrar_pago(
  p_location_id text, p_ghl_contact_id text, p_proveedor text, p_id_externo text, p_monto numeric, p_moneda text,
  p_estado text default 'pagado', p_pagado_el timestamptz default null, p_concepto text default null,
  p_cuota_numero integer default null, p_cuotas_total integer default null, p_monto_usd numeric default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, catalogo, pg_temp
as $$
declare
  v_org      uuid;
  v_cuenta   uuid;
  v_contacto uuid;
  v_cliente  negocio.clientes;
  v_id       uuid;
  v_alta     jsonb;
  v_final    text;
  v_sesion   text := nullif(btrim(current_setting('app.org_id', true)), '');
begin
  select c.org_id, c.id into v_org, v_cuenta from identidad.cuentas c
   where c.crm = 'ghl' and c.crm_cuenta_id = p_location_id and c.estado = 'activa';
  if v_cuenta is null then
    raise exception using errcode = 'P0002', message = format('agentes: la location de GHL «%s» no es una cuenta activa', p_location_id);
  end if;
  if v_sesion is not null and v_sesion::uuid <> v_org then
    raise exception using errcode = '42501', message = 'agentes: la sesión es de otra organización';
  end if;
  select id into v_contacto from negocio.contactos where org_id = v_org and cuenta_id = v_cuenta and ghl_contact_id = p_ghl_contact_id;
  if v_contacto is null then
    raise exception using errcode = 'P0002', message = 'agentes: el contacto todavía no está en la base';
  end if;
  if p_estado not in ('pendiente', 'pagado', 'fallido', 'reembolsado') then
    raise exception using errcode = '22023', message = 'agentes: el estado del pago es pendiente, pagado, fallido o reembolsado';
  end if;
  select * into v_cliente from negocio.clientes where org_id = v_org and cuenta_id = v_cuenta and contacto_id = v_contacto
   order by creado_el desc limit 1;

  insert into negocio.pagos (org_id, cuenta_id, contacto_id, cliente_id, proveedor, id_externo, monto, moneda, monto_usd, concepto,
                             cuota_numero, cuotas_total, estado, pagado_el)
  values (v_org, v_cuenta, v_contacto, v_cliente.id, p_proveedor, p_id_externo, p_monto, upper(p_moneda), p_monto_usd, p_concepto,
          p_cuota_numero, p_cuotas_total, p_estado, case when p_estado = 'pagado' then coalesce(p_pagado_el, now()) end)
  on conflict (org_id, cuenta_id, proveedor, id_externo) do update
     set estado = case when negocio.pagos.estado = 'reembolsado' then 'reembolsado'
                       when negocio.pagos.estado = 'pagado' and excluded.estado in ('pendiente', 'fallido') then 'pagado'
                       else excluded.estado end,
         pagado_el = coalesce(negocio.pagos.pagado_el, excluded.pagado_el),
         cliente_id = coalesce(negocio.pagos.cliente_id, excluded.cliente_id), monto_usd = coalesce(excluded.monto_usd, negocio.pagos.monto_usd)
  returning id, estado into v_id, v_final;

  if v_final = 'pagado' then
    perform agentes._registrar_evento(v_org,
    v_cuenta,
    'pago_recibido',
    v_contacto,
    'sistema',
    'agentes.registrar_pago',
    p_proveedor,
    'pago:' || p_id_externo,
    jsonb_build_object('monto', p_monto, 'moneda', upper(p_moneda), 'pago_id', v_id,
            'cliente_id', v_cliente.id),
    coalesce(p_pagado_el, now()));
    if v_cliente.id is not null then
      update negocio.clientes set pago_confirmado_el = coalesce(pago_confirmado_el, coalesce(p_pagado_el, now())),
             estado = case when estado = 'vendido' then 'pago_confirmado' else estado end
       where org_id = v_org and cuenta_id = v_cuenta and id = v_cliente.id;
      -- Si el alta falla, el pago igual queda registrado; el error vuelve en la respuesta.
      begin
        v_alta := agentes.alta_del_comprador(v_cliente.id);
      exception when others then
        v_alta := jsonb_build_object('ok', false, 'error', sqlerrm);
      end;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'pago_id', v_id, 'estado', v_final, 'cliente_id', v_cliente.id, 'alta_del_comprador', v_alta,
    'aviso', case when v_cliente.id is null then 'el lead todavía no tiene una venta confirmada: el pago quedó sin cliente (agentes.confirmar_resultado)' end);
end $$;

create or replace function agentes.registrar_contrato(p_location_id text, p_ghl_contact_id text, p_firmado_el timestamptz default null)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, identidad, pg_temp
as $$
declare
  v_org uuid; v_cuenta uuid; v_contacto uuid; v_cliente uuid;
  v_sesion text := nullif(btrim(current_setting('app.org_id', true)), '');
begin
  select c.org_id, c.id into v_org, v_cuenta from identidad.cuentas c where c.crm = 'ghl' and c.crm_cuenta_id = p_location_id and c.estado = 'activa';
  if v_cuenta is null then raise exception using errcode = 'P0002', message = 'agentes: la location no es una cuenta activa'; end if;
  if v_sesion is not null and v_sesion::uuid <> v_org then
    raise exception using errcode = '42501', message = 'agentes: la sesión es de otra organización';
  end if;
  select id into v_contacto from negocio.contactos where org_id = v_org and cuenta_id = v_cuenta and ghl_contact_id = p_ghl_contact_id;
  select id into v_cliente from negocio.clientes where org_id = v_org and cuenta_id = v_cuenta and contacto_id = v_contacto order by creado_el desc limit 1;
  if v_cliente is null then
    return jsonb_build_object('ok', false, 'errores', jsonb_build_array('el lead no tiene una venta confirmada'));
  end if;
  update negocio.clientes set contrato_firmado_el = coalesce(contrato_firmado_el, coalesce(p_firmado_el, now())),
         estado = case when estado in ('vendido', 'pago_confirmado') then 'contrato_firmado' else estado end
   where org_id = v_org and cuenta_id = v_cuenta and id = v_cliente;
  perform agentes._registrar_evento(v_org,
    v_cuenta,
    'contrato_firmado',
    v_contacto,
    'sistema',
    'agentes.registrar_contrato',
    'ghl',
    'contrato:' || v_cliente,
    jsonb_build_object('cliente_id', v_cliente),
    coalesce(p_firmado_el, now()));
  return jsonb_build_object('ok', true, 'cliente_id', v_cliente);
end $$;

-- ─── 12 · Permisos ───────────────────────────────────────────────────────────────

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
