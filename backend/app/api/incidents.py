import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.database.db import get_db
from app.models.schemas import (
    IncidentListResponse,
    IncidentSchema,
    ProcessEvidenceResponse,
    ProcessSnapshotSchema,
    RecommendationResponse,
    RemediationAuditRecord,
    RemediationAuditResponse,
    TimelineEventSchema,
)

router = APIRouter(prefix="/incidents", tags=["Incidents"])


def _row_to_incident(row) -> IncidentSchema:
    keys = row.keys() if hasattr(row, "keys") else []
    return IncidentSchema(
        id=row["id"],
        instance_id=row["instance_id"] if "instance_id" in keys else "i-09a8b7c6d5e4f002",
        metric=row["metric"],
        value=row["value"],
        threshold=row["threshold"],
        severity=row["severity"],
        status=row["status"],
        message=row["message"],
        created_at=row["created_at"],
        resolved_at=row["resolved_at"],
    )


@router.get("", response_model=IncidentListResponse)
def get_active_incidents(instance_id: Optional[str] = Query(default=None)):
    """Retrieve all open/active incidents, optionally filtered by instance."""
    with get_db() as conn:
        cursor = conn.cursor()
        if instance_id and instance_id != "ALL":
            cursor.execute(
                "SELECT * FROM incidents WHERE status = 'OPEN' AND instance_id = ? ORDER BY id DESC",
                (instance_id,)
            )
        else:
            cursor.execute(
                "SELECT * FROM incidents WHERE status = 'OPEN' ORDER BY id DESC"
            )
        rows = cursor.fetchall()
        return IncidentListResponse(incidents=[_row_to_incident(r) for r in rows])


@router.get("/history", response_model=IncidentListResponse)
def get_incident_history(instance_id: Optional[str] = Query(default=None)):
    """Retrieve all past and active incidents, optionally filtered by instance."""
    with get_db() as conn:
        cursor = conn.cursor()
        if instance_id and instance_id != "ALL":
            cursor.execute(
                "SELECT * FROM incidents WHERE instance_id = ? ORDER BY id DESC",
                (instance_id,)
            )
        else:
            cursor.execute("SELECT * FROM incidents ORDER BY id DESC")
        rows = cursor.fetchall()
        return IncidentListResponse(incidents=[_row_to_incident(r) for r in rows])


@router.get("/{incident_id}/timeline")
def get_incident_timeline(incident_id: int):
    """Retrieve the chronological event timeline for an incident."""
    with get_db() as conn:
        cursor = conn.cursor()
        # Verify incident exists
        cursor.execute("SELECT id FROM incidents WHERE id = ?", (incident_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident #{incident_id} not found."
            )

        cursor.execute(
            "SELECT * FROM timeline_events WHERE incident_id = ? ORDER BY timestamp ASC",
            (incident_id,)
        )
        rows = cursor.fetchall()

        events = []
        for r in rows:
            details = {}
            if r["details"]:
                try:
                    details = json.loads(r["details"])
                except Exception:
                    details = {}
            events.append(TimelineEventSchema(
                event_type=r["event_type"],
                title=r["title"],
                timestamp=r["timestamp"],
                details=details
            ))

        return {
            "incident_id": incident_id,
            "timeline": events,
            "events": events
        }


@router.get("/{incident_id}/remediation/audit", response_model=RemediationAuditResponse)
def get_remediation_audit(incident_id: int):
    """Retrieve remediation audit history for an incident."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM incidents WHERE id = ?", (incident_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident #{incident_id} not found."
            )

        cursor.execute(
            "SELECT * FROM remediation_audits WHERE incident_id = ? ORDER BY id DESC",
            (incident_id,)
        )
        rows = cursor.fetchall()

        audits = [
            RemediationAuditRecord(
                id=r["id"],
                incident_id=r["incident_id"],
                action=r["action"],
                mode=r["mode"],
                result=r["result"],
                executed=bool(r["executed"]),
                created_at=r["created_at"],
                message=r["message"]
            )
            for r in rows
        ]

        return RemediationAuditResponse(
            incident_id=incident_id,
            audit_history=audits
        )


@router.get("/{incident_id}/diagnosis/evidence", response_model=ProcessEvidenceResponse)
def get_process_evidence(incident_id: int):
    """Retrieve process snapshot forensic evidence for an incident."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, metric, status FROM incidents WHERE id = ?",
            (incident_id,)
        )
        inc = cursor.fetchone()
        if not inc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident #{incident_id} not found."
            )

        cursor.execute(
            "SELECT * FROM process_snapshots WHERE incident_id = ? ORDER BY id DESC",
            (incident_id,)
        )
        rows = cursor.fetchall()

        snapshots = []
        for r in rows:
            p_data = {"message": None, "processes": []}
            if r["process_data"]:
                try:
                    p_data = json.loads(r["process_data"])
                except Exception:
                    pass

            snapshots.append(ProcessSnapshotSchema(
                id=r["id"],
                incident_id=r["incident_id"],
                captured_at=r["captured_at"],
                capture_reason=r["capture_reason"],
                collection_status=r["collection_status"],
                metric_value=r["metric_value"],
                threshold=r["threshold"],
                process_data=p_data
            ))

        return ProcessEvidenceResponse(
            incident_id=incident_id,
            metric=inc["metric"],
            incident_status=inc["status"],
            snapshot_count=len(snapshots),
            evidence_scope="Host Process Telemetry",
            message=(
                f"Retrieved {len(snapshots)} process snapshot(s) for Incident #{incident_id}."
                if snapshots
                else "No historical snapshots recorded for this incident."
            ),
            snapshots=snapshots
        )


