import fs from "node:fs/promises";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TakomiLaunchMode, TakomiThinkingLevel } from "../../../src/pi-takomi-core";
import { loadTakomiProfile } from "../takomi-runtime/profile";
import { hasUserGateAutoProvenance } from "../takomi-runtime/gate-provenance";
import { applyTakomiRoutingDefaults, loadTakomiModelRoutingSnapshot } from "../takomi-runtime/model-routing-defaults";
import { resolveAgentName } from "./agent-aliases";
import { discoverTakomiAgents, type TakomiAgentConfig, type TakomiAgentScope } from "./agents";
import { createTakomiDelegationPlan, renderTakomiDelegationPlan } from "./delegation-plan";
import { rememberDetachedLaunch, resolveDetachedStatusResult } from "./detached-results";
import { createTakomiPiSubagentsEngine } from "./pi-subagents-engine";
import { createTakomiUxTasks, withTakomiUxDetails } from "./subagent-ux";

type ChecklistItem = string | { text: string; done?: boolean };

export type TakomiSubagentToolTask = {
  agent: string;
  task: string;
  workflow?: string;
  skills?: string[];
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  conversationId?: string;
  cwd?: string;
  checklist?: ChecklistItem[];
};

export type TakomiSubagentToolParams = Partial<TakomiSubagentToolTask> & {
  action?: "list" | "get" | "models" | "status" | "interrupt" | "resume" | "doctor";
  tasks?: TakomiSubagentToolTask[];
  chain?: TakomiSubagentToolTask[];
  confirmLaunch?: boolean;
  previewOnly?: boolean;
  clarify?: boolean;
  context?: "fresh" | "fork";
  async?: boolean;
  concurrency?: number;
  worktree?: boolean;
  id?: string;
  message?: string;
  index?: number;
  chainName?: string;
  agentScope?: TakomiAgentScope;
};

type ToolUpdate = (partial: {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}) => void;
const MAX_PARALLEL_TASKS = 8;
const HARD_STOP_TTL_MS = 10 * 60 * 1000;
const ENGINES = new WeakMap<ExtensionAPI, ReturnType<typeof createTakomiPiSubagentsEngine>>();

type UserTurnMarker = {
  sessionId?: string;
  count: number;
  lastEntryId?: string;
  entryIds: string[];
};

type HardStopRecord = {
  at: number;
  reason: string;
  message: string;
  userTurnMarker?: UserTurnMarker;
};

const RECENT_HARD_STOPS = new WeakMap<ExtensionAPI, Map<string, HardStopRecord>>();

function getEngine(pi: ExtensionAPI): ReturnType<typeof createTakomiPiSubagentsEngine> {
  const existing = ENGINES.get(pi);
  if (existing) return existing;
  const engine = createTakomiPiSubagentsEngine(pi);
  ENGINES.set(pi, engine);
  return engine;
}

function textResult<TDetails extends Record<string, unknown>>(text: string, details: TDetails, isError?: boolean) {
  return { content: [{ type: "text" as const, text }], details, isError };
}

function hasProjectAgents(tasks: Array<{ agent: string }>, agents: Map<string, TakomiAgentConfig>): boolean {
  return tasks.some((task) => agents.get(task.agent)?.source === "project");
}

function hostTrustsProjectAgents(): boolean {
  return /^(1|true|yes)$/i.test(process.env.TAKOMI_TRUST_PROJECT_AGENTS || "");
}

function isProjectAgentApprovalHardStop(record: HardStopRecord | undefined): boolean {
  return record?.reason === "project-agent-approval-required" || record?.reason === "project-agent-denied";
}

function hardStopStore(pi: ExtensionAPI): Map<string, HardStopRecord> {
  const existing = RECENT_HARD_STOPS.get(pi);
  if (existing) return existing;
  const next = new Map<string, HardStopRecord>();
  RECENT_HARD_STOPS.set(pi, next);
  return next;
}

type TakomiRunMode = "single" | "parallel" | "chain";

function compactChecklistForFingerprint(checklist: ChecklistItem[] | undefined): Array<{ text: string; done: boolean }> | undefined {
  if (!checklist?.length) return undefined;
  return checklist.map((item) => typeof item === "string" ? { text: item, done: false } : { text: item.text, done: item.done ?? false });
}

