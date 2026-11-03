import Icon from "../common/Icon";

export default function Topbar({ systemStatus, systemStatusClass, incidentCount = 0 }) {
  const handleSearch = (event) => {
    const query = event.target.value.toLowerCase();
    document.querySelectorAll(".history-item").forEach((item) => {
      item.style.display = item.textContent.toLowerCase().includes(query)
        ? ""
        : "none";
    });
  };

  return (
    <div className="topbar">
      <label className="search-box">
        <span><Icon name="search" size={20} /></span>
        <input
          aria-label="Search incidents and metrics"
          placeholder="Search instances, incidents, metrics..."
          onChange={handleSearch}
        />
      </label>

      <div className="topbar-right">
        <div className={`top-status ${systemStatusClass}`}>
          <i /> {systemStatus}
        </div>
        <a className="topbar-bell" href="#active-incidents" aria-label="Incidents">
          <Icon name="bell" size={24} />
          {incidentCount > 0 && <i className="bell-dot" />}
        </a>
        <span className="topbar-avatar">BS</span>
      </div>
    </div>
  );
}
