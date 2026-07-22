/**
 * Shared utilities for Takomi Pi extensions.
 *
 * Consolidates functions that were duplicated across
 * takomi-runtime/index.ts, takomi-runtime/ui.ts, and
 * takomi-subagents/index.ts.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

// ─── ANSI / String Utilities ────────────────────────────────────────

export function stripAnsi(value: string): string {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ");
}

export function visibleWidth(value: string): number {
  return stripAnsi(value).length;
}

export function truncateToWidth(value: string, width: number, ellipsis = "..."): string {
  const plain = stripAnsi(value);
  if (plain.length <= width) return plain;
  if (width <= ellipsis.length) return plain.slice(0, width);
  return `${plain.slice(0, width - ellipsis.length)}${ellipsis}`;
}

export function ellipsizeMiddle(value: string, max = 22): string {
  if (value.length <= max) return value;
  const left = Math.max(6, Math.floor((max - 1) / 2));
  const right = Math.max(6, max - left - 1);
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

export function firstMeaningfulLine(text?: string): string | undefined {
  if (!text) return undefined;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

export function sanitizeLogChunk(chunk: string): string[] {
  return stripAnsi(chunk)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(-8);
}

const STREAMED_LOG_PUNCTUATION = /^[,.;:!?%)\]}]+$/;
const STRUCTURED_LOG_PREFIX = /^(Tool (start|complete|failed):|Checklist\b|Model preflight\b|Requested:\b|Selected model:\b|Warning:\b|Subagent\b|Redispatch\b|Waiting for first live event)/i;

function normalizeLogLine(value: string): string {
  return stripAnsi(value).replace(/\s+/g, " ").trim();
}

function shouldMergeStreamedLog(previous: string, next: string): boolean {
  const prior = normalizeLogLine(previous);
  const incoming = normalizeLogLine(next);
  if (!prior || !incoming) return false;
  if (prior.length >= 280) return false;
  if (STRUCTURED_LOG_PREFIX.test(prior) || STRUCTURED_LOG_PREFIX.test(incoming)) return false;
  if (STREAMED_LOG_PUNCTUATION.test(incoming)) return true;
  if (incoming.includes(":")) return false;
  return /^[a-z0-9("'`\[]/.test(incoming) && incoming.length <= 40;
}

function joinStreamedLog(previous: string, next: string): string {
  const prior = normalizeLogLine(previous);
  const incoming = normalizeLogLine(next);
  if (!prior) return incoming;
  if (!incoming) return prior;
  if (STREAMED_LOG_PUNCTUATION.test(incoming) || /^[,.;:!?%)\]}]/.test(incoming)) return `${prior}${incoming}`;
  if (/^['’]/.test(incoming)) return `${prior}${incoming}`;
  if (/[([{]$/.test(prior)) return `${prior}${incoming}`;
  return `${prior} ${incoming}`;
}

export function appendLiveLogChunk(existing: string[], chunk: string, limit = 60): string[] {
  const lines = sanitizeLogChunk(chunk);
  if (!lines.length) return existing;

  const nextLogs = [...existing];
  for (const line of lines) {
    const previous = nextLogs.at(-1);
    if (previous && shouldMergeStreamedLog(previous, line)) {
      nextLogs[nextLogs.length - 1] = joinStreamedLog(previous, line);
      continue;
    }
    nextLogs.push(line);
  }

  return nextLogs.slice(-limit);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes}m`;
  }
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

export function formatFooterNumber(value: number): string {
  if (value < 1000) return `${value}`;
  return `${(value / 1000).toFixed(1)}k`;
}

export function wrapLabel(value: string, width: number): string[] {
  const plain = stripAnsi(value);
  const target = Math.max(8, width);
  const words = plain.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= target) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= target) {
      current = word;
      continue;
    }
    let remainder = word;
    while (remainder.length > target) {
      lines.push(remainder.slice(0, target));
      remainder = remainder.slice(target);
    }
    current = remainder;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [plain];
}

// ─── Checklist Utilities ────────────────────────────────────────────

export type ChecklistInput = Array<string | { text: string; done?: boolean }> | undefined;

export function formatChecklist(checklist?: Array<string | { text: string; done?: boolean }>): string {
  if (!checklist?.length) return "";
  return [
    "Checklist:",
    ...checklist.map((item) => typeof item === "string" ? `- [ ] ${item}` : `- [${item.done ? "x" : " "}] ${item.text}`),
  ].join("\n");
}

export function checklistProgress(checklist?: ChecklistInput): string | undefined {
  if (!checklist?.length) return undefined;
  const normalized = checklist.map((item) => (typeof item === "string" ? { text: item, done: false } : item));
  const done = normalized.filter((item) => item.done).length;
  return `${done}/${normalized.length}`;
}

// ─── Pi Process Invocation ──────────────────────────────────────────

export function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript) return { command: process.execPath, args: [currentScript, ...args] };
  return { command: "pi", args };
}

export async function writeTempPrompt(agentName: string, prompt: string): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `takomi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `${agentName}.md`);
  await writeFile(filePath, prompt, "utf8");
  return filePath;
}

// ─── Subagent Process Runners ───────────────────────────────────────

export type RunHooks = {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

export type JsonRunHooks = {
  onAssistantText?: (text: string) => void;
  onEventText?: (line: string) => void;
  onToolEvent?: (event: {
    type: "start" | "update" | "end";
    toolName: string;
    args?: string;
    isError?: boolean;
    summary?: string;
    invocationId?: string;
  }) => void;
  onStderr?: (chunk: string) => void;
};

const JSON_OUTPUT_TAIL_LIMIT = 64_000;

function appendCappedTail(current: string, next: string, limit = JSON_OUTPUT_TAIL_LIMIT): string {
  if (!next) return current;
  const boundedNext = next.length > limit ? next.slice(-limit) : next;
  const remaining = limit - boundedNext.length;
  if (remaining <= 0) return boundedNext;
  if (current.length <= remaining) return current + boundedNext;
  return current.slice(-remaining) + boundedNext;
}

export function extractAssistantText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is { type?: string; text?: string } => Boolean(block) && typeof block === "object")
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();
}

function normalizeAssistantOutputText(value: string): string {
  return stripAnsi(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractAssistantSnapshot(event: Record<string, unknown>, currentText: string): string | undefined {
  const type = typeof event.type === "string" ? event.type : "";

  if (type === "message_update") {
    const assistantEvent = event.assistantMessageEvent;
    if (assistantEvent && typeof assistantEvent === "object") {
      const delta = (assistantEvent as { delta?: unknown }).delta;
      if (typeof delta === "string" && delta) {
        const next = normalizeAssistantOutputText(`${currentText}${delta}`);
        return next && next !== currentText ? next : undefined;
      }
    }

    const messageText = normalizeAssistantOutputText(extractAssistantText(event.message));
    return messageText && messageText !== currentText ? messageText : undefined;
  }

  if (type === "message_end") {
    const message = event.message;
    if (message && typeof message === "object" && (message as { role?: string }).role === "assistant") {
      const messageText = normalizeAssistantOutputText(extractAssistantText(message));
      return messageText && messageText !== currentText ? messageText : undefined;
    }
  }

  if (type === "agent_end") {
    const messages = (event.messages as unknown[] | undefined) ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message && typeof message === "object" && (message as { role?: string }).role === "assistant") {
        const messageText = normalizeAssistantOutputText(extractAssistantText(message));
        return messageText && messageText !== currentText ? messageText : undefined;
      }
    }
  }

  return undefined;
}

function extractToolInvocationId(event: Record<string, unknown>, toolName: string): string {
  for (const key of ["invocationId", "toolCallId", "toolUseId", "callId", "id"]) {
    const value = event[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return toolName;
}

export function summarizeJsonEvent(event: Record<string, unknown>): string | undefined {
  const type = typeof event.type === "string" ? event.type : "";
  if (type === "tool_execution_start") {
    const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
    return `Tool start: ${toolName}`;
  }
  if (type === "tool_execution_update") {
    const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
    const partial = event.partialResult;
    if (partial && typeof partial === "object") {
      const partialText = extractAssistantText(partial);
      if (partialText) return `${toolName}: ${partialText.split(/\r?\n/).find(Boolean)?.trim()}`;
      const details = (partial as { details?: { output?: string; stdout?: string } }).details;
      const output = details?.output ?? details?.stdout;
      if (typeof output === "string" && output.trim()) {
        return `${toolName}: ${output.split(/\r?\n/).find(Boolean)?.trim()}`;
      }
    }
    return `${toolName}: update`;
  }
  if (type === "tool_execution_end") {
    const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
    const isError = event.isError === true;
    return isError ? `Tool failed: ${toolName}` : `Tool complete: ${toolName}`;
  }
  return undefined;
}

export async function runPiAgent(cwd: string, args: string[], signal?: AbortSignal, hooks?: RunHooks): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const invocation = getPiInvocation(args);
    const proc = spawn(invocation.command, invocation.args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      const chunk = d.toString();
      stdout += chunk;
      hooks?.onStdout?.(chunk);
    });
    proc.stderr.on("data", (d) => {
      const chunk = d.toString();
      stderr += chunk;
      hooks?.onStderr?.(chunk);
    });
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    proc.on("error", () => resolve({ stdout, stderr, code: 1 }));
    if (signal) {
      const abort = () => proc.kill("SIGTERM");
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
  });
}

export async function runPiAgentJson(cwd: string, args: string[], signal?: AbortSignal, hooks?: JsonRunHooks): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const invocation = getPiInvocation(args);
    const proc = spawn(invocation.command, invocation.args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdoutTail = "";
    let stderrTail = "";
    let lineBuffer = "";
    let finalAssistantText = "";
    let assistantOutputText = "";

    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      stdoutTail = appendCappedTail(stdoutTail, `${line}\n`);
      try {
        const event = JSON.parse(trimmed) as Record<string, unknown>;
        const assistantText = extractAssistantSnapshot(event, assistantOutputText);
        if (assistantText !== undefined) {
          assistantOutputText = assistantText;
          hooks?.onAssistantText?.(assistantText);
        }

        const messageText = summarizeJsonEvent(event);
        if (messageText) hooks?.onEventText?.(messageText);

        if (event.type === "tool_execution_start") {
          const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
          const args = typeof event.args === "string" ? event.args : event.args ? JSON.stringify(event.args) : undefined;
          hooks?.onToolEvent?.({ type: "start", toolName, args, summary: messageText, invocationId: extractToolInvocationId(event, toolName) });
        } else if (event.type === "tool_execution_update") {
          const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
          hooks?.onToolEvent?.({ type: "update", toolName, summary: messageText, invocationId: extractToolInvocationId(event, toolName) });
        } else if (event.type === "tool_execution_end") {
          const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
          hooks?.onToolEvent?.({ type: "end", toolName, isError: event.isError === true, summary: messageText, invocationId: extractToolInvocationId(event, toolName) });
        }

        if (event.type === "message_end") {
          const message = event.message;
          if (message && typeof message === "object" && (message as { role?: string }).role === "assistant") {
            const text = extractAssistantText(message);
            if (text) finalAssistantText = normalizeAssistantOutputText(text);
          }
        }
        if (event.type === "agent_end") {
          const messages = (event.messages as unknown[] | undefined) ?? [];
          for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message && typeof message === "object" && (message as { role?: string }).role === "assistant") {
              const text = extractAssistantText(message);
              if (text) {
                finalAssistantText = normalizeAssistantOutputText(text);
                break;
              }
            }
          }
        }
      } catch {
        hooks?.onEventText?.(trimmed);
      }
    };

    proc.stdout.on("data", (d) => {
      lineBuffer += d.toString();
      let newlineIndex = lineBuffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = lineBuffer.slice(0, newlineIndex);
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        consumeLine(line);
        newlineIndex = lineBuffer.indexOf("\n");
      }
    });
    proc.stderr.on("data", (d) => {
      const chunk = d.toString();
      stderrTail = appendCappedTail(stderrTail, chunk);
      hooks?.onStderr?.(chunk);
    });
    proc.on("close", (code) => {
      if (lineBuffer.trim()) consumeLine(lineBuffer);
      resolve({ stdout: finalAssistantText || assistantOutputText || stdoutTail.trim(), stderr: stderrTail, code: code ?? 0 });
    });
    proc.on("error", () => resolve({ stdout: finalAssistantText || assistantOutputText || stdoutTail.trim(), stderr: stderrTail, code: 1 }));
    if (signal) {
      const abort = () => proc.kill("SIGTERM");
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
  });
}

// ─── Model Resolution ───────────────────────────────────────────────

export async function getAvailableModelKeys(ctx: ExtensionContext): Promise<string[]> {
  try {
    const available = await Promise.resolve(ctx.modelRegistry.getAvailable());
    return available.flatMap((model) => [`${model.provider}/${model.id}`, model.id]);
  } catch {
    return [];
  }
}

function modelCandidates(requested?: string, fallback?: string | string[]): string[] {
  const fallbackList = Array.isArray(fallback) ? fallback : fallback ? [fallback] : [];
  return [requested, ...fallbackList].filter(Boolean) as string[];
}

export async function resolvePreferredModel(ctx: ExtensionContext, requested?: string, _fallback?: string | string[]): Promise<{ model?: string; warning?: string }> {
  if (!requested) return {};
  const keys = await getAvailableModelKeys(ctx);
  const exact = keys.find((key) => key === requested) ?? keys.find((key) => key.toLowerCase() === requested.toLowerCase());
  if (exact) return { model: exact };
  return {
    model: requested,
    warning: `Requested model '${requested}' is not currently enabled in Pi's model registry. The exact provider-qualified ID was preserved; no equivalent provider was substituted.`,
  };
}

export async function listModelsViaPi(cwd: string, signal?: AbortSignal): Promise<{ ok: boolean; output: string }> {
  const result = await runPiAgent(cwd, ["--list-models"], signal);
  const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n").trim();
  return { ok: result.code === 0 && Boolean(output), output: output || "No model list output returned." };
}

export async function runModelPreflight(ctx: ExtensionContext, _cwd: string, requested?: string, fallback?: string[], _signal?: AbortSignal): Promise<{ model?: string; warning?: string; report: string; cliOk: boolean }> {
  const resolved = await resolvePreferredModel(ctx, requested, fallback);
  const keys = await getAvailableModelKeys(ctx);
  const requestedSummary = modelCandidates(requested, fallback).join(" -> ") || "auto";
  const status = resolved.model
    ? `Selected model: ${resolved.model}`
    : `No confirmed model matched request: ${requestedSummary}`;
  const report = [
    "Model preflight (Pi model registry)",
    `Available providers/models: ${keys.filter((key) => key.includes("/")).slice(0, 40).join(", ") || "none reported"}`,
    `Requested: ${requestedSummary}`,
    status,
    resolved.warning ? `Warning: ${resolved.warning}` : "",
  ].filter(Boolean).join("\n");
  return { ...resolved, report, cliOk: keys.length > 0 };
}

// ─── Task Prompt Building ───────────────────────────────────────────

export function buildTaskPrompt(task: {
  task: string;
  stage?: string;
  workflow?: string;
  skills?: string[];
  checklist?: Array<string | { text: string; done?: boolean }>;
}): string {
  return [
    task.stage ? `Stage: ${task.stage}` : "",
    task.workflow ? `Workflow: ${task.workflow}` : "",
    task.skills?.length ? `Optional skill/context overlays: ${task.skills.join(", ")}` : "",
    formatChecklist(task.checklist),
    "Task:",
    task.task,
  ].filter(Boolean).join("\n\n");
}
