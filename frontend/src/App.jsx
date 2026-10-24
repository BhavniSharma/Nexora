
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
          <span className="trend-subtitle">No samples available</span>
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

  // Fixed chart path expression.
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
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {validSamples.map((point, index) => (
            <circle
              key={`${point.timestamp || index}-${index}`}
              cx={x(index)}
              cy={y(Number(point.value))}
              r={index === validSamples.length - 1 ? 4.5 : 2.2}
              fill={color}
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

  // Detailed incident timeline state.
  const [timelineHistory, setTimelineHistory] = useState({});
  const [timelineLoading, setTimelineLoading] = useState({});
  const [timelineErrors, setTimelineErrors] = useState({});

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
      const [metricsResponse, incidentsResponse, historyResponse] =
        await Promise.all([
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

  // Fetch the timeline for one incident.
  const fetchTimeline = async (incidentId) => {
    setTimelineLoading((previous) => ({
      ...previous,
      [incidentId]: true,
    }));

    setTimelineErrors((previous) => ({
      ...previous,
      [incidentId]: "",
    }));

    try {
      const response = await fetch(
        `${API_URL}/incidents/${incidentId}/timeline`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load incident timeline"
        );
      }

      // The API returns "timeline", not just "events".
      const events = Array.isArray(data)
        ? data
        : data.timeline || data.events || [];

      setTimelineHistory((previous) => ({
        ...previous,
        [incidentId]: events,
      }));
    } catch (err) {
      setTimelineErrors((previous) => ({
        ...previous,
        [incidentId]:
          err.message || "Could not load incident timeline.",
      }));
    } finally {
      setTimelineLoading((previous) => ({
        ...previous,
        [incidentId]: false,
      }));
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
      await fetchTimeline(incidentId);
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

  // Automatically load timelines for incidents in history.
  useEffect(() => {
    history.forEach((incident) => {
      const incidentId = incident.id;
      const alreadyLoaded = Object.prototype.hasOwnProperty.call(
        timelineHistory,
        incidentId
      );

      if (!alreadyLoaded && !timelineLoading[incidentId]) {
        fetchTimeline(incidentId);
      }
    });
  }, [history, timelineHistory, timelineLoading]);

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

  // Render incident summaries and detailed timeline events.
  const renderIncidentTimeline = () => {
    if (history.length === 0) {
      return <p>No timeline events available yet.</p>;
    }

    return history.map((incident) => {
      const events = timelineHistory[incident.id];

      return (
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

            <div className="timeline-events">
              <h4>Recorded Events</h4>

              {timelineLoading[incident.id] ? (
                <p>Loading incident events…</p>
              ) : timelineErrors[incident.id] ? (
                <div>
                  <p className="error">
                    {timelineErrors[incident.id]}
                  </p>
                  <button
                    onClick={() => fetchTimeline(incident.id)}
                  >
                    Retry timeline
                  </button>
                </div>
              ) : !events ? (
                <button
                  onClick={() => fetchTimeline(incident.id)}
                >
                  Load timeline events
                </button>
              ) : events.length === 0 ? (
                <p>No detailed events recorded for this incident.</p>
              ) : (
                <ol className="timeline-event-list">
                  {events.map((event, index) => {
                    const details = event.details || {};

                    return (
                      <li
                        key={`${incident.id}-${event.event_type || "event"}-${index}`}
                      >
    
<div className="timeline-event-heading">
  <strong className="timeline-event-title">
    {event.title || event.event_type || "Incident event"}
  </strong>

  <span className="timeline-event-timestamp">
    {formatTimelineTime(event.timestamp)}
  </span>
</div>

                        {details.message && <p>{details.message}</p>}

                        {details.metric && (
                          <p className="timeline-time">
                            <strong>Metric:</strong> {details.metric}
                          </p>
                        )}

                        {details.value !== undefined && (
                          <p className="timeline-time">
                            <strong>Value:</strong> {details.value}%
                          </p>
                        )}

                        {details.threshold !== undefined && (
                          <p className="timeline-time">
                            <strong>Threshold:</strong>{" "}
                            {details.threshold}%
                          </p>
                        )}

                        {details.severity && (
                          <p className="timeline-time">
                            <strong>Severity:</strong>{" "}
                            {details.severity}
                          </p>
                        )}

                        {details.snapshot_id !== undefined && (
                          <p className="timeline-time">
                            <strong>Snapshot ID:</strong>{" "}
                            {details.snapshot_id}
                          </p>
                        )}

                        {details.capture_reason && (
                          <p className="timeline-time">
                            <strong>Capture reason:</strong>{" "}
                            {details.capture_reason.replace(/_/g, " ")}
                          </p>
                        )}

                        {details.collection_status && (
                          <p className="timeline-time">
                            <strong>Collection status:</strong>{" "}
                            {details.collection_status}
                          </p>
                        )}

                        {details.action && (
                          <p className="timeline-time">
                            <strong>Action:</strong> {details.action}
                          </p>
                        )}

                        {details.mode && (
                          <p className="timeline-time">
                            <strong>Mode:</strong> {details.mode}
                          </p>
                        )}

                        {details.executed !== undefined && (
                          <p className="timeline-time">
                            <strong>Executed:</strong>{" "}
                            {details.executed ? "Yes" : "No"}
                          </p>
                        )}

                        {details.result && (
                          <p className="timeline-time">
                            <strong>Result:</strong> {details.result}
                          </p>
                        )}

                        {details.audit_id !== undefined && (
                          <p className="timeline-time">
                            <strong>Audit ID:</strong> {details.audit_id}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  const renderAuditRecords = (incidentId) => {
    const records = auditHistory[incidentId];

    if (!records) return null;
    if (records.length === 0) {
      return <p>No audit records for this incident.</p>;
    }

    return records.map((record) => (
      <div key={record.id} className="audit-record">
        <p><strong>Action:</strong> {record.action}</p>
        <p><strong>Result:</strong> {record.result}</p>
        <p><strong>Mode:</strong> {record.mode}</p>
        <p>
          <strong>Executed:</strong>{" "}
          {Boolean(record.executed) ? "Yes" : "No"}
        </p>
        <p><strong>Time:</strong> {record.created_at}</p>
        {record.message && <p>{record.message}</p>}
      </div>
    ));
  };

  const renderProcessEvidence = (incidentId) => {
    const evidence = evidenceHistory[incidentId];

    if (evidenceErrors[incidentId]) {
      return <div className="error">{evidenceErrors[incidentId]}</div>;
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
          <strong>Snapshots recorded:</strong> {evidence.snapshot_count}
        </p>
        <p>
          <strong>Evidence scope:</strong> {evidence.evidence_scope}
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
      color: "#a879ff",
    },
    {
      key: "DiskUtilization",
      title: "Disk Usage",
      description: "Root Volume",
      color: "#18e5e5",
    },
  ];

  return (
    <div className="nexora-app" id="top">
      <aside className="sidebar">
        <a className="sidebar-brand" href="#top">
          <span className="brand-cloud">☁</span>
          <span>NEXORA</span>
        </a>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <a className="sidebar-link active" href="#top">
            <span className="nav-icon">▦</span>Dashboard
          </a>
          <a className="sidebar-link" href="#active-incidents">
            <span className="nav-icon">♧</span>Incidents
          </a>
          <a className="sidebar-link" href="#incident-history">
            <span className="nav-icon">◷</span>History
          </a>
          <a className="sidebar-link" href="#timeline">
            <span className="nav-icon">⌘</span>Timeline
          </a>
          <a className="sidebar-link" href="#platform-info">
            <span className="nav-icon">▤</span>Reports
          </a>
        </nav>

        <div className="sidebar-art" aria-hidden="true">
          <div className="side-orb side-orb-a" />
          <div className="side-orb side-orb-b" />
          <div className="side-cloud">☁</div>
          <div className="side-server"><i /><i /><i /></div>
          <div className="side-glow" />
        </div>

        <div className="sidebar-caption">
          <h2>Cloud<br />Reliability<br />Platform</h2>
          <p>Monitor <b>·</b> Detect<br />Diagnose <b>·</b> Remediate</p>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <label className="search-box">
            <span>⌕</span>
            <input
              aria-label="Search incidents and metrics"
              placeholder="Search incidents, metrics..."
              onChange={(event) => {
                const query = event.target.value.toLowerCase();

                document.querySelectorAll(".history-item").forEach((item) => {
                  item.style.display = item.textContent
                    .toLowerCase()
                    .includes(query)
                    ? ""
                    : "none";
                });
              }}
            />
          </label>

          <div className={`top-status ${systemStatusClass}`}>
            <i /> {systemStatus}
          </div>

          <div className="topbar-right">
            <span className="refresh-symbol">⟳</span>
            <div className="updated-label">
              <small>Last updated</small>
              <strong>
                {lastSuccessfulFetch
                  ? lastSuccessfulFetch.toLocaleTimeString()
                  : "--:--:--"}
              </strong>
            </div>
            <span className="topbar-bell">♧</span>
            <span className="topbar-avatar">●</span>
          </div>
        </div>

        {error && <div className="error global-error">{error}</div>}
        {actionError && <div className="error global-error">{actionError}</div>}

        <section className="hero-section">
          <div className="hero-copy">
            <span>Welcome to</span>
            <h1>NEXORA</h1>
            <p>Cloud Reliability &amp; Monitoring Platform</p>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-cloud">☁</div>
            <div className="hero-cloud-small">☁</div>
            <div className="hero-server hero-server-a"><i /><i /><i /></div>
            <div className="hero-globe">
              <div className="globe-line globe-line-one" />
              <div className="globe-line globe-line-two" />
              <div className="globe-line globe-line-three" />
            </div>
            <div className="hero-server hero-server-b"><i /><i /><i /></div>
            <span className="hero-star hero-star-a" />
            <span className="hero-star hero-star-b" />
            <span className="hero-star hero-star-c" />
          </div>
        </section>

        <section className="health-grid" id="overview">
          <article className="health-card health-green">
            <div className="health-icon">▤</div>
            <div>
              <strong>{freshMetricCount} / {healthSummary.length}</strong>
              <span>Fresh Metrics</span>
              <small>Latest sample within {METRIC_MAX_AGE_SECONDS}s</small>
            </div>
          </article>
          <article className="health-card health-amber">
            <div className="health-icon">◷</div>
            <div>
              <strong>{staleMetricCount}</strong>
              <span>Stale Metrics</span>
              <small>Older than {METRIC_MAX_AGE_SECONDS}s</small>
            </div>
          </article>
          <article className="health-card health-purple">
            <div className="health-icon">☁</div>
            <div>
              <strong>{noDataMetricCount}</strong>
              <span>Metrics Without Data</span>
              <small>No usable timestamp</small>
            </div>
          </article>
          <article className="health-card health-blue">
            <div className="health-icon">♢</div>
            <div>
              <strong>{incidents.length}</strong>
              <span>Active Incidents</span>
              <small>Currently reported as open</small>
            </div>
          </article>
        </section>

        <section className="trend-grid" id="trends">
          {metricCards.map((metric, index) => (
            <article
              className={`metric-panel metric-panel-${index}`}
              key={metric.key}
              style={{ "--metric-color": metric.color }}
            >
              <div className="metric-panel-head">
                <div className="metric-icon">
                  {index === 0 ? "▦" : index === 1 ? "▣" : "▤"}
                </div>
                <div className="metric-name">
                  <h2>{metric.title}</h2>
                  <p>{metric.description}</p>
                </div>
                <span className={`freshness-badge ${metricFreshness(metric.key).className}`}>
                  <i />{metricFreshness(metric.key).label}
                </span>
              </div>

              <div className="metric-current">
                <strong>
                  {latestValue(metric.key)}
                  {latestValue(metric.key) !== "--" ? "%" : ""}
                </strong>
                <small>Latest</small>
              </div>

              <MetricTrendChart
                title={metric.title}
                metric={metric.key}
                points={metrics?.[metric.key]}
                color={metric.color}
              />

              <p className="metric-samples">
                {(metrics?.[metric.key] || []).slice(-30).length} samples
                <span> · </span>{metric.key}
              </p>
            </article>
          ))}
        </section>

        <section className="operations-grid">
          <article className="panel active-panel" id="active-incidents">
            <div className="panel-heading">
              <span className="panel-icon">♧</span>
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
                <div className="clear-shield">♢</div>
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

                  <button
                    onClick={() => requestRemediation(incident.id)}
                    disabled={Boolean(loading[incident.id])}
                  >
                    {loading[incident.id] ? "Generating…" : "Recommend Remediation"}
                  </button>

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
                      {renderAuditRecords(incident.id)}
                    </details>
                  )}
                </div>
              ))
            )}
          </article>

          <article className="panel history-panel" id="incident-history">
            <div className="panel-heading">
              <span className="panel-icon">▤</span>
              <div>
                <h2>Incident History</h2>
                <p>Past incidents and their resolution status</p>
              </div>
              <a className="view-all" href="#timeline">View All</a>
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
                    <button onClick={() => fetchAudit(incident.id)}>
                      View Audit History
                    </button>
                    <button
                      onClick={() => fetchEvidence(incident.id)}
                      disabled={Boolean(evidenceLoading[incident.id])}
                    >
                      {evidenceLoading[incident.id] ? "Loading…" : "View Process Evidence"}
                    </button>
                  </div>

                  {auditHistory[incident.id] && (
                    <details className="detail-panel" open>
                      <summary>Remediation Audit History</summary>
                      {renderAuditRecords(incident.id)}
                    </details>
                  )}

                  {(evidenceHistory[incident.id] || evidenceErrors[incident.id]) && (
                    <details className="detail-panel" open>
                      <summary>Historical Process Evidence</summary>
                      {renderProcessEvidence(incident.id)}
                    </details>
                  )}
                </div>
              ))
            )}
          </article>
        </section>

        <section className="panel timeline-panel" id="timeline">
          <div className="panel-heading">
            <span className="panel-icon">♧</span>
            <div>
              <h2>Incident Timeline</h2>
              <p>
                Recorded detection, diagnosis, remediation audit, and
                recovery events from incident history.
              </p>
            </div>
            <div className="timeline-art" aria-hidden="true">
              <div className="timeline-server"><i /><i /><i /></div>
              <span>♢</span>
              <div className="timeline-server"><i /><i /><i /></div>
            </div>
          </div>

          <div className="timeline-list">{renderIncidentTimeline()}</div>
        </section>

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
      </main>
    </div>
  );
}

export default App;
