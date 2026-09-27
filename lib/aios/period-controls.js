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

    /* El «Plan de acción» de Leads Portal SALIÓ el 2026-09-26. Eran cuatro frases escritas a mano
       y ninguna se sostenía: con cero ventas registradas, «produce el 61 % de las ventas» no se puede
       calcular, y «el ICP alto es el 22 % del volumen», medido, da 18 %. Era el último que abría
       `#recoModal`, que queda en el marcado sin quién lo abra
       (docs/leads-portal/07-EL-PLAN-DE-ACCION.md). */
  })();
}
