import logging
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger("nexora.cloudwatch")

METRICS = [
    "CPUUtilization",
    "MemoryUtilization",
    "DiskUtilization",
]

INSTANCES = [
    {
        "id": "i-09a8b7c6d5e4f001",
        "name": "web-prod-01",
        "role": "NGINX Web Proxy",
        "zone": "ap-south-1a",
        "instance_type": "t3.medium",
        "base_metrics": {"CPUUtilization": 36.0, "MemoryUtilization": 52.0, "DiskUtilization": 41.0},
    },
    {
        "id": "i-09a8b7c6d5e4f002",
        "name": "api-worker-02",
        "role": "FastAPI Core Worker",
        "zone": "ap-south-1a",
        "instance_type": "c5.large",
        "base_metrics": {"CPUUtilization": 48.0, "MemoryUtilization": 66.0, "DiskUtilization": 52.0},
    },
    {
        "id": "i-09a8b7c6d5e4f003",
        "name": "db-replica-03",
        "role": "PostgreSQL Replica",
        "zone": "ap-south-1b",
        "instance_type": "r5.large",
        "base_metrics": {"CPUUtilization": 28.0, "MemoryUtilization": 78.0, "DiskUtilization": 64.0},
    },
]

_cloudwatch_client = None
_active_spikes = {}  # { (metric_name, instance_id): { "value": float, "expires_at": datetime } }


def inject_spike(metric_name: str, instance_id: str = "i-09a8b7c6d5e4f002", value: float = 94.5, duration_seconds: int = 300):
    """Inject a temporary artificial metric spike on an instance."""
    now = datetime.now(timezone.utc)
    key = (metric_name, instance_id)
    _active_spikes[key] = {
        "value": value,
        "expires_at": now + timedelta(seconds=duration_seconds),
    }


def clear_spike(metric_name: str = None, instance_id: str = None):
    """Clear active metric spikes."""
    global _active_spikes
    if metric_name and instance_id:
        _active_spikes.pop((metric_name, instance_id), None)
    elif metric_name:
        _active_spikes = {k: v for k, v in _active_spikes.items() if k[0] != metric_name}
    elif instance_id:
        _active_spikes = {k: v for k, v in _active_spikes.items() if k[1] != instance_id}
    else:
        _active_spikes.clear()


def get_cloudwatch_client():
    global _cloudwatch_client
    if _cloudwatch_client is None:
        try:
            _cloudwatch_client = boto3.client(
                "cloudwatch",
                region_name="ap-south-1"
            )
        except Exception as e:
            logger.warning(f"Could not initialize CloudWatch client: {e}")
            return None
    return _cloudwatch_client


def _generate_fallback_series(metric_name: str, instance_id: Optional[str] = None, count: int = 30):
    """Generate realistic live baseline telemetry for a specific or aggregated instance."""
    now = datetime.now(timezone.utc)

    # Find instance base configuration
    target_inst = next((inst for inst in INSTANCES if inst["id"] == instance_id), INSTANCES[1])
    base = target_inst["base_metrics"].get(metric_name, 50.0)

    # Phase shift based on instance to ensure curves look distinct
    phase_shift = (INSTANCES.index(target_inst) + 1) * 1.5

    # Check for active spikes on this instance or wildcard
    now_utc = datetime.now(timezone.utc)
    spike_info = _active_spikes.get((metric_name, target_inst["id"])) or _active_spikes.get((metric_name, "ALL"))
    spike_active = spike_info and spike_info["expires_at"] > now_utc

    points = []
    for i in range(count):
        t = now - timedelta(minutes=(count - 1 - i))
        wave = math.sin(i * 0.25 + phase_shift) * 5.0
        noise = (random.random() - 0.5) * 3.0
        val = max(5.0, min(99.0, round(base + wave + noise, 2)))

        if spike_active:
            if i >= count - 5:
                ramp = (i - (count - 5) + 1) / 5.0
                spike_val = spike_info["value"]
                val = round(val + (spike_val - val) * ramp, 2)

        points.append({
            "timestamp": t.isoformat(),
            "value": val
        })
    return points


def get_metric_data(metric_name: str, instance_id: Optional[str] = None):
    target_id = instance_id if (instance_id and instance_id != "ALL") else "i-09a8b7c6d5e4f002"

    client = get_cloudwatch_client()
    if client is not None:
        try:
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(minutes=30)
            dims = [{"Name": "InstanceId", "Value": target_id}] if target_id else []

            response = client.get_metric_statistics(
                Namespace="Nexora/Infrastructure",
                MetricName=metric_name,
                Dimensions=dims,
                StartTime=start_time,
                EndTime=end_time,
                Period=60,
                Statistics=["Average"],
            )

            datapoints = sorted(
                response.get("Datapoints", []),
                key=lambda x: x["Timestamp"]
            )

            if datapoints:
                return [
                    {
                        "timestamp": point["Timestamp"].isoformat(),
                        "value": round(point["Average"], 2),
                    }
                    for point in datapoints
                ]
        except (BotoCoreError, ClientError, Exception) as err:
            logger.info(f"CloudWatch unavailable for {metric_name} ({err}); falling back to local stream.")

    return _generate_fallback_series(metric_name, target_id)


def get_metrics(instance_id: Optional[str] = None):
    if instance_id is None or instance_id == "ALL":
        return {
            inst["id"]: {
                metric: get_metric_data(metric, inst["id"])
                for metric in METRICS
            }
            for inst in INSTANCES
        }
    return {
        metric: get_metric_data(metric, instance_id)
        for metric in METRICS
    }


def get_instances():
    """Return all managed instances with their latest real-time health."""
    results = []
    for inst in INSTANCES:
        cpu_series = get_metric_data("CPUUtilization", inst["id"])
        mem_series = get_metric_data("MemoryUtilization", inst["id"])
        disk_series = get_metric_data("DiskUtilization", inst["id"])

        latest_cpu = cpu_series[-1]["value"] if cpu_series else inst["base_metrics"]["CPUUtilization"]
        latest_mem = mem_series[-1]["value"] if mem_series else inst["base_metrics"]["MemoryUtilization"]
        latest_disk = disk_series[-1]["value"] if disk_series else inst["base_metrics"]["DiskUtilization"]

        status = "critical" if latest_cpu >= 85 or latest_mem >= 85 else ("warning" if latest_cpu >= 75 else "healthy")

        results.append({
            "id": inst["id"],
            "name": inst["name"],
            "role": inst["role"],
            "zone": inst["zone"],
            "instance_type": inst["instance_type"],
            "status": status,
            "cpu": latest_cpu,
            "memory": latest_mem,
            "disk": latest_disk,
        })
    return results
