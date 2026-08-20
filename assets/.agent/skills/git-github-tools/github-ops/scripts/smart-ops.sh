#!/bin/bash
# Smart Ops - GitHub Automation Script (Bash)
# Copy to: scripts/smart-ops.sh
# Replace {{PLACEHOLDERS}} with actual values

set -e

# ============ CONFIGURATION ============
REPO_OWNER="{{OWNER}}"
REPO_NAME="{{REPO}}"
REPO="${REPO_OWNER}/${REPO_NAME}"

# GitHub Projects (optional - leave empty if not using)
PROJECT_NUMBER="{{PROJECT_NUMBER}}"
PROJECT_ID="{{PROJECT_ID}}"
STATUS_FIELD_ID="{{STATUS_FIELD_ID}}"
TODO_OPTION_ID="{{TODO_OPTION_ID}}"
IN_PROGRESS_OPTION_ID="{{IN_PROGRESS_OPTION_ID}}"
DONE_OPTION_ID="{{DONE_OPTION_ID}}"
START_DATE_FIELD_ID="{{START_DATE_FIELD_ID}}"
TARGET_DATE_FIELD_ID="{{TARGET_DATE_FIELD_ID}}"

DEBUG="${DEBUG:-0}"

# ============ HELPERS ============

check_prerequisites() {
    local errors=0
    command -v gh &> /dev/null || { echo "❌ GitHub CLI not installed"; errors=$((errors + 1)); }
    gh auth status &> /dev/null || { echo "❌ Not authenticated. Run: gh auth login"; errors=$((errors + 1)); }
    [ "$errors" -gt 0 ] && exit 1
}

get_today() { date +%Y-%m-%d; }
get_future_date() {
    local days="${1:-7}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        date -v+${days}d +%Y-%m-%d
    else
        date -d "+${days} days" +%Y-%m-%d
    fi
}

# ============ COMMANDS ============

start_scan() {
    echo "🔍 Scanning open issues..."
    gh issue list --repo "$REPO" --state open --json number,title,labels --limit 20
}

complete_scan() {
    echo "📋 Issues ready for completion..."
    gh issue list --repo "$REPO" --state open --json number,title --limit 20
    echo ""
    echo "Today: $(get_today)"
    echo "Close with: ./smart-ops.sh close <number>"
}

create_issue() {
    local title="$1"
    local body="$2"
    local labels="${3:-enhancement}"
    local days="${4:-7}"
    
    [ -z "$title" ] && { echo "❌ Title required"; return 1; }
    
    echo "📝 Creating: $title (${days}d)"
    gh issue create --repo "$REPO" --title "$title" --body "$body" --label "$labels"
}

close_issue() {
    local num="$1"
    local comment="${2:-Completed}"
    
    [ -z "$num" ] && { echo "❌ Issue number required"; return 1; }
    
    read -p "Close #$num? (y/N): " -n 1 -r; echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && return 0
    
    gh issue close "$num" --repo "$REPO" --comment "$comment"
    echo "✅ Closed #$num"
}

move_to_progress() {
    local id="$1"
    [ -z "$PROJECT_ID" ] && { echo "❌ No project configured"; return 1; }
    gh project item-edit --id "$id" --field-id "$STATUS_FIELD_ID" --project-id "$PROJECT_ID" --single-select-option-id "$IN_PROGRESS_OPTION_ID"
    echo "✅ → In Progress"
}

move_to_done() {
    local id="$1"
    [ -z "$PROJECT_ID" ] && { echo "❌ No project configured"; return 1; }
    gh project item-edit --id "$id" --field-id "$STATUS_FIELD_ID" --project-id "$PROJECT_ID" --single-select-option-id "$DONE_OPTION_ID"
    echo "✅ → Done"
}

show_help() {
    cat << 'EOF'
Smart Ops - GitHub Automation

Usage: ./smart-ops.sh <command> [args]

Commands:
  start                      List open issues
  complete                   List for completion
  create <title> [body] [labels] [days]
  close <number> [comment]
  progress <item_id>         Move to In Progress
  done <item_id>             Move to Done

Examples:
  ./smart-ops.sh create "Fix bug" "Description" "bug" 3
  ./smart-ops.sh close 42 "Fixed"
EOF
}

# ============ MAIN ============

check_prerequisites

case "${1:-help}" in
    start) start_scan ;;
    complete) complete_scan ;;
    create) create_issue "$2" "$3" "$4" "$5" ;;
    close) close_issue "$2" "$3" ;;
    progress) move_to_progress "$2" ;;
    done) move_to_done "$2" ;;
    *) show_help ;;
esac
