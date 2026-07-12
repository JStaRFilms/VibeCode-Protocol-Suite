import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { TakomiSubagentToolParams } from "./tool-runner";
import { renderNativeSubagentResult, type Details } from "./pi-subagents-internal";
import {
  clearTakomiSubagentResultHeartbeat,
  ensureTakomiSubagentResultHeartbeat,
  getTakomiSubagentHeartbeatFrame,
  type TakomiSubagentRenderContext,
} from "./result-heartbeat";

type ToolResult = AgentToolResult<Details>;

function taskList(params: TakomiSubagentToolParams): Array<{ agent: string; task: string }> {
  if (params.chain?.length) return params.chain;
  if (params.tasks?.length) return params.tasks;
  if (params.agent || params.task) return [{ agent: params.agent ?? "...", task: params.task ?? "..." }];
  return [];
}

export function renderTakomiSubagentCall(params: TakomiSubagentToolParams, theme: Theme) {
  const tasks = taskList(params);
  const mode = params.chain?.length ? "chain" : params.tasks?.length ? "parallel" : "single";
  if (tasks.length === 1) {
    return new Text(
      `${theme.fg("toolTitle", theme.bold("takomi_subagent "))}${theme.fg("accent", tasks[0]?.agent || "?")}`,
      0,
      0,
    );
  }
  return new Text(
    `${theme.fg("toolTitle", theme.bold("takomi_subagent "))}${mode} (${tasks.length})`,
    0,
    0,
  );
}

function resultText(result: ToolResult): string {
  return typeof (result as any)?.content === "string"
    ? (result as any).content
    : Array.isArray((result as any)?.content)
      ? (result as any).content.map((part: any) => part?.text ?? "").filter(Boolean).join("\n")
      : JSON.stringify((result as any)?.details ?? {}, null, 2);
}

function extractPolicyNames(text: string): string[] {
  const policyMatch = text.match(/Required policies:\n((?:- .+\n?)+)/);
  return policyMatch?.[1]
    ?.split("\n")
    .map((line) => line.replace(/^[-\s]+/, "").trim())
    .filter(Boolean) ?? [];
}

function summarizeCollapsedResult(text: string, status: string, theme: Theme): string {
  const policies = extractPolicyNames(text);
  const lineCount = text ? text.split(/\r?\n/).length : 0;
  const label = policies.length > 0
    ? `policy context loaded: ${policies.join(", ")}`
    : `${lineCount} result line${lineCount === 1 ? "" : "s"} hidden`;
  const icon = status === "failed" ? "⚠" : status === "running" ? "…" : "✓";
  const color = status === "failed" ? "warning" : status === "running" ? "accent" : "success";
  return `${theme.fg(color, `${icon} takomi_subagent ${status}`)}${theme.fg("dim", ` · ${label} (ctrl+o to expand)`)}`;
}

function isPolicyGateBlock(text: string): boolean {
  return /^Blocked\s+takomi_subagent:\s+required policy context had not been loaded yet\./m.test(text)
    && /\nRequired policies:\n/.test(text)
    && /\nLoaded policy context:\n/.test(text);
}

function renderPolicyGateBlock(text: string, expanded: boolean | undefined, theme: Theme): string {
  const policies = extractPolicyNames(text);
  const lineCount = text ? text.split(/\r?\n/).length : 0;
  const policyLabel = policies.length ? policies.join(", ") : "required policy";
  if (!expanded) {
    return [
      theme.fg("warning", "⚠ takomi_subagent blocked"),
      theme.fg("dim", `Required policy context loaded for this session: ${policyLabel}.`),
      theme.fg("dim", `Retry the original tool call. ${lineCount} policy lines hidden (ctrl+o to expand).`),
    ].join("\n");
  }
  return [
    theme.fg("warning", "⚠ takomi_subagent blocked"),
    theme.fg("dim", "Policy context was loaded and passed back to the model; retry the original call."),
    theme.fg("dim", "Press ctrl+o again to collapse."),
    "",
    text,
  ].join("\n");
}

function recentOutputLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(-3);
  if (typeof value === "string") return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-3);
  return [];
}

function normalizeLiveStatus(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === "complete") return "completed";
  if (value === "in-progress") return "running";
  if (value === "timed-out") return "failed";
  return value;
}

function rawLiveStatus(row: any): string {
  const explicit = normalizeLiveStatus(
    typeof row?.progress?.status === "string" ? row.progress.status
      : typeof row?.status === "string" ? row.status
        : undefined,
  );
  if (explicit) return explicit;

  const exitCode = typeof row?.exitCode === "number" ? row.exitCode
    : typeof row?.code === "number" ? row.code
      : undefined;
  if (exitCode === 0) return "completed";
  if (exitCode === undefined || exitCode === null || exitCode === -1) return "running";
  return "failed";
}

