---
name: git-commit-generation
description: Use when generating clear, conventional git commit messages based on staged changes or recent repository diffs.
author: Kilo Code
coauthored: J StaR Films / Takomi
version: 2.0.0
---

# Git Commit Generation

Generate clear, conventional git commit messages based on staged changes or recent repository diffs.

---

## 1. Workflow

1. **Inspect Staged Diffs**:
   ```bash
   git status
   git diff --staged
   ```
   If no changes are staged, inspect unstaged changes with `git diff` and suggest staging relevant files first.

2. **Analyze Scope & Purpose**:
   - Determine the primary type of change (e.g. `feat`, `fix`, `refactor`, `docs`, `test`, `chore`).
   - Identify the affected scope or module (e.g. `cli`, `harness`, `skills`, `auth`).
   - Isolate independent changes: if staged files span multiple distinct concerns, suggest splitting into separate commits.

3. **Format Conventional Commit Message**:
   Structure the message using the standard Conventional Commits format:

   ```
   <type>(<scope>): <imperative summary in present tense>

   - Bulleted details explaining what changed and why
   - Key implementation decisions or removed legacy patterns
   ```

---

## 2. Commit Types

| Type | When to Use | Example |
| :--- | :--- | :--- |
| `feat` | New feature, capability, or user-facing addition | `feat(skills): add code-intelligence umbrella suite` |
| `fix` | Bug fix, error resolution, or regression patch | `fix(cli): resolve timeout flakiness on windows` |
| `refactor` | Code refactoring without changing behavior | `refactor(store): unify skill materialization logic` |
| `docs` | Documentation, guides, or specification updates | `docs(architecture): sync lean unified taxonomy` |
| `test` | Adding, updating, or fixing tests | `test(lifecycle): verify heartbeat animation frames` |
| `chore` | Maintenance, dependencies, or build config | `chore(deps): bump pi-subagents to 0.31.0` |

---

## 3. Best Practices

- **Imperative Mood**: Write the header as a command (e.g. `feat(cli): add category tree` instead of `added category tree`).
- **Explain the Why**: The body explains non-obvious reasoning and motivation, not merely a recap of file diffs.
- **Breaking Changes**: Highlight breaking changes clearly with `BREAKING CHANGE:` in the footer or an exclamation mark after the type/scope (e.g. `feat(api)!: update payload structure`).
