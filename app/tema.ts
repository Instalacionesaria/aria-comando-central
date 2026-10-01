/* El tema de la aplicación: uno solo, el oscuro.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * HUBO DOS, Y POR QUÉ QUEDA UNO
 *
 * Desde la migración 019 cada persona elegía oscuro o claro con un botón en el pie del menú, y la
 * preferencia se guardaba en la base (`identidad.usuarios.tema`). El brandbook v2 dice que el claro
 * es para documentos y PDFs, no para la aplicación, y la nueva estructura lo adoptó el 2026-10-01
 * (`docs/OTROS/nueva-estructura/03-LA-MARCA.md`, `NE-23`).
 *
 * ── LA TRAMPA QUE ESTO EVITA ────────────────────────────────────────────────
 *
 * El tema se escribía desde dos lecturas: un guion de arranque leía la copia guardada en el
 * navegador (`localStorage`, para que el primer cuadro no destellara) y la barra lateral aplicaba
 * la de la base apenas llegaba la sesión. Si sólo se hubiera sacado el botón, quien había elegido
 * «claro» se habría quedado en claro para siempre y sin forma de volver: las dos lecturas seguían
 * ahí, repitiéndole su última elección.
 *
 * Por eso el tema ya no se LEE de ningún lado. Lo sirve el servidor en el `<html>`, fijo, desde
 * `TEMA`, y nadie en el navegador lo toca después. La copia vieja que quede en algún navegador
 * (`aios:tema`) no la lee nadie, y es inofensiva.
 *
 * ── LO QUE QUEDA DORMIDO ────────────────────────────────────────────────────
 *
 * La columna de la base y la ruta `PUT /api/auth/tema`, sin llamador: retirar la columna exige una
 * migración y esta fase no tiene ninguna. El bloque `:root[data-tema='claro']` de `app/temas.css`
 * también queda, para los documentos imprimibles, y las pruebas de temas lo siguen vigilando.
 */

export type Tema = 'oscuro' | 'claro';

/** El tema de la aplicación. No hay otro que se pueda alcanzar desde la pantalla. */
export const TEMA: Tema = 'oscuro';

/**
 * El mismo tema, con los nombres que usa el brandbook.
 *
 * El sistema de marca v2 (`brand/BRAND.md`) declara sus tokens bajo `[data-theme="dark"|"light"]`,
 * que son los nombres del brandbook y no los de esta aplicación. Los dos atributos se derivan del
 * mismo `TEMA`, así que no pueden quedar en desacuerdo.
 */
export function temaCss(tema: Tema): 'dark' | 'light' {
  return tema === 'claro' ? 'light' : 'dark';
}
