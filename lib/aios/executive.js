/* Portado de aios-command-center_1.html — líneas 4906-5145 del original. */
export function initExecutive() {

  /* ===================== EXECUTIVE ===================== */
  (function(){
  /* mismo periodo, ventana anterior */
  const PREV_LBL2 = {'hoy':'ayer a esta hora','7d':'los 7 días previos','mes':'los 30 días previos'};
  const PREVP = {
    'hoy': {spend:1410, agendados:11, asistidas:7, ventas:1, revenue:2900},
    '7d':  {spend:9120,  agendados:61,  asistidas:34, ventas:9,  revenue:22300},
    'mes': {spend:31800, agendados:206, asistidas:128,ventas:38, revenue:94500},
    'tri': {spend:81200, agendados:540, asistidas:342,ventas:101,revenue:251000},
    'hist':{spend:0, agendados:0, asistidas:0, ventas:0, revenue:0},
  };
  const F = {
    'hoy': {spend:1290,  contactos:48,  conversaciones:41,  landing:29,  agendados:9,   asistidas:6,  ventas:2,  revenue:5080,  camp:3},
    '7d':  {spend:8525,  contactos:312, conversaciones:268, landing:194, agendados:57,  asistidas:36, ventas:11, revenue:27940, camp:3},
    'mes': {spend:34100, contactos:1248,conversaciones:1072,landing:776, agendados:228, asistidas:144,ventas:44, revenue:111760,camp:4},
    'tri': {spend:88660, contactos:3245,conversaciones:2787,landing:2018,agendados:593, asistidas:374,ventas:114,revenue:290576,camp:6},
    'hist':{spend:214300,contactos:7980,conversaciones:6840,landing:4960,agendados:1452,asistidas:918,ventas:281,revenue:713540,camp:9},
  };
  const STEPS = [
    {k:'contactos',      t:'Contactos',      own:'Acquisition', view:'acquisition'},
    {k:'conversaciones', t:'Conversaciones', own:'Conversation',view:'conversation'},
    {k:'landing',        t:'Visitas landing',own:'Conversion',  view:'conversion'},
    {k:'agendados',      t:'Agendamientos',  own:'Conversion',  view:'conversion'},
    {k:'asistidas',      t:'Citas asistidas',own:'Sales',       view:'sales'},
    {k:'ventas',         t:'Ventas',         own:'Sales',       view:'sales'},
  ];
  let exP = '7d';
  const m = n => '$'+Math.round(n).toLocaleString('en-US');
  const nn = n => n.toLocaleString('es-PE');

  function render(){
    const d = F[exP];
    const vals = STEPS.map(s=>d[s.k]);
    const rates = vals.slice(1).map((v,i)=>Math.round(v/vals[i]*100));
    const worst = rates.indexOf(Math.min(...rates));
    const roas = (d.revenue/d.spend).toFixed(2);

    const rows = STEPS.map((s,i)=>{
      const jam = i && i-1===worst;
      const share = Math.round(vals[i]/vals[0]*100);
      return `<div class="fr2 ${jam?'jam':''}" data-go="${s.view}">
        <div class="fr2-l">
          <div class="fr2-t">${s.t}</div>
          <div class="fr2-o">${s.own}</div>
        </div>
        <div class="fr2-n"><span data-leads="${s.t}" data-n="${vals[i]}" data-sub="Executive · ${s.own}">${nn(vals[i])}</span></div>
        <div class="fr2-bar"><i style="width:${share}%"></i></div>
        <div class="fr2-p">${i ? rates[i-1]+'%' : '100%'}</div>
        <div class="fr2-c">${m(d.spend/vals[i])}</div>
      </div>`;
    }).join('');

    const prev = PREVP[exP];
    const dl = (now, before, inv) => {
      if(exP === 'hist' || exP === 'hoy' || !before) return '';
      const diff = Math.round((now-before)/before*100);
      if(diff===0) return '<span class="dlt flat">=</span>';
      const good = inv ? diff<0 : diff>0;
      return `<span class="dlt ${good?'up':'down'}">${diff>0?'▲ +':'▼ '}${diff}%</span>`;
    };
    const meta = 30, hechas = d.ventas, pctMeta = Math.round(hechas/meta*100);

    document.getElementById('exFunnel').innerHTML = `
      <div class="cockpit">
        <div class="ck-goal">
          <div class="ck-k">Objetivo del mes</div>
          <div class="ck-big">${hechas}<span>/ ${meta} ventas</span></div>
          <div class="ck-bar">
            <i style="width:${pctMeta}%"></i>
            <em style="left:61%"><span>ritmo esperado</span></em>
          </div>
          <div class="ck-foot">
            <span><b>${meta-hechas}</b> por cerrar</span>
            <span><b>18</b> días restantes</span>
            <span class="proj">proyección <b>22</b></span>
          </div>
          <div class="ck-weeks">
            ${[['S1',4,8],['S2',3,8],['S3',4,8],['S4',0,6]].map(([w,v,t])=>`
              <div class="wk"><span class="wk-b"><i style="height:${v/t*100}%"></i></span>
                <span class="wk-l">${w}</span><span class="wk-v">${v||'—'}</span></div>`).join('')}
            <div class="wk-note">ventas por semana · meta 8 semanales</div>
          </div>
        </div>

        <div class="ck-rev">
          <div class="ck-k">Ingresos del periodo</div>
          <div class="ck-money">${m(d.revenue)}</div>
          <div class="ck-dl">${exP==='hist' ? '<span>todo el histórico · sin comparación</span>'
            : exP==='hoy' ? '<span>día en curso · sin comparación</span>'
            : dl(d.revenue, prev.revenue)+' <span>vs '+PREV_LBL2[exP]+'</span>'}</div>
          <div class="ck-split">
            <div><span>Ticket promedio</span><b>${m(d.revenue/d.ventas)}</b></div>
            <div><span>Margen sobre ads</span><b>${m(d.revenue - d.spend)}</b></div>
          </div>
          <div class="ck-spark">
            <svg viewBox="0 0 260 54" preserveAspectRatio="none">
              <defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(53,224,210,.28)"/>
                <stop offset="100%" stop-color="rgba(53,224,210,0)"/></linearGradient></defs>
              <path d="M0,42 L43,38 L87,30 L130,34 L173,22 L217,26 L260,10 L260,54 L0,54 Z" fill="url(#spg)"/>
              <path d="M0,42 L43,38 L87,30 L130,34 L173,22 L217,26 L260,10"
                    fill="none" stroke="var(--accent)" stroke-width="1.8"/>
              <circle cx="260" cy="10" r="3" fill="var(--accent)"/>
            </svg>
            <div class="sp-l"><span>hace 7 periodos</span><span>ahora</span></div>
          </div>
        </div>

        <div class="ck-side">
          <div class="ck-tile">
            <span>Inversión</span>
            <b>${m(d.spend)}</b>
            <em>${dl(d.spend, prev.spend, true)} · ROAS ${roas}x</em>
          </div>
          <div class="ck-tile">
            <span>Citas agendadas</span>
            <b>${nn(d.agendados)}</b>
            <em>${dl(d.agendados, prev.agendados)} · ${nn(d.asistidas)} asistieron</em>
          </div>
          <div class="ck-tile">
            <span>Costo por venta</span>
            <b>${m(d.spend/d.ventas)}</b>
            <em>ticket ${(d.revenue/d.ventas/(d.spend/d.ventas)).toFixed(1)}× el costo</em>
          </div>
        </div>
      </div>

      <div class="fcard">
        <div class="fcard-jam" id="exJamRow"></div>
        <div class="fcard-head">
          <span>Etapa</span><span>Volumen</span><span>Del total</span><span>Avanza</span><span>Costo c/u</span>
        </div>
        ${rows}
      </div>`;

    document.querySelectorAll('#exFunnel [data-go]').forEach(el=>{
      el.onclick = ()=> { const n = document.querySelector(`.nav-item[data-view="${el.dataset.go}"]`); if(n) n.click(); };
    });
    const jamName = STEPS[worst+1] ? STEPS[worst+1].t.toLowerCase() : '';
    const jamEl = document.getElementById('exJamRow');
    if(jamEl) jamEl.innerHTML =
      `<span class="jr-tag">Cuello de botella</span>
       <span class="jr-t"><b>${STEPS[worst+1].t}</b> · solo avanza ${Math.min(...rates)}% desde ${STEPS[worst].t.toLowerCase()}</span>
       <span class="jr-go">lo trabaja ${STEPS[worst+1].own} ›</span>`;
  }

  /* mapa o embudo, uno a la vez */
  document.getElementById('exMode').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#exMode button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    const map = b.dataset.m === 'map';
    document.querySelector('#v-executive .graph-wrap').hidden = !map;
    document.getElementById('exFunnel').hidden = map;
    document.querySelector('#v-executive .view-scroll').classList.toggle('ex-scroll', map);
    document.getElementById('exTitle').textContent = map ? 'Equipo de inteligencia' : 'Funnel del negocio';
    document.querySelector('.app').classList.toggle('solo', !map);
    ['exPeriod','exCmp','exPill'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.hidden = map;
    });
  });

  document.getElementById('exPeriod').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#exPeriod button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); exP=b.dataset.p;
    document.getElementById('exCmp').textContent =
      ({'hoy':'día en curso · sin comparación','7d':'vs los 7 días previos','mes':'vs los 30 días previos'})[exP];
    render();
  });
  render();

  /* ficha de reunión de cada departamento */
  const DEPT = {
    acquisition:{t:'Acquisition', st:'warn',
      num:'312 contactos · +9% vs semana pasada',
      find:'Prospecting B baja el ICP alto de 41% a 27% con 22% más de inversión · −110 contactos útiles',
      dep:'Necesito que Conversion confirme si ese tráfico convierte peor o si es la página'},
    creative:{t:'Creative', st:'ok',
      num:'8 piezas activas · 3 sobre el promedio de agendas',
      find:'El hook nuevo subió el hook rate 4 pts pero el cierre bajó 7 · sin mejora neta',
      dep:'Recibo de Conversion la caída del VSL en 00:27 · es guión, lo asumo'},
    conversion:{t:'Conversion', st:'crit',
      num:'26% de visita a cita · sin cambio',
      find:'El formulario falla en Safari móvil desde ayer 14:20 · −64 contactos y sigue abierto',
      dep:'Entrego a Creative el drop del VSL y a Sales el 37% de citas sin calificar'},
    conversation:{t:'Conversation', st:'warn',
      num:'58% de efectividad en Lead Flow · +3 pts',
      find:'El agente de voz no reconfirma día y hora en 14 de 22 llamadas · 12 pts menos de asistencia',
      dep:'Recibo de Conversion los 31 agendados en riesgo de no-show de esta semana'},
    sales:{t:'Sales', st:'ok',
      num:'11 ventas · cierre 31%',
      find:'37% de las citas no califican y ocupan agenda del closer · el filtro está en el formulario',
      dep:'Necesito que Conversion endurezca el formulario antes de subir volumen'},
    contacts:{t:'Leads Portal', st:'ok',
      num:'312 contactos · 78 de ICP alto',
      find:'El 22% del volumen es ICP alto pero produce el 61% de las ventas',
      dep:'Entrego a Acquisition qué campañas traen el ICP que cierra'},
  };

  const tip = document.createElement('div');
  tip.className = 'dept-tip'; document.body.appendChild(tip);

  const gsvg = document.getElementById('deptGraph');
  function place(e){
    const w = 330, pad = 16;
    let x = e.clientX + 18, y = e.clientY + 14;
    if(x + w + pad > window.innerWidth) x = e.clientX - w - 18;
    if(y + tip.offsetHeight + pad > window.innerHeight) y = window.innerHeight - tip.offsetHeight - pad;
    tip.style.left = x+'px'; tip.style.top = y+'px';
  }
  gsvg.addEventListener('mousemove', e=>{
    const g = e.target.closest('[data-node]');
    if(!g){ tip.classList.remove('on'); return; }
    const d = DEPT[g.dataset.node];
    if(!d){ tip.classList.remove('on'); return; }
    if(tip.dataset.k !== g.dataset.node){
      tip.dataset.k = g.dataset.node;
      tip.innerHTML = `
        <div class="dt-h"><span class="dt-dot ${d.st}"></span>${d.t}
          <span class="dt-go">entrar ›</span></div>
        <div class="dt-r"><span>Su número</span><b>${d.num}</b></div>
        <div class="dt-r"><span>Lo que más cuesta</span><b>${d.find}</b></div>
        <div class="dt-r"><span>Con otras áreas</span><b>${d.dep}</b></div>`;
    }
    place(e);
    tip.classList.add('on');
  });
  gsvg.addEventListener('mouseleave', ()=>{ tip.classList.remove('on'); tip.dataset.k=''; });

  /* el organigrama navega */
  document.querySelectorAll('#deptGraph [data-node]').forEach(el=>{
    el.style.cursor='pointer';
    el.addEventListener('click', ()=>{
      const n = document.querySelector(`.nav-item[data-view="${el.dataset.node}"]`);
      if(n) n.click();
    });
  });
  })();
}
