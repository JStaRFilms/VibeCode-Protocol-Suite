# Task BLD-004: Redesign Compact Subagent Output and Checklist Progress

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Follow `vibe-build` with a renderer/data-flow diagnosis before implementation.

### Prime Agent Context
Read:
- `docs/tasks/orchestrator-sessions/orch-20260712-114201/master_plan.md`
- `docs/tasks/orchestrator-sessions/orch-20260712-114201/completed/BLD-000_diagnose_and_fix_takomi_ui_repaint_stalls.task.md`
- `.pi/extensions/takomi-subagents/native-render.ts`
- `.pi/extensions/takomi-subagents/live-updates.ts`
- `.pi/extensions/takomi-subagents/tool-runner.ts`
- `.pi/extensions/takomi-subagents/pi-subagents-internal.ts`
- `.pi/extensions/takomi-subagents/result-heartbeat.ts`
- Pinned pi-subagents renderer/schema source and Pi custom tool/TUI docs

### Optional Skill / Context Overlays
No optional overlay is required. Use pinned native renderer behavior and repository tests as source of truth.

## Objective
Make compact subagent cards useful by default. During execution, show a bounded stream of meaningful model-authored narrative. After completion, show the final answer directly. Reserve Ctrl+O expanded mode for prompt, complete logs/tool activity, checklist, metadata, and artifacts. Repair checklist progress so completed items visibly tick.

## Scope
- Takomi subagent result rendering and live-update aggregation
- Compact active and compact completed information hierarchy
- Expanded operational detail
- Checklist state propagation and rendering
- Focused deterministic tests

## Context
The user currently sees only `active now`, model/tool/token metadata, and an artifact path in compact mode. Expanded mode shows prompt/logs but checklist boxes remain unchecked. Desired behavior: compact active output should read like concise streaming paragraphs (for example, explicit model progress such as “I’m implementing…”); compact completed output should show the model’s final response; Ctrl+O should reveal prompt, logs, tools, artifacts, and deep diagnostics. Never expose hidden reasoning or chain-of-thought.

## Definition Of Done
- Compact active result includes bounded latest explicit assistant narrative and clear running metadata.
- Compact completed result includes readable final answer without expansion.
- Expanded mode includes complete operational detail without losing narrative.
- Checklist completion state updates visibly and accurately.
- Compact cards remain bounded and readable in narrow terminals.
- Existing 125ms heartbeat and cleanup guarantees remain intact.
- `npm test` and focused renderer tests pass.

## Expected Artifacts
- Task-scoped subagent source changes
- Deterministic tests for active narrative, final compact output, expanded detail, checklist transitions, and heartbeat regression
- Exact manual `/reload` exercise steps

## Constraints
- Do not expose chain-of-thought or infer private reasoning.
- Use only explicit assistant output/progress supplied by the subagent event/result schema.
- Do not touch `nul`, context-manager cards, runtime cards, or OAuth UI.
- Do not remove footer/status feedback.

## Verification
- Run `npm test`.
- Exercise compact/expanded renderers with synthetic active and completed results.
- Verify checklist transitions and bounded output.
- Verify heartbeat lifecycle tests still pass.
- Review `git diff --check`.

## Handoff Notes
Report data fields used, truncation/bounding rules, checklist source of truth, changed files, tests, and residual interactive risks.
