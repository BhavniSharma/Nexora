import Icon from "../common/Icon";
import AuditRecords from "./AuditRecords";

export default function ActiveIncidentsPanel({
  incidents,
  recommendations,
  auditHistory,
  loading,
  onRequestRemediation,
  onResolveIncident,
}) {
  return (
    <article className="panel active-panel" id="active-incidents">
      <div className="panel-heading">
        <span className="panel-icon"><Icon name="bell" size={20} /></span>
        <div>
          <h2>Active Incidents</h2>
          <p>Real-time detection of infrastructure issues</p>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="incident-clear">
          <span className="clear-check">✓</span>
          <div>
            <h3>No active incidents detected</h3>
            <p>All monitored metrics are within normal thresholds.</p>
          </div>
          <div className="clear-shield"><Icon name="shield" size={64} /></div>
        </div>
      ) : (
        incidents.map((incident) => (
          <div className="incident-card" key={incident.id}>
            <div>
              <strong>#{incident.id} — {incident.metric}</strong>
              <p>{incident.message}</p>
              <small>
                Value: {incident.value}% · Severity: {incident.severity}
              </small>
            </div>

            <div className="incident-card-actions">
              <button
                className="btn-recommend"
                onClick={() => onRequestRemediation(incident.id)}
                disabled={Boolean(loading[incident.id])}
              >
                {loading[incident.id] ? "Generating…" : "Recommend Remediation"}
              </button>
              <button
                className="btn-resolve"
                onClick={() => onResolveIncident(incident.id)}
                disabled={Boolean(loading[incident.id])}
              >
                Resolve Incident
              </button>
            </div>

            {recommendations[incident.id] && (
              <div className="remediation-result">
                <h3>Recommendation</h3>
                <p><strong>Action:</strong> {recommendations[incident.id].action}</p>
                <p><strong>Mode:</strong> {recommendations[incident.id].mode}</p>
                <p>{recommendations[incident.id].message}</p>
                <p><strong>Executed:</strong> {String(recommendations[incident.id].executed)}</p>
              </div>
            )}

            {auditHistory[incident.id] && (
              <details className="detail-panel" open>
                <summary>Remediation Audit History</summary>
                <AuditRecords records={auditHistory[incident.id]} />
              </details>
            )}
          </div>
        ))
      )}
    </article>
  );
}
