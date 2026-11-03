from typing import Optional
from fastapi import APIRouter, Query
from app.services.cloudwatch_service import get_metrics, get_instances

router = APIRouter()


@router.get("/metrics")
def metrics(instance_id: Optional[str] = Query(default=None)):
    return {
        "instance_id": instance_id or "ALL",
        "metrics": get_metrics(instance_id)
    }


@router.get("/instances")
def instances():
    return {
        "instances": get_instances()
    }
