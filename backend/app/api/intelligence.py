import json
import os
from datetime import datetime, timezone
from statistics import median
from typing import Optional

import joblib
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.database.db import get_db
from app.services.cloudwatch_service import inject_spike

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])

# Paths to trained ML models
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "..", "ml", "models"))
ML_MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest.joblib")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.joblib")

_ml_model = None
_ml_preprocessor = None


def get_ml_pipeline():
    global _ml_model, _ml_preprocessor
    if _ml_model is None and os.path.exists(ML_MODEL_PATH) and os.path.exists(SCALER_PATH):
        try:
            from ml.preprocessing.pipeline import TelemetryPreprocessor
            _ml_model = joblib.load(ML_MODEL_PATH)
            _ml_preprocessor = TelemetryPreprocessor.load(SCALER_PATH)
        except Exception:
            _ml_model = None
            _ml_preprocessor = None
    return _ml_model, _ml_preprocessor


class MetricSample(BaseModel):
    cpu: float = Field(ge=0, le=100)
    memory: float = Field(ge=0, le=100)
    disk: float = Field(ge=0, le=100)


class AnalysisRequest(BaseModel):
    current: MetricSample
    history: list[MetricSample] = Field(default_factory=list)
    process_evidence: Optional[list[str]] = None


class SpikeSimulationRequest(BaseModel):
    metric: str = Field(default="CPUUtilization")
    instance_id: Optional[str] = Field(default="i-09a8b7c6d5e4f002")
    value: float = Field(default=94.5, ge=50, le=100)
    reason: Optional[str] = "Simulated unexpected workload saturation"


@router.post("/anomalies")
def detect_anomalies(request: AnalysisRequest):
    """Detect unusually high metrics using both statistical MAD and trained ML Isolation Forest."""
    metrics = {
        "CPU": request.current.cpu,
        "Memory": request.current.memory,
        "Disk": request.current.disk,
    }

    anomalies = []

    # 1. Statistical Baseline (Median Absolute Deviation)
    for name, current_value in metrics.items():
        historical_values = [
            getattr(sample, name.lower())
            for sample in request.history
        ]

        if len(historical_values) < 5:
            if current_value >= 80:
                anomalies.append({
                    "metric": name,
                    "current_value": current_value,
                    "baseline": None,
                    "reason": "High utilization; historical baseline unavailable.",
                    "severity": "high",
                })
            continue

        baseline = median(historical_values)
        deviations = [
            abs(value - baseline) for value in historical_values
        ]
        mad = median(deviations)

        threshold = max(10.0, 3 * 1.4826 * mad)

        if current_value - baseline > threshold:
            anomalies.append({
                "metric": name,
                "current_value": current_value,
                "baseline": round(baseline, 2),
                "deviation": round(current_value - baseline, 2),
                "reason": "Current utilization is unusually high relative to history.",
                "severity": (
                    "critical" if current_value >= 90 else "medium"
                ),
            })

    # 2. Machine Learning Pipeline (Isolation Forest)
    ml_model, ml_preprocessor = get_ml_pipeline()
    ml_inference = None

    if ml_model is not None and ml_preprocessor is not None:
        try:
            curr_dict = {"cpu": request.current.cpu, "memory": request.current.memory, "disk": request.current.disk}
            hist_dicts = [
                {"cpu": h.cpu, "memory": h.memory, "disk": h.disk}
                for h in request.history[-10:]
            ]
            X = ml_preprocessor.transform_single(curr_dict, hist_dicts)
            pred = ml_model.predict(X)[0]  # -1 = anomaly, 1 = normal
            score = ml_model.decision_function(X)[0]

            ml_inference = {
                "model": "Isolation Forest (Unsupervised ML)",
                "prediction": "ANOMALY" if pred == -1 else "NORMAL",
                "is_anomaly": bool(pred == -1),
                "decision_score": round(float(score), 4),
                "status": "Trained ML model active"
            }
        except Exception as err:
            ml_inference = {"status": f"Inference bypassed: {err}"}

    return {
        "anomaly_count": len(anomalies),
        "anomalies": anomalies,
        "historical_samples": len(request.history),
        "ml_inference": ml_inference,
        "pipeline": "Dual-Engine (Statistical MAD + Scikit-Learn Isolation Forest)",
    }


