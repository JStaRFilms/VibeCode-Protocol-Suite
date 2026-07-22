# TakomiFlow Onboarding

TakomiFlow is packaged in this repo at `plugins/takomi-flow`.

## First Run

If all you have is a skill, use the bundled `takomi-flow` skill. It is the single front door: it can operate an already-installed plugin through MCP or CLI, install or repair the Codex plugin after user approval, or stay in skill/CLI mode for harnesses that do not support Codex plugins.

1. Install or register the plugin:

   ```powershell
   ./scripts/install-takomi-flow.ps1 -InstallDependencies
   ```

2. Check the local runtime:

   ```powershell
   node plugins/takomi-flow/scripts/takomi-flow.mjs doctor
   ```

3. Check whether a trusted Chrome instance is already running:

   ```powershell
   Invoke-WebRequest http://127.0.0.1:9222/json/version -UseBasicParsing
   ```

4. If Chrome is already running on port `9222`, reuse it with:

   ```powershell
   --cdp-url http://127.0.0.1:9222
   ```

5. If Chrome is not running, launch it:

   ```powershell
   node plugins/takomi-flow/scripts/takomi-flow.mjs trusted-chrome
   ```

6. Sign into Google Flow manually in the opened browser.

7. Run a no-spend observe before generation:

   ```powershell
   node plugins/takomi-flow/scripts/takomi-flow.mjs observe --allow-browser --cdp-url http://127.0.0.1:9222
   ```

## Reusing One Flow Project

For repeated generations, leave trusted Chrome open on the Flow project editor and reuse it:

```powershell
node plugins/takomi-flow/scripts/takomi-flow.mjs workflow --kind video --prompt "cinematic lab scene" --project-url "https://labs.google/fx/tools/flow/project/..." --submit --allow-browser --allow-spend --cdp-url http://127.0.0.1:9222
```

TakomiFlow does not click `New project` unless `--allow-new-project` is set. If a chat surface is stale or broken, it tries one fresh chat inside the same project before asking for manual help.

## MCP Or CLI

- If the harness supports MCP, use TakomiFlow MCP tools.
- If MCP is unavailable, use the CLI commands directly.
- If a harness has neither MCP nor shell access, use the skill instructions as a handoff checklist for a human/operator.

Generation is always spend-gated. Use `--allow-spend` only after explicit approval.

## Finding It In Codex

After this repo is installed or registered, Codex should show:

- `Takomi Codex` under the `J StaR Films Studios` marketplace section.
- `TakomiFlow` under the same marketplace section.

On the developer machine, a second `TakomiFlow` may also appear under `Personal` if `scripts/install-takomi-flow.ps1` copied the plugin into `~/plugins/takomi-flow` and registered `~/.agents/plugins/marketplace.json`. That personal entry is useful for local testing; the repo entry is the package source other people should install.

People can search for:

- `TakomiFlow`
- `Flow`
- `Google Flow`
- `image generation`
- `video generation`
- `asset pipeline`
- `Takomi`

If they only have the skill and not the plugin, search/install:

- `takomi-flow`
