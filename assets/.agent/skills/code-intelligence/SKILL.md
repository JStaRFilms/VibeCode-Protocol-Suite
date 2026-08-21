---
name: code-intelligence
description: Use when understanding code, asking 'why' (decision archaeology/git history), 'how' (runtime execution trace), calculating 'blast-radius' before refactoring, debugging with 'diagnosing-bugs', explaining systems with 'teach', or logging runs with 'show-me-your-work'.
author: P-Stack / Matt Pocock
coauthored: J StaR Films / Takomi
version: 2.0.0
---

# Code Intelligence Suite

A consolidated suite for deep codebase comprehension, decision archaeology, impact analysis, and runtime diagnostics.

## Sub-Skills & Capabilities

Read the relevant sub-skill file via `view_file` on demand:

| Sub-Skill | Trigger Keywords | Path |
|---|---|---|
| **`why`** | Decision archaeology, design rationale, why code exists | [`why/SKILL.md`](why/SKILL.md) |
| **`how`** | Runtime execution trace, data flow, component ownership | [`how/SKILL.md`](how/SKILL.md) |
| **`blast-radius`** | Dependency graph impact, ripple effects before refactoring | [`blast-radius/SKILL.md`](blast-radius/SKILL.md) |
| **`diagnosing-bugs`** | Symptom capture, repro scripts, root-cause isolation | [`diagnosing-bugs/SKILL.md`](diagnosing-bugs/SKILL.md) |
| **`teach`** | Plain-language system walkthroughs & persistent learning workspaces | [`teach/SKILL.md`](teach/SKILL.md) |
| **`show-me-your-work`** | TSV decision log for multi-step or unattended runs | [`show-me-your-work/SKILL.md`](show-me-your-work/SKILL.md) |

---

## Operating Protocol

1. When asked **why** something was built a certain way, consult [`why/SKILL.md`](why/SKILL.md) to inspect git history, commit messages, PRs, and ADRs before answering.
2. Before making wide refactors, invoke [`blast-radius/SKILL.md`](blast-radius/SKILL.md) to trace downstream dependants.
3. When tracking down elusive bugs, follow [`diagnosing-bugs/SKILL.md`](diagnosing-bugs/SKILL.md) to build an isolated reproduction script before editing application code.
