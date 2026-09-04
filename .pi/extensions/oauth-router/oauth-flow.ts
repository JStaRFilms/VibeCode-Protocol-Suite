import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import type { AuthEvent, AuthPrompt, ModelAuth, OAuthCredential, OAuthCredentials, Provider } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { githubCopilotProvider } from "@earendil-works/pi-ai/providers/github-copilot";
import { kimiCodingProvider } from "@earendil-works/pi-ai/providers/kimi-coding";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { xaiProvider } from "@earendil-works/pi-ai/providers/xai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { RouterProviderQuotaWindow, RouterProviderUsageSnapshot, RouterUpstreamConfig, StoredRouterAccount } from "./types.ts";

function now() {
  return Date.now();
}

function normalizeCredentials(credentials: OAuthCredentials) {
  const { access, refresh, expires, type: _type, ...meta } = credentials;
  return {
    access,
    refresh,
    expires,
    meta,
  };
}

export function openUrlInBrowser(url: string) {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return;
    }

    if (platform === "darwin") {
      const child = spawn("open", [url], { detached: true, stdio: "ignore" });
      child.unref();
      return;
    }

    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // Best effort only.
  }
}

async function promptRequired(ctx: ExtensionContext, message: string, placeholder?: string): Promise<string> {
  const response = await ctx.ui.input(message, placeholder);
  if (response === undefined) throw new Error("Cancelled by user");
  return response;
}

const oauthProviders: readonly Provider[] = [
  anthropicProvider(),
  githubCopilotProvider(),
  kimiCodingProvider(),
  openaiCodexProvider(),
  openrouterProvider(),
  xaiProvider(),
];

function getOAuthProvider(providerId: string) {
  const provider = oauthProviders.find((candidate) => candidate.id === providerId);
  return provider?.auth.oauth ? { name: provider.name, oauth: provider.auth.oauth } : undefined;
}

async function handleAuthPrompt(ctx: ExtensionContext, prompt: AuthPrompt): Promise<string> {
  if (prompt.signal?.aborted) throw new Error("Cancelled by user");

  if (prompt.type !== "select") {
    return promptRequired(ctx, prompt.message, prompt.placeholder);
  }

  if (!prompt.options.length) throw new Error("OAuth provider supplied no choices");
  if (!ctx.hasUI) return prompt.options[0].id;

  const labels = prompt.options.map((option) => `${option.id} — ${option.label}`);
  const choice = await ctx.ui.select(prompt.message, labels);
  if (!choice) throw new Error("Cancelled by user");
  const id = choice.split(" — ")[0]?.trim();
  const selected = prompt.options.find((option) => option.id === id)?.id;
  if (!selected) throw new Error("OAuth provider returned an unknown choice");
  return selected;
}

function handleAuthEvent(ctx: ExtensionContext, providerName: string, event: AuthEvent): void {
  switch (event.type) {
    case "auth_url":
      openUrlInBrowser(event.url);
      ctx.ui.notify(`${providerName}: ${event.instructions ?? "Finish login in your browser."}`, "info");
      ctx.ui.notify(event.url, "info");
      return;
    case "device_code":
      openUrlInBrowser(event.verificationUri);
      ctx.ui.notify(`${providerName}: device code ${event.userCode}`, "info");
      ctx.ui.notify(`Open ${event.verificationUri} and enter code ${event.userCode}`, "info");
      return;
    case "progress":
      ctx.ui.notify(event.message, "info");
      return;
    case "info":
      ctx.ui.notify(`${providerName}: ${event.message}`, "info");
      for (const link of event.links ?? []) ctx.ui.notify(link.url, "info");
  }
}

