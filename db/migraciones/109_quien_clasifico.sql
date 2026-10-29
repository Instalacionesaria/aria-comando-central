-- 109 · Quién clasificó: la historia del cuadrante y de las respuestas dice si fue el CRM o una persona.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el relleno del cuadrante, 2026-10-29)
--
-- La 106 registra cada cambio de contactos.cuadrante en negocio.clasificaciones y cada cambio de campos_del_crm en
-- negocio.respuestas_del_lead, las dos de sólo agregar (app_inquilino no tiene update ni delete). Pero el origen iba
-- FIJO: clasificaciones.origen = 'crm' y respuestas_del_lead.obtenida_por = 'crm', «el CRM lo calculó» y «el lead lo
-- respondió», aunque el valor lo haya escrito en GoHighLevel una persona del equipo.
--
-- El relleno de los calificados viejos (scripts/clasificar-calificados-viejos.mjs, decisión del usuario del
-- 2026-10-29) escribe el campo «Cuadrante de Clasificacion» en el CRM y relee el contacto por el camino normal
-- (refrescarUnContacto). Con la 106 tal cual, unas 148 filas permanentes dirían que el CRM los clasificó ese día y que
-- el lead respondió ese campo ese día: cualquier medición de «cuándo clasifica GHL» quedaría contaminada para siempre.
--
-- QUÉ CAMBIA: los dos disparadores leen variables de la transacción, con el valor de antes por omisión:
--
--   · negocio.origen_de_clasificacion → clasificaciones.origen y el `origen` del evento cuadrante_cambiado (una clave
--     de catalogo.origenes_de_clasificacion; 'persona' existe desde la 106). Con 'persona' el evento lleva
--     actor_tipo 'persona'; con 'clasificador' o 'recalificador', 'agente_ia'; con 'crm', 'sistema' como antes.
--   · negocio.obtenida_por → respuestas_del_lead.obtenida_por (una clave de catalogo.vias_de_obtencion), y
--     negocio.obtenida_por_campo, opcional: si está, la vía vale SÓLO para ese campo (el id del CRM, origen_clave). Una
--     relectura trae todos los campos del contacto, y otro que haya cambiado en el CRM a la vez sigue siendo del CRM.
--     La foto inicial de un contacto sin historia (old.historia_desde nulo) sigue siendo 'crm': es lo que ya tenía.
--
-- Sin variables, o vacías, todo sigue como en la 106. Se ponen con set_config(…, true) DENTRO de la transacción de
-- conOrganizacion (lib/negocio/rellenoDelCuadrante.ts, comoPersona): revierten al terminarla, y la siguiente
-- transacción de la misma conexión vuelve a 'crm'. Una clave que no está en el catálogo rompe la escritura por la
-- clave foránea, en voz alta: nunca queda un origen inventado.
--
-- El catálogo: 'persona' ya estaba en origenes_de_clasificacion (106) y faltaba en vias_de_obtencion; se agrega con
-- `on conflict do nothing`.
--
-- REAPLICABLE: `create or replace function` con la misma firma (los disparadores de la 106 siguen apuntando a ellas,
-- no se tocan) e `insert … on conflict do nothing`. Sin índices nuevos, sin filas de negocio.
-- ═════════════════════════════════════════════════════════════════════════════

insert into catalogo.vias_de_obtencion (clave, nombre, descripcion) values
  ('persona', 'Persona', 'Una persona del equipo, a mano: escribió el valor en el CRM (por ejemplo, el relleno del cuadrante de los calificados viejos, 2026-10-29).')
on conflict do nothing;

-- ─── El disparador del cuadrante, con el origen de la transacción ───────────────

create or replace function negocio.registrar_cambio_de_cuadrante() returns trigger
language plpgsql as $$
declare
  v_anterior       text;
  v_clasificacion  uuid := gen_random_uuid();
  v_evento         uuid := gen_random_uuid();
  v_primera        boolean;
  -- Quién clasificó (la 109): lo dice la transacción; sin decirlo, el CRM, como en la 106.
  v_origen         text := coalesce(nullif(btrim(current_setting('negocio.origen_de_clasificacion', true)), ''), 'crm');
  v_actor          text;
