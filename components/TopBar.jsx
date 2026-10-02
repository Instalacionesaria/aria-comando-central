/* Portado de aios-command-center_1.html — barra superior, líneas 2482-2512. */

/**
 * La barra de arriba, que desde la etapa E10 de la nueva estructura sólo existe en el teléfono: el
 * conmutador del cajón y la marca. En la computadora la barra lateral dice dónde estás, como en el
 * lienzo, que no tiene barra arriba.
 *
 * ── LA MIGA DE PAN SE FUE ───────────────────────────────────────────────────
 *
 * Decía el grupo y el nombre de la pantalla, y tuvo su historia: venía escrita a mano del prototipo
 * («AIOS / Executive») y a alguien restringido a Closer le nombraba una pantalla que no podía ver.
 * La barra lateral nueva marca la entrada abierta y su departamento, así que la miga repetía lo
 * mismo, más chico. Se fue con `GROUP` (`lib/aios/shell.js`).
 */
export default function TopBar() {
  return (
    <>
    <header className="topbar">
      {/* ── EL CONMUTADOR DEL MENÚ, Y SÓLO EXISTE PARA ANCHOS CHICOS ──────────
          *
          * Medido el 2026-09-20 a 375 px: `.app` es una rejilla de `216px 1fr`, la barra lateral no
          * colapsa, y al cuerpo le quedan **75 px**. No es de una pantalla: comprobado igual en
          * Acquisition, Creative y Conversion, o sea las doce.
          *
          * El botón está SIEMPRE en el marcado y lo esconde la hoja por encima del corte. Dibujarlo
          * condicionalmente desde React necesitaría saber el ancho en el servidor —no se sabe— y el
          * primer pintado saldría con el botón de más o de menos.
          *
          * Lo cablea `lib/aios/shell.js`, que es quien navega (`irALaVista`) y quien cierra
          * lo que se abre encima. Un manejador de React acá tendría que coordinarse con él para
          * cerrar el cajón al navegar, y serían dos dueños de un mismo estado. */}
      <button
        type="button"
        className="nav-abrir"
        id="navAbrir"
        aria-label="Abrir el menú"
        aria-controls="navPrincipal"
        aria-expanded="false"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </button>
      {/* La marca es el archivo de la marca, nunca escrita con una fuente (`NE-11`). Antes era una
          «A» sobre un cuadrado de acento y la palabra «AIOS», escritas a mano. */}
      <div className="tb-brand">
        <img className="tb-logo" src="/brand/assets/logos/aria-wordmark-dark.svg" alt="ARIA" />
      </div>
    </header>
    </>
  );
}
