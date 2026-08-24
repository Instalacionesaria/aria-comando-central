/* Portado de aios-command-center_1.html — líneas 3456-3486 del original. */
export function initShell() {

  // menú de usuario
  const userWrap = document.getElementById('userWrap');
  document.getElementById('userBtn').addEventListener('click', e=>{
    e.stopPropagation();
    userWrap.classList.toggle('open');
  });
  document.addEventListener('click', e=>{ if(!userWrap.contains(e.target)) userWrap.classList.remove('open'); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') userWrap.classList.remove('open'); });

  // navegación entre vistas
  const app = document.querySelector('.app');
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.view;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('on'));
      item.classList.add('on');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
      document.getElementById('v-' + id).classList.add('on');
      app.classList.toggle('solo', id !== 'executive');
      const GROUP = {executive:'AIOS', contacts:'AIOS', icp:'AIOS',
        acquisition:'Inteligencia', creative:'Inteligencia', conversion:'Inteligencia',
        conversation:'Inteligencia', sales:'Inteligencia',
        setter:'Operación', closer:'Operación',
        credenciales:'Pie'};
      document.querySelector('.crumb span').textContent = GROUP[id] || '';
      document.getElementById('crumbNow').textContent = item.querySelector('.n').textContent.trim();
      /* el disparador del chat ya refleja la sección activa */
    });
  });


}
