import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { RouterConfig, RouterModelConfig, RouterUpstreamConfig } from "./types.ts";

export const EXTENSION_ROOT = join(homedir(), ".pi", "agent", "extensions", "oauth-router");
export const DATA_ROOT = join(homedir(), ".pi", "agent", "oauth-router");
export const CONFIG_PATH = join(DATA_ROOT, "config.json");
export const CREDENTIALS_PATH = join(DATA_ROOT, "credentials.json");
export const STATE_PATH = join(DATA_ROOT, "state.json");

const LEGACY_CODEX_CONTEXT_WINDOW = 272000;
const SAFE_CODEX_CONTEXT_WINDOW = 240000;
const CODEX_MODEL_IDS = new Set(["gpt-5.4", "gpt-5.4-mini", "gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"]);

const DEFAULT_MODELS: RouterModelConfig[] = [
  {
    id: "gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0.75, output: 4.50, cacheRead: 0.075, cacheWrite: 0.9375 },
    contextWindow: SAFE_CODEX_CONTEXT_WINDOW,
    maxTokens: 128000,
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 2.50, output: 15.00, cacheRead: 0.25, cacheWrite: 3.125 },
    contextWindow: SAFE_CODEX_CONTEXT_WINDOW,
    maxTokens: 128000,
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 5.00, output: 30.00, cacheRead: 0.50, cacheWrite: 6.25 },
    contextWindow: SAFE_CODEX_CONTEXT_WINDOW,
    maxTokens: 128000,
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1.00, output: 6.00, cacheRead: 0.10, cacheWrite: 1.25 },
    contextWindow: SAFE_CODEX_CONTEXT_WINDOW,
    maxTokens: 128000,
  },
  {
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 5.00, output: 30.00, cacheRead: 0.50, cacheWrite: 6.25 },
    contextWindow: SAFE_CODEX_CONTEXT_WINDOW,
    maxTokens: 128000,
  },
  {
    id: "gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 2.50, output: 15.00, cacheRead: 0.25, cacheWrite: 3.125 },
    contextWindow: SAFE_CODEX_CONTEXT_WINDOW,
    maxTokens: 128000,
  },
];

const DEFAULT_UPSTREAMS: RouterUpstreamConfig[] = [
  {
    id: "openai-compatible",
    label: "OpenAI Compatible API",
    description: "API-key fallback route for standard OpenAI-compatible responses endpoints.",
    baseUrl: "https://api.openai.com/v1",
    api: "openai-responses",
    authMode: "api-key",
    enabled: true,
    modelIds: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"],
  },
  {
    id: "chatgpt-codex",
    label: "ChatGPT Codex OAuth",
    description: "OAuth-backed ChatGPT Plus/Pro Codex route using Pi's OpenAI Codex OAuth implementation.",
    baseUrl: "https://chatgpt.com/backend-api",
    api: "openai-codex-responses",
    authMode: "oauth",
    oauthProviderId: "openai-codex",
    enabled: true,
    modelIds: ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"],
    usageProbe: {
      enabled: true,
      timeoutMs: 8_000,
      endpoints: [
        "/wham/usage",
        "/codex/usage",
        "/codex/limits",
        "/codex/rate_limits",
        "/codex/subscription",
      ],
    },
  },
];

export const DEFAULT_CONFIG: RouterConfig = {
  version: 1,
  providerName: "oauth-router",
  policy: "round-robin",
  tokenRefreshSkewMs: 60_000,
  rateLimitCooldownMs: 120_000,
  transientPenaltyMs: 30_000,
  upstreamMaxRetries: 0,
  upstreamMaxRetryDelayMs: 60_000,
  clientNetworkMaxRetries: 5,
  clientNetworkRetryBaseDelayMs: 5_000,
  clientNetworkMaxRetryDelayMs: 60_000,
  clientNetworkPenaltyMs: 0,
  models: DEFAULT_MODELS,
  upstreams: DEFAULT_UPSTREAMS,
};

function applySecurePermissions(filePath: string, mode: number) {
  try {
    chmodSync(filePath, mode);
  } catch {
    // Best effort only. Windows commonly ignores POSIX chmod semantics.
  }
}

