# Takomi: Project-Local Model Routing and Board Artifact Safety

## Priority

High — configuration correctness and prevention of destructive orchestration-document writes.

## Problem Statement

Takomi currently has the right *concepts*—global configuration, project-local `.pi` configuration, Markdown routing policies, role defaults, and explicit task models—but their precedence is not clear or reliable enough.

Two observed failures exposed this:

1. A user explicitly requested `openai-codex/gpt-5.6-sol`, but the routing layer replaced it with `oauth-router/gpt-5.6-sol` because it considered the model family equivalent. The substituted provider had no healthy account, causing a preventable dispatch failure.
2. A detailed human-authored `master_plan.md` was overwritten by a short `masterPlanMarkdown` value passed to `takomi_board.init_session`. Board state did not preserve the original prose, so recovery depended on the chat transcript.

The desired system behavior is:

> A user can set an OpenAI Codex default globally, override it with a project-local provider/model policy for one repository, and pass an explicit provider-qualified model for a specific task. The most specific valid choice wins. No provider is silently substituted.

> A human-authored orchestration plan is a canonical artifact. The board tracks state around it but never shortens, rewrites, or appends to it without an explicit destructive confirmation.

## Product Decision

Use **both Markdown and JSON**, with distinct responsibilities. Do not replace one with the other.

| Artifact | Purpose | Audience |
| --- | --- | --- |
| `model-routing.md` | Human-readable routing philosophy, rationale, team conventions, exceptions | Users and agents |
| `.pi/settings.json` / `~/.pi/agent/settings.json` | Structured, machine-enforced provider/model role defaults and allowlists | Runtime |
| `takomi_board` JSON state | Session/task lifecycle state only | Runtime |
| `master_plan.md` | Rich human-authored project plan | Users and agents |

Markdown should not be parsed heuristically to infer every executable default. JSON should not be used as a substitute for the explanation and policy rationale.

## Required Configuration Model

### Global configuration

`~/.pi/agent/settings.json` provides user-wide defaults:

```json
{
  "takomi": {
    "routing": {
      "defaultProvider": "openai-codex",
      "approvedModels": [
        "openai-codex/gpt-5.6-luna",
        "openai-codex/gpt-5.6-sol",
        "openai-codex/gpt-5.6-terra"
      ],
      "roleDefaults": {
        "oracle": { "model": "openai-codex/gpt-5.6-sol", "thinking": "high" },
        "worker": { "model": "openai-codex/gpt-5.6-terra", "thinking": "high" }
      }
    }
  }
}
```

### Project-local override

`<project>/.pi/settings.json` may override only the routing values needed by that project:

```json
{
  "takomi": {
    "routing": {
      "defaultProvider": "openrouter",
      "approvedModels": [
        "openrouter/google/gemini-3.5-flash",
        "openrouter/anthropic/claude-sonnet-5"
      ],
      "roleDefaults": {
        "designer": {
          "model": "openrouter/google/gemini-3.5-flash",
          "thinking": "medium"
        }
      }
    }
  }
}
```

The project setting must be a deep overlay of the global setting. It must not require users to edit installed extension TypeScript or global config just to change one project.

### Human-readable policy

A project can additionally carry:

`<project>/.pi/takomi/model-routing.md`

It describes the intent and can refer to configured model IDs, for example:

```md
# Project Model Routing

This project uses OpenRouter for design exploration and OpenAI Codex for implementation.
Do not use OAuth Router in this project.
```

The runtime must report an error if the prose conflicts with structured executable settings; it must not guess a provider from broad words such as “Sol” or “Terra.”

## Required Precedence Rules

Resolve every task in this order:

1. Explicit provider-qualified `takomi_subagent.model` passed for this task.
2. Explicit task packet model (`preferredModel`) after user/orchestrator confirmation.
3. Project-local role default in `.pi/settings.json`.
4. Global role default in `~/.pi/agent/settings.json`.
5. Project-local default provider plus configured role/model mapping.
6. Global default provider plus configured role/model mapping.
7. Harness default only if no user or project configuration exists.

### Non-negotiable rules

