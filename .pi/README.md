# Pi-local Takomi Prototype

This `.pi/` directory is the first Pi-native Takomi scaffold.

It is intentionally separate from the existing cross-harness assets under `assets/.agent/` and `assets/Takomi-Agents/`.

## Contents

- `extensions/takomi-runtime/` - Pi runtime glue, embedded workflow playbooks, and orchestrator board tools
- `extensions/takomi-subagents/` - Takomi-facing subagent wrapper over Pi-style execution semantics with resumable conversation IDs
- `extensions/takomi-context-manager/` - Progressive context loading, skill manifests, policy packs, model-routing gates, and context diagnostics
- `prompts/` - Pi-native prompt shortcuts
- `agents/` - Pi-native specialist agent definitions, including a design-stage agent

## Why this exists

Pi auto-discovers `.pi/`, so this is the fastest way to test and iterate.

At runtime, Takomi for Pi is intended to be self-contained inside this `.pi/` bundle plus the embedded core under `src/pi-takomi-core/`.
The older assets under `assets/.agent/` and `assets/Takomi-Agents/` are reference or migration material, not runtime dependencies for the Pi-native Takomi experience.

Later, this can become:
- a package under `assets/pi/` or `packages/`
- an npm-distributed Pi package
- a shared core used by a Pi SDK-powered Takomi application

## First-use notes

Inside Pi, use:
- `/reload` after edits
- `/takomi` to show the Takomi command guide and enable Takomi mode guidance
- `/takomi genesis [prompt]` to run the Genesis planning stage from existing markdown/project context
- `/takomi design [prompt]` to run UI/UX design against the agreed project direction
- `/takomi build [prompt]` to implement while cross-checking against approved UI/design artifacts
- `/takomi plan [title]` to create a Genesis-first orchestration session that can expand through Design and Build
- `/takomi mode idle|code|review|orchestrate` to choose the main-agent mode; Genesis, Design, and Build remain separate lifecycle stages
- `/takomi gate auto` to continue approved plans automatically and explicitly authorize project-local agents for this session
- `/takomi gate review` (or `/takomi gate manual`) to return to the user after each task with results and verification guidance and revoke that authorization
- `/takomi subagents on` or `/takomi subagents off` to allow or disable delegated subagents
- `/takomi subagents list` to list available Takomi agents without exposing the raw `subagent` tool
- `/takomi subagents status` to inspect active subagent state
- `/takomi-status` to show lifecycle, gate, session, and active subagent state
- `/takomi-reset` to reset session-local Takomi runtime state
- `/context-report` to inspect prompt compaction, skill loading, policy gates, model routing corrections, and duplicate extension diagnostics
- `takomi_board` actions now include stage expansion, task updates, multi-task dispatch, and redispatch support for review loops
- The old standalone commands (`/takomi-genesis`, `/takomi-design`, `/takomi-build`, `/takomi-kickoff`, `/autoorch`, `/orch`, `/architect`, `/code`, `/review`, and the `/takomi-subagent*` variants) are folded into `/takomi` subcommands so slash autocomplete stays small.
- prompt shortcuts are suffixed with `-prompt` to avoid collisions with runtime commands, e.g. `/orch-prompt`, `/build-prompt`, `/design-prompt`, `/genesis-prompt`, `/takomi-prompt`, `/prime-prompt`
- a project-local theme is available at `.pi/themes/takomi-noir.json`; select `takomi-noir` in `/settings` to use the Takomi UI palette
- optional Pi feature packs are managed by `takomi setup pi` or `takomi setup pi-features` and refreshed by `takomi refresh`; current defaults install Takomi Interview (`npm:@juicesharp/rpiv-ask-user-question`) while Takomi Todo (`npm:@juicesharp/rpiv-todo`), Browser QA (`npm:pi-chrome`), and Doc Preview (`npm:pi-markdown-preview`) stay opt-in
- additional workflow prompts are available as direct slash commands:
  - `/vibe-primeAgent`
  - `/vibe-spawnTask`
  - `/vibe-syncDocs`

