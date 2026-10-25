import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://98.91.2.103:8000";
const METRIC_MAX_AGE_SECONDS = 180;

/* ---------- Small helpers ---------- */

const ICONS = {
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  box: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
  cpu: "M5 5h14v14H5z M9 9h6v6H9z M9 1v4 M15 1v4 M9 19v4 M15 19v4 M19 9h4 M19 15h4 M1 9h4 M1 15h4",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  search: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M21 21l-4.35-4.35",
  bulb: "M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z",
  calendar: "M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18",
  down: "M6 9l6 6 6-6",
  right: "M9 18l6-6-6-6",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  upright: "M7 17L17 7 M7 7h10v10",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8",
  cloud: "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  disk: "M12 3c4.97 0 9 1.34 9 3s-4.03 3-9 3-9-1.34-9-3 4.03-3 9-3z M3 6v6c0 1.66 4.03 3 9 3s9-1.34 9-3V6 M3 12v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6",
};

function Icon({ name, size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

const toSeries = (points) =>
  (points || [])
    .slice(-30)
    .map((point, index) => {
      const time = point.timestamp ? new Date(point.timestamp).getTime() : NaN;
      return {
        t: Number.isNaN(time) ? index : time,
        v: Number(point.value),
      };
    })
    .filter((point) => Number.isFinite(point.v));

const timeAgo = (timestamp) => {
  if (!timestamp) return "—";
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const priorityOf = (severity = "") => {
  if (/crit|high/i.test(severity)) return { label: "High", tone: "red" };
  if (/med|warn/i.test(severity)) return { label: "Medium", tone: "amber" };
  return { label: "Low", tone: "grey" };
};

/* ---------- Main utilization chart (with hover tooltip) ---------- */

function UtilizationChart({ series }) {
  const [hoverT, setHoverT] = useState(null);

  const width = 1000;
  const height = 200;
  const pad = { top: 14, right: 30, bottom: 36, left: 48 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const all = series.flatMap((s) => s.data);

  if (all.length === 0) {
    return <div className="trend-empty">Waiting for CloudWatch samples…</div>;
  }

  const tMin = Math.min(...all.map((p) => p.t));
  let tMax = Math.max(...all.map((p) => p.t));
  if (tMax === tMin) tMax = tMin + 1;
  const isTime = tMin > 1e11;

  const x = (t) => pad.left + ((t - tMin) / (tMax - tMin)) * cw;
  const y = (v) =>
    pad.top + ((100 - Math.max(0, Math.min(100, v))) / 100) * ch;

  const fmt = (t) =>
    isTime
      ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : `#${Math.round(t) + 1}`;

  const ticks = Array.from({ length: 6 }, (_, i) => tMin + ((tMax - tMin) * i) / 5);

  const nearest = (data, t) =>
    data.reduce(
      (best, p) => (best === null || Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best),
      null
    );

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const vx = ((event.clientX - rect.left) / rect.width) * width;
    const clamped = Math.max(pad.left, Math.min(pad.left + cw, vx));
    setHoverT(tMin + ((clamped - pad.left) / cw) * (tMax - tMin));
  };

  const base = series.find((s) => s.data.length > 0);
  const anchor = hoverT !== null && base ? nearest(base.data, hoverT) : null;
  const hovered = anchor
    ? series
        .map((s) => ({ ...s, point: nearest(s.data, anchor.t) }))
        .filter((s) => s.point)
    : [];
  const leftPct = anchor ? (x(anchor.t) / width) * 100 : 0;

  return (
    <div className="big-chart-wrap">
      <svg
        className="big-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Resource utilization chart"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverT(null)}
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              y1={y(tick)}
              x2={width - pad.right}
              y2={y(tick)}
              className="trend-grid-line"
            />
            <text
              x={pad.left - 12}
              y={y(tick) + 4}
              textAnchor="end"
              className="trend-axis-label"
            >
              {tick}%
            </text>
          </g>
        ))}

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={x(t)}
              y1={pad.top}
              x2={x(t)}
              y2={pad.top + ch}
              className="trend-grid-line vertical"
            />
            <text
              x={x(t)}
              y={height - 10}
              textAnchor="middle"
              className="trend-axis-label"
            >
              {fmt(t)}
            </text>
          </g>
        ))}

        {series.map((s) =>
          s.data.length > 0 ? (
            <path
              key={s.key}
              d={s.data
                .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t)} ${y(p.v)}`)
                .join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null
        )}

        {anchor && (
          <g>
            <line
              x1={x(anchor.t)}
              y1={pad.top}
              x2={x(anchor.t)}
              y2={pad.top + ch}
              stroke="#ffffff"
              strokeOpacity="0.7"
              strokeDasharray="3 4"
            />
            {hovered.map((s) => (
              <g key={s.key}>
                <circle cx={x(s.point.t)} cy={y(s.point.v)} r="8" fill={s.color} fillOpacity="0.25" />
                <circle cx={x(s.point.t)} cy={y(s.point.v)} r="4" fill="#0b0b14" stroke={s.color} strokeWidth="2" />
              </g>
            ))}
          </g>
        )}
      </svg>

      {anchor && (
        <div
          className="chart-tooltip"
          style={
            leftPct > 60
              ? { left: `calc(${leftPct}% - 220px)` }
              : { left: `calc(${leftPct}% + 14px)` }
          }
        >
          <div className="chart-tooltip-time">{fmt(anchor.t)}</div>
          {hovered.map((s) => (
            <div className="chart-tooltip-row" key={s.key}>
              <i style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>{Math.round(s.point.v)}%</b>
            </div>
          ))}
        </div>
      )}

      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- App ---------- */

function App() {
  const [metrics, setMetrics] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [history, setHistory] = useState([]);

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

  const [chartMetric, setChartMetric] = useState("ALL");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

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

  const fetchTimeline = async (incidentId) => {
    setTimelineLoading((previous) => ({ ...previous, [incidentId]: true }));
    setTimelineErrors((previous) => ({ ...previous, [incidentId]: "" }));

    try {
      const response = await fetch(`${API_URL}/incidents/${incidentId}/timeline`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load incident timeline");
      }

      const events = Array.isArray(data)
        ? data
        : data.timeline || data.events || [];

      setTimelineHistory((previous) => ({ ...previous, [incidentId]: events }));
    } catch (err) {
      setTimelineErrors((previous) => ({
        ...previous,
        [incidentId]: err.message || "Could not load incident timeline.",
      }));
    } finally {
      setTimelineLoading((previous) => ({ ...previous, [incidentId]: false }));
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
      setActionError(`Could not load audit history for incident #${incidentId}.`);
    }
  };

  const fetchEvidence = async (incidentId) => {
    setEvidenceLoading((previous) => ({ ...previous, [incidentId]: true }));
    setEvidenceErrors((previous) => ({ ...previous, [incidentId]: "" }));

    try {
      const response = await fetch(
        `${API_URL}/incidents/${incidentId}/diagnosis/evidence`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load process evidence");
      }

      setEvidenceHistory((previous) => ({ ...previous, [incidentId]: data }));
    } catch (err) {
      setEvidenceErrors((previous) => ({
        ...previous,
        [incidentId]: err.message || "Could not load process evidence.",
      }));
    } finally {
      setEvidenceLoading((previous) => ({ ...previous, [incidentId]: false }));
    }
  };

  const requestRemediation = async (incidentId) => {
    setLoading((previous) => ({ ...previous, [incidentId]: true }));
    setActionError("");

    try {
      const response = await fetch(
        `${API_URL}/incidents/${incidentId}/remediation/recommend`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Recommendation request failed");
      }

      setRecommendations((previous) => ({
        ...previous,
        [incidentId]: data.recommendation,
      }));

      await fetchAudit(incidentId);
      await fetchTimeline(incidentId);
    } catch (err) {
      setActionError(err.message || "Unable to create recommendation.");
    } finally {
      setLoading((previous) => ({ ...previous, [incidentId]: false }));
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

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

  const hasMetricData = healthSummary.some((item) => item.className === "live");
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

  const metricCards = [
    {
      key: "CPUUtilization",
      title: "CPU Usage",
      label: "CPU Utilization",
      description: "EC2 Instance",
      icon: "cpu",
      color: "#b4a9d6",
    },
    {
      key: "MemoryUtilization",
      title: "Memory Usage",
      label: "Memory Utilization",
      description: "EC2 Instance",
      icon: "box",
      color: "#d9dce4",
    },
    {
      key: "DiskUtilization",
      title: "Disk Usage",
      label: "Disk Utilization",
      description: "Root Volume",
      icon: "disk",
      color: "#7c808e",
    },
  ];

  const chartSeries = metricCards
    .filter((m) => chartMetric === "ALL" || m.key === chartMetric)
    .map((m) => ({
      key: m.key,
      label: m.label,
      color: m.color,
      data: toSeries(metrics?.[m.key]),
    }));

  const chartTitle =
    chartMetric === "ALL"
      ? "Resource Utilization"
      : metricCards.find((m) => m.key === chartMetric)?.label;

  /* ---- Summary cards: numbers only, no graph ---- */
  const statCards = [
    {
      id: "fresh",
      icon: "activity",
      label: "Fresh Metrics",
      value: `${freshMetricCount} / ${healthSummary.length}`,
      foot: "Latest sample within 180s",
    },
    {
      id: "stale",
      icon: "clock",
      label: "Stale Metrics",
      value: staleMetricCount,
      foot: "Older than 180s",
    },
    {
      id: "nodata",
      icon: "cloud",
      label: "Metrics Without Data",
      value: noDataMetricCount,
      foot: "No usable timestamp",
    },
    {
      id: "incidents",
      icon: "bell",
      label: "Active Incidents",
      value: incidents.length,
      foot: "Currently reported as open",
    },
  ];

  const pillTone = { live: "green", stale: "amber", "no-data": "purple" };

  /* ---------- Existing detail renderers (unchanged) ---------- */

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
              <strong>Detected:</strong> {formatTimelineTime(incident.created_at)}
            </p>

            {incident.resolved_at && (
              <p className="timeline-time">
                <strong>Resolved:</strong> {formatTimelineTime(incident.resolved_at)}
              </p>
            )}

            <p className="timeline-time">
              <strong>Recorded value:</strong> {incident.value}%{" · "}
              <strong>Threshold:</strong> {incident.threshold}%
            </p>

            <div className="timeline-events">
              <h4>Recorded Events</h4>

              {timelineLoading[incident.id] ? (
                <p>Loading incident events…</p>
              ) : timelineErrors[incident.id] ? (
                <div>
                  <p className="error">{timelineErrors[incident.id]}</p>
                  <button onClick={() => fetchTimeline(incident.id)}>
                    Retry timeline
                  </button>
                </div>
              ) : !events ? (
                <button onClick={() => fetchTimeline(incident.id)}>
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
                            <strong>Threshold:</strong> {details.threshold}%
                          </p>
                        )}

                        {details.severity && (
                          <p className="timeline-time">
                            <strong>Severity:</strong> {details.severity}
                          </p>
                        )}

                        {details.snapshot_id !== undefined && (
                          <p className="timeline-time">
                            <strong>Snapshot ID:</strong> {details.snapshot_id}
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
          <strong>Executed:</strong> {Boolean(record.executed) ? "Yes" : "No"}
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
  };

  const dateLabel = `${now.toLocaleDateString("en-US", { weekday: "short" })}, ${now.getDate()} ${now.toLocaleDateString("en-US", { month: "short" })} ${now.getFullYear()}`;
  const timeLabel = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const recentIncidents = history.slice(0, 3);

  return (
    <div className="nexora-app" id="top">
      {/* ================= Sidebar ================= */}
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
            {incidents.length > 0 && (
              <span className="nav-badge">{incidents.length}</span>
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
            <span>{error ? "Disconnected" : "Connected to AWS"}</span>
            <i className={`conn-dot ${error ? "down" : ""}`} />
          </div>

          <div className="side-user">
            <span className="avatar-circle">BS</span>
            <strong>Bhavni Sharma</strong>
            <span className="side-user-arrow"><Icon name="right" size={18} /></span>
          </div>
        </div>
      </aside>

      {/* ================= Main ================= */}
      <main className="main-content">
        <div className="topbar">
          <label className="search-box">
            <span><Icon name="search" size={20} /></span>
            <input
              aria-label="Search incidents and metrics"
              placeholder="Search instances, incidents, metrics..."
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

          <div className="topbar-right">
            <div className={`top-status ${systemStatusClass}`}>
              <i /> {systemStatus}
            </div>
            <a className="topbar-bell" href="#active-incidents" aria-label="Incidents">
              <Icon name="bell" size={24} />
              {incidents.length > 0 && <i className="bell-dot" />}
            </a>
            <span className="topbar-avatar">BS</span>
          </div>
        </div>

        {error && <div className="error global-error">{error}</div>}
        {actionError && <div className="error global-error">{actionError}</div>}

        <section className="welcome-row">
          <div>
            <h1>
              Welcome back, <span>Bhavni</span>
            </h1>
            <p>Here&apos;s what&apos;s happening with your AWS infrastructure.</p>
          </div>

          <div className="welcome-meta">
            <div className="welcome-date">
              <div>{dateLabel}</div>
              <strong>{timeLabel}</strong>
            </div>
            <div className="range-pill" title="Dashboard refreshes automatically">
              <Icon name="calendar" size={20} />
              <span>
                {lastSuccessfulFetch
                  ? `Updated ${lastSuccessfulFetch.toLocaleTimeString()}`
                  : "Waiting for data"}
              </span>
              <Icon name="down" size={18} />
            </div>
          </div>
        </section>

        {/* ---- Stat cards (numbers only) ---- */}
        <section className="stat-grid" id="overview">
          {statCards.map((card) => (
            <article className="stat-card" key={card.id}>
              <div className="stat-icon">
                <Icon name={card.icon} size={26} />
              </div>
              <div className="stat-body">
                <span className="stat-label">{card.label}</span>
                <strong className="stat-value">{card.value}</strong>
                <small className="stat-foot">{card.foot}</small>
              </div>
            </article>
          ))}
        </section>

        {/* ---- Big chart ---- */}
        <section className="panel chart-panel" id="trends">
          <div className="panel-heading">
            <span className="panel-icon"><Icon name="cpu" size={24} /></span>
            <div>
              <h2>{chartTitle}</h2>
              <p>Real-time CloudWatch metrics from your EC2 instance</p>
            </div>
            <label className="select-wrap">
              <select
                value={chartMetric}
                onChange={(event) => setChartMetric(event.target.value)}
                aria-label="Choose metric"
              >
                <option value="ALL">All Metrics</option>
                {metricCards.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <Icon name="down" size={16} />
            </label>
          </div>

          <UtilizationChart series={chartSeries} />
        </section>

        {/* ---- Three summary panels ---- */}
        <section className="tri-grid">
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

          <article className="panel">
            <div className="panel-heading">
              <span className="panel-icon"><Icon name="box" size={20} /></span>
              <h2>Metric Health</h2>
              <a className="view-all" href="#trends">
                {freshMetricCount}/{healthSummary.length} live <Icon name="arrow" size={14} />
              </a>
            </div>

            {metricCards.map((m) => {
              const fresh = metricFreshness(m.key);
              const value = latestValue(m.key);
              return (
                <div className="list-row" key={m.key}>
                  <i className={`row-dot ${pillTone[fresh.className]}`} />
                  <div className="row-main">
                    <strong>{m.title}</strong>
                    <span>{m.description}</span>
                  </div>
                  <div className="row-side">
                    <span className={`pill ${pillTone[fresh.className]}`}>
                      {fresh.label}
                    </span>
                    <small>{value === "--" ? "--" : `${value}%`}</small>
                  </div>
                </div>
              );
            })}
          </article>

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
                    onClick={() => requestRemediation(incident.id)}
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

        {/* ---- Existing detail panels (unchanged behaviour) ---- */}
        <section className="operations-grid">
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
            <span className="panel-icon"><Icon name="activity" size={20} /></span>
            <div>
              <h2>Incident Timeline</h2>
              <p>
                Recorded detection, diagnosis, remediation audit, and
                recovery events from incident history.
              </p>
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