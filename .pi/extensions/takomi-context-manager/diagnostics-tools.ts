import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { ContextManagerState } from "./state";
import { contextReportPresentation, renderReport, type ContextReportMode } from "./diagnostics";
import { discoverSkillsFromFilesystem, mergeSkills } from "./skill-registry";
import { persistReportSnapshot, restoreReportFromSession } from "./session-state";
import { renderCompactCard, renderExpandedMarkdown, renderToolCall, resultText, sanitizePresentation } from "./tool-renderers";

export function registerDiagnostics(pi: ExtensionAPI, state: ContextManagerState): void {
  pi.registerTool({
    name: "context_report",
    label: "Context Report",
    description: "Show takomi-context-manager diagnostics. Defaults to compact summary; use mode='verbose' for full details or mode='problems' for attention-only output.",
    promptSnippet: "Show context manager diagnostics and prompt composition decisions",
    parameters: Type.Object({
      mode: Type.Optional(Type.Union([
        Type.Literal("summary"),
        Type.Literal("verbose"),
        Type.Literal("problems"),
      ], { description: "Report layout mode. Defaults to summary. Use verbose for full diagnostics or problems for attention-only output." })),
      verbose: Type.Optional(Type.Boolean({ description: "Deprecated compatibility alias for mode='verbose'." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      if (state.skills.size === 0) state.skills = mergeSkills(await discoverSkillsFromFilesystem(ctx.cwd));
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.skillCount = state.skills.size;
      state.report.toolCalls.contextReport += 1;
      persistReportSnapshot(pi, state, "context_report");
      const mode = (params.verbose ? "verbose" : params.mode ?? "summary") as ContextReportMode;
      const text = renderReport(state, mode);
      // Keep model-facing content exactly as requested. Expanded presentation
      // renders that same mode-specific report rather than silently promoting
      // summary/problems requests to verbose diagnostics.
      const presentation = contextReportPresentation(state);
      return { content: [{ type: "text", text }], details: { ...state.report, mode, presentation } };
    },
    renderCall(args, theme) {
      return renderToolCall("context_report", args.verbose ? "verbose" : args.mode ?? "summary", theme);
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details as {
        mode?: ContextReportMode;
        skillCount?: number;
        loadedByTool?: string[];
        loadedPolicies?: string[];
        presentation?: {
          status?: "success" | "warning" | "error" | "pending";
          summary?: string;
          attentionCount?: number;
        };
      } | undefined;
      const presentation = details?.presentation;
      const text = resultText(result);
      const status = presentation?.status ?? "pending";
      const summary = presentation?.summary ?? "Informational";
      const attentionCount = presentation?.attentionCount ?? 0;
      const metadata = `${details?.skillCount ?? 0} skills · ${details?.loadedPolicies?.length ?? 0} policies loaded · ${attentionCount} attention items`;
      if (!expanded) {
        return renderCompactCard({ status, title: "Context health", summary, metadata }, theme);
      }
      return renderExpandedMarkdown({
        status,
        title: "Context report",
        summary,
        metadata: [metadata, `Requested mode: ${details?.mode ?? "summary"}`],
        markdown: text,
      }, theme);
    },
  });

  pi.registerCommand("context-report", {
    description: "Show takomi-context-manager diagnostics. Optional args: summary, verbose, problems",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const modes: AutocompleteItem[] = [
        { value: "summary", label: "summary — compact health report" },
        { value: "verbose", label: "verbose — full diagnostics" },
        { value: "problems", label: "problems — only issues requiring attention" },
      ];
      const normalized = prefix.trim().toLowerCase();
      const filtered = modes.filter((mode) => mode.value.startsWith(normalized));
      return filtered.length ? filtered : null;
    },
    handler: async (args, ctx) => {
      restoreReportFromSession(state, ctx);
      if (state.skills.size === 0) state.skills = mergeSkills(await discoverSkillsFromFilesystem(ctx.cwd));
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.skillCount = state.skills.size;
      state.report.toolCalls.contextReport += 1;
      persistReportSnapshot(pi, state, "context-report-command");
      const requested = args.trim();
      const mode: ContextReportMode = requested === "verbose" || requested === "problems" || requested === "summary" ? requested : "summary";
      ctx.ui.notify(sanitizePresentation(renderReport(state, mode)), "info");
    },
  });
}