export async function createAccountFromUpstream(
  upstream: RouterUpstreamConfig,
  label: string,
  ctx: ExtensionContext,
): Promise<StoredRouterAccount> {
  const createdAt = now();

  if (upstream.authMode === "api-key") {
    const token = await promptRequired(ctx, `Enter API key or bearer token for ${upstream.label}:`);
    return {
      id: `acct_${randomUUID().slice(0, 8)}`,
      label,
      provider: "api-key",
      upstreamId: upstream.id,
      access: token.trim(),
      refresh: "",
      expires: Number.MAX_SAFE_INTEGER,
      enabled: true,
      weight: 1,
      createdAt,
      updatedAt: createdAt,
      meta: {},
    };
  }

  if (!upstream.oauthProviderId) {
    throw new Error(`Upstream ${upstream.id} is missing oauthProviderId`);
  }

  const provider = getOAuthProvider(upstream.oauthProviderId);
  if (!provider) {
    throw new Error(`OAuth provider not available: ${upstream.oauthProviderId}`);
  }

  const credentials = await provider.oauth.login({
    prompt: (prompt) => handleAuthPrompt(ctx, prompt),
    notify: (event) => handleAuthEvent(ctx, provider.name, event),
    signal: ctx.signal ?? new AbortController().signal,
  });

  const normalized = normalizeCredentials(credentials);

  return {
    id: `acct_${randomUUID().slice(0, 8)}`,
    label,
    provider: upstream.oauthProviderId,
    upstreamId: upstream.id,
    access: normalized.access,
    refresh: normalized.refresh,
    expires: normalized.expires,
    enabled: true,
    weight: 1,
    createdAt,
    updatedAt: createdAt,
    meta: normalized.meta,
  };
}

