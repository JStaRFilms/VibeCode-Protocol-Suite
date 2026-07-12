import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TAKOMI_ROUTING_POLICY_RELATIVE = path.join(".pi", "takomi", "model-routing.md");
export const GLOBAL_TAKOMI_ROUTING_POLICY_PATH = path.join(os.homedir(), ".pi", "takomi", "model-routing.md");
export const GLOBAL_PI_SETTINGS_PATH = path.join(os.homedir(), ".pi", "agent", "settings.json");
export const PROJECT_PI_SETTINGS_RELATIVE = path.join(".pi", "settings.json");
export const BUNDLED_TAKOMI_ROUTING_POLICY_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "takomi",
  "model-routing.md",
);
const PROJECT_TAKOMI_POLICY_ROOT_RELATIVE = path.join(".pi", "takomi");
const MAX_POLICY_BYTES = 128 * 1024;

export type RoutingPolicyInstallResult = {
  policyPath: string;
  settingsPath: string;
  settingsUpdated: boolean;
  detectedDefaults: string[];
};

export type RoutingPolicyPreviewResult = {
  scope: RoutingPolicyInstallScope;
  policy: string;
  policyPath: string;
  settingsPath: string;
  detectedDefaults: string[];
  overrides: JsonObject;
};

export type RoutingPolicyInstallScope = "global" | "project";
export type RoutingPolicySource = "project" | "global" | "bundled" | "missing";

