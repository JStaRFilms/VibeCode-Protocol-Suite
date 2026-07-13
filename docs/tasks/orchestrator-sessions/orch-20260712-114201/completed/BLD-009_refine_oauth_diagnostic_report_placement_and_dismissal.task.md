# Task BLD-009: Refine OAuth diagnostic report placement and dismissal
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Present OAuth reports as on-demand diagnostics above the editor with prominent dismissal guidance and predictable cleanup.
## Scope
- OAuth report widget placement and report header
- Dismissal hint on every report
- Replacement/clear/shutdown/RPC lifecycle
- Focused UI tests
## Context
Parent session: orch-20260712-114201

Task title: Refine OAuth diagnostic report placement and dismissal
## Definition Of Done
- Interactive reports use Pi default/above-editor placement rather than belowEditor
- Every report prominently shows `Dismiss: /router-clear` without noisy duplication
- Replacement and explicit clear remain predictable
- RPC fallback and shutdown cleanup remain correct
- Footer remains live and no routing/account behavior changes
- Tests cover placement, hint, replacement, clear, reload/shutdown
## Expected Artifacts
- OAuth report UI changes
- Lifecycle/placement tests
## Dependencies
- BLD-008
## Constraints
- Use Pi default placement if that means above editor; verify against docs/source
- Do not auto-clear while user is reading unless lifecycle guarantees are explicit
- Do not change OAuth/routing/account state