export function ensureDirectory(filePath: string) {
  mkdirSync(filePath, { recursive: true, mode: 0o700 });
  applySecurePermissions(filePath, 0o700);
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const HELD_JSON_LOCKS = new Set<string>();
const JSON_LOCK_WAIT_TIMEOUT_MS = 2_000;
const JSON_LOCK_STALE_AFTER_MS = 5_000;

export function withJsonFileLock<T>(filePath: string, fn: () => T): T {
  const lockPath = `${filePath}.lock`;
  if (HELD_JSON_LOCKS.has(lockPath)) return fn();
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(lockPath, { mode: 0o700 });
      break;
    } catch {
      try {
        const ageMs = Date.now() - statSync(lockPath).mtimeMs;
        if (ageMs > JSON_LOCK_STALE_AFTER_MS) rmSync(lockPath, { recursive: true, force: true });
      } catch {
        // The lock disappeared between mkdir attempts.
      }
      if (Date.now() - started > JSON_LOCK_WAIT_TIMEOUT_MS) {
        throw new Error(`Timed out after ${JSON_LOCK_WAIT_TIMEOUT_MS}ms waiting for oauth-router JSON lock: ${lockPath}`);
      }
      sleepSync(50);
    }
  }

  HELD_JSON_LOCKS.add(lockPath);
  try {
    return fn();
  } finally {
    HELD_JSON_LOCKS.delete(lockPath);
    rmSync(lockPath, { recursive: true, force: true });
  }
}

export function writeJsonFile(filePath: string, value: unknown, secure = true) {
  ensureDirectory(dirname(filePath));
  withJsonFileLock(filePath, () => {
    const mode = secure ? 0o600 : 0o644;
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode });
      applySecurePermissions(tempPath, mode);
      renameSync(tempPath, filePath);
      applySecurePermissions(filePath, mode);
    } catch (error) {
      rmSync(tempPath, { force: true });
      throw error;
    }
  });
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeModelConfigs(candidateModels: RouterModelConfig[] | undefined): RouterModelConfig[] {
  if (!Array.isArray(candidateModels) || candidateModels.length === 0) {
    return deepClone(DEFAULT_CONFIG.models);
  }

  const defaultIds = new Set(DEFAULT_CONFIG.models.map((m) => m.id));
  const merged = new Map(DEFAULT_CONFIG.models.map((model) => [model.id, deepClone(model)]));
  for (const model of candidateModels) {
    if (!defaultIds.has(model.id)) {
      continue;
    }
    const previous = merged.get(model.id) ?? ({} as RouterModelConfig);
    merged.set(model.id, { ...previous, ...deepClone(model), id: model.id });
  }
  return Array.from(merged.values()).map((model) => {
    if (CODEX_MODEL_IDS.has(model.id) && model.contextWindow === LEGACY_CODEX_CONTEXT_WINDOW) {
      return { ...model, contextWindow: SAFE_CODEX_CONTEXT_WINDOW };
    }
    return model;
  });
}

function mergeUpstreamConfigs(candidateUpstreams: RouterUpstreamConfig[] | undefined): RouterUpstreamConfig[] {
  if (!Array.isArray(candidateUpstreams) || candidateUpstreams.length === 0) {
    return deepClone(DEFAULT_CONFIG.upstreams);
  }

  const defaultModelIds = new Set(DEFAULT_CONFIG.models.map((m) => m.id));
  const merged = new Map(DEFAULT_CONFIG.upstreams.map((upstream) => [upstream.id, deepClone(upstream)]));
  for (const upstream of candidateUpstreams) {
    const previous = merged.get(upstream.id);
    if (!previous) {
      merged.set(upstream.id, deepClone(upstream));
      continue;
    }

    const modelIds = Array.from(new Set([...(previous.modelIds ?? []), ...(upstream.modelIds ?? [])]))
      .filter((id) => defaultModelIds.has(id));
    const usageProbe = {
      ...(previous.usageProbe ?? {}),
      ...(upstream.usageProbe ?? {}),
      endpoints: Array.from(new Set([...(previous.usageProbe?.endpoints ?? []), ...(upstream.usageProbe?.endpoints ?? [])])),
    };
    merged.set(upstream.id, { ...previous, ...deepClone(upstream), id: upstream.id, modelIds, usageProbe });
  }
  return Array.from(merged.values());
}

function mergeConfig(candidate: Partial<RouterConfig> | undefined): RouterConfig {
  return {
    ...DEFAULT_CONFIG,
    ...candidate,
    providerName: "oauth-router",
    version: 1,
    models: mergeModelConfigs(candidate?.models),
    upstreams: mergeUpstreamConfigs(candidate?.upstreams),
  };
}

export function loadRouterConfig(): RouterConfig {
  ensureDirectory(DATA_ROOT);

  if (!existsSync(CONFIG_PATH)) {
    const initial = deepClone(DEFAULT_CONFIG);
    writeJsonFile(CONFIG_PATH, initial, false);
    return initial;
  }

  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<RouterConfig>;
    const merged = mergeConfig(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(merged)) {
      writeJsonFile(CONFIG_PATH, merged, false);
    }
    return merged;
  } catch {
    const fallback = deepClone(DEFAULT_CONFIG);
    writeJsonFile(CONFIG_PATH, fallback, false);
    return fallback;
  }
}
