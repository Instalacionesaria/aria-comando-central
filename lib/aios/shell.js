/* Portado de aios-command-center_1.html — líneas 3456-3486 del original. */
export function initShell() {

  /* El menú de usuario se fue de acá en la Etapa 11, y sacarlo NO era opcional.
     Estas líneas hacían `document.getElementById('userBtn').addEventListener(...)`, y ese
     elemento ya no existe: la llamada lanzaba sobre `null` ANTES de llegar a la navegación de
     abajo, así que el menú lateral entero dejaba de responder. `bootAios` atrapa el error por
     módulo, así que no se veía nada en pantalla — solo un menú que no anda.
     Ahora el desplegable es React y maneja su propio estado, incluidos el clic afuera y la
     tecla de escape: `components/MenuDeUsuario.jsx`. */

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
