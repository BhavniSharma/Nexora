from fastapi import APIRouter
from app.services.cloudwatch_service import get_metrics

router = APIRouter()


@router.get("/metrics")
def metrics():
    return {
        "metrics": get_metrics()
    }