---
name: takomi
description: Use when coordinating multi-stage work, initializing Takomi workflows (genesis, design, build, review, finalize), or navigating agent lifecycle states.
author: J StaR Films
version: 2.0.0
---

# Takomi (Unified Skill)

This single skill contains the full non-legacy Takomi workflow suite.
Use it whenever a user says "use takomi", asks for Vibe Code lifecycle execution, or references any prior workflow names.

## How To Use
- Natural language is primary. Slash commands are optional and not required.
- Examples:
  - `use takomi`
  - `use takomi genesis`
  - `run vibe genesis`
  - `continue build with takomi`

## Router Behavior
1. Match user intent to one workflow playbook from `workflows/`.
2. Execute that playbook's protocol.
3. Recommend the next workflow stage after completion.
4. Allow explicit user overrides (guided gates, not hard blocks).

## Lifecycle Gates
- Discover/Prime: `vibe-primeAgent.md`, `reverse_genesis.md`
- Plan/Design: `vibe-genesis.md`, `vibe-design.md`, `mode-architect.md`, `mode-visionary.md`
- Build/Continue: `vibe-build.md`, `vibe-continueBuild.md`, `mode-code.md`, `stitch.md`, `remotion-build.md`
- Review/Finalize: `mode-review.md`, `review_code.md`, `vibe-finalize.md`, `vibe-syncDocs.md`
- Recovery/Migration: `agent_reset.md`, `escalate.md`, `migrate.md`, `optimize-agent-context.md`, `mode-orchestrator.md`, `mode-debug.md`, `mode-ask.md`, `vibe-spawnTask.md`, `spawn-jstar-code-review.md`

## Workflow Playbooks (Contained In This Skill)
- `workflows/vibe-genesis.md`
- `workflows/vibe-design.md`
- `workflows/vibe-build.md`
- `workflows/vibe-continueBuild.md`
- `workflows/vibe-finalize.md`
- `workflows/vibe-primeAgent.md`
- `workflows/vibe-spawnTask.md`
- `workflows/vibe-syncDocs.md`
- `workflows/reverse_genesis.md`
- `workflows/mode-orchestrator.md`
- `workflows/mode-architect.md`
- `workflows/mode-code.md`
- `workflows/mode-debug.md`
- `workflows/mode-ask.md`
- `workflows/mode-review.md`
- `workflows/mode-visionary.md`
- `workflows/review_code.md`
- `workflows/spawn-jstar-code-review.md`
- `workflows/agent_reset.md`
- `workflows/escalate.md`
- `workflows/migrate.md`
- `workflows/optimize-agent-context.md`
- `workflows/stitch.md`
- `workflows/remotion-build.md`

## Alias Map
See [references/migration-map.md](references/migration-map.md).
