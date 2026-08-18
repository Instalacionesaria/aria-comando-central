/* Portado de aios-command-center_1.html — líneas 5147-5235 del original. */
export function initExecutivePanel() {

  /* ===== panel ejecutivo: reunión, cambios y objetivo ===== */
  (function(){
  const MEET = [
    {sev:'crit', t:'El hook nuevo está costando ventas',
     sub:'cadena · Creative → Conversion → Sales',
     d:'Creative cambió el gancho el día 3. Conversion registra la retención del VSL cayendo 18 puntos el día 4. Sales cierra 7 puntos menos desde el día 8.',
     ev:[['Creative','creative'],['Conversion','conversion'],['Sales','sales']],
     ask:'Decidir si se revierte el hook o se ajusta el guión del VSL para sostenerlo.'},
    {sev:'warn', t:'Acquisition y Conversion se contradicen en Prospecting B',
     sub:'contradicción · 2 áreas',
     d:'Acquisition lo escala porque trae el contacto más barato del mes, a $19. Conversion muestra que ese tráfico convierte tres veces peor que el resto. Ambas métricas son correctas.',
     ev:[['Acquisition','acquisition'],['Conversion','conversion']],
     ask:'Definir si el costo por contacto o el costo por cita calificada manda en las decisiones de escala.'},
    {sev:'warn', t:'Móvil concentra el 78% de la pérdida',
     sub:'patrón · Conversion',
     d:'Cuatro de las cinco fugas de Conversion ocurren solo en móvil. La conversión es 19% contra 42% en escritorio. No son problemas distintos, es un layout vertical sin resolver.',
     ev:[['Conversion','conversion']],
     ask:'Priorizar el rediseño móvil por encima de los ajustes individuales.'},
  ];

  const CHANGES = [
    {sev:'ok',   t:'Formulario de 11 a 8 campos', when:'hace 12 días',
     d:'La completación subió de 61% a 73% y se mantiene estable tres semanas. Se da por bueno.',
     ev:[['Conversion','conversion']], ask:'Cerrado · sin acción pendiente.'},
    {sev:'crit', t:'Hook nuevo en Prospecting B', when:'hace 9 días',
     d:'El hook rate subió 4 puntos pero el cierre bajó 7. Sin mejora neta y con costo en ventas.',
     ev:[['Creative','creative'],['Sales','sales']], ask:'Revertir o ajustar esta semana.'},
    {sev:'info', t:'Video de bienvenida en la página de gracias', when:'hace 5 días',
     d:'Solo 54% le da play. Todavía no hay volumen suficiente para concluir si mueve la asistencia.',
     ev:[['Conversion','conversion'],['Conversation','conversation']], ask:'Esperar una semana más de datos.'},
  ];

  const item = (x, i, list) => `
    <div class="b-item" data-feed="${list}" data-i="${i}">
      <div class="b-bar ${x.sev}"></div>
      <div class="b-c">
        <div class="t">${x.t}</div>
        <div class="m">${x.sub || x.when}</div>
      </div>
      <span class="b-go">›</span>
    </div>`;

  document.getElementById('exBrief').innerHTML = MEET.map((x,i)=>item(x,i,'meet')).join('');
  document.getElementById('exChanges').innerHTML = CHANGES.map((x,i)=>item(x,i,'chg')).join('');

  function open(x){
    document.getElementById('dwTitle').textContent = x.t;
    document.getElementById('dwMeta').textContent = x.sub || x.when;
    document.getElementById('dwVerdict').innerHTML = '';
    document.getElementById('dwBody').innerHTML = `
      <div><div class="dw-sec-t">Qué pasó</div>
        <div class="dw-block"><p class="ex-p">${x.d}</p></div></div>
      <div><div class="dw-sec-t">Qué hay que decidir</div>
        <div class="dw-block"><p class="ex-p">${x.ask}</p></div></div>
      <div><div class="dw-sec-t">Dónde está la evidencia</div>
        <div class="dw-block">${x.ev.map(([n,v])=>
          `<div class="rec" data-jump="${v}"><div><div class="rt">${n}</div>
            <div class="rm">abrir la sección con el detalle</div></div><div class="rp">Ir ▸</div></div>`).join('')}
        </div></div>`;
    document.querySelectorAll('#dwBody [data-jump]').forEach(el=>{
      el.onclick = ()=>{ document.getElementById('dwClose').click();
        const n = document.querySelector(`.nav-item[data-view="${el.dataset.jump}"]`); if(n) n.click(); };
    });
    document.getElementById('scrim').classList.add('on');
    document.getElementById('drawer').classList.add('on');
  }
  document.querySelectorAll('[data-feed]').forEach(el=>{
    el.onclick = ()=> open((el.dataset.feed==='meet' ? MEET : CHANGES)[+el.dataset.i]);
  });
  document.getElementById('exHistory').onclick = ()=>{
    document.getElementById('dwTitle').textContent = 'Reuniones anteriores';
    document.getElementById('dwMeta').textContent = 'una síntesis por día · últimos 7';
    document.getElementById('dwVerdict').innerHTML = '';
    const dias = [['Hoy','3 temas · 1 cadena, 1 contradicción, 1 patrón'],
      ['Ayer','2 temas · el formulario de Safari entró como incidencia'],
      ['Lunes','4 temas · se aprobó revertir el hook si no mejora'],
      ['Domingo','1 tema · sin actividad comercial'],
      ['Sábado','2 temas · caída de tráfico móvil detectada'],
      ['Viernes','3 temas · primera alerta de retención del VSL'],
      ['Jueves','2 temas · formulario de 8 campos confirmado']];
    document.getElementById('dwBody').innerHTML = `<div><div class="dw-block">
      ${dias.map(([d,t])=>`<div class="rec"><div><div class="rt">${d}</div>
        <div class="rm">${t}</div></div><div class="rp">Ver ▸</div></div>`).join('')}
    </div></div>`;
    document.getElementById('scrim').classList.add('on');
    document.getElementById('drawer').classList.add('on');
  };
  })();
}
