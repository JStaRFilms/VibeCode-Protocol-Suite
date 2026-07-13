# Task BLD-001: Implement Context-Manager Tool Renderers

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Follow `vibe-build`. Implement one cohesive context-manager UI slice, then verify it before handoff.

### Prime Agent Context
Read these first:
- `docs/tasks/orchestrator-sessions/orch-20260712-114201/master_plan.md`
- `docs/tasks/orchestrator-sessions/orch-20260712-114201/completed/DES-001_define_shared_takomi_tool_card_ux_and_implementation_map.task.md`
- `.pi/extensions/takomi-context-manager/index.ts`
- `.pi/extensions/takomi-context-manager/skill-tools.ts`
- `.pi/extensions/takomi-context-manager/policy-tools.ts`
- `.pi/extensions/takomi-context-manager/diagnostics-tools.ts`
- Pi `docs/extensions.md` and `docs/tui.md`

### Optional Skill / Context Overlays
No optional overlay is required. Use the repository, installed skill metadata, Pi themes, and Pi TUI APIs as source of truth.

## Objective
Implement a consistent compact/expanded visual language for context-manager tools without changing the complete content returned to the model.

## Scope
- `skill_index`: compact total/category counts; expanded alphabetized skills grouped by deterministic category.
- `skill_manifest`: concise compact status/count summary; expanded complete formatted manifest details.
- `skill_load`: preserve and refine the existing staged compact/expanded renderer.
- `policy_manifest` and `policy_load`: matching compact status cards and complete expanded Markdown.
- `context_report`: useful compact health summary and complete expanded diagnostics.
- Shared helpers may be introduced only within `.pi/extensions/takomi-context-manager` when they reduce duplication safely.

## Context
The approved visual language uses `✓`, `⚠`, `…`, and `✗`; themed names; muted descriptions; dim metadata; and `keyHint("app.tools.expand", ...)`. Compact cards should use lightweight `Text`; expanded cards may use `Container + Markdown`. Skill categorization precedence is explicit metadata, then path taxonomy, then package/source slug, then `uncategorized`. Alphabetize categories and skills deterministically. UI compression must never truncate or rewrite tool content supplied to the model.

## Definition Of Done
- Every scoped tool has a concise compact renderer and a complete expanded renderer.
- Skill index compact mode shows total and category counts.
- Expanded skill index groups alphabetized skills by deterministic category.
- Skill/policy manifests and loads share consistent status, metadata, and expansion hints.
- Context report compact mode surfaces actionable health; expanded mode preserves complete diagnostics.
- Existing `skill-tools.ts` work is preserved and improved rather than discarded.
- Colors come from the active Pi theme; no raw ANSI styling is introduced.
- Typecheck and focused regression tests pass.

## Expected Artifacts
- Updated files under `.pi/extensions/takomi-context-manager`.
- Focused renderer/category tests or deterministic verification additions.
- Handoff listing exact files, tool surfaces, tests, and residual risks.

## Constraints
- Do not modify Takomi runtime, subagent, OAuth-router, or unrelated product files.
- Do not touch untracked `nul`.
- Preserve model-facing tool result completeness.
- Preserve Pi Ctrl+O behavior and use `keyHint("app.tools.expand", ...)`.
- Do not replace staged intentional work merely to simplify implementation.

## Dependencies
- `DES-001` completed.
- Repaint fix `2667d8a` completed and approved.

## Verification
- Run `npm run test:typecheck`.
- Run existing context-manager/regression suites.
- Add deterministic checks for categorization, ordering, compact summaries, and complete expanded content where practical.
- Review `git diff --check` and confirm only task-scoped files changed.

## Handoff Notes
Return exact changed files, before/after behavior per tool, tests and commands run, and anything requiring manual `/reload` verification.