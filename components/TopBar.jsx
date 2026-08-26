/* Portado de aios-command-center_1.html — barra superior, líneas 2482-2512. */

/**
 * La barra de arriba, con la miga de pan.
 *
 * ── LA MIGA DECÍA «AIOS / EXECUTIVE» SIEMPRE, Y ERA DEL PROTOTIPO ────────────
 *
 * Los dos textos venían escritos a mano del HTML original, y `lib/aios/shell.js` solo los cambia
 * cuando alguien **hace clic** en una fila del menú. Mientras las diez pestañas las veía todo el
 * mundo eso era invisible: todos abrían en Executive, así que el literal acertaba.
 *
 * Con el alcance por persona dejó de acertar. Medido en el navegador con alguien restringido a
 * Closer y Tools: menú correcto, vista abierta Closer, y la miga diciendo **Executive** — una
 * pantalla que esa persona no puede ver y que además no era la que estaba abierta.
 *
 * Así que el arranque llega como DATO. `null` es un estado real —un rol restringido sin secciones
 * concedidas— y entonces la miga muestra solo la marca, sin nombrar ninguna pantalla. Antes que
 * nombrar una falsa.
 */
export default function TopBar({ arranque }) {
  return (
    <>
    <header className="topbar">
      <div className="tb-brand">
        <span className="bmark">
          A
        </span>
        <span className="bname">
          AIOS
        </span>
      </div>
      <div className="crumb">
        {/* El GRUPO, y es su clave interna a propósito: es lo que pone `irALaVista` al navegar
            (`GROUP[clave]`), y el primer grupo tiene `etiqueta: null`, así que con la etiqueta la
            miga de un ejecutivo quedaría vacía. Que este lugar y el clic en el menú muestren lo
            mismo para la misma pantalla importa más que la rareza de que el pie diga «Pie», que
            ya está anotada como trabajo aparte en `lib/aios/shell.js`. */}
        <span>
          {arranque?.grupo ?? 'AIOS'}
        </span>
        <i>
          /
        </i>
        <b id="crumbNow">
          {arranque?.seccion.nombre ?? ''}
        </b>
      </div>
      <div className="tb-right">
        {/* El botón «Reportar un problema» se sacó: no hacía nada. `shell.js` nunca le enganchó
            un manejador, así que se podía apretar y no pasaba nada — el mismo criterio con el
            que se sacaron los cuatro botones del menú de la cuenta. */}
        {/* EL MENÚ DE LA CUENTA SE MUDÓ AL PIE DEL MENÚ LATERAL.
            Estaba acá con el avatar «FR» y el título «Francisco · Gerencia» escritos a mano
            —el mismo nombre para todos los inquilinos— y sus seis botones no hacían nada:
            `shell.js` solo abría y cerraba el desplegable, así que «Cerrar sesión» no cerraba
            ninguna sesión. Ahora vive en `components/MenuDeUsuario.jsx`, junto al nombre de
            la persona, con su nombre real y un cierre de sesión que funciona. */}
      </div>
    </header>
    </>
  );
}
