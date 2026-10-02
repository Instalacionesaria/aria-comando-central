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

/* `GROUP`, el grupo de la miga de pan, se fue con la miga en la etapa E10 de la nueva estructura: la
   barra lateral dice dónde estás, y la de arriba quedó sólo para el teléfono. Era una lista paralela
   a `GRUPOS_DEL_MENU`, heredada del prototipo. */

/* ════════════════════════════════════════════════════════════════════════════
   QUÉ PANTALLA ESTÁ A LA VISTA, Y POR QUÉ HAY QUE PODER PREGUNTARLO

   El cambio de pantalla es puro DOM: se agrega y se quita la clase `on`. Es el port del prototipo y
   funciona, pero tiene una consecuencia que costó dinero medido: **React no se entera**.

   `CommandCenter` monta todas sus vistas de una sola vez y `activa` es una propiedad que se calcula
   una única vez, al arrancar. Así que el reloj de 10 segundos del Closer —que dispara la ingesta
   contra GoHighLevel— se registraba **siempre**, para cualquiera que tuviera la sección Closer en su
   menú, aunque estuviera en Ajustes toda la tarde. Medido: **360 llamadas al CRM por hora y por
   empresa** por tener la aplicación abierta, sin mirar el Closer ni una vez.

   El documento `04` de la referencia lo dice así: *«corre cuando el módulo Closer está abierto»*.

   Se resuelve avisando desde el Único lugar que decide qué pantalla se abre —esta función— en vez de
   pasar la pantalla activa por propiedades desde arriba: con propiedades, `CommandCenter` volvería a
   dibujar las quince vistas en cada cambio de pantalla.

   ── Y EL VALOR INICIAL SE LEE DEL DOM, A PROPÓSITO ─────────────────────

   La primera pantalla la marca React con su propiedad `activa`, y esta función recién corre en el
   primer clic del menú. Guardar un valor inicial acá sería tener dos verdades sobre lo mismo, y una
   quedaría vieja. El DOM ya sabe: `.view.on` es la que se está mostrando.
   ════════════════════════════════════════════════════════════════════════════ */
const oyentesDeVista = new Set();

/* ── EL PEDIDO: QUÉ PESTAÑA SE PIDIÓ AL ABRIR UNA PANTALLA (`NE-19`) ───────

   Tools y Analizadores se reparten en varios departamentos, así que abrir «Research › Radar › Espía
   a tus competidores» es abrir `tools` PIDIÉNDOLE la pestaña `espia`. La pantalla no se entera por
   propiedades —sigue montada desde el arranque— sino preguntando acá, igual que pregunta qué vista
   está abierta (`lib/vista.ts`, `usarPedidoDeVista`).

   Lleva un número de secuencia, y no es un adorno: pedir dos veces la misma pestaña son dos pedidos.
   Entre uno y otro la pantalla pudo cambiar de pestaña por dentro (el «Continuar» del VSL a la
   Landing), y si el segundo se comparara por la pestaña no se aplicaría. Quien lo atiende guarda el
   último número. */
let pedido = null;
let secuencia = 0;

/** El último pedido, `{ clave, pestana, secuencia }`, o `null` si todavía no se navegó: la pantalla
 * de arranque la abre React, sin pasar por `irALaVista`. */
export function pedidoDeVista() {
  return pedido;
}

/* ── LA PESTAÑA QUE CADA PANTALLA DIBUJA (etapa E10) ───────────────────────

   El pedido dice qué pestaña se PIDIÓ; esto, cuál se VE, y no son lo mismo: Tools cambia de pestaña
   por dentro —el «Continuar» del VSL a la Landing, los chips «Hereda de»; su barra propia, hasta la
   etapa E11— y Analizadores lo hacía con su barra HT/OB, que también se fue en E11. La barra lateral
   y la cabecera del departamento marcan la entrada abierta con esto (`components/Nav.jsx`,
   `components/CabeceraDeDepartamento.jsx`), así que no mienten cuando la pestaña cambia sin pasar por
   `irALaVista`.

   Es un almacén aparte del pedido, a propósito: anunciar no sube la secuencia ni avisa a los
   oyentes de la vista, así que una pantalla que anuncia lo que dibuja no se vuelve a pedir nada a sí
   misma. Y anunciar lo mismo dos veces no avisa. */
