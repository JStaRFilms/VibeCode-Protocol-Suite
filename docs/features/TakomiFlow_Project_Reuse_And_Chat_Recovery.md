# TakomiFlow Project Reuse And Chat Recovery

## Goal

Make TakomiFlow reliable for repeated generations inside one Google Flow project. The CLI, MCP tools, and skill should prefer an existing project/editor, wait for the Flow UI to be genuinely usable, and recover from a broken chat by creating a new chat inside the same project instead of creating another Flow project.

## Regression Check

- Existing `TakomiFlow_Portable_Plugin.md` requires MCP and CLI parity, explicit browser/spend gates, stable request/result JSON, and recorded `projectUrl`.
- Existing provider contract says browser-capable MCP tools require `allowBrowser=true`, generation requires `allowSpend=true`, and agents should capture `projectUrl`.
- Current `doctor` and `selftest` pass before implementation.
- Current `ensureProjectEditor` creates a new project from the dashboard when it cannot use the current URL, which conflicts with the new desired repeated-generation behavior.

## Components

### CLI

- Add request/session options that are usable from `takomi-flow.mjs workflow` and `generate`:
  - `--project-url <url>`: open or attach to a specific Flow project/editor.
  - `--reuse-current-project`: prefer an already open `/project/` tab when attached through CDP.
  - `--allow-new-project`: opt in to clicking `New project` when no reusable project/editor is available.
  - `--fresh-chat-on-failure`: recover prompt/submit/chat failures by starting a fresh chat in the same project.
  - Optional wait flags or environment variables for editor readiness and generation polling.
- Keep default generation behavior conservative: no silent project creation during repeated agent workflows.
- Preserve no-spend request preparation and validation behavior.

### MCP

- Mirror the CLI session fields in `takomi_flow_prepare`, `takomi_flow_workflow`, and `takomi_flow_generate` schemas where relevant.
- Keep `allowBrowser=true` and `allowSpend=true` gates unchanged.
- Return structured `manualActions` when the agent needs a project URL, a visible editor, login, captcha, quota review, or manual UI recovery.

### Browser Automation

- Extract focused project/session helpers instead of growing `flow-ui.mjs` past the 200-line pressure point.
- Support these browser states:
  - attached Chrome already on a Flow project editor
  - explicit `projectUrl`
  - dashboard with project cards but no explicit project URL
  - no reusable project and `allowNewProject=false`
  - no reusable project and `allowNewProject=true`
- Improve editor readiness waits:
  - wait for DOM content
  - tolerate slow network idle
  - wait for known editor sentinel text
  - wait for an enabled prompt input
  - return diagnostic screenshots and manual actions on timeout
- Add same-project fresh chat recovery:
  - detect prompt fill failure, missing submit button, obvious chat error text, or disabled prompt surface
  - click a `New chat` or equivalent chat reset control when found
  - explicitly avoid clicking `New project` during chat recovery
  - re-wait for editor readiness and retry prompt entry once

### Skill

- Update `plugins/takomi-flow/skills/takomi-flow/SKILL.md` so agents:
  - reuse the current project or pass `--project-url`
  - create new Flow projects only when the user asks or `--allow-new-project` is set
  - use fresh chat recovery inside the project when chat state is bad
  - leave trusted Chrome open across repeated generations

### Docs And Contracts

- Update the provider contract, onboarding docs, templates, capabilities, and schemas to document project reuse fields.
- Keep `projectUrl` visible in run metadata and reports so future runs can reuse the same project.

## Data Flow

1. Agent runs `doctor` or `audit`.
2. Agent attaches to trusted Chrome or opens Flow through the existing browser flow.
3. Agent resolves the target project:
   - use request `projectUrl`
   - else reuse the current `/project/` tab when attached
   - else require manual action unless `allowNewProject=true`
4. Agent waits for the project editor prompt surface to become usable.
5. Agent fills the prompt.
6. If the chat surface is broken, agent starts a fresh chat inside the same project and retries once.
7. Agent submits only when `allowSpend=true`.
8. Agent records the resolved `projectUrl`, screenshots, generation outcome, assets, and manual actions.

## Database Schema

No database is required.

Persistent state remains file-based:

- request JSON in `requests/`
- run metadata in `run.json`
- screenshots in `screenshots/`
- downloaded media in `downloads/`
- asset catalog in `assets.json`
- Markdown handoff in `report.md`

Expected request/result additions:

```json
{
  "projectUrl": "https://labs.google/fx/tools/flow/project/example",
  "reuseCurrentProject": true,
  "allowNewProject": false,
  "freshChatOnFailure": true,
  "editorWaitMs": 90000
}
```

## Acceptance Criteria

- A generation request can target a specific `projectUrl`.
- A CDP-attached browser already on a Flow project can be reused without navigating back to the dashboard.
- TakomiFlow does not click `New project` unless `allowNewProject` is explicitly enabled.
- When prompt entry or submit fails because the chat is stale/broken, TakomiFlow tries one fresh chat inside the same project.
- UI waits distinguish slow loading from login/captcha/quota/manual-action states.
- Generation waits now probe for already-downloadable media during queue/progress polling so stale scheduled or failure text does not force the CLI to sit for the full wait timeout after Flow has exposed the Download control.
- CLI, MCP schemas, request schema, capabilities, provider contract, onboarding docs, and skill instructions all describe the same behavior.
- `doctor`, `selftest`, `mcp-smoke`, and no-spend workflow validation pass after implementation.

## Implementation Notes

- Prefer a new helper such as `scripts/lib/flow-project-session.mjs` for project reuse and chat recovery logic.
- Keep `flow-ui.mjs` focused on small UI primitives.
- Avoid long single patches on Windows; edit in focused chunks.
- Do not run spend-generating Flow actions during verification without explicit user approval.

## Implementation Summary

- Added `scripts/lib/flow-project-session.mjs` for project URL resolution, current project tab reuse, explicit new-project opt-in, editor readiness waits, and one-shot same-project fresh chat recovery.
- Extended request normalization, validation, CLI flags, MCP schemas, templates, capabilities, settings plans, and result schema with project-session fields.
- Updated generation flow so `New project` is not clicked unless `allowNewProject` is true, while prompt/submit failures can retry through a fresh chat inside the same project.
- Updated generation outcome polling to periodically probe for downloadable media and normalize stale `failed`/`timeout` outcomes to `download_ready` when a real MP4 is downloaded.
- Updated the TakomiFlow skill, provider contract, onboarding guide, and portable plugin feature doc.

## Verification

- `node plugins/takomi-flow/scripts/takomi-flow.mjs doctor`
- `node plugins/takomi-flow/scripts/takomi-flow.mjs workflow --kind video --prompt "Project reuse no spend validation" --project-url "https://labs.google/fx/tools/flow/project/test" --reuse-current-project --fresh-chat-on-failure=false --editor-wait-ms 5000 --output-dir tmp/takomi-flow-project-reuse-test`
- `node plugins/takomi-flow/scripts/takomi-flow.mjs validate --request <prepared request>`
- `node plugins/takomi-flow/scripts/takomi-flow.mjs generate --request <prepared request> --project-url "https://labs.google/fx/tools/flow/project/test" --fresh-chat-on-failure=false`
- `node plugins/takomi-flow/scripts/takomi-flow.mjs selftest`
- `node scripts/mcp-smoke.mjs` from `plugins/takomi-flow`
- `npm run test:typecheck`
- `npm run test:regressions`
- `npm run test:skills`

No spend-generating browser submission was run.
