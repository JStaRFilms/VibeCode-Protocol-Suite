import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type {
  TakomiLaunchMode,
  TakomiRole,
  TakomiWorkflowId,
  VibeLifecycleStage,
} from "../../../src/pi-takomi-core";
import { commandHelp, completions, statusText, workflowPrompt } from "./command-text";
import type { TakomiSubagentController } from "./subagent-types";
import { previewTakomiRoutingPolicy, renderRoutingPolicyPreview, resolveTakomiRoutingPolicy, type RoutingPolicyInstallScope } from "./routing-policy";
import { collectTakomiStats, renderTakomiStats } from "./takomi-stats.js";
import { discoverTakomiAgents } from "../takomi-subagents/agents";

export type TakomiRuntimeCommandState = {
  enabled: boolean;
  autoOrch: boolean;
  launchMode: TakomiLaunchMode;
  planMode: boolean;
  role: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  activeSessionId?: string;
  subagentsEnabled: boolean;
  modeSource?: "idle" | "manual" | "model" | "board";
  modeReason?: string;
};

type RegisterTakomiCommandOptions = {
  getState(): TakomiRuntimeCommandState;
  updateState(ctx: ExtensionContext, mutator: () => void, message?: string | (() => string)): Promise<void>;
  recordUserGateAutoProvenance(authorized: boolean): void;
  resetRuntime(ctx: ExtensionCommandContext): Promise<void>;
  setStageAndWorkflow(stage: VibeLifecycleStage, options?: { preserveRole?: boolean }): void;
  createPlanSession(ctx: ExtensionCommandContext, title?: string): Promise<string>;
  hasGenesisArtifacts(cwd: string): Promise<boolean>;
  subagentController: TakomiSubagentController;
};

