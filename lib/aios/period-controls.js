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
      /* ── EL BOTÓN `.db-apply` NO EXISTE, Y HACE RATO ─────────────────────
         Acá había quince líneas que leían dos `input[type=date]`, validaban el orden y escribían el
         rótulo de la píldora. Medido el 2026-09-19: **ninguna vista emite `.db-apply`** —ni las tres
         que dibujan «Personalizado» (`ContactsView`, `ConversionView`, `ExecutiveView`), que usan
         `.pill[data-datepick]` y lo resuelve `datepicker.js`—. Las únicas apariciones del selector
         estaban en los artefactos de `.next/`, o sea en el build de este mismo archivo.

         El `if(apply)` lo venía apagando desde siempre, así que borrarlo no cambia nada de lo que
         pasa hoy. Lo que cambia es lo que alguien cree al leerlo: quince líneas con la lógica
         completa de un rango personalizado se leen como la función viva de este módulo, y mandan a
         buscar por qué «no anda» algo que nunca estuvo conectado.

         Lo que SÍ está vivo acá arriba es el abrir y cerrar de `.pill-wrap`. Eso se queda. */
    });
    document.addEventListener('click', function(e){
      document.querySelectorAll('.pill-wrap').forEach(w=>{ if(!w.contains(e.target)) w.classList.remove('open'); });
    });

    /* ── EL PANEL DE RANGO DE ACQUISITION SE FUE CON SU MAQUETA ──────────────
       Este bloque buscaba `acqCustomBtn`, que **no existía en ninguna vista** —el botón se llamaba
       `acqPill`—, así que su guarda lo venía apagando desde siempre. Y lo que tocaba adentro,
       `acqRange`, se fue con el rediseño de la pantalla: el período de Acquisition es ahora el
       cerrado de `lib/negocio/periodo.ts`, igual que el de Conversation.
       Queda anotado en vez de borrado en silencio porque un `if(x)` que nunca es verdadero se lee
       como una rama defensiva y no como código muerto. */

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