function toCredentials(account: StoredRouterAccount): OAuthCredential {
  return {
    type: "oauth",
    access: account.access,
    refresh: account.refresh,
    expires: account.expires,
    ...(account.meta ?? {}),
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const [, payload] = token.split(".");
  if (!payload) return undefined;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function getStringClaim(claims: Record<string, unknown>, key: string): string | undefined {
  const value = claims[key];
  return typeof value === "string" && value ? value : undefined;
}

function getAudience(claims: Record<string, unknown>): string | string[] | undefined {
  const audience = claims.aud;
  if (typeof audience === "string") return audience;
  if (Array.isArray(audience) && audience.every((item) => typeof item === "string")) return audience as string[];
  return undefined;
}

function getOpenAIAuthClaim(claims: Record<string, unknown>): Record<string, unknown> | undefined {
  const value = claims["https://api.openai.com/auth"];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function inspectAccountToken(account: StoredRouterAccount): RouterProviderUsageSnapshot {
  const claims = decodeJwtPayload(account.access);
  if (!claims) {
    return {
      fetchedAt: now(),
      source: "unavailable",
      accountId: typeof account.meta?.accountId === "string" ? account.meta.accountId : undefined,
      expires: account.expires,
      message: "Access token is not a readable JWT or exposes no local claims. Provider-side usage needs an authenticated usage endpoint.",
    };
  }

  const openaiAuth = getOpenAIAuthClaim(claims);
  const exp = typeof claims.exp === "number" && Number.isFinite(claims.exp) ? claims.exp * 1000 : account.expires;
  const accountId =
    (typeof account.meta?.accountId === "string" ? account.meta.accountId : undefined) ??
    (openaiAuth && getStringClaim(openaiAuth, "chatgpt_account_id")) ??
    getStringClaim(claims, "account_id");
  const planType =
    (typeof account.meta?.planType === "string" ? account.meta.planType : undefined) ??
    (openaiAuth && (getStringClaim(openaiAuth, "chatgpt_plan_type") ?? getStringClaim(openaiAuth, "plan_type") ?? getStringClaim(openaiAuth, "planType"))) ??
    getStringClaim(claims, "chatgpt_plan_type") ??
    getStringClaim(claims, "plan_type") ??
    getStringClaim(claims, "planType");

  return {
    fetchedAt: now(),
    source: "token-claims",
    accountId,
    planType,
    email: getStringClaim(claims, "email"),
    subject: getStringClaim(claims, "sub"),
    issuer: getStringClaim(claims, "iss"),
    audience: getAudience(claims),
    expires: exp,
    claimKeys: Object.keys(claims).sort(),
    message: "Token claims expose identity/expiry metadata only. 5h and weekly quota windows are not present in this token snapshot; local router-observed usage is shown separately.",
  };
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function walkRecords(value: unknown, visit: (record: Record<string, unknown>) => void, depth = 0) {
  if (depth > 8) return;
  if (Array.isArray(value)) {
    for (const item of value) walkRecords(item, visit, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  visit(value);
  for (const item of Object.values(value)) walkRecords(item, visit, depth + 1);
}

function normalizeResetAt(record: Record<string, unknown>): number | undefined {
  const seconds = firstNumber(record.reset_after_seconds, record.resetAfterSeconds, record.resets_in_seconds, record.resetsInSeconds);
  if (seconds !== undefined) return now() + seconds * 1000;
  const raw = firstNumber(record.reset_at, record.resetAt, record.resets_at, record.resetsAt, record.next_reset_at, record.nextResetAt);
  if (raw === undefined) return undefined;
  return raw < 10_000_000_000 ? raw * 1000 : raw;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function quotaFromRecord(label: string, record: Record<string, unknown>): RouterProviderQuotaWindow | undefined {
  const limit = firstNumber(record.limit, record.cap, record.total, record.max, record.quota);
  const remaining = firstNumber(record.remaining, record.available, record.left, record.remaining_messages, record.remainingMessages);
  const used = firstNumber(record.used, record.consumed, record.current, record.used_messages, record.usedMessages);
  const usedPercent = firstNumber(record.used_percent, record.usedPercent);
  const percentRemaining = firstNumber(record.percent_remaining, record.percentRemaining, record.remaining_percent, record.remainingPercent) ?? (usedPercent !== undefined ? 100 - clampPercent(usedPercent) : undefined);
  const resetAt = normalizeResetAt(record);

  if (limit === undefined && remaining === undefined && used === undefined && percentRemaining === undefined && resetAt === undefined) {
    return undefined;
  }

  return {
    label,
    used,
    limit,
    remaining,
    percentRemaining: percentRemaining !== undefined ? clampPercent(percentRemaining) : limit && remaining !== undefined ? clampPercent((remaining / limit) * 100) : undefined,
    resetAt,
  };
}

function quotaFromWhamWindow(label: string, window: Record<string, unknown> | undefined, limitReached?: boolean): RouterProviderQuotaWindow | undefined {
  if (!window) return undefined;

  const usedPercent = firstNumber(window.used_percent, window.usedPercent);
  const explicitRemainingPercent = firstNumber(window.percent_remaining, window.percentRemaining, window.remaining_percent, window.remainingPercent);
  const percentRemaining = explicitRemainingPercent ?? (usedPercent !== undefined ? 100 - clampPercent(usedPercent) : limitReached ? 0 : undefined);
  const resetAt = normalizeResetAt(window);

  if (percentRemaining === undefined && resetAt === undefined) return undefined;

  return {
    label,
    percentRemaining: percentRemaining !== undefined ? clampPercent(percentRemaining) : undefined,
    resetAt,
  };
}

function mergeQuota(previous: RouterProviderQuotaWindow | undefined, next: RouterProviderQuotaWindow | undefined): RouterProviderQuotaWindow | undefined {
  if (!previous) return next;
  if (!next) return previous;
  return { ...previous, ...next };
}

function pickWindow(record: Record<string, unknown>, snakeKey: string, camelKey: string): Record<string, unknown> | undefined {
  const snake = record[snakeKey];
  if (isRecord(snake)) return snake;
  const camel = record[camelKey];
  return isRecord(camel) ? camel : undefined;
}

function extractWhamUsage(json: unknown): Pick<RouterProviderUsageSnapshot, "planType" | "fiveHour" | "weekly"> {
  if (!isRecord(json)) return {};

  const planType = firstString(json.plan_type, json.planType, json.plan, json.subscription_plan, json.subscriptionPlan);
  const rateLimit = isRecord(json.rate_limit) ? json.rate_limit : isRecord(json.rateLimit) ? json.rateLimit : undefined;
  if (!rateLimit) return { planType };

  const limitReached = Boolean(rateLimit.limit_reached ?? rateLimit.limitReached);
  return {
    planType,
    fiveHour: quotaFromWhamWindow("5h", pickWindow(rateLimit, "primary_window", "primaryWindow"), limitReached),
    weekly: quotaFromWhamWindow("weekly", pickWindow(rateLimit, "secondary_window", "secondaryWindow"), limitReached),
  };
}

function extractProviderUsage(json: unknown): Pick<RouterProviderUsageSnapshot, "planType" | "fiveHour" | "weekly"> {
  const wham = extractWhamUsage(json);
  let planType = wham.planType;
  let fiveHour = wham.fiveHour;
  let weekly = wham.weekly;

  if (fiveHour || weekly) return { planType, fiveHour, weekly };

  walkRecords(json, (record) => {
    planType ??= firstString(record.plan_type, record.planType, record.plan, record.subscription_plan, record.subscriptionPlan, record.account_plan, record.accountPlan);

    const rateLimit = isRecord(record.rate_limit) ? record.rate_limit : isRecord(record.rateLimit) ? record.rateLimit : undefined;
    if (rateLimit) {
      fiveHour = mergeQuota(fiveHour, quotaFromWhamWindow("5h", pickWindow(rateLimit, "primary_window", "primaryWindow"), Boolean(rateLimit.limit_reached ?? rateLimit.limitReached)));
      weekly = mergeQuota(weekly, quotaFromWhamWindow("weekly", pickWindow(rateLimit, "secondary_window", "secondaryWindow"), Boolean(rateLimit.limit_reached ?? rateLimit.limitReached)));
    }

    const name = [record.name, record.label, record.bucket, record.window, record.period, record.type, record.key, record.id]
      .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
      .join(" ");

    const directFive = isRecord(record.five_hour) ? record.five_hour : isRecord(record.fiveHour) ? record.fiveHour : isRecord(record["5h"]) ? record["5h"] : undefined;
    const directWeekly = isRecord(record.weekly) ? record.weekly : isRecord(record.week) ? record.week : isRecord(record["7d"]) ? record["7d"] : undefined;
    fiveHour = mergeQuota(fiveHour, directFive ? quotaFromRecord("5h", directFive) : undefined);
    weekly = mergeQuota(weekly, directWeekly ? quotaFromRecord("weekly", directWeekly) : undefined);

    if (/5\s*h|five.?hour|primary.?window/.test(name)) {
      fiveHour = mergeQuota(fiveHour, quotaFromRecord("5h", record));
    }
    if (/week|weekly|7\s*d|secondary.?window/.test(name)) {
      weekly = mergeQuota(weekly, quotaFromRecord("weekly", record));
    }
  });

  return { planType, fiveHour, weekly };
}

function resolveProbeUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

function collectRateLimitHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (/rate.?limit|reset|remaining|quota/i.test(key)) result[key] = value;
  }
  return result;
}

const DEFAULT_USAGE_PROBE_TIMEOUT_MS = 2_500;

function getUsageProbeTimeoutMs(upstream: RouterUpstreamConfig): number {
  const configured = upstream.usageProbe?.timeoutMs;
  return typeof configured === "number" && Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 10_000)
    : DEFAULT_USAGE_PROBE_TIMEOUT_MS;
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<{ response: Response; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`timed out after ${Math.round(timeoutMs)}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshProviderUsageSnapshot(account: StoredRouterAccount, upstream: RouterUpstreamConfig): Promise<RouterProviderUsageSnapshot> {
  const base = inspectAccountToken(account);
  if (account.provider !== "openai-codex" || upstream.usageProbe?.enabled === false) return base;

  const accountId = base.accountId;
  const endpoints = Array.from(new Set(["/wham/usage", ...(upstream.usageProbe?.endpoints ?? [])]));
  if (endpoints.length === 0) {
    return { ...base, message: `${base.message ?? "Token inspected."} No provider usage probe endpoints are configured.` };
  }

  let lastStatus: number | undefined;
  let lastEndpoint: string | undefined;
  let lastHeaders: Record<string, string> | undefined;
  const errors: string[] = [];
  const startedAt = now();
  const totalTimeoutMs = getUsageProbeTimeoutMs(upstream);

  for (const endpoint of endpoints) {
    const remainingMs = totalTimeoutMs - (now() - startedAt);
    if (remainingMs <= 0) {
      errors.push(`probe timed out after ${Math.round(totalTimeoutMs)}ms`);
      break;
    }

    const url = resolveProbeUrl(upstream.baseUrl, endpoint);
    lastEndpoint = url;
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${account.access}`,
        Originator: "codex_cli_rs",
        originator: "codex_cli_rs",
        "User-Agent": "codex_cli_rs/0.133.0 (Windows; x86_64) pi/oauth-router",
        accept: "application/json",
      };
      if (accountId) {
        headers["ChatGPT-Account-Id"] = accountId;
        headers["chatgpt-account-id"] = accountId;
      }

      const { response, text } = await fetchJsonWithTimeout(url, {
        method: "GET",
        headers,
      }, Math.max(1, remainingMs));
      lastStatus = response.status;
      lastHeaders = collectRateLimitHeaders(response.headers);
      const json = text ? JSON.parse(text) : undefined;
      const extracted = extractProviderUsage(json);
      const hasQuota = Boolean(extracted.fiveHour || extracted.weekly || extracted.planType);
      if (response.ok && hasQuota) {
        return {
          ...base,
          source: extracted.fiveHour || extracted.weekly ? "provider" : "token-claims",
          fetchedAt: now(),
          planType: extracted.planType ?? base.planType,
          fiveHour: extracted.fiveHour,
          weekly: extracted.weekly,
          endpoint: url,
          status: response.status,
          rateLimitHeaders: lastHeaders,
          message: extracted.fiveHour || extracted.weekly
            ? "Provider-side quota metadata was extracted from an authenticated ChatGPT/Codex endpoint."
            : "Provider endpoint responded, but no 5h/weekly quota windows were found; token identity metadata is shown.",
        };
      }
      errors.push(`${endpoint}: HTTP ${response.status}${hasQuota ? " partial metadata only" : " no quota fields"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${endpoint}: ${message}`);
    }
  }

  return {
    ...base,
    fetchedAt: now(),
    endpoint: lastEndpoint,
    status: lastStatus,
    rateLimitHeaders: lastHeaders,
    message: `Provider quota probe did not find 5h/weekly windows. Tried ${endpoints.length} endpoint(s): ${errors.slice(0, 4).join("; ")}${errors.length > 4 ? "; …" : ""}`,
  };
}

export async function refreshAccountCredentials(
  account: StoredRouterAccount,
  signal: AbortSignal = new AbortController().signal,
): Promise<StoredRouterAccount> {
  if (account.provider === "api-key") return account;

  const provider = getOAuthProvider(account.provider);
  if (!provider) throw new Error(`OAuth provider not available: ${account.provider}`);

  const refreshed = await provider.oauth.refresh(toCredentials(account), signal);
  const normalized = normalizeCredentials(refreshed);

  return {
    ...account,
    access: normalized.access,
    refresh: normalized.refresh,
    expires: normalized.expires,
    meta: normalized.meta,
    updatedAt: now(),
  };
}

export async function getModelAuthForAccount(account: StoredRouterAccount): Promise<ModelAuth> {
  if (account.provider === "api-key") return { apiKey: account.access };

  const provider = getOAuthProvider(account.provider);
  if (!provider) throw new Error(`OAuth provider not available: ${account.provider}`);
  const auth = await provider.oauth.toAuth(toCredentials(account));
  if (!auth.apiKey && !auth.headers) {
    throw new Error(`OAuth provider supplied no routable credentials: ${account.provider}`);
  }
  return auth;
}
