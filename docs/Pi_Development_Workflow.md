# Pi Development Workflow

When developing Takomi itself, do **not** run plain `pi` from the repository root if the global Takomi harness is installed.

Pi discovers extensions from both places:

- global: `~/.pi/agent/extensions`
- project-local: `<repo>/.pi/extensions`

Because this repository contains the same Takomi extensions that are installed globally, plain `pi` from the repo root can load both copies and produce tool conflicts such as:

```txt
Tool "takomi_workflow" conflicts
Tool "takomi_board" conflicts
Tool "takomi_subagent" conflicts
```

## Recommended workflow

### Normal user testing

Use the packaged global harness from any non-Takomi project directory:

```powershell
takomi install pi
cd C:\path\to\some\test-project
takomi
```

### Takomi extension development

From this repository, just run:

```powershell
takomi
```

The Takomi launcher recognizes its source checkout and starts Pi with one complete project-local set:

```txt
--no-extensions
--extension .pi/extensions/oauth-router/index.ts
--extension .pi/extensions/takomi-runtime/index.ts
--extension .pi/extensions/takomi-subagents/index.ts
--extension .pi/extensions/takomi-context-manager/index.ts
--extension .pi/extensions/notify-sound/index.ts
--extension .pi/extensions/antigravity-provider/index.ts
--no-prompt-templates
--prompt-template .pi/prompts
--no-themes
--theme .pi/themes/takomi-noir.json
```

This keeps every project Takomi extension available while preventing duplicate global/project registrations. Plain `pi` cannot express this conditional behavior through `.pi/settings.json`: project settings can control project resources, but cannot conditionally disable matching user-global extensions.

The PowerShell script remains an equivalent fallback for passing raw Pi arguments:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

You can pass normal Pi arguments after the script name:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1 --version
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1 -p "Say ok"
```

## About `scripts/sync-pi-global.ps1`

`scripts/sync-pi-global.ps1` is useful when you intentionally want the global harness to point at your working tree via junctions.

Use it only as a local development convenience. It is not the recommended default for package validation because `takomi install pi` is supposed to overwrite/sync the packaged distribution into `~/.pi/agent`.

If you run `takomi install pi`, expect it to replace those development links with packaged copies. Re-run `scripts/sync-pi-global.ps1` only when you want to return to linked local development mode.

## Do not edit `~/.pi` as the source of truth

Keep source changes in the repository:

- `.pi/extensions/**`
- `.pi/agents/**`
- `.pi/prompts/**`
- `.pi/themes/**`
- `src/pi-takomi-core/**`

Treat `~/.pi` as an installed output directory, not as the canonical source.
