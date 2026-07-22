# TakomiFlow Portable Plugin

## Goal

Move the proven TakomiFlow Google Flow automation into this repository as the source-of-truth portable package so users and agents can install it on fresh machines, reuse existing trusted Chrome sessions, and operate through MCP when available or CLI when not.

## Components

### Codex Plugin

- `plugins/takomi-flow/`
  - source-of-truth plugin package
  - bundled skill, MCP server, CLI, schemas, prompts, and provider contract
  - branded icon assets for store listing, dark mode, and composer surfaces
  - browser automation scripts for trusted Chrome attach and Flow generation
- `.agents/plugins/marketplace.json`
  - repo-local marketplace entry for `takomi-flow`
- `scripts/install-takomi-flow.ps1`
  - optional installer for copying/registering the plugin into user/global Codex plugin paths
- `assets/.agent/skills/takomi-flow/SKILL.md`
  - standalone harness-visible skill for agents that do not load Codex plugin skills
  - merged install/repair and runtime workflow instructions so agents have one TakomiFlow entrypoint

### Agent Surface

- First-run agents should run `doctor`, then check whether `http://127.0.0.1:9222` is already serving Chrome DevTools Protocol.
- If CDP is alive, agents should reuse it.
- If CDP is missing, agents should start `trusted-chrome` and ask the user to sign into Google Flow manually.
- For repeated generations, agents should reuse the current Flow project tab or pass `projectUrl`; clicking `New project` requires explicit `allowNewProject`.
- If a project chat is stale or broken, agents should recover by creating a fresh chat inside the same project before asking for manual intervention.
- Agents should prefer MCP tools when the harness supports MCP and the plugin is installed.
- Agents should offer plugin installation/repair in Codex only after user approval.
- Agents should fall back to CLI commands and standalone skill instructions when MCP or plugins are absent.

### Runtime Surface

- CLI-first core: `node scripts/takomi-flow.mjs <command>`.
- MCP adapter: `node scripts/mcp-server.mjs`.
- Browser profile: user-local trusted Chrome profile by default.
- Outputs: run folders with `run.json`, `assets.json`, `report.md`, screenshots, downloads, and optional video frames.

## Data Flow

1. Agent discovers or installs the plugin from this repo.
2. Agent runs readiness checks.
3. Agent checks for an existing trusted Chrome CDP instance.
4. Agent reuses the instance or launches trusted Chrome.
5. User signs in manually when needed.
6. Agent resolves the target project from `projectUrl` or the current project tab.
7. Agent prepares and validates a Flow request.
8. Agent submits only with explicit spend approval.
9. Agent records `projectUrl`, downloads assets, catalogs outputs, and writes a report.

## Database Schema

No database is required.

Persistent state is file-based:

- request JSON under `requests/`
- run metadata in `run.json`
- asset metadata in `assets.json`
- Markdown handoff in `report.md`

## Install / Portability Rules

- MCP is optional, not required.
- A harness without MCP can still use the CLI and skill instructions.
- A fresh computer can bootstrap by running the repo installer or directly invoking the plugin CLI from this repo.
- Global/user writes must be explicit installer actions, not hidden side effects.
- Project URLs must be captured for every generated Flow project.
- New Flow projects are opt-in; project reuse is the default.

## Verification

- Plugin validation should pass with the Codex plugin validator.
- Skill validation should pass with the Codex skill validator.
- MCP smoke should pass when Node dependencies are installed.
- CLI `doctor`, `capabilities`, `template`, `workflow`, `inspect`, `assets`, and `report` should work without MCP.
- Store art should resolve from `assets/logo.png`, `assets/logo-dark.png`, and `assets/composer-icon.png`.
- Store examples should show real creative workflows, not only a generic safe browser workflow prompt.
- The generated neon TakomiFlow icon is used as the plugin logo and composer icon source.
