import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ContextManagerState } from "./state";
import { recordBlocked } from "./state";
import { isTakomiModelApproved, loadTakomiModelRoutingSnapshot } from "../takomi-runtime/model-routing-defaults";
import { persistReportSnapshot } from "./session-state";
import { sanitizePresentation } from "./tool-renderers";

type ModelPolicySnapshot = {
  approvedModels: string[];
  preferredModels: string[];
  sourceFiles: string[];
  policyConflicts?: string[];
};

async function loadSnapshot(cwd: string): Promise<ModelPolicySnapshot> {
  const snapshot = await loadTakomiModelRoutingSnapshot(cwd);
  return {
    approvedModels: snapshot.approvedModels,
    preferredModels: snapshot.preferredModels,
    sourceFiles: snapshot.sourceFiles,
    policyConflicts: snapshot.policyConflicts,
  };
}

function collectRequestedModelRefs(input: unknown): Array<{ holder: Record<string, unknown>; key: string; value: string; index?: number }> {
  const refs: Array<{ holder: Record<string, unknown>; key: string; value: string; index?: number }> = [];
  function visit(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of ["model", "preferredModel"]) {
      if (typeof record[key] === "string") refs.push({ holder: record, key, value: record[key] });
    }
    if (Array.isArray(record.fallbackModels)) {
      const fallbackModels = record.fallbackModels.filter((item): item is string => typeof item === "string");
      record.fallbackModels = fallbackModels;
      fallbackModels.forEach((value: string, index: number) => refs.push({ holder: record, key: "fallbackModels", value, index }));
    }
    for (const key of ["tasks", "chain"]) visit(record[key]);
  }
  visit(input);
  return refs;
}

function setModelRef(ref: { holder: Record<string, unknown>; key: string; value: string; index?: number }, value: string): void {
  if (ref.key === "fallbackModels" && typeof ref.index === "number" && Array.isArray(ref.holder.fallbackModels)) {
    ref.holder.fallbackModels[ref.index] = value;
    return;
  }
  ref.holder[ref.key] = value;
}

function isModelFailure(text: string): boolean {
  return /(unknown provider|provider.*not.*found|model.*not.*found|model.*unavailable|invalid model|unsupported model|auth|unauthorized|forbidden|rate limit|429|quota|context window|maximum context)/i.test(text);
}

function renderPolicyViolation(requested: string, approved: string[]): string {
  return [
    "Blocked by Takomi routing policy.",
    "",
    "Requested model:",
    requested,
    "",
    "Allowed/preferred models include:",
    ...(approved.length ? approved.map((model) => `- ${model}`) : ["- none discovered; run /takomi routing <policy text> first"]),
    "",
    "The subagent did not run. Ask the user how to proceed or retry with an approved model.",
  ].join("\n");
}

type RecoveryChoice =
  | { action: "retry"; model: string }
  | { action: "stop" };

type RecoveryOptions = {
  options: string[];
  retryModels: Map<string, string>;
};

/**
 * Keep policy model IDs raw for selection and mutation, while passing only
 * presentation-safe labels to the terminal UI. Disambiguate labels that become
 * identical after sanitization so a selected label still maps to one raw ID.
 */
function recoveryOptions(approved: string[]): RecoveryOptions {
  const retryModels = new Map<string, string>();
  const options: string[] = [];
  for (const model of approved) {
    const baseLabel = `Retry with ${sanitizePresentation(model)}`;
    let label = baseLabel;
    let duplicate = 2;
    while (retryModels.has(label)) label = `${baseLabel} (${duplicate++})`;
    retryModels.set(label, model);
    options.push(label);
  }
  options.push("Stop and let me send a new prompt");
  return { options, retryModels };
}