const pestanasDibujadas = new Map();
const oyentesDePestana = new Set();

/** La pantalla `clave` dice qué pestaña dibuja. */
export function anunciarPestana(clave, pestana) {
  if (pestanasDibujadas.get(clave) === pestana) return;
  pestanasDibujadas.set(clave, pestana);
  for (const fn of oyentesDePestana) fn();
}

/** La pestaña que la pantalla `clave` dibuja, o `null` si no anunció ninguna. */
export function pestanaDibujada(clave) {
  return pestanasDibujadas.get(clave) ?? null;
}

/** Avisar cada vez que una pantalla dibuja otra pestaña. Devuelve la función para darse de baja. */
export function alCambiarDePestana(fn) {
  oyentesDePestana.add(fn);
  return () => {
    oyentesDePestana.delete(fn);
  };
}

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
 * @param {{ pestana?: string | null }} [opciones] `pestana` es la que se le pide a la pantalla, para
 *   las que se reparten en varios departamentos (`NE-19`). Ver «EL PEDIDO», más abajo.
 * @returns `false` si la pantalla NO existe en el DOM. Se devuelve en vez de tragárselo: quien
 *   llama tiene que poder distinguir «abrí la pantalla» de «no había pantalla que abrir».
 */
export function irALaVista(clave, { pestana = null } = {}) {
  const app = document.querySelector('.app');
  const destino = document.getElementById('v-' + clave);
  if (!app || !destino) return false;

  /* El pedido se guarda ANTES de avisar: cuando los oyentes preguntan, tiene que estar. Y después
     del guard: una pantalla que no existe no deja un pedido colgado para cuando aparezca. La fila
     del menú ya no se marca acá: la pinta React (`components/Nav.jsx`, con `usarUbicacion`), y
     tocarla desde los dos lados eran dos escritores sobre la misma clase. */
  secuencia += 1;
  pedido = { clave, pestana, secuencia };

  document.querySelectorAll('.view').forEach((v) => v.classList.remove('on'));
  destino.classList.add('on');

  /* El cajón del menú se cierra AL NAVEGAR, y va acá y no en el oyente del clic porque `irALaVista`
     es el único paso por el que pasan las DOS puertas: la fila del menú y el desplegable de la
     cuenta. Enganchado al clic, abrir Ajustes desde el desplegable dejaría el menú tapando la
     pantalla que se acaba de abrir. */
  cerrarElMenu();

  /* Y se avisa, al final: cuando los oyentes preguntan `vistaActiva()`, el DOM ya cambió. Avisar
     antes haría que el primero en preguntar reciba la pantalla ANTERIOR, y el síntoma sería un reloj
     que arranca un ciclo tarde y otro que se apaga un ciclo tarde. */
  for (const fn of oyentesDeVista) fn();
  return true;
}

/* ── LOS OVERLAYS DE LA MAQUETA SE FUERON ──────────────────────────────────
 *
 * Acá vivían los cierres de `#drawer` y `#recoModal` (`cerrarElCajon`, `cerrarElModal`), que estaban
 * en `components/Overlays.jsx` y los abría la maqueta del Executive. Se fueron con ella el 2026-10-01
 * (`docs/OTROS/nueva-estructura/04-EL-INICIO.md`, `NE-30`): sin nodos que cerrar, sus oyentes
 * escuchaban a la nada. Los cajones que quedan son de React y cada uno trae su velo y su `Escape`
 * (`Ventana.jsx`, `negocio/Ficha.jsx`, `leads-portal/FichaDelLead.jsx`, `creative/FichaDelCreativo.jsx`).
 * `pruebas/codigo/156-cierre-de-los-overlays.test.ts` vigila que no vuelvan. */

