from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class InstanceInfo(BaseModel):
    id: str
    name: str
    role: str
    zone: str
    instance_type: str
    status: str
    cpu: float
    memory: float
    disk: float


class ProcessInfo(BaseModel):
    command: str
    pid: int
    cpu_percent: float
    memory_percent: float


class ProcessData(BaseModel):
    message: Optional[str] = None
    processes: list[ProcessInfo] = Field(default_factory=list)


class ProcessSnapshotSchema(BaseModel):
    id: int
    incident_id: int
    captured_at: str
    capture_reason: str = "THRESHOLD_BREACH"
    collection_status: str = "COMPLETED"
    metric_value: float
    threshold: float
    process_data: ProcessData


class ProcessEvidenceResponse(BaseModel):
    incident_id: int
    metric: str
    incident_status: str
    snapshot_count: int
    evidence_scope: str = "Host Process Telemetry"
    message: str
    snapshots: list[ProcessSnapshotSchema] = Field(default_factory=list)


class RemediationAuditRecord(BaseModel):
    id: int
    incident_id: int
    action: str
    mode: str = "DRY_RUN"
    result: str = "SUCCESS"
    executed: bool = False
    created_at: str
    message: Optional[str] = None


class RemediationAuditResponse(BaseModel):
    incident_id: int
    audit_history: list[RemediationAuditRecord] = Field(default_factory=list)


class TimelineEventSchema(BaseModel):
    event_type: str
    title: str
    timestamp: str
    details: dict[str, Any] = Field(default_factory=dict)


class IncidentSchema(BaseModel):
    id: int
    instance_id: Optional[str] = "i-09a8b7c6d5e4f002"
    metric: str
    value: float
    threshold: float
    severity: str
    status: str
    message: str
    created_at: str
    resolved_at: Optional[str] = None


class IncidentListResponse(BaseModel):
    incidents: list[IncidentSchema]


class Recommendation(BaseModel):
    action: str
    mode: str = "DRY_RUN"
    message: str
    executed: bool = False


class RecommendationResponse(BaseModel):
    recommendation: Recommendation
