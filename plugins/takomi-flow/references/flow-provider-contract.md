# TakomiFlow Provider Contract

## Purpose

TakomiFlow gives agents a stable interface for asking Google Flow to create assets through a browser profile the user controls.

## Surfaces

- Skill: route Codex behavior and safety rules.
- CLI: run browser workflows, request preparation, validation, and asset inspection.
- MCP: expose safe no-spend commands as callable agent tools.

MCP server:

```bash
node scripts/mcp-server.mjs
```

Smoke test:

```bash
node scripts/mcp-smoke.mjs
```

MCP tools mirror stable JSON operations: capabilities, doctor, audit, examples, template, prepare, workflow, validate, observe, generate, selftest, inspect, latest, runs, assets, review, collect, and report.

Browser-capable MCP tools require explicit `allowBrowser=true`. Generation also requires the normal spend guard.

MCP resources:

- `takomi-flow://contract`
- `takomi-flow://capabilities`
- `takomi-flow://examples`
- `takomi-flow://schemas/request`
- `takomi-flow://schemas/result`
- `takomi-flow://schemas/collection`
- `takomi-flow://templates/video`
- `takomi-flow://templates/image`

MCP prompts:

- `takomi_flow_video_workflow`
- `takomi_flow_image_workflow`
- `takomi_flow_review_workflow`
- `takomi_flow_collect_workflow`

## Agent Preflight

Run this before browser work when reliability matters:

```bash
node scripts/takomi-flow.mjs doctor
node scripts/takomi-flow.mjs audit
```

`audit` is the preferred agent preflight. It reports readiness, safe no-spend actions, gated browser/spend actions, recent runs, and recommended next steps.

First-run agents should also check for an existing trusted Chrome DevTools endpoint before launching a new browser:

```bash
curl http://127.0.0.1:9222/json/version
```

If the endpoint exists, reuse it with `--cdp-url http://127.0.0.1:9222`. If it does not exist, run `trusted-chrome` and ask the user to sign into Google Flow manually. Browser commands should start from trusted Chrome/CDP by default; Playwright-launched browser contexts are only an explicit fallback. MCP is optional; every MCP operation has a CLI equivalent through `node scripts/takomi-flow.mjs`.

Repeated generations should reuse a Flow project instead of creating a new one. Pass `projectUrl` / `--project-url`, or attach to trusted Chrome while it is already on a `/project/` editor tab. TakomiFlow prefers the current project by default, does not click `New project` unless `allowNewProject=true` / `--allow-new-project` is set, and can recover a stale or broken chat by starting one fresh chat inside the same project.

Flow should be treated as one active paid generation at a time. A gray preview placeholder plus scheduled, queue, or ready-shortly copy means the generation was accepted and is still in progress; do not classify it as failed or submit another paid generation until the current media is ready and downloaded.

During polling, stale scheduled or failure text may remain visible after the current media is ready. The agent should probe for an open media view or ready media tile and exit as soon as the top toolbar Download control is available, instead of waiting for the full timeout.

The Flow project name can be edited from the top-left header title/date-time input after opening the project.

Run this after install or edits:

```bash
node scripts/takomi-flow.mjs selftest
```

Discover supported agent options:

```bash
node scripts/takomi-flow.mjs capabilities
node scripts/takomi-flow.mjs examples
```

Observe the current Flow UI without spending credits:

```bash
node scripts/takomi-flow.mjs observe
node scripts/takomi-flow.mjs observe --browser-channel chrome
```

If Google login shows "This browser or app may not be secure", rerun browser commands with
`trusted-chrome`. Playwright-launched Chrome can still expose automation flags such as
`--no-sandbox`; `trusted-chrome` starts Chrome directly with a remote debugging port and a dedicated
TakomiFlow profile. After manual login, pass `--cdp-url http://127.0.0.1:9222` so TakomiFlow attaches
to the trusted browser session instead of automating credential entry.