## Dependency + ownership notes

This is the current ownership model other agents should assume:

- `takomi_board` owns lifecycle/session/task orchestration
- `takomi_subagent` is the preferred Takomi-facing delegation tool
- raw Pi `subagent` may still be available in the environment, but is advanced/internal for Takomi work

Important implementation note:

- `takomi_subagent` currently does **not** call raw `subagent` as a tool-to-tool passthrough
- it is implemented in `.pi/extensions/takomi-subagents/`
- it follows Pi-style execution semantics and Pi-style result rendering more closely now
- it is a wrapper/alignment layer, not yet a literal dependency bridge into the `subagent` tool runtime

Bundled with Takomi now:

- `.pi/extensions/takomi-runtime/`
- `.pi/extensions/takomi-subagents/`
- `.pi/extensions/takomi-context-manager/`
- `.pi/prompts/`
- `.pi/agents/`
- `.pi/themes/`
- `src/pi-takomi-core/`

Not yet guaranteed bundled as package dependencies:

- user/global Pi installation
- user/global raw `subagent` extension
- `pi-subagents` as a direct npm dependency of this package

So when working on packaging, agents should distinguish between:

- Takomi-shipped Pi-native runtime assets
- optional user/global Pi runtime dependencies
- optional raw `subagent` availability in the host environment

## Notable behavior

- The lifecycle explicitly models `Genesis -> Design -> Build`.
- Takomi lifecycle judgment is the default runtime behavior, not something that should require the literal phrase `use Takomi`.
- Project defaults live in `.pi/takomi-profile.json`; optional user overrides can be read from `~/.pi/agent/takomi/profile.json`.
- The runtime reads user profile overrides only. It does not write profile files outside the project.
- Profile defaults can assign agents, model preferences, fallback model lists, thinking levels, and dispatch policies by role or lifecycle stage.
- Profile defaults also include `launchMode`, `foreground`, `background`, and `reviewAfterImplementation`.
- Design stage includes a Gemini-oriented hint for model selection.
- Build is treated as a workflow/stage, not as a separate specialist agent.
- A fresh orchestration session starts with a Genesis foundation task, then expands Design and Build only when the scope justifies it.
- The only public Takomi personas are `architect`, `designer`, `coder`, `worker`, `reviewer`, and `orchestrator`. Overlapping upstream built-ins remain hidden behind the execution engine.
- Agent discovery prefers `project/.pi/agents/`, also supports legacy `project/.agents/`, and falls back to Pi's configured user agent directory so new projects can reuse the global Takomi agent pack without hard-coding `~/.pi` assumptions.
- Orchestrator sessions run in hybrid mode:
  - human-readable docs live under `docs/tasks/orchestrator-sessions/<sessionId>/`
  - machine state lives under `.pi/takomi/orchestrator/<sessionId>.json`
