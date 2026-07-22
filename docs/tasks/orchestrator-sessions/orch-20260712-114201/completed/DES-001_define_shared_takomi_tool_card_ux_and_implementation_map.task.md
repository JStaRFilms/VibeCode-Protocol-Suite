# Task DES-001: Define shared Takomi tool-card UX and implementation map
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-design` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Audit the current implementation and produce an actionable renderer design covering all approved surfaces without editing code.
## Scope
- .pi/extensions/takomi-context-manager
-  .pi/extensions/takomi-runtime
- .pi/extensions/oauth-router
## Context
Parent session: orch-20260712-114201

Task title: Define shared Takomi tool-card UX and implementation map
## Definition Of Done
- Exact compact and expanded layouts are specified
- Skill category derivation is grounded in repository metadata
- Mode footer versus notification behavior is explicitly preserved
- File-level implementation map and risks are documented
## Expected Artifacts
- Design findings returned to orchestrator
- Recommended shared helper boundaries
- Verification matrix
## Dependencies
- none
## Constraints
- Do not edit files
- Account for the existing uncommitted skill-tools.ts changes
- Follow Pi custom renderer APIs and configured key hints