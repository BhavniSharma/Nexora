const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function getMetrics(instanceId = "ALL") {
  const res = await fetch(`${API_URL}/metrics?instance_id=${encodeURIComponent(instanceId)}`);
  if (!res.ok) throw new Error("Failed to load metrics");
  return res.json();
}

export async function getIncidents(instanceId) {
  const url = instanceId
    ? `${API_URL}/incidents?instance_id=${encodeURIComponent(instanceId)}`
    : `${API_URL}/incidents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load active incidents");
  return res.json();
}

export async function getIncidentHistory(instanceId) {
  const url = instanceId
    ? `${API_URL}/incidents/history?instance_id=${encodeURIComponent(instanceId)}`
    : `${API_URL}/incidents/history`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load incident history");
  return res.json();
}

export async function getInstances() {
  const res = await fetch(`${API_URL}/instances`);
  if (!res.ok) throw new Error("Failed to load instances");
  return res.json();
}

export async function getTimeline(incidentId) {
  const res = await fetch(`${API_URL}/incidents/${incidentId}/timeline`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to load timeline");
  return data;
}

export async function getRemediationAudit(incidentId) {
  const res = await fetch(`${API_URL}/incidents/${incidentId}/remediation/audit`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to load remediation audit");
  return data;
}

export async function getProcessEvidence(incidentId) {
  const res = await fetch(`${API_URL}/incidents/${incidentId}/diagnosis/evidence`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to load process evidence");
  return data;
}

export async function postRecommendRemediation(incidentId) {
  const res = await fetch(`${API_URL}/incidents/${incidentId}/remediation/recommend`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to generate recommendation");
  return data;
}

export async function postResolveIncident(incidentId) {
  const res = await fetch(`${API_URL}/incidents/${incidentId}/resolve`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to resolve incident");
  return data;
}

export async function postSimulateSpike(
  metric = "CPUUtilization",
  value = 94.6,
  reason = "Simulated chaos spike / peak workload"
) {
  const res = await fetch(`${API_URL}/intelligence/simulate-spike`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metric, value, reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to trigger simulated spike");
  return data;
}
