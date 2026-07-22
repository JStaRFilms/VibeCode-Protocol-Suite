# Task BLD-012: Fix async widget animation, Ctrl+O lock, and acceptance rejection
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Fix the real production behavior where the async widget is visually frozen, globally disables Ctrl+O expansion while present, and ordinary successful reviewer runs always show harness acceptance rejected.
## Scope
- Takomi async lifecycle/widget state and animation
- Pi global tool expansion/input gating interaction
- pi-subagents acceptance configuration and result semantics
- Production integration and input-dispatch tests
## Context
Parent session: orch-20260712-114201

Task title: Fix async widget animation, Ctrl+O lock, and acceptance rejection
## Definition Of Done
- Async running indicator visibly animates at a bounded cadence
- Ctrl+O remains functional for active and prior expandable tool results while async widget is present
- No global streaming/in-progress flag remains incorrectly asserted after parent async launch detaches
- Widget clears and animation stops on completion/reload/shutdown
- Ordinary read-only/reviewer tasks are not marked acceptance rejected unless an explicit acceptance contract genuinely fails
- Acceptance status remains truthful for explicitly enforced acceptance runs
- Production-path tests cover keybinding availability and actual rendered frame changes
## Expected Artifacts
- Root-cause fixes
- Production animation/input/acceptance tests
- Minimal live retest
## Dependencies
- BLD-010
## Constraints
- Read Pi keybinding/tool expansion and pi-subagents acceptance source before editing
- Do not hide rejection labels; correct the contract/data flow
- Do not introduce unbounded polling; animation timer may only request render while jobs exist and must clean up
- Preserve one watcher/completion and detached security hardening