- A provider-qualified selection is atomic: `openai-codex/gpt-5.6-sol` must never be replaced with `oauth-router/gpt-5.6-sol` by model-family matching.
- Only an explicit `fallbackModels` list may authorize provider switching after the first model fails.
- If an explicit model is not enabled, approved, or healthy, report that exact reason. Do not silently select an “equivalent.”
- Project configuration must override global configuration, but never override an explicit task model.
- The UI must display the final resolved source: `explicit task`, `project role default`, `global role default`, or `harness default`.

## Required User-Facing Tooling

Implement a safe configuration tool or command, e.g. `takomi_config_routing`, with:

- `scope: "global" | "project"`
- `defaultProvider`
- `approvedModels`
- role default updates
- a preview that shows the before/after resolved routing matrix
- a dry-run resolution for a specified agent/task
- validation against Pi’s available/enabled model registry
- explicit confirmation before writing settings

Example interaction goal:

```text
User: “For this project, use OpenAI Codex; do not use OAuth Router.”
Takomi: Shows proposed .pi/settings.json overlay and resolved role table.
User: Confirms.
Takomi: Writes only the project-local override and confirms it will not affect other repositories.
```

Do not force users to edit Markdown or JSON manually for common configuration changes.

## Board Artifact Ownership

### Ownership rule

- `master_plan.md` is human-authored and canonical.
- `.pi/takomi/orchestrator/<sessionId>.json` is machine-owned state.
- `Orchestrator_Summary.md` is machine-owned operational summary.
- Task packets may be machine-generated initially but must preserve authored content when moving status folders.

### Safe `masterPlanMarkdown` behavior

Keep `masterPlanMarkdown` only for compatibility during a transition. Apply this matrix:

| Existing master plan | Incoming `masterPlanMarkdown` | Required behavior |
| --- | --- | --- |
| Missing | Present | Write it once and record board ownership. |
| Board-generated | Present | Replace it and record supplied ownership. |
| Human-authored, same bytes | Present | No-op. |
| Human-authored, different | Present | Preserve existing file; return visible warning/result. |
| Human-authored | Omitted | Preserve it. |

Never append generated content to a human master plan. Status notes belong in JSON/summary artifacts.

### Explicit destructive replacement

A future `replace_master_plan` action may exist, but it must require all of:

```json
{
  "action": "replace_master_plan",
  "sessionId": "orch-...",
  "confirmReplaceMasterPlan": true,
  "expectedCurrentSha256": "...",
  "masterPlanMarkdown": "..."
}
```

A mismatch must fail closed.

### Board state additions

Persist artifact provenance:

```json
{
  "artifacts": {
    "masterPlan": {
      "owner": "human" | "board" | "caller",
      "sha256": "...",
      "lastSeenAt": "ISO-8601"
    }
  }
}
```

The board result should state `masterPlanDisposition: written | preserved | unchanged | generated`.

## Likely Implementation Areas

- `src/pi-takomi-core/orchestration.ts`
- `.pi/agent/extensions/takomi-runtime/index.ts`
- `.pi/agent/extensions/takomi-runtime/model-routing-defaults.ts`
- `.pi/agent/extensions/takomi-runtime/routing-policy.ts`
- `.pi/agent/extensions/takomi-subagents/tool-runner.ts`
- `.pi/agent/extensions/takomi-subagents/pi-subagents-engine.ts`
- settings schema/types, tests, and tool renderers

## Tests Required

### Routing

- Project-local OpenAI Codex setting overrides global OAuth Router default.
- Explicit `openai-codex/gpt-5.6-sol` remains exact even when OAuth Router exposes the same family.
- An unhealthy explicit provider fails with a clear error and does not cross-provider fallback.
- Explicit `fallbackModels` permits only the fallback models listed.
- Resolution provenance is visible in preview and launch output.

### Board preservation

- Detailed authored plan plus short incoming summary leaves authored plan byte-for-byte unchanged.
- Board-generated plan can be replaced during bootstrap.
- Stage expansion cannot overwrite authored plan.
- Task status changes cannot alter authored plan.
- Explicit replacement succeeds only with matching confirmation/hash.

## Acceptance Criteria

- Users can configure provider/model routing globally or per project without editing installed TypeScript.
- A project-local provider override is predictable, inspectable, and reversible.
- Explicit provider-qualified task models are never silently remapped.
- Human master plans cannot be accidentally destroyed by normal board operations.
- The behavior is covered by automated regression tests and surfaced clearly in the UI/tool output.
