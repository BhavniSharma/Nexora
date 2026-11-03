import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "nexora.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instance_id TEXT DEFAULT 'i-09a8b7c6d5e4f002',
                metric TEXT NOT NULL,
                value REAL NOT NULL,
                threshold REAL NOT NULL,
                severity TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL,
                resolved_at TEXT
            )
        """)

        # Migration: ensure instance_id column exists
        cursor.execute("PRAGMA table_info(incidents)")
        existing_cols = [row[1] for row in cursor.fetchall()]
        if "instance_id" not in existing_cols:
            cursor.execute("ALTER TABLE incidents ADD COLUMN instance_id TEXT DEFAULT 'i-09a8b7c6d5e4f002'")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS timeline_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                title TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS process_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id INTEGER NOT NULL,
                captured_at TEXT NOT NULL,
                capture_reason TEXT NOT NULL DEFAULT 'THRESHOLD_BREACH',
                collection_status TEXT NOT NULL DEFAULT 'COMPLETED',
                metric_value REAL NOT NULL,
                threshold REAL NOT NULL,
                process_data TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS remediation_audits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'DRY_RUN',
                result TEXT NOT NULL DEFAULT 'SUCCESS',
                executed INTEGER NOT NULL DEFAULT 0,
                message TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
            )
        """)

        conn.commit()

        # Seed initial data if table is empty
        cursor.execute("SELECT COUNT(*) FROM incidents")
        if cursor.fetchone()[0] == 0:
            seed_initial_data(cursor)
            conn.commit()


def seed_initial_data(cursor):
    now = datetime.now(timezone.utc)
    t_open = (now - timedelta(minutes=15)).isoformat()
    t_resolved_1 = (now - timedelta(hours=2)).isoformat()
    t_res_end_1 = (now - timedelta(hours=1, minutes=45)).isoformat()
    t_resolved_2 = (now - timedelta(hours=6)).isoformat()
    t_res_end_2 = (now - timedelta(hours=5, minutes=30)).isoformat()

    # 1. Active CPU incident
    cursor.execute("""
        INSERT INTO incidents (metric, value, threshold, severity, status, message, created_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "CPUUtilization",
        91.4,
        80.0,
        "critical",
        "OPEN",
        "EC2 instance CPU sustained above 90% for > 5 consecutive minutes.",
        t_open,
        None,
    ))
    inc1_id = cursor.lastrowid

    # 2. Resolved Memory incident
    cursor.execute("""
        INSERT INTO incidents (metric, value, threshold, severity, status, message, created_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "MemoryUtilization",
        88.2,
        80.0,
        "high",
        "RESOLVED",
        "High memory pressure detected on primary worker pod.",
        t_resolved_1,
        t_res_end_1,
    ))
    inc2_id = cursor.lastrowid

    # 3. Resolved Disk incident
    cursor.execute("""
        INSERT INTO incidents (metric, value, threshold, severity, status, message, created_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "DiskUtilization",
        86.7,
        85.0,
        "medium",
        "RESOLVED",
        "Root volume storage capacity exceeded 85% safety baseline.",
        t_resolved_2,
        t_res_end_2,
    ))
    inc3_id = cursor.lastrowid

    # Seed timeline events for Incident 1
    events_inc1 = [
        ("DETECTION", "CPU Threshold Breached", t_open, {
            "metric": "CPUUtilization", "value": 91.4, "threshold": 80.0,
            "severity": "critical", "message": "CloudWatch alarm triggered: high utilization."
        }),
        ("DIAGNOSIS", "Process Snapshot Captured", (now - timedelta(minutes=14)).isoformat(), {
            "snapshot_id": 1, "capture_reason": "THRESHOLD_BREACH",
            "collection_status": "COMPLETED", "message": "Host agent collected top 10 running tasks."
        }),
    ]
    for ev_type, title, ts, details in events_inc1:
        cursor.execute("""
            INSERT INTO timeline_events (incident_id, event_type, title, timestamp, details)
            VALUES (?, ?, ?, ?, ?)
        """, (inc1_id, ev_type, title, ts, json.dumps(details)))

    # Seed process snapshot for Incident 1
    snap_data = {
        "message": "Top resource-consuming processes captured at peak utilization.",
        "processes": [
            {"command": "python worker_pipeline.py --batch-size=128", "pid": 4821, "cpu_percent": 68.4, "memory_percent": 12.1},
            {"command": "node /opt/nexora/stream-processor.js", "pid": 3209, "cpu_percent": 18.2, "memory_percent": 8.5},
            {"command": "postgres: worker process db_nexora", "pid": 1104, "cpu_percent": 4.1, "memory_percent": 16.3},
            {"command": "systemd-journald", "pid": 589, "cpu_percent": 0.7, "memory_percent": 1.2},
        ]
    }
    cursor.execute("""
        INSERT INTO process_snapshots (incident_id, captured_at, capture_reason, collection_status, metric_value, threshold, process_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (inc1_id, (now - timedelta(minutes=14)).isoformat(), "THRESHOLD_BREACH", "COMPLETED", 91.4, 80.0, json.dumps(snap_data)))

    # Seed timeline events for Incident 2
    events_inc2 = [
        ("DETECTION", "Memory Pressure Warning", t_resolved_1, {
            "metric": "MemoryUtilization", "value": 88.2, "threshold": 80.0, "severity": "high"
        }),
        ("REMEDIATION", "Remediation Suggested", (now - timedelta(hours=1, minutes=55)).isoformat(), {
            "action": "Restart Node Stream Processor", "mode": "DRY_RUN", "executed": False, "result": "RECOMMENDED"
        }),
        ("RECOVERY", "Memory Metric Normalized", t_res_end_1, {
            "metric": "MemoryUtilization", "value": 44.5, "threshold": 80.0, "message": "Utilization subsided below baseline."
        }),
    ]
    for ev_type, title, ts, details in events_inc2:
        cursor.execute("""
            INSERT INTO timeline_events (incident_id, event_type, title, timestamp, details)
            VALUES (?, ?, ?, ?, ?)
        """, (inc2_id, ev_type, title, ts, json.dumps(details)))

    # Seed remediation audit for Incident 2
    cursor.execute("""
        INSERT INTO remediation_audits (incident_id, action, mode, result, executed, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        inc2_id,
        "Restart Node Stream Processor",
        "DRY_RUN",
        "SUCCESS",
        0,
        "Dry-run recommendation created. Manual approval was queued.",
        (now - timedelta(hours=1, minutes=55)).isoformat(),
    ))
