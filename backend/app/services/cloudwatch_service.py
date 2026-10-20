import boto3
from datetime import datetime, timedelta, timezone

cloudwatch = boto3.client(
    "cloudwatch",
    region_name="ap-south-1"
)


METRICS = [
    "CPUUtilization",
    "MemoryUtilization",
    "DiskUtilization"
]


def get_metric_data(metric_name):
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=30)

    response = cloudwatch.get_metric_statistics(
        Namespace="Nexora/Infrastructure",
        MetricName=metric_name,
        StartTime=start_time,
        EndTime=end_time,
        Period=60,
        Statistics=["Average"]
    )

    datapoints = sorted(
        response.get("Datapoints", []),
        key=lambda x: x["Timestamp"]
    )

    return [
        {
            "timestamp": point["Timestamp"].isoformat(),
            "value": round(point["Average"], 2)
        }
        for point in datapoints
    ]


def get_metrics():
    return {
        metric: get_metric_data(metric)
        for metric in METRICS
    }