/* Portado de aios-command-center_1.html — líneas 6598-6683 del original. */
export function initLeadsGroup() {

  /* ===================== GRUPO DE CONTACTOS ===================== */
  window.AIOSLeads = (function(){
  const panel = document.getElementById('lgPanel');
  const scrim = document.getElementById('lgScrim');
  const GHL = 'https://app.gohighlevel.com/';

  const SEG = v => v >= 75 ? 'alto' : v >= 50 ? 'medio' : 'bajo';
  const money = n => '$'+n.toLocaleString('en-US');

  /* muestra representativa mientras no haya datos reales */
  const POOL = [
    ['María López',87,'Campaign 04 · Creative 12','Vendido',4500],
    ['Pablo Herrera',91,'Prospecting B · Creative 07','Vendido',9600],
    ['Carlos Méndez',82,'Prospecting B · Creative 07','Asistió',0],
    ['Grupo Meridian',85,'Campaign 04 · Creative 12','Agendado',0],
    ['Diego Paredes',79,'Retargeting · Creative 12','Vendido',6000],
    ['TechNova',79,'Prospecting B · Creative 07','Asistió',0],
    ['Daniela Soto',74,'Campaign 04 · Creative 09','Agendado',0],
    ['Karla Núñez',65,'Campaign 04 · Creative 09','Calificado',0],
    ['Rodrigo Vega',62,'Prospecting A · Creative 07','Agendado',0],
    ['Lucía Fernández',58,'Campaign 04 · Creative 12','Calificado',0],
    ['Andrea Salas',54,'Prospecting B · Creative 03','Calificado',0],
    ['Iván Torres',48,'Prospecting A · Creative 07','Sin cita',0],
    ['Estudio Vera',34,'Instagram · orgánico','Perdido',0],
    ['Marcos Ruiz',41,'Prospecting B · Creative 03','Sin cita',0],
  ];

  function sample(n, seg){
    let base = POOL.filter(p => !seg || SEG(p[1]) === seg);
    if(!base.length) base = POOL;
    const out = [];
    for(let i=0; i<Math.min(n, 40); i++) out.push(base[i % base.length]);
    return out;
  }

  function open(opts){
    const list = sample(opts.n, opts.seg);
    document.getElementById('lgTitle').textContent = opts.title;
    document.getElementById('lgSub').textContent = opts.sub || '';
    document.getElementById('lgCount').textContent =
      list.length < opts.n ? `mostrando ${list.length} de ${opts.n}` : `${opts.n} contactos`;
    document.getElementById('lgBody').innerHTML = list.map(([n, icp, src, st, rev])=>`
      <div class="lg-r">
        <span class="lg-sc ${SEG(icp)}">${icp}</span>
        <div><div class="lg-n">${n}</div><div class="lg-m">${src} · ${st}</div></div>
        <span class="lg-side">
          ${rev ? `<span class="lg-money">${money(rev)}</span>` : ''}
          <span class="lg-ghl" title="Abrir en GHL">↗</span>
        </span>
      </div>`).join('');
    document.querySelectorAll('#lgBody .lg-ghl').forEach(b=>{
      b.onclick = e => { e.stopPropagation(); window.open(GHL, '_blank'); };
    });
    document.querySelectorAll('#lgBody .lg-r').forEach(r=>{
      r.onclick = ()=> { if(window.AIOSLeadCard) window.AIOSLeadCard(r.querySelector('.lg-n').textContent); };
    });
    document.getElementById('lgOpen').textContent = `Ver los ${opts.n} en Leads Portal →`;
    document.getElementById('lgOpen').onclick = ()=>{
      close();
      const nav = document.querySelector('.nav-item[data-view="contacts"]');
      if(nav) nav.click();
      if(opts.seg){
        const b = document.querySelector(`#lpIcpSeg [data-i="${opts.seg}"]`);
        if(b) b.click();
      }
    };
    panel.classList.add('on'); scrim.classList.add('on');
  }
  function close(){ panel.classList.remove('on'); scrim.classList.remove('on'); }

  document.getElementById('lgClose').onclick = close;
  scrim.onclick = close;
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') close(); });

  /* cualquier cifra con data-leads abre su grupo */
  document.addEventListener('click', e=>{
    const el = e.target.closest('[data-leads]');
    if(!el) return;
    e.stopPropagation();
    open({ n: +el.dataset.n || 0, seg: el.dataset.seg || null,
           title: el.dataset.leads, sub: el.dataset.sub || '' });
  });

  return { open, close };
  })();
}
