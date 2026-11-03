import { useEffect, useState } from "react";
import "./App.css";

import Icon from "./components/common/Icon";
import PlatformFooter from "./components/common/PlatformFooter";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import StatGrid from "./components/dashboard/StatGrid";
import TriGrid from "./components/dashboard/TriGrid";
import UtilizationChart from "./components/charts/UtilizationChart";
import ActiveIncidentsPanel from "./components/incidents/ActiveIncidentsPanel";
import IncidentHistoryPanel from "./components/incidents/IncidentHistoryPanel";
import TimelinePanel from "./components/incidents/TimelinePanel";

import { toSeries } from "./utils/helpers";
import {
  getMetrics,
  getIncidents,
  getIncidentHistory,
  getTimeline,
  getRemediationAudit,
  getProcessEvidence,
  getInstances,
  postRecommendRemediation,
  postResolveIncident,
  postSimulateSpike,
} from "./services/api";

const METRIC_MAX_AGE_SECONDS = 180;

const METRIC_CARDS = [
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

export default function App() {
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
  const [simulating, setSimulating] = useState(false);

  const [instances, setInstances] = useState([]);
  const [instanceId, setInstanceId] = useState("ALL");

  const [chartMetric, setChartMetric] = useState("ALL");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      const [metricsData, incidentsData, historyData] = await Promise.all([
        getMetrics(instanceId),
        getIncidents(instanceId),
        getIncidentHistory(instanceId),
      ]);

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

  const fetchInstances = async () => {
    try {
      const data = await getInstances();
      setInstances(data.instances || []);
    } catch {
      setInstances([]);
    }
  };

  const fetchTimeline = async (incidentId) => {
    setTimelineLoading((prev) => ({ ...prev, [incidentId]: true }));
    setTimelineErrors((prev) => ({ ...prev, [incidentId]: "" }));

    try {
      const data = await getTimeline(incidentId);
      const events = Array.isArray(data)
        ? data
        : data.timeline || data.events || [];
      setTimelineHistory((prev) => ({ ...prev, [incidentId]: events }));
    } catch (err) {
      setTimelineErrors((prev) => ({
        ...prev,
        [incidentId]: err.message || "Could not load incident timeline.",
      }));
    } finally {
      setTimelineLoading((prev) => ({ ...prev, [incidentId]: false }));
    }
  };

  const fetchAudit = async (incidentId) => {
    try {
      const data = await getRemediationAudit(incidentId);
      setAuditHistory((prev) => ({
        ...prev,
        [incidentId]: data.audit_history,
      }));
      setActionError("");
    } catch {
      setActionError(`Could not load audit history for incident #${incidentId}.`);
    }
  };

  const fetchEvidence = async (incidentId) => {
    setEvidenceLoading((prev) => ({ ...prev, [incidentId]: true }));
    setEvidenceErrors((prev) => ({ ...prev, [incidentId]: "" }));

    try {
      const data = await getProcessEvidence(incidentId);
      setEvidenceHistory((prev) => ({ ...prev, [incidentId]: data }));
    } catch (err) {
      setEvidenceErrors((prev) => ({
        ...prev,
        [incidentId]: err.message || "Could not load process evidence.",
      }));
    } finally {
      setEvidenceLoading((prev) => ({ ...prev, [incidentId]: false }));
    }
  };

  const requestRemediation = async (incidentId) => {
    setLoading((prev) => ({ ...prev, [incidentId]: true }));
    setActionError("");

    try {
      const data = await postRecommendRemediation(incidentId);
      setRecommendations((prev) => ({
        ...prev,
        [incidentId]: data.recommendation,
      }));
      await fetchAudit(incidentId);
      await fetchTimeline(incidentId);
    } catch (err) {
      setActionError(err.message || "Unable to create recommendation.");
    } finally {
      setLoading((prev) => ({ ...prev, [incidentId]: false }));
    }
  };

  const resolveIncident = async (incidentId) => {
    setLoading((prev) => ({ ...prev, [incidentId]: true }));
    setActionError("");
    try {
      await postResolveIncident(incidentId);
      await fetchData();
      await fetchTimeline(incidentId);
    } catch (err) {
      setActionError(err.message || "Unable to resolve incident.");
    } finally {
      setLoading((prev) => ({ ...prev, [incidentId]: false }));
    }
  };

  const triggerSimulatedSpike = async (metric = "CPUUtilization") => {
    setSimulating(true);
    setActionError("");
    try {
      await postSimulateSpike(
        metric,
        metric === "DiskUtilization" ? 89.2 : 94.6,
        "Simulated chaos spike / peak workload"
      );
      await fetchData();
    } catch (err) {
      setActionError(err.message || "Failed to trigger spike simulation.");
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [instanceId]);

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

  const isMulti = instanceId === "ALL";
  const singleMetrics = isMulti ? null : metrics;

  const latestPoint = (metric) => {
    const points = singleMetrics?.[metric];
    if (!points?.length) return null;
    return points[points.length - 1];
  };

  const latestValue = (metric) => {
    const point = latestPoint(metric);
    return point ? point.value : "--";
  };

  const metricFreshness = (metric) => {
    const point = latestPoint(metric);
    if (!point?.timestamp) return { label: "NO DATA", className: "no-data" };
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

  const healthSummary = METRIC_CARDS.map((m) => ({
    metric: m.key,
    ...metricFreshness(m.key),
  }));

  const freshMetricCount = healthSummary.filter((i) => i.className === "live").length;
  const staleMetricCount = healthSummary.filter((i) => i.className === "stale").length;
  const noDataMetricCount = healthSummary.filter((i) => i.className === "no-data").length;
  const hasMetricData = healthSummary.some((i) => i.className === "live");
  const allMetricsFresh = freshMetricCount === healthSummary.length;
  const hasActiveIncidents = incidents.length > 0;

  let systemStatus = "Waiting for Metrics";
  let systemStatusClass = "warning";
  if (hasActiveIncidents) {
    systemStatus = `${incidents.length} Active Incident${incidents.length === 1 ? "" : "s"}`;
    systemStatusClass = "critical";
  } else if (isMulti && instances.length > 0) {
    const critical = instances.some((i) => i.status === "critical");
    const warning = instances.some((i) => i.status === "warning");
    const healthy = instances.some((i) => i.status === "healthy");
    if (critical) {
      systemStatus = "Critical Instances";
      systemStatusClass = "critical";
    } else if (warning) {
      systemStatus = "Instances Degraded";
      systemStatusClass = "warning";
    } else if (healthy) {
      systemStatus = "All Instances Healthy";
      systemStatusClass = "healthy";
    }
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

  const chartSeries = METRIC_CARDS
    .filter((m) => chartMetric === "ALL" || m.key === chartMetric)
    .map((m) => ({
      key: m.key,
      label: m.label,
      color: m.color,
      data: toSeries(singleMetrics?.[m.key]),
    }));

  const chartTitle =
    chartMetric === "ALL"
      ? "Resource Utilization"
      : METRIC_CARDS.find((m) => m.key === chartMetric)?.label;

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

  const dateLabel = `${now.toLocaleDateString("en-US", { weekday: "short" })}, ${now.getDate()} ${now.toLocaleDateString("en-US", { month: "short" })} ${now.getFullYear()}`;
  const timeLabel = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const recentIncidents = history.slice(0, 3);

  return (
    <div className="nexora-app" id="top">
      <Sidebar incidentCount={incidents.length} isConnected={!error} />

      <main className="main-content">
        <Topbar
          systemStatus={systemStatus}
          systemStatusClass={systemStatusClass}
          incidentCount={incidents.length}
        />

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

            <button
              type="button"
              className="spike-btn"
              onClick={() => triggerSimulatedSpike("CPUUtilization")}
              disabled={simulating}
              title="Simulate high CPU spike on EC2 instance to test automated incident lifecycle"
            >
              <Icon name="activity" size={18} />
              <span>{simulating ? "Injecting Spike…" : "Simulate CPU Spike"}</span>
            </button>

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

        <div className="instance-select-wrap">
          <label>View instances</label>
          <select
            value={instanceId}
            onChange={(event) => setInstanceId(event.target.value)}
            aria-label="Choose instance"
          >
            <option value="ALL">All Instances</option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} ({inst.id})
              </option>
            ))}
          </select>
          <Icon name="down" size={16} />
        </div>

        {isMulti ? (
          <section className="instance-grid" id="instances-overview">
            {instances.map((inst) => {
              const instMetrics = (metrics || {})[inst.id];
              const latest = {};
              METRIC_CARDS.forEach((m) => {
                const pts = instMetrics?.[m.key];
                latest[m.key] = pts?.length ? pts[pts.length - 1].value : "--";
              });
              const status = inst.status || "healthy";
              return (
                <article key={inst.id} className="instance-card">
                  <div className="instance-card-header">
                    <strong>{inst.name}</strong>
                    <span className={`instance-status ${status}`}>{status}</span>
                  </div>
                  <div className="instance-body">
                    {METRIC_CARDS.map((m) => (
                      <div key={m.key} className="instance-metric">
                        <span className="instance-metric-label">{m.label}</span>
                        <strong className="instance-metric-value">
                          {latest[m.key]}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="instance-foot">
                    {inst.role} &bull; {inst.zone}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <>
            <StatGrid cards={statCards} />
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
                    {METRIC_CARDS.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                  <Icon name="down" size={16} />
                </label>
              </div>

              <UtilizationChart series={chartSeries} />
            </section>
          </>
        )}

        <TriGrid
          recentIncidents={recentIncidents}
          metricCards={METRIC_CARDS}
          metricFreshness={metricFreshness}
          latestValue={latestValue}
          freshMetricCount={freshMetricCount}
          healthSummaryLength={healthSummary.length}
          incidents={incidents}
          recommendations={recommendations}
          loading={loading}
          onRequestRemediation={requestRemediation}
        />

        <section className="operations-grid">
          <ActiveIncidentsPanel
            incidents={incidents}
            recommendations={recommendations}
            auditHistory={auditHistory}
            loading={loading}
            onRequestRemediation={requestRemediation}
            onResolveIncident={resolveIncident}
          />

          <IncidentHistoryPanel
            history={history}
            auditHistory={auditHistory}
            evidenceHistory={evidenceHistory}
            evidenceLoading={evidenceLoading}
            evidenceErrors={evidenceErrors}
            onFetchAudit={fetchAudit}
            onFetchEvidence={fetchEvidence}
          />
        </section>

        <TimelinePanel
          history={history}
          timelineHistory={timelineHistory}
          timelineLoading={timelineLoading}
          timelineErrors={timelineErrors}
          onFetchTimeline={fetchTimeline}
        />

        <PlatformFooter />
      </main>
    </div>
  );
}
