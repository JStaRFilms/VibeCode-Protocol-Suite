# Task REV-006: Review nested async spinner propagation
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Verify nested running frames advance with the existing heartbeat and no lifecycle regression.
## Scope
- BLD-013 changes
- Production widget rendering tests
## Context
Parent session: orch-20260712-114201

Task title: Review nested async spinner propagation
## Definition Of Done
- No frozen nested indicator
- One timer
- Tests pass
- Ship verdict
## Expected Artifacts
- Review verdict
- One-line retest
## Dependencies
- BLD-013
## Constraints
- Do not edit files