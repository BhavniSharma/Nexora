export default function ProcessEvidenceView({ evidence, error }) {
  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!evidence) return null;

  return (
    <div className="audit-history process-evidence">
      <h3>Historical Process Evidence</h3>

      <div className="incident-details">
        <span>Incident #{evidence.incident_id}</span>
        <span>{evidence.metric}</span>
        <span>{evidence.incident_status}</span>
      </div>

      <p><strong>Snapshots recorded:</strong> {evidence.snapshot_count}</p>
      <p><strong>Evidence scope:</strong> {evidence.evidence_scope}</p>
      <p>{evidence.message}</p>

      {evidence.snapshot_count === 0 ? (
        <p>
          No historical snapshots are available. Evidence is not
          created retroactively for older incidents.
        </p>
      ) : (
        evidence.snapshots.map((snapshot) => (
          <div className="audit-record" key={snapshot.id}>
            <h4>Snapshot #{snapshot.id}</h4>
            <p><strong>Captured at:</strong> {snapshot.captured_at}</p>
            <p><strong>Capture reason:</strong> {snapshot.capture_reason}</p>
            <p><strong>Collection status:</strong> {snapshot.collection_status}</p>
            <p><strong>Incident metric value:</strong> {snapshot.metric_value}%</p>
            <p><strong>Threshold:</strong> {snapshot.threshold}%</p>

            {snapshot.process_data?.message && (
              <p>{snapshot.process_data.message}</p>
            )}

            {snapshot.process_data?.processes?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Process</th>
                      <th>PID</th>
                      <th>CPU %</th>
                      <th>Memory %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.process_data.processes.map((process) => (
                      <tr key={`${snapshot.id}-${process.pid}`}>
                        <td>{process.command}</td>
                        <td>{process.pid}</td>
                        <td>{process.cpu_percent}%</td>
                        <td>{process.memory_percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No process details available in this snapshot.</p>
            )}

            {snapshot.capture_reason === "MANUAL_TEST" && (
              <p className="evidence-note">
                Manual test snapshot: these process readings were
                collected during the test, not necessarily during
                the original incident.
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
