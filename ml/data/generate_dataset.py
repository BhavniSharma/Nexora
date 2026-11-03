import math
import os
import random
from datetime import datetime, timedelta, timezone
import pandas as pd

DATA_PATH = os.path.join(os.path.dirname(__file__), "telemetry_data.csv")


def generate_synthetic_telemetry(num_samples: int = 1500, anomaly_ratio: float = 0.04) -> pd.DataFrame:
    """Generate realistic multi-variate cloud telemetry dataset with injected anomalies."""
    now = datetime.now(timezone.utc)
    records = []

    base_cpu = 40.0
    base_mem = 55.0
    base_disk = 45.0

    num_anomalies = int(num_samples * anomaly_ratio)
    anomaly_indices = set(random.sample(range(50, num_samples - 5), num_anomalies))

    for i in range(num_samples):
        timestamp = (now - timedelta(minutes=(num_samples - i))).isoformat()

        # Normal periodic diurnal patterns
        diurnal = math.sin(i * 0.02) * 12.0
        wave = math.sin(i * 0.1) * 4.0
        cpu_noise = (random.random() - 0.5) * 5.0
        mem_noise = (random.random() - 0.5) * 3.0
        disk_noise = (random.random() - 0.5) * 2.0

        cpu = max(5.0, min(80.0, base_cpu + diurnal + wave + cpu_noise))
        mem = max(10.0, min(80.0, base_mem + (diurnal * 0.6) + mem_noise))
        disk = max(15.0, min(80.0, base_disk + (i * 0.01) + disk_noise))
        is_anomaly = 0

        # Inject multi-variate anomaly patterns
        if i in anomaly_indices:
            anomaly_type = random.choice(["cpu_spike", "memory_leak", "disk_saturation"])
            if anomaly_type == "cpu_spike":
                cpu = min(99.0, random.uniform(88.0, 98.5))
            elif anomaly_type == "memory_leak":
                mem = min(99.0, random.uniform(86.0, 97.0))
            elif anomaly_type == "disk_saturation":
                disk = min(99.0, random.uniform(89.0, 98.0))
            is_anomaly = 1

        records.append({
            "timestamp": timestamp,
            "cpu": round(cpu, 2),
            "memory": round(mem, 2),
            "disk": round(disk, 2),
            "is_anomaly": is_anomaly
        })

    df = pd.DataFrame(records)
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    df.to_csv(DATA_PATH, index=False)
    print(f"Dataset generated with {len(df)} samples ({num_anomalies} anomalies) -> {DATA_PATH}")
    return df


if __name__ == "__main__":
    generate_synthetic_telemetry()
