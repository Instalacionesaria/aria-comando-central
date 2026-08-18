/* Portado de aios-command-center_1.html — líneas 3322-3453 del original. */
export function initDatePicker() {

  /* ===================== SELECTOR DE FECHAS ===================== */
  window.AIOSDate = (function(){
  const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const DOW = ['L','M','X','J','V','S','D'];
  const fmt = d => d.toLocaleDateString('es-PE',{day:'2-digit', month:'short'});
  const iso = d => d.toISOString().slice(0,10);

  const el = document.createElement('div');
  el.className = 'dp';
  document.body.appendChild(el);

  let cur = new Date(), from = null, to = null, target = null, onApply = null;

  const QUICK = [
    ['Hoy',            ()=>[new Date(), new Date()]],
    ['Ayer',           ()=>{const d=new Date(); d.setDate(d.getDate()-1); return [d,d];}],
    ['Últimos 7 días', ()=>{const b=new Date(), a=new Date(); a.setDate(a.getDate()-6); return [a,b];}],
    ['Últimos 30 días',()=>{const b=new Date(), a=new Date(); a.setDate(a.getDate()-29); return [a,b];}],
    ['Este mes',       ()=>{const b=new Date(); return [new Date(b.getFullYear(),b.getMonth(),1), b];}],
    ['Mes pasado',     ()=>{const n=new Date(); return [new Date(n.getFullYear(),n.getMonth()-1,1),
                                                         new Date(n.getFullYear(),n.getMonth(),0)];}],
    ['Últimos 90 días',()=>{const b=new Date(), a=new Date(); a.setDate(a.getDate()-89); return [a,b];}],
  ];

  function sameDay(a,b){ return a && b && iso(a)===iso(b); }
  function between(d,a,b){ return a && b && d > a && d < b; }

  function draw(){
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7;          /* lunes primero */
    const days = new Date(y, m+1, 0).getDate();
    const hoy = new Date();

    let cells = '';
    for(let i=0;i<start;i++) cells += '<button class="dp-d" disabled></button>';
    for(let d=1; d<=days; d++){
      const date = new Date(y, m, d);
      const fut  = date > hoy;
      const isA  = sameDay(date, from), isB = sameDay(date, to);
      const mid  = between(date, from, to);
      const cls  = [ 'dp-d',
        mid ? 'in' : '',
        (isA || isB) ? 'edge' : '',
        (isA && isB) ? 'only' : (isA ? 'a' : (isB ? 'b' : ''))
      ].filter(Boolean).join(' ');
      cells += `<button class="${cls}" data-d="${iso(date)}"${fut?' disabled':''}>${d}</button>`;
    }

    el.innerHTML = `
      <div class="dp-side">
        ${QUICK.map((q,i)=>`<button data-q="${i}">${q[0]}</button>`).join('')}
        <div class="sep"></div>
        <button class="hist" data-hist="1">Histórico completo</button>
      </div>
      <div class="dp-main">
        <div class="dp-h">
          <span class="dp-mn">${MES[m]} ${y}</span>
          <span class="dp-nav"><button data-mv="-1">‹</button><button data-mv="1">›</button></span>
        </div>
        <div class="dp-grid">${DOW.map(d=>`<div class="dp-dow">${d}</div>`).join('')}${cells}</div>
        <div class="dp-f">
          <span class="dp-range">${from ? `<b>${fmt(from)}</b>${to && !sameDay(from,to) ? ' – <b>'+fmt(to)+'</b>' : ''}`
            : 'Elige una fecha de inicio'}</span>
          <button class="cancel" data-x="1">Cancelar</button>
          <button class="go" data-go="1"${from&&to?'':' disabled'}>Aplicar</button>
        </div>
      </div>`;
  }

  function place(btn){
    const r = btn.getBoundingClientRect();
    const w = 560, pad = 14;
    let x = Math.min(r.right - w, window.innerWidth - w - pad);
    el.style.left = Math.max(pad, x) + 'px';
    el.style.top  = Math.min(r.bottom + 8, window.innerHeight - 380) + 'px';
  }

  function open(btn, cb){
    target = btn; onApply = cb; from = to = null; cur = new Date();
    draw(); place(btn); el.classList.add('on');
  }
  function close(){ el.classList.remove('on'); target = null; }

  el.addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    e.stopPropagation();   /* redibujar no debe leerse como clic fuera */
    if(b.dataset.mv){ cur = new Date(cur.getFullYear(), cur.getMonth() + (+b.dataset.mv), 1); draw(); return; }
    if(b.dataset.q !== undefined){ const [a,z] = QUICK[+b.dataset.q][1](); from=a; to=z; cur=new Date(z); draw(); return; }
    if(b.dataset.hist){ apply('hist'); return; }
    if(b.dataset.x){ close(); return; }
    if(b.dataset.go){ apply('custom'); return; }
    if(b.dataset.d){
      const d = new Date(b.dataset.d + 'T12:00:00');
      if(!from || (from && to)){ from = d; to = null; }
      else if(d < from){ to = from; from = d; }
      else { to = d; }
      draw();
    }
  });
  document.addEventListener('click', e=>{
    if(!el.contains(e.target) && target && !target.contains(e.target)) close();
  });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') close(); });

  function apply(kind){
    const label = kind === 'hist' ? 'Histórico'
      : (sameDay(from,to) ? fmt(from) : `${fmt(from)} – ${fmt(to)}`);
    if(target){
      const pv = target.querySelector('.pv');
      if(pv) pv.textContent = label;
      target.classList.toggle('active', true);
      const seg = target.closest('.ch-period, .filterbar, .ex-ctrl, .acq-bar');
      if(seg) seg.querySelectorAll('.db-seg button').forEach(x=>x.classList.remove('on'));
    }
    if(onApply) onApply(kind, from, to, label);
    close();
  }

  /* cualquier píldora con data-datepick abre el calendario */
  document.addEventListener('click', e=>{
    const b = e.target.closest('[data-datepick]');
    if(!b) return;
    e.stopPropagation();
    if(target === b){ close(); return; }
    const cb = window.AIOSDate._cbs[b.dataset.datepick];
    open(b, cb);
  });

  return { open, close, _cbs:{} };
  })();
}
