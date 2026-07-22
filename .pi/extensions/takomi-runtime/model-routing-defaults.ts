import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveTakomiRoutingPolicy } from "./routing-policy";

export const TAKOMI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

type RoutingDefaultInput = {
  model?: unknown;
  thinking?: unknown;
  fallbackModels?: unknown;
};

type RoutingSettings = {
  takomi?: {
    modelRoutingPolicyFile?: string;
    routing?: {
      defaultProvider?: string;
      approvedModels?: string[];
      roleDefaults?: Record<string, RoutingDefaultInput>;
    };
  };
  subagents?: { agentOverrides?: Record<string, RoutingDefaultInput> };
};

export type TakomiRoutingSource = "explicit task" | "project role default" | "global role default" | "harness default";

export type TakomiAgentModelDefault = {
  agent: string;
  model?: string;
  thinking?: string;
  fallbackModels?: string[];
  source?: Exclude<TakomiRoutingSource, "explicit task" | "harness default">;
};

export type TakomiModelRoutingSnapshot = {
  approvedModels: string[];
  preferredModels: string[];
  sourceFiles: string[];
  policyFile?: string;
  policyConflicts?: string[];
  defaultProvider?: string;
  agentDefaults: TakomiAgentModelDefault[];
};

const GLOBAL_SETTINGS = path.join(os.homedir(), ".pi", "agent", "settings.json");
const CANONICAL_AGENTS = new Set(["architect", "designer", "coder", "worker", "reviewer", "orchestrator"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function canonicalAgent(value: string): string | undefined {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const aliases: Record<string, string> = {
    architecture: "architect",
    design: "designer",
    code: "coder",
    review: "reviewer",
    general: "worker",
  };
  const canonical = aliases[normalized] ?? normalized;
  return CANONICAL_AGENTS.has(canonical) ? canonical : undefined;
}

async function readSettings(filePath: string): Promise<RoutingSettings> {
  try { return JSON.parse(await fs.promises.readFile(filePath, "utf8")) as RoutingSettings; } catch { return {}; }
}

function readSettingsSync(filePath: string): RoutingSettings {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")) as RoutingSettings; } catch { return {}; }
}

function cleanDefault(agent: string, input: RoutingDefaultInput, source: TakomiAgentModelDefault["source"]): TakomiAgentModelDefault {
  return {
    agent,
    model: typeof input.model === "string" && input.model.trim() ? input.model.trim() : undefined,
    thinking: typeof input.thinking === "string" && input.thinking.trim() ? input.thinking.trim() : undefined,
    fallbackModels: Array.isArray(input.fallbackModels)
      ? unique(input.fallbackModels.filter((item): item is string => typeof item === "string"))
      : undefined,
    source,
  };
}

function extractDefaults(settings: RoutingSettings, source: TakomiAgentModelDefault["source"]): Map<string, TakomiAgentModelDefault> {
  const result = new Map<string, TakomiAgentModelDefault>();
  const legacy = asRecord(settings.subagents?.agentOverrides);
  for (const [name, value] of Object.entries(legacy)) {
    const agent = canonicalAgent(name);
    if (agent) result.set(agent, cleanDefault(agent, asRecord(value), source));
  }
  const structured = asRecord(settings.takomi?.routing?.roleDefaults);
  for (const [name, value] of Object.entries(structured)) {
    const agent = canonicalAgent(name);
    if (!agent) continue;
    const previous = result.get(agent);
    const next = cleanDefault(agent, asRecord(value), source);
    result.set(agent, {
      agent,
      model: next.model ?? previous?.model,
      thinking: next.thinking ?? previous?.thinking,
      fallbackModels: next.fallbackModels ?? previous?.fallbackModels,
      source,
    });
  }
  return result;
}

function configuredApprovedModels(settings: RoutingSettings): { present: boolean; models: string[] } {
  const routing = settings.takomi?.routing;
  return {
    present: Boolean(routing && Object.prototype.hasOwnProperty.call(routing, "approvedModels")),
    models: Array.isArray(routing?.approvedModels) ? unique(routing.approvedModels) : [],
  };
}

function modelsFromDefaults(defaults: Iterable<TakomiAgentModelDefault>): string[] {
  const models: string[] = [];
  for (const entry of defaults) {
    if (entry.model) models.push(stripThinkingSuffix(entry.model).baseModel);
    for (const fallback of entry.fallbackModels ?? []) models.push(stripThinkingSuffix(fallback).baseModel);
  }
  return unique(models);
}

export function mergeTakomiRoutingSettings(globalSettings: RoutingSettings, projectSettings: RoutingSettings, sourceFiles: string[] = []): TakomiModelRoutingSnapshot {
  const globalDefaults = extractDefaults(globalSettings, "global role default");
  const projectDefaults = extractDefaults(projectSettings, "project role default");
  const mergedDefaults = new Map(globalDefaults);
  for (const [agent, projectDefault] of projectDefaults) {
    const base = mergedDefaults.get(agent);
    mergedDefaults.set(agent, {
      agent,
      model: projectDefault.model ?? base?.model,
      thinking: projectDefault.thinking ?? base?.thinking,
      fallbackModels: projectDefault.fallbackModels ?? base?.fallbackModels,
      source: "project role default",
    });
  }

  const globalApproved = configuredApprovedModels(globalSettings);
  const projectApproved = configuredApprovedModels(projectSettings);
  const approvedModels = projectApproved.present
    ? projectApproved.models
    : globalApproved.present
      ? globalApproved.models
      : modelsFromDefaults(mergedDefaults.values());
  const defaultProvider = projectSettings.takomi?.routing?.defaultProvider
    ?? globalSettings.takomi?.routing?.defaultProvider;

  return {
    approvedModels,
    preferredModels: approvedModels,
    sourceFiles,
    defaultProvider,
    agentDefaults: [...mergedDefaults.values()],
  };
}

export function stripThinkingSuffix(model: string): { baseModel: string; thinkingSuffix: string } {
  const colonIdx = model.lastIndexOf(":");
  if (colonIdx === -1) return { baseModel: model, thinkingSuffix: "" };
  const suffix = model.slice(colonIdx + 1).toLowerCase();
  if (!(TAKOMI_THINKING_LEVELS as readonly string[]).includes(suffix)) return { baseModel: model, thinkingSuffix: "" };
  return { baseModel: model.slice(0, colonIdx), thinkingSuffix: `:${suffix}` };
}

export function isTakomiModelApproved(requested: string, approved: string[]): boolean {
  const requestedBase = stripThinkingSuffix(requested).baseModel;
  return approved.some((candidate) => stripThinkingSuffix(candidate).baseModel === requestedBase);
}

export function resolveAgentRoutingDefault(snapshot: TakomiModelRoutingSnapshot, agent: string): TakomiAgentModelDefault | undefined {
  const canonical = canonicalAgent(agent);
  return canonical ? snapshot.agentDefaults.find((entry) => entry.agent === canonical) : undefined;
}

function qualifyDefaultModel(model: string | undefined, defaultProvider: string | undefined): string | undefined {
  if (!model || model.includes("/") || !defaultProvider) return model;
  return `${defaultProvider}/${model}`;
}

export function applyTakomiRoutingDefaults<T extends { agent: string; model?: string; fallbackModels?: string[]; thinking?: string }>(
  task: T,
  snapshot: TakomiModelRoutingSnapshot,
): T {
  const defaults = resolveAgentRoutingDefault(snapshot, task.agent);
  const explicitModel = Boolean(task.model);
  const model = task.model ?? qualifyDefaultModel(defaults?.model, snapshot.defaultProvider);
  const fallbackSource = task.fallbackModels !== undefined
    ? task.fallbackModels
    : explicitModel
      ? []
      : defaults?.fallbackModels ?? [];
  const fallbackModels = unique(fallbackSource.map((item) => qualifyDefaultModel(item, snapshot.defaultProvider) ?? item));
  return {
    ...task,
    ...(model ? { model } : {}),
    ...(task.thinking ?? defaults?.thinking ? { thinking: task.thinking ?? defaults?.thinking } : {}),
    ...(fallbackModels.length ? { fallbackModels } : { fallbackModels: undefined }),
  };
}

function detectPolicyConflicts(text: string | undefined, snapshot: TakomiModelRoutingSnapshot): string[] {
  if (!text) return [];
  const conflicts: string[] = [];
  const prohibited = [...text.matchAll(/(?:do not|never)\s+use\s+([a-z0-9-]+)/gi)].map((match) => match[1].toLowerCase());
  for (const provider of prohibited) {
    const configured = snapshot.approvedModels.filter((model) => stripThinkingSuffix(model).baseModel.toLowerCase().startsWith(`${provider}/`));
    if (configured.length) conflicts.push(`Policy prohibits provider '${provider}', but executable settings approve: ${configured.join(", ")}`);
  }
  const preferred = text.match(/(?:preferred|default)\s+(?:provider|router)\s*:\s*([a-z0-9-]+)/i)?.[1];
  if (preferred && snapshot.defaultProvider && preferred.toLowerCase() !== snapshot.defaultProvider.toLowerCase()) {
    conflicts.push(`Policy names default provider '${preferred}', but executable settings use '${snapshot.defaultProvider}'.`);
  }
  return conflicts;
}

export async function loadTakomiModelRoutingSnapshot(cwd: string): Promise<TakomiModelRoutingSnapshot> {
  const projectPath = path.resolve(cwd, ".pi", "settings.json");
  const [globalSettings, projectSettings, policy] = await Promise.all([
    readSettings(GLOBAL_SETTINGS),
    readSettings(projectPath),
    resolveTakomiRoutingPolicy(cwd),
  ]);
  const files = [GLOBAL_SETTINGS, projectPath].filter((file) => fs.existsSync(file));
  const snapshot = mergeTakomiRoutingSettings(globalSettings, projectSettings, files);
  snapshot.policyFile = policy.policyPath;
  snapshot.policyConflicts = detectPolicyConflicts(policy.text, snapshot);
  return snapshot;
}

export function loadTakomiModelRoutingSnapshotSync(cwd: string): TakomiModelRoutingSnapshot {
  const projectPath = path.resolve(cwd, ".pi", "settings.json");
  return mergeTakomiRoutingSettings(
    readSettingsSync(GLOBAL_SETTINGS),
    readSettingsSync(projectPath),
    [GLOBAL_SETTINGS, projectPath].filter((file) => fs.existsSync(file)),
  );
}

export function renderCompactTakomiModelRoutingSummary(snapshot: TakomiModelRoutingSnapshot): string {
  if (!snapshot.approvedModels.length && !snapshot.agentDefaults.length) return "";
  const defaultLines = snapshot.agentDefaults.map((entry) =>
    `- ${entry.agent}: ${entry.model ?? "Pi default"}${entry.thinking ? ` (${entry.thinking})` : ""}${entry.fallbackModels?.length ? `; fallbacks ${entry.fallbackModels.join(", ")}` : ""} [${entry.source ?? "harness default"}]`
  );
  return [
    "Active Takomi subagent routing summary:",
    `Executable settings: ${snapshot.sourceFiles.join(", ") || "harness defaults"}`,
    snapshot.policyFile ? `Advisory routing guidance: ${snapshot.policyFile}` : "",
    snapshot.approvedModels.length ? `Approved exact model IDs: ${snapshot.approvedModels.join(", ")}` : "Approved exact model IDs: none configured",
    "Provider-qualified model IDs are atomic. Takomi never substitutes a different provider by model-family matching.",
    "Resolution: explicit task model → project role default → global role default → harness/Pi default.",
    ...(snapshot.policyConflicts?.length ? ["ROUTING CONFIGURATION ERROR:", ...snapshot.policyConflicts.map((item) => `- ${item}`)] : []),
    ...defaultLines,
  ].filter(Boolean).join("\n");
}
