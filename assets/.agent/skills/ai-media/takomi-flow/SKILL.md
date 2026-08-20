---
name: takomi-flow
description: "Use when Codex needs to operate Google Flow as a reusable agent tool through safe browser automation: bootstrap/login a persistent Flow profile, smoke-check access without spending credits, prepare image or video generation request files, run guarded Flow generations, download assets, inspect results, or integrate Flow assets into a video pipeline. Trigger for TakomiFlow, Flow browser provider, use Google Flow credits, Flow automation, generate with Flow, or agent-first Flow workflows."
---

# TakomiFlow

TakomiFlow is an agent-first workflow for using Google Flow through visible browser automation. Treat it as a local tool layer for Codex agents, not as an unofficial API.

## Runtime Choice

Use this skill as the single TakomiFlow entrypoint.

1. If the active harness is Codex and the user approves plugin installation or repair, install or reuse the global Codex plugin and then prefer its MCP tools.
2. If the plugin already exists, verify it with `doctor` and use MCP tools when the session exposes them.
3. If MCP is unavailable, use the TakomiFlow CLI directly.
4. If the harness is not Codex or does not support plugins, keep using this skill as the workflow guide and call the CLI when shell access exists.
5. If there is no shell access, provide the exact commands as a handoff checklist and stop.

Never install, update, or write to global plugin locations without telling the user what path will be changed and getting approval.

## Install Or Repair The Plugin

Only follow this path when the user asks to install/repair TakomiFlow or agrees after you detect that the Codex plugin is missing.

1. Check for an existing user plugin:

   ```powershell
   Test-Path "$HOME\plugins\takomi-flow"
   Test-Path "$HOME\.agents\plugins\marketplace.json"
   ```

2. If the plugin exists, inspect it:

   ```powershell
   node "$HOME\plugins\takomi-flow\scripts\takomi-flow.mjs" doctor
   ```

   If this works, do not reinstall unless the user asked to update or repair.

3. If missing, locate or get the VibeCode Protocol Suite:

   ```powershell
   git clone https://github.com/JStaRFilms/VibeCode-Protocol-Suite "$HOME\Source\VibeCode-Protocol-Suite"
   ```

4. Install the plugin globally for the current user:

   ```powershell
   cd "$HOME\Source\VibeCode-Protocol-Suite"
   .\scripts\install-takomi-flow.ps1 -InstallDependencies
   ```

   This copies/registers the plugin at:

   ```text
   ~/plugins/takomi-flow
   ~/.agents/plugins/marketplace.json
   ```

5. Verify:

   ```powershell
   node "$HOME\plugins\takomi-flow\scripts\takomi-flow.mjs" doctor
   ```

If Git is unavailable, ask the user to download the VibeCode Protocol Suite ZIP and run the installer from the extracted repo. MCP is optional; the CLI works without MCP.

## Agent Tool Surface

Prefer MCP tools when they are available in the active Codex session. Use the CLI commands as the stable fallback.
MCP tools:

- `takomi_flow_capabilities`
- `takomi_flow_doctor`
- `takomi_flow_audit`
- `takomi_flow_examples`
- `takomi_flow_template`
- `takomi_flow_prepare`
- `takomi_flow_workflow`
- `takomi_flow_validate`
- `takomi_flow_observe`
- `takomi_flow_generate`
- `takomi_flow_selftest`
- `takomi_flow_inspect`
- `takomi_flow_latest`
- `takomi_flow_runs`
- `takomi_flow_assets`
- `takomi_flow_review`
- `takomi_flow_collect`
- `takomi_flow_report`

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

Browser-opening MCP tools require `allowBrowser=true`. Generation still requires request `allowSpend=true` or `TAKOMI_FLOW_ALLOW_SPEND=true` before it can submit.

## Core Rules