@router.post("/{incident_id}/remediation/recommend", response_model=RecommendationResponse)
def create_remediation_recommendation(incident_id: int):
    """Generate an automated remediation recommendation and log to audit trail."""
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, metric, value, threshold, severity FROM incidents WHERE id = ?",
            (incident_id,)
        )
        inc = cursor.fetchone()
        if not inc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident #{incident_id} not found."
            )

        metric = inc["metric"]
        if "cpu" in metric.lower():
            action = "Throttle background workers & terminate rogue batch PID"
            message = "Identified runaway CPU worker. Recommended graceful termination via SIGTERM."
        elif "mem" in metric.lower():
            action = "Flush Redis cache & restart memory-leaking worker pod"
            message = "High memory usage detected. Recommended cache eviction and worker recycle."
        elif "disk" in metric.lower():
            action = "Prune rotated container logs & compress archive volumes"
            message = "Disk threshold reached. Recommended cleaning /var/log and temporary files."
        else:
            action = "Restart target service instance"
            message = f"Automated stability recommendation for {metric} anomaly."

        # Insert audit record
        cursor.execute("""
            INSERT INTO remediation_audits (incident_id, action, mode, result, executed, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (incident_id, action, "DRY_RUN", "SUCCESS", 0, message, now_iso))
        audit_id = cursor.lastrowid

        # Insert timeline event
        timeline_details = {
            "action": action,
            "mode": "DRY_RUN",
            "executed": False,
            "result": "SUCCESS",
            "audit_id": audit_id,
            "message": message
        }
        cursor.execute("""
            INSERT INTO timeline_events (incident_id, event_type, title, timestamp, details)
            VALUES (?, ?, ?, ?, ?)
        """, (incident_id, "REMEDIATION", "Remediation Recommended", now_iso, json.dumps(timeline_details)))

        conn.commit()

        return RecommendationResponse(
            recommendation={
                "action": action,
                "mode": "DRY_RUN",
                "message": message,
                "executed": False
            }
        )


@router.post("/{incident_id}/resolve", response_model=IncidentSchema)
def resolve_incident(incident_id: int):
    """Mark an incident as RESOLVED, clear any active simulation spike, and record a recovery event."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        inc = cursor.fetchone()
        if not inc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident #{incident_id} not found."
            )

        cursor.execute("""
            UPDATE incidents
            SET status = 'RESOLVED', resolved_at = ?
            WHERE id = ?
        """, (now_iso, incident_id))

        from app.services.cloudwatch_service import clear_spike
        clear_spike(inc["metric"])

        timeline_details = {
            "metric": inc["metric"],
            "resolved_at": now_iso,
            "message": f"Incident #{incident_id} resolved by operator. Telemetry normalized."
        }
        cursor.execute("""
            INSERT INTO timeline_events (incident_id, event_type, title, timestamp, details)
            VALUES (?, ?, ?, ?, ?)
        """, (incident_id, "RECOVERY", "Incident Resolved by Operator", now_iso, json.dumps(timeline_details)))

        conn.commit()

        cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        updated = cursor.fetchone()
        return _row_to_incident(updated)