export function registerTakomiCommands(pi: ExtensionAPI, options: RegisterTakomiCommandOptions): void {
  async function handleStage(ctx: ExtensionCommandContext, stage: VibeLifecycleStage, prompt?: string): Promise<void> {
    await options.updateState(ctx, () => {
      options.getState().enabled = true;
      options.getState().modeSource = "manual";
      options.getState().modeReason = `/${stage}`;
      options.setStageAndWorkflow(stage, { preserveRole: stage === "genesis" && options.getState().role === "orchestrator" });
      options.getState().planMode = stage !== "build";
    }, workflowPrompt(stage, prompt));
  }

  async function handleMode(ctx: ExtensionCommandContext, mode?: string): Promise<void> {
    if (mode !== "direct" && mode !== "orchestrate" && mode !== "review") {
      ctx.ui.notify("Usage: /takomi mode <direct|orchestrate|review>", "warning");
      return;
    }
    const hasGenesis = await options.hasGenesisArtifacts(ctx.cwd);
    await options.updateState(ctx, () => {
      const state = options.getState();
      state.enabled = true;
      if (mode === "direct") {
        state.autoOrch = false;
        state.planMode = false;
        state.role = "general";
        state.stage = undefined;
        state.workflow = undefined;
        state.modeSource = "idle";
        state.modeReason = undefined;
      } else if (mode === "orchestrate") {
        state.autoOrch = true;
        state.planMode = true;
        state.role = "orchestrator";
        state.stage = hasGenesis ? "build" : "genesis";
        state.workflow = hasGenesis ? "vibe-build" : "vibe-genesis";
        state.modeSource = "manual";
        state.modeReason = "/takomi mode orchestrate";
      } else {
        state.autoOrch = false;
        state.planMode = true;
        state.launchMode = "manual";
        options.recordUserGateAutoProvenance(false);
        state.role = "review";
        state.stage = undefined;
        state.workflow = undefined;
        state.modeSource = "manual";
        state.modeReason = "/takomi mode review";
      }
    }, () => `Takomi mode set to ${mode}`);
  }

  async function handleGate(ctx: ExtensionCommandContext, gate?: string): Promise<void> {
    if (gate !== "auto" && gate !== "review" && gate !== "manual") {
      ctx.ui.notify("Usage: /takomi gate <auto|review|manual>", "warning");
      return;
    }
    const auto = gate === "auto";
    await options.updateState(ctx, () => {
      const state = options.getState();
      state.enabled = true;
      state.launchMode = auto ? "auto" : "manual";
      state.autoOrch = auto;
      // This dedicated entry is the only user-gate authorization signal.
      options.recordUserGateAutoProvenance(auto);
    }, () => `Takomi execution gate set to ${auto ? "auto" : "review"}`);
  }

  async function handleRouting(ctx: ExtensionCommandContext, body?: string): Promise<void> {
    const trimmed = body?.trim() ?? "";

    const usage = [
      "Usage:",
      "/takomi routing show                 Print the full active policy",
      "/takomi routing where                Show source/path only",
      "/takomi routing <policy text>        Update the global policy",
      "/takomi routing local <policy text>  Create/update this project's override",
    ].join("\n");

    async function showRoutingHelp(): Promise<void> {
      const resolved = await resolveTakomiRoutingPolicy(ctx.cwd);
      ctx.ui.notify([
        "Takomi routing options",
        "",
        `Active source: ${resolved.source}`,
        `Active path: ${resolved.policyPath ?? "not found"}`,
        "",
        usage,
        "",
        "Resolution order: project .pi/takomi/model-routing.md → global ~/.pi/takomi/model-routing.md → bundled fallback.",
      ].join("\n"), "warning");
    }

    async function showRoutingLocation(): Promise<void> {
      const resolved = await resolveTakomiRoutingPolicy(ctx.cwd);
      ctx.ui.notify([
        "Active Takomi routing policy location",
        "",
        `Source: ${resolved.source}`,
        `Path: ${resolved.policyPath ?? "not found"}`,
        "",
        usage,
      ].join("\n"), resolved.source === "missing" ? "warning" : "info");
    }

    async function showActivePolicy(): Promise<void> {
      const resolved = await resolveTakomiRoutingPolicy(ctx.cwd);
      const text = resolved.text ?? "No Takomi routing policy found.";
      const clipped = text.length > 6000 ? `${text.slice(0, 6000)}\n\n…truncated; open the file above for the full policy.` : text;
      ctx.ui.notify([
        "Active Takomi routing policy",
        "",
        `Source: ${resolved.source}`,
        `Path: ${resolved.policyPath ?? "not found"}`,
        "",
        clipped,
        "",
        usage,
      ].join("\n"), resolved.source === "missing" ? "warning" : "info");
    }

    if (!trimmed) {
      await showRoutingHelp();
      return;
    }
    if (/^(where|path|status)$/i.test(trimmed)) {
      await showRoutingLocation();
      return;
    }
    if (/^(show|view)$/i.test(trimmed)) {
      await showActivePolicy();
      return;
    }

    if (/^(global|local|project|set)$/i.test(trimmed)) {
      ctx.ui.notify(usage, "warning");
      return;
    }

    const scopeMatch = trimmed.match(/^(global|local|project)\s+([\s\S]+)$/i);
    const scope: RoutingPolicyInstallScope = scopeMatch?.[1]?.toLowerCase() === "local" || scopeMatch?.[1]?.toLowerCase() === "project" ? "project" : "global";
    const policyText = scopeMatch?.[2] ?? trimmed.replace(/^set\s+/i, "");

    try {
      const availableModels = (() => {
        try {
          const available = (ctx as ExtensionCommandContext & { modelRegistry?: { getAvailable?: () => Array<{ provider?: string; id?: string; name?: string }> } }).modelRegistry?.getAvailable?.() ?? [];
          return available.map((model) => `${model.provider ? `${model.provider}/` : ""}${model.id ?? model.name ?? ""}`).filter(Boolean);
        } catch {
          return [];
        }
      })();
      const [preview, activePolicy] = await Promise.all([
        Promise.resolve(previewTakomiRoutingPolicy(ctx.cwd, policyText, { scope, availableModels })),
        resolveTakomiRoutingPolicy(ctx.cwd),
      ]);
      const replacementWarning = activePolicy.text && activePolicy.text.trim().length > preview.policy.trim().length * 2
        ? `WARNING: This input is much shorter than the active policy (${preview.policy.length} vs ${activePolicy.text.length} characters). It will replace the file, not merge into it. If the user referred to a full source file or prior policy, inspect and use that complete text instead.`
        : "This input replaces the selected policy file exactly; it is not merged with the active policy.";
      const reviewPrompt = [
        "Review this Takomi routing policy extraction before it is saved.",
        "",
        "Rules:",
        "- Do not invent providers or model IDs not grounded in the policy.",
        "- Providerless names are valid routing intent. Require a provider only when writing an executable model override.",
        "- Check the available Pi model registry below before asking the user whether a named model exists or what its exact ID is.",
        "- Conditional task-shape routes do not need to be forced into role-wide defaults or agentOverrides.",
        "- Valid role-wide Takomi overrides are: general, orchestrator, architect, designer, coder, reviewer. Other headings may still be policy concepts or execution routes.",
        "- Preserve the user's full authored policy. If this looks like a summary/excerpt and a richer referenced source exists, inspect that source and apply the complete intended text instead of overwriting it with the excerpt.",
        "- If the extraction is correct and safe, call takomi_apply_routing_policy with the complete intended policyText and scope below.",
        "- Ask only for unresolved provider/account choices or genuine policy ambiguity; do not ask for facts available from the registry or files.",
        "",
        "Deterministic extraction:",
        renderRoutingPolicyPreview(preview),
        "",
        replacementWarning,
        "",
        availableModels.length ? `Available Pi models:\n${availableModels.map((model) => `- ${model}`).join("\n")}` : "Available Pi models: registry unavailable; inspect it before asking the user if possible.",
        "",
        "Original policy text:",
        "```",
        preview.policy,
        "```",
        "",
        `Tool call to apply if safe: takomi_apply_routing_policy({ scope: ${JSON.stringify(scope)}, policyText: <original policy text> })`,
      ].join("\n");
      ctx.ui.notify("Takomi routing extraction prepared. Sending it to the active model for review before saving.", "info");
      pi.sendUserMessage(reviewPrompt);
    } catch (error) {
      ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    }
  }

  async function handleSubagents(ctx: ExtensionCommandContext, action?: string): Promise<void> {
    const controller = options.subagentController;
    if (action === "list" || action === "agents") {
      const agents = discoverTakomiAgents(ctx.cwd, "both");
      const lines = [
        "Takomi subagents:",
        ...(agents.length
          ? agents.map((agent) => `- ${agent.name} (${agent.source}): ${agent.description}`)
          : ["- (none discovered)"]),
      ];
      ctx.ui.notify(lines.join("\n"), agents.length ? "info" : "warning");
      return;
    }
    if (action === "on" || action === "off") {
      await options.updateState(ctx, () => {
        options.getState().subagentsEnabled = action === "on";
      }, `Takomi subagents ${action}`);
      return;
    }
    if (action === "status" || !action) {
      ctx.ui.notify(statusText(options.getState(), controller), controller.hasRuns() ? "info" : "warning");
      return;
    }
    ctx.ui.notify("Usage: /takomi subagents <list|on|off|status>", "warning");
  }

  pi.registerCommand("takomi", {
    description: "Takomi lifecycle entrypoint",
    getArgumentCompletions: completions,
    handler: async (args, ctx) => {
      const [subcommand = "", ...rest] = args.trim().split(/\s+/).filter(Boolean);
      const tail = rest.join(" ");
      if (!subcommand || subcommand === "help" || subcommand === "?" || subcommand === "commands") {
        await options.updateState(ctx, () => {
          options.getState().enabled = true;
        }, commandHelp());
        return;
      }
      if (subcommand === "genesis") return handleStage(ctx, "genesis", tail);
      if (subcommand === "design") return handleStage(ctx, "design", tail);
      if (subcommand === "build") return handleStage(ctx, "build", tail);
      if (subcommand === "plan" || subcommand === "kickoff" || subcommand === "lifecycle" || subcommand === "autoorch") {
        const summary = await options.createPlanSession(ctx, tail || undefined);
        ctx.ui.notify(summary, "info");
        return;
      }
      if (subcommand === "mode") return handleMode(ctx, rest[0]);
      if (subcommand === "gate") return handleGate(ctx, rest[0]);
      if (subcommand === "routing" || subcommand === "route" || subcommand === "models") return handleRouting(ctx, tail);
      if (subcommand === "subagents" || subcommand === "subagent") return handleSubagents(ctx, rest[0]);
      if (subcommand === "stats") {
        try {
          const view = rest[0];
          const sinceIndex = rest.findIndex((token) => token === "--since" || token === "since");
          const since = sinceIndex >= 0 ? rest[sinceIndex + 1] : undefined;
          const stats = await collectTakomiStats({ cwd: ctx.cwd, since });
          ctx.ui.notify(renderTakomiStats(stats, { limit: 8, view }), "info");
        } catch (error) {
          ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
        }
        return;
      }
      if (subcommand === "status") {
        ctx.ui.notify(statusText(options.getState(), options.subagentController), "info");
        return;
      }
      if (subcommand === "reset") return options.resetRuntime(ctx);
      ctx.ui.notify(commandHelp(), "warning");
    },
  });

  pi.registerCommand("takomi-status", {
    description: "Show Takomi lifecycle, gate, session, and subagent status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(statusText(options.getState(), options.subagentController), "info");
    },
  });

  pi.registerCommand("takomi-stats", {
    description: "Show Takomi token, model, project, session, tool, and subagent usage stats",
    getArgumentCompletions: (argumentPrefix: string) => completions(`stats ${argumentPrefix}`).map((completion) => ({
      ...completion,
      value: completion.value.replace(/^stats\s+/, ""),
    })),
    handler: async (args, ctx) => {
      try {
        const parts = args.trim().split(/\s+/).filter(Boolean);
        const view = parts[0];
        const sinceIndex = parts.findIndex((token) => token === "--since" || token === "since");
        const since = sinceIndex >= 0 ? parts[sinceIndex + 1] : undefined;
        const stats = await collectTakomiStats({ cwd: ctx.cwd, since });
        ctx.ui.notify(renderTakomiStats(stats, { limit: 8, view }), "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("takomi-reset", {
    description: "Reset Takomi runtime state to defaults",
    handler: async (_args, ctx) => {
      await options.resetRuntime(ctx);
    },
  });
}
