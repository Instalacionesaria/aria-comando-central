-- 125 · El Research se guarda en tandas: una sola corrida, varias llamadas chicas, y un solo HTML al final.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (decisión del usuario del 2026-11-24)
--
-- La reunión del 23/11 dejó al Research corriendo UNA sola vez, no en cinco pasos. Pero un research completo pesa unos
-- 40 KB de texto (medido en los de mruiz del 17 y 18/11: 6 pasos de 2 a 13 KB cada uno), y una respuesta del agente
-- en GHL se corta cerca de los 23 KB (le pasó al Sales Assistant antes de la 120). Con la 124, guardar_secciones
-- recibía todas las secciones en UNA llamada: el research no entraba.
--
-- Ahora el agente manda sus secciones en tandas a la MISMA corrida:
--
--   select agentes.guardar_secciones(corrida, '[…]', null, false);   -- una tanda: queda en la corrida, sigue abierta
--   select agentes.guardar_secciones(corrida, '[…]', null, false);   -- otra
--   select agentes.guardar_secciones(corrida, '[…]');                -- la última (p_terminar = true por omisión)
--
-- · Una tanda (p_terminar = false) valida sus secciones y las suma a las de las tandas anteriores, en la salida de la
--   corrida ({en_curso, columna, tandas, secciones}). La columna de la tabla NO se toca, y la corrida sigue abierta.
--   Una sección que vuelve a llegar reemplaza a la anterior en su lugar: así el agente corrige.
-- · La última tanda junta todo, exige las obligatorias, arma el documento entero y lo escribe en la columna, como en
--   la 124 (una celda, un HTML completo). Puede ir vacía si ya se mandó todo.
-- · Un rechazo no borra las tandas ya guardadas: el agente corrige esa tanda y la vuelve a mandar.
--
-- La plantilla provisoria del Research fija el orden y las secciones (resumen, a_quien, dolores, quien_lo_resuelve,
-- precio, segmentos, conclusiones y fuentes; «Cómo se hizo» va fijo en la plantilla, no lo escribe el agente). Así el
-- documento sale en orden aunque las tandas lleguen en otro. Cuando Jorge pase el research de Med Spas, se cambian la
-- envoltura y la plantilla (mismos marcadores, o los que él defina). El Estratega queda sin plantilla hasta que se
-- defina qué hace.
--
-- Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1 · El estilo y la plantilla provisorios del Research ───────────────────────

update catalogo.salidas_de_los_agentes
   set envoltura = $env$<!DOCTYPE html>
