/* Portado de aios-command-center_1.html — panel derecho, líneas 3177-3190. */
export default function SidePanel() {
  return (
    <>
    <aside className="side">
      <div className="panel">
        <div className="panel-head">
          Reunión de hoy{' '}
          <span className="live">
            07:00 · 6 áreas
          </span>
        </div>
        <div className="brief" id="exBrief" />
        <div className="panel-foot" id="exHistory">
          Ver reuniones anteriores →
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          Cambios en curso{' '}
          <span className="live">
            3 en seguimiento
          </span>
        </div>
        <div className="brief" id="exChanges" />
      </div>
    </aside>
    </>
  );
}
