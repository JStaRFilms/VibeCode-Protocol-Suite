# Task REV-004: Review transient OAuth report lifecycle
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Verify OAuth reports behave as temporary diagnostics without immediate self-clear, stale widgets, or footer regression.
## Scope
- BLD-011 changes
- Production event ordering tests
- TUI/RPC cleanup
## Context
Parent session: orch-20260712-114201

Task title: Review transient OAuth report lifecycle
## Definition Of Done
- No lifecycle blocker remains
- Full tests pass
- Minimal combined manual retest supplied
## Expected Artifacts
- Review verdict
- Combined OAuth/subagent smoke test
## Dependencies
- BLD-011
## Constraints
- Do not edit files
- Reject tests that only call helper functions and bypass registered events