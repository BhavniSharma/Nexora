from fastapi import FastAPI
from app.api.metrics import router as metrics_router

app = FastAPI(
    title="Nexora API",
    description="Cloud Reliability and Automated Incident Response Platform",
    version="1.0.0"
)

app.include_router(metrics_router)


@app.get("/")
def root():
    return {
        "message": "Nexora API is running",
        "status": "online"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }