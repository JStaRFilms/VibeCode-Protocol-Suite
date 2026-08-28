---
name: source-to-skill
description: Use when compiling raw knowledge sources (transcripts, docs, PDFs, books, video notes) into structured, operational agent skills.
author: J StaR Films / Takomi
coauthored: J StaR Films / Takomi
version: 1.0.0
---

# Source-to-Skill Compiler

Transform raw source materials into a structured, validated agent skill. The pipeline **distills** knowledge from sources, **operationalizes** it into methodology, and **compiles** a skill that encodes what a competent practitioner needs to *do* — not a summary of what the sources *say*.

## Pipeline

```
Sources → Inventory → Extract → Synthesize → Compile → Validate → Deliver
```

Follow these phases in order. Each phase has a **completion gate** — do not advance until the gate is met.

---

## Phase 1: Source Inventory

Catalogue every source the user provides.

For each source, record:

| Field | Content |
|---|---|
| **ID** | Short identifier (`src-01`, `src-02`, …) |
| **Type** | transcript / document / webpage / book / video-notes |
| **Title** | Source title or description |
| **Authority** | Creator and their domain credibility |
| **Coverage** | Topics this source addresses |

After cataloguing, identify **coverage gaps**: topics the user expects the skill to cover that no source addresses. Flag these to the user before proceeding.

### Completion gate

- [ ] Every source has an inventory entry
- [ ] Coverage gaps identified and communicated to the user

---

## Phase 2: Knowledge Extraction

Read each source. Extract **knowledge units** — atomic pieces of extractable knowledge. See [knowledge-spec.md](references/knowledge-spec.md) for the intermediate representation format.

### Extraction priorities (in order)

1. **Procedures**: What does the source teach you to *do*? Step sequences, decision points, ordering.
2. **Principles**: What rules or heuristics govern those procedures? The reasoning behind steps.
3. **Constraints**: What must hold true? Boundaries, prerequisites, invariants.
4. **Concepts**: Domain terms the source defines or relies on. Definitions and relationships.
5. **Examples and counterexamples**: Concrete cases showing correct and incorrect application.

### Provenance

Every knowledge unit carries its source ID and location (chapter, timestamp, section, paragraph). Knowledge without provenance is inadmissible — discard it or ask the user to confirm the source.

### Conflict detection

When sources disagree, record both positions as separate knowledge units linked by a `conflicts_with` relationship. Flag every conflict to the user with both positions stated. Do not silently resolve conflicts.

### Source reliability

Weight knowledge units by source authority. A peer-reviewed methodology textbook outweighs a casual tutorial. When a low-authority source is the only one covering a topic, mark the resulting knowledge units as `confidence: low` and flag the gap.

### Completion gate

- [ ] Every source fully read and extracted
- [ ] All knowledge units have provenance
- [ ] Conflicts between sources flagged to the user
- [ ] User has reviewed and resolved critical conflicts

---

## Phase 3: Methodology Synthesis

Transform extracted knowledge units into an **operational methodology** — the structured workflow the compiled skill will encode.

### Operationalize every procedure

For each procedure from Phase 2, produce an operational stage:

```
STAGE: [Name]

INPUT
- What the practitioner needs before starting this stage

STEPS
1. [Imperative action] — completion criterion: [how to know it is done]
2. [Next action] — completion criterion: [...]

DECISION POINTS
- If [condition] → [branch A path]
- If [condition] → [branch B path]

OUTPUT
- What this stage produces

VALIDATION
[ ] Checkable criterion 1
[ ] Checkable criterion 2
```

The driving question for every stage: **"What does a competent practitioner actually need to be able to DO?"**

### Sequence and dependencies

Arrange stages into a dependency order. Identify which stages must precede others and which can run in parallel.

### Merge and deduplicate

Multiple sources often describe the same procedure differently. Merge overlapping stages, keeping the strongest version. Preserve provenance from all contributing sources.

### Completion gate

- [ ] Every procedure from Phase 2 has a corresponding operational stage
- [ ] Every stage has explicit inputs, outputs, steps, and validation criteria
- [ ] Stages are ordered by dependency (prerequisites before dependents)
- [ ] Duplicate stages merged

---

## Phase 4: Skill Compilation

Compile the operational methodology into a proper agent skill. See [compilation-guide.md](references/compilation-guide.md) for the detailed mapping from knowledge spec to skill components.

### Target structure

```
[skill-name]/
├── SKILL.md
├── references/
│   ├── terminology.md        (if 5+ domain terms)
│   ├── examples.md           (if 2+ worked examples)
│   └── [topic-specific].md   (as needed)
└── scripts/                  (only if deterministic automation needed)
```

### SKILL.md composition

1. **Frontmatter**: `name` and `description` only. Description carries trigger branches — the conditions under which the skill fires.

2. **Body**: The operational methodology as sequential phases. Each phase contains:
   - Steps in imperative form
   - Completion criteria on every step
   - Decision points where the workflow branches

3. **Progressive disclosure**: Body stays under 500 lines. Push domain glossary, extended examples, detailed schemas, and reference tables into `references/` files. Point to each reference file from the body at the point where the agent needs it.

### Writing discipline

Every line of the compiled skill must pass these checks:

- **Imperative form**: "Identify the domain experts" — not "The domain experts should be identified"
- **Leading words**: Use compact pretrained concepts that anchor behavior (*elicit*, *validate*, *trace*, *decompose*). Prefer real English words over coined jargon.
- **Positive steering**: State what to do. A prohibition earns its place only as a hard guardrail impossible to phrase positively — and even then, pair it with the positive target.
- **Single source of truth**: Each meaning lives in one place. If the environment already states something, the skill does not restate it.
- **Operational, not descriptive**: Encode capability. A stage with inputs, steps, and validation criteria is operational. "Source X says this is important" is a summary — delete it.
- **Prune**: Every line must change agent behavior versus the default. Delete no-ops.

### Completion gate

- [ ] Complete skill directory exists
- [ ] SKILL.md body under 500 lines
- [ ] Every phase has completion criteria
- [ ] Every reference file pointed to from the body
- [ ] Skill reads as documentation for the agent, not a textbook about the domain

---

## Phase 5: Validation

Test the compiled skill against the source material.

### Source fidelity

Walk the knowledge spec. For every knowledge unit, verify the compiled skill encodes it as one of:

- An inline step or criterion
- A reference entry
- A documented exclusion with rationale

Flag any knowledge unit silently dropped.

### Operational coverage

Generate 3–5 realistic test scenarios spanning the skill's intended use. For each scenario, walk through the compiled methodology and verify:

1. The skill provides sufficient guidance to handle it
2. Steps execute in the correct order
3. Decision points cover the scenario's branches
4. A practitioner following the skill would reach a correct result

### Gap reporting

Identify scenarios the skill cannot handle. Report these to the user as known limitations.

### Completion gate

- [ ] Every knowledge unit accounted for (encoded or explicitly excluded)
- [ ] At least 3 test scenarios walked through successfully
- [ ] Known limitations documented

---

## Delivery

Present the compiled skill to the user with:

1. **The skill directory** — ready to install
2. **Extraction summary** — what was found across sources (count of knowledge units by type, key conflicts resolved)
3. **Known limitations** — scenarios the skill does not cover
4. **Unresolved items** — any remaining source conflicts or low-confidence areas