export type ResolvedRoutingPolicy = {
  source: RoutingPolicySource;
  policyPath?: string;
  text?: string;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

async function readJsonObject(filePath: string): Promise<JsonObject> {
  try {
    return asObject(JSON.parse(await readFile(filePath, "utf8")));
  } catch {
    return {};
  }
}

async function readPolicyText(filePath: string): Promise<string | undefined> {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size > MAX_POLICY_BYTES) return undefined;
    const text = (await readFile(filePath, "utf8")).trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveSafeProjectPolicyPath(cwd: string, configured: string): Promise<string | undefined> {
  if (!configured) return undefined;

  const projectPolicyRoot = path.resolve(cwd, PROJECT_TAKOMI_POLICY_ROOT_RELATIVE);
  const resolvedPath = path.isAbsolute(configured) ? path.resolve(configured) : path.resolve(cwd, configured);
  if (!isPathInside(projectPolicyRoot, resolvedPath)) return undefined;

  try {
    const [realCwd, realRoot, realFile] = await Promise.all([realpath(cwd), realpath(projectPolicyRoot), realpath(resolvedPath)]);
    if (!isPathInside(realCwd, realRoot)) return undefined;
    if (!isPathInside(realRoot, realFile)) return undefined;
    return realFile;
  } catch {
    return resolvedPath;
  }
}

function extractQuotedPolicy(text: string): string {
  const triple = text.match(/"""([\s\S]*?)"""|```(?:\w+)?\s*([\s\S]*?)```/);
  const raw = (triple?.[1] ?? triple?.[2] ?? text).trim();
  return raw.replace(/^update\s+(?:takomi\s+)?(?:model\s+)?routing\s+(?:logic|policy|philosophy)\s*:?/i, "").trim();
}

function normalizeForSettings(filePath: string): string {
  return filePath.replaceAll(path.sep, "/");
}

function extractPreferredProvider(policy: string): string | undefined {
  const match = policy.match(/(?:preferred|default)\s+(?:provider|router)(?:\s*\/\s*(?:provider|router))?\s*:\s*([a-z0-9-]+)/i)
    ?? policy.match(/use\s+([a-z0-9-]+)\s+as\s+(?:the\s+)?(?:provider|router)/i);
  return match?.[1];
}

function findExplicitProviderModel(policy: string, family: RegExp): string | undefined {
  const refs = policy.match(/[a-z0-9-]+\/[a-z0-9._-]+/gi) ?? [];
  return refs.find((ref) => family.test(ref));
}

function providerModel(preferredProvider: string | undefined, model: string): string | undefined {
  return preferredProvider ? `${preferredProvider}/${model}` : undefined;
}

function withOptionalModel(model: string | undefined, thinking: string, extra: JsonObject = {}): JsonObject {
  return model ? { model, thinking, ...extra } : { thinking, ...extra };
}

function deriveSubagentDefaults(policy: string): { overrides: JsonObject; detected: string[] } {
  const lower = policy.toLowerCase();
  const has55 = /gpt[- ]?5\.5/.test(lower);
  const has54 = /gpt[- ]?5\.4(?!\s*mini)/.test(lower);
  const hasMini = /gpt[- ]?5\.4\s*mini/.test(lower);
  if (!has55 && !has54 && !hasMini) return { overrides: {}, detected: [] };

  // Keep generated settings provider-agnostic unless the policy explicitly
  // declares provider-qualified models or a preferred provider/router header.
  const preferredProvider = extractPreferredProvider(policy);
  const model55 = findExplicitProviderModel(policy, /gpt[-_.]?5\.5/i) ?? providerModel(preferredProvider, "gpt-5.5");
  const model54 = findExplicitProviderModel(policy, /gpt[-_.]?5\.4(?![-_.]?mini)/i) ?? providerModel(preferredProvider, "gpt-5.4");
  const modelMini = findExplicitProviderModel(policy, /gpt[-_.]?5\.4[-_.]?mini/i) ?? providerModel(preferredProvider, "gpt-5.4-mini");
  const overrides: JsonObject = {};
  const detected: string[] = [];

  if (has55) {
    overrides.orchestrator = withOptionalModel(model55, "high");
    overrides.architect = withOptionalModel(model55, "high");
    overrides.reviewer = withOptionalModel(model55, "high");
    detected.push(model55 ? `orchestrator/architect/reviewer → ${model55} high` : "orchestrator/architect/reviewer → GPT-5.5 high intent");
  }
  if (has54) {
    overrides.general = withOptionalModel(model54, "high", model55 ? { fallbackModels: [`${model55}:low`] } : {});
    overrides.coder = withOptionalModel(model54, "high", model55 ? { fallbackModels: [`${model55}:low`] } : {});
    overrides.designer = withOptionalModel(model54, "high", model55 ? { fallbackModels: [`${model55}:low`] } : {});
    detected.push(model54 ? `general/coder/designer → ${model54} high` : "general/coder/designer → GPT-5.4 high intent");
  }
  if (hasMini) {
    detected.push(modelMini ? `GPT-5.4 Mini available for explicit small-task overrides: ${modelMini}` : "GPT-5.4 Mini available as small-task intent only");
  }
  return { overrides, detected };
}

export async function resolveTakomiRoutingPolicy(cwd: string): Promise<ResolvedRoutingPolicy> {
  const projectSettingsPath = path.join(cwd, PROJECT_PI_SETTINGS_RELATIVE);
  const projectSettings = await readJsonObject(projectSettingsPath);
  const projectTakomi = asObject(projectSettings.takomi);
  const configuredProject = typeof projectTakomi.modelRoutingPolicyFile === "string"
    ? projectTakomi.modelRoutingPolicyFile
    : TAKOMI_ROUTING_POLICY_RELATIVE;
  const configuredProjectPath = await resolveSafeProjectPolicyPath(cwd, configuredProject);
  if (configuredProjectPath) {
    const configuredProjectText = await readPolicyText(configuredProjectPath);
    if (configuredProjectText) {
      return { source: "project", policyPath: configuredProjectPath, text: configuredProjectText };
    }
  }

  const defaultProjectPath = await resolveSafeProjectPolicyPath(cwd, TAKOMI_ROUTING_POLICY_RELATIVE);
  if (defaultProjectPath && path.resolve(defaultProjectPath) !== path.resolve(configuredProjectPath ?? "")) {
    const defaultProjectText = await readPolicyText(defaultProjectPath);
    if (defaultProjectText) {
      return { source: "project", policyPath: defaultProjectPath, text: defaultProjectText };
    }
  }

  const globalSettings = await readJsonObject(GLOBAL_PI_SETTINGS_PATH);
  const globalTakomi = asObject(globalSettings.takomi);
  const configuredGlobal = typeof globalTakomi.modelRoutingPolicyFile === "string"
    ? globalTakomi.modelRoutingPolicyFile
    : GLOBAL_TAKOMI_ROUTING_POLICY_PATH;
  const configuredGlobalPath = path.isAbsolute(configuredGlobal) ? configuredGlobal : path.join(os.homedir(), configuredGlobal);
  const configuredGlobalText = await readPolicyText(configuredGlobalPath);
  if (configuredGlobalText) {
    return { source: "global", policyPath: configuredGlobalPath, text: configuredGlobalText };
  }

  if (path.resolve(configuredGlobalPath) !== path.resolve(GLOBAL_TAKOMI_ROUTING_POLICY_PATH)) {
    const globalText = await readPolicyText(GLOBAL_TAKOMI_ROUTING_POLICY_PATH);
    if (globalText) {
      return { source: "global", policyPath: GLOBAL_TAKOMI_ROUTING_POLICY_PATH, text: globalText };
    }
  }

  const bundledText = await readPolicyText(BUNDLED_TAKOMI_ROUTING_POLICY_PATH);
  if (bundledText) {
    return {
      source: "bundled",
      policyPath: BUNDLED_TAKOMI_ROUTING_POLICY_PATH,
      text: bundledText,
    };
  }

  return { source: "missing" };
}

export function previewTakomiRoutingPolicy(cwd: string, input: string, options: { scope?: RoutingPolicyInstallScope; availableModels?: string[] } = {}): RoutingPolicyPreviewResult {
  const policy = extractQuotedPolicy(input);
  if (!policy) throw new Error("No routing policy text found. Paste the policy after /takomi routing or inside triple quotes.");

  const scope = options.scope ?? "global";
  const policyPath = scope === "project"
    ? path.join(cwd, TAKOMI_ROUTING_POLICY_RELATIVE)
    : GLOBAL_TAKOMI_ROUTING_POLICY_PATH;
  const settingsPath = scope === "project"
    ? path.join(cwd, PROJECT_PI_SETTINGS_RELATIVE)
    : GLOBAL_PI_SETTINGS_PATH;
  const { overrides, detected } = deriveSubagentDefaults(policy);

  // Resolve named model families from Pi's registry for review visibility. These
  // are conditional routing intents, not role-wide defaults, so do not invent
  // agentOverrides merely to make the extraction non-empty.
  const availableModels = [...new Set(options.availableModels ?? [])];
  for (const alias of ["luna", "sol", "terra"]) {
    if (!new RegExp(`\\b${alias}\\b`, "i").test(policy)) continue;
    const matches = availableModels.filter((model) => new RegExp(`(?:^|/)gpt[-_.]?5\\.6[-_.]?${alias}$`, "i").test(model));
    if (matches.length === 1) detected.push(`${alias[0].toUpperCase()}${alias.slice(1)} intent resolves to ${matches[0]} (conditional route)`);
    else if (matches.length > 1) detected.push(`${alias[0].toUpperCase()}${alias.slice(1)} intent matches available models: ${matches.join(", ")}`);
    else detected.push(`${alias[0].toUpperCase()}${alias.slice(1)} remains a providerless conditional routing intent`);
  }
  return { scope, policy, policyPath, settingsPath, detectedDefaults: [...new Set(detected)], overrides };
}

export async function installTakomiRoutingPolicy(cwd: string, input: string, options: { scope?: RoutingPolicyInstallScope } = {}): Promise<RoutingPolicyInstallResult> {
  const preview = previewTakomiRoutingPolicy(cwd, input, options);
  const { scope, policy, policyPath, settingsPath, overrides, detectedDefaults } = preview;
  await mkdir(path.dirname(policyPath), { recursive: true });
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(policyPath, `# Takomi Model Routing Policy\n\n${policy}\n`, "utf8");

  const settings = await readJsonObject(settingsPath);
  const takomi = asObject(settings.takomi);
  takomi.modelRoutingPolicyFile = scope === "project"
    ? normalizeForSettings(TAKOMI_ROUTING_POLICY_RELATIVE)
    : normalizeForSettings(GLOBAL_TAKOMI_ROUTING_POLICY_PATH);
  settings.takomi = takomi;

  if (Object.keys(overrides).length > 0) {
    const subagents = asObject(settings.subagents);
    const existingOverrides = asObject(subagents.agentOverrides);
    subagents.agentOverrides = { ...existingOverrides, ...overrides };
    settings.subagents = subagents;
  }

  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return { policyPath, settingsPath, settingsUpdated: true, detectedDefaults };
}

export function renderRoutingPolicyPreview(preview: RoutingPolicyPreviewResult): string {
  const overrideLines = Object.entries(preview.overrides).map(([role, value]) => `- ${role}: ${JSON.stringify(value)}`);
  return [
    `Scope: ${preview.scope}`,
    `Policy path: ${preview.policyPath}`,
    `Settings path: ${preview.settingsPath}`,
    "",
    preview.detectedDefaults.length ? "Detected routing defaults:" : "Detected routing defaults: none",
    ...preview.detectedDefaults.map((item) => `- ${item}`),
    "",
    overrideLines.length ? "Settings overrides to write:" : "Settings overrides to write: none",
    ...overrideLines,
  ].join("\n");
}

export async function loadTakomiRoutingPolicy(cwd: string): Promise<string | undefined> {
  return (await resolveTakomiRoutingPolicy(cwd)).text;
}
