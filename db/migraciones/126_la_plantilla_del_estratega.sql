-- 126 · La plantilla del Estratega: la página de estrategia de Jorge, en HTML estático, con sus 12 pestañas.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (decisiones del usuario del 2026-11-24)
--
-- Jorge pasó el Estratega v5.2: tres etapas (ICP, categoría y oferta, precio y process map) con aprobación humana
-- entre cada una, y una página interactiva armada con JavaScript desde un JSON. El usuario decidió:
--
--   · UNA sola corrida, cuando el cliente acepta el research (como se acordó el 23/11): el Estratega hace las tres
--     etapas de una vez, con el método y las skills de Jorge, y deja al final «Decisiones para aprobar»;
--   · HTML estático en estratega_oferta, porque la celda no acepta JavaScript (la regla de todas las fichas): las
--     mismas 12 pestañas de la página de Jorge, como secciones con un índice arriba. Lo que en la página se tocaba
--     (las ocho capas, las verdades, las partes de la fórmula) va en <details>, que se abre sin JavaScript; las
--     calculadoras salen como tablas con la cuenta hecha;
--   · el Estratega lee el research y además la ficha de cliente 2 (los casos y los nombres propios del cliente).
--
-- Se guarda en tandas, como el Research (la 125): unos 35 KB de documento no entran en una respuesta del agente.
-- Las doce secciones son obligatorias; el orden lo pone la plantilla. El título de cada pestaña (su titular) lo
-- escribe el agente dentro de su sección.
--
-- Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

update catalogo.salidas_de_los_agentes
   set envoltura = $env$<!DOCTYPE html>
