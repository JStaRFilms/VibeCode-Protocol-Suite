# TakomiFlow Public Distribution

TakomiFlow is packaged in this repo, but users need one distribution path before it can appear in their Codex Store.

## NPM Package Strategy

Do not create a second npm package by default.

TakomiFlow should ship inside the existing `takomi` / VibeCode Protocol Suite package:

- `plugins/takomi-flow` contains the Codex plugin.
- `assets/.agent/skills/takomi-flow` contains the standalone non-plugin skill for harnesses that read bundled skills, plus the install/repair instructions for Codex plugin use.
- `scripts/install-takomi-flow.ps1` installs/registers the bundled plugin into the user's global Codex plugin location.

A separate `takomi-flow` npm package would only be useful later if TakomiFlow needs independent versioning, releases, or dependencies. For now, keeping it inside the existing suite avoids duplicated publishing, duplicated docs, and version drift.

## Best Path

Publish or distribute the VibeCode Protocol Suite, then let users install the TakomiFlow plugin from the suite bundle.

Once they have the suite from GitHub or the published `takomi` package:

```powershell
git clone https://github.com/JStaRFilms/VibeCode-Protocol-Suite "$HOME\Source\VibeCode-Protocol-Suite"
cd "$HOME\Source\VibeCode-Protocol-Suite"
.\scripts\install-takomi-flow.ps1 -InstallDependencies
```

That installs:

```text
~/plugins/takomi-flow
~/.agents/plugins/marketplace.json
```

Then Codex can show TakomiFlow in the personal/store plugin list.

## Skill-Only Bootstrap

If a user only has skills and no plugin yet, give them the bundled `takomi-flow` skill. That one skill teaches Codex or another harness how to:

1. Check whether TakomiFlow is already installed.
2. Clone or locate the VibeCode Protocol Suite.
3. Run `scripts/install-takomi-flow.ps1`.
4. Install dependencies.
5. Verify the plugin with `doctor`.
6. Reuse or launch trusted Chrome.

This is the lightest path when the full plugin is not installed yet, while avoiding a confusing second TakomiFlow installer skill.

## MCP Is Optional

TakomiFlow should be useful in three tiers:

- Full Codex plugin and MCP tools when the harness supports them.
- CLI-only operation when MCP is unavailable.
- Skill-only install instructions when the plugin is missing.

The CLI entrypoint remains:

```powershell
node "$HOME\plugins\takomi-flow\scripts\takomi-flow.mjs" <command>
```

## Store Search Terms

Users should be able to find it by searching:

- `TakomiFlow`
- `Takomi Flow`
- `Google Flow`
- `Flow automation`
- `image generation`
- `video generation`
- `asset pipeline`
- `Takomi`

## Publishing Checklist

Before telling users it is public:

1. Push this repo to GitHub.
2. Confirm `plugins/takomi-flow` is included.
3. Confirm `assets/.agent/skills/takomi-flow` is included.
4. Confirm `npm pack --dry-run` includes TakomiFlow files but not `plugins/takomi-flow/node_modules`.
5. Publish/update the existing `takomi` npm package or release archive.
6. Test on a clean user profile:

   ```powershell
   .\scripts\install-takomi-flow.ps1 -InstallDependencies
   node "$HOME\plugins\takomi-flow\scripts\takomi-flow.mjs" doctor
   ```

7. Open Codex Store and search `TakomiFlow`.
