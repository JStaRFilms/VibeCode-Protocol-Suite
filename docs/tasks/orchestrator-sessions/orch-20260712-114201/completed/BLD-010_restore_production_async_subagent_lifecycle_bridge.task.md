# Task BLD-010: Restore production async subagent lifecycle bridge
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Make real Takomi async subagent launches register visible running status and emit exactly one event-driven completion card in production, without polling.
## Scope
- Takomi pi-subagents internal engine initialization
- Native async started/result watcher/completion event lifecycle
- Running widget/footer integration
- Session/reload/shutdown cleanup
- Production-level integration tests
## Context
Parent session: orch-20260712-114201

Task title: Restore production async subagent lifecycle bridge
## Definition Of Done
- Real async launch immediately produces visible running status/widget
- Native background result watcher is initialized for Takomi-owned async runs even when the standalone subagent extension is absent
- Completion emits exactly one visible card with final answer and checklist provenance
- No polling/sleep loop is introduced
- Reload/session shutdown disposes watchers/widgets/subscriptions and clears stale state
- Tests execute the same production registration path, not isolated native modules
## Expected Artifacts
- Lifecycle bridge implementation
- Production registration integration test
- Root-cause report and manual retest
## Dependencies
- BLD-007
## Constraints
- Do not solve with polling
- Do not rely on a later status call
- Reuse pi-subagents@0.31.0 lifecycle APIs where possible
- Account for both standalone pi-subagents installed and Takomi-only internal use
- Preserve prior security/path/provenance hardening

## Completion Notes (2026-07-13)
- Root cause: Takomi invoked `createSubagentExecutor` with a private state whose watcher/coalescer fields were inert, but never reproduced standalone pi-subagents initialization (`createResultWatcher`, async-started/completed subscriptions, session identity, or widget state). Detached notification enrichment was registered correctly but no production watcher existed to emit its completion event.
- Added a reload-safe Takomi lifecycle bridge that shares state with the native executor, starts/primes the pinned event-driven result watcher, renders immediate async-started widget state, clears it on completion/session shutdown, and yields to standalone pi-subagents through its native `__piSubagentRuntimeCleanup` singleton slot.
- Existing detached result validation, path confinement, launch/session provenance, bounded output handling, native notification dedupe, and one-card rendering remain authoritative.
- Added a production-entrypoint integration test that calls Takomi's default registration, invokes the registered tool through the real tool-runner/engine path with a controlled native executor, writes a native result file, and exercises the pinned pi-subagents@0.31.0 watcher/coalescer.
- Verification: `npm test`, targeted production lifecycle test, `npx tsc --noEmit`, and `git diff --check` passed on 2026-07-13; diff check reported only an existing line-ending conversion warning.

## Revision Notes (2026-07-14)
- Corrected async-started state to `running` and supplied initial running/pending step snapshots so the pinned native widget renders an explicit running label without waiting for status polling.
- Takomi now retains a dedicated executor lifecycle state when standalone owns the watcher, while sharing the native widget key and never creating a second watcher.
- Lifecycle creation is serialized, samples native ownership after async internals loading, advances generation on reload/takeover, and forces stale executor bindings out before reuse.
- The production test removes the inherited child-process marker before registration, proving the actual standalone extension executes in native-before-Takomi and Takomi-before-native order, including reload/takeover, one completion, and cleanup.
- Final verification: targeted production lifecycle test passed repeatedly; `npx tsc --noEmit`, `npm test`, and `git diff --check` passed. The diff check reports only the existing line-ending conversion warning for `scripts/test-subagent-heartbeat.js`.