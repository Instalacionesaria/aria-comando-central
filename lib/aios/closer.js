/* Portado de aios-command-center_1.html — líneas 6290-6475 del original. */
export function initCloser() {

  /* ===================== CLOSER ===================== */
  (function(){
  const money = n => '$'+n.toLocaleString('en-US');

  const CL = {
    mes:'agosto', cash:0, ventas:0, tasa:0, llamadas:20, agendadas:24,
    show:95, showN:20, showT:21, acuerdos:0,
    hist:[['Abr',9800,1],['May',14200,1],['Jun',11600,1],['Jul',24800,0],['Ago',0,0]],
  };

  const AGENDA = [
    {h:'11:00', n:'Luzma Carbajal',        st:'venc', now:1, v:1},
    {h:'12:00', n:'Marcos Gabriel Juarez', st:'venc', v:1},
    {h:'13:00', n:'Rodrigo Wayar Cruz',    st:'venc', v:1},
    {h:'14:00', n:'Andres Rendon'},
    {h:'15:00', n:'Richie Brizuela'},
    {h:'17:00', n:'Irma Perez'},
  ];

  const URGENTES = [
    {n:'Quiroz Prueba', tag:'No le interesa · no es el momento',
     d:'<b>Falla detectada por IA:</b> el contacto pidió tres veces el precio y la garantía sin respuesta clara.'},
  ];

  const BUZON = [
    {n:'Andres Rendon',    q:'El bot llama y cuelga, creo que hay un error'},
    {n:'Angelica Moncada', q:'Nos encanta el proyecto pero ese fue nuestro freno por ahora'},
    {n:'Claudia del Aguila', q:'Buenas'},
    {n:'Francisco Padilla', q:'Confirmar'},
    {n:'Guillermo Martinez', q:'Confirmar'},
    {n:'Irma Perez',        q:'bueno'},
    {n:'Isidro Ramirez',    q:'Confirmar'},
  ];

  const SEGUI = [{n:'Moises Ruiz Test', d:'vencido hace 2 días'}];
  const HECHAS = [{n:'David Silva', tag:'Nurture · se enfrió', d:'Registró Nurture — se enfrió'}];

  const acts = '<i title="Video">▢</i><i title="Agenda">▤</i><i title="Llamar">✆</i><i title="Bot">◈</i><i title="Recordar">◷</i><i title="Cobrar">$</i>';

  /* ---------- inicio ---------- */
  function inicio(){
    const max = Math.max(...CL.hist.map(h=>h[1]));
    document.getElementById('clInicio').innerHTML = `
      <div class="ck-hero">
        <div>
          <span class="ck-tag">◈ Cash collected · ${CL.mes}</span>
          <div class="ck-cash">${money(CL.cash)}</div>
          <div class="ck-note"><span class="pt"></span>Cobrado real, no prometido
            <em>· sin ventas registradas aún en ${CL.mes}</em></div>
          <div class="ck-row">
            <div class="ck-i"><div class="k">Ventas</div><div class="v">${CL.ventas}</div>
              <div class="s">tasa ${CL.tasa}% · ${CL.ventas} de ${CL.llamadas}</div></div>
            <div class="ck-i"><div class="k">Acuerdos</div><div class="v">—</div>
              <div class="s">sin acuerdos este mes</div></div>
            <div class="ck-i"><div class="k">Llamadas</div><div class="v">${CL.llamadas}</div>
              <div class="s">de ${CL.agendadas} agendadas</div></div>
            <div class="ck-i"><div class="k">Show rate</div><div class="v">${CL.show}%</div>
              <div class="s">${CL.showN} de ${CL.showT}</div></div>
          </div>
        </div>
        <div class="ck-ring">
          <div class="ring"><div><b>—</b><span>SIN % CARGADO</span></div></div>
          <div class="ck-cta">Carga tu % de comisión en <b>Ajustes › Operación</b></div>
        </div>
      </div>

      <div class="cl-tasks">
        <span class="clt-ic">◈</span>
        <div>
          <div class="clt-t">27 tareas pendientes</div>
          <div class="clt-m"><span class="u"><b>1</b> urgente</span>
            <span class="w"><b>25</b> en espera</span>
            <span><b>1</b> seguimiento hoy</span></div>
        </div>
        <button class="cl-run" id="clRun">Ejecutar Mi Día →</button>
      </div>

      <div class="card">
        <div class="card-head">Histórico de ingresos
          <span class="hint">julio es real · abril a junio son referencia</span></div>
        <div class="card-body">
          <div class="hb">
            ${CL.hist.map(([m,v,ref])=>`
              <div class="hb-c">
                <div class="hb-v">${v?money(v):'—'}</div>
                <div class="hb-b"><i class="${ref?'ref':''}" style="height:${max?v/max*100:0}%"></i></div>
                <div class="hb-m">${m}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
    document.getElementById('clRun').onclick = ()=> document.querySelector('#clNav [data-c="dia"]').click();
  }

  /* ---------- mi día ---------- */
  function dia(){
    const row = (o) => `
      <div class="md-r ${o.done?'md-done':''}">
        <span class="md-time">${o.h || ''}</span>
        <div>
          <div class="md-nm">${o.n}
            ${o.st==='venc'?'<span class="tagx venc">Vencida</span>':''}
            ${o.tag?`<span class="tagx ${o.tagc||'nu'}">${o.tag}</span>`:''}</div>
          ${o.d?`<div class="md-sub">${o.d}</div>`:''}
          ${o.q?`<div class="md-quote">“${o.q}”</div>`:''}
        </div>
        <div class="md-acts">${o.now?'<button class="md-join">Unirse</button>':''}${acts}</div>
      </div>`;

    document.getElementById('clDia').innerHTML = `
      <div class="md-top">
        <div class="md-c">
          <div><div class="md-k">Llamadas hoy</div><div class="md-v">6</div></div>
          <div class="md-s">próxima a las <b>11:00</b></div>
        </div>
        <div class="md-c">
          <div><div class="md-k">Tareas de hoy</div><div class="md-v">27</div></div>
          <div class="md-s"><span class="md-chip u">1 urgente</span><span class="md-chip o">0 completadas</span></div>
        </div>
      </div>

      <div class="md-counters">
        <div class="md-cn"><span class="ic" style="background:rgba(240,92,92,.12);color:var(--crit)">!</span>
          <span class="l">Intervención urgente</span><span class="n" style="color:var(--crit)">1</span></div>
        <div class="md-cn"><span class="ic" style="background:rgba(53,224,210,.10);color:var(--accent)">◔</span>
          <span class="l">Respondieron · buzón general</span><span class="n" style="color:var(--accent)">25</span></div>
        <div class="md-cn"><span class="ic" style="background:rgba(240,136,76,.12);color:var(--warn)">↻</span>
          <span class="l">Seguimientos hoy</span><span class="n" style="color:var(--warn)">1</span></div>
      </div>

      <div class="md-sec">
        <div class="md-h">Agenda de hoy <span class="b">6</span></div>
        ${AGENDA.map(row).join('')}
      </div>

      <div class="md-sec crit">
        <div class="md-h">Intervenciones urgentes <span class="b">1</span></div>
        ${URGENTES.map(u=> row({n:u.n, tag:u.tag, tagc:'no', d:u.d})).join('')}
      </div>

      <div class="md-sec">
        <div class="md-h">Respondieron · buzón general <span class="b">25</span></div>
        ${BUZON.map(b=> row({n:b.n, tag:'Agendado', tagc:'ag', q:b.q})).join('')}
      </div>

      <div class="md-sec warn">
        <div class="md-h">Seguimientos de hoy <span class="b">1</span></div>
        ${SEGUI.map(x=> row({n:x.n, tag:'Seguimiento', tagc:'seg',
          d:`<span style="color:var(--crit)">${x.d}</span>`})).join('')}
      </div>

      <div class="md-sec done">
        <div class="md-h">Completadas hoy <span class="b">1</span></div>
        ${HECHAS.map(x=> row({n:x.n, tag:x.tag, tagc:'nu', d:x.d, done:1})).join('')}
      </div>`;
  }

  function stub(el, t, d, items){
    document.getElementById(el).innerHTML = `
      <div class="card"><div class="card-body empty">
        <div class="e-ic">◍</div><div class="e-t">${t}</div><div class="e-d">${d}</div>
        <ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>
      </div></div>`;
  }
  stub('clPipeline','Pipeline','Las oportunidades abiertas del closer, por etapa.',
    ['Etapas con monto y antigüedad','Arrastrar entre etapas','Motivo de pérdida al cerrar']);
  stub('clAgenda','Agenda','La vista de calendario con las citas de la semana.',
    ['Semana y mes','Bloques de disponibilidad','Reprogramar desde la misma vista']);

  const TIT = {inicio:['Tu cockpit','Closer · Jorge Veramendi'],
    dia:['Mi Día','jueves, 13 de agosto'], pipeline:['Pipeline','Oportunidades abiertas'],
    agenda:['Agenda','Tus citas de la semana']};
  document.getElementById('clNav').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#clNav button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    ['inicio','dia','pipeline','agenda'].forEach(k=>{
      document.getElementById('cl'+k[0].toUpperCase()+k.slice(1)).hidden = (k !== b.dataset.c);
    });
    document.getElementById('clTitle').textContent = TIT[b.dataset.c][0];
    document.getElementById('clDesc').textContent = TIT[b.dataset.c][1];
  });

  inicio(); dia();
  })();
}