@router.post("/diagnosis")
def generate_diagnosis(request: AnalysisRequest):
    """Generate evidence-based diagnostic hints from supplied metrics."""
    current = request.current
    findings = []

    if current.cpu >= 80:
        findings.append({
            "metric": "CPU",
            "observation": f"CPU utilization is {current.cpu}%.",
            "possible_cause": "CPU-intensive process or increased workload.",
            "recommended_action": (
                "Inspect top CPU-consuming processes and application logs."
            ),
        })

    if current.memory >= 80:
        findings.append({
            "metric": "Memory",
            "observation": f"Memory utilization is {current.memory}%.",
            "possible_cause": "High memory demand or a possible memory leak.",
            "recommended_action": (
                "Inspect process memory usage and check for OOM events."
            ),
        })

    if current.disk >= 85:
        findings.append({
            "metric": "Disk",
            "observation": f"Disk utilization is {current.disk}%.",
            "possible_cause": "Low remaining disk capacity.",
            "recommended_action": (
                "Inspect filesystem usage and large log or temporary files."
            ),
        })

    evidence = request.process_evidence or []

    return {
        "status": "findings" if findings else "normal",
        "findings": findings,
        "process_evidence": evidence,
        "evidence_note": (
            "Process evidence is supplied by the caller; "
            "it has not been independently verified by this endpoint."
        ),
        "message": (
            "Investigate the findings above."
            if findings
            else "No configured high-utilization condition detected."
        ),
    }


@router.post("/simulate-spike")
def simulate_spike(request: SpikeSimulationRequest):
    """
    Simulate a metric spike, injecting telemetry and automatically generating
    an incident with forensic process snapshots and timeline events.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    metric = request.metric
    inst_id = request.instance_id or "i-09a8b7c6d5e4f002"
    val = request.value
    reason = request.reason or "Simulated unexpected workload saturation"

    inject_spike(metric, inst_id, val, duration_seconds=300)

    if "mem" in metric.lower():
        threshold = 80.0
        processes = [
            {"command": "node /opt/cache_aggregator.js (leak: 12.8 GB)", "pid": 6340, "cpu_percent": 14.2, "memory_percent": 74.8},
            {"command": "python memory_profiler.py", "pid": 5122, "cpu_percent": 8.1, "memory_percent": 11.5},
            {"command": "systemd-journald", "pid": 489, "cpu_percent": 1.2, "memory_percent": 4.1},
        ]
        msg = f"Memory pressure warning on {inst_id}: allocation reached {val}% ({reason})"
    elif "disk" in metric.lower():
        threshold = 85.0
        processes = [
            {"command": "mysqld-binlog-rotator (uncompressed archive dump)", "pid": 9811, "cpu_percent": 22.4, "memory_percent": 15.6},
            {"command": "tar -czf /tmp/backup_full.tar.gz", "pid": 8412, "cpu_percent": 35.1, "memory_percent": 8.4},
        ]
        msg = f"Root volume storage saturation on {inst_id}: {val}% reached ({reason})"
    else:
        threshold = 80.0
        processes = [
            {"command": "python deep_batch_inference.py --threads=32", "pid": 7192, "cpu_percent": 84.6, "memory_percent": 9.2},
            {"command": "ffmpeg -i stream.mp4 -f mpegts -", "pid": 6012, "cpu_percent": 11.3, "memory_percent": 4.5},
            {"command": "sshd: worker [priv]", "pid": 1102, "cpu_percent": 0.8, "memory_percent": 1.1},
        ]
        msg = f"CPU anomaly detected on {inst_id}: utilization jumped to {val}% ({reason})"

    severity = "critical" if val >= 90 else "high"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO incidents (instance_id, metric, value, threshold, severity, status, message, created_at, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (inst_id, metric, val, threshold, severity, "OPEN", msg, now_iso, None))
        incident_id = cursor.lastrowid

        snap_data = {
            "message": f"Forensic snapshot automatically frozen at anomaly threshold breach ({val}%).",
            "processes": processes
        }
        cursor.execute("""
            INSERT INTO process_snapshots (incident_id, captured_at, capture_reason, collection_status, metric_value, threshold, process_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (incident_id, now_iso, "THRESHOLD_BREACH", "COMPLETED", val, threshold, json.dumps(snap_data)))
        snapshot_id = cursor.lastrowid

        timeline_details = {
            "metric": metric,
            "value": val,
            "threshold": threshold,
            "severity": severity,
            "snapshot_id": snapshot_id,
            "message": msg
        }
        cursor.execute("""
            INSERT INTO timeline_events (incident_id, event_type, title, timestamp, details)
            VALUES (?, ?, ?, ?, ?)
        """, (incident_id, "DETECTION", f"Automated Anomaly Detection: {metric} Spike", now_iso, json.dumps(timeline_details)))

        conn.commit()

    return {
        "status": "spike_simulated",
        "incident_id": incident_id,
        "metric": metric,
        "value": val,
        "severity": severity,
        "message": msg
    }
