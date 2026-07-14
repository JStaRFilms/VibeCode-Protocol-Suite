# Task REV-003: Review production async lifecycle fix
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Validate real production async lifecycle registration, visibility, completion delivery, coexistence, and cleanup.
## Scope
- BLD-010 changes
- Production registration integration tests
- Manual retest instructions
## Context
Parent session: orch-20260712-114201

Task title: Review production async lifecycle fix
## Definition Of Done
- No lifecycle blocker remains
- No duplicate watcher/message exists
- No polling or leaks
- Full tests pass
- Ship verdict issued
## Expected Artifacts
- Review report
- Ship verdict
- Minimal manual retest
## Dependencies
- BLD-010
## Constraints
- Do not edit files
- Reject tests that bypass the production extension entrypoint