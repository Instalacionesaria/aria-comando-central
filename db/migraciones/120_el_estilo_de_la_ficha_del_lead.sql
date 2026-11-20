-- 120 · La ficha del lead lleva el estilo de la base: el Sales Assistant manda sólo el contenido.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (decisión del usuario del 2026-11-20)
--
-- La ficha del lead aprobada por el jefe de área pesa unos 23 KB, y la mitad es el <style>, siempre igual. El Sales
-- Assistant de GHL tiene que escribir todo el HTML en una sola respuesta, y se cortaba por el largo máximo antes de
-- llamar a guardar_respuesta: en las dos pruebas no se guardó nada.
--
-- Ahora el estilo vive en la base y el agente manda sólo lo que va dentro de <body>. guardar_respuesta lo envuelve con
-- el estilo y guarda el documento ENTERO en la misma celda de siempre (negocio.respuestas_de_los_agentes.
-- sales_assistant_ficha_de_lead_1): n8n la lee tal cual para hacer el PDF. No hay tabla nueva: el estilo es una
-- columna del catálogo de esa tabla (catalogo.salidas_de_los_agentes, una fila por columna de las respuestas).
--
-- · catalogo.salidas_de_los_agentes.envoltura: el comienzo del documento, desde <!DOCTYPE html> hasta <body>. Sólo
--   para las columnas HTML, y pasa las mismas reglas del HTML (CHECK). La de la ficha 1 es la plantilla aprobada.
-- · guardar_respuesta: si la columna tiene envoltura y el agente manda sólo el contenido (sin <html>), guarda
--   envoltura + contenido + </body></html>. Si el contenido trae <!DOCTYPE>, <head>, <body>, <title> o <style>, lo
--   rechaza diciendo qué mandar. Un documento entero (con <html>) se sigue guardando tal cual, como hasta ahora.
--   Las reglas del HTML se aplican al documento que se guarda. La procedencia anota con_el_estilo_de_la_base.
-- · Sales Coach y Brief no tienen envoltura: siguen guardando lo que mandan.
-- ═════════════════════════════════════════════════════════════════════════════

alter table catalogo.salidas_de_los_agentes add column if not exists envoltura text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'catalogo.salidas_de_los_agentes'::regclass
                    and conname = 'salidas_la_envoltura_es_un_comienzo_de_html') then
    alter table catalogo.salidas_de_los_agentes add constraint salidas_la_envoltura_es_un_comienzo_de_html check (
      envoltura is null
      or (tipo = 'html'
          and envoltura ~* '^[[:space:]]*<!doctype html>'
          and envoltura ~* '<body>[[:space:]]*$'
          and agentes._reglas_del_html(envoltura) = '[]'::jsonb));
  end if;
end $$;

comment on column catalogo.salidas_de_los_agentes.envoltura is
  'El comienzo del documento (desde <!DOCTYPE html> hasta <body>, con el <style>) que guardar_respuesta pone delante del contenido que manda el agente (120). Null: la columna guarda lo que manda el agente.';