- Use public Flow UI automation only.
- Do not bypass captchas, login challenges, quotas, safety checks, rate limits, or hidden endpoints.
- Prefer headed mode first so the user can handle Google login, consent, quota, and safety prompts.
- Browser commands should start from trusted Chrome/CDP by default; use Playwright-launched browsers only as an explicit fallback.
- Never submit a paid generation unless the user explicitly requested it and `allowSpend` or `TAKOMI_FLOW_ALLOW_SPEND=true` is set.
- Reuse the current Flow project or pass `projectUrl`; create new projects only when the user asks or `allowNewProject` is set.
- Treat Flow as one active generation at a time: wait for the current approved generation to finish and download it before submitting another paid generation.
- A gray preview placeholder with scheduled, queue, or ready-shortly copy means the generation is in progress, not failed.
- If stale scheduled or failure text remains after media is ready, probe/open the generated media and use the top toolbar Download control instead of waiting for the full timeout.
- Download generated media by opening the media and clicking the top toolbar `Download` icon/button.
- Keep credentials out of prompts, logs, metadata, and project files.
- Store run artifacts in a predictable folder and report the exact result paths.

## Commands

From the plugin root:

```bash
node scripts/takomi-flow.mjs bootstrap
node scripts/takomi-flow.mjs bootstrap --browser-channel chrome
node scripts/takomi-flow.mjs trusted-chrome
node scripts/takomi-flow.mjs doctor
node scripts/takomi-flow.mjs audit
node scripts/takomi-flow.mjs selftest
node scripts/takomi-flow.mjs capabilities
node scripts/takomi-flow.mjs examples
node scripts/takomi-flow.mjs observe
node scripts/takomi-flow.mjs smoke
node scripts/takomi-flow.mjs template --kind video
node scripts/takomi-flow.mjs prepare --kind video --prompt "cinematic AI lab scene" --variations 2
node scripts/takomi-flow.mjs workflow --kind video --prompt "cinematic AI lab scene" --variations 2
node scripts/takomi-flow.mjs workflow --kind video --prompt "cinematic AI lab scene" --project-url "<Flow project URL>" --reuse-current-project
node scripts/takomi-flow.mjs validate --request output/takomi-flow/requests/<file>.json
node scripts/takomi-flow.mjs generate --request output/takomi-flow/requests/<file>.json
node scripts/takomi-flow.mjs inspect --run output/takomi-flow/<runId>/run.json
node scripts/takomi-flow.mjs latest --output-dir output/takomi-flow
node scripts/takomi-flow.mjs runs --output-dir output/takomi-flow --limit 10
node scripts/takomi-flow.mjs assets --run output/takomi-flow/<runId>/run.json --frames 4
node scripts/takomi-flow.mjs review --run output/takomi-flow/<runId>/run.json --frames 4
node scripts/takomi-flow.mjs collect --run output/takomi-flow/<runId>/run.json --target-dir output/pipeline-assets --frames 4 --include-frames
node scripts/takomi-flow.mjs report --run output/takomi-flow/<runId>/run.json
node scripts/takomi-flow.mjs report --output-dir output/takomi-flow --limit 10
```

Important defaults:

- Profile dir: `%USERPROFILE%\.takomi-flow\browser-profile`
- Output dir: `%USERPROFILE%\.takomi-flow\runs`
- Browser channel: real Chrome by default on Windows/macOS when available
- Headed mode: enabled by default
- Spend guard: disabled by default

## Workflow

1. First-run/runtime detection:
   - Run `doctor` first when the installation state is unknown.
   - Check whether `http://127.0.0.1:9222/json/version` is already reachable.
   - If the CDP endpoint is reachable, reuse it with `--cdp-url http://127.0.0.1:9222`.
   - If the CDP endpoint is not reachable, launch `trusted-chrome`.
   - If MCP tools are unavailable, use CLI commands from this plugin root.
   - If the harness has no MCP support, TakomiFlow still works through shell commands.
