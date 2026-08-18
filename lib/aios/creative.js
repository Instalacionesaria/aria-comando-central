/* Portado de aios-command-center_1.html — líneas 3488-3934 del original. */
export function initCreative() {
  (function(){

  /* ===== DATOS: la unidad es el contenido ===== */
  const ADS = [
    {id:'07', name:'Owner Hook', format:'UGC', angle:'Dolor', pain:'No consigue clientes premium', status:'active', duration:60,
     calificados:38, agendas:31, hookRate:64, retention:62, avgWatch:18, ctr:2.4, grad:'linear-gradient(150deg,#4c3f9e,#2b2560)'},
    {id:'12', name:'Founder Story', format:'Talking Head', angle:'Autoridad', pain:'No confía en agencias', status:'active', duration:62,
     calificados:31, agendas:20, hookRate:55, retention:55, avgWatch:22, ctr:2.0, grad:'linear-gradient(150deg,#1f5b8f,#12324f)'},
    {id:'15', name:'Social Proof', format:'Carrusel', angle:'Prueba social', pain:'Duda que funcione', status:'paused', duration:null,
     calificados:29, agendas:18, hookRate:null, retention:null, avgWatch:null, ctr:1.6, grad:'linear-gradient(150deg,#8f3a6b,#4d1f3c)'},
    {id:'09', name:'Results Demo', format:'B-Roll', angle:'Prueba social', pain:'Quiere ver resultados', status:'active', duration:58,
     calificados:26, agendas:17, hookRate:60, retention:58, avgWatch:20, ctr:2.1, grad:'linear-gradient(150deg,#146b5c,#0d3a33)'},
    {id:'18', name:'VSL Cold', format:'VSL', angle:'Contrarian', pain:'Cansado de fórmulas', status:'active', duration:80,
     calificados:24, agendas:15, hookRate:57, retention:65, avgWatch:34, ctr:1.7, grad:'linear-gradient(150deg,#5b3a8f,#2f1f52)'},
    {id:'02', name:'Quick Win', format:'UGC', angle:'Curiosidad', pain:'No sabe por dónde empezar', status:'active', duration:45,
     calificados:22, agendas:14, hookRate:58, retention:48, avgWatch:12, ctr:1.9, grad:'linear-gradient(150deg,#8f7a1f,#4a3f10)'},
    {id:'04', name:'Pain Point', format:'Estático', angle:'Dolor', pain:'Pierde plata en ads', status:'active', duration:null,
     calificados:15, agendas:8, hookRate:null, retention:null, avgWatch:null, ctr:1.5, grad:'linear-gradient(150deg,#9e4a2f,#4f2418)'},
    {id:'06', name:'Comparison', format:'Carrusel', angle:'Comparación', pain:'Compara opciones', status:'paused', duration:null,
     calificados:12, agendas:6, hookRate:null, retention:null, avgWatch:null, ctr:1.2, grad:'linear-gradient(150deg,#3d4657,#212832)'},
  ];

  /* clicks a la landing por momento del video: [segundo, nº de clicks] (BOF) */
  const CLICKS = {
    '07':[[5,6],[15,4],[25,3],[35,5],[45,22],[55,14]],
    '12':[[6,4],[18,3],[30,2],[42,3],[52,12],[60,9]],
    '09':[[5,5],[16,3],[27,2],[38,4],[46,15],[56,8]],
    '18':[[7,3],[22,2],[36,2],[50,3],[64,10],[76,14]],
    '02':[[4,4],[13,3],[22,2],[30,3],[38,9],[44,6]],
  };
  /* DM (MOF): [DMs recibidos, conversaciones abiertas] */
  const DM = {'07':[58,42],'12':[44,31],'15':[51,36],'09':[40,27],'18':[38,26],'02':[33,22],'04':[26,17],'06':[22,14]};
  /* ventas/cierres (BOF): [inversión, cierres] */
  const SALES = {'07':[4200,7],'12':[3100,5],'09':[2800,4],'18':[2600,3],'15':[1400,3],'02':[1600,2],'04':[1800,2],'06':[1200,1]};

  ADS.forEach(a=>{
    a.clickTimeline = CLICKS[a.id] || null;
    a.clickWeb = a.clickTimeline ? a.clickTimeline.reduce((s,b)=>s+b[1],0) : ({'15':28,'04':15,'06':11}[a.id] || 0);
    const d = DM[a.id]||[0,0];   a.dmRecibidos=d[0]; a.dm=d[1];
    const s = SALES[a.id]||[0,0]; a.spend=s[0]; a.cierres=s[1]; a.cpv = a.cierres ? a.spend/a.cierres : null;
  });

  /* interacciones (reacciones + comentarios + compartidos + guardados) */
  const IX = {'07':319,'12':249,'15':275,'09':234,'18':220,'02':189,'04':132,'06':132};
  ADS.forEach(a=> a.interacciones = IX[a.id]||0);

  /* alcance (reach): personas únicas alcanzadas */
  const REACH = {'07':41200,'12':33500,'15':39800,'09':27600,'18':24900,'02':21300,'04':16800,'06':11500};
  ADS.forEach(a=> a.alcance = REACH[a.id]||0);

  /* frecuencia: veces promedio que cada persona vio el anuncio (impresiones ÷ alcance) */
  const FREQ = {'07':2.4,'12':1.9,'15':2.1,'09':1.7,'18':2.6,'02':1.5,'04':1.4,'06':1.2};
  ADS.forEach(a=> a.frecuencia = FREQ[a.id]||0);

  /* fecha de lanzamiento (días atrás desde hoy) para el filtro de periodo */
  const AGE = {'07':3,'02':6,'12':15,'09':28,'15':45,'18':70,'04':95,'06':140};
  ADS.forEach(a=>{ a.daysAgo = AGE[a.id]??0; a.date = new Date(Date.now()-a.daysAgo*86400000); });

  /* guión / transcript por video: [segundo, texto] (solo videos) */
  const TRANSCRIPT = {
    '07':[[0,'Si tienes una agencia y no consigues clientes premium, para y escucha.'],[10,'El problema no es tu servicio. Es cómo te perciben.'],[22,'La mayoría compite por precio… y termina quemada.'],[34,'Este es el sistema con el que atraemos cuentas grandes.'],[45,'Mira los resultados reales de esta semana.'],[55,'Agenda una llamada y te muestro cómo aplicarlo a tu agencia.']],
    '12':[[0,'Hace tres años cerré mi agencia. Estaba quebrado.'],[12,'Nadie confiaba en lo que vendía, ni yo mismo.'],[24,'Entonces cambié una sola cosa en mi mensaje.'],[38,'Empecé a mostrar procesos, no promesas.'],[50,'Hoy trabajo con marcas que antes ni me respondían.'],[60,'Si quieres el mismo giro, hablemos.']],
    '09':[[0,'Esto es lo que pasó cuando aplicamos el sistema.'],[10,'Semana 1: 12 leads calificados.'],[20,'Semana 2: 4 llamadas agendadas.'],[34,'Semana 3: primer cierre de cinco cifras.'],[46,'Sin gastar más en ads. Solo mejor contenido.'],[54,'¿Quieres verlo aplicado a tu negocio?']],
    '18':[[0,'Olvídate de todo lo que te dijeron sobre embudos.'],[16,'La mayoría de las fórmulas ya no funcionan.'],[32,'Te explico por qué… y qué hacemos diferente.'],[48,'No es más volumen. Es mejor filtro.'],[64,'Este enfoque nos trae leads que sí compran.'],[76,'Dale click abajo y te muestro el método completo.']],
    '02':[[0,'¿No sabes por dónde empezar con tu contenido?'],[8,'Haz solo esto en las próximas 24 horas.'],[16,'Un video, un dolor, un llamado a la acción.'],[26,'Así de simple empezamos con la mayoría.'],[36,'Guárdalo y aplícalo hoy mismo.'],[42,'Y si quieres el plan completo, escríbeme.']],
  };

  /* ===== embudo ===== */
  const fmtN = n => {
    if(n==null) return '—';
    if(n>=1000){ const k=n/1000; return (k>=100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/,'')) + 'K'; }
    return n.toLocaleString('es-PE');
  };
  const fmtSec = s => s==null ? '—' : Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  const fmtK = n => n==null ? '—' : (n>=1000 ? '$'+(n/1000).toFixed(n%1000===0?0:1)+'K' : '$'+n);
  const fmtMoney = n => n==null ? '—' : '$'+Math.round(n).toLocaleString('en-US');

  const CRIT = {
    calificados:{label:'Calificados', stage:'TOF', unit:'calif.',  fmt:fmtN},
    dm:         {label:'DM',          stage:'MOF', unit:'DM',       fmt:fmtN},
    agendas:    {label:'Agendas',     stage:'BOF', unit:'agendas',  fmt:fmtN},
    clickWeb:   {label:'Click web',   stage:'BOF', unit:'clicks',   fmt:fmtN},
    cierres:    {label:'Cierres',     stage:'BOF', unit:'cierres',  fmt:fmtN},
    alcance:    {label:'Alcance',     stage:'TOF', unit:'reach',    fmt:fmtN},
    hookRate:   {label:'Hook rate',   stage:'TOF', unit:'hook',     fmt:v=>v==null?'—':v+'%'},
    retention:  {label:'Retención',   stage:'TOF', unit:'ret',      fmt:v=>v==null?'—':v+'%'},
  };
  /* filtro de periodo */
  let period = {preset:'hist', from:null, to:null};
  function inPeriod(a){
    if(period.preset==='custom' && period.from && period.to) return a.date>=period.from && a.date<=period.to;
    const days = ({'7d':7,'mes':30,'tri':90,'hist':Infinity})[period.preset] ?? Infinity;
    return a.daysAgo <= days;
  }
  const visible = () => ADS.filter(inPeriod);
  const fmtDate = d => d.toLocaleDateString('es-PE',{day:'2-digit',month:'short'});
  function periodLabel(){
    if(period.preset==='custom' && period.from && period.to) return `${fmtDate(period.from)} – ${fmtDate(period.to)}`;
    return ({'7d':'últimos 7 días','mes':'último mes','tri':'último trimestre','hist':'histórico'})[period.preset] || 'periodo';
  }
  const SORT = ['calificados','agendas','hookRate','retention','alcance'];   // criterios de orden
  let criterion = 'agendas';

  function fmtMetric(a, key, type){
    const v = a[key];
    if(v==null) return '—';
    if(type==='%')     return v+'%';
    if(type==='freq')  return v.toFixed(1);
    if(type==='sec')   return fmtSec(v);
    if(type==='money') return fmtMoney(v);
    return fmtN(v);
  }
  /* KPIs de la card (venta directa) */
  const PRIMARY = [
    ['Calificados','calificados'],['Agendas','agendas'],
  ];
  const SECONDARY = [
    ['Hook rate','hookRate','%'],['Retención','retention','%'],
    ['Alcance','alcance'],['Frecuencia','frecuencia','freq'],
  ];
  const DIRECTA_GRID = [   // resultado primero, señales después
    ['Calificados','calificados'],['Agendas','agendas'],['Hook rate','hookRate','%'],
    ['Retención','retention','%'],['Alcance','alcance'],['Frecuencia','frecuencia','freq'],
  ];
  const DIRECTA_FOOT = [];

  /* ===== control de orden ===== */
  function renderSort(){
    document.getElementById('sortSeg').innerHTML = SORT.map(c=>`
      <button data-c="${c}" class="${c===criterion?'on':''}">${CRIT[c].label}</button>`).join('');
    document.getElementById('sortPillVal').textContent = CRIT[criterion].label;
    document.querySelectorAll('#sortSeg button').forEach(b=>{
      b.onclick=()=>{ criterion=b.dataset.c;
        document.getElementById('sortWrap').classList.remove('open');
        renderAll(); };
    });
  }

  /* ===== resumen: 5 números del embudo ===== */
  function renderStats(){
    const shown = visible();
    const sum = c => shown.reduce((s,a)=>s+(a[c]||0),0);
    const plbl = periodLabel();
    const el = document.getElementById('statRow');
    el.classList.add('even');
    const avg = c => { const v=shown.map(a=>a[c]).filter(x=>x!=null); return v.length?Math.round(v.reduce((s,x)=>s+x,0)/v.length):0; };
    const avgF = c => { const v=shown.map(a=>a[c]).filter(x=>x!=null); return v.length?(v.reduce((s,x)=>s+x,0)/v.length):0; };
    const items = [['Calificados','calificados','sum'],['Agendas','agendas','sum'],['Hook rate','hookRate','pct'],['Retención','retention','pct'],['Alcance','alcance','sum'],['Frecuencia','frecuencia','freq']];
    el.innerHTML = items.map(([label,c,t])=>{
      let val, sub;
      let tot = 0;
      if(t==='pct'){ val=avg(c)+'%'; sub='promedio'; }
      else if(t==='freq'){ val=avgF(c).toFixed(1); sub='promedio'; }
      else { tot = sum(c); val=fmtN(tot); sub='total'; }
      const grp = (c==='calificados' || c==='agendas') && tot;
      return `<div class="cre-stat${c===criterion?' hi':''}"><div class="l">${label}</div>
        <div class="v"${grp?` data-leads="${label} · todas las piezas" data-n="${tot}"${c==='calificados'?' data-seg="alto"':''} data-sub="Creative"`:''}>${val}</div>
        <div class="s">${sub}</div></div>`;
    }).join('');
  }

  /* ===== card ===== */
  function card(a, isWin){
    const v = a[criterion];
    const scoreCls = isWin ? 'good' : 'bad';
    const status = a.status==='active' ? '<span class="cc-status act">Activo</span>' : '<span class="cc-status pau">Pausado</span>';
    const dur = a.duration ? `<span class="cc-dur">${fmtSec(a.duration)}</span>` : '';
    const play = a.duration ? '▶' : '◧';
    const score = '';
    const grid = DIRECTA_GRID.map(([label,key,type],i)=>{
      const clickable = (key==='calificados' || key==='agendas') && a[key];
      return `<div class="${i<2?'pm':''}"><div class="k">${label}</div>
        <div class="v"${clickable?` data-leads="${label} · ${a.id} ${a.name}" data-n="${a[key]}"${key==='calificados'?' data-seg="alto"':''} data-sub="Creative"`:''}>${fmtMetric(a,key,type)}</div></div>`;
    }).join('');
    return `<div class="cc ${isWin?'win':'lose'}" tabindex="0" role="button" data-cre="${a.id}">
      <div class="cc-media" style="background:${a.grad}">${score}<div class="play">${play}</div>${status}${dur}</div>
      <div class="cc-body">
        <div class="cc-name">${a.id} — ${a.name}</div>
        <div class="cc-qual"><span class="tag fmt">${a.format}</span><span class="tag ang">${a.angle}</span></div>
        <div class="cc-mx">${grid}</div>
      </div>
    </div>`;
  }

  /* ===== split funciona / no funciona ===== */
  function renderLibrary(){
    const cn = document.getElementById('critName'); if(cn) cn.textContent = CRIT[criterion].label.toLowerCase();
    const shown = visible();
    const valid = shown.map(a=>a[criterion]).filter(v=>v!=null);
    const avg = valid.reduce((s,v)=>s+v,0)/valid.length;
    const byVal = (a,b)=>(b[criterion]??-1)-(a[criterion]??-1);
    const good = shown.filter(a=>a[criterion]!=null && a[criterion]>=avg).sort(byVal);
    const bad  = shown.filter(a=>a[criterion]==null || a[criterion]<avg).sort(byVal);
    document.getElementById('goodSub').textContent = valid.length ? `sobre el promedio de ${CRIT[criterion].fmt(Math.round(avg))} ${CRIT[criterion].unit}` : 'sin datos en este periodo';
    document.getElementById('badSub').textContent = 'bajo el promedio — pausar o iterar';
    document.getElementById('goodN').textContent = good.length+' piezas';
    document.getElementById('badN').textContent  = bad.length+' piezas';
    document.getElementById('goodGrid').innerHTML = good.map(a=>card(a,true)).join('') || emptyMsg();
    document.getElementById('badGrid').innerHTML  = bad.map(a=>card(a,false)).join('') || emptyMsg();
    document.getElementById('dbInfo').innerHTML = `<b>${shown.length}</b> piezas · ${periodLabel()}`;
    bindClicks();
  }
  const emptyMsg = ()=>`<div class="dw-empty" style="grid-column:1/-1">Sin piezas en este grupo.</div>`;

  /* ===== drawer ===== */
  function retentionCurve(ad, showClick=true){
    if(ad.hookRate==null || ad.retention==null)
      return `<div class="dw-empty">Formato <b>${ad.format}</b> — sin curva de retención de video.</div>`;
    const X0=26,X1=440,yTop=18,yBot=94, y=p=>yBot-(p/100)*(yBot-yTop);
    const pts=[[0,100],[0.10,ad.hookRate],[0.25,ad.hookRate-8],[0.45,(ad.hookRate+ad.retention)/2],[0.65,ad.retention+6],[0.85,ad.retention+2],[1,ad.retention]];
    const xy=pts.map(([t,p])=>[X0+t*(X1-X0),y(Math.max(0,Math.min(100,p)))]);
    const line=xy.map((c,i)=>(i?'L':'M')+c[0].toFixed(0)+','+c[1].toFixed(0)).join(' ');
    const area=line+` L${X1},${yBot} L${X0},${yBot} Z`;
    const drops=xy.slice(1).map((c,i)=>(pts[i][1]-pts[i+1][1])>=12?{x:c[0],y:c[1]}:null).filter(Boolean);
    let clickMark='';
    if(showClick && ad.clickTimeline){
      const pk=ad.clickTimeline.reduce((m,b)=>b[1]>m[1]?b:m, ad.clickTimeline[0]);
      const cx=X0+(pk[0]/ad.duration)*(X1-X0);
      clickMark=`<line x1="${cx.toFixed(0)}" y1="14" x2="${cx.toFixed(0)}" y2="94" stroke="var(--exec)" stroke-width="1.2" stroke-dasharray="3 3" opacity=".75"/><text x="${(cx+3).toFixed(0)}" y="24" font-size="8" fill="var(--exec)">pico clicks</text>`;
    }
    return `<svg viewBox="0 0 460 120" style="width:100%;height:118px;margin-top:4px">
      <defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(139,124,246,0.28)"/><stop offset="100%" stop-color="rgba(139,124,246,0)"/></linearGradient></defs>
      <line x1="26" y1="18" x2="446" y2="18" stroke="rgba(148,197,255,.06)"/><line x1="26" y1="56" x2="446" y2="56" stroke="rgba(148,197,255,.06)"/><line x1="26" y1="94" x2="446" y2="94" stroke="rgba(148,197,255,.06)"/>
      <path d="${area}" fill="url(#cf)"/><path d="${line}" fill="none" stroke="var(--dev)" stroke-width="1.8"/>
      ${drops.map(d=>`<circle cx="${d.x.toFixed(0)}" cy="${d.y.toFixed(0)}" r="4.5" fill="rgba(240,92,92,.85)"/>`).join('')}
      ${clickMark}
      <text x="4" y="22" font-size="8" fill="var(--txt-faint)">100%</text><text x="6" y="58" font-size="8" fill="var(--txt-faint)">50%</text>
      <text x="26" y="112" font-size="8" fill="var(--txt-faint)">0s</text><text x="408" y="112" font-size="8" fill="var(--txt-faint)">${fmtSec(ad.duration)}</text>
    </svg>`;
  }
  function clicksBlock(ad){
    if(!ad.clickTimeline)
      return `<div class="dw-block"><div class="out-grid" style="grid-template-columns:1fr"><div class="out"><div class="k">Click web · total</div><div class="v" style="color:var(--exec)">${fmtN(ad.clickWeb)}</div></div></div><div class="dw-hint">Formato ${ad.format} — sin línea de tiempo (no es video).</div></div>`;
    const tl=ad.clickTimeline, total=tl.reduce((s,b)=>s+b[1],0);
    const peak=tl.reduce((m,b)=>b[1]>m[1]?b:m, tl[0]), peakShare=Math.round(peak[1]/total*100), maxN=Math.max(...tl.map(b=>b[1]));
    const X0=26,X1=440,yTop=14,yBot=92, bw=(X1-X0)/tl.length*0.55;
    const bars=tl.map(b=>{
      const cx=X0+(b[0]/ad.duration)*(X1-X0), h=Math.max(2,(b[1]/maxN)*(yBot-yTop)), isPeak=b[0]===peak[0];
      return `<rect x="${(cx-bw/2).toFixed(1)}" y="${(yBot-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${isPeak?'var(--exec)':'rgba(53,224,210,.5)'}"/><text x="${cx.toFixed(0)}" y="${(yBot-h-4).toFixed(0)}" font-size="7.5" text-anchor="middle" fill="${isPeak?'var(--exec)':'var(--txt-faint)'}">${b[1]}</text>`;
    }).join('');
    return `<div class="dw-block">
      <div class="out-grid" style="grid-template-columns:1fr 1fr 1fr">
        <div class="out"><div class="k">Click web · total</div><div class="v" style="color:var(--exec)">${fmtN(total)}</div></div>
        <div class="out"><div class="k">Momento pico</div><div class="v" style="color:var(--exec)">${fmtSec(peak[0])}</div></div>
        <div class="out"><div class="k">% en el pico</div><div class="v">${peakShare}%</div></div>
      </div>
      <svg viewBox="0 0 460 108" style="width:100%;height:104px;margin-top:12px">
        <line x1="26" y1="92" x2="446" y2="92" stroke="rgba(148,197,255,.1)"/>${bars}
        <text x="26" y="104" font-size="8" fill="var(--txt-faint)">0s</text><text x="408" y="104" font-size="8" fill="var(--txt-faint)">${fmtSec(ad.duration)}</text>
      </svg>
      <div class="dw-hint">Cada barra = clicks a la web en ese momento del video. En dorado, el pico.</div>
    </div>`;
  }
  function dropSeconds(ad){
    if(ad.hookRate==null || ad.retention==null || !ad.duration) return [];
    const pts=[[0,100],[0.10,ad.hookRate],[0.25,ad.hookRate-8],[0.45,(ad.hookRate+ad.retention)/2],[0.65,ad.retention+6],[0.85,ad.retention+2],[1,ad.retention]];
    const out=[];
    for(let i=1;i<pts.length;i++){ if(pts[i-1][1]-pts[i][1]>=12) out.push(Math.round(pts[i][0]*ad.duration)); }
    return out;
  }
  function transcriptBlock(ad){
    const tr = TRANSCRIPT[ad.id];
    if(!tr) return `<div class="dw-empty">Formato <b>${ad.format}</b> — sin guión (no es video).</div>`;
    const drops = dropSeconds(ad);
    const win = Math.max(4, ad.duration*0.10);
    const lines = tr.map(([t,text])=>{
      const isDrop = drops.some(d=>Math.abs(d-t)<=win);
      return `<div class="tr-line${isDrop?' drop':''}">
        <span class="tr-t">${fmtSec(t)}</span>
        <span class="tr-x">${text}</span>
        ${isDrop?'<span class="tr-flag">↓ retención</span>':''}
      </div>`;
    }).join('');
    return `<div class="dw-block"><div class="tr-list">${lines}</div>
      <div class="dw-hint">Las líneas marcadas coinciden con caídas de atención — revisa qué se dice ahí para ajustarlo, o replícalo si el video funcionó.</div></div>`;
  }
  function openCre(id){
    const ad=ADS.find(a=>a.id===id); if(!ad) return;
    const valid=ADS.map(a=>a[criterion]).filter(v=>v!=null), avg=valid.reduce((s,v)=>s+v,0)/valid.length;
    const isWin = ad[criterion]!=null && ad[criterion]>=avg;
    document.getElementById('dwTitle').textContent = `${ad.id} — ${ad.name}`;
    document.getElementById('dwMeta').textContent = `${ad.status==='active'?'Activo':'Pausado'} · ${ad.format}${ad.duration?' · '+fmtSec(ad.duration):''}`;
    document.getElementById('dwVerdict').innerHTML = isWin
      ? `<span class="dw-verdict good">✓ Funciona · ${CRIT[criterion].fmt(ad[criterion])} ${CRIT[criterion].unit}</span>`
      : `<span class="dw-verdict bad">✕ Bajo en ${CRIT[criterion].label.toLowerCase()} · ${CRIT[criterion].fmt(ad[criterion])}</span>`;
    document.getElementById('dwBody').innerHTML = `
      <div class="qe"><div class="dw-sec-t">Qué es</div>
        <div class="qe-grid">
          <div class="qb"><i>Formato</i><b>${ad.format}</b></div>
          <div class="qb"><i>Ángulo</i><b>${ad.angle}</b></div>
          <div class="qb"><i>Estado</i><b>${ad.status==='active'?'Activo':'Pausado'}</b></div>
          <div class="qb"><i>Duración</i><b>${ad.duration?fmtSec(ad.duration):'—'}</b></div>
          <div class="qb"><i>Publicado</i><b>${fmtDate(ad.date)}</b></div>
          <div class="qb"><i>Pieza</i><b>${ad.id}</b></div>
          <div class="qb wide"><i>Dolor que ataca</i><b>${ad.pain}</b></div>
        </div>
      </div>

      <div><div class="dw-sec-t">Datos del video <span class="r">venta directa</span></div>
        <div class="dw-block out-grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="out hi"><div class="k">Calificados</div><div class="v">${fmtN(ad.calificados)}</div></div>
          <div class="out hi"><div class="k">Agendas</div><div class="v">${fmtN(ad.agendas)}</div></div>
          <div class="out"><div class="k">Hook rate</div><div class="v">${ad.hookRate==null?'—':ad.hookRate+'%'}</div></div>
          <div class="out"><div class="k">Retención</div><div class="v">${ad.retention==null?'—':ad.retention+'%'}</div></div>
          <div class="out"><div class="k">Alcance</div><div class="v">${fmtN(ad.alcance)}</div></div>
          <div class="out"><div class="k">Frecuencia</div><div class="v">${ad.frecuencia.toFixed(1)}</div></div>
        </div>
      </div>

      <div><div class="dw-sec-t">Retención del video</div>
        <div class="dw-block">
          <div class="dw-video" style="background:${ad.grad}"><div class="play">${ad.duration?'▶':'◧'}</div>
            <div class="dw-scrub"><div class="track"></div><span class="t">0:00 / ${ad.duration?fmtSec(ad.duration):'—'}</span></div></div>
          ${retentionCurve(ad, false)}
          ${ad.duration?`<div class="dw-hint">Puntos rojos: caídas de atención.</div>`:''}
        </div></div>

      <div><div class="dw-sec-t">Guión del video <span class="r">dónde se cae la retención</span></div>
        ${transcriptBlock(ad)}</div>`;
    document.getElementById('scrim').classList.add('on');
    document.getElementById('drawer').classList.add('on');
    document.getElementById('drawer').setAttribute('aria-hidden','false');
  }
  function closeCre(){
    document.getElementById('scrim').classList.remove('on');
    document.getElementById('drawer').classList.remove('on');
    document.getElementById('drawer').setAttribute('aria-hidden','true');
  }
  function bindClicks(){
    document.querySelectorAll('[data-cre]').forEach(el=>{
      el.onclick=()=>openCre(el.dataset.cre);
      el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openCre(el.dataset.cre);} };
    });
  }

  function renderReco(){
    const c = criterion, L = CRIT[c];
    const round = n => Math.round(n);
    const POOL = visible();
    document.getElementById('recoSub').textContent =
      `Venta directa · por ${L.label.toLowerCase()} · ${periodLabel()}`;
    if(POOL.length===0){
      document.getElementById('recoBody').innerHTML = `<div class="dw-empty">No hay contenido en este periodo. Amplía el rango de fechas para ver recomendaciones.</div>`;
      document.getElementById('recoScrim').classList.add('on');
      document.getElementById('recoModal').classList.add('on');
      document.getElementById('recoModal').setAttribute('aria-hidden','false');
      return;
    }
    const vals = POOL.map(a=>a[c]).filter(v=>v!=null);
    const avg = vals.reduce((s,v)=>s+v,0)/vals.length;
    const winners = POOL.filter(a=>a[c]!=null && a[c]>=avg).sort((a,b)=>b[c]-a[c]);
    const losers  = POOL.filter(a=>a[c]==null || a[c]<avg);
    const groupAvg = key => {
      const m={}; POOL.forEach(a=>{ if(a[c]==null) return; (m[a[key]]=m[a[key]]||[]).push(a[c]); });
      return Object.entries(m).map(([k,arr])=>({k,avg:arr.reduce((s,v)=>s+v,0)/arr.length,n:arr.length})).sort((x,y)=>y.avg-x.avg);
    };
    const fmts = groupAvg('format'), angs = groupAvg('angle');
    const bestF=fmts[0], worstF=fmts[fmts.length-1], bestA=angs[0], worstA=angs[angs.length-1];
    const topAd=winners[0], worstAd=[...POOL].filter(a=>a[c]!=null).sort((a,b)=>a[c]-b[c])[0];
    const rAvg = arr => { const v=arr.map(a=>a.retention).filter(x=>x!=null); return v.length?round(v.reduce((s,x)=>s+x,0)/v.length):null; };
    const dAvg = arr => { const v=arr.map(a=>a.duration).filter(x=>x!=null); return v.length?round(v.reduce((s,x)=>s+x,0)/v.length):null; };
    const wRet=rAvg(winners), lRet=rAvg(losers), wDur=dAvg(winners);
    const peak = topAd && topAd.clickTimeline ? topAd.clickTimeline.reduce((m,b)=>b[1]>m[1]?b:m,topAd.clickTimeline[0])[0] : null;
    const otherPain = (POOL.find(a=>a!==topAd && a.pain)||{}).pain || 'otro dolor de tu cliente';

    const item = (cls,txt)=>`<div class="reco-item ${cls}"><span class="ic">${cls==='good'?'✅':cls==='bad'?'⚠️':'💡'}</span><span>${txt}</span></div>`;

    const concl = [
      `El ${L.label.toLowerCase()} promedio por pieza es <b>${L.fmt(round(avg))}</b>. <b>${winners.length}</b> piezas están por encima y <b>${losers.length}</b> por debajo.`,
      `Formato más efectivo: <b>${bestF.k}</b> (${L.fmt(round(bestF.avg))} prom). El más bajo: <b>${worstF.k}</b>.`,
      `Ángulo con mejor desempeño: <b>${bestA.k}</b>; el más flojo: <b>${worstA.k}</b>.`,
    ];
    if(wRet!=null && lRet!=null) concl.push(`Tus ganadores retienen <b>${wRet}%</b> del video vs <b>${lRet}%</b> los de bajo desempeño.`);

    const good = [
      `Produce más <b>${bestF.k}</b> con ángulo <b>${bestA.k}</b> — es tu combinación más rentable en ${L.label.toLowerCase()}.`,
      topAd ? `Replica el gancho de <b>${topAd.id} — ${topAd.name}</b> (tu #1 con ${L.fmt(topAd[c])}).` : '',
      wDur ? `Apunta a videos de ~<b>${wDur}s</b>, que es la duración de tus ganadores.` : '',
    ].filter(Boolean);

    const bad = [
      `Reformula o pausa el formato <b>${worstF.k}</b> y el ángulo <b>${worstA.k}</b>: rinden bajo el promedio.`,
      worstAd ? `Revisa <b>${worstAd.id} — ${worstAd.name}</b> (el más bajo)${worstAd.hookRate!=null?`; su gancho arranca en ${worstAd.hookRate}% de hook — prueba abrir con el dolor en los primeros 3s.`:'.'}` : '',
      lRet!=null ? `En los videos flojos la atención cae a ${lRet}%. Acorta la intro y ve directo al dolor.` : '',
    ].filter(Boolean);

    const ideas = [
      `Un <b>${bestF.k}</b> con ángulo <b>${bestA.k}</b> atacando el dolor "${topAd?topAd.pain:''}".`,
      topAd ? `Variante de ${topAd.name}: mismo gancho, nuevo dolor — "${otherPain}".` : '',
      (topAd && peak!=null) ? `Toma el mejor momento de ${topAd.name} (~${fmtSec(peak)}) y conviértelo en un short independiente.` : `Prueba el formato ${bestF.k} en una duración más corta para subir el hook rate.`,
    ].filter(Boolean);

    document.getElementById('recoBody').innerHTML = `
      <div class="reco-group">
        <h4>Lo que dice la data</h4>
        ${concl.map(t=>item('',t)).join('')}
      </div>
      <div class="reco-group good">
        <h4>Haz más de esto</h4>
        ${good.map(t=>item('good',t)).join('')}
      </div>
      <div class="reco-group bad">
        <h4>Ajusta o pausa esto</h4>
        ${bad.map(t=>item('bad',t)).join('')}
      </div>
      <div class="reco-group idea">
        <h4>Ideas para producir</h4>
        ${ideas.map(t=>item('idea',t)).join('')}
      </div>`;
    document.getElementById('recoScrim').classList.add('on');
    document.getElementById('recoModal').classList.add('on');
    document.getElementById('recoModal').setAttribute('aria-hidden','false');
  }
  function closeReco(){
    document.getElementById('recoScrim').classList.remove('on');
    document.getElementById('recoModal').classList.remove('on');
    document.getElementById('recoModal').setAttribute('aria-hidden','true');
  }

  function renderAll(){
    renderSort(); renderStats(); renderLibrary();
  }
  const sortWrap = document.getElementById('sortWrap');
  document.getElementById('sortPill').addEventListener('click', e=>{
    e.stopPropagation();
    sortWrap.classList.toggle('open');
  });
  document.addEventListener('click', e=>{ if(!sortWrap.contains(e.target)) sortWrap.classList.remove('open'); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') sortWrap.classList.remove('open'); });

  document.getElementById('dateSeg').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#dateSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    const pill = document.getElementById('crePill');
    if(pill){ pill.classList.remove('active'); pill.querySelector('.pv').textContent = 'Personalizado'; }
    period={preset:b.dataset.p, from:null, to:null}; renderAll();
  });

  document.getElementById('recoBtn').addEventListener('click', renderReco);document.getElementById('recoClose').addEventListener('click', closeReco);
  document.getElementById('recoScrim').addEventListener('click', closeReco);
  document.getElementById('scrim').addEventListener('click', closeCre);
  document.getElementById('dwClose').addEventListener('click', closeCre);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeCre(); closeReco(); } });
  renderAll();

  })();
}
