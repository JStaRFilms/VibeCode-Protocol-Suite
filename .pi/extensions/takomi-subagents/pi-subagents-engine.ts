import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  loadPiSubagentsInternals,
  type AgentConfig,
  type AgentScope,
  type Details,
  type SubagentParamsLike,
  type SubagentState,
} from "./pi-subagents-internal";
import { resolveAgentName } from "./agent-aliases";
import { applyTakomiRoutingDefaults, loadTakomiModelRoutingSnapshotSync } from "../takomi-runtime/model-routing-defaults";
import type { TakomiSubagentToolParams, TakomiSubagentToolTask } from "./tool-runner";
import { ensureTakomiAsyncLifecycle, getTakomiAsyncLifecycleSnapshot } from "./async-lifecycle";

type ToolUpdate = (partial: AgentToolResult<Details>) => void;

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
const NEVER_ABORT: AbortSignal = new AbortController().signal;

function getSubagentSessionRoot(parentSessionFile: string | null): string {
  if (parentSessionFile) {
    const baseName = path.basename(parentSessionFile, ".jsonl");
    return path.join(path.dirname(parentSessionFile), baseName);
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), "takomi-subagent-session-"));
}

function expandTilde(value: string): string {
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

function resolveMode(params: TakomiSubagentToolParams): "single" | "parallel" | "chain" | "action" | undefined {
  if (params.action) return "action";
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

function normalizeThinking(value: unknown): string | undefined {
  return typeof value === "string" && (THINKING_LEVELS as readonly string[]).includes(value) ? value : undefined;
}

function buildTakomiTaskPrompt(task: TakomiSubagentToolTask): string {
  const checklist = task.checklist?.length
    ? [
        "Checklist:",
        ...task.checklist.map((item) => typeof item === "string" ? `- [ ] ${item}` : `- [${item.done ? "x" : " "}] ${item.text}`),
        "When an item's state changes, report that exact item in explicit assistant progress/final output as a markdown checkbox. Mark it complete only after it is actually complete.",
      ].join("\n")
    : "";
  const takomiContext = [
    task.workflow ? `Takomi workflow: ${task.workflow}` : "",
    task.skills?.length ? `Takomi skills/context overlays: ${task.skills.join(", ")}` : "",
    checklist,
  ].filter(Boolean).join("\n\n");

  return takomiContext ? `${takomiContext}\n\n${task.task}` : task.task;
}

function modelWithThinking(model: string | undefined, thinking: string | undefined): string | undefined {
  const level = normalizeThinking(thinking);
  if (!model || !level || level === "off") return model;
  if (new RegExp(`:(${THINKING_LEVELS.join("|")})$`, "i").test(model)) return model;
  return `${model}:${level}`;
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveRelativeCwd(root: string, value: string | undefined, label: string): string {
  const lexicalRoot = path.resolve(root);
  const lexicalCandidate = value
    ? path.isAbsolute(value) ? path.resolve(value) : path.resolve(lexicalRoot, value)
    : lexicalRoot;
  if (!isPathInside(lexicalRoot, lexicalCandidate)) throw new Error(`${label} escapes the current workspace.`);

  const realRoot = fs.realpathSync(lexicalRoot);
  const realCandidate = fs.realpathSync(lexicalCandidate);
  const stat = fs.statSync(realCandidate);
  if (!stat.isDirectory()) throw new Error(`${label} must be a directory inside the current workspace.`);
  if (!isPathInside(realRoot, realCandidate)) throw new Error(`${label} escapes the current workspace.`);
  return realCandidate;
}

function safeConversationSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "conversation";
}

function stableConversationSessionDir(rootCwd: string, tasks: TakomiSubagentToolTask[]): string | undefined {
  const ids = tasks.map((task) => task.conversationId).filter((id): id is string => Boolean(id));
  if (!ids.length) return undefined;
  return path.join(rootCwd, ".pi", "takomi", "subagent-conversations", safeConversationSlug(ids.join("__")));
}

function defaultChildExtensions(): string[] {
  // Child runs must not auto-load every user/project extension because this repo
  // currently has both global and project Takomi extensions, which causes tool
  // name conflicts in children. But model providers such as oauth-router are
  // extensions too, so we explicitly allow the provider extension through.
  const roots = [
    process.env.PI_AGENT_ROOT,
    path.join(os.homedir(), ".pi", "agent"),
    path.join(process.cwd(), ".pi"),
  ].filter((root): root is string => Boolean(root));
  const candidates = roots.flatMap((root) => [
    path.join(root, "extensions", "oauth-router", "index.ts"),
    path.join(root, "extensions", "oauth-router", "index.js"),
  ]);
  return candidates.filter((candidate) => fs.existsSync(candidate));
}

function withTakomiAgentDefaults(agent: AgentConfig, cwd: string): AgentConfig {
  const routed = applyTakomiRoutingDefaults({
    agent: agent.name,
    model: agent.model,
    fallbackModels: agent.fallbackModels,
    thinking: agent.thinking,
  }, loadTakomiModelRoutingSnapshotSync(cwd));
  return {
    ...agent,
    model: routed.model,
    fallbackModels: routed.fallbackModels,
    thinking: routed.thinking,
    systemPromptMode: agent.systemPromptMode ?? "replace",
    inheritProjectContext: agent.inheritProjectContext ?? true,
    inheritSkills: agent.inheritSkills ?? false,
    defaultContext: agent.defaultContext ?? "fresh",
    extensions: [...new Set([...(agent.extensions ?? []), ...defaultChildExtensions()])],
  };
}

function discoverUnifiedAgents(discoverPiAgents: any, cwd: string, scope: AgentScope): { agents: AgentConfig[] } {
  return { agents: discoverPiAgents(cwd, scope).agents.map((agent: AgentConfig) => withTakomiAgentDefaults(agent, cwd)) };
}

function agentNameSet(discoverPiAgents: any, cwd: string): Set<string> {
  return new Set(discoverUnifiedAgents(discoverPiAgents, cwd, "both").agents.map((agent) => agent.name));
}

function mapSingleTask(task: TakomiSubagentToolTask, names: Set<string>, rootCwd: string) {
  const resolvedAgent = resolveAgentName(task.agent, new Map([...names].map((name) => [name, { name } as any])));
  return {
    agent: resolvedAgent,
    task: buildTakomiTaskPrompt({ ...task, agent: resolvedAgent }),
    cwd: resolveRelativeCwd(rootCwd, task.cwd, "task.cwd"),
    model: modelWithThinking(task.model, task.thinking),
    fallbackModels: task.fallbackModels,
    skill: task.skills?.length ? task.skills : undefined,
  };
}

function toSubagentParams(params: TakomiSubagentToolParams, rootCwd: string, discoverPiAgents: any): SubagentParamsLike {
  const mode = resolveMode(params);
  const tasks = resolveTasks(params);
  const names = agentNameSet(discoverPiAgents, rootCwd);
  if (!mode) throw new Error("Provide exactly one mode: agent/task, tasks, or chain.");

  const base = {
    agentScope: params.agentScope ?? "both",
    cwd: rootCwd,
    ...(params.context ? { context: params.context } : {}),
    ...(params.async !== undefined ? { async: params.async } : {}),
    ...(params.concurrency !== undefined ? { concurrency: params.concurrency } : {}),
    ...(params.worktree !== undefined ? { worktree: params.worktree } : {}),
    clarify: params.clarify === true,
    includeProgress: true,
    sessionDir: stableConversationSessionDir(rootCwd, tasks),
  };

  if (mode === "action") {
    return {
      ...base,
      action: params.action,
      agent: params.agent,
      chainName: params.chainName,
      id: params.id,
      message: params.message,
      index: params.index,
    };
  }

  if (mode === "single") {
    const task = tasks[0]!;
    const mapped = mapSingleTask(task, names, rootCwd);
    return {
      ...base,
      agent: mapped.agent,
      task: mapped.task,
      cwd: mapped.cwd,
      model: mapped.model,
      fallbackModels: mapped.fallbackModels,
      skill: mapped.skill,
    };
  }

  if (mode === "parallel") {
    return {
      ...base,
      tasks: tasks.map((task) => mapSingleTask(task, names, rootCwd)),
    };
  }

  return {
    ...base,
    chain: tasks.map((task) => {
      const mapped = mapSingleTask(task, names, rootCwd);
      return {
        agent: mapped.agent,
        task: mapped.task,
        cwd: mapped.cwd,
        model: mapped.model,
        fallbackModels: mapped.fallbackModels,
        skill: mapped.skill,
      };
    }),
  };
}

export function createTakomiPiSubagentsEngine(pi: ExtensionAPI) {
  let executorBinding: {
    state: SubagentState;
    generation: number;
    promise: Promise<any>;
  } | null = null;

  async function getExecutor(ctx: ExtensionContext) {
    // Ownership can change when either extension reloads. Re-check after the
    // executor factory resolves so an in-flight native takeover can never return
    // an executor bound to a lifecycle that was disposed during initialization.
    for (;;) {
      const lifecycle = await ensureTakomiAsyncLifecycle(pi, ctx);
      if (!executorBinding
        || executorBinding.state !== lifecycle.state
        || executorBinding.generation !== lifecycle.generation) {
        const state = lifecycle.state;
        executorBinding = {
          state,
          generation: lifecycle.generation,
          promise: loadPiSubagentsInternals().then((internals) => {
            const config = {
              maxSubagentDepth: 2,
              asyncByDefault: false,
              forceTopLevelAsync: false,
            };
            return {
              executor: internals.createSubagentExecutor({
                pi,
                state,
                config,
                asyncByDefault: false,
                tempArtifactsDir: internals.TEMP_ARTIFACTS_DIR,
                getSubagentSessionRoot,
                expandTilde,
                discoverAgents: (cwd: string, scope: AgentScope) => discoverUnifiedAgents(internals.discoverPiAgents, cwd, scope),
              }),
              discoverPiAgents: internals.discoverPiAgents,
            };
          }),
        };
      }
      const binding = executorBinding;
      const executor = await binding.promise;
      const current = getTakomiAsyncLifecycleSnapshot(pi);
      if (current?.state === binding.state && current?.generation === binding.generation) return executor;
    }
  }

  return {
    dispose(): void {
      executorBinding = null;
    },
    async execute(
      id: string,
      params: TakomiSubagentToolParams,
      signal: AbortSignal | undefined,
      onUpdate: ToolUpdate | undefined,
      ctx: ExtensionContext,
    ): Promise<AgentToolResult<Details>> {
      const rootCwd = resolveRelativeCwd(ctx.cwd, params.cwd, "cwd");
      const { executor, discoverPiAgents } = await getExecutor(ctx);
      const subagentParams = toSubagentParams(params, rootCwd, discoverPiAgents);
      return executor.execute(id, subagentParams, signal ?? NEVER_ABORT, onUpdate, ctx);
    },
  };
}