2. Bootstrap login:
   - Prefer `trusted-chrome` for Google login because Google may reject Playwright-launched browsers.
   - Log into Google Flow manually in the opened trusted Chrome window.
   - Keep that Chrome window open and use `--cdp-url http://127.0.0.1:9222` for observe/generate.
   - A signed-in dashboard should show project cards and a `New project` button during `observe`.
   - The project editor prompt textbox currently contains `What do you want to create?`.
   - Leave Chrome on the desired project editor or pass `--project-url`; TakomiFlow does not click `New project` unless `--allow-new-project` is set.
   - Rename a project by editing the top-left header title/date-time input.
   - If the chat breaks, keep the same project and let `freshChatOnFailure` try one fresh chat before manual recovery.
   - Prefer video durations `4`, `6`, `8`, or `10` seconds to avoid a Flow follow-up question.
   - Use `bootstrap` only when Google accepts the launched browser.
   - Ask the user to log into Google Flow manually in the opened browser.
   - Do not automate credential entry.
3. Doctor check:
   - Run `doctor` before browser work when reliability matters.
   - Report missing Playwright, FFmpeg, profile, or output path issues.
4. Readiness audit:
   - Run `audit` when an agent needs safe next actions and gated actions in one payload.
   - Treat missing profile as a login/bootstrap gate, not a script failure.
5. Self-test:
   - Run `selftest` after install, after edits, or before trusting TakomiFlow in a new project.
   - Confirm no-spend request preparation, validation, spend guard behavior, and media extraction work.
6. Capability discovery:
   - Run `capabilities` when an agent needs supported kinds, modes, request fields, variations, aspect ratios, outputs, and safety rules.
   - Run `examples` or read `takomi-flow://examples` when an agent needs known-good request patterns.
7. Observe Flow UI:
   - Run `observe` after bootstrap to capture current Flow controls, text inputs, buttons, screenshots, and manual-action state without submitting generation.
   - Use observation output before changing selectors.
8. Smoke check:
   - Run `smoke` to open Flow and save status metadata/screenshots.
   - Confirm no generation was submitted.
9. Prepare request:
   - Use `template --kind video` or `template --kind image` when an agent needs a known-good request skeleton.
   - Use `takomi-flow://schemas/request` when an agent needs a machine-readable request shape.
   - Use `takomi-flow://schemas/result` and `takomi-flow://schemas/collection` to consume run metadata and collected outputs.
   - Use `prepare` to create a JSON request for image or video generation.
   - Use `workflow` when an agent should prepare, validate, and optionally submit from one call.
   - Include prompt, variations, aspect ratio, duration, model/mode hints, and output folder.
   - Read `settingsPlan` to see which requested Flow options are automatic versus selector-dependent.
10. Validate request:
   - Run `validate --request <file>` before `generate`.
   - Fix failed source assets, invalid kinds, or malformed request JSON before opening Flow.
   - Treat spend-guard warnings as expected unless the user explicitly approved spending credits.
11. Generate:
   - Run `generate` only when spend is explicitly allowed.
   - Expect Flow to ask for credit approval; approve only when `allowSpend=true` or the user explicitly approved spending.
   - Stop for manual intervention if the UI asks for login, captcha, quota, safety, or consent.
   - Preserve `settingsPlan` in the run metadata so downstream agents can see requested options.
12. Inspect:
   - Read `run.json`, `status.json`, screenshots, and downloaded assets.
   - Record and report `projectUrl` for every created Flow project so future runs can reuse or inspect it.
   - Prefer `runs`, `inspect`, or `latest` for agent-readable summaries.
   - Use `assets --frames 4` to catalog downloaded images/videos and extract review frames.
   - Use `review --frames 4` to combine inspect, asset cataloging, frame extraction, and Markdown report creation.
   - Use `collect` to copy reviewed outputs into a downstream project folder with a manifest.
   - Use `report` to write a Markdown handoff for a single run or recent history.
   - Report successes, errors, and manual next steps.

## Request Shape

Read `references/flow-provider-contract.md` before modifying scripts or integrating TakomiFlow into another project.

## Integration Guidance

- For a project pipeline, call TakomiFlow as an external provider and pass prompt/settings by JSON file.
- Keep Flow-specific selectors isolated in `scripts/lib/flow-ui.mjs`.
- Keep generation follow-up polling, credit approval, and completion/failure detection in `scripts/lib/flow-outcome.mjs`.
- Keep request/result parsing stable so other agents can use it without reading script internals.
- If a file approaches 200 lines, split it before adding more responsibilities.
