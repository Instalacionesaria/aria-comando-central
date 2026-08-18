/* Portado de aios-command-center_1.html — líneas 4584-4904 del original. */
export function initLeadsPortal() {

  /* ===================== LEADS PORTAL ===================== */
  (function(){
  const money = n => '$'+n.toLocaleString('en-US');
  const IC = {alto:'var(--ok)', medio:'var(--warn)', bajo:'var(--txt-faint)', nc:'rgba(148,197,255,.25)'};

  const LEADS = [
    {n:'María López',      icp:87, seg:'alto',  camp:'Campaign 04',  cre:'Creative 12', adset:'Lookalike 2%',
     src:'facebook / paid', st:'sold',      booked:1, showed:1, sold:1, rev:4500, when:'hace 2 h',
     vsl:94, pre:100, lead:'Texto · 12 msgs', appt:'Voz · 4 min', closer:'Jorge Veramendi',
     fit:92, intent:88, form:'8/8', tel:'+51 987 654 321', mail:'maria@agencia.pe',
     f:{empresa:'López Media', rubro:'Agencia de performance', facturacion:'$18K–30K / mes',
        equipo:'6 personas', objetivo:'Escalar a $50K', urgencia:'Este mes', decide:'Sí, es la dueña',
        servicio:'Meta Ads y creatividad', dolor:'No consigue clientes premium'},
     ads:{plataforma:'Meta', objetivo:'Leads', ubicacion:'Reels', dispositivo:'iPhone · Safari',
          ciudad:'Lima, PE', formulario:'Lead form nativo', costo:'$18.40', posicion:'Feed móvil',
          utm_source:'facebook', utm_medium:'paid', utm_campaign:'prospecting_b', utm_content:'creative_12'},
     vslLog:[['00:00','Inició el video',1],['01:12','Pausó 22 s',0],['02:05','Retrocedió a 01:40',0],
             ['03:18','Llegó al CTA',1],['03:29','Clic en agendar',1]],
     inter:[['Formulario enviado','hace 2 días · 8/8 campos'],
            ['WhatsApp · Sofía','12 mensajes · sentimiento positivo'],
            ['Video precall','visto 100%'],
            ['Confirmación por voz','4 min · confirmó día y hora'],
            ['Llamada con Jorge','48 min · cerró en la llamada']]},
    {n:'Pablo Herrera',    icp:91, seg:'alto',  camp:'Prospecting B', cre:'Creative 07', adset:'Intereses',
     src:'facebook / paid', st:'sold',      booked:1, showed:1, sold:1, rev:9600, when:'ayer',
     vsl:88, pre:100, lead:'Texto · 9 msgs', appt:'Texto · 3 msgs', closer:'Jorge Veramendi',
     fit:95, intent:90, form:'8/8', tel:'+51 991 220 118', mail:'pablo@growthlab.pe'},
    {n:'Carlos Méndez',    icp:82, seg:'alto',  camp:'Prospecting B', cre:'Creative 07', adset:'Lookalike 1%',
     src:'facebook / paid', st:'showed',    booked:1, showed:1, sold:0, rev:0, when:'hace 5 h',
     vsl:71, pre:64, lead:'Texto · 7 msgs', appt:'Voz · 2 min', closer:'Asesor comercial',
     fit:84, intent:79, form:'8/8', tel:'+51 964 118 202', mail:'carlos@mendezmedia.com'},
    {n:'Daniela Soto',     icp:74, seg:'medio', camp:'Campaign 04',  cre:'Creative 09', adset:'Retargeting 30d',
     src:'facebook / paid', st:'booked',    booked:1, showed:0, sold:0, rev:0, when:'hace 1 día',
     vsl:52, pre:0,  lead:'Texto · 5 msgs', appt:'Sin respuesta', closer:'Asesor comercial',
     fit:71, intent:66, form:'7/8', tel:'+51 933 447 810', mail:'daniela@sotoads.com'},
    {n:'Lucía Fernández',  icp:58, seg:'medio', camp:'Campaign 04',  cre:'Creative 12', adset:'Lookalike 2%',
     src:'facebook / paid', st:'qualified', booked:0, showed:0, sold:0, rev:0, when:'hace 2 días',
     vsl:34, pre:0,  lead:'Texto · 3 msgs', appt:'—', closer:'—',
     fit:60, intent:51, form:'6/8', tel:'+51 977 010 559', mail:'lucia@fernandezco.pe'},
    {n:'TechNova',         icp:79, seg:'medio', camp:'Prospecting B', cre:'Creative 07', adset:'Intereses',
     src:'facebook / paid', st:'showed',    booked:1, showed:1, sold:0, rev:0, when:'hace 3 días',
     vsl:66, pre:82, lead:'Voz · 6 min', appt:'Texto · 4 msgs', closer:'Jorge Veramendi',
     fit:80, intent:74, form:'8/8', tel:'+51 900 332 114', mail:'hola@technova.pe'},
    {n:'Grupo Meridian',   icp:85, seg:'alto',  camp:'Campaign 04',  cre:'Creative 12', adset:'Lookalike 1%',
     src:'facebook / paid', st:'booked',    booked:1, showed:0, sold:0, rev:0, when:'hace 4 h',
     vsl:81, pre:45, lead:'Texto · 11 msgs', appt:'Voz · 1 min', closer:'Jorge Veramendi',
     fit:88, intent:83, form:'8/8', tel:'+51 955 909 221', mail:'contacto@meridian.pe'},
    {n:'Estudio Vera',     icp:34, seg:'bajo',  camp:'Orgánico',     cre:'—', adset:'—',
     src:'instagram / orgánico', st:'lost', booked:0, showed:0, sold:0, rev:0, when:'hace 5 días',
     vsl:12, pre:0,  lead:'Texto · 2 msgs', appt:'—', closer:'—',
     fit:38, intent:29, form:'5/8', tel:'+51 921 664 073', mail:'estudio@vera.pe'},
    {n:'Rodrigo Vega',     icp:62, seg:'medio', camp:'Prospecting A', cre:'Creative 07', adset:'Lookalike 2%',
     src:'facebook / paid', st:'booked',    booked:1, showed:0, sold:0, rev:0, when:'hace 6 h',
     vsl:44, pre:0,  lead:'Texto · 6 msgs', appt:'Sin respuesta', closer:'Asesor comercial',
     fit:65, intent:58, form:'7/8', tel:'+51 918 774 330', mail:'rodrigo@vegadigital.pe'},
    {n:'Andrea Salas',     icp:54, seg:'medio', camp:'Prospecting B', cre:'Creative 03', adset:'Intereses',
     src:'facebook / paid', st:'qualified', booked:0, showed:0, sold:0, rev:0, when:'hace 20 min',
     vsl:28, pre:0,  lead:'Texto · 4 msgs', appt:'—', closer:'—',
     fit:57, intent:49, form:'6/8', tel:'+51 946 118 900', mail:'andrea@salasmkt.com'},
    {n:'Diego Paredes',    icp:79, seg:'alto',  camp:'Retargeting',  cre:'Creative 12', adset:'Retargeting 30d',
     src:'facebook / paid', st:'sold',      booked:1, showed:1, sold:1, rev:6000, when:'hace 2 días',
     vsl:90, pre:100, lead:'Texto · 8 msgs', appt:'Texto · 2 msgs', closer:'Asesor comercial',
     fit:86, intent:84, form:'8/8', tel:'+51 902 553 118', mail:'diego@paredesagency.com'},
    {n:'Sergio Málaga',    icp:null, seg:'nc', camp:'Meta Lead Ads', cre:'Creative 04', adset:'Lookalike 2%',
     src:'facebook / lead form', st:'nuevo', booked:0, showed:0, sold:0, rev:0, when:'hace 35 min',
     vsl:0, pre:0, lead:'Texto · 2 msgs', appt:'—', closer:'—',
     fit:0, intent:0, form:'0/8', tel:'+51 940 118 776', mail:'sergio@malagamkt.pe'},
    {n:'Verónica Iparraguirre', icp:null, seg:'nc', camp:'Meta Lead Ads', cre:'Creative 07', adset:'Intereses',
     src:'facebook / lead form', st:'nuevo', booked:0, showed:0, sold:0, rev:0, when:'hace 2 h',
     vsl:0, pre:0, lead:'Texto · 4 msgs', appt:'—', closer:'—',
     fit:0, intent:0, form:'0/8', tel:'+51 913 552 004', mail:'veronica@ipa.digital'},
    {n:'Cobra Studio',     icp:null, seg:'nc', camp:'Meta Lead Ads', cre:'Creative 12', adset:'Lookalike 1%',
     src:'facebook / lead form', st:'nuevo', booked:0, showed:0, sold:0, rev:0, when:'ayer',
     vsl:0, pre:0, lead:'Sin respuesta', appt:'—', closer:'—',
     fit:0, intent:0, form:'0/8', tel:'+51 977 330 219', mail:'hola@cobrastudio.pe'},
    {n:'Karla Núñez',      icp:65, seg:'medio', camp:'Campaign 04',  cre:'Creative 09', adset:'Lookalike 1%',
     src:'facebook / paid', st:'qualified', booked:0, showed:0, sold:0, rev:0, when:'hace 1 día',
     vsl:39, pre:0,  lead:'Texto · 5 msgs', appt:'—', closer:'—',
     fit:68, intent:60, form:'7/8', tel:'+51 987 001 442', mail:'karla@nunezstudio.pe'},
  ];

  /* relleno para los contactos de ejemplo que no traen ficha completa */
  LEADS.forEach(l=>{
    l.f = l.f || {empresa:l.n, rubro:'Agencia de marketing', facturacion: l.seg==='alto'?'$15K–25K / mes':(l.seg==='medio'?'$5K–15K / mes':'Menos de $5K / mes'),
      equipo: l.seg==='alto'?'5 personas':'2 personas', objetivo:'Más clientes recurrentes',
      urgencia: l.seg==='alto'?'Este mes':'Próximos 3 meses', decide: l.seg==='bajo'?'Consulta con socio':'Sí',
      servicio:'Meta Ads', dolor:'Depende de referidos'};
    l.ads = l.ads || {plataforma: l.src.includes('facebook')?'Meta':'Instagram orgánico', objetivo:'Leads',
      ubicacion:'Feed', dispositivo: l.icp%2 ? 'Android · Chrome' : 'iPhone · Safari', ciudad:'Lima, PE',
      formulario: l.src.includes('facebook')?'Landing propia':'Bio link', costo: l.src.includes('facebook')?'$'+(12+l.icp%14)+'.'+(10+l.icp%80):'—',
      posicion:'Feed móvil', utm_source: l.src.split(' / ')[0], utm_medium: l.src.split(' / ')[1],
      utm_campaign: l.camp.toLowerCase().replace(/ /g,'_'), utm_content: (l.cre||'—').toLowerCase().replace(/ /g,'_')};
    l.vslLog = l.vslLog || [['00:00','Inició el video',1],
      ['0'+Math.max(0,Math.round(l.vsl/40))+':'+String(10+l.icp%40).padStart(2,'0'), l.vsl>60?'Vio el bloque de precio':'Abandonó el video', l.vsl>60?1:0],
      ['03:18','Llegó al CTA', l.vsl>60?1:0]];
    l.inter = l.inter || [['Formulario enviado', l.when+' · '+l.form+' campos'],
      ['WhatsApp · Sofía', l.lead], ['Video precall', l.pre+'% visto'],
      ['Appointment Flow', l.appt]];
  });

  const STLBL = {sold:'Vendido', showed:'Asistió', booked:'Agendado', qualified:'Calificado',
    lost:'Perdido', nuevo:'Sin calificar'};
  const SEGLBL = {alto:'ALTO', medio:'MEDIO', bajo:'BAJO', nc:'—'};
  let lpStage = 'all', lpQuery = '';

  function visibles(){
    return LEADS.filter(l=>{
      if(lpStage==='booked' && !l.booked) return false;
      if(lpStage==='showed' && !l.showed) return false;
      if(lpStage==='sold'   && !l.sold)   return false;
      if(lpQuery){
        const t = (l.n+' '+l.camp+' '+l.cre+' '+l.src).toLowerCase();
        if(!t.includes(lpQuery)) return false;
      }
      return true;
    });
  }

  /* ---- resumen por ICP ---- */
  function lpRenderIcp(){
    const all = LEADS;
    const seg = k => all.filter(l=>l.seg===k);
    const rate = (a,b) => b ? Math.round(a/b*100) : 0;
    const card = (k, label) => {
      const g = seg(k), n = g.length;
      const agend = g.filter(l=>l.booked).length, vend = g.filter(l=>l.sold).length;
      const rev = g.reduce((s,l)=>s+l.rev,0);
      return `<div class="icpc" data-seg="${k}">
        <div class="ih"><span class="idot" style="background:${IC[k]}"></span>${label}</div>
        <div class="iv"><span data-leads="${label}" data-n="${n}" data-seg="${k}" data-sub="Leads Portal">${n}</span></div>
        <div class="is">${rate(n, all.length)}% del total · ${k==='nc' ? 'sin agendar' : agend+' agendados'}</div>
        <div class="ib"><i style="width:${rate(n, all.length)}%; background:${IC[k]}"></i></div>
        <div class="im">${k==='nc'
          ? '<span>Aún sin formulario</span><span>califican al agendar</span>'
          : `<span>Cierre <b>${rate(vend, n)}%</b></span><span>Revenue <b>${rev?money(rev):'—'}</b></span>`}</div>
      </div>`;
    };
    const revT = all.reduce((s,l)=>s+l.rev,0);
    document.getElementById('lpIcp').innerHTML =
      card('nc','Sin calificar') + card('alto','Calificado alto') + card('medio','Calificado medio') + card('bajo','No calificado') +
      `<div class="icpc" data-seg="all">
        <div class="ih"><span class="idot" style="background:var(--accent)"></span>Todos</div>
        <div class="iv">${all.length}</div>
        <div class="is">${all.filter(l=>l.sold).length} ventas · ${all.filter(l=>l.booked).length} agendados</div>
        <div class="ib"><i style="width:100%; background:var(--accent)"></i></div>
        <div class="im"><span>Cierre <b>${rate(all.filter(l=>l.sold).length, all.length)}%</b></span><span>Revenue <b>${money(revT)}</b></span></div>
      </div>`;
    document.querySelectorAll('.icpc').forEach(el=>{
      el.onclick = ()=>{
        const k = el.dataset.seg;
        document.querySelectorAll('.icpc').forEach(x=>x.classList.remove('on'));
        if(lpQuery === (k==='all'?'':k)) { lpQuery=''; }
        else { el.classList.add('on'); }
        lpSeg = (lpSeg===k || k==='all') ? null : k;
        document.querySelectorAll('#lpIcpSeg button').forEach(x=>
          x.classList.toggle('on', x.dataset.i === (lpSeg || 'all')));
        lpRenderGrid();
      };
    });
  }
  let lpSeg = null;

  /* ---- tarjetas ---- */
  function lpRenderGrid(){
    let list = visibles();
    if(lpSeg) list = list.filter(l=>l.seg===lpSeg);
    const prog = l => {
      const steps = [['Agendó', l.booked], ['Asistió', l.showed], ['Vendió', l.sold]];
      return `<span class="lc-prog">${steps.map(([t,ok])=>
        `<i class="${ok?'on':''}">${t}</i>`).join('<b>›</b>')}</span>`;
    };

    document.getElementById('lpGrid').innerHTML = list.map(l=>`
      <div class="lc seg-${l.seg}" data-lead="${LEADS.indexOf(l)}">
        <div class="lc-top">
          <div class="lc-id">
            <div class="lc-name">${l.n}</div>
            <div class="lc-src">${l.camp} · ${l.cre}</div>
          </div>
          <div class="lc-score">
            <span class="sc-v">${l.icp == null ? '—' : l.icp}</span>
            <span class="sc-l">${l.icp == null ? 'SIN CALIF.' : SEGLBL[l.seg]}</span>
          </div>
        </div>
        <div class="lc-money">
          <div class="lc-mv ${l.rev ? '' : 'zero'}">${l.rev ? money(l.rev) : '—'}</div>
          <div class="lc-ml">${l.rev ? 'facturado'
            : (l.booked ? 'en proceso' : (l.seg === 'nc' ? 'califica al agendar' : 'sin cita'))}</div>
        </div>
        <div class="lc-foot">${prog(l)}</div>
      </div>`).join('') || '<div class="dw-empty" style="grid-column:1/-1">Ningún contacto con estos filtros.</div>';

    document.getElementById('lpCount').innerHTML =
      `<b>${list.length}</b> de ${LEADS.length} contactos${lpSeg?` · ICP ${lpSeg}`:''}`;

    document.querySelectorAll('.lc').forEach(el=>{
      el.onclick = ()=> openLead(LEADS[+el.dataset.lead]);
    });
  }

  /* ---- detalle ---- */
  function openLead(l){
    const ini = l.n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    document.getElementById('dwTitle').innerHTML =
      `<span class="ld-head"><span class="ld-av">${ini}</span>${l.n}</span>`;
    document.getElementById('dwMeta').innerHTML =
      `<span style="color:${IC[l.seg]}">ICP ${l.icp} · ${SEGLBL[l.seg]}</span> · ${l.when} · ${STLBL[l.st]}`;
    document.getElementById('dwVerdict').innerHTML = '';

    const kv = rows => `<div class="kv-box">${rows.map(([k,v])=>
      `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;

    const line = (ok, t, m, when) => `
      <div class="ld-time">
        <span class="ld-dot ${ok?'ok':''}"></span>
        <div><div class="ld-t">${t}</div><div class="ld-m">${m}</div></div>
        <span class="ld-when">${when}</span>
      </div>`;

    document.getElementById('dwBody').innerHTML = `
      <div>
        <div class="ld-actions" style="grid-template-columns:1fr 1fr 1fr">
          <button class="ld-btn">✆ Llamar</button>
          <button class="ld-btn">✉ Email</button>
          <button class="ld-btn" data-ghl="1">↗ GHL</button>
        </div>
      </div>

      <div><div class="dw-sec-t">Recorrido</div>
        <div class="dw-block">
          ${line(true, 'Entró al sistema', `${l.camp} · ${l.cre}`, l.when)}
          ${line(l.vsl>0, 'Vio el VSL', `${l.vsl}% del video`, l.vsl>0?'':'no lo vio')}
          ${line(l.booked, 'Agendó la cita', l.booked?`Closer · ${l.closer}`:'no agendó', '')}
          ${line(l.showed, 'Asistió a la llamada', l.showed?'Llamada completada':'no asistió', '')}
          ${line(l.sold, 'Compró', l.sold?money(l.rev):'sin cierre', '')}
        </div>
      </div>

      <div><div class="dw-sec-t">Formulario de la landing <span class="r">${l.form} campos</span></div>
        ${kv([['Empresa', l.f.empresa], ['Rubro', l.f.rubro], ['Facturación mensual', l.f.facturacion],
              ['Tamaño del equipo', l.f.equipo], ['Objetivo a 90 días', l.f.objetivo],
              ['Urgencia', l.f.urgencia], ['¿Decide la compra?', l.f.decide],
              ['Servicio que ofrece', l.f.servicio], ['Principal dolor', l.f.dolor]])}
      </div>

      <div><div class="dw-sec-t">Comportamiento en el VSL <span class="r">VTurb</span></div>
        ${kv([['Visto del video', l.vsl+'%'], ['Llegó al CTA', l.vsl>60?'Sí':'No'],
              ['Video precall', l.pre+'%']])}
        <div class="dw-block vlog">
          ${l.vslLog.map(([t,txt,ok])=>`
            <div class="vl"><span class="vl-t">${t}</span>
              <span class="vl-x ${ok?'':'off'}">${txt}</span></div>`).join('')}
        </div>
      </div>

      <div><div class="dw-sec-t">Interacciones</div>
        <div class="dw-block">
          ${l.inter.map(([t,m])=>line(true, t, m, '')).join('')}
        </div>
      </div>

      <div><div class="dw-sec-t">Parámetros de publicidad</div>
        ${kv([['Plataforma', l.ads.plataforma], ['Campaña', l.camp], ['Conjunto', l.adset],
              ['Creative', l.cre], ['Ubicación', l.ads.ubicacion], ['Posición', l.ads.posicion],
              ['Objetivo', l.ads.objetivo], ['Costo del lead', l.ads.costo],
              ['Dispositivo', l.ads.dispositivo], ['Ciudad', l.ads.ciudad],
              ['Punto de captura', l.ads.formulario]])}
        ${kv([['utm_source', l.ads.utm_source], ['utm_medium', l.ads.utm_medium],
              ['utm_campaign', l.ads.utm_campaign], ['utm_content', l.ads.utm_content]])}
      </div>

      <div><div class="dw-sec-t">Calificación</div>
        ${kv([['ICP Score', l.icp], ['Fit score', l.fit], ['Intent score', l.intent],
              ['Formulario completado', l.form]])}
      </div>

      <div><div class="dw-sec-t">Contacto</div>
        ${kv([['Teléfono', l.tel], ['Email', l.mail], ['Closer asignado', l.closer]])}
      </div>`;

    document.querySelectorAll('#dwBody [data-ghl]').forEach(b=>
      b.onclick = ()=> window.open('https://app.gohighlevel.com/', '_blank'));
    document.getElementById('scrim').classList.add('on');
    document.getElementById('drawer').classList.add('on');
    document.getElementById('drawer').setAttribute('aria-hidden','false');
  }

  /* la ficha completa se puede abrir desde cualquier parte */
  window.AIOSLeadCard = function(name){
    const l = LEADS.find(x => x.n.toLowerCase() === String(name).toLowerCase());
    if(l) return openLead(l);
    const base = LEADS[0];
    return openLead(Object.assign({}, base, {n:name}));
  };

  document.getElementById('lpIcpSeg').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#lpIcpSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    lpSeg = b.dataset.i === 'all' ? null : b.dataset.i;
    document.querySelectorAll('.icpc').forEach(c=>
      c.classList.toggle('on', c.dataset.seg === b.dataset.i && b.dataset.i !== 'all'));
    lpRenderGrid();
  });
  document.getElementById('lpStage').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#lpStage button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); lpStage = b.dataset.s; lpRenderGrid();
  });
  document.getElementById('lpPeriod').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#lpPeriod button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
  });
  document.getElementById('lpSearch').addEventListener('input', e=>{
    lpQuery = e.target.value.trim().toLowerCase(); lpRenderGrid();
  });

  lpRenderIcp(); lpRenderGrid();
  })();
}
