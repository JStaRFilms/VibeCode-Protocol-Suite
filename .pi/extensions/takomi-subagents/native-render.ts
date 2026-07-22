import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text, type Component } from "@earendil-works/pi-tui";
import type { TakomiSubagentToolParams } from "./tool-runner";
import { renderNativeSubagentResult, type Details } from "./pi-subagents-internal";
import {
  boundNarrative,
  explicitAssistantTexts,
  finalAnswer,
  resolvedChecklist,
  sanitizeUntrustedText,
  sanitizeUntrustedValue,
  type TakomiUxTask,
} from "./subagent-ux";
import {
  clearTakomiSubagentResultHeartbeat,
  ensureTakomiSubagentResultHeartbeat,
  getTakomiSubagentHeartbeatFrame,
  type TakomiSubagentRenderContext,
} from "./result-heartbeat";

type ToolResult = AgentToolResult<Details>;
const FALLBACK_RENDER_WIDTH = 80;
const COMPACT_CUSTOM_LINE_BUDGET = 3;
const EXPANDED_CUSTOM_LINE_BUDGET = 2;
const COMPACT_NARRATIVE_LINE_BUDGET = 2;
const NARRATIVE_PREFIX = "  ↳ ";

class WidthAwareLines implements Component {
  constructor(private readonly buildLines: (width: number) => string[]) {}
  render(width: number): string[] {
    const available = Number.isFinite(width) && width > 0 ? Math.floor(width) : FALLBACK_RENDER_WIDTH;
    return this.buildLines(available);
  }
  invalidate(): void {}
}

function taskList(params: TakomiSubagentToolParams): Array<{ agent: string; task: string }> {
  if (params.chain?.length) return params.chain;
  if (params.tasks?.length) return params.tasks;
  if (params.agent || params.task) return [{ agent: params.agent ?? "...", task: params.task ?? "..." }];
  return [];
}

export function renderTakomiSubagentCall(params: TakomiSubagentToolParams, theme: Theme) {
  const safeParams = sanitizeUntrustedValue(params);
  const tasks = taskList(safeParams);
  const mode = safeParams.chain?.length ? "chain" : safeParams.tasks?.length ? "parallel" : "single";
  if (tasks.length === 1) {
    return new Text(`${theme.fg("toolTitle", theme.bold("takomi_subagent "))}${theme.fg("accent", tasks[0]?.agent || "?")}`, 0, 0);
  }
  return new Text(`${theme.fg("toolTitle", theme.bold("takomi_subagent "))}${mode} (${tasks.length})`, 0, 0);
}

function resultText(result: ToolResult): string {
  const text = typeof (result as any)?.content === "string"
    ? (result as any).content
    : Array.isArray((result as any)?.content)
      ? (result as any).content.map((part: any) => part?.text ?? "").filter(Boolean).join("\n")
      : JSON.stringify((result as any)?.details ?? {}, null, 2);
  return sanitizeUntrustedText(text);
}

function extractPolicyNames(text: string): string[] {
  const policyMatch = text.match(/Required policies:\n((?:- .+\n?)+)/);
  return policyMatch?.[1]?.split("\n").map((line) => line.replace(/^[-\s]+/, "").trim()).filter(Boolean) ?? [];
}

function isPolicyGateBlock(text: string): boolean {
  return /^Blocked\s+takomi_subagent:\s+required policy context had not been loaded yet\./m.test(text)
    && /\nRequired policies:\n/.test(text)
    && /\nLoaded policy context:\n/.test(text);
}

function renderPolicyGateBlock(text: string, expanded: boolean | undefined, theme: Theme): string {
  const safeText = sanitizeUntrustedText(text);
  const policies = extractPolicyNames(safeText);
  const policyLabel = policies.length ? policies.join(", ") : "required policy";
  if (!expanded) {
    return [
      theme.fg("warning", "⚠ takomi_subagent blocked"),
      theme.fg("dim", `Required policy context loaded for this session: ${policyLabel}.`),
      theme.fg("dim", "Retry the original tool call. Ctrl+O shows the complete policy detail."),
    ].join("\n");
  }
  return [
    theme.fg("warning", "⚠ takomi_subagent blocked"),
    theme.fg("dim", "Policy context was loaded and passed back to the model; retry the original call."),
    "",
    safeText,
  ].join("\n");
}

