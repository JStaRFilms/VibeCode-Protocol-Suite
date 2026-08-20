---
name: github-ops
description: GitHub automation patterns - issues, projects, labels. Includes smart-ops scripts and bulk issue sync.
---

# GitHub Ops Skill

Complete GitHub automation toolkit using the `gh` CLI. Covers issue management, project boards, label systems, and bulk operations.

## When to Use
- User mentions "GitHub issues", "project board", or "gh cli"
- Setting up automation for a new repo
- Bulk-creating issues from markdown specs
- Managing GitHub Projects (v2)

## Prerequisites

```bash
# Install GitHub CLI
winget install GitHub.cli   # Windows
brew install gh             # macOS

# Authenticate
gh auth login

# Verify
gh auth status
```

---

## 1. Bulk Issue Sync (publish_issues.ps1)

**Location:** `$env:USERPROFILE\.gemini\antigravity\skills\github-ops\scripts\publish_issues.ps1`

> [!TIP]
> The script auto-detects the repository from the current working directory. Just `cd` to your project folder before running.

### Features
| Feature | Description |
|---------|-------------|
| **Smart Sync** | Only processes files that changed since last run (uses `.issue-sync-state.json`) |
| **Auto-Close** | Closes issue when all checkboxes (`- [x]`) are ticked |
| **Auto-Archive** | Moves completed `.md` files to `closed/` subfolder |
| **Natural Sort** | Processes Issue_1, Issue_2... Issue_10 (not 1, 10, 11) |
| **Date Sync** | Sets Start/Target dates on GitHub Projects |

### Required Flags

| Flag | Required? | Description |
|------|-----------|-------------|
| (none) | - | Creates new issues only (skips existing) |
| `-Update` | For sync | Updates existing issues |
| `-AutoArchive` | Optional | Moves completed issues to `closed/` folder |
| `-DryRun` | Optional | Preview mode - no changes made |
| `-Force` | Optional | Bypass change detection, sync all files |

### Project Date Sync Flags (ALL required with -SyncDates)

| Flag | Description | How to Get |
|------|-------------|------------|
| `-SyncDates` | Enable date sync | Just add the flag |
| `-ProjectNumber` | Project board number | `gh project list --owner USERNAME` |
| `-ProjectId` | Project node ID | See below |
| `-StartDateFieldId` | Start Date field ID | See below |
| `-TargetDateFieldId` | Target Date field ID | See below |

### How to Get Project IDs

```powershell
# 1. List projects to get project number
gh project list --owner USERNAME

# 2. Get field IDs (replace NUMBER with project number)
gh project field-list NUMBER --owner USERNAME --format json
```

Look for "Start Date" and "Target Date" in the JSON output. If they don't exist:
```bash
gh project field-create NUMBER --owner USERNAME --name "Start Date" --data-type DATE
gh project field-create NUMBER --owner USERNAME --name "Target Date" --data-type DATE
```

### Agent Protocol: Before Running This Script

**ALWAYS ask the user:**

1. "Do you want to sync to a GitHub Project with dates?" 
   - If YES → Need all project IDs
   - If NO → Skip `-SyncDates` flag

2. "Should completed issues be archived to a `closed/` subfolder?"
   - If YES → Add `-AutoArchive`

3. "First run or update existing?"
   - First run → No flags needed (or just `-AutoArchive`)
   - Update → Add `-Update`

**ALWAYS run with `-DryRun` first** to preview changes.

### Example Commands

```powershell
# Basic: Create new issues only
powershell -ExecutionPolicy Bypass -File .agent/skills/github-ops/scripts/publish_issues.ps1

# Dry run preview
powershell -ExecutionPolicy Bypass -File .agent/skills/github-ops/scripts/publish_issues.ps1 -Update -DryRun

# Update + archive completed
powershell -ExecutionPolicy Bypass -File .agent/skills/github-ops/scripts/publish_issues.ps1 -Update -AutoArchive

# Full sync with project dates
powershell -ExecutionPolicy Bypass -File .agent/skills/github-ops/scripts/publish_issues.ps1 `
    -Update -AutoArchive -SyncDates `
    -ProjectNumber 7 `
    -ProjectId "PVT_xxx" `
    -StartDateFieldId "PVTF_xxx" `
    -TargetDateFieldId "PVTF_yyy"
```

---

## 2. Bulk Add Issues to Project

To quickly add all existing issues to a project (faster than using the sync script):

```powershell
# Get issue numbers first
$issues = gh issue list --repo OWNER/REPO --state all --limit 500 --json number | ConvertFrom-Json

# Add each to project
$issues | ForEach-Object { 
    gh project item-add PROJECT_NUMBER --owner OWNER --url "https://github.com/OWNER/REPO/issues/$($_.number)"
}
```

---

## 3. Quick Commands Reference

| Task | Command |
|------|---------|
| List issues | `gh issue list` |
| Create issue | `gh issue create --title "X" --body "Y" --label "bug"` |
| Close issue | `gh issue close 42 --comment "Fixed"` |
| Delete issue | `gh issue delete 42 --yes` |
| List labels | `gh label list` |
| Create label | `gh label create "priority:high" --color "FF0000"` |
| List projects | `gh project list --owner OWNER` |
| Get project fields | `gh project field-list NUMBER --owner OWNER --format json` |
| Add to project | `gh project item-add NUMBER --owner OWNER --url ISSUE_URL` |

---

## 4. Supported Issue Markdown Formats

### Format A: YAML Frontmatter (Recommended)
```markdown
---
title: "[Feature] Clear Issue Title"
labels: enhancement, priority-high, module-name
---

## Acceptance Criteria
- [ ] AC1
- [ ] AC2
```

### Format B: Bold Markdown
```markdown
**Title:** [Feature] Clear Issue Title
**Labels:** `enhancement`, `priority-high`

## Acceptance Criteria
- [ ] AC1
```

### Format C: Markdown Headers
```markdown
## Title
[Feature] Clear Issue Title

## Labels
`enhancement`, `priority-high`
```

---

## 5. Label System Setup

```bash
# Priority
gh label create "priority-critical" --color "b60205"
gh label create "priority-high" --color "d93f0b"
gh label create "priority-medium" --color "fbca04"
gh label create "priority-low" --color "0e8a16"

# Type
gh label create "type-feature" --color "0e8a16"
gh label create "type-bug" --color "d73a4a"
gh label create "type-refactor" --color "a2eeef"

# Scope
gh label create "MUS" --color "5319e7" --description "Minimum Usable Scope"
gh label create "future-scope" --color "bfdadc"
```

---

## 6. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `gh: command not found` | CLI not installed | `winget install GitHub.cli` |
| `authentication required` | Not logged in | `gh auth login` |
| Quote errors in titles | Special chars | Script auto-replaces `"` with `'` |
| "No files changed" | Already synced | Use `-Force` flag |
| Project commands fail | Wrong IDs | Run `gh project field-list` |
| Rate limiting | Too many API calls | Wait or use `-DryRun` |