Verified signed-in observation currently sees a Flow dashboard with project cards, `PRO` account
state, and a `New project` button. Treat this as the preferred selector discovery starting point.
The project editor currently exposes a prompt textbox with text `What do you want to create?`, plus
`Agent`, `Agent Instructions`, `Settings`, file input, and `Create` buttons. Prompt filling has been
verified without pressing Create.
Live video durations are `4`, `6`, `8`, and `10` seconds. If the agent asks for an unsupported
duration, Flow may ask a follow-up. A verified generation also asked for explicit approval before
spending 7 credits for one video. After output creation, opening the generated media reveals a
top toolbar download icon. Aim for the button with tooltip, title, aria label, or visible text
`Download`; clicking it saves the MP4.

Use templates when starting a request from scratch:

```bash
node scripts/takomi-flow.mjs template --kind video
node scripts/takomi-flow.mjs template --kind image
```

Validate before generation:

```bash
node scripts/takomi-flow.mjs validate --request <request.json>
```

One-call agent workflow:

```bash
node scripts/takomi-flow.mjs workflow --kind video --prompt "cinematic AI lab scene" --variations 2
```

`workflow` prepares and validates a request in one call. Add `--submit --allow-browser --allow-spend` only after explicit user approval; the normal spend guard still applies.

## Request JSON

Agents can read `takomi-flow://schemas/request` for the JSON Schema version of this shape.

```json
{
  "schemaVersion": 1,
  "kind": "video",
  "prompt": "cinematic AI lab scene with practical lighting",
  "variations": 2,
  "aspectRatio": "16:9",
  "durationSeconds": 8,
  "mode": "text-to-video",
  "modelHint": "best-available",
  "outputDir": "C:/Users/johno/.takomi-flow/runs",
  "allowSpend": false,
  "extractFrames": 4,
  "projectUrl": "https://labs.google/fx/tools/flow/project/example",
  "reuseCurrentProject": true,
  "allowNewProject": false,
  "freshChatOnFailure": true,
  "editorWaitMs": 90000,
  "notes": "Optional agent notes for traceability."
}
```

## Fields

Agents can discover the same fields from `capabilities.requestFields`.

- `kind`: `video` or `image`.
- `prompt`: Required non-empty generation prompt.
- `variations`: Positive integer. Defaults to `1`.
- `aspectRatio`: Optional UI hint such as `16:9`, `9:16`, or `1:1`.
- `durationSeconds`: Optional video duration hint.
- `mode`: Optional Flow mode hint such as `text-to-video`, `image-to-video`, or `text-to-image`.
- `modelHint`: Optional human-readable model or quality hint.
- `outputDir`: Optional base output directory.
- `allowSpend`: Must be `true` for generation submission.
- `extractFrames`: Optional number of review frames to extract from downloaded videos.
- `sourceAssets`: Optional array of local file paths for future image/video-to-video flows.
- `projectUrl`: Optional existing Flow project/editor URL to reuse.
- `reuseCurrentProject`: Prefer an already open Flow project tab when attached through CDP. Defaults to `true`.
- `allowNewProject`: Permit clicking `New project` when no reusable project/editor exists. Defaults to `false`.
- `freshChatOnFailure`: Try one fresh chat inside the same project when prompt or submit controls are broken. Defaults to `true`.
- `editorWaitMs`: Optional wait budget for Flow editor readiness.

## Validation JSON

`validate` normalizes request values, checks them against `capabilities`, verifies source asset paths, and reports spend-guard state:

```json
{
  "schemaVersion": 1,
  "status": "ok",
  "normalized": {},
  "errors": [],
  "warnings": []
}
```

## Result JSON

Agents can read `takomi-flow://schemas/result` for the JSON Schema version of run metadata.

```json
{
  "schemaVersion": 1,
  "status": "manual_action_required",
  "runId": "20260701-120000-flow",
  "kind": "video",
  "prompt": "cinematic AI lab scene with practical lighting",
  "projectUrl": "https://labs.google/fx/tools/flow/project/example",
  "projectSession": {
    "projectUrl": "https://labs.google/fx/tools/flow/project/example",
    "recovered": false
  },
  "settingsPlan": {
    "requested": {
      "mode": "text-to-video",
      "variations": 2,
      "aspectRatio": "16:9",
      "durationSeconds": 8
    },
    "automatic": ["prompt", "download folder", "metadata", "asset catalog"],
    "selectorDependent": [
      { "field": "aspectRatio", "value": "16:9" }
    ]
  },
  "assets": [],
  "assetCatalogPath": "C:/Users/johno/.takomi-flow/runs/20260701-120000-flow/assets.json",
  "screenshots": [],
  "errors": [],
  "manualActions": [
    "Complete Google login or Flow consent in the opened browser."
  ],
  "metadataPath": "C:/Users/johno/.takomi-flow/runs/20260701-120000-flow/run.json"
}
```

