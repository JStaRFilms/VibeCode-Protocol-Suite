---
description: Run the VibeCode expert code review and verification pass on current changes.
---

# Code Review Workflow

Use this workflow to review uncommitted changes, staged changes, or branch diffs before committing or merging.

## Core Rule

Code review and security audit are structured passes:
1. **Review**: Identify bugs, logic issues, error handling gaps, and code quality.
2. **Audit**: Verify security, input validation, authentication boundaries, and secret leaks.

## 1. Identify Scope

### Staged changes
```bash
git diff --staged
```

### Working tree changes (uncommitted)
```bash
git diff
```

### Branch diff against main
```bash
git diff main..HEAD
```

## 2. Review Checklist

### Security
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] Proper authentication and permission checks
- [ ] Input validation on all external endpoints and forms
- [ ] No SQL/command injection or unsafe evaluations

### Logic & Correctness
- [ ] Edge cases and null/undefined conditions handled
- [ ] Correct async/await and promise resolution
- [ ] Error boundaries and try-catch blocks where failures can occur
- [ ] Direct control flow without unnecessary layers or dead code

### Performance & Cleanliness
- [ ] No unnecessary renders or unindexed database queries
- [ ] Clean type narrowing without unsafe casts
- [ ] Meaningful comments on non-obvious logic (no code restatements)

## 3. Reporting Findings

Format your review report with:
1. **Summary**: Brief assessment of the change set.
2. **Issues Table**: Categorized by severity (`CRITICAL`, `WARNING`, `SUGGESTION`) with `File:Line`.
3. **Actionable Suggestions**: Concrete code diffs showing the recommended fix.
4. **Verdict**: `APPROVE`, `APPROVE WITH SUGGESTIONS`, or `NEEDS CHANGES`.
