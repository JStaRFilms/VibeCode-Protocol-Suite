# Task BLD-005: Stop repeated project-agent trust prompts
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Ensure project-local Takomi agent trust confirmation is not repeated for every subagent launch after the user approves the same repository agent configuration, while preserving a meaningful security boundary distinct from auto-gate.
## Scope
- .pi/extensions/takomi-subagents trust-confirmation lifecycle
- Repository/agent-set trust fingerprinting
- UI wording distinguishing execution gate from project-agent trust
- Focused tests for approval reuse, changes, denial, and no-UI behavior
## Context
Parent session: orch-20260712-114201

Task title: Stop repeated project-agent trust prompts
## Definition Of Done
- One approval covers subsequent launches for the same repository and unchanged project-agent set during the appropriate trust lifetime
- Changed project-agent definitions invalidate prior trust and prompt again
- Denial and noninteractive blocking remain safe
- TAKOMI_TRUST_PROJECT_AGENTS override still works
- Auto-gate no longer appears to ask launch permission on every subagent call
- Tests pass
## Expected Artifacts
- Trust cache/fingerprint implementation
- Focused regression tests
- Behavior and security rationale
## Dependencies
- BLD-004
## Constraints
- Current cause is hostTrustsProjectAgents only reads TAKOMI_TRUST_PROJECT_AGENTS, so interactive Yes is not remembered and every launch prompts
- Do not conflate Takomi auto-gate with blanket repository trust
- Prefer session/process-scoped trust keyed by canonical repository root plus project-agent file content fingerprint unless existing Pi settings provide an established persistent trust mechanism
- Wording should state this is project-agent trust, not execution approval
- Do not touch nul or unrelated UI surfaces