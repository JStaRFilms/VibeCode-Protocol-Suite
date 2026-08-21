---
name: engineering-principles
description: Use when designing systems, structuring code, reviewing diffs, handling state, or adhering to core software engineering discipline principles.
author: P-Stack
coauthored: J StaR Films / Takomi
version: 2.0.0
---

# Engineering Principles Suite

A catalogue of 21 foundational principles for software architecture, code quality, state management, and agentic workflows.

## Principles Catalog

Read the specific principle file via `view_file` on demand when applying its rule:

| Principle | When to Apply | File Path |
|---|---|---|
| **`boundary-discipline`** | Apply when wiring validation, error handling, or framework adapters. Concentrate guards at system boundaries (CLI, config, network, external APIs); trust internal types and keep business logic in pure functions. | [`boundary-discipline/SKILL.md`](./boundary-discipline/SKILL.md) |
| **`build-the-lever`** | Apply to any non-trivial work, not just bulk work: edits, migrations, analyses, checks. Build the tool that does it or proves it (codemod, script, generator, or a skill your subagents follow) instead of working by hand. The tool is the artifact a reviewer can rerun. | [`build-the-lever/SKILL.md`](./build-the-lever/SKILL.md) |
| **`encode-lessons-in-structure`** | Apply when you catch yourself writing the same instruction a second time, or notice a recurring correction. Encode the rule as a lint, metadata flag, runtime check, or script instead of more text. | [`encode-lessons-in-structure/SKILL.md`](./encode-lessons-in-structure/SKILL.md) |
| **`exhaust-the-design-space`** | Apply when facing a novel UI interaction or architectural decision with no precedent in the codebase. Build 2-3 competing prototypes and compare side by side before committing. | [`exhaust-the-design-space/SKILL.md`](./exhaust-the-design-space/SKILL.md) |
| **`experience-first`** | Apply when product, UX, or feature-scope tradeoffs come up. Choose user delight over implementation convenience; ship fewer polished features over more rough ones. | [`experience-first/SKILL.md`](./experience-first/SKILL.md) |
| **`fix-root-causes`** | Apply when debugging. Trace each symptom to its root cause and fix it there; reproduce first, ask why until you reach it, resist nil-check guards that silence crashes. | [`fix-root-causes/SKILL.md`](./fix-root-causes/SKILL.md) |
| **`foundational-thinking`** | Apply before writing logic: choosing core types and data structures, sequencing scaffold-vs-feature work, asking what concurrent actors share. Get the data structures right so downstream code becomes obvious. | [`foundational-thinking/SKILL.md`](./foundational-thinking/SKILL.md) |
| **`guard-the-context-window`** | Apply when context is filling up: large outputs, long files, repeated reads, fan-out planning. Route bulk to subagents; keep summaries in the main thread, not raw payloads. | [`guard-the-context-window/SKILL.md`](./guard-the-context-window/SKILL.md) |
| **`laziness-protocol`** | Apply when refactoring, evaluating diff size, or tempted to add abstractions, layers, or signal threading. Bias toward deletion and the smallest change that solves the problem. | [`laziness-protocol/SKILL.md`](./laziness-protocol/SKILL.md) |
| **`make-operations-idempotent`** | Apply when designing commands, lifecycle steps, or processing loops that run amid crashes, restarts, and retries. Converge to the same end state regardless of partial prior runs. | [`make-operations-idempotent/SKILL.md`](./make-operations-idempotent/SKILL.md) |
| **`migrate-callers-then-delete-legacy-apis`** | Apply when introducing a new internal API while old callers still exist. Migrate callers and delete the old API in the same wave instead of preserving compatibility layers. | [`migrate-callers-then-delete-legacy-apis/SKILL.md`](./migrate-callers-then-delete-legacy-apis/SKILL.md) |
| **`minimize-reader-load`** | Apply when reviewing or shaping code that's hard to trace. Count layers between question and answer, and hidden state in the reader's head; collapse one-caller wrappers and shrink mutable scope. | [`minimize-reader-load/SKILL.md`](./minimize-reader-load/SKILL.md) |
| **`model-the-domain`** | Apply when writing stateful logic, or when code branches a lot or repeats a shape assumption across files. Encode the domain in a structure instead of scattered conditionals. | [`model-the-domain/SKILL.md`](./model-the-domain/SKILL.md) |
| **`never-block-on-the-human`** | Apply when tempted to ask 'should I do X?' on reversible work. Proceed, present the result, let the human course-correct after the fact; reserve confirmation for irreversible actions. | [`never-block-on-the-human/SKILL.md`](./never-block-on-the-human/SKILL.md) |
| **`outcome-oriented-execution`** | Apply during planned rewrites and migrations with explicit phase boundaries. Converge on the target architecture; don't preserve smooth intermediate states with throwaway compatibility code. | [`outcome-oriented-execution/SKILL.md`](./outcome-oriented-execution/SKILL.md) |
| **`prove-it-works`** | Apply after completing a task, before declaring done. Verify against the real artifact (run the feature, read the actual value, inspect the diff), not a proxy, self-report, or 'it compiles.' | [`prove-it-works/SKILL.md`](./prove-it-works/SKILL.md) |
| **`redesign-from-first-principles`** | Apply when integrating a new requirement into an existing design. Redesign as if the requirement had been a foundational assumption from day one, instead of bolting it on. | [`redesign-from-first-principles/SKILL.md`](./redesign-from-first-principles/SKILL.md) |
| **`separate-before-serializing-shared-state`** | Apply when concurrent actors might write to the same file, branch, key, or state object. Eliminate the sharing first; serialize structurally only when one shared writer is a real invariant. | [`separate-before-serializing-shared-state/SKILL.md`](./separate-before-serializing-shared-state/SKILL.md) |
| **`sequence-verifiable-units`** | Apply to multi-step work (sweeps, migrations, runs of similar edits) and to how you stack commits and PRs. Break work into small units that each end in a verifiable state, check each before the next, and order delivery so the sequence proves itself to a reviewer. | [`sequence-verifiable-units/SKILL.md`](./sequence-verifiable-units/SKILL.md) |
| **`subtract-before-you-add`** | Apply when sequencing an addition, refactor, or rewrite. Remove dead weight, redundant validators, and stub references first, then build on the simpler base. | [`subtract-before-you-add/SKILL.md`](./subtract-before-you-add/SKILL.md) |
| **`type-system-discipline`** | Apply when designing types, reviewing a function signature, or writing code in any statically-typed language. Make illegal states unrepresentable, brand semantic primitives, parse external data at boundaries, refuse to lie to the compiler, exhaust variants, derive from authoritative schemas. | [`type-system-discipline/SKILL.md`](./type-system-discipline/SKILL.md) |
