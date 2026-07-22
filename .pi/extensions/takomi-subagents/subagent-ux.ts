import { visibleWidth } from "@earendil-works/pi-tui";

export type TakomiUxChecklistItem = {
  id: string;
  index: number;
  text: string;
  done: boolean;
  stateSource: "input" | "agent-reported";
};

export type TakomiUxTask = {
  agent: string;
  task: string;
  checklist: TakomiUxChecklistItem[];
};

const CHECKBOX_LINE = /^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/;
const ACCEPTANCE_BLOCK = /```acceptance-report\s*[\s\S]*?```/gi;
const OSC_SEQUENCE = /\x1b\][\s\S]*?(?:\x07|\x1b\\|$)/g;
const CSI_SEQUENCE = /(?:\x1b\[|\x9b)[0-?]*[ -\/]*[@-~]/g;
const ESC_SEQUENCE = /\x1b(?:[()][0-2A-Z0-9]|[=>]|[ -\/]*[@-~]?)/g;
const UNSAFE_CONTROLS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Remove terminal control sequences before untrusted values reach Text/Markdown. */
export function sanitizeUntrustedText(value: string): string {
  return value
    .replace(OSC_SEQUENCE, "")
    .replace(CSI_SEQUENCE, "")
    .replace(ESC_SEQUENCE, "")
    .replace(UNSAFE_CONTROLS, "");
}

/** Sanitize string leaves while retaining native result shape and Markdown syntax. */
export function sanitizeUntrustedValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value === "string") return sanitizeUntrustedText(value) as T;
  if (!value || typeof value !== "object") return value;
  if (seen.has(value as object)) return seen.get(value as object) as T;
  const output: any = Array.isArray(value) ? [] : {};
  seen.set(value as object, output);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = sanitizeUntrustedValue(child, seen);
  }
  return output as T;
}

export function createTakomiUxTasks(
  tasks: Array<{ agent: string; task: string; checklist?: Array<string | { text: string; done?: boolean }> }>,
): TakomiUxTask[] {
  return tasks.map((task, taskIndex) => ({
    agent: task.agent,
    task: task.task,
    checklist: (task.checklist ?? []).map((item, index) => ({
      id: `task-${taskIndex + 1}-item-${index + 1}`,
      index,
      text: typeof item === "string" ? item : item.text,
      done: typeof item === "string" ? false : item.done === true,
      stateSource: "input",
    })),
  }));
}

export function withTakomiUxDetails(details: unknown, tasks: TakomiUxTask[]): Record<string, unknown> {
  const base = details && typeof details === "object" && !Array.isArray(details)
    ? details as Record<string, unknown>
    : {};
  return { ...base, takomiUx: { tasks } };
}

function textParts(content: unknown): string[] {
  if (typeof content === "string") return content.trim() ? [content] : [];
  if (!Array.isArray(content)) return [];
  return content
    .filter((part): part is { type: "text"; text: string } => (
      Boolean(part) && typeof part === "object" && (part as any).type === "text" && typeof (part as any).text === "string"
    ))
    .map((part) => part.text)
    .filter((text) => text.trim().length > 0);
}

/** Only explicit, visible assistant text is eligible for compact narrative. */
export function explicitAssistantTexts(result: any): string[] {
  if (!Array.isArray(result?.messages)) return [];
  return result.messages
    .filter((message: any) => message?.role === "assistant")
    .flatMap((message: any) => textParts(message.content));
}

/**
 * Markdown boxes are not structured truth. Exact, unambiguous self-reports may
 * update a uniquely-labelled input item and are retained as agent-reported.
 */
export function resolvedChecklist(items: TakomiUxChecklistItem[], assistantTexts: string[]): TakomiUxChecklistItem[] {
  const states = items.map((item) => ({ ...item }));
  const sourceCounts = new Map<string, number>();
  for (const item of items) sourceCounts.set(item.text, (sourceCounts.get(item.text) ?? 0) + 1);

  for (const text of assistantTexts) {
    const reports = text.split(/\r?\n/).map((line) => line.match(CHECKBOX_LINE)).filter(Boolean) as RegExpMatchArray[];
    const reportCounts = new Map<string, number>();
    for (const report of reports) {
      const label = report[2] ?? "";
      reportCounts.set(label, (reportCounts.get(label) ?? 0) + 1);
    }
    for (const report of reports) {
      const label = report[2] ?? "";
      if (sourceCounts.get(label) !== 1 || reportCounts.get(label) !== 1) continue;
      const item = states.find((candidate) => candidate.text === label);
      if (!item) continue;
      item.done = (report[1] ?? "").toLowerCase() === "x";
      item.stateSource = "agent-reported";
    }
  }
  return states;
}

function cleanNarrative(value: string): string {
  return sanitizeUntrustedText(value)
    .replace(ACCEPTANCE_BLOCK, "")
    .replace(/\r/g, "")
    .trim();
}

function meaningfulLines(value: string): string[] {
  return cleanNarrative(value)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function clipVisibleLine(line: string, maxColumns: number): string {
  const safe = sanitizeUntrustedText(line);
  if (visibleWidth(safe) <= maxColumns) return safe;
  const target = Math.max(0, maxColumns - 1);
  let output = "";
  let width = 0;
  for (const { segment } of segmenter.segment(safe)) {
    const nextWidth = visibleWidth(segment);
    if (width + nextWidth > target) break;
    output += segment;
    width += nextWidth;
  }
  return `${output}…`;
}

export function boundNarrative(
  value: string,
  options: { maxLines: number; maxColumns: number; from?: "start" | "end" },
): { lines: string[]; truncated: boolean } {
  const source = meaningfulLines(value);
  const selected = options.from === "start" ? source.slice(0, options.maxLines) : source.slice(-options.maxLines);
  const clipped = selected.map((line) => clipVisibleLine(line, options.maxColumns));
  return {
    lines: clipped,
    truncated: source.length > selected.length || selected.some((line, index) => line !== clipped[index]),
  };
}

export function finalAnswer(result: any): string {
  if (typeof result?.finalOutput === "string" && result.finalOutput.trim()) return cleanNarrative(result.finalOutput);
  return cleanNarrative(explicitAssistantTexts(result).at(-1) ?? "");
}