<html lang="es"><head>
<title>Market research · ARIA IA</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; background: #F6F8FA; color: #1A1F29; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; }
.hoja { max-width: 920px; margin: 0 auto; padding: 32px 24px 48px; background: #FFFFFF; }
.top { border-bottom: 3px solid #0B6F93; padding-bottom: 14px; margin-bottom: 8px; }
.sobre { margin: 0 0 4px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #0B6F93; font-weight: bold; }
h1 { margin: 0; font-size: 30px; line-height: 1.2; color: #04060A; }
h2 { margin: 0 0 14px; font-size: 21px; color: #04060A; border-bottom: 1px solid #DDE3EA; padding-bottom: 8px; }
h3 { margin: 18px 0 8px; font-size: 17px; color: #0B6F93; }
h4 { margin: 14px 0 6px; font-size: 15px; }
.bloque { margin: 34px 0 0; }
p { margin: 0 0 10px; }
ul, ol { margin: 0 0 12px; padding-left: 22px; }
li { margin: 0 0 6px; }
a { color: #0B6F93; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 16px; font-size: 14px; }
th { background: #EEF4F8; color: #04060A; text-align: left; font-weight: bold; }
th, td { padding: 8px 10px; border: 1px solid #DDE3EA; vertical-align: top; }
tr.ganador td { background: #EAF6EE; font-weight: bold; }
.caja { border: 1px solid #DDE3EA; border-radius: 10px; padding: 16px 18px; margin: 0 0 16px; background: #FFFFFF; }
.destacada { border: 2px solid #0B6F93; background: #F2F8FB; }
.cifras { display: flex; flex-wrap: wrap; gap: 12px; margin: 0 0 16px; }
.cifra { flex: 1 1 180px; border: 1px solid #DDE3EA; border-radius: 10px; padding: 12px 14px; }
.cifra b { display: block; font-size: 22px; color: #04060A; }
.cifra span { font-size: 13px; color: #5B6576; }
blockquote.cita { margin: 10px 0 14px; padding: 10px 14px; border-left: 4px solid #0B6F93; background: #F5F9FB; font-style: italic; }
blockquote.cita cite { display: block; margin-top: 6px; font-style: normal; font-size: 12.5px; color: #5B6576; }
.inv, .sup, .hip, .confirmado, .descartado { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11.5px; font-weight: bold; font-style: normal; vertical-align: middle; }
.inv { background: #E3F1F7; color: #0B6F93; }
.sup { background: #FFF4D6; color: #8A6A12; }
.confirmado { background: #E2F4E8; color: #1E7A3E; }
.hip { background: #FFF4D6; color: #8A6A12; }
.descartado { background: #F1F2F4; color: #6B7280; text-decoration: line-through; }
.ref { font-size: 12px; text-decoration: none; vertical-align: super; }
.nota { font-size: 13px; color: #5B6576; }
.fuentes li { font-size: 13.5px; }
.pie { margin-top: 40px; padding-top: 12px; border-top: 1px solid #DDE3EA; font-size: 12px; color: #7F8A9B; }
@media (max-width: 640px) { .hoja { padding: 20px 14px 32px; } h1 { font-size: 24px; } table { font-size: 13px; } }
</style></head><body>$env$,
       secciones_obligatorias = null
 where clave = 'research_market_research';

update catalogo.salidas_de_los_agentes
   set plantilla = $pla$<div class="hoja">
<header class="top"><p class="sobre">ARIA IA · Market research</p><h1>Market research</h1></header>
<section id="resumen" class="bloque"><h2>Resumen</h2>
{{seccion:resumen}}
</section>
<section id="metodo" class="bloque"><h2>Cómo se hizo</h2>
<p>Este research responde cinco preguntas, en orden: ¿a quién le vendo?, ¿qué le duele?, ¿quién ya lo resuelve?, ¿cuánto se puede cobrar? y ¿qué segmento elijo? La última se decide con las 4 R: Retorno, Repetible, Recursos y Rápido de encontrar.</p>
<p>Cada dato lleva su marca: <span class="inv">investigado</span>, con su fuente, o <span class="sup">supuesto</span>. Un dolor queda <span class="confirmado">confirmado</span> con 3 o más menciones en al menos 2 fuentes distintas; con 1 o 2 en una sola fuente es una <span class="hip">hipótesis viva</span>.</p>
</section>
<section id="a_quien" class="bloque"><h2>1 · ¿A quién le vendo?</h2>
{{seccion:a_quien}}
</section>
<section id="dolores" class="bloque"><h2>2 · ¿Qué le duele?</h2>
{{seccion:dolores}}
</section>
<section id="quien_lo_resuelve" class="bloque"><h2>3 · ¿Quién ya lo resuelve?</h2>
{{seccion:quien_lo_resuelve}}
</section>
<section id="precio" class="bloque"><h2>4 · ¿Cuánto se puede cobrar?</h2>
{{seccion:precio}}
</section>
<section id="segmentos" class="bloque"><h2>5 · ¿Qué segmento elijo?</h2>
{{seccion:segmentos}}
</section>
<section id="conclusiones" class="bloque"><h2>Conclusiones</h2>
{{seccion:conclusiones}}
</section>
<section id="fuentes" class="bloque fuentes"><h2>Fuentes</h2>
{{seccion:fuentes}}
</section>
<footer class="pie">Hecho por el agente Research de ARIA IA con evidencia pública. Lo marcado como supuesto se confirma en la Kickoff.</footer>
</div>$pla$,
       secciones_obligatorias = '{resumen,a_quien,dolores,quien_lo_resuelve,precio,segmentos,conclusiones,fuentes}'
 where clave = 'research_market_research';

comment on column catalogo.salidas_de_los_agentes.plantilla is
  'El cuerpo del documento (lo que va dentro de <body>) con un marcador {{seccion:<id>}} por sección (124). Si está, la columna se guarda con agentes.guardar_secciones, que reemplaza cada marcador por la sección del agente y fija el orden aunque las tandas lleguen en otro (125). Null: sin plantilla, una <section> por sección en el orden en que llegaron. El Research tiene una provisoria desde la 125, hasta la de Jorge.';

-- ─── 2 · guardar_secciones en tandas ─────────────────────────────────────────────

drop function if exists agentes.guardar_secciones(uuid, jsonb, text);

-- El agente manda sus secciones en una o varias tandas: [{"id": "resumen", "html": "…"}, …]. Con p_terminar = false
-- la tanda se suma a las anteriores en la salida de la corrida, que sigue abierta. Con p_terminar = true (por omisión)
-- la base junta todo, arma el documento con la envoltura y la plantilla de su columna, lo valida entero y lo guarda;
-- las secciones quedan en la salida de la corrida.
create or replace function agentes.guardar_secciones(p_corrida uuid, p_secciones jsonb, p_columna text default null,
  p_terminar boolean default true)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, negocio, catalogo, pg_temp
as $$
declare
  v           negocio.corridas_de_agente := agentes._corrida(p_corrida, true);
  v_columna   text := agentes._salida_del_agente(v, 'html', nullif(btrim(p_columna), ''));
  v_terminar  boolean := coalesce(p_terminar, true);
  v_plantilla text;
  v_envoltura text;
  v_oblig     text[];
  v_err       jsonb := '[]'::jsonb;
  v_previas   jsonb := '[]'::jsonb;
  v_tandas    integer := 0;
  v_nuevos    text[] := '{}';
  v_nuevas    jsonb := '{}'::jsonb;
  v_ids       text[] := '{}';
  v_mapa      jsonb := '{}'::jsonb;
  v_lista     jsonb := '[]'::jsonb;
  v_marcas    text[] := '{}';
  v_faltan    text[] := '{}';
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

  -- 125: lo que ya mandó en las tandas anteriores de ESTA corrida (nunca de otra: está en su propia salida).
  if jsonb_typeof(v.salida) = 'object' and (v.salida ->> 'en_curso') = 'true' then
    if v.salida ->> 'columna' is distinct from v_columna then
      return agentes._rechazar(v, jsonb_build_array(format(
        'esta corrida ya tiene tandas de «%s»: termínala con esa columna', v.salida ->> 'columna')));
    end if;
    if jsonb_typeof(v.salida -> 'secciones') = 'array' then
      v_previas := v.salida -> 'secciones';
    end if;
    v_tandas := coalesce((v.salida ->> 'tandas')::integer, 0);
  end if;

  if p_secciones is null or jsonb_typeof(p_secciones) <> 'array' then
    return agentes._rechazar(v, jsonb_build_array(
      'secciones: un arreglo [{"id": "resumen", "html": "…"}, …], en el orden del documento'));
  end if;
  if jsonb_array_length(p_secciones) = 0 and not (v_terminar and jsonb_array_length(v_previas) > 0) then
    return agentes._rechazar(v, jsonb_build_array(
      'secciones: al menos una (sólo la última tanda puede ir vacía, si antes se guardaron otras)'));
  end if;
  if jsonb_array_length(p_secciones) > 40 then
    return agentes._rechazar(v, jsonb_build_array('secciones: hasta 40'));
  end if;

  -- La tanda que llega: cada sección se valida sola.
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
    if v_id = any (v_nuevos) then
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
    v_nuevos := v_nuevos || v_id;
    v_nuevas := v_nuevas || jsonb_build_object(v_id, v_html);
  end loop;

  if v_plantilla is not null then
    v_marcas := array(select m[1] from regexp_matches(v_plantilla, '\{\{seccion:([a-z][a-z0-9_]{0,59})\}\}', 'g') as m);
    v_err := v_err || coalesce((select jsonb_agg(to_jsonb(format('sección «%s»: la plantilla no la tiene (son: %s)', x, array_to_string(v_marcas, ', '))))
                                  from unnest(v_nuevos) x where not (x = any (v_marcas))), '[]'::jsonb);
  end if;
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;

  -- Juntar: las de las tandas anteriores, cada una reemplazada en su lugar si vuelve a llegar; las nuevas, al final y
  -- en el orden recibido.
  for e in select x.valor from jsonb_array_elements(v_previas) as x(valor) loop
    v_id := e.valor ->> 'id';
    v_ids := v_ids || v_id;
    v_lista := v_lista || jsonb_build_array(case when v_id = any (v_nuevos)
                 then jsonb_build_object('id', v_id, 'html', v_nuevas ->> v_id) else e.valor end);
  end loop;
  foreach v_id in array v_nuevos loop
    if not (v_id = any (v_ids)) then
      v_ids := v_ids || v_id;
      v_lista := v_lista || jsonb_build_array(jsonb_build_object('id', v_id, 'html', v_nuevas ->> v_id));
    end if;
  end loop;
  select coalesce(jsonb_object_agg(x.valor ->> 'id', x.valor ->> 'html'), '{}'::jsonb) into v_mapa
    from jsonb_array_elements(v_lista) as x(valor);
  if coalesce(array_length(v_ids, 1), 0) > 40 then
    return agentes._rechazar(v, jsonb_build_array(format('secciones: hasta 40 entre todas las tandas (van %s)', array_length(v_ids, 1))));
  end if;
  v_faltan := array(select x from unnest(coalesce(v_oblig, '{}')) x where not (x = any (v_ids)));

  -- Una tanda que no termina: queda en la corrida, que sigue abierta. La columna no se toca.
  if not v_terminar then
    update negocio.corridas_de_agente
       set salida = jsonb_build_object('en_curso', true, 'columna', v_columna, 'tandas', v_tandas + 1, 'secciones', v_lista),
           errores = null
     where org_id = v.org_id and cuenta_id = v.cuenta_id and id = v.id and estado = 'abierta';
    if not found then
      raise exception using errcode = '55000', message = 'agentes: la corrida ya no está abierta';
    end if;
    return jsonb_build_object('ok', true, 'corrida_id', v.id, 'columna', v_columna, 'terminado', false,
      'tandas', v_tandas + 1, 'guardadas', to_jsonb(v_ids), 'faltan', to_jsonb(v_faltan),
      'siguiente', 'manda la próxima tanda con p_terminar = false, o la última sin ese argumento (o con true)');
  end if;

  -- La última: todas las obligatorias, entre esta tanda y las anteriores.
  if cardinality(v_faltan) > 0 then
    return agentes._rechazar(v, coalesce((select jsonb_agg(to_jsonb(format('falta la sección obligatoria «%s»', x)))
                                            from unnest(v_faltan) x), '[]'::jsonb));
  end if;

  -- El cuerpo, en una sola pasada: la plantilla partida en sus marcadores, con cada sección en su lugar (un marcador
  -- sin sección queda vacío). Sin plantilla, una <section> por sección en el orden en que llegaron.
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
    jsonb_build_object('secciones', to_jsonb(v_ids), 'con_plantilla', v_plantilla is not null, 'tandas', v_tandas + 1));
  perform agentes._cerrar(v, jsonb_build_object('columna', v_columna, 'version', v_version, 'bytes', octet_length(v_doc),
    'con_plantilla', v_plantilla is not null, 'tandas', v_tandas + 1, 'secciones', v_lista, 'html', v_doc), 0, 'lista');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'columna', v_columna, 'terminado', true, 'version', v_version,
    'bytes', octet_length(v_doc), 'secciones', to_jsonb(v_ids), 'con_plantilla', v_plantilla is not null,
    'tandas', v_tandas + 1);
end $$;

-- ─── 3 · Permisos ────────────────────────────────────────────────────────────────
-- Nada para PUBLIC; el inquilino y el rol de los agentes ejecutan todo lo de agentes (con la firma nueva).
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
