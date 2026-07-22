# Task REV-002: Review acceptance follow-up fixes
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Perform final integrated review against every acceptance finding and generate an updated read-only exercise.
## Scope
- BLD-006 through BLD-009
- Original acceptance findings
- Full test and worktree integrity
## Context
Parent session: orch-20260712-114201

Task title: Review acceptance follow-up fixes
## Definition Of Done
- Every warning is resolved
- Suggestions are resolved or explicitly justified
- Full tests pass
- Updated exercise targets real async flow and installed metadata
- Ship verdict has no blockers
## Expected Artifacts
- Severity-ordered review
- Ship verdict
- Updated exercise prompt
## Dependencies
- BLD-006
- BLD-007
- BLD-008
- BLD-009
## Constraints
- Do not edit files during review
- Treat synthetic-only evidence as insufficient where original acceptance used real UI