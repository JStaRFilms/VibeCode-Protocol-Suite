# Task BLD-011: Make OAuth reports transient on next activity
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Make the large OAuth report panel automatically dismiss on the next meaningful UI activity while preserving readable reports, replacement behavior, footer health, RPC parity, and optional manual clear.
## Scope
- OAuth-router report widget lifecycle
- Pi input/agent/tool activity events
- TUI and RPC report clearing
- Focused ordering/reload tests
## Context
Parent session: orch-20260712-114201

Task title: Make OAuth reports transient on next activity
## Definition Of Done
- A report remains visible after its command completes
- The next user input clears the old report before any replacement report appears
- Agent/tool activity clears an existing report
- A new router report replaces rather than immediately clears itself
- Footer health remains live
- /router-clear still works but is not normally required
- TUI/RPC/session/reload cleanup tests pass
## Expected Artifacts
- OAuth lifecycle changes
- Event-ordering and transient report tests
- Manual combined retest steps
## Dependencies
- BLD-009
## Constraints
- Do not convert multiline reports into one-line notifications
- Do not remove the small health footer
- Avoid timeout-only dismissal; clear on meaningful activity
- Ensure /router-status input does not cause its newly created report to disappear immediately
- Do not touch subagent files in this task