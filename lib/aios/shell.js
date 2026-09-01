'use client';

/* ── POR QUÉ ESTE ARCHIVO DECLARA `'use client'` ──────────────────────────
 *
 * Siempre fue un módulo del NAVEGADOR —toca `document` en cada función— y solo lo carga
 * `bootAios()` desde `components/CommandCenter.jsx`, que es un componente de cliente. La directiva
 * no cambia nada de lo que hace: hace que esté escrito.
 *
 * Y hace falta que esté escrito por una razón concreta. `ADR-0703` prohíbe las estructuras mutables
 * en el nivel superior de un módulo del SERVIDOR, porque en funciones sin servidor las instancias se
 * reutilizan entre peticiones de organizaciones distintas. Su guard —`pruebas/codigo/70-publicacion`—
 * marcó el `Set` de oyentes de este archivo, y tenía razón en marcarlo: nada decía que esto no
 * corriera en el servidor.
 *
 * La alternativa era eximirlo por nombre en la prueba, y eso convierte el guard en una lista de
 * excepciones que crece. Así el criterio es del código: un módulo que declara `'use client'` no
 * atiende peticiones, y su estado es de una pestaña. */

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
  tools: 'Operación',
  monitoreo: 'Operación',
  auditoria: 'Operación',
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
/* ════════════════════════════════════════════════════════════════════════════
   QUÉ PANTALLA ESTÁ A LA VISTA, Y POR QUÉ HAY QUE PODER PREGUNTARLO

   El cambio de pantalla es puro DOM: se agrega y se quita la clase `on`. Es el port del prototipo y
   funciona, pero tiene una consecuencia que costó dinero medido: **React no se entera**.

   `CommandCenter` monta las diez vistas de una sola vez y `activa` es una propiedad que se calcula
   una única vez, al arrancar. Así que el reloj de 10 segundos del Closer —que dispara la ingesta
   contra GoHighLevel— se registraba **siempre**, para cualquiera que tuviera la sección Closer en su
   menú, aunque estuviera en Ajustes toda la tarde. Medido: **360 llamadas al CRM por hora y por
   empresa** por tener la aplicación abierta, sin mirar el Closer ni una vez.

   El documento `04` de la referencia lo dice así: *«corre cuando el módulo Closer está abierto»*.

   Se resuelve avisando desde el Único lugar que decide qué pantalla se abre —esta función— en vez de
   pasar la pantalla activa por propiedades desde arriba: el menú lateral no es React, y hacerlo por
   propiedades obligaría a que lo fuera.

   ── Y EL VALOR INICIAL SE LEE DEL DOM, A PROPÓSITO ─────────────────────

   La primera pantalla la marca React con su propiedad `activa`, y esta función recién corre en el
   primer clic del menú. Guardar un valor inicial acá sería tener dos verdades sobre lo mismo, y una
   quedaría vieja. El DOM ya sabe: `.view.on` es la que se está mostrando.
   ════════════════════════════════════════════════════════════════════════════ */
const oyentesDeVista = new Set();

/** La clave de la pantalla que se está mostrando, o `null` fuera del navegador. */
export function vistaActiva() {
  if (typeof document === 'undefined') return null;
  const abierta = document.querySelector('.view.on');
  return abierta?.id?.startsWith('v-') ? abierta.id.slice(2) : null;
}

/**
 * Avisar cada vez que cambia la pantalla abierta. Devuelve la función para darse de baja.
 *
 * No manda la clave por parámetro: quien escucha vuelve a preguntar con `vistaActiva()`. Así hay una
 * sola forma de saberlo y no dos que puedan discrepar.
 */
export function alCambiarDeVista(fn) {
  oyentesDeVista.add(fn);
  /* Con llaves y no `=> oyentesDeVista.delete(fn)`: el `delete` de un `Set` devuelve un booleano, y
     una función de limpieza de `useEffect` que devuelve algo distinto de `undefined` es un error de
     tipos — React interpreta cualquier retorno como OTRA función de limpieza. */
  return () => {
    oyentesDeVista.delete(fn);
  };
}

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

  /* Y se avisa, al final: cuando los oyentes preguntan `vistaActiva()`, el DOM ya cambió. Avisar
     antes haría que el primero en preguntar reciba la pantalla ANTERIOR, y el síntoma sería un reloj
     que arranca un ciclo tarde y otro que se apaga un ciclo tarde. */
  for (const fn of oyentesDeVista) fn();
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
