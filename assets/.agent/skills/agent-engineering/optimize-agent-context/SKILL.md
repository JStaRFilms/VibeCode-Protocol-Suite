---
name: optimize-agent-context
description: >
  Create, audit, or optimize agent.md, claude.md, cursorrules, or any AI coding agent context file
  using the "Band-Aid Philosophy." Strips bloat, enforces minimalism, and ensures only failure-correcting
  rules remain. Use when the user mentions: "agent.md", "claude.md", "cursorrules", ".clinerules",
  "AGENTS.md", "context file", "optimize context", "agent instructions", "reduce agent bloat",
  "agent keeps making mistakes", "fix my agent file", "create agent file", "audit agent context",
  or any variant of writing/improving AI coding agent instruction files.
---

# Optimize Agent Context

Enforce the **Band-Aid Philosophy**: an agent context file should only contain rules that fix mistakes the agent is actively making. Everything else is bloat that degrades performance and increases cost.

## Core Rules (Non-Negotiable)

1. **NO BLOAT** — Never include directory structures, file trees, dependency lists, or package inventories. The agent has tools to discover these.
2. **NO SUMMARIES** — Never include vague app descriptions ("This is a video sharing app"). This distracts the model and triggers hallucinations.
3. **ONLY FIX KNOWN FAILURES** — Every line must correct a specific, observed agent mistake or enforce an architectural constraint the agent cannot guess.
4. **USE NEGATIVE CONSTRAINTS** — When the agent uses the wrong tool/library, explicitly state what NOT to use, then what TO use.
5. **BE MINIMAL** — Target under 20 lines. Bullet points preferred. If a rule can be removed without the agent breaking, remove it.

## Why This Matters

Studies show bloated, AI-generated context files:
- **Degrade agent performance by ~3%**
- **Increase token costs by 20%+**
- Trigger hallucinations by surfacing legacy code the agent then tries to use ("pink elephants" effect)

## Workflow

### Mode A: Create New Agent File (Interview)

When the user wants to create a new context file from scratch:

1. **Ask these questions one at a time** (do not dump all at once):
   - "What specific mistakes has the AI agent been making repeatedly?" (e.g., wrong imports, forgetting to format, modifying wrong files)
   - "Are there legacy tools/libraries the agent keeps using but shouldn't?" (e.g., "We have Redux but use Zustand for new features")
   - "Any build/test/env quirks the agent can't figure out on its own?" (e.g., special env vars, non-standard test commands)

2. **Synthesize** answers into a ruthlessly minimal bulleted markdown file.

3. **Validate** the output against the Core Rules above. Strip anything that violates them.

4. **Present** the file and ask: "Does this capture the mistakes? Anything to add or remove?"

### Mode B: Audit Existing Agent File

When the user has an existing `agent.md` / `claude.md` / `cursorrules` and wants it optimized:

1. **Read the file** using `view_file`.
2. **Classify every line** into one of:
   - ✅ **KEEP** — Fixes a known failure or states an ungessable constraint
   - ❌ **BLOAT** — Directory trees, dependency lists, file structures
   - ❌ **SUMMARY** — Vague app descriptions, project overviews
   - ❌ **OBVIOUS** — Things the agent can discover via tools (package.json, tsconfig, etc.)
   - ⚠️ **MAYBE** — Potentially useful but needs user confirmation
3. **Present the audit** as a table showing each section and its classification.
4. **Generate the optimized version** with only ✅ KEEP and confirmed ⚠️ MAYBE lines.
5. **Show before/after line count** to demonstrate the reduction.

### Mode C: Add a Band-Aid

When the user reports a specific agent mistake mid-session:

1. Ask: "What did the agent do wrong?"
2. Write a single, precise negative constraint: `Do NOT [wrong thing]. Instead, [correct thing].`
3. Suggest appending it to the existing context file.

## Output Format

The generated file should follow this structure:

```markdown
# Agent Rules

- [Negative constraint or correction]
- [Negative constraint or correction]
- [Build/test quirk]
- [Architectural constraint]
```

**No headers beyond the title. No explanations. No examples. Just rules.**

## Anti-Patterns to Reject

If the user or another agent tries to include any of these, push back:

| Anti-Pattern | Why It's Bad |
|---|---|
| Folder tree / file structure | Agent has `list_dir` and `find_by_name` |
| Dependency list | Agent reads `package.json` / `requirements.txt` |
| "This app is a..." summary | Distracts model, triggers hallucination |
| Tech stack overview | Agent reads config files |
| Code style rules already in linter config | Redundant — linter enforces these |
| Long code examples | Bloats context, agent writes its own code |
