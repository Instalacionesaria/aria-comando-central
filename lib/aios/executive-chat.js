/* Portado de aios-command-center_1.html — líneas 5237-5340 del original. */
export function initExecutiveChat() {

  /* ===================== CHAT CON EXECUTIVE ===================== */
  (function(){
  const NAMES = {executive:'Executive', acquisition:'Acquisition', creative:'Creative',
    conversion:'Conversion', conversation:'Conversation', sales:'Sales',
    contacts:'Leads Portal', icp:'ICP & Oferta', setter:'Setter', closer:'Closer'};

  const SUGG = {
    executive:['¿Qué está frenando el crecimiento?','¿Llegamos a las 30 ventas?','¿Dónde está el dinero que se pierde?'],
    acquisition:['¿Qué campaña escalo?','¿Cuál trae el ICP que cierra?','¿Hay fatiga en algún anuncio?'],
    creative:['¿Qué ángulo replico?','¿Por qué cayó la retención?','¿Qué pieza pauso?'],
    conversion:['¿Por qué móvil convierte peor?','¿Qué arreglo primero?','¿Cuánto recupero si arreglo el formulario?'],
    conversation:['¿Qué agente necesita ajuste?','¿Por qué bajó la asistencia?','¿Qué dicen los leads que no agendan?'],
    sales:['¿Por qué perdemos las llamadas?','¿Qué objeción se repite?','¿Qué closer necesita apoyo?'],
    contacts:['¿Quiénes son mis mejores leads?','¿Qué perfil compra más?','¿A quién debería llamar hoy?'],
    icp:['¿Mi ICP sigue siendo correcto?','¿Qué dolor aparece más en las llamadas?'],
    setter:['¿A quién contacto primero?','¿Qué leads llevan más de 48h?'],
    closer:['¿Cómo voy este mes?','¿Qué citas tienen riesgo de no-show?'],
  };

  const ANSWERS = {
    default:{t:'Con los datos del periodo, lo que más pesa es el paso de <b>visitas landing a agendamientos</b>: solo avanza 29% y se pierden 1,007 personas. Traducido a dinero, son cerca de <b>$15,000</b> en revenue potencial. El 78% de esa pérdida ocurre en móvil.',
      src:[['Conversion','conversion'],['Leads Portal','contacts']]},
    crecimiento:{t:'Tres cosas, en orden de impacto. Primero el <b>cuello de agendamientos</b>, que cuesta unas 6 ventas al mes. Segundo, el <b>hook nuevo de Prospecting B</b>: subió el hook rate pero bajó el cierre 7 puntos. Tercero, el <b>37% de citas no calificadas</b> que ocupan agenda del closer sin posibilidad real.',
      src:[['Conversion','conversion'],['Creative','creative'],['Sales','sales']]},
    meta:{t:'Vas <b>11 de 30</b> con 18 días por delante. Al ritmo actual cierras en <b>22</b>. Para llegar necesitas 19 ventas más, o sea 1.05 diarias contra las 0.61 de ahora. Resolver la brecha de móvil aportaría unas 6 y el cuello del formulario otras 4: con esas dos llegas a 32.',
      src:[['Conversion','conversion'],['Sales','sales']]},
    movil:{t:'En móvil conviertes <b>19%</b> y en escritorio <b>42%</b>. Cuatro de las cinco fugas ocurren solo en móvil: el CTA queda bajo el pliegue para el 41%, el bloque de precio recibe clicks y no responde, el reproductor del VSL se ve cortado y la página tarda 4.1 segundos en cargar. No son problemas separados, es un layout que no se diseñó vertical.',
      src:[['Conversion','conversion']]},
  };

  const panel = document.getElementById('askPanel');
  const scrim = document.getElementById('askScrim');
  const body  = document.getElementById('askBody');
  const input = document.getElementById('askInput');

  function currentView(){
    const on = document.querySelector('.nav-item.on');
    return on ? on.dataset.view : 'executive';
  }
  function refreshScope(){
    const v = currentView(), n = NAMES[v] || 'Executive';
    document.getElementById('askScope').textContent = n;
    document.getElementById('askCtx').textContent = n;
    const per = document.querySelector('#exPeriod button.on, #cvDateSeg button.on, .db-seg button.on');
    document.getElementById('askCtxP').textContent = per ? per.textContent.trim() : 'periodo actual';
    document.getElementById('askChips').innerHTML =
      (SUGG[v] || SUGG.executive).map(q=>`<button class="ap-chip">${q}</button>`).join('');
    document.querySelectorAll('#askChips .ap-chip').forEach(b=>{
      b.onclick = ()=> send(b.textContent);
    });
  }
  function openAsk(){
    refreshScope();
    panel.classList.add('on'); scrim.classList.add('on');
    panel.setAttribute('aria-hidden','false');
    setTimeout(()=> input.focus(), 60);
  }
  function closeAsk(){
    panel.classList.remove('on'); scrim.classList.remove('on');
    panel.setAttribute('aria-hidden','true');
  }
  function pick(q){
    const t = q.toLowerCase();
    if(t.includes('crecimiento') || t.includes('frenando')) return ANSWERS.crecimiento;
    if(t.includes('30 ventas') || t.includes('meta') || t.includes('objetivo') || t.includes('mes')) return ANSWERS.meta;
    if(t.includes('móvil') || t.includes('movil')) return ANSWERS.movil;
    return ANSWERS.default;
  }
  function send(q){
    if(!q.trim()) return;
    const empty = body.querySelector('.ap-empty'); if(empty) empty.remove();
    body.insertAdjacentHTML('beforeend',
      `<div class="msg me"><div class="bubble">${q}</div></div>
       <div class="msg pend"><div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div></div>`);
    body.scrollTop = body.scrollHeight;
    input.value = '';
    setTimeout(()=>{
      const a = pick(q);
      const pend = body.querySelector('.msg.pend');
      pend.classList.remove('pend');
      pend.innerHTML = `<div class="bubble">${a.t}
        <div class="msg-src">${a.src.map(([n,v])=>`<span class="src-chip" data-go="${v}">${n} ›</span>`).join('')}</div>
      </div>`;
      pend.querySelectorAll('[data-go]').forEach(el=>{
        el.onclick = ()=>{ closeAsk();
          const n = document.querySelector(`.nav-item[data-view="${el.dataset.go}"]`); if(n) n.click(); };
      });
      body.scrollTop = body.scrollHeight;
    }, 700);
  }

  document.getElementById('askTrigger').onclick = openAsk;
  document.getElementById('askClose').onclick = closeAsk;
  scrim.onclick = closeAsk;
  document.getElementById('askSend').onclick = ()=> send(input.value);
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') send(input.value); });
  document.addEventListener('keydown', e=>{
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openAsk(); }
    if(e.key==='Escape') closeAsk();
  });
  document.querySelectorAll('.nav-item[data-view]').forEach(n=>
    n.addEventListener('click', ()=> { document.getElementById('askScope').textContent = NAMES[n.dataset.view] || 'Executive'; }));
  })();
}
