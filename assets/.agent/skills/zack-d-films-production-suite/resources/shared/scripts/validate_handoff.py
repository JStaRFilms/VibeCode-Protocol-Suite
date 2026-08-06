#!/usr/bin/env python3
"""Validate a Zack Production Package without external dependencies."""
from __future__ import annotations

import json
import sys
from pathlib import Path, PurePosixPath
from datetime import datetime

REQUIRED_TOP = {
    "schemaVersion", "packageId", "packageStatus", "revision", "createdAt",
    "project", "approvals", "provider", "budget", "files"
}
REQUIRED_FILES = {
    "sources", "claims", "researchSummary", "narration", "timedScript",
    "scenePlan", "assetRoster", "generationQueue", "editMap", "qcChecklist",
    "stylePrompt"
}

def safe_relative(value: str) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    p = PurePosixPath(value)
    return not p.is_absolute() and ".." not in p.parts and ":" not in value


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_handoff.py <path/to/handoff.json>", file=sys.stderr)
        return 2

    handoff_path = Path(sys.argv[1]).resolve()
    root = handoff_path.parent
    errors: list[str] = []

    try:
        data = json.loads(handoff_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"INVALID: cannot read JSON: {exc}", file=sys.stderr)
        return 1

    missing = sorted(REQUIRED_TOP - set(data))
    if missing:
        errors.append(f"missing top-level fields: {', '.join(missing)}")

    if data.get("schemaVersion") != "1.0":
        errors.append("schemaVersion must be '1.0'")
    if data.get("packageStatus") not in {"DRAFT", "LOCKED_FOR_PRODUCTION"}:
        errors.append("packageStatus must be DRAFT or LOCKED_FOR_PRODUCTION")
    if not isinstance(data.get("revision"), int) or data.get("revision", 0) < 1:
        errors.append("revision must be an integer >= 1")
    try:
        datetime.fromisoformat(str(data.get("createdAt", "")).replace("Z", "+00:00"))
    except ValueError:
        errors.append("createdAt must be an ISO-8601 date-time")

    project = data.get("project", {})
    for key in ("id", "title", "aspectRatio", "targetDurationSeconds", "blockDurationSeconds", "angle"):
        if key not in project:
            errors.append(f"project.{key} is required")
    if project.get("aspectRatio") not in {"9:16", "16:9", "1:1"}:
        errors.append("project.aspectRatio is unsupported")
    if project.get("blockDurationSeconds") not in {4, 6, 8, 10}:
        errors.append("project.blockDurationSeconds must be 4, 6, 8, or 10")

    approvals = data.get("approvals", {})
    for key in ("scriptLocked", "productionPlanLocked", "flowCreditSpendApproved"):
        if not isinstance(approvals.get(key), bool):
            errors.append(f"approvals.{key} must be boolean")

    if data.get("packageStatus") == "LOCKED_FOR_PRODUCTION":
        if not approvals.get("scriptLocked") or not approvals.get("productionPlanLocked"):
            errors.append("locked package requires scriptLocked and productionPlanLocked")

    provider = data.get("provider", {})
    if provider.get("visualProvider") not in {"takomi-flow", "higgsfield", "undecided"}:
        errors.append("provider.visualProvider is invalid")

    files = data.get("files", {})
    missing_file_keys = sorted(REQUIRED_FILES - set(files))
    if missing_file_keys:
        errors.append(f"missing file mappings: {', '.join(missing_file_keys)}")
    for key, rel in files.items():
        if not safe_relative(rel):
            errors.append(f"files.{key} must be a safe relative POSIX path")
            continue
        target = root.joinpath(*PurePosixPath(rel).parts)
        if not target.exists():
            errors.append(f"missing package file: {rel}")

    queue_path = files.get("generationQueue")
    queue = None
    if safe_relative(queue_path):
        try:
            queue = json.loads((root / queue_path).read_text(encoding="utf-8"))
            if not isinstance(queue, list):
                errors.append("generation queue must be a JSON array")
        except Exception as exc:
            errors.append(f"cannot parse generation queue: {exc}")

    if isinstance(queue, list):
        image_count = sum(1 for job in queue if isinstance(job, dict) and job.get("kind") == "image" and job.get("consumesCredits", True))
        video_jobs = [job for job in queue if isinstance(job, dict) and job.get("kind") == "video" and job.get("consumesCredits", True)]
        video_count = len(video_jobs)
        video_seconds = sum(float(job.get("durationSeconds", 0) or 0) for job in video_jobs)
        budget = data.get("budget", {})
        if budget.get("imageGenerations") != image_count:
            errors.append(f"budget.imageGenerations={budget.get('imageGenerations')} but queue has {image_count}")
        if budget.get("videoGenerations") != video_count:
            errors.append(f"budget.videoGenerations={budget.get('videoGenerations')} but queue has {video_count}")
        if abs(float(budget.get("videoSeconds", 0) or 0) - video_seconds) > 0.01:
            errors.append(f"budget.videoSeconds={budget.get('videoSeconds')} but queue totals {video_seconds}")

    if errors:
        print("INVALID")
        for error in errors:
            print(f"- {error}")
        return 1

    spend = approvals.get("flowCreditSpendApproved", False)
    print("VALID")
    print(f"- status: {data.get('packageStatus')}")
    print(f"- provider: {provider.get('visualProvider')}")
    print(f"- paid Flow execution approved: {spend}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
