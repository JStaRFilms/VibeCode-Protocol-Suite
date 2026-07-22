# Codex Takomi Plugin

## Goal

Create a repo-committable Codex plugin that embodies Takomi as a portable orchestration layer while adapting to local Pi/Takomi runtime state when it exists.

For user-facing setup and first-run guidance, see [Takomi Codex Onboarding](../takomi-codex-onboarding.md). This feature document remains the implementation blueprint and design record.

The plugin should let a normal Codex request use Takomi judgment without forcing ceremony:

- small tasks stay direct
- broad tasks create or update markdown roadbooks
- policy-aware tasks inspect project/user Takomi config
- available Pi/Takomi runtimes can be used through explicit scripts or future MCP tools
- delegated orchestration is supported through available multi-agent/subagent tooling, with user-owned Codex threads available as an explicit or approved orchestration option

## Components

### Codex Plugin

- `plugins/takomi-codex/.codex-plugin/plugin.json`
  - valid Codex plugin manifest
  - points to bundled skills and scripts
  - points to bundled logo/icon assets
  - avoids unsupported fields
- `.agents/plugins/marketplace.json`
  - repo-local marketplace metadata
  - points Codex at `./plugins/takomi-codex`
- `plugins/takomi-codex/skills/takomi-codex/SKILL.md`
  - Codex-native Takomi entrypoint
  - lifecycle routing for Genesis, Design, Build, Review, and Recovery
  - environment adapter rules for Pi/Takomi detection
  - markdown-board orchestration rules
  - optional delegation rules for available multi-agent/subagent tooling
- `plugins/takomi-codex/scripts/`
  - `takomi-detect.ps1`
  - `takomi-doctor.ps1`
  - `takomi-board.ps1`
  - `takomi-policy.ps1`
  - `takomi-pi-dispatch.ps1`
  - `takomi-harness.ps1`

### Client / Agent Surface

- Codex loads the plugin skill and applies Takomi routing.
- The agent can call local scripts through the terminal.
- The agent can use available multi-agent or subagent tools when delegation is explicitly useful.
- The agent uses Codex thread tools only when the user explicitly asks for new threads, handoff threads, or parallel thread orchestration, or when the agent recommends that route and the user approves it.
- The agent reports which mode it selected for broad work.

### Server / Runtime Surface

There is no long-running server in the first pass.

The plugin reads file-system state and may call local commands:

- project `.pi/`
- `~/.pi/agent/`
- `~/.agents/skills/`
- `takomi` CLI
- `pi` CLI
- project `docs/tasks/orchestrator-sessions/`

Future versions can add an MCP server once the script contract settles.

## Data Flow

1. User asks Codex for work.
2. The `takomi-codex` skill classifies the request:
   - direct task
   - planning task
   - lifecycle task
   - orchestration task
   - review/recovery task
3. The skill loads only relevant context:
   - project requirements
   - feature docs
   - Takomi policies
   - available runtime profile
4. The agent runs detection scripts when runtime state matters.
5. For broad work, the agent creates or updates markdown roadbooks:
   - `docs/tasks/orchestrator-sessions/<sessionId>/master_plan.md`
   - `docs/tasks/orchestrator-sessions/<sessionId>/pending/*.task.md`
   - `docs/tasks/orchestrator-sessions/<sessionId>/in-progress/*.task.md`
   - `docs/tasks/orchestrator-sessions/<sessionId>/completed/*.task.md`
   - `docs/tasks/orchestrator-sessions/<sessionId>/blocked/*.task.md`
6. Execution uses the smallest sufficient path:
   - Codex direct work
   - local scripts
   - Pi/Takomi CLI bridge when available
   - multi-agent/subagent delegation when tools are available and the task warrants it
   - user-owned Codex threads only when explicitly requested by the user or recommended and approved
7. The agent updates docs and board state before handoff.

## Database Schema

No database is required.

Persistent state is file-based.

### Plugin Manifest

- `.codex-plugin/plugin.json`
  - plugin identity
  - semver
  - skills path
  - interface metadata

### Roadbook Markdown

- `sessionId`
- goal
- context intake
- policies consulted
- execution mode
- task table
- task packet files
- verification notes
- completion summary

### Optional Machine State

The first pass should not require JSON state. If needed later, add:

- `.takomi-codex/sessions/<sessionId>.json`

Only use JSON for machine continuity; markdown remains the source of human trust.

## Runtime Detection Priority

1. Project-local Takomi/Pi config:
   - `.pi/settings.json`
   - `.pi/takomi-profile.json`
   - `.pi/takomi/model-routing.md`
   - `.pi/takomi/policies/`
   - `.pi/agents/`
   - `.pi/prompts/`
2. User/global config:
   - `~/.pi/agent/`
   - `~/.agents/skills/`
3. CLI availability:
   - `takomi`
   - `pi`
