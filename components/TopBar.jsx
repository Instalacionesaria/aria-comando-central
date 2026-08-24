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
        <button className="icon-btn" id="reportBtn" title="Reportar un problema" aria-label="Reportar">
          ⚑
        </button>
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
