param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$UserHome = $HOME,
  [switch]$InstallDependencies,
  [switch]$NoCopy
)

$ErrorActionPreference = 'Stop'

function Write-Step($Message) {
  Write-Host "[takomi-flow] $Message"
}

function Copy-Plugin($Source, $Destination) {
  if ($NoCopy) {
    Write-Step "Skipping copy because -NoCopy was set."
    return
  }
  if (Test-Path -LiteralPath $Destination) {
    Remove-Item -LiteralPath $Destination -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Recurse
  $nodeModules = Join-Path $Destination 'node_modules'
  if (Test-Path -LiteralPath $nodeModules) {
    Remove-Item -LiteralPath $nodeModules -Recurse -Force
  }
}

function Ensure-Marketplace($MarketplacePath) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $MarketplacePath) | Out-Null
  if (Test-Path -LiteralPath $MarketplacePath) {
    $payload = Get-Content -LiteralPath $MarketplacePath -Raw | ConvertFrom-Json
  } else {
    $payload = [ordered]@{
      name = 'jstarfilmsstudios'
      interface = @{ displayName = 'J StaR Films Studios' }
      plugins = @()
    }
  }
  $entry = [ordered]@{
    name = 'takomi-flow'
    source = @{ source = 'local'; path = './plugins/takomi-flow' }
    policy = @{ installation = 'AVAILABLE'; authentication = 'ON_INSTALL' }
    category = 'Productivity'
  }
  $plugins = @($payload.plugins | Where-Object { $_.name -ne 'takomi-flow' })
  $payload.plugins = @($plugins + $entry)
  $payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $MarketplacePath -Encoding UTF8
}

function Install-NodeDeps($PluginPath) {
  if (-not $InstallDependencies) {
    Write-Step "Skipping dependency install. Run with -InstallDependencies when needed."
    return
  }
  Push-Location $PluginPath
  try {
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
      pnpm install
    } else {
      npm install
    }
  } finally {
    Pop-Location
  }
}

$sourcePlugin = Join-Path $RepoRoot 'plugins/takomi-flow'
$targetPlugin = Join-Path $UserHome 'plugins/takomi-flow'
$marketplace = Join-Path $UserHome '.agents/plugins/marketplace.json'

if (-not (Test-Path -LiteralPath $sourcePlugin)) {
  throw "TakomiFlow source plugin was not found: $sourcePlugin"
}

Write-Step "Source: $sourcePlugin"
Write-Step "Target: $targetPlugin"
Copy-Plugin $sourcePlugin $targetPlugin
Ensure-Marketplace $marketplace
Install-NodeDeps $targetPlugin

Write-Step "Registered marketplace: $marketplace"
Write-Step "First run: node $targetPlugin/scripts/takomi-flow.mjs doctor"
Write-Step "Trusted Chrome: node $targetPlugin/scripts/takomi-flow.mjs trusted-chrome"
