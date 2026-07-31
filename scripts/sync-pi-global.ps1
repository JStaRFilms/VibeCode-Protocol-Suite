[CmdletBinding()]
param(
    [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
else {
    $RepoRoot = (Resolve-Path $RepoRoot).Path
}

$repoPiRoot = Join-Path $RepoRoot '.pi'
$globalPiRoot = Join-Path $HOME '.pi'
$globalAgentRoot = Join-Path $globalPiRoot 'agent'
$globalAgentAgents = Join-Path $globalAgentRoot 'agents'
$globalAgentExtensions = Join-Path $globalAgentRoot 'extensions'
$globalAgentPrompts = Join-Path $globalAgentRoot 'prompts'
$globalAgentThemes = Join-Path $globalAgentRoot 'themes'
$globalSrcRoot = Join-Path $globalPiRoot 'src'

function Ensure-Directory {
    param([Parameter(Mandatory)] [string]$Path)

    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Remove-ManagedPath {
    param([Parameter(Mandatory)] [string]$Path)

    if (Test-Path $Path) {
        Remove-Item -Path $Path -Recurse -Force
    }
}

function New-ManagedJunction {
    param(
        [Parameter(Mandatory)] [string]$Destination,
        [Parameter(Mandatory)] [string]$Source,
        [Parameter(Mandatory)] [string]$Label
    )

    if (-not (Test-Path $Source)) {
        Write-Warning "Skipping $Label because the source path does not exist: $Source"
        return
    }

    Remove-ManagedPath $Destination
    New-Item -ItemType Junction -Path $Destination -Target $Source | Out-Null
    Write-Host "Linked $Label -> $Source"
}

function Sync-ManagedFile {
    param(
        [Parameter(Mandatory)] [string]$Destination,
        [Parameter(Mandatory)] [string]$Source,
        [Parameter(Mandatory)] [string]$Label
    )

    if (-not (Test-Path $Source)) {
        Write-Warning "Skipping $Label because the source file does not exist: $Source"
        return
    }

    Remove-ManagedPath $Destination

    try {
        New-Item -ItemType SymbolicLink -Path $Destination -Target $Source | Out-Null
        Write-Host "Linked $Label -> $Source"
    }
    catch {
        Copy-Item -Path $Source -Destination $Destination -Force
        Write-Host "Copied $Label -> $Source"
    }
}

foreach ($path in @(
    $globalPiRoot,
    $globalAgentRoot,
    $globalAgentAgents,
    $globalAgentExtensions,
    $globalAgentPrompts,
    $globalAgentThemes,
    $globalSrcRoot
)) {
    Ensure-Directory $path
}

$directoryLinks = @(
    @{
        Label = 'takomi-agents'
        Destination = $globalAgentAgents
        Source = Join-Path $repoPiRoot 'agents'
    },
    @{
        Label = 'takomi-runtime'
        Destination = Join-Path $globalAgentExtensions 'takomi-runtime'
        Source = Join-Path $repoPiRoot 'extensions\takomi-runtime'
    },
    @{
        Label = 'takomi-subagents'
        Destination = Join-Path $globalAgentExtensions 'takomi-subagents'
        Source = Join-Path $repoPiRoot 'extensions\takomi-subagents'
    },
    @{
        Label = 'notify-sound'
        Destination = Join-Path $globalAgentExtensions 'notify-sound'
        Source = Join-Path $repoPiRoot 'extensions\notify-sound'
    },
    @{
        Label = 'oauth-router'
        Destination = Join-Path $globalAgentExtensions 'oauth-router'
        Source = Join-Path $repoPiRoot 'extensions\oauth-router'
    },
    @{
        Label = 'antigravity-provider'
        Destination = Join-Path $globalAgentExtensions 'antigravity-provider'
        Source = Join-Path $repoPiRoot 'extensions\antigravity-provider'
    },
    @{
        Label = 'takomi-prompts'
        Destination = Join-Path $globalAgentPrompts 'takomi-prompts'
        Source = Join-Path $repoPiRoot 'prompts'
    },
    @{
        Label = 'pi-takomi-core'
        Destination = Join-Path $globalSrcRoot 'pi-takomi-core'
        Source = Join-Path $RepoRoot 'src\pi-takomi-core'
    }
)

foreach ($link in $directoryLinks) {
    New-ManagedJunction -Destination $link.Destination -Source $link.Source -Label $link.Label
}

Sync-ManagedFile -Destination (Join-Path $globalAgentThemes 'takomi-noir.json') -Source (Join-Path $repoPiRoot 'themes\takomi-noir.json') -Label 'takomi-noir theme'

Write-Host ''
Write-Host 'Pi global sync complete.'
Write-Host "Managed root: $globalPiRoot"
