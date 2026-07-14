# Task BLD-013: Animate nested async subagent step indicators
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Propagate the existing async widget animation frame to nested running step rows so top-level and Step N/N indicators animate together using one heartbeat.
## Scope
- Takomi async lifecycle frame-adjusted render copies
- Native widget nested step/progress snapshots
- Focused multi-row animation tests
## Context
Parent session: orch-20260712-114201

Task title: Animate nested async subagent step indicators
## Definition Of Done
- Top-level running indicator advances
- Every nested running step indicator advances on the same heartbeat
- Pending/completed/failed rows remain semantically stable
- Only one animation timer exists regardless of row count
- Completion/reload/shutdown cleanup remains correct
- Production renderer tests assert distinct consecutive nested frames
## Expected Artifacts
- Small async lifecycle fix
- Nested-frame regression test
- Manual retest
## Dependencies
- BLD-012
## Constraints
- Do not add a second timer
- Do not animate completed/pending/error rows incorrectly
- Preserve Ctrl+O and acceptance fixes