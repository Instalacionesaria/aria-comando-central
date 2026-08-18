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
        <div className="menu-wrap" id="userWrap">
          <button className="user-btn" id="userBtn" title="Francisco · Gerencia" aria-label="Cuenta">
            <span className="uav">
              FR
            </span>
          </button>
          <div className="menu-pop" id="userMenu">
            <div className="mp-head">
              <span className="uav big">
                FR
              </span>
              <span>
                <b>
                  Francisco
                </b>
                <em>
                  Gerencia · ARIA IA
                </em>
              </span>
            </div>
            <div className="mp-sep" />
            <button className="mp-item">
              Perfil
            </button>
            <button className="mp-item">
              Preferencias
            </button>
            <button className="mp-item">
              Usuarios y permisos
            </button>
            <div className="mp-sep" />
            <button className="mp-item">
              Ayuda y soporte
            </button>
            <button className="mp-item danger">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
