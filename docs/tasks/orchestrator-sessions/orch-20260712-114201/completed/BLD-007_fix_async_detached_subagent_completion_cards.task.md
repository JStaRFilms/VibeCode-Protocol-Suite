# Task BLD-007: Fix async detached subagent completion cards
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Ensure async/detached subagent completion cards show the final answer and checklist provenance in collapsed mode, rather than only paths and acceptance status.
## Scope
- Takomi subagent async/detached result schemas and status updates
- Native-first compact/expanded rendering
- Artifact/output resolution lifecycle
- Checklist provenance for detached completion
- Focused actual-native renderer tests
## Context
Parent session: orch-20260712-114201

Task title: Fix async detached subagent completion cards
## Definition Of Done
- Detached launch instructions remain concise while running
- When async run completes, compact card displays useful final answer and checklist summary/provenance
- Rejected acceptance does not suppress the model final answer
- Ctrl+O retains native logs/artifacts/detail without bloat
- Status/resume polling and session cleanup are correct
- Tests cover async launch, status, completion, rejected acceptance, missing artifact, and narrow widths
## Expected Artifacts
- Subagent renderer/data-flow changes
- Async/detached schema fixture tests
- Manual acceptance steps
## Dependencies
- BLD-006
## Constraints
- Use actual pi-subagents@0.31.0 async/status result structures, not invented fixtures
- Do not expose chain-of-thought or raw debug dumps
- Preserve heartbeat and native-first design
- Do not touch unrelated files

## Completion Notes (2026-07-13)
- Completion events emit one enriched native `subagent-notify` message with final-answer, checklist, acceptance, and fallback provenance across both native/Takomi notifier registration orders and reload/shutdown permutations.
- Persisted session entries contain only a versioned run-id lookup. Restore re-derives async/result/artifact/session roots from current pinned pi-subagents internals and the current workspace/session; restarted checklist provenance fails closed as unavailable unless current-process trusted launch state survives reload.
- A count-, byte-, and TTL-bounded pending queue bridges completion-before-launch races and is cleared at session/shutdown boundaries. Native dedupe is claimed only after full validation, normalization, and useful-output checks.
- Result, artifact, and child-session resolution is byte-bounded, control-sanitized, canonical/symlink confined, and distinguishes missing, permission, I/O, corrupt, oversized, truncated, and rejected provenance. UTF-8 truncation does not misclassify an incomplete boundary scalar as corruption.
- Pinned pi-subagents@0.31.0 fixtures include executable native result-watcher adapter coverage and exact occurrence assertions at 40/60 columns.
- Adversarial coverage includes persisted tampering, process restart fail-closed behavior, race-before-launch, malformed-then-valid delivery, queue bounds/TTL, both notifier orders, reload/shutdown survival, traversal/symlink session/artifact escapes, and missing/permission/I/O/oversized/corrupt/truncated UTF-8 cases.
- Verification: `npm test` and `git diff --check` passed on 2026-07-13; diff check reported line-ending warnings only.
