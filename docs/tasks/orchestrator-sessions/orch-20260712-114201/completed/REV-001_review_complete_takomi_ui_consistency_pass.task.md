# Task REV-001: Review Complete Takomi UI Consistency Pass

## Objective
Perform an integrated no-edit review of all committed changes from this session and deliver a ship verdict plus one copy-paste manual exercise prompt covering every changed UI surface.

## Commits in Scope
- `2667d8a` subagent repaint heartbeat
- `5fda3c0` context-manager cards
- `edfa57f` native-first compact subagent narrative/final output
- `1cb06f1` explicit auto-gate project-agent authorization
- `b00fa00` runtime tool cards/feedback
- `ecef3d8` OAuth-router reports
- Existing earlier routing/stats commit `dcc1950` should remain compatible

## Review Areas
1. Compact/expanded information hierarchy and native Pi consistency.
2. Ctrl+O completeness without debug walls or duplicated content.
3. Model-facing tool content remains complete and independent from TUI compression.
4. Subagent active/final narrative, checklist provenance, lifecycle states, and heartbeat cleanup.
5. `/takomi gate auto` provenance and repeated prompt behavior.
6. Footer/status live updates and notification deduplication boundaries.
7. Context-manager skill category determinism/sanitization.
8. OAuth report TUI/RPC lifecycle, redaction, quota semantics, and dismissal.
9. ANSI/control safety, narrow-width behavior, timer/widget cleanup, reload/session replacement.
10. Full test/commit/worktree integrity; exclude unrelated untracked `nul` and `assets/.agent/skills/shared-resend-portfolio/`.

## Definition Of Done
- Full `npm test`, typecheck, and diff checks pass.
- No critical/warning findings remain, or exact blocking revisions are identified.
- All intended commits are present and no required test file is omitted.
- A concise manual `/reload` checklist is provided.
- One final copy-paste prompt exercises skill/policy/context tools, runtime tools, board/workflow/routing, subagent compact/expanded/checklist/final output, gate behavior, and OAuth commands where configured.

## Constraints
Do not edit files. Do not stage or modify untracked content. Findings must be evidence-based and severity ordered.