function uxTasks(details: any): TakomiUxTask[] {
  return Array.isArray(details?.takomiUx?.tasks) ? details.takomiUx.tasks : [];
}

function taskFor(tasks: TakomiUxTask[], row: any, index: number): TakomiUxTask {
  return tasks[index] ?? { agent: row?.agent ?? `task ${index + 1}`, task: row?.task ?? "", checklist: [] };
}

function checklistFor(task: TakomiUxTask, row: any): ReturnType<typeof resolvedChecklist> {
  const texts = explicitAssistantTexts(row);
  if (typeof row?.finalOutput === "string") texts.push(row.finalOutput);
  return resolvedChecklist(task.checklist, texts);
}

function normalizedLine(value: string): string {
  return sanitizeUntrustedText(value).replace(/\s+/g, " ").trim();
}

function nativePreview(row: any): string {
  const output = typeof row?.truncation?.text === "string" && row.truncation.text.trim()
    ? row.truncation.text
    : finalAnswer(row);
  return output.split(/\r?\n/).find((line: string) => line.trim())?.trim() ?? "";
}

function compactNarratives(rows: any[], isPartial: boolean): string[] {
  const narratives: string[] = [];
  for (const row of rows) {
    const source = isPartial ? explicitAssistantTexts(row).at(-1) ?? "" : finalAnswer(row);
    const lines = source.split(/\r?\n/)
      .filter((line) => !/^\s*[-*+]\s+\[[ xX]\]\s+/.test(line))
      .map(normalizedLine)
      .filter(Boolean);
    // Native compact only previews successful single results. Acceptance rejection
    // changes exitCode to non-zero, so keep the first final line in that case.
    if (!isPartial && rows.length === 1 && row?.exitCode === 0 && lines.length && normalizedLine(nativePreview(row)) === lines[0]) lines.shift();
    for (const line of lines) {
      if (narratives.some((existing) => normalizedLine(existing) === line)) continue;
      narratives.push(line);
      if (narratives.length >= COMPACT_NARRATIVE_LINE_BUDGET) return narratives;
    }
  }
  return narratives;
}

function checklistSummary(rows: any[], tasks: TakomiUxTask[]): { summary: string; expanded: string } | undefined {
  const checklists = rows.map((row, index) => checklistFor(taskFor(tasks, row, index), row));
  const items = checklists.flat();
  if (!items.length) return undefined;
  const done = items.filter((item) => item.done).length;
  const reported = items.filter((item) => item.done && item.stateSource === "agent-reported").length;
  const summary = `checklist ${done}/${items.length} complete${reported ? ` · ${reported} agent-reported` : ""}`;
  if (rows.length !== 1) return { summary, expanded: `Checklist: ${done}/${items.length} complete${reported ? ` (${reported} agent-reported)` : ""}` };
  const labels = items.map((item) => `[${item.done ? "x" : " "}] ${item.text}`);
  return { summary, expanded: `Checklist: ${labels.join(" · ")}` };
}

function fallbackSummary(rows: any[]): string | undefined {
  const states = rows.map((row) => row?.takomiDetachedOutput)
    .filter((value) => value && value.fallbackState !== "not-needed");
  if (!states.length) return undefined;
  const first = states[0];
  return `output ${first.source} fallback: ${first.fallbackState}`;
}

