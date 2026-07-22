# Task BLD-002: Implement Runtime Tool Renderers and Mode Feedback Cleanup

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Follow `vibe-build`. Preserve runtime behavior and focus on presentation.

### Prime Agent Context
Read:
- session master plan and completed DES-001
- `.pi/extensions/takomi-runtime/index.ts`
- `.pi/extensions/takomi-runtime/commands.ts`
- `.pi/extensions/takomi-runtime/ui.ts`
- `.pi/extensions/takomi-runtime/context-panel.ts`
- `.pi/extensions/takomi-runtime/routing-policy.ts`
- `.pi/extensions/takomi-runtime/gate-provenance.ts`
- Pi extension/TUI documentation and existing context-manager card helpers for visual reference only

## Objective
Give `takomi_mode`, `takomi_apply_routing_policy`, `takomi_workflow`, and `takomi_board` concise native-looking compact cards and complete expanded content, while keeping live footer feedback and removing only redundant routine notifications.

## Scope
- Add `renderCall`/`renderResult` for four runtime tools.
- Compact cards: concise status/title/one-line summary/bounded metadata.
- Expanded cards: complete formatted model-facing result via Markdown or native-like components; no raw JSON dumps unless JSON itself is the intentional result.
- Mode feedback: footer remains live; routine success notifications may be deduplicated; warnings, invalid input, blocked actions, and failures remain visible.
- Preserve `/takomi gate auto` provenance behavior from commit `1cb06f1`.

## Visual Standard
Follow native Pi/pi-subagents restraint: no duplicated headers, giant prompts, metadata walls, or verbose boilerplate. Use theme colors and `keyHint("app.tools.expand", ...)`. Compact output must remain bounded; Ctrl+O reveals complete content.

## Definition Of Done
- All four runtime tools render compact and expanded states consistently.
- Model-facing content and tool semantics remain complete and unchanged.
- Footer status updates live throughout mode/gate/workflow changes.
- Routine success `notify()` calls do not duplicate footer/tool feedback.
- Warnings/errors/blocked actions still notify visibly.
- Gate provenance security tests remain green.
- Focused runtime renderer/notification tests and full `npm test` pass.

## Constraints
- Do not change context-manager, subagent UX, OAuth-router, or untracked files.
- Do not remove footer/status feedback.
- Do not touch `nul` or `assets/.agent/skills/shared-resend-portfolio/`.

## Verification
Run typecheck, runtime-focused tests, `npm test`, and `git diff --check`. Report exact notification removals/retentions and manual `/reload` surfaces.