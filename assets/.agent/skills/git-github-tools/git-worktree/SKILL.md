---
name: git-worktree
description: Manage git worktrees for parallel agent development. Create, sync, and remove isolated dev environments.
---

# Git Worktree Skill

Manage parallel development environments without manual path juggling.

## When to Use
- Setting up parallel agents
- Multi-agent development
- When "worktree" is mentioned
- Need isolated environments for different features

## Status Check
```bash
git worktree list
git branch --list
```

## Actions

### [NEW] Create Agent Environment

1. **Name the Agent**: Short identifier (e.g., `frontend-refactor`, `agent-3`)
2. **Define Paths**:
   - Branch: `[agent-name]`
   - Folder: `../[repo-name]-[agent-name]`

3. **Execute**:
```bash
git branch [branch_name]
git worktree add [folder_path] [branch_name]
```

4. **Validate**: `git worktree list`

5. **Context Migration** (ask user):
```bash
cp .env [worktree_path]/.env
# If SQLite:
mkdir -p [worktree_path]/prisma
cp prisma/dev.db [worktree_path]/prisma/dev.db
```

6. **Initialize**: `pnpm install` in new worktree

---

### [SYNC] Synchronize Agents

1. Ask: Sync **ALL** or **SPECIFIC** worktree?
2. Execute:
```bash
git fetch origin
cd [worktree_path]
git merge origin/main  # or rebase
cd -
```

---

### [KILL] Teardown Agent

1. Select worktree from list
2. Execute:
```bash
git worktree remove [worktree_path]
git branch -d [branch_name]  # Ask before deleting!
git worktree prune
```

## Troubleshooting

- **"already checked out"**: Use a new branch name
- **Stale entries**: Run `git worktree prune`
- **Files still tracked**: Directory was deleted manually—prune first
