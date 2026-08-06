---
name: zack-production-suite
description: >
  Single entry point for planning and producing Zack D Films-style 3D animated
  myth-busting shorts. Routes browser-only research and pre-production,
  computer-side Google Flow production through TakomiFlow, direct Higgsfield
  production, and standalone TakomiFlow operations to the correct internal
  skill without loading every module at once.
---

# Zack Production Suite

This is the only entry point an agent should load initially. Do not treat every
internal module as an independently active agent. This file selects one
controller and tells it which supporting modules to read.

## Internal modules

1. **Zack Higgsfield Producer**  
   Path: `resources/skills/zack-higgsfield/SKILL.md`  
   Complete legacy end-to-end Zack pipeline using Higgsfield MCP for stills,
   animation, narration, sandbox editing, and delivery.

2. **TakomiFlow Provider**  
   Path: `resources/skills/takomi-flow/SKILL.md`  
   Reusable Google Flow browser-automation provider. It owns Flow login,
   readiness checks, request preparation, guarded credit spending, generation,
   download, inspection, review, and collection.

3. **Zack Browser Planner**  
   Path: `resources/skills/zack-browser-planner/SKILL.md`  
   Browser-side research and pre-production controller. It creates a locked,
   machine-readable Zack Production Package but never generates paid media.

4. **Zack Local Flow Producer**  
   Path: `resources/skills/zack-local-flow-producer/SKILL.md`  
   Computer-side production controller. It consumes a Zack Production Package,
   calls TakomiFlow for visual generation, uses available narration/editing
   tools, and delivers the final video without redoing approved research.

## Shared contract

Both planner and local producer must read:

- `resources/shared/contracts/zack-production-package.md`
- `resources/shared/contracts/zack-production-package.schema.json`

The JSON package is the boundary between browser and computer agents. The
browser agent decides what to make. The computer agent executes those locked
decisions. Do not use a long chat response as the only handoff.

## Routing rules

Apply the first matching rule:

### A. Browser-only planning or explicit handoff request

Examples: “research and prepare this for my computer agent,” “make a production
package,” “plan the Zack short in the browser,” or the current agent lacks local
shell/Flow access.

Read only:

1. `resources/skills/zack-browser-planner/SKILL.md`
2. the two shared contract files

Stop after producing the package ZIP/folder. Never pretend media was generated.

### B. Execute an existing package with Google Flow

Examples: the user supplies `handoff.json`, a Zack package ZIP/folder, or asks
the computer agent to continue the browser agent’s work.

Read:

1. `resources/skills/zack-local-flow-producer/SKILL.md`
2. `resources/skills/takomi-flow/SKILL.md`
3. the two shared contract files

The local producer is the controller; TakomiFlow is only its visual provider.

### C. Complete a new Zack short locally with Google Flow

When the current computer agent has web research plus local shell/browser access
and the user wants an end-to-end Flow run but no package exists:

1. Read the browser planner and create the package locally.
2. Lock the package only after the required approval gates.
3. Read the local producer and TakomiFlow provider.
4. Execute the locked package.

Do not invent a separate informal plan between the two stages.

### D. Direct Higgsfield production

When the user explicitly requests Higgsfield, supplies a Higgsfield project, or
only Higgsfield MCP is available, read:

- `resources/skills/zack-higgsfield/SKILL.md`

Do not also load or call TakomiFlow unless the user explicitly requests a
provider migration or comparison.

### E. Standalone Flow administration or non-Zack generation

For TakomiFlow setup, doctor, login/bootstrap, smoke checks, generic Flow image
or video generation, run inspection, asset collection, or provider debugging,
read only:

- `resources/skills/takomi-flow/SKILL.md`

## Provider selection

1. An explicit user choice wins.
2. A locked handoff package’s `provider.visualProvider` wins.
3. A browser-only agent always creates a package and stops.
4. A capable local agent should prefer TakomiFlow when it is already installed
   and healthy.
5. Use Higgsfield when explicitly requested or when the Flow route is unavailable
   and Higgsfield is available.
6. Never spend credits on both providers for the same locked generation queue
   unless the user explicitly authorizes an A/B comparison.

## Controller discipline

- Exactly one module owns the run at a time.
- Supporting modules do not restart research, rewrite the script, or create a
  competing manifest.
- The browser planner owns creative decisions through package lock.
- The local Flow producer owns execution after package lock.
- TakomiFlow owns only Flow operation.
- The Higgsfield producer owns the entire run only in Route D.
- Do not recursively trigger this router from an internal module.

## Package states

- `DRAFT`: research/planning may change; no paid execution.
- `LOCKED_FOR_PRODUCTION`: creative package is frozen and may be executed when
  the relevant spend approval is true.
- `EXECUTING`: written only in the local execution manifest, never by mutating
  the locked source package.
- `COMPLETE`: written in the local execution manifest after final delivery.

A local producer may validate and prepare no-spend requests from a DRAFT package,
but it must not submit paid generations.

## Failure behavior

- Missing package files: report the exact missing relative paths.
- Invalid JSON/schema: run the bundled validator and report errors.
- Provider unavailable: stop at a precise handoff rather than claiming success.
- Login, captcha, quota, consent, or safety gates remain manual.
- Never silently switch providers after package lock.
