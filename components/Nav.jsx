/* Portado de aios-command-center_1.html — navegación lateral, líneas 2514-2550. */
export default function Nav() {
  return (
    <>
    <aside className="nav">
      <button className="acct" id="acctBtn">
        <span className="acct-av">
          AH
        </span>
        <span className="acct-txt">
          <span className="acct-name">
            ARIA High Ticket
          </span>
          <span className="acct-role">
            ARIA IA
          </span>
        </span>
        <span className="acct-chev">
          ⇅
        </span>
      </button>
      <div className="nav-group">
        <div className="nav-item on" data-view="executive">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-exec" />
          </svg>
          <span className="n">
            Executive
          </span>
        </div>
        <div className="nav-item" data-view="contacts">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-leads" />
          </svg>
          <span className="n">
            Leads Portal
          </span>
          <span className="chev">
            ›
          </span>
        </div>
        <div className="nav-item" data-view="icp">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-icp" />
          </svg>
          <span className="n">
            ICP & Oferta
          </span>
          <span className="chev">
            ›
          </span>
        </div>
      </div>
      <div className="nav-group">
        <div className="nav-label">
          Inteligencia
        </div>
        <div className="nav-item" data-view="acquisition">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-acq" />
          </svg>
          <span className="n">
            Acquisition
          </span>
        </div>
        <div className="nav-item" data-view="creative">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-creative" />
          </svg>
          <span className="n">
            Creative
          </span>
          <span className="chev">
            ›
          </span>
        </div>
        <div className="nav-item" data-view="conversion">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-conv" />
          </svg>
          <span className="n">
            Conversion
          </span>
          <span className="chev">
            ›
          </span>
        </div>
        <div className="nav-item" data-view="conversation">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-chat" />
          </svg>
          <span className="n">
            Conversation
          </span>
        </div>
        <div className="nav-item" data-view="sales">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-sales" />
          </svg>
          <span className="n">
            Sales
          </span>
          <span className="chev">
            ›
          </span>
        </div>
      </div>
      <div className="nav-group">
        <div className="nav-label">
          Operación
        </div>
        <div className="nav-item" data-view="setter">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-setter" />
          </svg>
          <span className="n">
            Setter
          </span>
        </div>
        <div className="nav-item" data-view="closer">
          <svg className="ni" viewBox="0 0 16 16">
            <use href="#i-closer" />
          </svg>
          <span className="n">
            Closer
          </span>
        </div>
      </div>
      <div className="nav-foot">
        <div className="role-row">
          <i>
            FR
          </i>
          {' '}Francisco · Gerencia
        </div>
        <div className="role-row">
          <i>
            ⚙
          </i>
          {' '}Ajustes
        </div>
      </div>
    </aside>
    </>
  );
}
