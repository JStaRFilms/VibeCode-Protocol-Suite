param(
    [switch]$DryRun = $false,
    [switch]$Update = $false,          # Update existing issues instead of skipping
    [switch]$SyncDates = $false,        # Sync dates to GitHub Project
    [switch]$AutoArchive = $false,      # Move completed issues to closed/ subfolder
    [switch]$Force = $false,            # Force sync all files (ignore change detection)

    # Required for SyncDates (auto-detected from repo if not provided)
    [string]$ProjectOwner = "",
    [int]$ProjectNumber = 0,
    [string]$ProjectId = "",
    [string]$StartDateFieldId = "",
    [string]$TargetDateFieldId = "",
    [int]$TargetWeeks = 4,
    
    [string]$IssueDir = "docs/issues"
)

<#
.SYNOPSIS
    Smart Issue Sync - Syncs markdown issue specs to GitHub with intelligent change detection.

.DESCRIPTION
    Features:
      - SMART SYNC: Only processes files that changed since last run (uses .issue-sync-state.json)
      - AUTO-ARCHIVE: Moves completed .md files to closed/ subfolder  
      - AUTO-CLOSE: Closes GitHub issues when all checkboxes are ticked
      - NATURAL SORT: Processes Issue_1, Issue_2, ... Issue_10 (not 1, 10, 11)
      - DATE SYNC: Sets Start/Target dates on GitHub Projects

.EXAMPLE
    # Smart sync (only changed files)
    .\publish_issues.ps1 -Update -AutoArchive

    # Force full resync
    .\publish_issues.ps1 -Update -AutoArchive -Force

    # Dry run
    .\publish_issues.ps1 -Update -AutoArchive -DryRun
#>

# ============ AUTO-DETECT REPO INFO ============
$repoJson = gh repo view --json owner,name 2>$null | ConvertFrom-Json
if (-not $repoJson) {
    Write-Host "ERROR: Not in a GitHub repository or gh CLI not authenticated" -ForegroundColor Red
    exit 1
}
$REPO_OWNER = $repoJson.owner.login
$REPO_NAME = $repoJson.name
$REPO = "$REPO_OWNER/$REPO_NAME"

Write-Host "Repository: $REPO" -ForegroundColor Cyan

# ============ STATE FILE FOR CHANGE DETECTION ============
$stateFile = Join-Path $IssueDir ".issue-sync-state.json"
$syncState = @{}

if (Test-Path $stateFile) {
    try {
        $syncState = Get-Content $stateFile -Raw | ConvertFrom-Json -AsHashtable
    } catch {
        $syncState = @{}
    }
}

function Save-SyncState {
    if (-not $DryRun) {
        $syncState | ConvertTo-Json -Depth 10 | Set-Content $stateFile -Encoding UTF8
    }
}

function Get-FileHash256 {
    param([string]$Path)
    $hash = Get-FileHash -Path $Path -Algorithm SHA256
    return $hash.Hash
}

function Test-FileChanged {
    param([string]$FilePath)
    
    if ($Force) { return $true }
    
    $fileName = Split-Path $FilePath -Leaf
    $currentHash = Get-FileHash256 -Path $FilePath
    
    if ($syncState.ContainsKey($fileName)) {
        $lastHash = $syncState[$fileName].hash
        return $currentHash -ne $lastHash
    }
    
    return $true  # New file, never synced
}

function Update-FileState {
    param(
        [string]$FilePath,
        [string]$Status,  # "synced", "archived"
        [int]$IssueNumber = 0
    )
    
    $fileName = Split-Path $FilePath -Leaf
    $syncState[$fileName] = @{
        hash = (Get-FileHash256 -Path $FilePath)
        lastSync = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
        status = $Status
        issueNumber = $IssueNumber
    }
}

# ============ VALIDATE SYNC DATES CONFIG ============
if ($SyncDates) {
    if (-not $ProjectOwner) { $ProjectOwner = $REPO_OWNER }
    
    $missingConfig = @()
    if ($ProjectNumber -eq 0) { $missingConfig += "-ProjectNumber" }
    if (-not $ProjectId) { $missingConfig += "-ProjectId" }
    if (-not $StartDateFieldId) { $missingConfig += "-StartDateFieldId" }
    if (-not $TargetDateFieldId) { $missingConfig += "-TargetDateFieldId" }
    
    if ($missingConfig.Count -gt 0) {
        Write-Host "ERROR: -SyncDates requires: $($missingConfig -join ', ')" -ForegroundColor Red
        exit 1
    }
}

