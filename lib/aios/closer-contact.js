/* Portado de aios-command-center_1.html — líneas 6477-6596 del original. */
export function initCloserContact() {

  /* los callbacks del calendario los registra cada sección al cargar */


  /* ===================== CONTACTO DEL CLOSER ===================== */
  (function(){
  const CHAT = [
    ['out','Listo Andres, tu consultoría quedó agendada para el 13 de agosto a las 14:00 ✅\n\nDale clic en Confirmar para asegurar tu llamada.','07:25'],
    ['out','Te confirmo tu llamada para el jueves 13 de agosto, 14:00.\nEnlace de la reunión: meet.google.com/ydz-phvm-agh','07:26'],
    ['in','El bot llama y cuelga, creo que hay un error','09:12'],
    ['out','Gracias por avisar, Andres. Lo reviso y te confirmo por aquí.','09:14'],
  ];

  const TABS = {
    chat: ()=> `<div class="cw-day">Hoy</div>` + CHAT.map(([d,t,h])=>
      `<div class="msgw ${d}">${t}<span class="t">${h}</span></div>`).join(''),
    llamada: ()=> `
      <div class="dw-sec-t">Llamadas</div>
      <div class="kv-box" style="margin-top:9px">
        <div class="kv"><span>Intentos</span><b>1</b></div>
        <div class="kv"><span>Última</span><b>hoy 09:05 · 42 s</b></div>
        <div class="kv"><span>Resultado</span><b>No contestó</b></div>
        <div class="kv"><span>Próxima acción</span><b>Llamar antes de las 13:00</b></div>
      </div>`,
    perfil: ()=> `
      <div class="dw-sec-t">Perfil</div>
      <div class="kv-box" style="margin-top:9px">
        <div class="kv"><span>Empresa</span><b>Rendon Media</b></div>
        <div class="kv"><span>Facturación</span><b>$8K–15K / mes</b></div>
        <div class="kv"><span>Origen</span><b>Directo · landing</b></div>
        <div class="kv"><span>Calificación</span><b>72 · medio</b></div>
        <div class="kv"><span>VSL visto</span><b>64%</b></div>
      </div>`,
    historial: ()=> `
      <div class="dw-sec-t">Historial</div>
      <div class="dw-block">
        ${[['Agendó la cita','hoy 07:25'],['Confirmó por WhatsApp','hoy 07:31'],
           ['Llamada sin respuesta','hoy 09:05'],['Reportó falla del bot','hoy 09:12']]
          .map(([t,w])=>`<div class="ld-time"><span class="ld-dot ok"></span>
            <div><div class="ld-t">${t}</div></div><span class="ld-when">${w}</span></div>`).join('')}
      </div>`,
    notas: ()=> `
      <div class="dw-sec-t">Notas</div>
      <div class="pr-box" style="margin-top:9px">Pidió que la llamada sea después de las 14:00.
        Trabaja con dos socios; el que decide es él.</div>`,
  };

  const OPTS = [
    {k:'venta',   cls:'win',   ic:'✓', bg:'rgba(74,222,128,.12);color:var(--ok)',
     t:'Venta', d:'Pago total · mueve a Ganado'},
    {k:'acuerdo', cls:'money', ic:'$', bg:'rgba(232,182,76,.12);color:var(--exec)',
     t:'Acordó comprar, falta pago', d:'Dejó seña · falta el resto'},
    {k:'segui',   cls:'next',  ic:'▤', bg:'rgba(53,224,210,.10);color:var(--accent)',
     t:'Seguimiento', d:'Pactar fecha · entra a tu cola'},
    {k:'nointer', cls:'lost',  ic:'✕', bg:'rgba(240,92,92,.12);color:var(--crit)',
     t:'No le interesa', d:'Mueve a Descalificado · registra la objeción'},
    {k:'noshow',  cls:'lost',  ic:'⃠', bg:'rgba(240,136,76,.12);color:var(--warn)',
     t:'No-show', d:'Mueve a No-show · dispara recuperación'},
    {k:'nurture', cls:'next',  ic:'❃', bg:'rgba(148,197,255,.08);color:var(--txt-dim)',
     t:'Nurture', d:'No es ahora · pasa a maduración'},
  ];

  const panel = document.getElementById('cwPanel');
  const scrim = document.getElementById('cwScrim');
  const res   = document.getElementById('resModal');
  const resScrim = document.getElementById('resScrim');

  function paint(tab){ document.getElementById('cwBody').innerHTML = TABS[tab](); }
  function openContact(name, phone, state){
    document.getElementById('cwName').textContent = name;
    document.getElementById('cwPhone').textContent = phone || '+51 987 654 321';
    document.getElementById('cwState').textContent = state || 'Agendado';
    document.getElementById('cwAv').textContent =
      name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    document.querySelectorAll('#cwTabs button').forEach((b,i)=> b.classList.toggle('on', i===0));
    paint('chat');
    panel.classList.add('on'); scrim.classList.add('on');
  }
  function closeContact(){ panel.classList.remove('on'); scrim.classList.remove('on'); }

  document.getElementById('cwTabs').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#cwTabs button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); paint(b.dataset.t);
  });
  document.getElementById('cwClose').onclick = closeContact;
  scrim.onclick = closeContact;

  document.getElementById('resOpts').innerHTML = OPTS.map(o=>`
    <button class="res-o ${o.cls}" data-r="${o.k}">
      <span class="ic" style="background:${o.bg}">${o.ic}</span>
      <span><b>${o.t}</b><span>${o.d}</span></span>
    </button>`).join('');

  function openRes(){ res.classList.add('on'); resScrim.classList.add('on'); }
  function closeRes(){ res.classList.remove('on'); resScrim.classList.remove('on'); }
  document.getElementById('cwAdvance').onclick = openRes;
  document.getElementById('resClose').onclick = closeRes;
  resScrim.onclick = closeRes;
  document.querySelectorAll('#resOpts [data-r]').forEach(b=>{
    b.onclick = ()=>{
      const o = OPTS.find(x=>x.k===b.dataset.r);
      document.getElementById('cwState').textContent = o.t;
      closeRes();
    };
  });
  document.addEventListener('keydown', e=>{
    if(e.key !== 'Escape') return;
    if(res.classList.contains('on')) closeRes();
    else if(panel.classList.contains('on')) closeContact();
  });

  /* cualquier fila de Mi Día abre el contacto */
  document.addEventListener('click', e=>{
    const r = e.target.closest('#clDia .md-r');
    if(!r || e.target.closest('.md-join')) return;
    const n = r.querySelector('.md-nm');
    openContact(n ? n.textContent.trim().split('\n')[0] : 'Contacto');
  });
  })();
}