- Task packets use canonical persona names and can carry `workflow`, `skills`, confirmed `preferredModel`, explicit `fallbackModels`, `requiredCapabilities`, `preferredThinking`, `executionHint`, `conversationId`, and `checklist` metadata.
- Direct `takomi_subagent` calls build a `TakomiDelegationPlan` before launch. In auto mode the plan launches immediately; in manual mode the plan is returned for review until `confirmLaunch=true` is supplied.
- The subagent tool supports `conversationId`, so reviewed work can be sent back to the same agent for continuation instead of restarting from scratch.
- The subagent tool supports Pi-style single, parallel `tasks`, sequential `chain`, explicit `context=fork|fresh`, `async=true`, and native read/control actions such as `action=list`, `action=status`, `action=doctor`, `action=interrupt`, and `action=resume`.
- The subagent tool supports `agentScope` values of `user`, `project`, and `both`; project-local agents require confirmation by default. The only session authorization bypasses are `TAKOMI_TRUST_PROJECT_AGENTS` and the explicit user `/takomi gate auto` provenance marker; model mode changes plus profile, default, or generic runtime `auto` state do not authorize project agents.
- The explicit user gate-auto marker is stored in session history so it survives resuming that same session. `/takomi gate review`, `/takomi gate manual`, review mode, and `/takomi-reset` append a revocation; it is not a cross-session or profile setting.
- The subagent tool also supports per-run `workflow`, `skills`, `model`, `fallbackModels`, `thinking`, `checklist`, `concurrency`, and `worktree` overrides.
- `takomi_board` records session/state/markdown artifacts only; it does not run subagents.
- Pi's default `subagent` tool remains owned by the user-level/default subagent extension to avoid tool-name conflicts; Takomi uses `takomi_subagent` as the preferred lifecycle-aware execution interface and renders it with the native Pi-style result surface.
- Treat raw `subagent` usage as advanced/internal. Normal Takomi lifecycle execution should go through `takomi_subagent`, then `takomi_board update_task` should record the outcome.
- Active Takomi subagent work now streams through the native Pi-style result UI instead of Takomi's older below-editor stack.
- Use Pi's native result expansion, `Alt+T`, or `/takomi subagents expand` to inspect detailed subagent output.
- Takomi still tracks active runs internally for status and review continuity, but board synchronization is explicit: run with `takomi_subagent`, then update the board.
- `takomi-context-manager` reduces prompt bloat by replacing the always-on skill description dump with a names-only Skill Index plus progressive `skill_manifest`/`skill_load` tools.
- `model-routing.md` is advisory model-facing guidance and the normal source for model-selection judgment. Current user instructions and explicit task models override its recommendations.
- Pi's active exact provider-qualified model registry is the default executable model set. `takomi.routing.approvedModels` is an optional strict allowlist only when explicitly configured; role defaults never become an inferred permission boundary.
- `takomi-context-manager` gates `takomi_subagent` when model-routing context has not been loaded, provides the routing policy, and tells the agent to retry.
- `takomi-context-manager` never performs provider-family substitution. It enforces an explicit strict allowlist when present; otherwise registry/provider failures return to the parent model for policy-guided recovery.
- `takomi-context-manager` detects known duplicate global/project Takomi extension paths in `context_report` to help diagnose tool registration conflicts.
- `context_report` restores context-manager snapshots and Pi tool-result history after reload/restart and explicitly labels gaps; it is not a replacement for Pi's Alt-C token/session stats.
- `context_report` defaults to compact `mode: "summary"`; use `mode: "verbose"` for full diagnostics or `mode: "problems"` for attention-only output. `verbose: true` remains a compatibility alias. `/context-report` exposes `summary`, `verbose`, and `problems` as slash-command argument completions.
- `takomi_board` can:
  - create a Genesis-first lifecycle session by default
  - preserve authored `master_plan.md` and task packet markdown
  - expand a lifecycle stage into additional tasks
  - update task status, notes, and checklist progress
  - rewrite JSON machine state
  - keep task docs organized in `pending/`, `in-progress/`, `completed/`, and `blocked/`
- `takomi_board` intentionally cannot dispatch or redispatch agents. Use `takomi_subagent` for single, parallel, or chain execution, then call `takomi_board update_task` with the result.

## Attribution Notes

- Pi-native Takomi runs on [Pi](https://github.com/earendil-works/pi) / `@earendil-works/pi-coding-agent`, authored by Mario Zechner and Earendil Works.
- Takomi subagent execution builds on [`pi-subagents`](https://github.com/nicobailon/pi-subagents) by Nico Bailon, with Takomi adding lifecycle orchestration, board/state artifacts, model-routing policy, and review-loop conventions.
- Optional Takomi Interview and Todo feature packs integrate [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question) and [`@juicesharp/rpiv-todo`](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-todo) by juicesharp.
- Optional Browser QA can use [`pi-chrome`](https://github.com/tianrendong/pi-chrome) by tianrendong.
- Optional Doc Preview can use [`pi-markdown-preview`](https://github.com/omaclaren/pi-markdown-preview) by omaclaren.
- [`context-mode`](https://github.com/mksglu/context-mode) by Mert Koseoğlu is credited as external research/power-user context tooling; it is not a Takomi default bundle.
