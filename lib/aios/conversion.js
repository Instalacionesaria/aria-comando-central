/* Portado de aios-command-center_1.html — líneas 3938-4582 del original. */
export function initConversion() {
  (function(){
  const nf = n => n==null ? '—' : (n>=1000 ? (n/1000>=100?Math.round(n/1000):(n/1000).toFixed(1).replace(/\.0$/,''))+'K' : n.toLocaleString('es-PE'));
  const pct = (a,b) => b ? Math.round(a/b*100) : 0;

  /* datos por dispositivo y periodo — reemplazar por la consulta real */
  const CV = {
    all:     {sesiones:866, vsl:604, form:308, agenda:225, calificados:141, gracias:198},
    mobile:  {sesiones:612, vsl:398, form:181, agenda:118, calificados:64,  gracias:101},
    desktop: {sesiones:254, vsl:206, form:127, agenda:107, calificados:77,  gracias:97},
  };
  const FACTOR = {'hoy':0.035,'7d':0.22,'mes':1,'tri':2.6,'hist':3.4};
  /* mismo periodo, ventana inmediatamente anterior */
  const PREV = {'hoy':0.031,'7d':0.19,'mes':0.88,'tri':2.35,'hist':3.4};
  const PREV_LBL = {'7d':'7 días previos','mes':'30 días previos'};

  /* banda esperada por paso, en % sobre visitas.
     Se calcula con la mediana de los últimos 90 días: p25 a p75 del propio histórico.
     Se guarda por dispositivo porque el comportamiento es muy distinto. */
  const BANDS = {
    all:     {vsl:[62,76], form:[30,40], agenda:[22,30], gracias:[19,27]},
    mobile:  {vsl:[58,72], form:[24,34], agenda:[16,24], gracias:[14,22]},
    desktop: {vsl:[68,82], form:[42,54], agenda:[36,46], gracias:[33,43]},
  };
  function bandOf(k){ return (BANDS[cvDevice]||{})[k]; }
  function bandState(k, v){
    const b = bandOf(k); if(!b) return null;
    if(v < b[0]) return {s:'bajo',   t:`bajo lo esperado · ${v-b[0]} pts`};
    if(v > b[1]) return {s:'sobre',  t:`sobre lo esperado · +${v-b[1]} pts`};
    return {s:'ok', t:'en rango'};
  }

  const STEPS = [
    {k:'sesiones',    n:'01', t:'Landing',     a:'entran a la página',   src:'Clarity'},
    {k:'vsl',         n:'02', t:'VSL',         a:'le dan play',          src:'VTurb'},
    {k:'form',        n:'03', t:'Formulario',  a:'empiezan a llenarlo', aShort:'lo empiezan', src:'Clarity'},
    {k:'agenda',      n:'04', t:'Agenda',      a:'reservan la cita',     src:'Calendario'},
    {k:'gracias',     n:'05', t:'Gracias',     a:'confirman y salen', aShort:'la completan', src:'Clarity'},
  ];

  /* sev: critica | alta | media | menor — ver reglas en el encabezado de la sección */
  const FRICTIONS = [
    {step:'form', ic:'⛔', color:'crit', sev:'critica', t:'El formulario devuelve error en Safari móvil',
     d:'Desde ayer 14:20, el 31% de los envíos falla en la validación del teléfono. Nadie puede agendar desde ese navegador.',
     loss:64, dev:'Safari móvil', to:'Kevin · técnico', age:'detectado hace 3 h', state:'nuevo'},
    {step:'vsl',     ic:'▮', color:'crit', sev:'alta', t:'Abandono del VSL entre 00:18 y 00:27',
     d:'La retención cae de 82% a 56% en nueve segundos. Es la mayor pérdida del recorrido.',
     loss:156, dev:'Móvil y escritorio', to:'Creative', state:'nuevo', age:'detectada hoy'},
    {step:'sesiones',ic:'✱', color:'crit', sev:'alta', t:'Clicks repetidos cerca del precio',
     d:'18% de las sesiones móviles hace clicks sobre un elemento que no responde.',
     loss:110, dev:'Solo móvil', to:'Creative', state:'visto', age:'hace 3 días'},
    {step:'form',    ic:'▤', color:'warn', sev:'alta', t:'Abandono en el campo de facturación',
     d:'27% de quienes empiezan el formulario lo dejan al llegar a ese campo.',
     loss:83, dev:'Móvil sobre todo', to:'Sales', state:'nuevo', age:'detectada ayer'},
    {step:'sesiones',ic:'↕', color:'warn', sev:'media', t:'No llegan al CTA principal',
     d:'41% de las sesiones nunca alcanza el botón de agenda por scroll insuficiente.',
     loss:64, dev:'Solo móvil', to:'Creative', state:'visto', age:'hace 6 días'},
    {step:'gracias', ic:'▷', color:'warn', sev:'media', t:'Casi la mitad no ve el video de bienvenida',
     d:'Solo 54% le da play. Quien lo termina asiste 12 puntos más, así que cada play perdido es riesgo de no-show.',
     loss:52, dev:'Sobre todo móvil', to:'Conversation', state:'nuevo', age:'detectada hoy'},
    {step:'sesiones',ic:'⏱', color:'warn', sev:'media', t:'Rebote antes de 3 segundos',
     d:'Concentrado en una sola campaña. El tráfico llega sin contexto de la oferta.',
     loss:48, dev:'Todos', to:'Acquisition', state:'visto', age:'hace 2 días'},
    {step:'sesiones',ic:'◷', color:'warn', sev:'media', t:'La página tarda 4.1s en cargar en móvil',
     d:'Cada segundo por encima de 3s cuesta cerca del 7% de las sesiones. El video pesa 2.4 MB.',
     loss:41, dev:'Solo móvil', to:'Kevin · técnico', state:'nuevo', age:'detectada hoy'},
    {step:'vsl',     ic:'◐', color:'warn', sev:'media', t:'El 18% no llega a dar play',
     d:'El reproductor queda medio cortado en pantallas pequeñas y no se percibe como video.',
     loss:57, dev:'Solo móvil', to:'Creative', state:'visto', age:'hace 4 días'},
    {step:'form',    ic:'⤾', color:'warn', sev:'media', t:'12% reintenta el envío',
     d:'El botón no da señal de carga, así que la gente lo pulsa dos y tres veces.',
     loss:22, dev:'Todos', to:'Kevin · técnico', state:'visto', age:'hace 5 días'},
    {step:'agenda',  ic:'▦', color:'warn', sev:'media', t:'La franja de 9 a 11 se llena y no hay alternativa cercana',
     d:'El 34% elige ese bloque. Cuando se agota, el siguiente hueco está a 4 días y 9% abandona.',
     loss:36, dev:'Todos', to:'Sales', state:'nuevo', age:'detectada ayer'},
  ];

  /* por debajo del umbral de impacto: no se muestran, se cuentan */
  const MINOR = [
    'Dead clicks en el logo · 11 sesiones',
    'Scroll rebote en la sección de garantía · 9 sesiones',
    'Un campo del formulario se autocompleta mal en Firefox · 6 sesiones',
  ];

  const WINS = [
    {step:'sesiones', ic:'✓', color:'ok', t:'El encabezado retiene: 78% llega hasta el video',
     d:'La promesa de la landing coincide con la del anuncio. No se pierde gente en los primeros scrolls.', to:'Creative'},
    {step:'vsl', ic:'◈', color:'ok', t:'Ver más del 60% del VSL predice asistencia',
     d:'De ese grupo, 22 de 29 agendados llegaron a la cita. El resto no pasa de la mitad.', to:'Sales'},
    {step:'form', ic:'✓', color:'ok', t:'Los primeros dos campos casi no pierden gente',
     d:'Nombre y WhatsApp retienen 96%. Pedir lo fácil primero está funcionando.', to:'Sales'},
    {step:'gracias', ic:'✓', color:'ok', t:'La página de gracias retiene bien',
     d:'88% de los agendados la completa y agrega el recordatorio. No es un punto de fuga.', to:'Conversation'},
  ];

  /* la acción concreta que corresponde a cada hallazgo */
  const ACTIONS = {
    'Abandono del VSL entre 00:18 y 00:27':'Recortar los nueve segundos entre 00:18 y 00:27 del VSL',
    'Clicks repetidos cerca del precio':'Volver interactivo el bloque de precio o quitarle apariencia de botón',
    'Abandono en el campo de facturación':'Cambiar facturación mensual por rangos seleccionables',
    'No llegan al CTA principal':'Subir el CTA por encima del pliegue en móvil',
    'Casi la mitad no ve el video de bienvenida':'Anunciar el video en el mensaje de confirmación de WhatsApp',
    'Rebote antes de 3 segundos':'Alinear el mensaje del anuncio con el encabezado de la landing',
  };

  const RECORDINGS = [
    {t:'Sesión · 4:12', m:'Móvil · iPhone · Lima', d:'Abandonó en el formulario'},
    {t:'Sesión · 2:38', m:'Móvil · Android · Bogotá', d:'Rage click en el precio'},
    {t:'Sesión · 6:05', m:'Escritorio · Chrome · CDMX', d:'Agendó tras ver el VSL completo'},
    {t:'Sesión · 1:14', m:'Móvil · iPhone · Santiago', d:'Rebotó antes del VSL'},
  ];

  /* zonas de la landing: alcance de scroll + intensidad de click (Clarity) */
  /* zona: [nombre, scroll, clicks, scroll previo, clicks previos] */
  const ZONES = [
    ['Encabezado',      100, 12, 100,  14],
    ['Video VSL',        78, 46,  74,  41],
    ['Beneficios',       59, 18,  61,  19],
    ['Prueba social',    47,  9,  44,  11],
    ['Precio',           34, 71,  36,  52],
    ['CTA final',        29, 23,  33,  26],
  ];
  /* retención del VSL por tramos de 10% (VTurb) */
  const VHEAT = [100, 88, 82, 74, 56, 51, 47, 44, 42, 41];
  /* video de bienvenida en la página de gracias */
  const THANKS_VIDEO = {visto:54, retencion:63, duracion:'1:20'};

  const SCROLL = [
    ['Encabezado', 100], ['Video VSL', 78], ['Beneficios', 59],
    ['Prueba social', 47], ['Precio', 34], ['CTA final', 29],
  ];

  const FIELDS = [
    ['Nombre', 308, 4], ['WhatsApp', 296, 11], ['Facturación mensual', 285, 83],
    ['Tipo de agencia', 202, 18], ['Objetivo a 90 días', 184, 12],
  ];

  let cvPeriod = 'hist', cvDevice = 'all';
  const data = (prev) => {
    const base = CV[cvDevice], f = (prev?PREV:FACTOR)[cvPeriod];
    const o = {}; for(const k in base) o[k] = Math.round(base[k]*f); return o;
  };
  const hasPrev = () => cvPeriod !== 'hist' && cvPeriod !== 'hoy';

  /* variación contra el periodo anterior */
  function delta(now, before, opts={}){
    if(!hasPrev() || before==null || !before) return '';
    const isPct = opts.pts;
    const diff = isPct ? Math.round(now-before) : Math.round((now-before)/before*100);
    if(diff === 0) return `<span class="dlt flat">=</span>`;
    const up = diff > 0;
    const good = opts.inverse ? !up : up;
    const val = (up?'+':'') + diff + (isPct ? ' pts' : '%');
    return `<span class="dlt ${good?'up':'down'}">${up?'▲':'▼'} ${val}</span>`;
  }
  const periodLbl = () => (typeof cvCustomLbl !== 'undefined' && cvCustomLbl) ? cvCustomLbl
    : (({'hoy':'hoy','7d':'últimos 7 días','mes':'últimos 30 días','hist':'histórico'})[cvPeriod] || 'rango elegido');

  /* ---- tira de KPIs ---- */
  function cvRenderStats(){
    const d = data(), p = data(true);
    const califica = 0.63;
    const cal  = Math.round(d.agenda*califica);
    const calP = Math.round(p.agenda*califica*0.94);
    const noCal = d.agenda - cal;

    const pair = (k, v, r, dl, g) => `
      <div class="pn-c">
        <div class="pn-k">${k}</div>
        <div class="pn-r"><span class="pn-v"${g?` data-leads="${g.t}" data-n="${g.n}"${g.seg?` data-seg="${g.seg}"`:''} data-sub="${g.sub||''}"`:''}>${v}</span>${r?`<span class="pn-rt">${r}</span>`:''}</div>
        <div class="pn-d">${dl || ''}</div>
      </div>`;

    document.getElementById('cvStats').innerHTML = `
      <div class="pn">
        <div class="pn-h">Landing y VSL
          <em>llegan y consumen</em></div>
        <div class="pn-b">
          ${pair('Visitas', nf(d.sesiones), '', delta(d.sesiones, p.sesiones),
                 {n:d.sesiones, t:'Visitas a la landing', sub:'Conversion'})}
          ${pair('Dan play al VSL', nf(d.vsl), pct(d.vsl,d.sesiones)+'%',
                 delta(pct(d.vsl,d.sesiones), pct(p.vsl,p.sesiones), {pts:1}),
                 {n:d.vsl, t:'Dieron play al VSL', sub:'Conversion'})}
        </div>
      </div>

      <div class="pn hi">
        <div class="pn-h">Formulario y cita
          <em>de visita a agenda</em></div>
        <div class="pn-b">
          ${pair('Empiezan el form', nf(d.form), pct(d.form,d.sesiones)+'%',
                 delta(pct(d.form,d.sesiones), pct(p.form,p.sesiones), {pts:1}),
                 {n:d.form, t:'Empezaron el formulario', sub:'Conversion'})}
          ${pair('Agendan', nf(d.agenda), pct(d.agenda,d.sesiones)+'%',
                 delta(pct(d.agenda,d.sesiones), pct(p.agenda,p.sesiones), {pts:1}),
                 {n:d.agenda, t:'Agendaron', sub:'Conversion'})}
        </div>
      </div>

      <div class="pn">
        <div class="pn-h">Calidad de lo agendado
          <em>${Math.round(cal/d.sesiones*100)}% de visita a cita útil</em></div>
        <div class="pn-b q3">
          ${pair('Citas', nf(d.agenda), '', delta(d.agenda, p.agenda),
                 {n:d.agenda, t:'Citas agendadas', sub:'Conversion'})}
          ${pair('Calificadas', nf(cal), Math.round(cal/d.agenda*100)+'%', delta(cal, calP),
                 {n:cal, seg:'alto', t:'Citas calificadas', sub:'Conversion'})}
          ${pair('No calificadas', nf(noCal), Math.round(noCal/d.agenda*100)+'%', '',
                 {n:noCal, seg:'bajo', t:'Citas no calificadas', sub:'Conversion'})}
        </div>
      </div>`;

    document.getElementById('cvInfo').innerHTML = hasPrev()
      ? `${nf(d.sesiones)} sesiones · ${periodLbl()} · vs ${PREV_LBL[cvPeriod]}`
      : `${nf(d.sesiones)} sesiones · ${periodLbl()} · ${cvPeriod==='hoy'?'día en curso, sin comparación':'sin comparación'}`;
  }

  /* las dos métricas que definen cada paso */
  function keyMetrics(k, d, p){
    /* [etiqueta, valor ahora, valor del periodo anterior, tipo] */
    const M = {
      sesiones: [['Scroll medio', 52, 54, 'pts'], ['Rage clicks', 84, 61, 'inv']],
      vsl:      [['Visto promedio', 41, 38, 'pts'], ['Llegan al CTA', 31, 34, 'pts']],
      form:     [['Lo completan', pct(d.agenda,d.form), pct(p.agenda,p.form), 'pts'],
                 ['Tiempo medio', '1:48', '2:05', 'txt']],
      agenda:   [['Calificadas', pct(d.calificados,d.agenda), pct(p.calificados,p.agenda), 'pts'],
                 ['Confirmadas', 78, 74, 'pts']],
      gracias:  [['Dan play al video', THANKS_VIDEO.visto, 61, 'pts'],
                 ['Video visto', THANKS_VIDEO.retencion, 60, 'pts']],
    };
    return (M[k]||[]).map(([a,now,before,type])=>{
      const val = type==='txt' ? now : (type==='pts' ? now+'%' : nf(now));
      const dl  = type==='txt' ? (hasPrev()? `<span class="dlt up">▲ mejor</span>`:'')
                : delta(now, before, {pts: type==='pts'?1:0, inverse: type==='inv'?1:0});
      return `<div class="jm"><span>${a}</span>${dl}<b>${val}</b></div>`;
    }).join('');
  }

  /* ---- recorrido ---- */
  function cvRenderJourney(){
    const d = data(), pv = data(true);
    const vals = STEPS.map(s=>d[s.k]);
    const pvals = STEPS.map(s=>pv[s.k]);
    const drops = vals.slice(0,-1).map((v,i)=>v-vals[i+1]);
    const worst = drops.indexOf(Math.max(...drops));
    let html = '';
    STEPS.forEach((s,i)=>{
      const prev = i ? vals[i-1] : null;
      const base = vals[0];
      const F = findings(s.k);
      const isCrit = F.some(x=>x.sev==='critica');
      const v = prev==null ? null : pct(vals[i], base);
      const st = v==null ? null : bandState(s.k, v);
      const off = st && st.s==='bajo';

      const state = isCrit ? 'crit' : (st ? st.s : 'na');
      html += `<div class="jstep st-${state}${isCrit?' crit':''}${off?' off':''}" data-step="${s.k}">
        ${i ? '<span class="jarrow"></span>' : ''}

        <div class="j-head">
          <span class="jsdot"></span>${s.t}<span class="jgo">›</span>
        </div>

        <div class="j-num">
          <span class="jv">${prev==null ? nf(vals[i]) : v+'%'}</span>
          ${prev==null ? delta(vals[i], pvals[i]) : delta(v, pct(pvals[i],pvals[0]), {pts:1})}
        </div>

        <div class="j-band">
          ${st ? (()=>{ const b=bandOf(s.k), lo=b[0]-8, hi=b[1]+8;
            const posN = Math.max(2, Math.min(98, ((v-lo)/(hi-lo))*100));
            const zl = ((b[0]-lo)/(hi-lo))*100, zr = ((hi-b[1])/(hi-lo))*100;
            return `<div class="jband ${st.s}" title="esperado ${b[0]}–${b[1]}%">
              <span class="jb-zone" style="left:${zl}%; right:${zr}%"></span>
              <span class="jb-mark ${st.s}" style="left:${posN}%"></span>
            </div>`; })() : '<div class="jband empty"></div>'}
        </div>

        <div class="j-sub">${prev==null ? s.a : `<b>${nf(vals[i])}</b> ${s.aShort||s.a}`}${off ? ` · <em>${st.t.split('· ')[1]} bajo lo esperado</em>` : ''}</div>

        <div class="jmx">${keyMetrics(s.k, d, pv)}</div>

        <div class="jx">
          <span>${F.length ? `${isCrit?'<span class="jdot"></span>':''}${F.length} a revisar` : 'sin observaciones'}</span>
          ${prev==null ? '' : `<em>−${drops[i-1].toLocaleString('es-PE')}</em>`}
        </div>
      </div>`;
    });
    document.getElementById('cvJourney').innerHTML = html;
    const fuera = STEPS.slice(1).filter(st=>{ const b=bandState(st.k, pct(d[st.k], vals[0])); return b && b.s==='bajo'; });
    document.getElementById('cvWorst').innerHTML = fuera.length
      ? `<span style="color:var(--warn)">${fuera.length} paso${fuera.length>1?'s':''} bajo lo esperado</span>`
      : `<span style="color:var(--ok)">todos los pasos en rango</span>`;
    bindSteps();
  }

  /* ---- fricciones y aciertos ---- */
  const TINT = {crit:'rgba(240,92,92,.14);color:var(--crit)', warn:'rgba(240,136,76,.14);color:var(--warn)', ok:'rgba(74,222,128,.14);color:var(--ok)'};
  const SEVLBL = {critica:'Requiere acción', alta:'Observación', media:'Observación'};
  const NAMEOF = {}; STEPS.forEach(x=>NAMEOF[x.k]=x.t);

  function findings(stepKey){
    const f = FACTOR[cvPeriod];
    const SEV = {critica:0, alta:1, media:2};
    return FRICTIONS
      .filter(x=> x.step===stepKey)
      .filter(x=> cvDevice==='all' || !x.dev.toLowerCase().includes('solo') ||
        (cvDevice==='mobile' && x.dev.toLowerCase().includes('móvil')) ||
        (cvDevice==='desktop' && x.dev.toLowerCase().includes('escritorio')))
      .map(x=>({...x, loss:Math.round(x.loss*f)}))
      .sort((a,b)=> SEV[a.sev]-SEV[b.sev] || b.loss-a.loss);
  }
  const wins = k => WINS.filter(x=>x.step===k);
  const allFindings = () => STEPS.flatMap(s=>findings(s.k));

  /* en la página solo vive lo que está roto ahora */
  function cvRenderLists(){
    const crit = allFindings().filter(x=>x.sev==='critica');
    document.getElementById('cvAlarmWrap').hidden = !crit.length;
    document.getElementById('cvAlarmN').textContent = crit.length===1 ? '1 incidencia' : crit.length+' incidencias';
    document.getElementById('cvAlarm').innerHTML = crit.map(x=>`
      <div class="alarm" data-step="${x.step}">
        <span class="al-ic">⛔</span>
        <div><div class="al-t">${x.t}</div>
          <div class="al-d">${x.d} <span class="al-m">${NAMEOF[x.step]} · ${x.age} · lo resuelve ${x.to}</span></div></div>
        <span class="al-go">Ver evidencia →</span>
      </div>`).join('');
  }

  /* ---- detalle por paso ---- */
  const box = (k,v,hi,dl) => `<div class="out${hi?' hi':''}"><div class="k">${k}</div>
    <div class="v">${v}${dl||''}</div></div>`;
  const dbox = (k, now, before, hi, opts) => box(k, opts&&opts.pts ? now+'%' : nf(now), hi, delta(now, before, opts));

  /* color de calor: turquesa (frío) → naranja → rojo (caliente) */
  function heatColor(v, max){
    const t = Math.min(1, v/max);
    if(t < .5){ const u=t/.5; return `rgba(${Math.round(53+187*u)},${Math.round(224-88*u)},${Math.round(210-134*u)},${0.20+0.30*u})`; }
    const u=(t-.5)/.5; return `rgba(${Math.round(240)},${Math.round(136-44*u)},${Math.round(76-24*u)},${0.50+0.32*u})`;
  }
  function heatMap(){
    const maxClick = Math.max(...ZONES.map(z=>z[2]));
    const rows = ZONES.map(([n,sc,cl,psc,pcl])=>{
      const dp = cl-pcl, show = hasPrev() && dp!==0;
      return `<div class="pz" style="background:${heatColor(cl,maxClick)}"><span>${n}</span>
        <span><b>${cl}%</b>${show?`<span class="pd">${dp>0?'+':''}${dp}</span>`:''}</span></div>`;}).join('');
    const side = ZONES.map(([n,sc,cl,psc])=>
      `<div class="sm-row"><span>${n}</span><span class="sm-bar"><i style="width:${sc}%"></i></span>
        <span class="sv">${sc}%${hasPrev()&&sc!==psc?` <span class="dlt ${sc>psc?'up':'down'}" style="padding:0 4px">${sc>psc?'+':''}${sc-psc}</span>`:''}</span></div>`).join('');
    return `<div class="heat">
        <div>
          <div class="page-mock">${rows}</div>
          <div class="heat-legend"><span>Menos</span><span class="heat-scale"></span><span>Más clicks</span></div>
        </div>
        <div>
          <div class="dw-src" style="margin-bottom:7px">Hasta dónde llega el scroll</div>
          <div class="heat-side">${side}</div>
        </div>
      </div>`;
  }
  function videoHeat(arr, dur){
    const bars = arr.map((v,i)=>{
      const drop = i ? arr[i-1]-v : 0;
      return `<i style="background:${heatColor(drop, 20)}" title="${i*10}-${(i+1)*10}% · ${v}%"></i>`;
    }).join('');
    return `<div class="vheat">
        <div class="vheat-bar">${bars}</div>
        <div class="vheat-axis"><span>0:00</span><span>${dur}</span></div>
        <div class="vheat-tip">Cada bloque es un 10% del video. Cuanto más rojo, más gente lo abandona ahí.</div>
      </div>`;
  }

  function obsBlock(k){
    const bad = findings(k), good = wins(k);
    if(!bad.length && !good.length) return '';
    const row = (x, positive) => `
      <div class="obs ${positive?'good':x.sev}">
        <span class="obs-dot"></span>
        <div class="obs-b">
          <div class="obs-t">${x.t}</div>
          <div class="obs-d">${x.d}</div>
          <div class="obs-m">${positive ? 'señal a favor' : `${x.age} · ${x.dev.toLowerCase()} · lo resuelve ${x.to}`}</div>
        </div>
        ${positive ? '' : `<div class="obs-n">−${nf(x.loss)}<span>contactos</span></div>`}
      </div>`;
    return `<div><div class="dw-sec-t">Observaciones
        <span class="r">${bad.length} a revisar${good.length?` · ${good.length} a favor`:''}</span></div>
      <div class="dw-block">
        ${bad.map(x=>row(x,false)).join('')}
        ${good.map(x=>row(x,true)).join('')}
      </div></div>`;
  }

  function stepDetail(k){
    const d = data(), p = data(true);
    if(k==='sesiones') return {
      title:'Landing', meta:`Clarity · ${nf(d.sesiones)} sesiones · ${periodLbl()}${hasPrev()?' · vs '+PREV_LBL[cvPeriod]:''}`,
      body:`
      <div><div class="dw-sec-t">Comportamiento <span class="r">Clarity</span></div>
        <div class="dw-block out-grid" style="grid-template-columns:1fr 1fr 1fr">
          ${dbox('Sesiones', d.sesiones, p.sesiones)}
          ${dbox('Llegan al VSL', pct(d.vsl,d.sesiones), pct(p.vsl,p.sesiones), true, {pts:1})}
          ${dbox('Scroll promedio', 52, 54, false, {pts:1})}
          ${dbox('Rage clicks', 84, 61, false, {inverse:1})}
          ${dbox('Dead clicks', 37, 40, false, {inverse:1})}
          ${dbox('Rebote bajo 3s', 48, 52, false, {inverse:1})}
        </div></div>
      <div><div class="dw-sec-t">Mapa de calor <span class="r">clicks y scroll por zona</span></div>
        ${heatMap()}
        <div class="read"><span class="rl"><b>Lectura:</b> el precio recibe el 71% de los clicks y no es interactivo. El CTA final solo lo alcanza el 29% porque queda bajo el pliegue en móvil.</span><span class="rs">Corresponde a Creative</span></div>
      </div>
      <div><div class="dw-sec-t">Grabaciones <span class="r">sesiones que abandonaron</span></div>
        <div class="dw-block">${RECORDINGS.map(r=>`
          <div class="rec"><div><div class="rt">${r.t}</div><div class="rm">${r.m}</div></div>
          <div class="rd">${r.d}</div><div class="rp">Ver ▸</div></div>`).join('')}
        </div></div>`+obsBlock('sesiones')};

    if(k==='vsl') return {
      title:'VSL', meta:`VTurb · ${nf(d.vsl)} reproducciones · ${periodLbl()}${hasPrev()?' · vs '+PREV_LBL[cvPeriod]:''}`,
      body:`
      <div><div class="dw-sec-t">Atención <span class="r">VTurb</span></div>
        <div class="dw-block out-grid" style="grid-template-columns:1fr 1fr 1fr">
          ${dbox('Reproducciones', d.vsl, p.vsl)}
          ${dbox('Pasan al formulario', pct(d.form,d.vsl), pct(p.form,p.vsl), true, {pts:1})}
          ${dbox('Visto promedio', 41, 38, false, {pts:1})}
          ${dbox('Hook 0-3s', 82, 80, false, {pts:1})}
          ${dbox('Llegan al CTA', 31, 34, false, {pts:1})}
          ${box('Duración','3:40')}
        </div></div>
      <div><div class="dw-sec-t">Curva de retención</div>
        <div class="dw-block">
          <div class="dw-video" style="background:linear-gradient(150deg,#2a2352,#1a1a3a)">
            <div class="play">▶</div>
            <div class="dw-scrub"><div class="track"></div><span class="t">0:00 / 3:40</span></div></div>
          <svg viewBox="0 0 460 120" style="width:100%;height:118px;margin-top:10px">
            <defs><linearGradient id="cvfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(53,224,210,0.26)"/><stop offset="100%" stop-color="rgba(53,224,210,0)"/>
            </linearGradient></defs>
            <line x1="26" y1="18" x2="446" y2="18" stroke="rgba(148,197,255,.06)"/>
            <line x1="26" y1="56" x2="446" y2="56" stroke="rgba(148,197,255,.06)"/>
            <line x1="26" y1="94" x2="446" y2="94" stroke="rgba(148,197,255,.06)"/>
            <path d="M26,18 L70,34 L110,40 L150,66 L210,74 L280,82 L350,88 L410,92 L440,94 L440,94 L26,94 Z" fill="url(#cvfill)"/>
            <path d="M26,18 L70,34 L110,40 L150,66 L210,74 L280,82 L350,88 L410,92 L440,94"
                  fill="none" stroke="var(--accent)" stroke-width="1.8"/>
            <circle cx="110" cy="40" r="5" fill="rgba(240,92,92,.9)"/>
            <circle cx="150" cy="66" r="5" fill="rgba(240,92,92,.9)"/>
            <text x="4" y="58" font-size="8" fill="var(--txt-faint)">50%</text>
            <text x="26" y="112" font-size="8" fill="var(--txt-faint)">0:00</text>
            <text x="418" y="112" font-size="8" fill="var(--txt-faint)">3:40</text>
          </svg>
          ${videoHeat(VHEAT, '3:40')}
          <div class="drop-row"><span class="drop-tag">CAÍDA</span><span class="drop-t">0:18</span>
            <span class="drop-d">82% → 74%</span><span class="drop-p">−8 pts</span></div>
          <div class="drop-row"><span class="drop-tag">CAÍDA</span><span class="drop-t">0:27</span>
            <span class="drop-d">74% → 56%</span><span class="drop-p">−18 pts</span></div>
          <div class="read"><span class="rl"><b>Lectura:</b> la caída de 00:27 se lleva 18 puntos de retención. Es guión, no página.</span><span class="rs">Corresponde a Creative</span></div>
        </div></div>`+obsBlock('vsl')};

    if(k==='form') return {
      title:'Formulario', meta:`Clarity · ${nf(d.form)} lo iniciaron · ${periodLbl()}${hasPrev()?' · vs '+PREV_LBL[cvPeriod]:''}`,
      body:`
      <div><div class="dw-sec-t">Resultado</div>
        <div class="dw-block out-grid" style="grid-template-columns:1fr 1fr 1fr">
          ${dbox('Lo iniciaron', d.form, p.form)}
          ${dbox('Lo completaron', d.agenda, p.agenda, true)}
          ${dbox('Tasa', pct(d.agenda,d.form), pct(p.agenda,p.form), false, {pts:1})}
          ${box('Tiempo medio','1:48')}
          ${dbox('Reintentos', 12, 15, false, {pts:1, inverse:1})}
          ${dbox('Errores validación', 7, 6, false, {pts:1, inverse:1})}
        </div></div>
      <div><div class="dw-sec-t">Dónde se abandona <span class="r">campo por campo</span></div>
        <div class="dw-block">${FIELDS.map(([n,v,dp])=>`
          <div class="field-row"><span class="fn">${n}</span><span class="fv">${v}</span><span class="fd">−${dp}</span></div>`).join('')}
        </div>
        <div class="read"><span class="rl"><b>Lectura:</b> facturación mensual concentra el 63% del abandono. Convertirlo en rangos seleccionables debería recuperar la mayoría.</span><span class="rs">Corresponde a Sales</span></div>
      </div>`+obsBlock('form')};

    if(k==='agenda') return {
      title:'Agenda', meta:`Calendario · ${nf(d.agenda)} citas · ${periodLbl()}${hasPrev()?' · vs '+PREV_LBL[cvPeriod]:''}`,
      body:`
      <div><div class="dw-sec-t">Resultado</div>
        <div class="dw-block out-grid" style="grid-template-columns:1fr 1fr 1fr">
          ${dbox('Citas agendadas', d.agenda, p.agenda, true)}
          ${dbox('Calificadas', d.calificados, p.calificados, true)}
          ${dbox('Tasa calificación', pct(d.calificados,d.agenda), pct(p.calificados,p.agenda), false, {pts:1})}
          ${dbox('Confirmadas', Math.round(d.agenda*0.78), Math.round(p.agenda*0.74))}
          ${box('Franja preferida','9-11h')}
          ${dbox('Canceladas', 6, 8, false, {pts:1, inverse:1})}
        </div></div>
      <div><div class="dw-sec-t">Qué pasa después</div>
        <div class="dw-block">
          <div class="rec"><div><div class="rt">Asistencia esperada</div>
            <div class="rm">Según consumo del VSL y segmento ICP</div></div>
            <div class="rd">74%</div><div class="rp">Ver contactos ▸</div></div>
          <div class="rec"><div><div class="rt">Riesgo de no-show</div>
            <div class="rm">Vieron menos del 40% del VSL</div></div>
            <div class="rd">31 contactos</div><div class="rp">Ver contactos ▸</div></div>
        </div>
        <div class="read"><span class="rl"><b>Lectura:</b> 63% de las citas son calificadas. Las 84 restantes consumen agenda del closer sin posibilidad real de cierre.</span><span class="rs">Corresponde a Sales</span></div>
      </div>
      `+obsBlock('agenda')};

    if(k==='calificados') return {
      title:'Citas calificadas',
      meta:`CRM · ${nf(d.calificados)} de ${nf(d.agenda)} citas · ${periodLbl()}${hasPrev()?' · vs '+PREV_LBL[cvPeriod]:''}`,
      body:`
      <div><div class="dw-sec-t">Calidad de lo agendado</div>
        <div class="dw-block out-grid" style="grid-template-columns:1fr 1fr 1fr">
          ${dbox('Calificadas', d.calificados, p.calificados, true)}
          ${dbox('Tasa de calificación', pct(d.calificados,d.agenda), pct(p.calificados,p.agenda), true, {pts:1})}
          ${dbox('No calificadas', d.agenda-d.calificados, p.agenda-p.calificados, false, {inverse:1})}
          ${dbox('Visita a calificada', pct(d.calificados,d.sesiones), pct(p.calificados,p.sesiones), false, {pts:1})}
          ${box('Motivo principal','Facturación baja')}
          ${box('Segundo motivo','No decide')}
        </div>
        <div class="read"><span class="rl"><b>Lectura:</b> ${nf(d.agenda-d.calificados)} citas no califican y ocupan agenda del closer. El filtro está en el formulario, no en la llamada.</span><span class="rs">Corresponde a Sales</span></div>
      </div>

      <div><div class="dw-sec-t">Por dónde entraron <span class="r">calificadas vs total</span></div>
        <div class="dw-block">
          <div class="rec"><div><div class="rt">Vieron más del 60% del VSL</div>
            <div class="rm">Califican 4 de cada 5</div></div><div class="rd">81%</div><div class="rp">Ver contactos ▸</div></div>
          <div class="rec"><div><div class="rt">Vieron menos del 25% del VSL</div>
            <div class="rm">Califican 1 de cada 4</div></div><div class="rd">26%</div><div class="rp">Ver contactos ▸</div></div>
          <div class="rec"><div><div class="rt">Entraron desde escritorio</div>
            <div class="rm">Califican mejor que móvil</div></div><div class="rd">72%</div><div class="rp">Ver contactos ▸</div></div>
        </div></div>`+obsBlock('calificados')};

    return {
      title:'Página de gracias', meta:`Clarity · ${nf(d.gracias)} visitas · ${periodLbl()}${hasPrev()?' · vs '+PREV_LBL[cvPeriod]:''}`,
      body:`
      <div><div class="dw-sec-t">Comportamiento</div>
        <div class="dw-block out-grid" style="grid-template-columns:1fr 1fr 1fr">
          ${dbox('Visitas', d.gracias, p.gracias)}
          ${dbox('La completan', 88, 86, true, {pts:1})}
          ${dbox('Agregan al calendario', 71, 68, false, {pts:1})}
          ${dbox('Dan play al video', THANKS_VIDEO.visto, 61, false, {pts:1})}
          ${dbox('Video visto promedio', THANKS_VIDEO.retencion, 60, false, {pts:1})}
          ${dbox('Vuelven a la landing', 8, 9, false, {pts:1, inverse:1})}
        </div></div>

      <div><div class="dw-sec-t">Video de bienvenida <span class="r">VTurb · ${THANKS_VIDEO.duracion}</span></div>
        <div class="dw-block">
          ${videoHeat([100,92,86,79,71,66,63,60,58,57], THANKS_VIDEO.duracion)}
          <div class="read"><span class="rl"><b>Lectura:</b> solo 54% le da play, pero quien lo termina asiste 12 puntos más. Subir el play es la palanca más barata contra el no-show.</span><span class="rs">Corresponde a Conversation</span></div>
        </div></div>
      <div><div class="dw-sec-t">Relación con la asistencia</div>
        <div class="dw-block">
          <div class="rec"><div><div class="rt">Agregaron la cita al calendario</div>
            <div class="rm">Asisten 81% de las veces</div></div><div class="rd">+14 pts</div><div class="rp">Ver ▸</div></div>
          <div class="rec"><div><div class="rt">No agregaron la cita</div>
            <div class="rm">Asisten 58% de las veces</div></div><div class="rd">−9 pts</div><div class="rp">Ver ▸</div></div>
        </div></div>`+obsBlock('gracias')};
  }

  function openStep(k){
    const s = stepDetail(k);
    document.getElementById('dwTitle').textContent = s.title;
    document.getElementById('dwMeta').textContent = s.meta;
    document.getElementById('dwVerdict').innerHTML = '';
    document.getElementById('dwBody').innerHTML = s.body;
    document.getElementById('scrim').classList.add('on');
    document.getElementById('drawer').classList.add('on');
    document.getElementById('drawer').setAttribute('aria-hidden','false');
  }
  function bindSteps(){
    document.querySelectorAll('#v-conversion [data-step]').forEach(el=>{
      el.onclick = e => {
        if(e.target.classList.contains('fr-send')){ e.stopPropagation(); return; }
        openStep(el.dataset.step);
      };
    });
  }

  document.getElementById('cvRecoBtn').addEventListener('click', ()=>{
    const d = data(), f = FACTOR[cvPeriod];
    const rank = FRICTIONS.map(x=>({...x, loss:Math.round(x.loss*f)})).sort((a,b)=>b.loss-a.loss);
    const recover = x => Math.round(x.loss*0.45);
    const total = rank.slice(0,3).reduce((s,x)=>s+recover(x),0);
    const conv = pct(d.agenda,d.sesiones);
    const convNew = pct(d.agenda+total, d.sesiones);

    document.getElementById('recoSub').textContent =
      `Conversion · ${periodLbl()} · ${({all:'todos los dispositivos',mobile:'móvil',desktop:'escritorio'})[cvDevice]}`;
    document.getElementById('recoBody').innerHTML = `
      <div class="plan-top">
        <div><div class="pt-k">Si haces las tres</div>
          <div class="pt-v">+${nf(total)} <span>citas recuperables</span></div></div>
        <div class="pt-arrow">→</div>
        <div><div class="pt-k">Conversión</div>
          <div class="pt-v">${conv}% <span>a ${convNew}%</span></div></div>
      </div>

      <div class="reco-group">
        <h4>Qué hacer primero</h4>
        ${rank.slice(0,3).map((x,i)=>`
          <div class="plan-item" data-goto="${x.step}">
            <span class="pi-n">${i+1}</span>
            <div><div class="pi-t">${ACTIONS[x.t] || x.t}</div>
              <div class="pi-d">${x.t} · ${x.dev.toLowerCase()} · lo resuelve ${x.to}</div></div>
            <div class="pi-g"><b>+${nf(recover(x))}</b><span>citas</span></div>
          </div>`).join('')}
      </div>

      <div class="reco-group idea">
        <h4>El patrón detrás</h4>
        <div class="reco-item idea">Cuatro de las cinco fugas ocurren <b>solo en móvil</b>. No son problemas distintos: es un layout que no se diseñó para pantalla vertical.</div>
        <div class="reco-item idea">La conversión en escritorio es <b>42%</b> y en móvil <b>19%</b>. Igualar la mitad de esa brecha vale más que cualquier ajuste individual.</div>
      </div>

      <div class="reco-group good">
        <h4>No tocar</h4>
        ${WINS.map(x=>`<div class="reco-item good">${x.t}. ${x.d}</div>`).join('')}
      </div>`;

    document.querySelectorAll('.plan-item').forEach(el=>{
      el.onclick = ()=>{ closeReco(); openStep(el.dataset.goto); };
    });
    document.getElementById('recoScrim').classList.add('on');
    document.getElementById('recoModal').classList.add('on');
    document.getElementById('recoModal').setAttribute('aria-hidden','false');
  });

  document.getElementById('cvDateSeg').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    cvCustomLbl = null;
    const pill = document.getElementById('cvPill');
    if(pill){ pill.classList.remove('active'); pill.querySelector('.pv').textContent = 'Personalizado'; }
    document.querySelectorAll('#cvDateSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); cvPeriod=b.dataset.p; cvRenderAll();
  });
  document.getElementById('cvDevSeg').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#cvDevSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); cvDevice=b.dataset.d; cvRenderAll();
  });

  function cvRenderAll(){ cvRenderStats(); cvRenderJourney(); cvRenderLists(); bindSteps(); }
  window.AIOSDate._cbs.cv = (kind, f, t, label)=>{
    cvPeriod = (kind === 'hist') ? 'hist' : 'mes';
    cvCustomLbl = (kind === 'hist') ? null : label;
    cvRenderAll();
  };
  let cvCustomLbl = null;
  cvRenderAll();
  })();
}
