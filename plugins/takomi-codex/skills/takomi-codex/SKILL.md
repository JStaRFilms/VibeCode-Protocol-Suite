---
name: takomi-codex
description: Use Takomi lifecycle orchestration inside Codex with policy-aware runtime detection, markdown roadbooks, optional Pi/Takomi dispatch, and explicit-consent delegation.
---

# Takomi Codex

Takomi Codex is the Codex-native adapter for the Takomi protocol. Use it when the user asks for Takomi, orchestration, roadbooks, Genesis/Design/Build lifecycle work, policy-aware execution, Pi/Takomi runtime inspection, or delegated task coordination.

## Operating Principle

Choose the smallest execution mode that can do the work well, then delegate by default once Takomi decomposes the work:

1. Direct Codex work for small, local, one-shot tasks.
2. Planning mode for unclear or UI/UX-heavy work.
3. Markdown roadbook orchestration for broad multi-step work.
4. Delegation-first orchestration when Takomi creates subtasks, roadbook tasks, or an orchestration session.

Do not create a board, launch a harness, or spawn threads for trivial edits.

The main Codex agent remains the orchestrator for decomposed work. It owns context intake, task packets, board updates, synthesis, verification, and final user handoff. It should not act as the primary implementer by default after decomposition begins.

User override is explicit: if the user says "do it yourself", "no subagents", "no new threads", or equivalent, the main agent may execute directly while still keeping any existing roadbook current.

## Required Context Pass

Before complex code or orchestration, inspect the project:

- `docs/features/`
- `docs/project_requirements.md`
- `docs/Project_Requirements.md`
- local `.pi/` if relevant
- Takomi feature docs related to the request

For major features, create or update a feature markdown file before implementation.

## Runtime Detection

Use `scripts/takomi-detect.ps1` when runtime state affects the answer.

Detection priority:

1. Project-local `.pi/`.
2. User/global `~/.pi/agent/` and `~/.agents/skills/`.
3. CLI availability for `takomi` and `pi`.
4. Plugin-bundled guidance.

Global/user paths are read-only unless the user explicitly approves a write.

## Policy Loading

Use `scripts/takomi-policy.ps1` when model, subagent, review, or lifecycle routing matters.

Respect project policy first:

- `.pi/settings.json`
- `.pi/takomi-profile.json`
- `.pi/takomi/model-routing.md`
- `.pi/takomi/policies/`

Avoid hard-coding personal model names as universal defaults. Prefer provider-qualified model IDs only when the active policy or runtime registry supports them.

## Roadbook Orchestration

Use `scripts/takomi-board.ps1` for broad work that needs durable coordination.

Markdown roadbooks are the durable source of truth for orchestration state, even when Pi, subagents, multi-agent tools, explicitly requested Codex threads, or optional JSON tracking are used.

Roadbooks live at:

```text
docs/tasks/orchestrator-sessions/<sessionId>/
```

The markdown layer is primary:

- `master_plan.md`
- `pending/*.task.md`
- `in-progress/*.task.md`
- `completed/*.task.md`
- `blocked/*.task.md`
- `Orchestrator_Summary.md`

JSON tracking is optional and should not replace readable markdown.

## Delegation-First Loop

When a request is broad enough to create subtasks, roadbook tasks, or an orchestration session:

1. Create or update the markdown roadbook and task packets.
2. Delegate implementation to an implementer subagent or child thread.
3. Delegate review to a separate reviewer subagent or child thread.
4. Synthesize results in the main thread.
5. Update the roadbook, then accept the work or redispatch with a tighter packet.

In Pi, prefer `takomi_subagent` for implementer and reviewer runs. In Codex, prefer available multi-agent or subagent tools for delegated subtasks. If those tools are unavailable, create markdown task packets and execute directly as the fallback. Use user-owned Codex child threads only when the user explicitly asks for new threads, handoff threads, or parallel thread orchestration, or when the parent agent recommends that route and the user approves it.

## Lifecycle Modes

### Genesis

Use for project foundations, requirements, feature planning, and issue-style task breakdowns.

Expected artifacts:

- PRD or project requirements update
- feature docs
- task/issue docs
- acceptance criteria

### Design

Use for UI/UX only: visual systems, screen structure, user journeys, interaction flows, mockups, accessibility expectations, and frontend handoff constraints.

Do not use Design for application architecture, data models, API/interface contracts, backend service boundaries, deployment strategy, or implementation task planning. Route that work to Genesis or Architect planning.

Expected artifacts:

- visual design notes or specs
- screen/component appearance plan
- interaction and responsive behavior
- accessibility and usability constraints

### Build

Use for implementation after enough context exists.

Expected behavior:

- implement iteratively
- keep files focused
- update docs alongside code
- verify with available tests or scripts

### Review

Use for bug finding, quality gates, security review, and completion audits.

Expected behavior:

- lead with findings
- verify artifacts before marking complete
- record unresolved risks

## Pi/Takomi Bridge

Use `scripts/takomi-pi-dispatch.ps1` conservatively.

Default behavior is dry-run recommendation. Only run real Pi/Takomi commands when:

- the user explicitly asks for it, or
- an active policy calls for it and the action is safe, or
- the command is diagnostic/read-only.

Do not assume raw subagent tools are present. Prefer Takomi-facing surfaces when available.

When Pi orchestration is active, prefer `takomi_subagent` over direct implementation for decomposed work.

## Other Harnesses

Use `scripts/takomi-harness.ps1` when a project policy or user request points to other Takomi-supported harnesses.

Default behavior is dry-run. Before running with `-Execute`:

- confirm the target harness or Takomi command
- understand whether it will write user/global files
- prefer `status` or `harnesses` before `sync`, `setup`, or `refresh`
- keep Codex as the parent coordinator unless the user explicitly hands off execution

## Codex Delegation

When Takomi decomposition makes delegation appropriate:

1. Search for available multi-agent or subagent tools with `tool_search` when delegation would materially help.
2. Give each delegate a self-contained task packet path and definition of done.
3. Keep the parent thread responsible for synthesis, verification, docs, and board updates.
4. Do not delegate tasks that require global/user config writes unless the user approved that scope.
5. Create or fork user-owned Codex threads only when the user explicitly asks for new threads, handoff threads, or parallel thread orchestration, or when the parent agent recommends that route and the user approves it.

If delegation tooling is unavailable, fall back to markdown task packets and direct Codex execution.

## File Size Discipline

Keep plugin scripts and skill files modular. If a file approaches 200 lines, split responsibilities instead of growing one giant file.

## Completion Rule

Before handoff:

- update the relevant feature doc
- update the roadbook if one exists
- run the plugin validator when plugin files changed
- run script smoke checks when scripts changed
- state what was verified and what remains unverified
