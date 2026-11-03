export default function PlatformFooter() {
  return (
    <footer className="platform-footer" id="platform-info">
      <h2>Nexora Monitoring</h2>
      <p>
        Nexora monitors cloud infrastructure metrics and detects
        potential reliability issues.
      </p>
      <p>
        The dashboard refreshes its data every 10 seconds. Metric
        freshness indicates whether the latest available sample is
        recent; it does not guarantee that the infrastructure is
        completely healthy.
      </p>
      <p>
        Process snapshots provide diagnostic evidence. They do not
        automatically prove the root cause of a past incident.
      </p>
      <p>
        Recommendations are recorded in an audit trail. Remediation
        remains in dry-run mode and does not execute infrastructure
        changes.
      </p>
    </footer>
  );
}
