# Task REV-005: Review async interaction and acceptance fix
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Review animation cadence/cleanup, Ctrl+O interaction availability, lifecycle flags, and acceptance semantics.
## Scope
- BLD-012 changes
- Actual Pi keybinding/input behavior
- Acceptance-enforced and normal tasks
## Context
Parent session: orch-20260712-114201

Task title: Review async interaction and acceptance fix
## Definition Of Done
- No UI/input lock remains
- Animation is bounded/leak-free
- Acceptance is truthful
- Tests pass
- Ship verdict issued
## Expected Artifacts
- Review report
- Ship verdict
- Combined live test
## Dependencies
- BLD-012
- BLD-011
## Constraints
- Do not edit files
- Reject renderer-only tests that do not exercise Pi keybinding state