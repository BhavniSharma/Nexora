import sys
import unittest
sys.path.insert(0, ".")
sys.path.insert(0, "backend")

from app.database.db import init_db
from app.api.incidents import (
    get_active_incidents,
    get_incident_history,
    get_incident_timeline,
    get_process_evidence,
    get_remediation_audit,
    create_remediation_recommendation,
    resolve_incident
)
from app.api.intelligence import (
    detect_anomalies,
    simulate_spike,
    AnalysisRequest,
    MetricSample,
    SpikeSimulationRequest
)
from app.services.cloudwatch_service import get_metrics
from remediation.actions import execute_plan


class NexoraPlatformTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_01_metrics_telemetry(self):
        metrics = get_metrics(instance_id=None)
        self.assertEqual(len(metrics), 3)
        for inst_id, m in metrics.items():
            self.assertIn("CPUUtilization", m)
            self.assertIn("MemoryUtilization", m)
            self.assertIn("DiskUtilization", m)
            self.assertGreater(len(m["CPUUtilization"]), 0)

    def test_02_incidents_crud(self):
        active = get_active_incidents(instance_id=None)
        self.assertIsInstance(active.incidents, list)

        history = get_incident_history(instance_id=None)
        self.assertGreater(len(history.incidents), 0)

    def test_03_timeline_and_evidence(self):
        tl = get_incident_timeline(1)
        self.assertIn("timeline", tl)
        self.assertGreater(len(tl["timeline"]), 0)

        ev = get_process_evidence(1)
        self.assertGreater(ev.snapshot_count, 0)
        self.assertGreater(len(ev.snapshots[0].process_data.processes), 0)

    def test_04_spike_simulation_and_recovery(self):
        # Spike
        spike = simulate_spike(SpikeSimulationRequest(metric="CPUUtilization", value=95.0))
        inc_id = spike["incident_id"]
        self.assertGreater(inc_id, 0)

        # Recommend
        rec = create_remediation_recommendation(inc_id)
        self.assertIn("recommendation", rec.model_dump())

        # Audit
        aud = get_remediation_audit(inc_id)
        self.assertGreater(len(aud.audit_history), 0)

        # Resolve
        resolved = resolve_incident(inc_id)
        self.assertEqual(resolved.status, "RESOLVED")

    def test_05_machine_learning_pipeline(self):
        req = AnalysisRequest(
            current=MetricSample(cpu=95.0, memory=50.0, disk=50.0),
            history=[MetricSample(cpu=40.0, memory=50.0, disk=50.0) for _ in range(8)]
        )
        res = detect_anomalies(req)
        self.assertIn("ml_inference", res)
        self.assertIsNotNone(res["ml_inference"])

    def test_06_remediation_actions(self):
        res = execute_plan("TERMINATE_PROCESS", "4122", dry_run=True)
        self.assertEqual(res["mode"], "DRY_RUN")
        self.assertEqual(res["result"], "SUCCESS")


if __name__ == "__main__":
    unittest.main(verbosity=2)
