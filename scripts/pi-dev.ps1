$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$extensionsRoot = Join-Path $RepoRoot '.pi\extensions'
$promptsRoot = Join-Path $RepoRoot '.pi\prompts'
$theme = Join-Path $RepoRoot '.pi\themes\takomi-noir.json'
$runtime = Join-Path $extensionsRoot 'takomi-runtime\index.ts'
$subagents = Join-Path $extensionsRoot 'takomi-subagents\index.ts'
$oauthRouter = Join-Path $extensionsRoot 'oauth-router\index.ts'
$contextManager = Join-Path $extensionsRoot 'takomi-context-manager\index.ts'
$notifySound = Join-Path $extensionsRoot 'notify-sound\index.ts'
$antigravityProvider = Join-Path $extensionsRoot 'antigravity-provider\index.ts'

foreach ($required in @($runtime, $subagents, $oauthRouter, $contextManager, $notifySound, $antigravityProvider, $promptsRoot, $theme)) {
    if (-not (Test-Path $required)) {
        throw "Missing required local Pi asset: $required"
    }
}

Push-Location $RepoRoot
try {
    & pi `
        --no-extensions `
        --extension $oauthRouter `
        --extension $runtime `
        --extension $subagents `
        --extension $contextManager `
        --extension $notifySound `
        --extension $antigravityProvider `
        --no-prompt-templates `
        --prompt-template $promptsRoot `
        --no-themes `
        --theme $theme `
        @args
}
finally {
    Pop-Location
}