function compactAddition(details: any, isPartial: boolean, theme: Theme): Component | undefined {
  const rows = Array.isArray(details?.results) ? details.results : [];
  if (!rows.length) return undefined;
  const tasks = uxTasks(details);
  const narratives = compactNarratives(rows, isPartial);
  const checklist = checklistSummary(rows, tasks);
  const checklistProvenance = details?.takomiDetached?.checklistProvenance === "unavailable-after-restart"
    ? "checklist provenance unavailable after restart"
    : checklist?.summary;
  const provenance = [checklistProvenance, fallbackSummary(rows)].filter((value): value is string => Boolean(value));
  if (!narratives.length && !provenance.length) return undefined;

  return new WidthAwareLines((width) => {
    const lines: string[] = [];
    const narrativeWidth = Math.max(1, width - NARRATIVE_PREFIX.length);
    for (const narrative of narratives) {
      const bounded = boundNarrative(narrative, { maxLines: 1, maxColumns: narrativeWidth, from: "start" });
      if (bounded.lines[0]) lines.push(theme.fg("dim", `${NARRATIVE_PREFIX}${bounded.lines[0]}`));
    }
    for (const item of provenance) {
      if (lines.length >= COMPACT_CUSTOM_LINE_BUDGET) break;
      const bounded = boundNarrative(item, { maxLines: 1, maxColumns: Math.max(1, width - 2), from: "start" });
      if (bounded.lines[0]) lines.push(theme.fg("muted", `  ${bounded.lines[0]}`));
    }
    return lines.slice(0, COMPACT_CUSTOM_LINE_BUDGET);
  });
}

function expandedAddition(details: any, theme: Theme): Component | undefined {
  const rows = Array.isArray(details?.results) ? details.results : [];
  if (!rows.length) return undefined;
  const checklist = checklistSummary(rows, uxTasks(details));
  const checklistProvenance = details?.takomiDetached?.checklistProvenance === "unavailable-after-restart"
    ? "Checklist provenance unavailable after restart"
    : checklist ? checklist.summary.replace(/^checklist/, "Checklist provenance:") : undefined;
  const provenance = [checklistProvenance, fallbackSummary(rows)]
    .filter(Boolean)
    .join("\n");
  if (!provenance) return undefined;

  return new WidthAwareLines((width) => boundNarrative(provenance, {
    maxLines: EXPANDED_CUSTOM_LINE_BUDGET,
    maxColumns: width,
    from: "start",
  }).lines.slice(0, EXPANDED_CUSTOM_LINE_BUDGET).map((line) => theme.fg("dim", line)));
}

function compose(
  native: Component | undefined,
  addition: Component | undefined,
  fallback: Component,
  errorNotice?: Component,
): Component {
  if (!native && !addition && !errorNotice) return fallback;
  const container = new Container();
  if (errorNotice) container.addChild(errorNotice);
  if (errorNotice && (native || addition)) container.addChild(new Spacer(1));
  if (native) container.addChild(native);
  if (native && addition) container.addChild(new Spacer(1));
  if (addition) container.addChild(addition);
  return container;
}

export function renderTakomiSubagentResult(
  result: ToolResult,
  options: { expanded?: boolean; isPartial?: boolean },
  theme: Theme,
  context: TakomiSubagentRenderContext & { isError?: boolean },
): any {
  if (options.isPartial) ensureTakomiSubagentResultHeartbeat(context);
  else clearTakomiSubagentResultHeartbeat(context);

  const safeResult = sanitizeUntrustedValue(result);
  const text = resultText(safeResult);
  if (isPolicyGateBlock(text)) return new Text(renderPolicyGateBlock(text, options.expanded, theme), 0, 0);

  const frame = getTakomiSubagentHeartbeatFrame(context);
  const native = renderNativeSubagentResult(
    safeResult,
    { expanded: options.expanded === true, isPartial: options.isPartial === true },
    theme,
    frame,
  ) as Component | undefined;
  const details: any = (safeResult as any)?.details ?? {};
  const addition = options.expanded
    ? expandedAddition(details, theme)
    : compactAddition(details, options.isPartial === true, theme);
  const isError = Boolean((safeResult as any)?.isError || context?.isError);
  const errorNotice = isError ? new Text(theme.fg("error", "takomi_subagent failed"), 0, 0) : undefined;
  const fallback = new Text(`${isError ? `${theme.fg("error", "failed")}\n` : ""}${text || "No result content."}`, 0, 0);
  return compose(native, addition, fallback, errorNotice);
}
