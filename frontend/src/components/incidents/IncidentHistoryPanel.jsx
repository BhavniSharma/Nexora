import Icon from "../common/Icon";
import AuditRecords from "./AuditRecords";
import ProcessEvidenceView from "./ProcessEvidenceView";

export default function IncidentHistoryPanel({
  history,
  auditHistory,
  evidenceHistory,
  evidenceLoading,
  evidenceErrors,
  onFetchAudit,
  onFetchEvidence,
}) {
  return (
    <article className="panel history-panel" id="incident-history">
      <div className="panel-heading">
        <span className="panel-icon"><Icon name="clock" size={20} /></span>
        <div>
          <h2>Incident History</h2>
          <p>Past incidents and their resolution status</p>
        </div>
        <a className="view-all" href="#timeline">
          View All <Icon name="arrow" size={14} />
        </a>
      </div>

      {history.length === 0 ? (
        <p className="empty-copy">No incident history available.</p>
      ) : (
        history.map((incident) => (
          <div className="history-item" key={incident.id}>
            <div className="history-row">
              <span className={`history-check ${incident.status === "RESOLVED" ? "resolved" : "open"}`}>
                {incident.status === "RESOLVED" ? "✓" : "!"}
              </span>
              <div className="history-copy">
                <strong>#{incident.id} — {incident.metric}</strong>
                <p>{incident.message}</p>
                <small>
                  Value: <b>{incident.value}%</b>
                  <span>Severity: {incident.severity}</span>
                </small>
              </div>
              <span className={`resolved-badge ${incident.status === "RESOLVED" ? "" : "open"}`}>
                {incident.status}
              </span>
            </div>

            <div className="history-actions">
              <button onClick={() => onFetchAudit(incident.id)}>
                View Audit History
              </button>
              <button
                onClick={() => onFetchEvidence(incident.id)}
                disabled={Boolean(evidenceLoading[incident.id])}
              >
                {evidenceLoading[incident.id] ? "Loading…" : "View Process Evidence"}
              </button>
            </div>

            {auditHistory[incident.id] && (
              <details className="detail-panel" open>
                <summary>Remediation Audit History</summary>
                <AuditRecords records={auditHistory[incident.id]} />
              </details>
            )}

            {(evidenceHistory[incident.id] || evidenceErrors[incident.id]) && (
              <details className="detail-panel" open>
                <summary>Historical Process Evidence</summary>
                <ProcessEvidenceView
                  evidence={evidenceHistory[incident.id]}
                  error={evidenceErrors[incident.id]}
                />
              </details>
            )}
          </div>
        ))
      )}
    </article>
  );
}
