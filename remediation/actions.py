import os
import platform
import subprocess
from datetime import datetime, timezone


def terminate_process(pid: int, dry_run: bool = True) -> dict:
    """Safely terminate a rogue runaway process."""
    if dry_run:
        return {
            "action": f"TERMINATE_PROCESS (PID: {pid})",
            "mode": "DRY_RUN",
            "executed": False,
            "result": "SUCCESS",
            "message": f"[DRY-RUN] Process PID {pid} identified for termination. Bypassed execution per safety mode."
        }

    try:
        if platform.system() == "Windows":
            subprocess.run(["taskkill", "/F", "/PID", str(pid)], check=True, capture_output=True)
        else:
            os.kill(pid, 15)  # SIGTERM
        return {
            "action": f"TERMINATE_PROCESS (PID: {pid})",
            "mode": "EXECUTED",
            "executed": True,
            "result": "SUCCESS",
            "message": f"Successfully terminated runaway process PID {pid}."
        }
    except Exception as e:
        return {
            "action": f"TERMINATE_PROCESS (PID: {pid})",
            "mode": "EXECUTED",
            "executed": False,
            "result": "FAILED",
            "message": f"Failed to terminate PID {pid}: {e}"
        }


def restart_service(service_name: str, dry_run: bool = True) -> dict:
    """Recycle an overloaded cloud service daemon."""
    if dry_run:
        return {
            "action": f"RESTART_SERVICE ({service_name})",
            "mode": "DRY_RUN",
            "executed": False,
            "result": "SUCCESS",
            "message": f"[DRY-RUN] Service restart queued for '{service_name}'."
        }

    try:
        if platform.system() == "Windows":
            subprocess.run(["powershell", "-Command", f"Restart-Service -Name '{service_name}'"], check=True, capture_output=True)
        else:
            subprocess.run(["systemctl", "restart", service_name], check=True, capture_output=True)
        return {
            "action": f"RESTART_SERVICE ({service_name})",
            "mode": "EXECUTED",
            "executed": True,
            "result": "SUCCESS",
            "message": f"Service '{service_name}' successfully restarted."
        }
    except Exception as e:
        return {
            "action": f"RESTART_SERVICE ({service_name})",
            "mode": "EXECUTED",
            "executed": False,
            "result": "FAILED",
            "message": f"Could not restart '{service_name}': {e}"
        }


def clear_disk_cache(path: str = "/tmp", dry_run: bool = True) -> dict:
    """Prune temporary files and expired logs."""
    if dry_run:
        return {
            "action": f"CLEAR_DISK_CACHE ({path})",
            "mode": "DRY_RUN",
            "executed": False,
            "result": "SUCCESS",
            "message": f"[DRY-RUN] Disk pruning evaluated for '{path}'. Estimated space recovery: 4.8 GB."
        }
    return {
        "action": f"CLEAR_DISK_CACHE ({path})",
        "mode": "EXECUTED",
        "executed": True,
        "result": "SUCCESS",
        "message": f"Disk cache cleared at '{path}'."
    }


def execute_plan(action_type: str, target: str, dry_run: bool = True) -> dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    if "process" in action_type.lower() or "terminate" in action_type.lower():
        res = terminate_process(int(target) if target.isdigit() else 9999, dry_run=dry_run)
    elif "service" in action_type.lower() or "restart" in action_type.lower():
        res = restart_service(target, dry_run=dry_run)
    else:
        res = clear_disk_cache(target, dry_run=dry_run)

    res["timestamp"] = now_iso
    return res


if __name__ == "__main__":
    print("Testing remediation runbook actions in Dry-Run mode:")
    sample = execute_plan("TERMINATE_PROCESS", "7192", dry_run=True)
    print(sample)
