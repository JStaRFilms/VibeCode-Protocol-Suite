---
name: agent-engineering
description: Use when engineering LLM prompts, writing agent docs ('writing-for-agents'), modeling domain vocabulary ('domain-modeling' CONTEXT.md/ADRs), creating specs ('conversation-to-spec'), spawning task DAGs ('spawn-task'), running code tournaments ('arena'), or managing subagents.
author: J StaR Films / Matt Pocock / P-Stack
coauthored: J StaR Films / Takomi
version: 2.0.0
---

# Agent Engineering Suite

Comprehensive suite for prompt engineering, agent steering rules, domain dictionaries (`CONTEXT.md`), task decomposition DAGs, and subagent orchestration.

> [!IMPORTANT]
> **Foundational Guide:** When authoring or editing any skill, `AGENTS.md`, or subagent prompt, read [`writing-for-agents/SKILL.md`](writing-for-agents/SKILL.md) and [`writing-for-agents/SKILL-MECHANICS.md`](writing-for-agents/SKILL-MECHANICS.md) first to ensure tight context pointers and zero token waste.

## Sub-Skills

| Sub-Skill | Purpose | Path |
|---|---|---|
| **`writing-for-agents`** | Core rules for writing skills, AGENTS.md, context pointers, and router mechanics | [`writing-for-agents/SKILL.md`](writing-for-agents/SKILL.md) |
| **`domain-modeling`** | Generates `CONTEXT.md` ubiquitous language glossary with `_Avoid_` anti-synonyms and ADRs | [`domain-modeling/SKILL.md`](domain-modeling/SKILL.md) |
| **`conversation-to-spec`** | Synthesizes chat discussions into formal technical specifications | [`conversation-to-spec/SKILL.md`](conversation-to-spec/SKILL.md) |
| **`spawn-task`** | Decomposes specs into tracer-bullet vertical slice task packets with blocking DAGs | [`spawn-task/SKILL.md`](spawn-task/SKILL.md) |
| **`to-questionnaire`** | Generates async questionnaires for domain experts and external stakeholders | [`to-questionnaire/SKILL.md`](to-questionnaire/SKILL.md) |
| **`arena`** | Spawns parallel candidate implementations and blind-judges the strongest solution | [`arena/SKILL.md`](arena/SKILL.md) |
| **`automate-me`** | Scans terminal history and repeated workflows to produce new agent skills and scripts | [`automate-me/SKILL.md`](automate-me/SKILL.md) |
| **`reflect`** | Spawns 3 review subagents over transcripts to extract learnings and patch skills | [`reflect/SKILL.md`](reflect/SKILL.md) |
| **`create-verification-skill`** | Generates project-local verification harnesses driving apps end-to-end | [`create-verification-skill/SKILL.md`](create-verification-skill/SKILL.md) |
| **`maintain-verification-skill`** | Audits and updates project verification harnesses as code evolves | [`maintain-verification-skill/SKILL.md`](maintain-verification-skill/SKILL.md) |
| **`subagent-driven-development`** | Parallel subagent orchestration and implementation task loops | [`subagent-driven-development/SKILL.md`](subagent-driven-development/SKILL.md) |
| **`prompt-engineering`** | Advanced prompting patterns, meta-prompts, and eval harnesses | [`prompt-engineering/SKILL.md`](prompt-engineering/SKILL.md) |
| **`skill-creator`** | Scaffolding new agent skills following repository conventions | [`skill-creator/SKILL.md`](skill-creator/SKILL.md) |
| **`optimize-agent-context`** | Optimizing context windows and rule files | [`optimize-agent-context/SKILL.md`](optimize-agent-context/SKILL.md) |
| **`crafting-effective-readmes`** | Writing structured repository documentation | [`crafting-effective-readmes/SKILL.md`](crafting-effective-readmes/SKILL.md) |
