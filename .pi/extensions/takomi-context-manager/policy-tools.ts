import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ContextManagerState } from "./state";
import { syncReportLedger } from "./state";
import { renderPolicies, renderPolicyManifest } from "./policy-registry";
import { persistReportSnapshot, restoreReportFromSession } from "./session-state";
import { renderCompactCard, renderExpandedMarkdown, renderToolCall, resultText } from "./tool-renderers";
import { normalizeName } from "./skill-registry";

function requestedPolicies(state: ContextManagerState, names: string[] | undefined): string[] {
  return names?.length ? names : [...state.policies.values()].map((policy) => policy.name).sort((a, b) => a.localeCompare(b, "en"));
}

function missingPolicies(state: ContextManagerState, names: string[]): string[] {
  return names.filter((name) => !state.policies.has(normalizeName(name)));
}

export function registerPolicyTools(pi: ExtensionAPI, state: ContextManagerState): void {
  pi.registerTool({
    name: "policy_manifest",
    label: "Policy Manifest",
    description: "Return descriptions for available context policy packs without loading full policy content.",
    promptSnippet: "Show available context policy pack descriptions",
    parameters: Type.Object({ policies: Type.Optional(Type.Array(Type.String({ description: "Policy name to inspect" }))) }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.policyManifest += 1;
      persistReportSnapshot(pi, state, "policy_manifest");
      const requested = requestedPolicies(state, params.policies);
      const missing = missingPolicies(state, requested);
      return { content: [{ type: "text", text: renderPolicyManifest(state.policies, params.policies ?? []) }], details: { requested, found: requested.length - missing.length, missing } };
    },
    renderCall(args, theme) {
      return renderToolCall("policy_manifest", args.policies?.length ? `${args.policies.length} requested` : "all policies", theme);
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details as { requested?: string[]; found?: number; missing?: string[] } | undefined;
      const requested = details?.requested ?? [];
      const found = details?.found ?? 0;
      const missing = details?.missing ?? [];
      const status = missing.length ? "warning" : requested.length ? "success" : "pending";
      const summary = missing.length ? `${found} available · ${missing.length} unavailable` : requested.length ? `${found} policies available` : "no policies discovered";
      const metadata = missing.length ? `Missing: ${missing.join(", ")}` : `${requested.length} requested`;
      if (!expanded) return renderCompactCard({ status, title: "Policy manifest", summary, metadata }, theme);
      return renderExpandedMarkdown({ status, title: "Policy manifest", summary, metadata: [metadata], markdown: resultText(result) }, theme);
    },
  });

  pi.registerTool({
    name: "policy_load",
    label: "Policy Load",
    description: "Load one or more context policy packs required before sensitive tools such as takomi_subagent.",
    promptSnippet: "Load policy packs required before sensitive tool calls",
    parameters: Type.Object({ policies: Type.Array(Type.String({ description: "Policy pack name to load" })) }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.policyLoad += 1;
      const text = renderPolicies(state.policies, state.loadedPolicies, params.policies);
      syncReportLedger(state);
      persistReportSnapshot(pi, state, "policy_load");
      const missing = missingPolicies(state, params.policies);
      return {
        content: [{ type: "text", text }],
        details: {
          requested: params.policies,
          loadedPolicies: [...state.loadedPolicies].sort(),
          loadedCount: params.policies.length - missing.length,
          missing,
        },
      };
    },
    renderCall(args, theme) {
      return renderToolCall("policy_load", `${args.policies.length} requested`, theme);
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details as { requested?: string[]; loadedCount?: number; missing?: string[] } | undefined;
      const requested = details?.requested ?? [];
      const loadedCount = details?.loadedCount ?? 0;
      const missing = details?.missing ?? [];
      const status = missing.length || requested.length === 0 ? "warning" : "success";
      const summary = requested.length === 0
        ? "no policies requested"
        : missing.length ? `${loadedCount} loaded · ${missing.length} unavailable` : `${loadedCount} policies loaded`;
      const metadata = missing.length ? `Missing: ${missing.join(", ")}` : `${requested.length} requested`;
      if (!expanded) return renderCompactCard({ status, title: "Policy load", summary, metadata }, theme);
      return renderExpandedMarkdown({ status, title: "Policy load", summary, metadata: [metadata], markdown: resultText(result) }, theme);
    },
  });
}
