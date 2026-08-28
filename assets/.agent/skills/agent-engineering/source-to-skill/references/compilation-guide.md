# Compilation Guide

How to map the knowledge spec into a compiled skill. Consult this during Phase 4.

## Mapping Knowledge Units to Skill Components

| Knowledge Unit Type | Skill Component |
|---|---|
| **concept** | `references/terminology.md` glossary entry, or inline definition if used in only one phase |
| **principle** | Inline guidance within the relevant phase; cross-cutting principles go in a brief section near the top |
| **procedure** | A phase or sub-phase in the skill's workflow |
| **constraint** | Validation criterion or decision-point guard within the relevant phase |
| **example** | `references/examples.md` worked example, or inline if compact (under 10 lines) |
| **counterexample** | Warning or anti-pattern note within the relevant phase, or in `references/examples.md` |

## Converting Procedures to Phases

Each major procedure becomes a phase. Use this conversion pattern:

**Knowledge spec entry:**

```yaml
- id: ku-020
  type: procedure
  name: Task Analysis
  goal: Decompose the problem into structured tasks
  prerequisites: [problem definition complete]
  steps:
    - action: Identify the primary task
      criterion: Task has a measurable goal
    - action: Decompose into subtasks
      criterion: Each subtask has defined inputs and outputs
  outputs: [task decomposition, knowledge requirements]
```

**Compiled skill phase:**

```markdown
## Phase N: Task Analysis

Decompose the problem into structured tasks.

1. Identify the primary task the system must perform. State its goal in measurable terms.
2. Decompose into subtasks. For each subtask, define its inputs and outputs.
3. For each subtask, identify what knowledge is required to perform it.

### Completion gate
- [ ] Primary task has a measurable goal
- [ ] Every subtask has defined inputs and outputs
- [ ] Knowledge requirements are explicit for each subtask

**Output**: Task decomposition and knowledge requirements list.
```

Key conversions:
- `goal` → opening line of the phase (imperative)
- `prerequisites` → either phase ordering or an explicit "before starting" note
- `steps[].action` → numbered imperative step
- `steps[].criterion` → completion gate checklist item
- `outputs` → **Output** line at the end

## Phase Sizing

Target 15–40 lines per phase. If a phase exceeds 40 lines, it likely contains reference material. Push it to a `references/` file and point to it.

## Building Reference Files

### Terminology (`references/terminology.md`)

Create when the domain has 5+ terms. Use the CONTEXT.md format:

```markdown
# Terminology

**Knowledge Acquisition**:
The process of extracting domain knowledge from experts and sources for formal representation.
_Avoid_: data collection, information gathering

**Inference Engine**:
The component that applies rules to working memory to derive conclusions.
_Avoid_: rule processor, reasoning module
```

Each term: definition of what it IS (one-two sentences), then `_Avoid_` anti-synonyms.

### Examples (`references/examples.md`)

Create when 2+ worked examples exist. Structure each example as:

```markdown
## [Example Name]

**Scenario**: [situation description]

**Application**: [how the methodology was applied]

**Outcome**: [what resulted]

**Key lesson**: [what this demonstrates]
```

### Topic-specific references

Create for any block of reference material exceeding ~50 lines that only some phases need. Name descriptively: `decision-tables.md`, `validation-rules.md`, `inference-patterns.md`.

## Pointing to References

Every reference file must be pointed to from SKILL.md at the exact point the agent would need it. The pointer wording determines whether the agent reaches the material — front-load the leading word:

```markdown
For domain terms and canonical names, see [terminology.md](references/terminology.md).
```

```markdown
For worked examples of each phase, see [examples.md](references/examples.md).
```

Place the pointer immediately before or after the phase that needs the reference, not in a generic "References" section at the bottom.

## Cross-Cutting Principles

Principles that apply across multiple phases go in one of two places:

- **Every phase**: A brief "Principles" or "Ground rules" section near the top of SKILL.md (3–5 items max)
- **A cluster of phases**: Inline at the first relevant phase with a forward reference ("this principle also applies in Phase N")

## Final Checks

Before delivering the compiled skill, verify:

- [ ] SKILL.md body under 500 lines
- [ ] Frontmatter has `name` and `description` only
- [ ] Description carries trigger branches (when the skill should fire)
- [ ] Every reference file pointed to from the body
- [ ] No content duplicated between SKILL.md and reference files
- [ ] Glossary uses `_Avoid_` anti-synonyms
- [ ] Every phase has a completion gate with checkable criteria
- [ ] All steps in imperative form
- [ ] No no-ops (instructions the model already follows by default)
- [ ] No negation-based steering (state what to do, not what to avoid)
- [ ] Leading words used for key recurring concepts
