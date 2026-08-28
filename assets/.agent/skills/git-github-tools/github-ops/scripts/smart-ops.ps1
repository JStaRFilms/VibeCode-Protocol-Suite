# Smart Ops - GitHub Automation Script (PowerShell)
# Copy to: scripts/smart-ops.ps1
# Replace {{PLACEHOLDERS}} with actual values

$ErrorActionPreference = "Stop"

# ============ CONFIGURATION ============
$REPO_OWNER = "{{OWNER}}"
$REPO_NAME = "{{REPO}}"
$REPO = "$REPO_OWNER/$REPO_NAME"

# GitHub Projects (optional - leave empty if not using)
$PROJECT_NUMBER = "{{PROJECT_NUMBER}}"
$PROJECT_ID = "{{PROJECT_ID}}"
$STATUS_FIELD_ID = "{{STATUS_FIELD_ID}}"
$TODO_OPTION_ID = "{{TODO_OPTION_ID}}"
$IN_PROGRESS_OPTION_ID = "{{IN_PROGRESS_OPTION_ID}}"
$DONE_OPTION_ID = "{{DONE_OPTION_ID}}"
$START_DATE_FIELD_ID = "{{START_DATE_FIELD_ID}}"
$TARGET_DATE_FIELD_ID = "{{TARGET_DATE_FIELD_ID}}"

$DEBUG = $env:DEBUG -eq "1"

# ============ HELPERS ============

function Test-Prerequisites {
    $errors = 0
    try { $null = Get-Command gh -ErrorAction Stop } catch {
        Write-Host "X GitHub CLI not installed" -ForegroundColor Red
        $errors++
    }
    try { $null = gh auth status 2>&1; if ($LASTEXITCODE -ne 0) { throw } } catch {
        Write-Host "X Not authenticated. Run: gh auth login" -ForegroundColor Red
        $errors++
    }
    if ($errors -gt 0) { exit 1 }
}

function Get-Today { return (Get-Date -Format "yyyy-MM-dd") }
function Get-FutureDate { param([int]$Days = 7); return (Get-Date).AddDays($Days).ToString("yyyy-MM-dd") }

# ============ COMMANDS ============

function Start-Scan {
    Write-Host "Scanning open issues..." -ForegroundColor Cyan
    gh issue list --repo $REPO --state open --json number,title,labels --limit 20
}

function Complete-Scan {
    Write-Host "Issues ready for completion..." -ForegroundColor Cyan
    gh issue list --repo $REPO --state open --json number,title --limit 20
    Write-Host "`nToday: $(Get-Today)"
    Write-Host 'Close with: .\smart-ops.ps1 close [number]' -ForegroundColor Gray
}

function New-Issue {
    param([string]$Title, [string]$Body = "", [string]$Labels = "enhancement", [int]$Days = 7)
    if ([string]::IsNullOrWhiteSpace($Title)) { Write-Host "X Title required" -ForegroundColor Red; return }
    
    Write-Host "Creating: $Title (${Days}d)" -ForegroundColor Cyan
    $url = gh issue create --repo $REPO --title $Title --body $Body --label $Labels
    
    if ($url -match '/(\d+)$') {
        Write-Host "Created #$($Matches[1])" -ForegroundColor Green
        Write-Host $url
    }
}

function Close-Issue {
    param([string]$Num, [string]$Comment = "Completed")
    if ([string]::IsNullOrWhiteSpace($Num)) { Write-Host "X Issue number required" -ForegroundColor Red; return }
    
    $confirm = Read-Host "Close #${Num}? (y/N)"
    if ($confirm -ne 'y') { return }
    
    gh issue close $Num --repo $REPO --comment $Comment
    Write-Host "Closed #$Num" -ForegroundColor Green
}

function Move-ToProgress {
    param([string]$Id)
    if ([string]::IsNullOrWhiteSpace($PROJECT_ID)) { Write-Host "X No project configured" -ForegroundColor Red; return }
    gh project item-edit --id $Id --field-id $STATUS_FIELD_ID --project-id $PROJECT_ID --single-select-option-id $IN_PROGRESS_OPTION_ID
    Write-Host "-> In Progress" -ForegroundColor Green
}

function Move-ToDone {
    param([string]$Id)
    if ([string]::IsNullOrWhiteSpace($PROJECT_ID)) { Write-Host "X No project configured" -ForegroundColor Red; return }
    gh project item-edit --id $Id --field-id $STATUS_FIELD_ID --project-id $PROJECT_ID --single-select-option-id $DONE_OPTION_ID
    Write-Host "-> Done" -ForegroundColor Green
}

function Show-Help {
    Write-Host @'
Smart Ops - GitHub Automation

Usage: .\smart-ops.ps1 [command] [args]

Commands:
  start                      List open issues
  complete                   List for completion
  create [title] [body] [labels] [days]
  close [number] [comment]
  progress [item_id]         Move to In Progress
  done [item_id]             Move to Done

Examples:
  .\smart-ops.ps1 create "Fix bug" "Description" "bug" 3
  .\smart-ops.ps1 close 42 "Fixed"
'@ -ForegroundColor Cyan
}

# ============ MAIN ============

Test-Prerequisites

$cmd = if ($args.Count -gt 0) { $args[0] } else { "help" }

switch ($cmd.ToLower()) {
    "start" { Start-Scan }
    "complete" { Complete-Scan }
    "create" { New-Issue -Title $args[1] -Body $args[2] -Labels $args[3] -Days ([int]$args[4]) }
    "close" { Close-Issue -Num $args[1] -Comment $args[2] }
    "progress" { Move-ToProgress -Id $args[1] }
    "done" { Move-ToDone -Id $args[1] }
    default { Show-Help }
}