function compactTaskForFingerprint(task: TakomiSubagentToolTask): Record<string, unknown> {
  return {
    agent: task.agent,
    task: task.task,
    workflow: task.workflow || undefined,
    skills: task.skills?.length ? task.skills : undefined,
    model: task.model || undefined,
    fallbackModels: task.fallbackModels?.length ? task.fallbackModels : undefined,
    thinking: task.thinking,
    conversationId: task.conversationId || undefined,
    cwd: task.cwd,
    checklist: compactChecklistForFingerprint(task.checklist),
  };
}

const IMPLICIT_CONTEXT = "implicit" as const;
type CanonicalContext = typeof IMPLICIT_CONTEXT | "fresh" | "fork";

function canonicalContextForFingerprint(context: TakomiSubagentToolParams["context"]): CanonicalContext {
  // Omission delegates context selection to native pi-subagents, whose built-in
  // and settings defaults are authoritative. Never approximate that resolution
  // with Takomi-only discovery: implicit input is its own approval semantic.
  return context ?? IMPLICIT_CONTEXT;
}

function canonicalContextsForFingerprint(
  params: TakomiSubagentToolParams,
  tasks: TakomiSubagentToolTask[],
): CanonicalContext[] {
  const context = canonicalContextForFingerprint(params.context);
  // `context` is a global override. When omitted, each native task resolves its
  // own default, but all retain the distinct implicit-input sentinel here.
  return tasks.map(() => context);
}

function effectiveConcurrencyForFingerprint(mode: TakomiRunMode, concurrency: number | undefined): number | undefined {
  if (mode !== "parallel") return undefined;
  return typeof concurrency === "number" && Number.isInteger(concurrency) && concurrency >= 1 ? concurrency : 4;
}

function createRunFingerprint(
  rootCwd: string,
  mode: TakomiRunMode,
  tasks: TakomiSubagentToolTask[],
  params: TakomiSubagentToolParams,
  agentScope: TakomiAgentScope,
): string {
  const context = canonicalContextForFingerprint(params.context);
  return JSON.stringify({
    rootCwd,
    mode,
    tasks: tasks.map(compactTaskForFingerprint),
    launch: {
      context: {
        global: context,
        perTask: canonicalContextsForFingerprint(params, tasks),
      },
      async: params.async === true,
      concurrency: effectiveConcurrencyForFingerprint(mode, params.concurrency),
      worktree: mode === "parallel" && params.worktree === true,
      clarify: params.clarify === true,
      agentScope,
    },
  });
}

function hardStopResult(message: string, details: Record<string, unknown>) {
  return textResult([
    message,
    "",
    "HARD STOP: Do not retry this subagent call automatically. Wait for the user's next prompt or explicit approval before launching it again.",
  ].join("\n"), { ...details, takomiHardStop: true }, true);
}

function rememberHardStop(
  pi: ExtensionAPI,
  fingerprint: string,
  reason: string,
  message: string,
  userTurnMarker?: UserTurnMarker,
): void {
  hardStopStore(pi).set(fingerprint, { at: Date.now(), reason, message, userTurnMarker });
}

function readUserTurnMarker(ctx: ExtensionContext): UserTurnMarker {
  const userEntries = ctx.sessionManager.getEntries().filter((entry) => entry.type === "message" && entry.message.role === "user");
  const entryIds = userEntries.map((entry) => entry.id);
  return {
    sessionId: ctx.sessionManager.getSessionId(),
    count: userEntries.length,
    lastEntryId: entryIds.at(-1),
    entryIds,
  };
}

function hasStrictlyNewerUserTurn(record: HardStopRecord, current: UserTurnMarker): boolean {
  const recorded = record.userTurnMarker;
  if (!recorded || recorded.sessionId !== current.sessionId || current.count <= recorded.count) return false;
  if (!recorded.lastEntryId) return true;

  const recordedTurnIndex = current.entryIds.indexOf(recorded.lastEntryId);
  return recordedTurnIndex >= 0 && recordedTurnIndex < current.entryIds.length - 1;
}