begin
  v_actor := case v_origen when 'crm' then 'sistema' when 'persona' then 'persona' else 'agente_ia' end;
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
  values (new.org_id, new.cuenta_id, v_clasificacion, new.id, new.cuadrante, v_anterior, v_origen, v_primera, now(), v_evento);
  insert into negocio.eventos (org_id, cuenta_id, id, ocurrio_el, tipo, tipo_version, contacto_id, actor_tipo, fuente,
                               id_externo, datos)
  values (new.org_id, new.cuenta_id, v_evento, now(), 'cuadrante_cambiado', 1, new.id, v_actor, 'ghl',
          'cuadrante:' || v_clasificacion,
          jsonb_build_object('cuadrante', new.cuadrante, 'cuadrante_anterior', v_anterior,
                             'clasificacion_id', v_clasificacion, 'origen', v_origen, 'primera_vez', v_primera))
  on conflict do nothing;
  return null;
end $$;
comment on function negocio.registrar_cambio_de_cuadrante() is
  'Disparador de negocio.contactos: cada cambio de cuadrante (también el alta con cuadrante, y el que lo vacía) deja una fila en negocio.clasificaciones y un evento cuadrante_cambiado, en la misma transacción. El origen sale de la variable de transacción negocio.origen_de_clasificacion (109; sin ella, crm), y el actor del evento con él: persona, agente_ia o sistema.';

-- ─── El disparador de las respuestas, con la vía de la transacción ──────────────

create or replace function negocio.registrar_respuestas_del_crm() returns trigger
language plpgsql as $$
declare
  v_viejo  jsonb := '{}'::jsonb;
  v_nuevo  jsonb := '{}'::jsonb;
  -- Cómo se obtuvo (la 109): lo dice la transacción, para un campo o para todos; sin decirlo, el CRM, como en la 106.
  v_via    text := coalesce(nullif(btrim(current_setting('negocio.obtenida_por', true)), ''), 'crm');
  v_campo  text := nullif(btrim(current_setting('negocio.obtenida_por_campo', true)), '');
begin
  if jsonb_typeof(new.campos_del_crm) = 'object' then
    v_nuevo := new.campos_del_crm;
  end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.campos_del_crm) = 'object' then
    v_viejo := old.campos_del_crm;
  end if;
  -- La foto inicial de un contacto de antes de la 106: lo que ya tenía, con la hora en que se vio (siempre antes que
  -- el cambio de esta misma escritura, para que la vigente sea la más nueva). Es lo que el CRM ya tenía: 'crm'.
  if tg_op = 'UPDATE' and old.historia_desde is null then
    insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, origen_clave, valor_texto, vaciada,
                                             proveedor, obtenida_por, etapa, observada_el)
    select new.org_id, new.cuenta_id, new.id, left(o.key, 200), left(nullif(btrim(o.value), ''), 2000), false,
           'ghl', 'crm', old.etapa_estandar,
           least(coalesce(old.sincronizado_el, old.creado_el), now() - interval '1 millisecond')
      from jsonb_each_text(v_viejo) o
     where btrim(o.key) <> '' and nullif(btrim(o.value), '') is not null;
  end if;
  -- Un campo que pasa a vacío (o desaparece) es una fila vaciada; uno que sigue igual no deja nada. La vía de la
  -- transacción vale para el campo nombrado (o para todos si no nombra ninguno); el resto sigue siendo del CRM.
  insert into negocio.respuestas_del_lead (org_id, cuenta_id, contacto_id, origen_clave, valor_texto, vaciada,
                                           proveedor, obtenida_por, etapa, observada_el)
  select new.org_id, new.cuenta_id, new.id, left(x.campo, 200), left(x.nuevo, 2000), x.nuevo is null,
         'ghl', case when v_campo is null or x.campo = v_campo then v_via else 'crm' end, new.etapa_estandar, now()
    from (select coalesce(n.key, o.key) as campo,
                 nullif(btrim(n.value), '') as nuevo,
                 nullif(btrim(o.value), '') as viejo
            from jsonb_each_text(v_nuevo) n
            full join jsonb_each_text(v_viejo) o on o.key = n.key) x
   where btrim(x.campo) <> '' and x.nuevo is distinct from x.viejo;
  return null;
end $$;
comment on function negocio.registrar_respuestas_del_crm() is
  'Disparador de negocio.contactos: por cada campo de campos_del_crm cuyo valor cambió (o se vació), una fila en negocio.respuestas_del_lead, sin pregunta (la resuelve al leer negocio.respuestas_del_lead_traducidas). En la primera escritura de un contacto de antes de la 106, antes guarda los que ya tenía (obtenida_por crm). La vía del cambio sale de la variable de transacción negocio.obtenida_por (109; sin ella, crm), sólo para el campo de negocio.obtenida_por_campo si está puesta.';