<html lang="es"><head>
<title>Oferta · ARIA IA</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
:root{color-scheme:light;
  --bg:#F7F9FB;--bg-alt:#EEF2F6;--surface:#FFFFFF;--line:#DDE3EA;--line-strong:#B9C3CF;
  --ink:#0E131B;--ink-2:#3B4553;--ink-3:#5C6777;
  --accent:#0B6F93;--accent-soft:rgba(11,111,147,.10);
  --ok:#1F7A4D;--warn:#9A6B00;--alert:#C8102E;
  --sans:"Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --mono:"Geist Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;
  --bg:#04060A;--bg-alt:#070A10;--surface:#0A0F18;--line:#151B26;--line-strong:#3A4456;
  --ink:#F2F5F9;--ink-2:#AAB3C1;--ink-3:#7F8A9B;
  --accent:#8FE3FF;--accent-soft:rgba(143,227,255,.10);
  --ok:#7FD8A6;--warn:#E0C073;--alert:#FF8C7A}}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:110px}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}
header.top{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}
.top-in{max-width:1080px;margin:0 auto;padding:12px 20px 0;display:flex;flex-direction:column;gap:8px}
.brand{font-size:14px;color:var(--ink-3)}
.brand b{font-weight:700;color:var(--ink);letter-spacing:.02em}
nav.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:0 -4px}
nav.tabs a{flex:0 0 auto;font:500 14px var(--sans);color:var(--ink-3);text-decoration:none;padding:9px 11px 11px;border-bottom:2px solid transparent;white-space:nowrap}
nav.tabs a:hover{color:var(--ink);border-bottom-color:var(--accent)}
main{max-width:1080px;margin:0 auto;padding:24px 20px 80px}
section.pestana{padding:48px 0 40px;border-bottom:1px solid var(--line)}
.kicker{font-family:var(--mono);font-size:13px;color:var(--accent);margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em}
h1,h2,h3,h4{line-height:1.15;margin:0}
h1{font-size:clamp(34px,6vw,64px);font-weight:700;letter-spacing:-.035em;max-width:18ch;margin:8px 0 0}
h1.contraste s{display:block;color:var(--ink-3);text-decoration-thickness:3px}
h1.contraste span{display:block}
h2{font-size:clamp(26px,4vw,38px);font-weight:700;letter-spacing:-.02em;max-width:24ch;margin:0 0 6px}
h3{font-size:19px;font-weight:600;margin:26px 0 8px}
h4{font-size:16px;font-weight:600;margin:16px 0 6px}
p{margin:0 0 12px}
.lead{font-size:18px;color:var(--ink-2);max-width:64ch;margin:10px 0 26px}
ul,ol{margin:0 0 14px;padding-left:22px}
li{margin:0 0 6px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin:26px 0}
.facts div{background:var(--bg);padding:18px}
.facts strong{display:block;font-size:28px;font-weight:600;letter-spacing:-.02em}
.facts span{font-size:14px;color:var(--ink-2)}
.caja{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:0 0 16px}
.destacada{border:2px solid var(--accent);background:var(--accent-soft)}
.alerta{border-color:var(--warn)}
.alerta h3,.alerta h4{color:var(--warn);margin-top:0}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:0 0 16px}
.grid2 .caja{margin:0}
details{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin:0 0 10px;padding:0 18px}
details[open]{border-color:var(--line-strong)}
summary{cursor:pointer;padding:14px 0;font-weight:600;list-style-position:outside}
summary .n{font-family:var(--mono);color:var(--accent);margin-right:10px}
details>*:last-child{margin-bottom:16px}
blockquote.cita{margin:10px 0 14px;padding:10px 16px;border-left:3px solid var(--accent);background:var(--accent-soft);font-style:italic}
blockquote.cita cite{display:block;margin-top:6px;font-style:normal;font-family:var(--mono);font-size:12px;color:var(--ink-3)}
.frase{font-size:22px;font-weight:600;letter-spacing:-.01em;max-width:40ch}
table{width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:15px}
th{text-align:left;font-weight:600;color:var(--ink-2);background:var(--bg-alt)}
th,td{padding:9px 11px;border-bottom:1px solid var(--line);vertical-align:top}
tr.total td{font-weight:700;border-top:2px solid var(--line-strong)}
.wrap-x{overflow-x:auto}
.inv,.sup,.confirmado,.hip,.descartado,.hoy{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:600;font-style:normal;vertical-align:middle}
.inv{background:var(--accent-soft);color:var(--accent)}
.sup{background:rgba(154,107,0,.12);color:var(--warn)}
.confirmado{background:rgba(31,122,77,.12);color:var(--ok)}
.hip{background:rgba(154,107,0,.12);color:var(--warn)}
.descartado{background:var(--bg-alt);color:var(--ink-3);text-decoration:line-through}
.hoy{background:var(--accent);color:var(--bg)}
ol.pasos{list-style:none;padding:0;border-left:1px solid var(--line-strong);margin:0 0 18px}
ol.pasos li{padding:12px 16px;margin:0}
ol.pasos li b{display:block;font-size:17px}
ol.pasos li small{display:block;font-family:var(--mono);font-size:12px;color:var(--ink-3);margin-top:4px}
p.formula{font-size:22px;line-height:1.5;max-width:46ch}
p.formula u{text-decoration-color:var(--accent);text-decoration-thickness:2px;text-underline-offset:5px}
.palanca{display:grid;grid-template-columns:170px 1fr 110px;gap:12px;align-items:center;margin:0 0 6px}
.barra{height:10px;border-radius:999px;background:var(--bg-alt);overflow:hidden}
.barra i{display:block;height:100%;background:var(--accent)}
.palanca.baja .barra i{background:var(--alert)}
.palanca b{font-size:14px}
.palanca+p.nota{margin:0 0 14px 182px}
ol.escalera{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
ol.escalera li{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0}
ol.escalera li.actual{border:2px solid var(--accent)}
.nota{font-size:14px;color:var(--ink-3)}
.ref{font-family:var(--mono);font-size:11px;text-decoration:none;vertical-align:super}
.pie{max-width:1080px;margin:0 auto;padding:20px;font-family:var(--mono);font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em}
@media (max-width:640px){main{padding:16px 16px 60px}.palanca{grid-template-columns:1fr}.palanca+p.nota{margin-left:0}}
</style></head><body>$env$,
       plantilla = $pla$<header class="top"><div class="top-in"><div class="brand"><b>Estrategia</b> · ARIA IA</div>
<nav class="tabs"><a href="#inicio">Inicio</a><a href="#clienta_ideal">Clienta ideal</a><a href="#dolores">Dolores</a><a href="#big_idea">Big Idea</a><a href="#mecanismo">Mecanismo</a><a href="#formula">Fórmula</a><a href="#valor">Hormozi</a><a href="#precio">Precio</a><a href="#garantia">Garantía</a><a href="#auditoria">Auditoría</a><a href="#process_map">Process Map</a><a href="#decisiones">Decisiones</a></nav>
</div></header>
<main>
<section id="inicio" class="pestana">
{{seccion:inicio}}
</section>
<section id="clienta_ideal" class="pestana"><p class="kicker">Clienta ideal</p>
{{seccion:clienta_ideal}}
</section>
<section id="dolores" class="pestana"><p class="kicker">Dolores</p>
{{seccion:dolores}}
</section>
<section id="big_idea" class="pestana"><p class="kicker">Big Idea</p>
{{seccion:big_idea}}
</section>
<section id="mecanismo" class="pestana"><p class="kicker">Mecanismo</p>
{{seccion:mecanismo}}
</section>
<section id="formula" class="pestana"><p class="kicker">Fórmula</p>
{{seccion:formula}}
</section>
<section id="valor" class="pestana"><p class="kicker">Hormozi · la ecuación de valor</p>
{{seccion:valor}}
</section>
<section id="precio" class="pestana"><p class="kicker">Precio</p>
{{seccion:precio}}
</section>
<section id="garantia" class="pestana"><p class="kicker">Garantía</p>
{{seccion:garantia}}
</section>
<section id="auditoria" class="pestana"><p class="kicker">Auditoría</p>
{{seccion:auditoria}}
</section>
<section id="process_map" class="pestana"><p class="kicker">Process Map</p>
{{seccion:process_map}}
</section>
<section id="decisiones" class="pestana"><p class="kicker">Decisiones</p>
{{seccion:decisiones}}
</section>
</main>
<footer class="pie">Hecho por el agente Estratega de ARIA IA a partir del research. Lo marcado como supuesto se confirma antes de usarlo.</footer>$pla$,
       secciones_obligatorias = '{inicio,clienta_ideal,dolores,big_idea,mecanismo,formula,valor,precio,garantia,auditoria,process_map,decisiones}',
       descripcion = 'La estrategia del cliente a partir del research aceptado: clienta ideal, dolores, Big Idea, mecanismo, fórmula de la oferta, ecuación de valor, precio, garantía, auditoría, process map y decisiones para aprobar (la página de Jorge, en HTML estático). El agente la guarda por secciones, en tandas (124, 126).'
 where clave = 'estratega_oferta';