function isLiveTerminalStatus(status: string): boolean {
  return ["completed", "failed", "blocked", "detached", "paused"].includes(status);
}

function displayLiveStatus(status: string, allRowsTerminal: boolean): string {
  // Native pi-subagents can emit one last partial update after the child process
  // reaches exitCode 0 but before the takomi_subagent tool result has actually
  // settled. In that window the tool card is still partial/running, so showing a
  // child as "completed" is misleading. Call it finalizing until Pi renders the
  // real final result.
  if (allRowsTerminal && status === "completed") return "finalizing";
  return status;
}

function livePartialText(result: ToolResult, theme: Theme): string {
  const details = (result as any)?.details ?? {};
  const results = Array.isArray(details.results) ? details.results : [];
  const progress = Array.isArray(details.progress) ? details.progress : [];
  const rows = results.length ? results : progress;
  const rawStatuses = rows.map(rawLiveStatus);
  const allRowsTerminal = rows.length > 0 && rawStatuses.every(isLiveTerminalStatus);
  const titleStatus = allRowsTerminal ? "finalizing" : "running";
  const lines = [
    theme.fg("toolTitle", theme.bold(`takomi_subagent ${titleStatus}`)),
    theme.fg("dim", "Live detail is bounded while streaming so manual scroll/ctrl+o does not jump on every token."),
  ];

  if (!rows.length) {
    const text = resultText(result).split(/\r?\n/).find((line) => line.trim())?.trim();
    lines.push(theme.fg("dim", text || "Waiting for subagent progress…"));
    return lines.join("\n");
  }

  rows.slice(0, 6).forEach((row: any, index: number) => {
    const status = displayLiveStatus(rawStatuses[index] ?? rawLiveStatus(row), allRowsTerminal);
    const agent = row.agent ?? `task ${index + 1}`;
    const task = String(row.task ?? "").replace(/\s+/g, " ").trim();
    const currentTool = row.currentTool ?? row.progress?.currentTool;
    const tokens = row.tokens ?? row.progress?.tokens ?? row.usage?.output;
    const tail = recentOutputLines(row.recentOutput ?? row.progress?.recentOutput ?? row.finalOutput ?? row.output);
    lines.push(theme.fg("accent", `${index + 1}. ${agent} ${theme.fg("dim", `[${status}]`)}`));
    if (task) lines.push(theme.fg("dim", `   ${task.slice(0, 140)}${task.length > 140 ? "…" : ""}`));
    if (currentTool || tokens) lines.push(theme.fg("muted", `   ${[currentTool ? `tool:${currentTool}` : "", tokens ? `tokens:${tokens}` : ""].filter(Boolean).join(" | ")}`));
    for (const line of tail) lines.push(theme.fg("dim", `   › ${line.slice(0, 160)}${line.length > 160 ? "…" : ""}`));
  });
  if (rows.length > 6) lines.push(theme.fg("muted", `… ${rows.length - 6} more running item${rows.length - 6 === 1 ? "" : "s"}`));
  lines.push(theme.fg("muted", "Final output will use the normal expandable native subagent renderer."));
  return lines.join("\n");
}

export function renderTakomiSubagentResult(result: ToolResult, options: { expanded?: boolean; isPartial?: boolean }, theme: Theme, context: TakomiSubagentRenderContext & { isError?: boolean }): any {
  if (options.isPartial) ensureTakomiSubagentResultHeartbeat(context);
  else clearTakomiSubagentResultHeartbeat(context);

  const status = ((result as any)?.isError || context?.isError) ? "failed" : options.isPartial ? "running" : "completed";
  const text = resultText(result);

  if (isPolicyGateBlock(text)) {
    return new Text(renderPolicyGateBlock(text, options.expanded, theme), 0, 0);
  }

  const native = renderNativeSubagentResult(result, options, theme, getTakomiSubagentHeartbeatFrame(context));
  if (options.isPartial && native) return native;

  if (options.isPartial) {
    if (options.expanded) return new Text(livePartialText(result, theme), 0, 0);
    return new Text(summarizeCollapsedResult(text, status, theme), 0, 0);
  }

  if (native) return native;

  if (!options.expanded) {
    return new Text(summarizeCollapsedResult(text, status, theme), 0, 0);
  }
  return new Text(`${theme.fg("toolTitle", theme.bold(`takomi_subagent ${status}`))}\n${text || "No result content."}`, 0, 0);
}
