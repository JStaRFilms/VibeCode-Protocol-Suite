# Knowledge Spec Format

The **knowledge spec** is the intermediate representation between raw source material and the compiled skill. Produce this during Phase 2 as a working document. Each entry is one **knowledge unit** — an atomic piece of extractable knowledge.

Consult this format when extracting knowledge from sources. The spec is a living artifact: entries are added during extraction, refined during synthesis, and referenced during validation.

## Entry Format

Use YAML for each knowledge unit. Group related units under headings by topic.

```yaml
- id: ku-001
  type: concept
  name: Short descriptive name
  source: src-01, "Chapter 3, Section 2"
  confidence: high

  definition: >
    One-two sentence definition of what it IS, not what it does.
  attributes:
    - key attribute 1
    - key attribute 2
  avoid_terms: [synonym to avoid, another synonym]
  related: [ku-003, ku-007]
```

## Fields by Type

### concept

A named thing in the domain — a term, entity, or category.

```yaml
- id: ku-001
  type: concept
  name: Knowledge Acquisition
  source: src-01, "Chapter 8"
  confidence: high

  definition: >
    The process of extracting domain knowledge from experts
    and source materials for formal representation.
  attributes: [tacit knowledge, explicit knowledge, elicitation]
  avoid_terms: [data collection, information gathering]
  related: [ku-002, ku-005]
```

### principle

A general rule or heuristic that guides decisions.

```yaml
- id: ku-010
  type: principle
  name: Model Before Rules
  source: src-01, "Chapter 5, p.112"
  confidence: high

  statement: >
    Build the domain model before writing inference rules.
    Rules derived without a model risk encoding surface patterns
    rather than domain structure.
  rationale: >
    Rules need concepts and relationships to bind to.
    Without a model, rules become brittle pattern matches.
  applies_to: [ku-020, ku-021]  # related procedures
```

### procedure

A sequence of steps to accomplish something. The primary extraction target.

```yaml
- id: ku-020
  type: procedure
  name: Task Analysis
  source: src-01, "Chapter 6"
  confidence: high

  goal: Decompose the problem into structured tasks
  prerequisites:
    - Problem definition complete (ku-015)
  steps:
    - action: Identify the primary task
      criterion: Task has a measurable goal
    - action: Decompose into subtasks
      criterion: Each subtask has defined inputs and outputs
    - action: Identify knowledge requirements for each subtask
      criterion: Required knowledge is explicit
  outputs:
    - Task decomposition
    - Knowledge requirements list
  related: [ku-010, ku-021]
```

### constraint

A boundary, prohibition, prerequisite, or invariant.

```yaml
- id: ku-030
  type: constraint
  name: No Rules Before Domain Model
  source: src-01, "Chapter 5, p.115"
  confidence: high

  rule: >
    Do not generate inference rules until the domain model
    is constructed and validated.
  scope: Applies during knowledge representation phase
  consequence: >
    Rules without a model encode surface patterns.
    They break when the domain shifts.
  enforced_by: Phase ordering in the methodology
```

### example

A concrete case showing correct application.

```yaml
- id: ku-040
  type: example
  name: MYCIN Certainty Factors
  source: src-02, "Chapter 11"
  confidence: high

  scenario: >
    Diagnosing bacterial infections with uncertain evidence.
  application: >
    MYCIN combined multiple uncertain rules using certainty
    factors rather than binary true/false logic.
  outcome: >
    System achieved specialist-level diagnostic accuracy.
  teaches: >
    Uncertainty handling is essential when domain knowledge
    is probabilistic rather than deterministic.
  illustrates: [ku-010, ku-025]
```

### counterexample

A concrete case showing incorrect application or failure.

```yaml
- id: ku-050
  type: counterexample
  name: Rules Without Domain Model
  source: src-01, "Chapter 5, p.118"
  confidence: high

  scenario: >
    Team wrote 200 IF/THEN rules directly from expert interviews
    without building a domain model first.
  mistake: >
    Skipped conceptualization phase. Rules encoded surface
    patterns from interview transcripts.
  consequence: >
    System failed on novel cases. Rules contradicted each
    other. Maintenance became impossible.
  correction: >
    Build the domain model first. Derive rules from the model.
  teaches: >
    The Model Before Rules principle exists for a reason.
  illustrates: [ku-010, ku-030]
```

## Conflict Notation

When sources disagree, create separate knowledge units for each position and link them:

```yaml
- id: ku-060
  type: principle
  name: Default Inference Direction (Source A)
  source: src-01, "Chapter 7"
  confidence: medium
  conflicts_with: ku-061

  statement: Forward chaining is the default for diagnostic systems.

- id: ku-061
  type: principle
  name: Default Inference Direction (Source B)
  source: src-02, "Chapter 9"
  confidence: medium
  conflicts_with: ku-060

  statement: Backward chaining is more natural for diagnostic reasoning.
```

Add a conflict summary at the top of the spec:

```yaml
conflicts:
  - units: [ku-060, ku-061]
    topic: Default inference direction for diagnostics
    resolution: pending
```

## Granularity Rule

One knowledge unit = one atomic idea. If an entry contains two separable concepts, procedures, or principles, split it into two entries. The test: could you change one part without changing the other? If yes, they are separate units.

## Confidence Calibration

| Level | Criteria |
|---|---|
| **high** | Multiple sources agree, or single authoritative source with strong evidence |
| **medium** | Single source, or multiple sources with minor disagreements |
| **low** | Tangential mention, inferred rather than stated, or lower-authority source |
