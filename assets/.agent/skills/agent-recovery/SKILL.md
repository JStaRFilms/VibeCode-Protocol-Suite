---
name: agent-recovery
description: Use when an agent is stuck in loops, repeating errors, losing context, or needs session migration, state reset, or subagent escalation.
author: J StaR Films
version: 2.0.0
---

# Agent Recovery Skill

Protocols for when the agent is stuck, context is degraded, or session needs migration.

## When to Use
- Agent is making repeated mistakes
- Long conversation causing hallucinations
- Need to hand off to fresh agent
- Context window is full

---

## Option 1: Escalate (Handoff Report)

**Use when**: Agent is stuck and can't solve the problem.

### Steps

1. **Undo broken changes**:
```bash
git status
git checkout -- .
```

2. **Generate `docs/escalation_report.md`**:

```markdown
# Escalation Handoff Report

**Generated:** [Date/Time]
**Original Issue:** [GitHub Issue # or description]

## PART 1: THE DAMAGE REPORT

### 1.1 Original Goal
[The task you were asked to complete]

### 1.2 Observed Failure
[EXACT error message]

### 1.3 Failed Approach
[Strategy you attempted]

### 1.4 Key Files Involved
- `path/to/file1.ts`

### 1.5 Best-Guess Diagnosis
[Why approach failed]

## PART 2: FULL FILE CONTENTS
[EMBED entire content of each file]

## PART 3: DIRECTIVE FOR ORCHESTRATOR
1. Analyze the failure
2. Formulate a new plan
3. Execute or hand off
```

3. **Open new session** and paste the report content.

---

## Option 2: Migrate (Context Snapshot)

**Use when**: Chat is stale, need fresh session with same context.

### Auto-Detect Context
```bash
cat docs/Project_Requirements.md 2>/dev/null
git log --oneline -20
gh issue list --state open --limit 10 --json number,title
cat docs/Coding_Guidelines.md 2>/dev/null
```

### Generate `docs/migration_snapshot.md`:

```markdown
# State Snapshot Handoff Prompt

## To the New AI: Adopt This Identity
You are the **VibeCode Project Orchestrator**...

## Project Details
- **Name:** [from PRD]
- **Stack:** [from PRD]

## Milestones
[From git log]

## Current Status
- In Progress: [from GitHub]
- Next: [from roadmap]

## Key Files
- `docs/Project_Requirements.md`
- `docs/Coding_Guidelines.md`

## First Action
Read files above, then ask: "What would you like to work on next?"
```

---

## Option 3: Reset (Mid-Conversation)

**Use when**: Agent is making mistakes but can recover.

### 🛑 HARD STOP CHECKLIST

```
□ Did I READ the target file with view_file BEFORE editing?
□ Did I copy the EXACT target content, including whitespace?
□ Am I editing LESS than 50 lines at a time?
□ Did I verify all variable names exist in scope?
□ Did I check props are destructured in function signature?
```

### Common Mistakes
| Pattern | Fix |
|---------|-----|
| Duplicate lines | Read file first, count declarations |
| Missing destructuring | Check props signature |
| Broken JSX | Close tags in same edit |
| Phantom variables | grep in file before using |
| Edit offset drift | Re-read file after each edit |

### File Edit Protocol
1. `view_file_outline` → Understand structure
2. `view_file` (exact range) → Copy PRECISE content
3. Make edit with MINIMAL scope
4. Re-check file before next edit

### Verified Completion
Before saying "done":
```bash
npx tsc --noEmit  # MUST pass
```
- No duplicate declarations?
- No missing imports?
- Task actually solved?

**If errors persist after 3 fix attempts → use Escalate.**
