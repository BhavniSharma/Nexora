import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://98.91.2.103:8000";
const METRIC_MAX_AGE_SECONDS = 180;

function MetricTrendChart({
  title,
  metric,
  points,
  color,
  threshold = 80,
}) {
  const width = 640;
  const height = 190;
  const padding = { top: 16, right: 18, bottom: 30, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const samples = (points || []).slice(-30);
  const validSamples = samples.filter((point) =>
    Number.isFinite(Number(point.value))
  );

  if (validSamples.length === 0) {
    return (
      <div className="trend-card">
        <div className="trend-card-heading">
          <h3>{title}</h3>
          <span className="trend-subtitle">
            No samples available
          </span>
        </div>

        <div className="trend-empty">
          Waiting for CloudWatch samples…
        </div>
      </div>
    );
  }

  const x = (index) =>
    padding.left +
    (validSamples.length === 1
      ? chartWidth / 2
      : (index / (validSamples.length - 1)) * chartWidth);

  const y = (value) =>
    padding.top +
    ((100 - Math.max(0, Math.min(100, value))) / 100) *
      chartHeight;

  const pathData = validSamples
    .map((point, index) => {
      const value = Number(point.value);
      return `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`;
    })
    .join(" ");

  const latest = validSamples[validSamples.length - 1];

  return (
    <div className="trend-card">
      <div className="trend-card-heading">
        <div>
          <h3>{title}</h3>
          <p className="trend-subtitle">
            {validSamples.length} samples · {metric}
          </p>
        </div>

        <div className="trend-current">
          <strong>{latest.value}%</strong>
          <span>Latest</span>
        </div>
      </div>

      <div className="trend-chart-wrap">
        <svg
          className="trend-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title} trend chart`}
        >
          <defs>
            <linearGradient
              id={`area-${metric}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={color}
                stopOpacity="0.28"
              />
              <stop
                offset="100%"
                stopColor={color}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y(tick)}
                x2={width - padding.right}
                y2={y(tick)}
                className="trend-grid-line"
              />

              <text
                x={padding.left - 9}
                y={y(tick) + 4}
                textAnchor="end"
                className="trend-axis-label"
              >
                {tick}%
              </text>
            </g>
          ))}

          <line
            x1={padding.left}
            y1={y(threshold)}
            x2={width - padding.right}
            y2={y(threshold)}
            className="trend-threshold-line"
          />

          <path
            d={`${pathData} L ${x(validSamples.length - 1)} ${
              height - padding.bottom
            } L ${x(0)} ${height - padding.bottom} Z`}
            fill={`url(#area-${metric})`}
          />

          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="trend-line"
          />

          {validSamples.map((point, index) => (
            <circle
              key={`${point.timestamp || index}-${index}`}
              cx={x(index)}
              cy={y(Number(point.value))}
              r={index === validSamples.length - 1 ? 4.5 : 2.2}
              fill={color}
              className="trend-point"
            >
              <title>
                {`${point.value}%${
                  point.timestamp
                    ? ` — ${new Date(
                        point.timestamp
                      ).toLocaleString()}`
                    : ""
                }`}
              </title>
            </circle>
          ))}

          <text
            x={padding.left}
            y={height - 7}
            className="trend-axis-label"
          >
            {validSamples[0].timestamp
              ? new Date(
                  validSamples[0].timestamp
                ).toLocaleTimeString()
              : "Oldest"}
          </text>

          <text
            x={width - padding.right}
            y={height - 7}
            textAnchor="end"
            className="trend-axis-label"
          >
            {latest.timestamp
              ? new Date(latest.timestamp).toLocaleTimeString()
              : "Latest"}
          </text>
        </svg>
      </div>

      <p className="trend-footnote">
        Dashed line: {threshold}% alert threshold. Data comes from
        CloudWatch samples returned by the backend.
      </p>
    </div>
  );
}

function App() {
  const [metrics, setMetrics] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [history, setHistory] = useState([]);
  const [recommendations, setRecommendations] = useState({});
  const [auditHistory, setAuditHistory] = useState({});
  const [evidenceHistory, setEvidenceHistory] = useState({});
  const [evidenceLoading, setEvidenceLoading] = useState({});
  const [evidenceErrors, setEvidenceErrors] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState(null);

  const fetchData = async () => {
    try {
      const [
        metricsResponse,
        incidentsResponse,
        historyResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/metrics`),
        fetch(`${API_URL}/incidents`),
        fetch(`${API_URL}/incidents/history`),
      ]);

      if (
        !metricsResponse.ok ||
        !incidentsResponse.ok ||
        !historyResponse.ok
      ) {
        throw new Error("Backend request failed");
      }

      const metricsData = await metricsResponse.json();
      const incidentsData = await incidentsResponse.json();
      const historyData = await historyResponse.json();

      setMetrics(metricsData.metrics);
      setIncidents(incidentsData.incidents);
      setHistory(historyData.incidents);
      setLastSuccessfulFetch(new Date());
      setError("");
    } catch {
      setError(
        "Unable to connect to Nexora backend. Check the API server and network connection."
      );
    }
  };

  const fetchAudit = async (incidentId) => {
    try {
      const response = await fetch(
        `${API_URL}/incidents/${incidentId}/remediation/audit`
      );

      if (!response.ok) {
        throw new Error("Unable to load audit history");
      }

      const data = await response.json();

      setAuditHistory((previous) => ({
        ...previous,
        [incidentId]: data.audit_history,
      }));

      setActionError("");
    } catch {
      setActionError(
        `Could not load audit history for incident #${incidentId}.`
      );
    }
  };

  const fetchEvidence = async (incidentId) => {
    setEvidenceLoading((previous) => ({
      ...previous,
      [incidentId]: true,
    }));

    setEvidenceErrors((previous) => ({
      ...previous,
      [incidentId]: "",
    }));

    try {
      const response = await fetch(
        `${API_URL}/incidents/${incidentId}/diagnosis/evidence`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load process evidence"
        );
      }

      setEvidenceHistory((previous) => ({
        ...previous,
        [incidentId]: data,
      }));
    } catch (err) {
      setEvidenceErrors((previous) => ({
        ...previous,
        [incidentId]:
          err.message || "Could not load process evidence.",
      }));
    } finally {
      setEvidenceLoading((previous) => ({
        ...previous,
        [incidentId]: false,
      }));
    }
  };

  const requestRemediation = async (incidentId) => {
    setLoading((previous) => ({
      ...previous,
      [incidentId]: true,
    }));

    setActionError("");

    try {
      const response = await fetch(
        `${API_URL}/incidents/${incidentId}/remediation/recommend`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Recommendation request failed"
        );
      }

      setRecommendations((previous) => ({
        ...previous,
        [incidentId]: data.recommendation,
      }));

      await fetchAudit(incidentId);
    } catch (err) {
      setActionError(
        err.message || "Unable to create recommendation."
      );
    } finally {
      setLoading((previous) => ({
        ...previous,
        [incidentId]: false,
      }));
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 10000);

    return () => clearInterval(interval);
  }, []);

  const latestPoint = (metric) => {
    const points = metrics?.[metric];

    if (!points?.length) return null;

    return points[points.length - 1];
  };

  const latestValue = (metric) => {
    const point = latestPoint(metric);
    return point ? point.value : "--";
  };

  const metricFreshness = (metric) => {
    const point = latestPoint(metric);

    if (!point?.timestamp) {
      return { label: "NO DATA", className: "no-data" };
    }

    const timestamp = new Date(point.timestamp).getTime();
    const ageSeconds = (Date.now() - timestamp) / 1000;

    if (!Number.isFinite(timestamp) || ageSeconds < 0) {
      return { label: "NO DATA", className: "no-data" };
    }

    if (ageSeconds > METRIC_MAX_AGE_SECONDS) {
      return { label: "STALE", className: "stale" };
    }

    return { label: "LIVE", className: "live" };
  };

  const healthSummary = [
    "CPUUtilization",
    "MemoryUtilization",
    "DiskUtilization",
  ].map((metric) => ({
    metric,
    ...metricFreshness(metric),
  }));

  const freshMetricCount = healthSummary.filter(
    (item) => item.className === "live"
  ).length;

  const staleMetricCount = healthSummary.filter(
    (item) => item.className === "stale"
  ).length;

  const noDataMetricCount = healthSummary.filter(
    (item) => item.className === "no-data"
  ).length;

  const hasMetricData = healthSummary.some(
    (item) => item.className === "live"
  );

  const allMetricsFresh = freshMetricCount === healthSummary.length;
  const hasActiveIncidents = incidents.length > 0;

  let systemStatus = "Waiting for Metrics";
  let systemStatusClass = "warning";

  if (hasActiveIncidents) {
    systemStatus = `${incidents.length} Active Incident${
      incidents.length === 1 ? "" : "s"
    }`;
    systemStatusClass = "critical";
  } else if (allMetricsFresh) {
    systemStatus = "Monitoring Active";
    systemStatusClass = "healthy";
  } else if (hasMetricData) {
    systemStatus = "Metrics Partially Available";
    systemStatusClass = "warning";
  } else if (error) {
    systemStatus = "Backend Unavailable";
    systemStatusClass = "critical";
  }

  const formatTimelineTime = (timestamp) => {
    if (!timestamp) return "Time not recorded";

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "Invalid timestamp";
    }

    return date.toLocaleString();
  };

  const renderIncidentTimeline = () => {
    if (history.length === 0) {
      return <p>No timeline events available yet.</p>;
    }

    return history.map((incident) => (
      <div className="timeline-item" key={incident.id}>
        <div
          className={`timeline-marker ${
            incident.status === "RESOLVED" ? "resolved" : "open"
          }`}
        />

        <div className="timeline-content">
          <div className="timeline-item-heading">
            <strong>
              Incident #{incident.id} — {incident.metric}
            </strong>

            <span
              className={`timeline-status ${
                incident.status === "RESOLVED" ? "resolved" : "open"
              }`}
            >
              {incident.status}
            </span>
          </div>

          <p>{incident.message}</p>

          <p className="timeline-time">
            <strong>Detected:</strong>{" "}
            {formatTimelineTime(incident.created_at)}
          </p>

          {incident.resolved_at && (
            <p className="timeline-time">
              <strong>Resolved:</strong>{" "}
              {formatTimelineTime(incident.resolved_at)}
            </p>
          )}

          <p className="timeline-time">
            <strong>Recorded value:</strong> {incident.value}%
            {" · "}
            <strong>Threshold:</strong> {incident.threshold}%
          </p>
        </div>
      </div>
    ));
  };

  const renderAuditRecords = (incidentId) => {
    const records = auditHistory[incidentId];

    if (!records) return null;

    if (records.length === 0) {
      return <p>No audit records for this incident.</p>;
    }

    return records.map((record) => (
      <div key={record.id} className="audit-record">
        <p>
          <strong>Action:</strong> {record.action}
        </p>
        <p>
          <strong>Result:</strong> {record.result}
        </p>
        <p>
          <strong>Mode:</strong> {record.mode}
        </p>
        <p>
          <strong>Executed:</strong>{" "}
          {Boolean(record.executed) ? "Yes" : "No"}
        </p>
        <p>
          <strong>Time:</strong> {record.created_at}
        </p>
        {record.message && <p>{record.message}</p>}
      </div>
    ));
  };

  const renderProcessEvidence = (incidentId) => {
    const evidence = evidenceHistory[incidentId];

    if (evidenceErrors[incidentId]) {
      return (
        <div className="error">
          {evidenceErrors[incidentId]}
        </div>
      );
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

        <p>
          <strong>Snapshots recorded:</strong>{" "}
          {evidence.snapshot_count}
        </p>

        <p>
          <strong>Evidence scope:</strong>{" "}
          {evidence.evidence_scope}
        </p>

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

              <p>
                <strong>Captured at:</strong>{" "}
                {snapshot.captured_at}
              </p>

              <p>
                <strong>Capture reason:</strong>{" "}
                {snapshot.capture_reason}
              </p>

              <p>
                <strong>Collection status:</strong>{" "}
                {snapshot.collection_status}
              </p>

              <p>
                <strong>Incident metric value:</strong>{" "}
                {snapshot.metric_value}%
              </p>

              <p>
                <strong>Threshold:</strong> {snapshot.threshold}%
              </p>

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
                      {snapshot.process_data.processes.map(
                        (process) => (
                          <tr
                            key={`${snapshot.id}-${process.pid}`}
                          >
                            <td>{process.command}</td>
                            <td>{process.pid}</td>
                            <td>{process.cpu_percent}%</td>
                            <td>{process.memory_percent}%</td>
                          </tr>
                        )
                      )}
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
  };

  const metricCards = [
    {
      key: "CPUUtilization",
      title: "CPU Usage",
      description: "EC2 Instance",
      color: "#60a5fa",
    },
    {
      key: "MemoryUtilization",
      title: "Memory Usage",
      description: "EC2 Instance",
      color: "#a78bfa",
    },
    {
      key: "DiskUtilization",
      title: "Disk Usage",
      description: "Root Volume",
      color: "#34d399",
    },
  ];

  return (
    <div className="dashboard">
      <header id="top">
        <div className="brand-lockup">
          <span className="brand-orbit" aria-hidden="true">
            N
          </span>

          <div>
            <h1>NEXORA</h1>
            <p>Cloud Reliability &amp; Monitoring Platform</p>
          </div>
        </div>

        <div className="header-meta">
          <span className="system-label">
            CLOUD OPERATIONS CENTER
          </span>

          <span className="system-indicator">
            <span className="freshness-dot" />
            LIVE TELEMETRY
          </span>
        </div>
      </header>

      <nav className="top-nav" aria-label="Dashboard navigation">
        <a className="nav-brand" href="#top">
          NEXORA <span>OPS</span>
        </a>

        <div className="nav-links">
          <a href="#overview">Overview</a>
          <a href="#trends">Metrics</a>
          <a href="#active-incidents">Incidents</a>
          <a href="#timeline">Timeline</a>
        </div>

        <span className="nav-live">
          <span className="freshness-dot" />
          SYSTEM ONLINE
        </span>
      </nav>

      <div className={`status ${systemStatusClass}`}>
        <span className="status-dot" />
        {systemStatus}
      </div>

      {error && <div className="error">{error}</div>}
      {actionError && <div className="error">{actionError}</div>}

      {/* Metric overview */}
      <div className="cards" id="overview">
        {metricCards.map((metric) => {
          const freshness = metricFreshness(metric.key);
          const point = latestPoint(metric.key);
          const value = latestValue(metric.key);

          return (
            <div className="card" key={metric.key}>
              <div className="metric-card-heading">
                <h2>{metric.title}</h2>

                <span
                  className={`freshness-badge ${freshness.className}`}
                  title={
                    point?.timestamp
                      ? `CloudWatch sample: ${new Date(
                          point.timestamp
                        ).toLocaleString()}`
                      : "No timestamp available"
                  }
                >
                  <span className="freshness-dot" />
                  {freshness.label}
                </span>
              </div>

              <div className="value">
                {value}
                {value !== "--" ? "%" : ""}
              </div>

              <p>{metric.description}</p>

              <p className="metric-updated">
                {point?.timestamp &&
                Number.isFinite(new Date(point.timestamp).getTime())
                  ? `Last updated: ${new Date(
                      point.timestamp
                    ).toLocaleTimeString()}`
                  : "No metric timestamp available"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Infrastructure health */}
      <section className="health-overview" id="health">
        <div className="section-heading">
          <div>
            <h2>Infrastructure Health Overview</h2>
            <p>
              Summary of reported metrics and active incidents
            </p>
          </div>
        </div>

        <div className="health-overview-grid">
          <div className="health-overview-card">
            <span>Fresh Metrics</span>
            <strong>
              {freshMetricCount} / {healthSummary.length}
            </strong>
            <small>
              Latest sample within {METRIC_MAX_AGE_SECONDS} seconds
            </small>
          </div>

          <div className="health-overview-card">
            <span>Stale Metrics</span>
            <strong>{staleMetricCount}</strong>
            <small>
              Samples older than {METRIC_MAX_AGE_SECONDS} seconds
            </small>
          </div>

          <div className="health-overview-card">
            <span>Metrics Without Data</span>
            <strong>{noDataMetricCount}</strong>
            <small>No usable timestamp available</small>
          </div>

          <div className="health-overview-card">
            <span>Active Incidents</span>
            <strong>{incidents.length}</strong>
            <small>Incidents currently reported as open</small>
          </div>
        </div>

        <p className="health-overview-updated">
          {lastSuccessfulFetch
            ? `Dashboard data last refreshed at ${lastSuccessfulFetch.toLocaleTimeString()}`
            : "Waiting for the first successful backend refresh"}
        </p>
      </section>

      {/* Metric trends */}
      <section className="trends-section" id="trends">
        <div className="section-heading">
          <div>
            <h2>Metric Trends</h2>
            <p>
              Recent CloudWatch samples · refreshes every 10 seconds
            </p>
          </div>

          <span className="trend-live-indicator">
            <span className="freshness-dot" />
            AUTO-REFRESH
          </span>
        </div>

        <div className="trend-grid">
          {metricCards.map((metric) => (
            <MetricTrendChart
              key={metric.key}
              title={metric.title}
              metric={metric.key}
              points={metrics?.[metric.key]}
              color={metric.color}
            />
          ))}
        </div>
      </section>

      {/* Active incidents */}
      <section className="incidents" id="active-incidents">
        <h2>Active Incidents</h2>

        {incidents.length === 0 ? (
          <div className="no-incidents">
            ✓ No active incidents detected
          </div>
        ) : (
          incidents.map((incident) => (
            <div className="incident" key={incident.id}>
              <div>
                <strong>⚠ {incident.metric}</strong>
                <p>{incident.message}</p>
              </div>

              <div className="incident-details">
                <span>{incident.value}%</span>
                <span>Threshold: {incident.threshold}%</span>
                <span>{incident.severity}</span>
              </div>

              <button
                onClick={() => requestRemediation(incident.id)}
                disabled={Boolean(loading[incident.id])}
              >
                {loading[incident.id]
                  ? "Generating..."
                  : "Recommend Remediation"}
              </button>

              {recommendations[incident.id] && (
                <div className="remediation-result">
                  <h3>Recommendation</h3>

                  <p>
                    <strong>Action:</strong>{" "}
                    {recommendations[incident.id].action}
                  </p>

                  <p>
                    <strong>Mode:</strong>{" "}
                    {recommendations[incident.id].mode}
                  </p>

                  <p>{recommendations[incident.id].message}</p>

                  <p>
                    <strong>Executed:</strong>{" "}
                    {String(
                      recommendations[incident.id].executed
                    )}
                  </p>

                  <p className="evidence-note">
                    Recommendations are advisory. Check the execution
                    status before assuming infrastructure was changed.
                  </p>
                </div>
              )}

              {auditHistory[incident.id] && (
                <details className="detail-panel">
                  <summary>
                    Remediation Audit History
                    <span>VIEW RECORDS</span>
                  </summary>

                  <div className="detail-panel-body">
                    {renderAuditRecords(incident.id)}
                  </div>
                </details>
              )}
            </div>
          ))
        )}
      </section>

      {/* Incident history */}
      <section className="incidents" id="incident-history">
        <h2>Incident History</h2>

        {history.length === 0 ? (
          <p>No incident history available.</p>
        ) : (
          history.map((incident) => (
            <div className="incident" key={incident.id}>
              <div>
                <strong>
                  #{incident.id} — {incident.metric}
                </strong>
                <p>{incident.message}</p>
              </div>

              <div className="incident-details">
                <span>{incident.status}</span>
                <span>Value: {incident.value}%</span>
                <span>Severity: {incident.severity}</span>
              </div>

              <div className="evidence-actions">
                <button onClick={() => fetchAudit(incident.id)}>
                  View Audit History
                </button>

                <button
                  onClick={() => fetchEvidence(incident.id)}
                  disabled={Boolean(evidenceLoading[incident.id])}
                >
                  {evidenceLoading[incident.id]
                    ? "Loading Evidence..."
                    : "View Process Evidence"}
                </button>
              </div>

              {auditHistory[incident.id] && (
                <details className="detail-panel">
                  <summary>
                    Remediation Audit History
                    <span>VIEW RECORDS</span>
                  </summary>

                  <div className="detail-panel-body">
                    {renderAuditRecords(incident.id)}
                  </div>
                </details>
              )}

              {(evidenceHistory[incident.id] ||
                evidenceErrors[incident.id]) && (
                <details className="detail-panel">
                  <summary>
                    Historical Process Evidence
                    <span>VIEW SNAPSHOTS</span>
                  </summary>

                  <div className="detail-panel-body">
                    {renderProcessEvidence(incident.id)}
                  </div>
                </details>
              )}
            </div>
          ))
        )}
      </section>

      {/* Incident timeline */}
      <section className="incidents timeline-section" id="timeline">
        <h2>Incident Timeline</h2>

        <p className="timeline-description">
          Recorded detection and recovery events from incident history.
        </p>

        <div className="timeline-list">
          {renderIncidentTimeline()}
        </div>
      </section>

      {/* Platform information */}
      <section className="info" id="platform-info">
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
      </section>
    </div>
  );
}

export default App;