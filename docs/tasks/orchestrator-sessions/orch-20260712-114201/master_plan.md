# Takomi Harness UI Consistency Pass

## Objective
Create a consistent compact/expanded visual language across Takomi tools and reports while preserving live footer feedback and full model-facing tool content.

## Approved UX
- Keep live footer/status changes.
- Compact cards show status, identity, counts, and a configured expansion hint.
- Ctrl+O expanded views show complete, well-formatted content.
- Skill index compact view shows total skills and category counts; expanded view shows the complete alphabetized list grouped by category.
- Notifications are reserved for warnings, failures, and user-attention events rather than duplicating routine durable tool cards.

## Workstreams
1. Define shared renderer conventions and category derivation.
2. Improve context-manager skill, policy, manifest, and diagnostic tools.
3. Improve runtime workflow, routing-policy, board, and mode tool surfaces.
4. Improve oauth-router reports and stale-widget behavior.
5. Verify rendering, type safety, regressions, and produce a UI exercise prompt.

## Constraints
- Do not alter model-facing content merely to shorten the TUI.
- Preserve the existing uncommitted skill_load renderer work.
- Use Pi theme APIs, Markdown components, and configured key hints.
- Keep compact output readable at narrow terminal widths.
- No unrelated changes; do not touch the untracked `nul` file.

## Definition of Done
- All approved surfaces have deliberate compact and expanded behavior where applicable.
- Skill categories are derived from reliable installed metadata or paths with a sensible uncategorized fallback.
- Live mode footer feedback remains intact.
- Typecheck and regression tests pass.
- A copy-paste prompt exercises every changed UI surface.
