import Icon from "../common/Icon";
import { timeAgo, priorityOf } from "../../utils/helpers";

const PILL_TONE = { live: "green", stale: "amber", "no-data": "purple" };

export default function TriGrid({
  recentIncidents,
  metricCards,
  metricFreshness,
  latestValue,
  freshMetricCount,
  healthSummaryLength,
  incidents,
  recommendations,
  loading,
  onRequestRemediation,
}) {
  return (
    <section className="tri-grid">
      {/* 1. Recent Incidents */}
      <article className="panel">
        <div className="panel-heading">
          <span className="panel-icon"><Icon name="bell" size={20} /></span>
          <h2>Recent Incidents</h2>
          <a className="view-all" href="#incident-history">
            View All <Icon name="arrow" size={14} />
          </a>
        </div>

        {recentIncidents.length === 0 ? (
          <p className="empty-copy">No incidents recorded yet.</p>
        ) : (
          recentIncidents.map((incident, index) => {
            const resolved = incident.status === "RESOLVED";
            return (
              <div
                className={`list-row ${index === 0 && !resolved ? "is-active" : ""}`}
                key={incident.id}
              >
                <i className={`row-dot ${resolved ? "grey" : "purple"}`} />
                <div className="row-main">
                  <strong>#{incident.id} — {incident.metric}</strong>
                  <span>{incident.message}</span>
                </div>
                <div className="row-side">
                  <span className={`pill ${resolved ? "grey" : "purple"}`}>
                    {incident.status}
                  </span>
                  <small>
                    {timeAgo(resolved ? incident.resolved_at || incident.created_at : incident.created_at)}
                  </small>
                </div>
              </div>
            );
          })
        )}
      </article>

      {/* 2. Metric Health */}
      <article className="panel">
        <div className="panel-heading">
          <span className="panel-icon"><Icon name="box" size={20} /></span>
          <h2>Metric Health</h2>
          <a className="view-all" href="#trends">
            {freshMetricCount}/{healthSummaryLength} live <Icon name="arrow" size={14} />
          </a>
        </div>

        {metricCards.map((m) => {
          const fresh = metricFreshness(m.key);
          const value = latestValue(m.key);
          return (
            <div className="list-row" key={m.key}>
              <i className={`row-dot ${PILL_TONE[fresh.className]}`} />
              <div className="row-main">
                <strong>{m.title}</strong>
                <span>{m.description}</span>
              </div>
              <div className="row-side">
                <span className={`pill ${PILL_TONE[fresh.className]}`}>
                  {fresh.label}
                </span>
                <small>{value === "--" ? "--" : `${value}%`}</small>
              </div>
            </div>
          );
        })}
      </article>

      {/* 3. Recommendations */}
      <article className="panel">
        <div className="panel-heading">
          <span className="panel-icon"><Icon name="bulb" size={20} /></span>
          <h2>Recommendations</h2>
          <a className="view-all" href="#active-incidents">
            View All <Icon name="arrow" size={14} />
          </a>
        </div>

        {incidents.length === 0 ? (
          <p className="empty-copy">
            No active incidents, so there is nothing to remediate right now.
          </p>
        ) : (
          incidents.slice(0, 3).map((incident) => {
            const priority = priorityOf(incident.severity);
            const recommendation = recommendations[incident.id];
            return (
              <button
                type="button"
                className="list-row rec-row"
                key={incident.id}
                onClick={() => onRequestRemediation(incident.id)}
                disabled={Boolean(loading[incident.id])}
              >
                <span className="rec-icon"><Icon name="upright" size={22} /></span>
                <div className="row-main">
                  <strong>
                    {loading[incident.id]
                      ? "Generating…"
                      : recommendation?.action || "Recommend remediation"}
                  </strong>
                  <span>
                    {recommendation?.message ||
                      `#${incident.id} ${incident.metric}: ${incident.message}`}
                  </span>
                </div>
                <span className={`pill ${priority.tone}`}>{priority.label}</span>
              </button>
            );
          })
        )}
      </article>
    </section>
  );
}