4. Plugin-bundled defaults.

## Write Policy

- Project files can be created or changed when the user requested project work.
- User/global files must not be written without explicit user confirmation.
- The plugin should prefer read-only detection for global paths.
- Roadbook markdown is project-owned and safe to commit.
- Plugin package files live under `plugins/takomi-codex/` so this repo can commit them.

## Commands

### `takomi-detect.ps1`

Reports available runtime surfaces:

- project root
- `.pi` presence
- Takomi profile
- routing policy
- local/global agents
- `takomi` CLI path/version
- `pi` CLI path/version
- Codex plugin root

### `takomi-doctor.ps1`

Runs deeper checks and returns human-readable remediation:

- missing plugin files
- invalid plugin manifest
- missing policy files
- duplicate runtime hints
- missing CLI tools

### `takomi-board.ps1`

Creates and updates markdown roadbooks:

- `create`
- `show`
- `add-task`
- `update-task`
- `complete-task`
- `summary`

### `takomi-policy.ps1`

Displays resolved policy context without changing it:

- model routing
- subagent routing
- lifecycle policy
- review policy

### `takomi-pi-dispatch.ps1`

Optional bridge into Pi/Takomi when available.

First pass should be conservative:

- detect only by default
- print exact command recommendations
- require explicit `-Execute` before running Pi/Takomi commands that dispatch work

### `takomi-harness.ps1`

Dry-run-first bridge for Takomi-supported harness operations:

- `status`
- `harnesses`
- `sync`
- `setup`
- `refresh`

This supports non-Pi harnesses when the user or project policy points there.

## Codex Delegation

The skill should support delegation through available multi-agent or subagent tools when broad work benefits from independent execution or review.

Rules:

- Use direct work for small tasks.
- Use one delegate per independent specialist task only when the task is broad enough.
- Each delegate receives a self-contained task packet path.
- Parent thread owns synthesis and board updates.
- Delegates should not write global/user config.
- Create or fork user-owned Codex threads only when the user explicitly asks for new threads, handoff threads, or parallel thread orchestration, or when the parent agent recommends that route and the user approves it.
- Parent thread verifies deliverables before marking tasks complete.

## Regressions To Watch

- Do not make every request create a board.
- Do not require Pi for Codex-native Takomi behavior.
- Do not silently overwrite `.pi`, `~/.pi`, or routing policies.
- Do not hard-code personal model names as universal defaults.
- Do not expose raw subagent/harness dispatch unless policies and user intent justify it.
- Do not let JSON tracking replace readable markdown roadbooks.
- Keep plugin files modular and below the 200-line guidance where practical.

## Onboarding Surface Audit

Current onboarding surfaces serve different audiences and should stay distinct:

- `README.md`: broad Takomi users. It currently explains the Pi harness, context manager, global skills install, and Codex skill-native path, but it does not yet explain the newer Codex plugin path.
- `.agents/plugins/marketplace.json`: Codex/plugin discovery. It declares the repo-local `takomi-codex` plugin source at `./plugins/takomi-codex`.
- `plugins/takomi-codex/.codex-plugin/plugin.json`: Codex plugin install/preview surface. It provides display name, short and long descriptions, default prompts, category, brand assets, and skill path.
- `plugins/takomi-codex/skills/takomi-codex/SKILL.md`: agent/operator surface. It explains lifecycle routing, policy loading, runtime detection, roadbooks, dry-run Pi/Takomi dispatch, and optional multi-thread delegation.
- `plugins/takomi-codex/scripts/*.ps1`: verification and operations surface. These scripts provide read-only detection, policy display, doctor checks, roadbook operations, dry-run Pi/Takomi dispatch, and dry-run harness operations.
- `docs/features/Codex_Takomi_Plugin.md`: implementation blueprint and design record. It should not become the long user-facing onboarding guide.

Script safety matrix:

| Script | Main Use | Writes Files? | Execution Risk |
| --- | --- | --- | --- |
| `takomi-detect.ps1` | Inspect available project/user/CLI runtime surfaces | No | Read-only diagnostic |
| `takomi-policy.ps1` | Display project-first policy and routing context | No | Read-only diagnostic |
| `takomi-doctor.ps1` | Validate plugin readiness and runtime hints | No | Read-only diagnostic |
| `takomi-board.ps1` | Create and update markdown roadbooks | Yes, project docs only | Safe for requested project docs work |
| `takomi-pi-dispatch.ps1` | Recommend or run Pi/Takomi bridge commands | Dry-run by default | Use `-Execute` only with explicit approval or safe diagnostics |
| `takomi-harness.ps1` | Recommend or run Takomi-supported harness operations | Dry-run by default | Use `-Execute` only after target and write scope are understood |

Main gaps found during the Genesis audit:

1. There is no canonical user-facing Codex plugin onboarding guide.
2. README users can discover Codex skills, but not the repo-local Codex plugin workflow.
3. The first-run command sequence is spread across the feature doc and script names instead of presented as a copy-pasteable verification path.
4. The "works without Pi, adapts when Pi/Takomi exists" promise needs a plain-language onboarding explanation.
5. Runtime safety boundaries should be surfaced earlier: project files are safe to update when requested, while user/global runtime files are read-only unless the user approves writes.
6. `takomi-board.ps1` currently needs PowerShell 7 (`pwsh`) because Windows PowerShell 5 fails on newer syntax such as `??`.
7. Plugin prompts are useful examples, but users need them in human docs too: "Use Takomi to plan this feature", "Create a Takomi roadbook for this work", and "Inspect the local Takomi runtime".

Minimum first-run journey for a new Codex plugin user:

1. Install or enable the repo-local plugin exposed by `.agents/plugins/marketplace.json`.
2. Ask Codex to use `takomi-codex`, inspect runtime, or create a Takomi roadbook.
3. Run non-mutating verification commands: `takomi-detect.ps1`, `takomi-policy.ps1`, and `takomi-doctor.ps1`.
4. For broad work, create or show a markdown roadbook under `docs/tasks/orchestrator-sessions/<sessionId>/`.
5. Use Pi/Takomi dispatch only as a dry-run recommendation unless the user explicitly authorizes execution.

Canonical user-facing onboarding now lives in `docs/takomi-codex-onboarding.md`; keep this feature doc focused on implementation notes and design history.

## Acceptance Criteria

- A valid Codex plugin exists under `plugins/takomi-codex/`.
- The plugin includes a Takomi skill with lifecycle, policy, board, and runtime-adapter guidance.
- The plugin includes local scripts for detection, doctor checks, board operations, policy display, and optional Pi dispatch.
- The plugin works without Pi installed.
- The plugin detects Pi/Takomi state when present.
- The plugin preserves user/global config unless explicitly told to write it.
- Markdown roadbooks can be created and updated from scripts.
- The plugin can be validated with the Codex plugin validator.
- This feature doc is updated with implementation notes after build.

## Current Status

The first plugin pass has been implemented and validated. Future work should treat this document as the implementation record and use the onboarding roadbook tasks for user-facing documentation improvements.

## Implementation Notes

- [x] Created repo-local plugin at `plugins/takomi-codex/`.
- [x] Added repo-local marketplace metadata at `.agents/plugins/marketplace.json`.
- [x] Added `.codex-plugin/plugin.json` with Takomi-specific metadata.
- [x] Added Takomi logo assets under `plugins/takomi-codex/assets/`.
- [x] Added `skills/takomi-codex/SKILL.md` for Codex-native Takomi behavior.
- [x] Added `scripts/takomi-detect.ps1` for read-only runtime detection.
- [x] Added `scripts/takomi-doctor.ps1` for plugin and runtime readiness checks.
- [x] Added `scripts/takomi-board.ps1` for markdown roadbook creation and task updates.
- [x] Added `scripts/takomi-policy.ps1` for project/global policy display.
- [x] Added `scripts/takomi-pi-dispatch.ps1` as a conservative dry-run-first Pi/Takomi bridge.
- [x] Added `scripts/takomi-harness.ps1` as a conservative dry-run-first bridge for other Takomi-supported harnesses.
- [x] Kept plugin files modular and under 200 lines each.
- [x] Validated the plugin with the Codex plugin validator.
- [x] Smoke-tested detection, doctor, policy, board, and dispatch status commands.
- [x] Audited onboarding surfaces for the Codex plugin docs roadbook.
- [x] Added `.agents/plugins` and `plugins` to the npm package allowlist for release `2.1.39`, so global `takomi` installs include the Codex plugin package and marketplace metadata.

## Verification

Commands run:

```powershell
python C:\Users\johno\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\plugins\takomi-codex
```

Result: plugin validation passed.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-detect.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-policy.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-doctor.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-pi-dispatch.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite -Action status
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-harness.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite -Action status
```

Result: the plugin detected project `.pi`, project profile, routing policy, policy files, user runtime folders, the `takomi` CLI, and the `pi` CLI. Doctor passed.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action create -SessionId orch-20260628-000001
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action add-task -SessionId orch-20260628-000001 -TaskTitle "Verify board script"
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action complete-task -SessionId orch-20260628-000001 -TaskId T001
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action summary -SessionId orch-20260628-000001
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action show -SessionId orch-20260628-000001
```

Result: temp roadbook was created, task was added, task moved to completed, summary was written, and status showed `completed: 1`.

```powershell
npm pack --dry-run --json
```

Result: release packaging includes `.agents/plugins/marketplace.json` and `plugins/takomi-codex/**`, including manifest, assets, scripts, and skill entrypoint.
