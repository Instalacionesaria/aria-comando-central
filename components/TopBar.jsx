/* Portado de aios-command-center_1.html — barra superior, líneas 2482-2512. */
export default function TopBar() {
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
        <span>
          AIOS
        </span>
        <i>
          /
        </i>
        <b id="crumbNow">
          Executive
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