function consumeExpiredHardStop(pi: ExtensionAPI, fingerprint: string): HardStopRecord | undefined {
  const store = hardStopStore(pi);
  const record = store.get(fingerprint);
  if (!record) return undefined;
  if (Date.now() - record.at > HARD_STOP_TTL_MS) {
    store.delete(fingerprint);
    return undefined;
  }
  return record;
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveRelativeCwd(root: string, value: string | undefined, label: string): Promise<string> {
  const lexicalRoot = path.resolve(root);
  const lexicalCandidate = value
    ? path.isAbsolute(value) ? path.resolve(value) : path.resolve(lexicalRoot, value)
    : lexicalRoot;
  if (!isPathInside(lexicalRoot, lexicalCandidate)) throw new Error(`${label} escapes the current workspace.`);

  const [realRoot, realCandidate] = await Promise.all([fs.realpath(lexicalRoot), fs.realpath(lexicalCandidate)]);
  const stat = await fs.stat(realCandidate);
  if (!stat.isDirectory()) throw new Error(`${label} must be a directory inside the current workspace.`);
  if (!isPathInside(realRoot, realCandidate)) throw new Error(`${label} escapes the current workspace.`);
  return realCandidate;
}

function getTextContent(result: any): string {
  return (result?.content ?? [])
    .map((item: any) => item?.type === "text" && typeof item.text === "string" ? item.text : "")
    .filter(Boolean)
    .join("\n");
}

function detectNativeHardStop(result: any): { reason: string; message: string } | undefined {
  const text = getTextContent(result);
  const details = result?.details;
  const results = Array.isArray(details?.results) ? details.results : [];

  if (/\b(paused after interrupt|waiting for explicit next action|chain cancelled|chain canceled|run cancelled|run canceled|subagent call blocked|resume blocked|blocked by user)\b/i.test(text)) {
    return { reason: "native-pause-cancel-or-block", message: text || "Subagent run paused/cancelled/blocked." };
  }

  if (results.some((child: any) => child?.interrupted === true)) {
    return { reason: "native-interrupt", message: text || "Subagent run paused after interrupt." };
  }

  if (details?.workflowGraph && JSON.stringify(details.workflowGraph).includes('"paused"')) {
    return { reason: "native-workflow-paused", message: text || "Subagent workflow paused." };
  }

  return undefined;
}

function withNativeHardStop(result: any, hardStop: { reason: string; message: string }, takomi: Record<string, unknown>) {
  return {
    ...result,
    content: [{
      type: "text" as const,
      text: [
        hardStop.message,
        "",
        "HARD STOP: The subagent was blocked, cancelled, or paused. Do not retry automatically. Wait for the user's next prompt or explicit approval.",
      ].join("\n"),
    }],
    isError: true,
    details: {
      ...(result?.details ?? {}),
      takomi: {
        ...takomi,
        hardStop: true,
        hardStopReason: hardStop.reason,
      },
    },
  };
}

function readRuntimeLaunchMode(ctx: ExtensionContext): TakomiLaunchMode | undefined {
  const entries = ctx.sessionManager.getEntries();
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i] as { type?: string; customType?: string; data?: { launchMode?: unknown } };
    if (entry.type !== "custom" || entry.customType !== "takomi-runtime-state") continue;
    if (entry.data?.launchMode === "manual" || entry.data?.launchMode === "auto") return entry.data.launchMode;
  }
  return undefined;
}

