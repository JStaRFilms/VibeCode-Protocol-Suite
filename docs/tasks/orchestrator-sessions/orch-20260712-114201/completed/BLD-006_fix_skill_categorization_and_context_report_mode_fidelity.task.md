# Task BLD-006: Fix skill categorization and context report mode fidelity
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Reuse real installer/category metadata for flat global skills, make category summaries responsive, and ensure context_report expanded output respects the requested mode.
## Scope
- .pi/extensions/takomi-context-manager skill discovery/category metadata
- Installer-generated skill registry/category sources
- skill_index compact/expanded responsive rendering
- context_report requested-mode rendering and tests
## Context
Parent session: orch-20260712-114201

Task title: Fix skill categorization and context report mode fidelity
## Definition Of Done
- Flat global skills use installer/source categorization where available instead of mass uncategorized fallback
- Category precedence remains deterministic and documented
- Compact category metadata adapts at narrow widths without horizontal slop
- Expanded problems mode shows problem-only content, summary shows summary-appropriate content, verbose shows full report
- Model-facing content remains unchanged and presentation remains control-safe
- 40/60/120 and real installed-skill fixtures pass
## Expected Artifacts
- Context-manager implementation changes
- Realistic installed-skill/category fixture tests
- Mode-fidelity and responsive renderer tests
## Dependencies
- REV-001
## Constraints
- Do not invent categories from names when installer metadata exists
- Preserve explicit metadata → installer/source taxonomy → path/package → uncategorized precedence
- Do not regress sanitization or model-facing content
- Do not touch unrelated extensions/nul/assets