async function askForInvalidModelRecovery(ctx: { ui: { select(title: string, options: string[]): Promise<string | undefined>; notify(message: string, level?: string): void }; abort?: () => void }, requested: string, approved: string[]): Promise<RecoveryChoice> {
  if (approved.length === 0) return { action: "stop" };
  const recovery = recoveryOptions(approved);
  const choice = await ctx.ui.select(
    sanitizePresentation(`takomi_subagent requested a model outside your routing policy: ${requested}`),
    recovery.options,
  );
  const model = choice ? recovery.retryModels.get(choice) : undefined;
  return model ? { action: "retry", model } : { action: "stop" };
}

export function installModelPolicyGate(pi: ExtensionAPI, state: ContextManagerState): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "takomi_subagent") return;
    const snapshot = await loadSnapshot(ctx.cwd);
    const approved = snapshot.approvedModels;
    if (snapshot.policyConflicts?.length) {
      const reason = ["Blocked by conflicting Takomi routing guidance and executable settings.", "", ...snapshot.policyConflicts.map((item) => `- ${item}`)].join("\n");
      recordBlocked(state, event.toolName, reason);
      persistReportSnapshot(pi, state, "model-policy-conflict");
      return { block: true, reason };
    }
    if (approved.length === 0) return;

    const refs = collectRequestedModelRefs(event.input);
    const corrections: Array<{ from: string; to: string; recovery?: string }> = [];
    for (const ref of refs) {
      if (isTakomiModelApproved(ref.value, approved)) continue;
      const recovery = await askForInvalidModelRecovery(ctx, ref.value, approved);
      if (recovery.action === "retry") {
        setModelRef(ref, recovery.model);
        corrections.push({ from: ref.value, to: recovery.model, recovery: "user selected recovery" });
        continue;
      }
      const reason = [
        renderPolicyViolation(ref.value, approved),
        "",
        "Human selected stop. The agent turn has been aborted; wait for the user's next prompt.",
      ].join("\n");
      recordBlocked(state, event.toolName, reason);
      persistReportSnapshot(pi, state, "model-policy-gate-block");
      ctx.abort?.();
      return { block: true, reason };
    }

    if (corrections.length > 0) {
      const timestamp = new Date().toISOString();
      state.report.timestamp = timestamp;
      state.report.modelRoutingCorrections.push(...corrections.map((correction) => ({
        toolName: event.toolName,
        from: correction.from,
        to: correction.to,
        recovery: correction.recovery,
        timestamp,
      })));
      persistReportSnapshot(pi, state, "model-policy-correction");
      const notification = `Takomi model routing changed only after explicit user selection:\n- ${corrections.map((correction) => `${sanitizePresentation(correction.from)} -> ${sanitizePresentation(correction.to)}${correction.recovery ? ` (${sanitizePresentation(correction.recovery)})` : ""}`).join("\n- ")}`;
      ctx.ui.notify(notification, "warning");
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "takomi_subagent" || !event.isError) return;
    const content = JSON.stringify(event.content ?? "");
    if (!isModelFailure(content)) return;

    const snapshot = await loadSnapshot(ctx.cwd);
    const recovery = recoveryOptions(snapshot.approvedModels);
    const choice = await ctx.ui.select("Takomi subagent model/provider failure. How do you want to continue?", recovery.options);
    const retryModel = choice ? recovery.retryModels.get(choice) : undefined;
    const stopped = !retryModel;
    const guidance = [
      "Takomi subagent failed with a model/provider-related error.",
      "",
      `Policy source: ${snapshot.sourceFiles.join(", ") || "not found"}`,
      "Policy-approved models:",
      ...(snapshot.approvedModels.length ? snapshot.approvedModels.map((model) => `- ${model}`) : ["- none discovered"]),
      "",
      stopped
        ? "Human selected stop/no retry. The agent turn has been aborted; wait for the user's next prompt."
        : `User selected retry with ${retryModel}. Retry takomi_subagent with model ${retryModel}.`,
    ].join("\n");
    if (stopped) ctx.abort?.();
    return { content: [{ type: "text", text: guidance }], isError: true, terminate: stopped };
  });
}
