# Task BLD-008: Unify workflow catalog summaries
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Use one canonical workflow catalog for takomi_workflow and takomi_board show_workflows while retaining their separate API roles.
## Scope
- Takomi runtime workflow catalog/source
- takomi_workflow output
- takomi_board show_workflows output
- Focused consistency tests
## Context
Parent session: orch-20260712-114201

Task title: Unify workflow catalog summaries
## Definition Of Done
- Both APIs derive names/descriptions/stages from one canonical source
- API-specific framing remains appropriate
- No workflow loading or board behavior changes
- Compact/expanded cards remain restrained and complete
- Consistency tests pass
## Expected Artifacts
- Canonical workflow catalog/helper
- Updated outputs/tests
## Dependencies
- BLD-007
## Constraints
- Do not merge the APIs; only unify source-of-truth wording
- Preserve existing workflow payload completeness