`projectUrl` records the exact Flow project/editor URL used for the run so agents do not lose track of generated projects. `settingsPlan` preserves the user's requested Flow options in run metadata. Prompt entry, downloads, metadata, asset cataloging, and frame extraction are automated. Mode, aspect ratio, duration, model controls, source assets, and multi-variation UI selection are selector-dependent until `observe` captures the live Flow controls.

## Status Values

- `prepared`: Request file created; no browser action happened.
- `ok`: Command completed and artifacts were written.
- `downloaded`: One or more assets were downloaded.
- `manual_action_required`: User action is required in the browser.
- `blocked`: Flow showed quota, safety, captcha, account, or unsupported UI state.
- `failed`: Script error or unrecoverable automation failure.

## Safety Invariants

- Never store Google credentials.
- Never submit generation unless request `allowSpend` is true or `TAKOMI_FLOW_ALLOW_SPEND=true`.
- Never bypass Google account, captcha, safety, or quota controls.
- Always write a result file, even on failure.
- Always save downloads into the run directory unless the request explicitly overrides it.

## Asset Catalog

Run:

```bash
node scripts/takomi-flow.mjs assets --run <run.json|run-dir> --frames 4
```

The command writes `assets.json` next to `run.json`. Video assets are probed with `ffprobe` when available, and review frames are extracted with `ffmpeg` when `--frames` is greater than zero.

## Run Review

Run:

```bash
node scripts/takomi-flow.mjs review --run <run.json|run-dir> --frames 4
```

`review` is the preferred post-generation agent command. It inspects the run, catalogs downloaded assets, extracts review frames, writes a Markdown report, and returns next actions.

## Collection

Run:

```bash
node scripts/takomi-flow.mjs collect --run <run.json|run-dir> --target-dir <path> --frames 4 --include-frames
```

`collect` reviews a run, copies assets/report/optional frames into a downstream target folder, and writes `takomi-flow-collection.json` as a manifest.

Agents can read `takomi-flow://schemas/collection` for the JSON Schema version of the collection manifest.

## Markdown Reports

Run:

```bash
node scripts/takomi-flow.mjs report --run <run.json|run-dir>
node scripts/takomi-flow.mjs report --output-dir <runs-dir> --limit 10
```

The command writes `report.md` next to a single run, or `takomi-flow-report.md` in a runs directory. Reports include status, metadata paths, screenshots, assets, errors, manual actions, and catalog details when `assets.json` exists.

## Diagnostics JSON

`doctor` returns:

```json
{
  "schemaVersion": 1,
  "status": "ok",
  "flowUrl": "https://labs.google/fx/tools/flow",
  "profileDir": "C:/Users/johno/.takomi-flow/browser-profile",
  "outputDir": "C:/Users/johno/.takomi-flow/runs",
  "checks": [],
  "recommendations": []
}
```

## Capabilities JSON

`capabilities` returns supported kinds, modes, variation limits, aspect ratios, output artifact names, safety invariants, and available commands. Agents should prefer this over hard-coded assumptions.

## Observation JSON

`observe` writes a normal `run.json` and includes a `controls` object:

```json
{
  "controls": {
    "buttons": [],
    "inputs": [],
    "links": []
  }
}
```

Use it to tune Flow selectors after Google changes the UI.

## Self-Test JSON

`selftest` runs a deterministic no-spend verification pass:

- doctor diagnostics
- readiness audit
- capability loading
- example loading
- video/image template loading
- request preparation
- one-call workflow preparation/validation
- settings-plan metadata for requested Flow options
- request validation
- spend-guard expectation
- synthetic MP4 cataloging and frame extraction
- Markdown report generation
- one-call run review
- downstream asset collection

It writes artifacts under `<outputDir>/selftest`.