function resolveMode(params: TakomiSubagentToolParams): "single" | "parallel" | "chain" | undefined {
  const hasChain = Boolean(params.chain?.length);
  const hasParallel = Boolean(params.tasks?.length);
  const hasSingle = Boolean(params.agent && params.task);
  if (Number(hasChain) + Number(hasParallel) + Number(hasSingle) !== 1) return undefined;
  return hasChain ? "chain" : hasParallel ? "parallel" : "single";
}
function resolveTasks(params: TakomiSubagentToolParams): TakomiSubagentToolTask[] {
  if (params.chain?.length) return params.chain;
  if (params.tasks?.length) return params.tasks;
  if (params.agent && params.task) {
    return [{
      agent: params.agent,
      task: params.task,
      workflow: params.workflow,
      skills: params.skills,
      model: params.model,
      fallbackModels: params.fallbackModels,
      thinking: params.thinking,
      conversationId: params.conversationId,
      cwd: undefined,
      checklist: params.checklist,
    }];
  }
  return [];
}
export async function executeTakomiSubagentTool(
  pi: ExtensionAPI,
  params: TakomiSubagentToolParams,
  signal: AbortSignal | undefined,
  onUpdate: ToolUpdate | undefined,
  ctx: ExtensionContext,
) {
  const engine = getEngine(pi);
  let rootCwd: string;
  try {
    rootCwd = await resolveRelativeCwd(ctx.cwd, params.cwd, "cwd");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return textResult(message, { results: [], agentScope: params.agentScope ?? "both" }, true);
  }
  const profile = await loadTakomiProfile(rootCwd);
  const runtimeLaunchMode = readRuntimeLaunchMode(ctx);
  const userTurnMarker = readUserTurnMarker(ctx);
  // Auto launch mode may come from a model, profile, default, or restored
  // runtime state. None of those are project-agent authorization.
  const userGateAutoAuthorized = hasUserGateAutoProvenance(ctx.sessionManager.getEntries());
  const agentScope = params.agentScope ?? "both";

  if (params.action) {
    try {
      const nativeResult: any = await engine.execute(
        "takomi-tool",
        { ...params, cwd: rootCwd, agentScope },
        signal,
        onUpdate as any,
        ctx,
      );
      const resolvedResult = params.action === "status"
        ? await resolveDetachedStatusResult(pi, params, nativeResult)
        : nativeResult;
      return {
        ...resolvedResult,
        details: {
          ...(resolvedResult?.details ?? {}),
          takomi: {
            action: params.action,
            agentScope,
          },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return textResult(message, { results: [], action: params.action, agentScope }, true);
    }
  }

  const agents = discoverTakomiAgents(rootCwd, agentScope);
  const byName = new Map<string, TakomiAgentConfig>(agents.map((agent) => [agent.name, agent]));
  const mode = resolveMode(params);
  const routingSnapshot = await loadTakomiModelRoutingSnapshot(rootCwd);
  let tasks: TakomiSubagentToolTask[];
  try {
    const rawTasks = resolveTasks(params);
    tasks = await Promise.all(rawTasks.map(async (task, index) => applyTakomiRoutingDefaults({
      ...task,
      agent: resolveAgentName(task.agent, byName),
      cwd: await resolveRelativeCwd(rootCwd, task.cwd, `tasks[${index}].cwd`),
    }, routingSnapshot)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return textResult(message, { results: [], availableAgents: agents.map((agent) => agent.name), agentScope }, true);
  }

  if (!mode) {
    return textResult(
      `Provide exactly one mode: agent/task, tasks, or chain.\nAvailable agents: ${agents.map((agent) => `${agent.name} (${agent.source})`).join(", ") || "none"}`,
      { results: [], availableAgents: agents.map((agent) => agent.name), agentScope },
      true,
    );
  }
  if (mode === "parallel" && tasks.length > MAX_PARALLEL_TASKS) {
    return textResult(`Too many parallel tasks (${tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`, { results: [], agentScope }, true);
  }

  const fingerprint = createRunFingerprint(rootCwd, mode, tasks, params, agentScope);
  const projectAgentsAuthorized = userGateAutoAuthorized || hostTrustsProjectAgents();
  const recentHardStop = consumeExpiredHardStop(pi, fingerprint);
  const authorizationOverridesHardStop = projectAgentsAuthorized && isProjectAgentApprovalHardStop(recentHardStop);
  const consumesReviewGate = recentHardStop?.reason === "review-gate"
    && params.confirmLaunch === true
    && params.previewOnly !== true
    && hasStrictlyNewerUserTurn(recentHardStop, userTurnMarker);
  if (recentHardStop && !authorizationOverridesHardStop && !consumesReviewGate) {
    return hardStopResult(
      `Subagent launch blocked: the same request was already stopped (${recentHardStop.reason}).\n${recentHardStop.message}`,
      { results: [], availableAgents: agents.map((agent) => agent.name), agentScope, mode, blockedAt: recentHardStop.at, reason: recentHardStop.reason },
    );
  }
  if (authorizationOverridesHardStop || consumesReviewGate) hardStopStore(pi).delete(fingerprint);

  if (!projectAgentsAuthorized && hasProjectAgents(tasks, byName)) {
    const names = tasks.map((task) => byName.get(task.agent)).filter((agent): agent is TakomiAgentConfig => agent?.source === "project").map((agent) => agent.name);
    const uniqueNames = [...new Set(names)].join(", ");
    if (!ctx.hasUI) {
      const message = `Blocked: project-local Takomi agents require interactive approval. Agents: ${uniqueNames}`;
      rememberHardStop(pi, fingerprint, "project-agent-approval-required", message);
      return hardStopResult(message, { results: [], agentScope, mode });
    }
    const ok = await ctx.ui.confirm("Run project-local Takomi agents?", `Agents: ${uniqueNames}\n\nProject agents are repo-controlled. Continue only for trusted repositories.`);
    if (!ok) {
      const message = "Canceled: project-local agents not approved.";
      rememberHardStop(pi, fingerprint, "project-agent-denied", message);
      return hardStopResult(message, { results: [], agentScope, mode });
    }
  }
  const plan = createTakomiDelegationPlan({
    source: "takomi-tool",
    launchMode: runtimeLaunchMode ?? profile.launchMode ?? "auto",
    profile,
    tasks: tasks.map((task, index) => ({
      id: task.conversationId ?? `direct-${index + 1}`,
      title: task.task,
      agent: task.agent,
      task: task.task,
      workflow: task.workflow,
      model: task.model,
      fallbackModels: task.fallbackModels,
      thinking: task.thinking,
      conversationId: task.conversationId,
      checklist: task.checklist,
      dispatchPolicy: "subagent",
    })),
  });
  if (params.previewOnly) {
    return textResult(renderTakomiDelegationPlan(plan), { plan, availableAgents: agents.map((agent) => agent.name), agentScope, mode });
  }
  if (plan.launchMode === "manual" && !consumesReviewGate) {
    const message = `${renderTakomiDelegationPlan(plan)}\n\nReview gate is awaiting explicit user approval.`;
    rememberHardStop(pi, fingerprint, "review-gate", "Review gate displayed a delegation plan and paused before launch.", userTurnMarker);
    return hardStopResult(message, { plan, availableAgents: agents.map((agent) => agent.name), agentScope, mode });
  }
  try {
    const nativeParams: TakomiSubagentToolParams = mode === "single"
      ? { ...params, ...tasks[0]!, cwd: rootCwd, agentScope }
      : mode === "parallel"
        ? { ...params, cwd: rootCwd, tasks, agentScope }
        : { ...params, cwd: rootCwd, chain: tasks, agentScope };
    const uxTasks = createTakomiUxTasks(tasks);
    const nativeOnUpdate = onUpdate
      ? (partial: any) => onUpdate({
          ...partial,
          details: withTakomiUxDetails(partial?.details, uxTasks),
        })
      : undefined;

    const nativeResult: any = await engine.execute(
      "takomi-tool",
      nativeParams,
      signal,
      nativeOnUpdate as any,
      ctx,
    );

    if (params.async === true) {
      await rememberDetachedLaunch(
        pi,
        nativeResult,
        uxTasks,
        ctx,
        rootCwd,
        mode === "single" ? tasks[0]?.cwd ?? rootCwd : rootCwd,
      );
    }

    const takomi = {
      plan,
      agentScope,
      workflow: params.workflow,
    };
    const nativeHardStop = detectNativeHardStop(nativeResult);
    if (nativeHardStop) {
      rememberHardStop(pi, fingerprint, nativeHardStop.reason, nativeHardStop.message);
      return withNativeHardStop(nativeResult, nativeHardStop, takomi);
    }

    return {
      ...nativeResult,
      details: {
        ...withTakomiUxDetails(nativeResult?.details, uxTasks),
        takomi,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/\b(aborted|abort|cancelled|canceled|interrupted)\b/i.test(message)) {
      rememberHardStop(pi, fingerprint, "execution-cancelled", message);
      return hardStopResult(message, { results: [], mode, agentScope });
    }
    return textResult(message, { results: [], mode, agentScope }, true);
  }
}
