/* Portado de aios-command-center_1.html — líneas 5673-5731 del original. */
export function initPeriodControls() {
  /* ===== controles de periodo estandarizados ===== */
  (function(){
    /* píldora de rango personalizado, mismo comportamiento en todas las secciones */
    document.querySelectorAll('.pill-wrap').forEach(function(w){
      const btn = w.querySelector('.pill');
      if(!btn) return;
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        const open = w.classList.contains('open');
        document.querySelectorAll('.pill-wrap').forEach(x=>x.classList.remove('open'));
        w.classList.toggle('open', !open);
      });
      const apply = w.querySelector('.db-apply');
      if(apply) apply.addEventListener('click', function(){
        const ins = w.querySelectorAll('input[type=date]');
        if(!ins[0].value || !ins[1].value) return;
        const f = new Date(ins[0].value+'T00:00:00'), t = new Date(ins[1].value+'T23:59:59');
        if(f > t) return;
        const fmt = d => d.toLocaleDateString('es-PE',{day:'2-digit',month:'short'});
        w.querySelector('.pv').textContent = fmt(f)+' – '+fmt(t);
        w.classList.add('active'); w.classList.remove('open');
        const seg = w.parentElement.querySelector('.db-seg');
        if(seg) seg.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
      });
    });
    document.addEventListener('click', function(e){
      document.querySelectorAll('.pill-wrap').forEach(w=>{ if(!w.contains(e.target)) w.classList.remove('open'); });
    });

    /* Acquisition ya tenía su propio panel de rango: el botón lo despliega */
    const acqBtn = document.getElementById('acqCustomBtn');
    if(acqBtn) acqBtn.addEventListener('click', function(){
      const r = document.getElementById('acqRange');
      r.classList.toggle('off');
      acqBtn.classList.toggle('active', !r.classList.contains('off'));
    });

    /* plan de acción de Leads Portal */
    const lpPlan = document.getElementById('lpPlanBtn');
    if(lpPlan) lpPlan.addEventListener('click', function(){
      document.getElementById('recoSub').textContent = 'Leads Portal · calidad de la base';
      document.getElementById('recoBody').innerHTML = `
        <div class="reco-group">
          <h4>Lo que dice la data</h4>
          <div class="reco-item">El <b>ICP alto</b> es el 22% del volumen pero produce el 61% de las ventas.</div>
          <div class="reco-item">Los contactos que vieron más del 60% del VSL califican <b>4 de cada 5</b> veces.</div>
        </div>
        <div class="reco-group good">
          <h4>Haz más de esto</h4>
          <div class="reco-item good">Prioriza el contacto inmediato con ICP sobre 80: son los que cierran.</div>
        </div>
        <div class="reco-group idea">
          <h4>Para otras áreas</h4>
          <div class="reco-item idea">Qué campañas traen ICP alto se decide en <b>Acquisition</b>.</div>
        </div>`;
      document.getElementById('recoScrim').classList.add('on');
      document.getElementById('recoModal').classList.add('on');
    });
  })();
}
