/* Portado de aios-command-center_1.html — líneas 3456-3486 del original. */

/* El menú de usuario se fue de acá en la Etapa 11, y sacarlo NO era opcional.
   Estas líneas hacían `document.getElementById('userBtn').addEventListener(...)`, y ese
   elemento ya no existe: la llamada lanzaba sobre `null` ANTES de llegar a la navegación de
   abajo, así que el menú lateral entero dejaba de responder. `bootAios` atrapa el error por
   módulo, así que no se veía nada en pantalla — solo un menú que no anda.
   Ahora el desplegable es React y maneja su propio estado, incluidos el clic afuera y la
   tecla de escape: `components/MenuDeUsuario.jsx`. */

/* El grupo que muestra la miga de pan. El nombre queda en ingles como en el prototipo: la
   prueba que lo cruza con `secciones.ts` lo busca por `const GROUP = {`. Es una lista PARALELA a `GRUPOS_DEL_MENU` de
   `lib/autorizacion/secciones.ts`, heredada del prototipo, y por eso `credenciales` dice
   `'Pie'` — que es la clave interna del grupo, no un nombre para leer. Se deja igual acá para
   no cambiar de paso texto que nadie pidió cambiar; unificarla con los grupos de verdad es
   trabajo aparte. */
const GROUP = {
  executive: 'AIOS',
  contacts: 'AIOS',
  icp: 'AIOS',
  acquisition: 'Inteligencia',
  creative: 'Inteligencia',
  conversion: 'Inteligencia',
  conversation: 'Inteligencia',
  sales: 'Inteligencia',
  setter: 'Operación',
  closer: 'Operación',
  credenciales: 'Pie',
};

/**
 * Abrir una pantalla. **Es el único lugar que decide qué significa eso.**
 *
 * ── POR QUÉ ES UNA FUNCIÓN EXPORTADA Y NO UN MANEJADOR ─────────────────────
 *
 * Antes esto vivía dentro del `addEventListener` de cada `.nav-item`, así que la única forma de
 * abrir una pantalla desde otro control era **simular el clic** de la fila del menú:
 * `document.querySelector('.nav-item[data-view="…"]')?.click()`. Eso funcionaba mientras la fila
 * existiera, y ataba el enrutado a que un elemento decorativo siguiera dibujado.
 *
 * Cuando Ajustes dejó de tener fila propia —se llega desde el menú de la cuenta— el
 * `querySelector` pasó a devolver `null`, el `?.` se lo tragaba y **el botón dejaba de hacer
 * nada, en silencio**. El mismo modo de falla que esta etapa vino a sacar: un control que se
 * puede apretar y no cumple.
 *
 * @param clave el `data-view` de la pantalla.
 * @param nombre el texto para la miga de pan. Las filas del menú lo leen de su propio DOM; los
 *   controles que no tienen fila lo pasan desde los datos de la sección.
 * @returns `false` si la pantalla NO existe en el DOM. Se devuelve en vez de tragárselo: quien
 *   llama tiene que poder distinguir «abrí la pantalla» de «no había pantalla que abrir».
 */
export function irALaVista(clave, nombre) {
  const app = document.querySelector('.app');
  const destino = document.getElementById('v-' + clave);
  if (!app || !destino) return false;

  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('on'));
  /* Puede no haber fila que marcar —Ajustes es el caso— y eso está bien: no hay ninguna entrada
     del menú lateral que corresponda a la pantalla abierta, así que ninguna se ilumina. */
  document.querySelector(`.nav-item[data-view="${clave}"]`)?.classList.add('on');

  document.querySelectorAll('.view').forEach((v) => v.classList.remove('on'));
  destino.classList.add('on');
  app.classList.toggle('solo', clave !== 'executive');

  const grupo = document.querySelector('.crumb span');
  if (grupo) grupo.textContent = GROUP[clave] || '';
  const ahora = document.getElementById('crumbNow');
  if (ahora) ahora.textContent = nombre ?? '';
  return true;
}

export function initShell() {
  // navegación entre vistas
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', () => {
      /* El nombre sale del DOM de la propia fila, igual que antes. Así el `.nav-item` no
         necesita atributos nuevos y el árbol sigue siendo el del prototipo, que es lo que
         `npm run paridad` compara. */
      irALaVista(item.dataset.view, item.querySelector('.n')?.textContent.trim());
      /* el disparador del chat ya refleja la sección activa */
    });
  });
}