/* ── EL MENÚ LATERAL COMO CAJÓN, PARA ANCHOS CHICOS ────────────────────────
 *
 * Medido el 2026-09-20 a 375 px de ancho: `.app` es una rejilla de `216px 1fr`, la barra lateral no
 * colapsa, y al cuerpo le quedan **75 px**. La columna del nombre de cualquier tabla se aplasta a
 * cero y la página desborda en horizontal. No es de una pantalla —comprobado igual en Acquisition,
 * Creative y Conversion— es del armazón, o sea las doce.
 *
 * Por encima del corte esto no existe: el botón está escondido y la clase nunca se pone, así que el
 * escritorio queda exactamente como estaba. Toda la geometría vive en `app/armazon.css`; acá sólo
 * está quién la enciende y quién la apaga.
 *
 * ── POR QUÉ ACÁ Y NO EN REACT ──────────────────────────────────────────────
 *
 * Porque el cajón tiene que cerrarse AL NAVEGAR, y quien navega es `irALaVista()`, que vive en este
 * archivo y la llaman tanto los clics del menú como el desplegable de la cuenta. Un estado de React
 * en `TopBar.jsx` tendría que enterarse de eso desde afuera, y serían dos dueños de un mismo
 * estado — el defecto que tenían los overlays de la maqueta, en su versión de armazón.
 */
const MENU_ABIERTO = 'menu-abierto';

export function cerrarElMenu() {
  const app = document.querySelector('.app');
  if (!app?.classList.contains(MENU_ABIERTO)) return false;
  app.classList.remove(MENU_ABIERTO);
  const boton = document.getElementById('navAbrir');
  if (boton) {
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', 'Abrir el menú');
    /* El foco vuelve al botón que lo abrió. Sin esto, cerrar con `Escape` deja el foco dentro de un
       menú que ya no se ve y el siguiente tabulador arranca en la nada. */
    boton.focus();
  }
  return true;
}

function initMenuLateral() {
  const app = document.querySelector('.app');
  const boton = document.getElementById('navAbrir');
  const menu = document.getElementById('navPrincipal');
  if (!app || !boton || !menu) return;

  boton.addEventListener('click', () => {
    const abierto = app.classList.toggle(MENU_ABIERTO);
    boton.setAttribute('aria-expanded', String(abierto));
    /* El rótulo dice lo que el botón VA A HACER, no en qué estado está: un rótulo que nombrara el
       estado no dejaría saber si «menú abierto» es lo que hay o lo que va a pasar. */
    boton.setAttribute('aria-label', abierto ? 'Cerrar el menú' : 'Abrir el menú');
    /* A la entrada marcada si su departamento está desplegado; si no, a «Nueva conversación» o a la
       primera cabecera. No a la primera entrada a secas: con los departamentos cerrados —en el
       Inicio, por ejemplo— no hay ninguna a la vista, y el foco se quedaba afuera sin error. Ni al
       primer botón, que es la píldora de la empresa. */
    if (abierto) {
      const marcada = menu.querySelector('.nb-entradas:not([hidden]) .nav-item[aria-current="page"]');
      (marcada ?? menu.querySelector('.nb-nueva, .nb-cabecera'))?.focus?.();
    }
  });

  /* Un clic fuera cierra. El velo es un `::after` de `.app` —no hay nodo al que engancharle nada—
     así que se escucha el documento y se pregunta dónde cayó. Va en `pointerdown` y no en `click`
     para que cerrar y abrir con el mismo gesto no se pisen. */
  document.addEventListener('pointerdown', (e) => {
    if (!app.classList.contains(MENU_ABIERTO)) return;
    if (menu.contains(e.target) || boton.contains(e.target)) return;
    cerrarElMenu();
  });

  /* Y `Escape` cierra, como cualquier cosa que se abre encima de todo. Compartía oyente con los
     overlays de la maqueta; se quedó solo cuando ellos se fueron, y vive acá porque es del menú. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    cerrarElMenu();
  });
}

/* El armazón ya no ata clics a las filas del menú: desde la etapa E9 son botones de React que llaman
   a `irALaVista` (`components/Nav.jsx`). Atarlos acá, al arrancar, dejaba sin oyente a toda fila que
   React dibujara después, y el teclado no llegaba a ninguna: eran `div`. */
export function initShell() {
  initMenuLateral();
}
