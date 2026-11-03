import Icon from "../common/Icon";

export default function Sidebar({ incidentCount = 0, isConnected = true }) {
  return (
    <aside className="sidebar">
      <a className="sidebar-brand" href="#top">
        <span className="brand-logo">N</span>
        <span className="brand-text">
          <strong>NEXORA</strong>
          <small>CLOUD INCIDENT INTELLIGENCE</small>
        </span>
      </a>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <a className="sidebar-link active" href="#top">
          <span className="nav-icon"><Icon name="home" /></span>
          <span>Dashboard</span>
        </a>
        <a className="sidebar-link" href="#active-incidents">
          <span className="nav-icon"><Icon name="bell" /></span>
          <span>Incidents</span>
          {incidentCount > 0 && (
            <span className="nav-badge">{incidentCount}</span>
          )}
        </a>
        <a className="sidebar-link" href="#incident-history">
          <span className="nav-icon"><Icon name="clock" /></span>
          <span>History</span>
        </a>
        <a className="sidebar-link" href="#timeline">
          <span className="nav-icon"><Icon name="activity" /></span>
          <span>Timeline</span>
        </a>
        <a className="sidebar-link" href="#platform-info">
          <span className="nav-icon"><Icon name="file" /></span>
          <span>Reports</span>
        </a>
      </nav>

      <div className="side-bottom">
        <div className="conn-box">
          <Icon name="cloud" size={20} />
          <span>{isConnected ? "Connected to AWS" : "Disconnected"}</span>
          <i className={`conn-dot ${isConnected ? "" : "down"}`} />
        </div>

        <div className="side-user">
          <span className="avatar-circle">BS</span>
          <strong>Bhavni Sharma</strong>
          <span className="side-user-arrow"><Icon name="right" size={18} /></span>
        </div>
      </div>
    </aside>
  );
}
