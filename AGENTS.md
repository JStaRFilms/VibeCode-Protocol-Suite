# Takomi / VibeCode Protocol Suite Agent Guidelines

This repository provides Takomi CLI, Pi harness extensions, and a curated skills ecosystem (`assets/.agent/skills/`). Follow these rules when developing, adding, or modifying skills and workflows.

---

## 1. Skill Taxonomy & Architecture Rules

To prevent context saturation (prompt bloat) across AI agent harnesses, skills follow the **Lean Unified Skills Architecture** (`docs/features/Lean_Unified_Skills_Architecture.md`):

1. **Add to Existing Umbrella Suites**: If a new skill relates to an established domain (testing, Next.js, code intelligence, git operations, agent prompts, UI, office docs, media), add it as a sub-skill inside the relevant suite folder.
2. **Update Router Context Pointers**: When adding a sub-skill, update the parent suite's top-level `SKILL.md` frontmatter `description` to include keyword triggers for the new sub-skill. This enables natural keyword discovery without requiring the user to type the suite name.
3. **When to Create a New Suite**: Create a new umbrella suite only when a cluster of 3+ related sub-skills introduces a distinct engineering or creative domain not covered by the existing 12 suites.
4. **When to Keep a Skill Standalone**: Keep a skill standalone at the top level only if it is a single-purpose CLI binary wrapper (e.g., `audit-website`, `context7`, `jules`), a global communication mode (e.g., `wait-what`, `bro`, `poteto-mode`), or an isolated cross-domain utility.
5. **Core Essentials Policy**: Never unilaterally add or promote a skill to Core Essentials. The 8 Core Essentials (`takomi`, `grill-me`, `code-review`, `sync-docs`, `security-audit`, `agent-recovery`, `avoid-feature-creep`, `git-commit-generation`) are always active; promotions to Core are decided by the user.
6. **Check for Merges & Duplicates**: Before importing any new skill, search existing suites for overlaps. Present candidates to the user to merge, upgrade, or deprecate redundant skills.

---

## 2. Skill Frontmatter Standard

Every `SKILL.md` must start with YAML frontmatter specifying:
* `name`: Kebab-case identifier.
* `description`: Actionable trigger starting with `"Use when [user wants to do X]..."` (maximum two sentences).
* `author`: Original author.
* `coauthored`: `J StaR Films / Takomi` when modifying or adapting external work.
* `version`: Semantic version string.

```yaml
---
name: git-commit-generation
description: Use when generating clear, conventional git commit messages based on staged changes or recent repository diffs.
author: Kilo Code
coauthored: J StaR Films / Takomi
version: 2.0.0
---
```

---

## 3. Writing & Unslop Skill

* **Always Use Unslop Skill**: When writing any text, chat responses, documentation, UI copy, or skill instructions, always read and follow the `unslop` skill (`.agents/skills/unslop/SKILL.md`).
* **Relative Links**: Internal skill references to formats, scripts, or sibling docs must use correct local relative paths (`view_file` targets).
* **Positive Prompting**: Describe what the agent *should* do directly rather than listing negative prohibitions.