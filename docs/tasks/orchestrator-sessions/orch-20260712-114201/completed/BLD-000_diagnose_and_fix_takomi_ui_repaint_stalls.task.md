# Task BLD-000: Diagnose and Fix Takomi UI Repaint Stalls

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Follow `vibe-build` with a debugging-first implementation pass.

### Prime Agent Context
Read first:
- `docs/tasks/orchestrator-sessions/orch-20260712-114201/master_plan.md`
- `.pi/extensions/takomi-runtime/index.ts`
- `.pi/extensions/takomi-runtime/ui.ts`
- `.pi/extensions/takomi-runtime/context-panel.ts`
- `.pi/extensions/takomi-runtime/subagent-render.ts`
- `.pi/extensions/takomi-subagents/live-updates.ts`
- `.pi/extensions/takomi-subagents/native-render.ts`
- Pi `docs/extensions.md`, `docs/tui.md`, and relevant custom-tool renderer examples
- Commit `8522f19`

### Optional Skill / Context Overlays
No external overlay is required. Use repository and Pi docs as source of truth.

## Objective
Fix the regression where UI updates continue internally but visible transcript/footer/tool rows pause until keyboard input forces a repaint. Also correct the older inconsistent subagent loading-spinner/progress refresh behavior.

## Scope
- Takomi runtime footer/header/widget lifecycle
- Context panel repaint requests
- Native compact/expanded subagent progress rendering
- Tool partial-result repaint behavior
- Timer/subscription lifecycle across reload/new/resume/fork/shutdown
- Focused regression coverage

## Context
The user reports updates render for roughly three seconds, then freeze while work continues. Pressing keys reveals accumulated changes. Subagent spinner/progress has a similar longstanding inconsistency. Recent commit `8522f19` changed footer installation to context-based lifecycle and is a suspect, not a predetermined cause.

## Definition Of Done
- Root cause demonstrated with evidence
- No input is required to reveal ongoing updates
- Active subagent progress visibly refreshes consistently
- Repaint scheduling is bounded and efficient
- All timers/subscriptions are disposed safely
- Typecheck and focused regressions pass

## Expected Artifacts
- Minimal source fix
- Regression test or deterministic harness
- Root-cause and verification report

## Constraints
- Preserve existing uncommitted `.pi/extensions/takomi-context-manager/skill-tools.ts`
- Do not touch `nul`
- Do not begin unrelated cosmetic renderer work
- Do not assume IDE-only behavior without checking lifecycle logic

## Verification
- Run `npm run test:typecheck`
- Run relevant regression tests
- Exercise active tool/subagent repaint without keyboard input where possible
- Inspect reload/session replacement cleanup

## Handoff Notes
Return exact changed files, root cause, repaint cadence, lifecycle cleanup behavior, commands run, and residual IDE-specific risks.