# ============ FIND ISSUE FILES (Natural Sort) ============
$closedDir = Join-Path $IssueDir "closed"

# Get files and sort naturally (Issue_1, Issue_2, ... Issue_10)
$issueFiles = Get-ChildItem "$IssueDir/*.md" -ErrorAction SilentlyContinue | 
    Where-Object { $_.Name -ne "ALL_ISSUES.md" } |
    Sort-Object { 
        if ($_.Name -match 'Issue_(\d+)') { 
            [int]$matches[1] 
        } else { 
            $_.Name 
        }
    }

if ($issueFiles.Count -eq 0) {
    Write-Host "No issue files found in $IssueDir/" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($issueFiles.Count) issue files" -ForegroundColor Gray

# ============ FILTER TO CHANGED FILES ONLY ============
$changedFiles = @()
$skippedFiles = @()

foreach ($file in $issueFiles) {
    if (Test-FileChanged -FilePath $file.FullName) {
        $changedFiles += $file
    } else {
        $skippedFiles += $file
    }
}

if ($skippedFiles.Count -gt 0 -and -not $Force) {
    Write-Host "Skipping $($skippedFiles.Count) unchanged files" -ForegroundColor DarkGray
}

if ($changedFiles.Count -eq 0) {
    Write-Host "No files have changed since last sync. Use -Force to resync all." -ForegroundColor Yellow
    exit 0
}

Write-Host "Processing $($changedFiles.Count) changed files..." -ForegroundColor Cyan
Write-Host ""

# ============ CACHE EXISTING ISSUES ============
Write-Host "Fetching existing GitHub issues..." -ForegroundColor Gray
$existingIssues = gh issue list --repo $REPO --state all --limit 500 --json number,title,state | ConvertFrom-Json
$issueTitleMap = @{}
$issueStateMap = @{}
foreach ($issue in $existingIssues) {
    $issueTitleMap[$issue.title] = $issue.number
    $issueStateMap[$issue.title] = $issue.state
}
Write-Host "Found $($existingIssues.Count) existing issues on GitHub" -ForegroundColor Gray
Write-Host ""

# ============ HELPER FUNCTIONS ============

function Ensure-Label {
    param($LabelName)
    if (-not $DryRun) {
        $ErrorActionPreference = "SilentlyContinue"
        gh label create "$LabelName" --repo $REPO --color "0e8a16" 2>$null
        $ErrorActionPreference = "Continue"
    }
}

function Add-ToProject {
    param([int]$IssueNumber)
    
    if (-not $SyncDates -or $DryRun) { return }

    try {
        $url = "https://github.com/$REPO/issues/$IssueNumber"
        gh project item-add $ProjectNumber --owner $ProjectOwner --url $url 2>$null
    } catch { }
}

function Sync-ProjectDates {
    param([int]$IssueNumber, [string]$StartDate, [string]$TargetDate)
    
    if (-not $SyncDates) { return }
    
    Add-ToProject -IssueNumber $IssueNumber
    
    $itemsJson = gh project item-list $ProjectNumber --owner $ProjectOwner --format json 2>$null
    if (-not $itemsJson) { return }
    
    $items = $itemsJson | ConvertFrom-Json
    $item = $items.items | Where-Object { $_.content.number -eq $IssueNumber } | Select-Object -First 1
    
    if (-not $item) { return }
    
    if (-not $DryRun) {
        gh project item-edit --id $item.id --project-id $ProjectId --field-id $StartDateFieldId --date $StartDate 2>$null
        gh project item-edit --id $item.id --project-id $ProjectId --field-id $TargetDateFieldId --date $TargetDate 2>$null
        Write-Host "    Dates: $StartDate -> $TargetDate" -ForegroundColor Blue
    }
}

function Parse-IssueMetadata {
    param($Content)
    
    $result = @{ title = $null; labels = @() }
    
    # Try YAML frontmatter
    if ($Content -match '^---\s*[\r\n]+([\s\S]*?)[\r\n]+---') {
        $yaml = $matches[1]
        if ($yaml -match 'title:\s*["\u0027]?([^"\u0027\r\n]+)["\u0027]?') {
            $result.title = $matches[1].Trim()
        }
        if ($yaml -match 'labels:\s*([^\r\n]+)') {
            $result.labels = ($matches[1].Trim() -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
        }
    }
    
    # Try Bold markdown
    if (-not $result.title -and $Content -match '\*\*Title:\*\*\s*(.+)') {
        $result.title = $matches[1].Trim()
    }
    if ($result.labels.Count -eq 0 -and $Content -match '\*\*Labels:\*\*\s*(.+)') {
        $result.labels = ($matches[1] -replace '`', '' -replace '\s', '' -split ',') | Where-Object { $_ }
    }
    
    # Try Markdown headers
    if (-not $result.title -and $Content -match '## Title\s*[\r\n]+(.+)') {
        $result.title = $matches[1].Trim()
    }
    if ($result.labels.Count -eq 0 -and $Content -match '## Labels\s*[\r\n]+(.+)') {
        $result.labels = ($matches[1] -replace '`', '' -replace '\s', '' -split ',') | Where-Object { $_ }
    }
    
    return $result
}

function Get-CheckboxStatus {
    param($Content)
    
    $unchecked = [regex]::Matches($Content, '[-*]\s*\[\s*\]').Count
    $checked = [regex]::Matches($Content, '[-*]\s*\[[xX]\]').Count
    
    return @{
        Total = $unchecked + $checked
        Checked = $checked
        AllComplete = (($unchecked + $checked) -gt 0 -and $unchecked -eq 0)
    }
}

function Move-ToClosedFolder {
    param([string]$FilePath)
    
    if (-not $AutoArchive) { return }
    
    if (-not (Test-Path $closedDir)) {
        if (-not $DryRun) {
            New-Item -ItemType Directory -Path $closedDir -Force | Out-Null
        }
    }
    
    $fileName = Split-Path $FilePath -Leaf
    $destPath = Join-Path $closedDir $fileName
    
    if (-not $DryRun) {
        Move-Item -Path $FilePath -Destination $destPath -Force
        # Remove from state since it's archived
        $syncState.Remove($fileName)
        Write-Host "    Archived to closed/$fileName" -ForegroundColor DarkMagenta
    } else {
        Write-Host "    [DryRun] Would archive to closed/$fileName" -ForegroundColor Gray
    }
}

function Get-CleanIssueBody {
    param($Content)
    
    $clean = $Content -replace '(?ms)^---\s*[\r\n]+.*?[\r\n]+---\s*[\r\n]*', ''
    $clean = $clean -replace '(?ms)^## Title.*?(?=##|\Z)', ''
    $clean = $clean -replace '(?ms)^## Labels.*?(?=##|\Z)', ''
    $clean = $clean -replace '(?ms)^# GitHub Issue:.*?(?=##|\Z)', ''
    return $clean.Trim()
}

# ============ MAIN LOOP ============

$processedCount = 0
$archivedCount = 0

foreach ($file in $changedFiles) {
    $content = Get-Content $file.FullName -Raw
    $parsed = Parse-IssueMetadata -Content $content
    
    if (-not $parsed.title) {
        Write-Warning "Could not find title for $($file.Name) - skipping"
        continue
    }

    $title = $parsed.title
    # Sanitize title: replace double quotes with single quotes to avoid CLI issues
    $title = $title -replace '"', "'"
    $labelArray = $parsed.labels
    $checkboxStatus = Get-CheckboxStatus -Content $content
    $isComplete = $checkboxStatus.AllComplete
    
    # Calculate dates
    $fileInfo = Get-Item $file.FullName
    $startDate = $fileInfo.CreationTime.ToString("yyyy-MM-dd")
    $targetDate = if ($isComplete) {
        $fileInfo.LastWriteTime.ToString("yyyy-MM-dd")
    } else {
        $fileInfo.CreationTime.AddDays($TargetWeeks * 7).ToString("yyyy-MM-dd")
    }
    
    Write-Host "Processing: $($file.Name)" -ForegroundColor Cyan
    Write-Host "  Title: $title"
    if ($checkboxStatus.Total -gt 0) {
        $color = if ($isComplete) { "Green" } else { "Yellow" }
        Write-Host "  Checkboxes: $($checkboxStatus.Checked)/$($checkboxStatus.Total)" -ForegroundColor $color
    }

    $cleanBody = Get-CleanIssueBody -Content $content
    $tempBodyFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tempBodyFile -Value $cleanBody -Encoding UTF8

    try {
        $existingNumber = $issueTitleMap[$title]
        $currentState = $issueStateMap[$title]
        
        if ($existingNumber) {
            if ($Update) {
                Write-Host "  Existing: #$existingNumber ($currentState) - UPDATING" -ForegroundColor Yellow
                
                foreach ($l in $labelArray) {
                    if (![string]::IsNullOrWhiteSpace($l)) { Ensure-Label -LabelName $l }
                }
                
                if (-not $DryRun) {
                    $ghArgs = @("issue", "edit", "$existingNumber", "--repo", "$REPO", "--title", "$title", "--body-file", "$tempBodyFile")
                    foreach ($l in $labelArray) {
                        if (![string]::IsNullOrWhiteSpace($l)) {
                            $ghArgs += "--add-label"; $ghArgs += "$l"
                        }
                    }
                    & gh $ghArgs
                    
                    # Close if complete and currently open
                    if ($isComplete -and $currentState -eq "OPEN") {
                        gh issue close $existingNumber --repo $REPO --comment "✅ All acceptance criteria completed"
                        Write-Host "  Closed #$existingNumber" -ForegroundColor Magenta
                    }
                    
                    Write-Host "  Updated #$existingNumber" -ForegroundColor Green
                    Sync-ProjectDates -IssueNumber $existingNumber -StartDate $startDate -TargetDate $targetDate
                    Update-FileState -FilePath $file.FullName -Status "synced" -IssueNumber $existingNumber
                    $processedCount++
                    
                    # Archive if complete (whether just closed or already closed)
                    if ($isComplete) {
                        Move-ToClosedFolder -FilePath $file.FullName
                        $archivedCount++
                    }
                } else {
                    Write-Host "  [DryRun] Would update #$existingNumber" -ForegroundColor Gray
                    if ($isComplete) {
                        if ($currentState -eq "OPEN") {
                            Write-Host "  [DryRun] Would CLOSE" -ForegroundColor Magenta
                        }
                        Write-Host "  [DryRun] Would ARCHIVE" -ForegroundColor DarkMagenta
                    }
                }
            } else {
                Write-Host "  Existing: #$existingNumber - SKIPPING (use -Update)" -ForegroundColor DarkGray
            }
        } else {
            Write-Host "  New issue - CREATING" -ForegroundColor Green
            
            foreach ($l in $labelArray) {
                if (![string]::IsNullOrWhiteSpace($l)) { Ensure-Label -LabelName $l }
            }

            if (-not $DryRun) {
                $ghArgs = @("issue", "create", "--repo", "$REPO", "--title", "$title", "--body-file", "$tempBodyFile")
                foreach ($l in $labelArray) {
                    if (![string]::IsNullOrWhiteSpace($l)) {
                        $ghArgs += "--label"; $ghArgs += "$l"
                    }
                }
                $issueUrl = & gh $ghArgs
                
                if ($issueUrl -match '/issues/(\d+)$') {
                    $newNum = [int]$matches[1]
                    Write-Host "  Created #$newNum" -ForegroundColor Green
                    Sync-ProjectDates -IssueNumber $newNum -StartDate $startDate -TargetDate $targetDate
                    Update-FileState -FilePath $file.FullName -Status "synced" -IssueNumber $newNum
                    $processedCount++
                }
            } else {
                Write-Host "  [DryRun] Would create issue" -ForegroundColor Gray
            }
        }
    } finally {
        if (Test-Path $tempBodyFile) { Remove-Item $tempBodyFile -Force }
    }
    Write-Host "-------------------"
}

# Save state file
Save-SyncState

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "  Processed: $processedCount issues"
if ($archivedCount -gt 0) {
    Write-Host "  Archived: $archivedCount completed issues" -ForegroundColor Magenta
}
if ($skippedFiles.Count -gt 0 -and -not $Force) {
    Write-Host "  Skipped: $($skippedFiles.Count) unchanged files" -ForegroundColor DarkGray
}
