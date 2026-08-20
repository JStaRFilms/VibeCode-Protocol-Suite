---
name: spawn-task
description: Create comprehensive, self-contained task prompts for implementing features or fixing bugs.
---

# Spawn Task Skill

Create detailed task prompts that another agent (or future self) can execute without additional context.

## When to Use
- Breaking down complex features
- Creating implementation specs
- When user says "spawn a task for..."
- Planning multi-phase work

## Task Discovery

Gather from user:
- **Task Description**: What needs to be done?
- **Priority**: High / Medium / Low
- **Scope**: What's included/excluded?
- **Timeline**: Expected completion (optional)

## Current State Analysis

```bash
# Check related files
find src -name "*relevant*" -type f

# Check documentation
ls docs/features/

# Check GitHub issues
gh issue list --search "[related term]"
```

## Task Prompt Template

Create `docs/tasks/[TaskName].md`:

```markdown
# 🎯 Task: [Task Name]

**Objective:** [Clear, measurable goal]
**Priority:** [High/Medium/Low]
**Scope:** [What's included/excluded]

---

## 📋 Requirements

### Functional Requirements
- **[REQ-001]** [Requirement with acceptance criteria]

### Technical Requirements
- **[TECH-001]** [Technical specification]

---

## 🏗️ Implementation Plan

### Phase 1: Setup
- [ ] [Setup task]

### Phase 2: Core Implementation
- [ ] [Core task]

### Phase 3: Enhancement
- [ ] [Enhancement task]

### Phase 4: Testing & Documentation
- [ ] [Testing task]

---

## 📁 Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/features/[Feature]/...` | Create | [Purpose] |

---

## ✅ Success Criteria

### Code Quality
- [ ] TypeScript compliant (no `any`)
- [ ] Passes ESLint
- [ ] Unit tests with >80% coverage

### Performance
- [ ] Bundle size increase < 5KB
- [ ] Load time < 1.5s

### Functionality
- [ ] All requirements implemented
- [ ] Mobile responsive

---

## 🔗 Dependencies

**Depends on:** [Other components]
**Used by:** [Components that use this]

---

## 🚀 Getting Started

1. Read this task prompt completely
2. Review related files
3. Begin with Phase 1
4. Provide progress updates after each phase
```

## Options After Spawning
- **A)** Start implementing now
- **B)** Create GitHub Issue to track
- **C)** Save task for later

## Task Categories
- 🆕 **Feature**: New functionality
- 🐛 **Bug Fix**: Fixing broken behavior
- ♻️ **Refactor**: Improving existing code
- 📚 **Documentation**: Writing docs

## Priority Guidelines
- **High**: Blocking other work, user-facing bugs
- **Medium**: Important features, non-blocking issues
- **Low**: Nice-to-haves, minor improvements
