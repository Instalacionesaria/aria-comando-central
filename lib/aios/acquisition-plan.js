/* Portado de aios-command-center_1.html — líneas 5642-5671 del original. */
export function initAcquisitionPlan() {

  /* plan de acción de Acquisition */
  document.getElementById('acqPlanBtn').addEventListener('click', function(){
    document.getElementById('recoSub').textContent = 'Acquisition · tres funnels · periodo seleccionado';
    document.getElementById('recoBody').innerHTML = `
      <div class="reco-group">
        <h4>Lo que dice la data</h4>
        <div class="reco-item">El <b>retargeting</b> produce los calificados más baratos y con mayor afinidad ICP, pero es el funnel con menos volumen.</div>
        <div class="reco-item"><b>Prospecting B</b> trae contactos baratos con afinidad ICP de 43%, la mitad que el retargeting.</div>
        <div class="reco-item">El salto más caro de los tres funnels está entre <b>formulario y landing VSL</b> en Booking directo.</div>
      </div>
      <div class="reco-group bad">
        <h4>Ajusta o pausa esto</h4>
        <div class="reco-item bad">Deja de escalar Prospecting B por costo por contacto: su costo por calificado es el más alto.</div>
        <div class="reco-item bad">Revisa el paso de formulario a landing en Booking directo antes de subir inversión ahí.</div>
      </div>
      <div class="reco-group good">
        <h4>Haz más de esto</h4>
        <div class="reco-item good">Sube el presupuesto de retargeting mientras el costo por calificado se mantenga bajo $110.</div>
        <div class="reco-item good">Replica la segmentación de Prospecting A en los otros dos funnels.</div>
      </div>
      <div class="reco-group idea">
        <h4>Para otras áreas</h4>
        <div class="reco-item idea">La fuga de formulario a landing pertenece a <b>Conversion</b>.</div>
        <div class="reco-item idea">La afinidad ICP de cada campaña se cruza en <b>Leads Portal</b>.</div>
      </div>`;
    document.getElementById('recoScrim').classList.add('on');
    document.getElementById('recoModal').classList.add('on');
  });

}