update catalogo.salidas_de_los_agentes set envoltura = $env$<!DOCTYPE html>
<html lang="es"><head>
<title>Ficha del Lead</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500&family=Geist+Mono:wght@400;500&display=swap');
/* Layout: mismo formato que "Perfil de Cliente" de Comando Central. Cabecera con la calificación, columna lateral con datos clave, columna principal con resumen, alertas y estrategia, y abajo el detalle con su fuente. */
:root {
  --bg: #FFFFFF; --bg-alt: #F6F7F9; --raised: #F1F3F6; --active: #E9EDF2;
  --line: #E3E7ED; --line-strong: #CDD3DC;
  --ink: #04060A; --ink-2: #3D4654; --ink-3: #5B6576; --ink-4: #7F8A9B;
  --accent: #0B6F93; --accent-2: #5B45C9; --signal: #8A6A12; --signal-line: #E8DDBF;
  --danger: #B3261E; --danger-line: #F0C9C5;
  --dots: #CDD3DC;
  --sans: "Geist", "Inter", system-ui, sans-serif;
  --mono: "Geist Mono", ui-monospace, "SFMono-Regular", monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #04060A; --bg-alt: #070A10; --raised: #0A0F18; --active: #0D1420;
    --line: #151B26; --line-strong: #3A4456;
    --ink: #F2F5F9; --ink-2: #AAB3C1; --ink-3: #7F8A9B; --ink-4: #4F5968;
    --accent: #8FE3FF; --accent-2: #B9A6FF; --signal: #E0C073; --signal-line: #3A3320;
    --danger: #FF9C94; --danger-line: #4A2623;
    --dots: #242C3A; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #04060A; --bg-alt: #070A10; --raised: #0A0F18; --active: #0D1420;
  --line: #151B26; --line-strong: #3A4456;
  --ink: #F2F5F9; --ink-2: #AAB3C1; --ink-3: #7F8A9B; --ink-4: #4F5968;
  --accent: #8FE3FF; --accent-2: #B9A6FF; --signal: #E0C073; --signal-line: #3A3320;
  --danger: #FF9C94; --danger-line: #4A2623;
  --dots: #242C3A; color-scheme: dark;
}
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: var(--sans); font-weight: 300; font-size: 13px; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}
a { color: var(--accent); text-decoration: none; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
.hoja { max-width: 860px; margin: 0 auto; padding: 0 12px 24px; }

.top { min-height: 52px; border-bottom: 1px solid var(--line); display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-bottom: 18px; padding-block: 8px; }
.brand { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 500; }
.brand small { font-weight: 300; color: var(--ink-4); font-size: 13px; }
.mini-orb { width: 20px; height: 20px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #FFF 0, #4A78FF 38%, #4B3FD9 78%, #07061A 100%); flex: none; }
.etiqueta { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--signal); border: 1px solid var(--signal-line); border-radius: 999px; padding: 3px 11px; white-space: nowrap; }
.fecha { font-family: var(--mono); font-size: 11px; color: var(--ink-4); white-space: nowrap; }

.cabecera { border: 1px solid var(--line); border-radius: 18px; overflow: hidden; background: var(--bg-alt); }
.portada { height: 100px; position: relative; background-image: radial-gradient(var(--dots) 1px, transparent 1.2px); background-size: 16px 16px; border-bottom: 1px solid var(--line); }
.portada::after { content: ""; position: absolute; right: 44px; top: 16px; width: 68px; height: 68px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #FFF 0, #4A78FF 38%, #4B3FD9 78%, #07061A 100%); box-shadow: 0 40px 120px -40px rgba(74,120,255,.45); opacity: .9; }
.identidad { display: flex; gap: 20px; align-items: flex-start; padding: 0 24px 18px; margin-top: -52px; position: relative; }
.foto { width: 108px; height: 108px; border-radius: 50%; border: 4px solid var(--bg-alt); outline: 1px solid var(--line-strong); background: var(--active); flex: none; display: grid; place-items: center; }
.foto .ini { font-size: 36px; font-weight: 200; letter-spacing: -.03em; color: var(--ink-2); }
.quien { flex: 1; min-width: 0; margin-top: 62px; }
.quien h1 { margin: 0; font-size: 26px; line-height: 1.1; font-weight: 500; letter-spacing: -.03em; text-wrap: balance; }
.quien p { margin: 4px 0 0; color: var(--ink-2); font-size: 14px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.chip { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; padding: 0 9px; border: 1px solid var(--line-strong); border-radius: 999px; font-size: 11.5px; color: var(--ink-2); }
.chip.sug { color: var(--signal); border-color: var(--signal-line); }
.chip.danger { color: var(--danger); border-color: var(--danger-line); }
.chip.big { min-height: 28px; padding: 0 12px; font-size: 13px; font-weight: 500; }
.chip.big.prioriza { color: var(--accent); border-color: var(--accent); }
.chip.big.valida { color: var(--accent-2); border-color: var(--accent-2); }
.chip.big.financia { color: var(--signal); border-color: var(--signal); }
.chip.big.descarta { color: var(--ink-3); border-color: var(--line-strong); }
.dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.dot.pendiente { border: 1.5px solid var(--ink-4); }
.dot.parcial { background: var(--accent-2); }
.dot.definido { background: var(--accent); }
.dot.signal { background: var(--signal); }
.dot.danger { background: var(--danger); }
.dot.prioriza { background: var(--accent); }
.dot.valida { background: var(--accent-2); }
.dot.financia { background: var(--signal); }
.dot.descarta { background: var(--ink-4); }
.cifras { display: flex; gap: 20px; margin-top: 66px; }
.cifras div { text-align: right; }
.cifras b { display: block; font-family: var(--mono); font-weight: 400; font-size: 16px; color: var(--ink); white-space: nowrap; }
.cifras span { font-size: 11.5px; color: var(--ink-3); white-space: nowrap; }
.tabs { display: flex; gap: 2px; border-top: 1px solid var(--line); padding: 0 14px; overflow-x: auto; }
.tab { padding: 11px 11px 9px; font-size: 13px; color: var(--ink-3); border-bottom: 2px solid transparent; white-space: nowrap; display: flex; align-items: center; gap: 7px; }
.tab:hover { color: var(--ink); }
.tab small { font-family: var(--mono); font-size: 10.5px; color: var(--ink-4); }
.tab.on { color: var(--ink); font-weight: 500; border-bottom-color: var(--ink); }

.cuerpo { display: grid; grid-template-columns: 248px minmax(0, 1fr); gap: 16px; margin-top: 16px; align-items: start; }
.col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.caja { border: 1px solid var(--line); border-radius: 18px; background: var(--bg-alt); padding: 18px; scroll-margin-top: 12px; }
.caja h2 { margin: 0 0 12px; font-size: 15px; font-weight: 500; letter-spacing: -.01em; }
.intro { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
.intro li { display: flex; gap: 10px; font-size: 12.5px; color: var(--ink-2); min-width: 0; }
.intro li::before { content: ""; width: 7px; height: 7px; margin-top: 6px; border-radius: 50%; border: 1.5px solid var(--ink-3); flex: none; }
.intro b { font-weight: 500; color: var(--ink); }
.intro span { min-width: 0; overflow-wrap: anywhere; }
.avance { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
.avance li { display: grid; grid-template-columns: 1fr auto; gap: 5px 12px; font-size: 12.5px; color: var(--ink-2); }
.avance li span:nth-child(2) { font-family: var(--mono); font-size: 11.5px; color: var(--ink-3); }
.bar { grid-column: 1 / -1; height: 4px; border-radius: 4px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, #4A78FF, #8FE3FF); }
.leyenda { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }

.contenido { border: 1px solid var(--line); border-radius: 12px; background: var(--bg); padding: 12px 14px; font-size: 13.5px; color: var(--ink-2); }
.eyebrow { font-family: var(--mono); font-size: 10.5px; font-weight: 500; letter-spacing: .12em; color: var(--accent); text-transform: uppercase; margin: 0; }
.num { list-style: none; margin: 12px 0 0; padding: 0; counter-reset: n; display: flex; flex-direction: column; gap: 9px; }
.num li { display: grid; grid-template-columns: 22px 1fr; gap: 10px; font-size: 12.5px; color: var(--ink-2); }
.num li::before { counter-increment: n; content: counter(n); width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--line-strong); display: grid; place-items: center; font-family: var(--mono); font-size: 10.5px; color: var(--accent); background: var(--bg); }
.aviso { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.aviso li { display: grid; grid-template-columns: 14px 1fr; gap: 8px; font-size: 12.5px; color: var(--ink-2); }
.aviso li::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--signal); margin-top: 6px; }
.aviso li.alta::before { background: var(--danger); }
.aviso li.baja::before { background: transparent; border: 1.5px solid var(--ink-4); }
.aviso b { font-weight: 500; color: var(--ink); }
.aviso .grav { font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; margin-right: 6px; color: var(--signal); }
.aviso .alta .grav { color: var(--danger); }
.aviso .baja .grav { color: var(--ink-3); }
.aviso .src { display: block; margin-top: 3px; font-size: 11.5px; color: var(--ink-3); }
.caja.alerta { border-color: var(--signal-line); }
.caja.alerta h2 { color: var(--signal); }
.kv { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px 14px; font-size: 12.5px; color: var(--ink-2); margin-top: 12px; }
.kv .k { color: var(--ink-3); }
.sub { font-family: var(--mono); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); margin: 16px 0 0; }
.obj { border-top: 1px solid var(--line); padding: 11px 0 0; margin-top: 11px; display: grid; gap: 3px; font-size: 12.5px; color: var(--ink-2); }
.obj:first-of-type { margin-top: 8px; }
.obj b { font-weight: 500; color: var(--ink); font-size: 13px; }
.obj .chip { justify-self: start; margin-bottom: 2px; }

.playbook { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.caja-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 4px; }
.caja-head h2 { margin: 4px 0 0; }
.cnt { font-family: var(--mono); font-size: 11.5px; color: var(--ink-3); white-space: nowrap; }
.lista { list-style: none; margin: 0; padding: 0; }
.fila { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 11px 4px; border-top: 1px solid var(--line); }
.lista .fila:first-child { border-top: 0; }
.ico { width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--line-strong); display: grid; place-items: center; color: var(--ink-2); background: var(--bg); font-family: var(--mono); font-size: 14px; line-height: 1; }
.txt { min-width: 0; }
.nom { font-size: 13.5px; font-weight: 400; display: block; color: var(--ink); }
.val { font-size: 12.5px; color: var(--ink-2); display: block; margin-top: 1px; overflow-wrap: anywhere; }
.val.nada { color: var(--ink-4); font-style: italic; }
.det { font-size: 11.5px; color: var(--ink-3); display: block; margin-top: 3px; overflow-wrap: anywhere; }
.det code { font-family: var(--mono); font-size: 10.5px; }
.fila .chip { margin-top: 5px; }
.vacio { font-size: 12.5px; color: var(--ink-3); }
.faltan { display: flex; flex-wrap: wrap; gap: 6px; }
.faltan .chip { font-family: var(--mono); font-size: 11px; }

.pie { margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; font-family: var(--mono); font-size: 10px; letter-spacing: .06em; color: var(--ink-4); text-transform: uppercase; }

@media (max-width: 620px) {
  .hoja { padding: 0 0 20px; }
  .identidad { flex-direction: column; align-items: flex-start; gap: 12px; padding: 0 16px 18px; }
  .quien, .cifras { margin-top: 0; }
  .cifras div { text-align: left; }
  .cuerpo { grid-template-columns: minmax(0, 1fr); }
  .kv { grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .kv .k { margin-top: 8px; }
  .portada::after { right: 20px; }
  .etiqueta { margin-left: 0; }
}
</style></head><body>$env$
 where clave = 'sales_assistant_ficha_de_lead_1';

-- Las tres fichas (Sales Assistant, Sales Coach y Brief): el HTML entero, en la columna del agente de la corrida. La
-- ficha 1 recibe sólo el contenido y la base le pone el estilo (120).
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
  -- Sin espacios ni saltos de línea en las puntas (btrim sólo quita espacios).
  v_contenido := regexp_replace(coalesce(p_html, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if v_contenido = '' then
    return agentes._rechazar(v, agentes._reglas_del_html(''));
  end if;
  select s.envoltura into v_envoltura from catalogo.salidas_de_los_agentes s where s.clave = v_columna;
  if v_envoltura is not null and p_html !~* '<[[:space:]]*html([[:space:]>/]|$)' then
    if p_html ~* '<!doctype' or p_html ~* '<[[:space:]]*/?[[:space:]]*(head|body|title|style)([[:space:]>/]|$)' then
      return agentes._rechazar(v, jsonb_build_array(
        'html: manda sólo lo que va dentro de <body>, sin <!DOCTYPE>, <head>, <body>, <title> ni <style>: el estilo lo pone la base'));
    end if;
    v_html := v_envoltura || E'\n' || v_contenido || E'\n</body></html>';
    v_envuelta := true;
  end if;
  v_err := agentes._reglas_del_html(v_html);
  if jsonb_array_length(v_err) > 0 then
    return agentes._rechazar(v, v_err);
  end if;
  v_version := agentes._escribir_respuesta(v, v_columna, v_html,
    case when v_envuelta then jsonb_build_object('con_el_estilo_de_la_base', true) end);
  perform agentes._cerrar(v, jsonb_build_object('columna', v_columna, 'version', v_version,
    'bytes', octet_length(v_html), 'con_el_estilo_de_la_base', v_envuelta, 'html', v_html), 0, 'lista');
  return jsonb_build_object('ok', true, 'corrida_id', v.id, 'columna', v_columna, 'version', v_version,
    'bytes', octet_length(v_html), 'con_el_estilo_de_la_base', v_envuelta);
end $$;
