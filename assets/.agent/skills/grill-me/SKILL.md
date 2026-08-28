---
name: grill-me
description: Use when stress-testing a plan, design, or requirements through an interactive interview with question frontiers and adversarial challenges.
author: Matt Pocock / P-Stack
coauthored: J StaR Films / Takomi
version: 2.0.0
---

# Grill Me

Stress-test a plan, design, or set of requirements through an interactive interview. Combines structured **Question Frontier Trees** with **Adversarial Interrogation**.

## Core Discipline

Interview the user relentlessly until you reach a shared, unambiguous understanding. Map decisions as a **Design Tree**: every decision branches into the secondary decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask *now* without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

### Question Format

```markdown
❓ **Q1** - **<Question Title>**: <Question body detailing context and options>

➡️ **Recommended**: <Your recommended answer and rationale>
```

---

## The Adversarial Lens (Interrogation Mode)

While working the tree, actively hunt for failure modes and unstated assumptions:

1. **Failure Modes & Degradation**: What happens when the primary network call, cache, or external API fails?
2. **Concurrency & Race Conditions**: What happens when two users or subagents write to this resource simultaneously?
3. **Data Boundary Leaks**: Are types strictly bounded, or is untrusted data passing through without validation?
4. **Load-bearing Assumptions**: What implicit assumptions is this design leaning on? Prove or invalidate them.

---

## When to Stop

Stop when:
1. Every branch of the frontier has been answered or explicitly deferred.
2. All load-bearing dependencies and failure modes are accounted for.
3. The design can be converted directly into a formal spec without further clarifying questions.
