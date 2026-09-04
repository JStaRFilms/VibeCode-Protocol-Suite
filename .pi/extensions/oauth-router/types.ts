import type { Api, AssistantMessage, Context, Model, ModelAuth, ProviderHeaders, SimpleStreamOptions } from "@earendil-works/pi-ai";

export type RouterUpstreamApi = "openai-completions" | "openai-responses" | "openai-codex-responses";
export type RouterAuthMode = "oauth" | "api-key";
export type RoutingPolicyName = "round-robin" | "weighted-round-robin";
export type AuthHealth = "ok" | "invalid";

export interface RouterModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  compat?: Record<string, unknown>;
  route?: {
    upstreamIds?: string[];
  };
}

export interface RouterProviderUsageProbeConfig {
  enabled?: boolean;
  endpoints?: string[];
  /** Total best-effort probe budget per account. Provider usage checks must not block login/refresh UX. */
  timeoutMs?: number;
}

export interface RouterUpstreamConfig {
  id: string;
  label: string;
  description?: string;
  baseUrl: string;
  api: RouterUpstreamApi;
  authMode: RouterAuthMode;
  oauthProviderId?: string;
  enabled: boolean;
  modelIds: string[];
  headers?: Record<string, string>;
  usageProbe?: RouterProviderUsageProbeConfig;
}

export interface RouterConfig {
  version: 1;
  providerName: "oauth-router";
  policy: RoutingPolicyName;
  tokenRefreshSkewMs: number;
  rateLimitCooldownMs: number;
  transientPenaltyMs: number;
  /** Default retry attempts passed to upstream providers when the caller does not specify one. */
  upstreamMaxRetries: number;
  /** Maximum provider-request retry delay when supported by the upstream provider. */
  upstreamMaxRetryDelayMs: number;
  /** Router-level same-account retries for local/client transport failures before account failover. */
  clientNetworkMaxRetries: number;
  /** First router-level retry delay for local/client transport failures. Later retries double this delay. */
  clientNetworkRetryBaseDelayMs: number;
  /** Maximum router-level retry delay for local/client transport failures. */
  clientNetworkMaxRetryDelayMs: number;
  /** Penalty for local/client transport failures. Zero records the failure without cooling down the account. */
  clientNetworkPenaltyMs: number;
  models: RouterModelConfig[];
  upstreams: RouterUpstreamConfig[];
}

export interface StoredRouterAccount {
  id: string;
  label: string;
  provider: string;
  upstreamId: string;
  access: string;
  refresh: string;
  expires: number;
  enabled: boolean;
  weight: number;
  createdAt: number;
  updatedAt: number;
  meta?: Record<string, unknown>;
}

export interface RouterCredentialStore {
  version: 1;
  accounts: StoredRouterAccount[];
}

export interface RouterUsageSample {
  at: number;
  model: string;
  status?: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  costTotal: number;
}

export interface RouterUsageWindowSummary {
  label: "5h" | "weekly";
  since: number;
  until: number;
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  costTotal: number;
}

export interface RouterProviderQuotaWindow {
  label: string;
  used?: number;
  limit?: number;
  remaining?: number;
  percentRemaining?: number;
  resetAt?: number;
  raw?: Record<string, unknown>;
}

export interface RouterProviderUsageSnapshot {
  fetchedAt: number;
  source: "token-claims" | "provider" | "local" | "unavailable";
  accountId?: string;
  planType?: string;
  email?: string;
  subject?: string;
  issuer?: string;
  audience?: string | string[];
  expires?: number;
  fiveHour?: RouterProviderQuotaWindow;
  weekly?: RouterProviderQuotaWindow;
  endpoint?: string;
  status?: number;
  rateLimitHeaders?: Record<string, string>;
  raw?: unknown;
  claimKeys?: string[];
  message?: string;
}

export interface RouterUsageSummary {
  accountId: string;
  fiveHour: RouterUsageWindowSummary;
  weekly: RouterUsageWindowSummary;
  provider?: RouterProviderUsageSnapshot;
}

export interface RouterAccountState {
  accountId: string;
  authHealth: AuthHealth;
  cooldownUntil?: number;
  penaltyUntil?: number;
  lastUsedAt?: number;
  lastTriedAt?: number;
  lastModel?: string;
  lastStatus?: number;
  lastError?: string;
  failures: number;
  rateLimitCount: number;
  authFailureCount: number;
  successCount: number;
  usageSamples: RouterUsageSample[];
  providerUsage?: RouterProviderUsageSnapshot;
}

export interface RouterRuntimeState {
  version: 1;
  policy: RoutingPolicyName;
  rrCursor: number;
  weightedCursor: number;
  accounts: Record<string, RouterAccountState>;
}

export interface RouterStatusRow {
  id: string;
  label: string;
  upstream: string;
  provider: string;
  enabled: boolean;
  weight: number;
  authHealth: AuthHealth;
  cooldownUntil?: number;
  penaltyUntil?: number;
  lastUsedAt?: number;
  lastStatus?: number;
  failures: number;
  rateLimitCount: number;
  authFailureCount: number;
  successCount: number;
  lastError?: string;
  expires: number;
}

export interface EligibleAccount {
  account: StoredRouterAccount;
  upstream: RouterUpstreamConfig;
  modelConfig: RouterModelConfig;
  state: RouterAccountState;
}

export interface DelegateSelection {
  account: StoredRouterAccount;
  upstream: RouterUpstreamConfig;
  modelConfig: RouterModelConfig;
  auth: ModelAuth;
  headers: ProviderHeaders;
  delegatedModel: Model<Api>;
}

export interface FailureClassification {
  kind: "rate-limit" | "auth" | "transient" | "client-network" | "context-overflow" | "fatal";
  status?: number;
  retryAfterMs?: number;
  message: string;
}

export interface StreamAttemptResult {
  completed: boolean;
  emittedMeaningfulOutput: boolean;
  failure?: FailureClassification;
}

export interface RouterStreamInput {
  model: Model<Api>;
  context: Context;
  options?: SimpleStreamOptions;
}

export type RouterUiEventPhase = "attempt" | "retry" | "failover" | "success" | "error";

export interface RouterUiEvent {
  phase: RouterUiEventPhase;
  modelId?: string;
  accountId?: string;
  accountLabel?: string;
  upstreamId?: string;
  failureKind?: FailureClassification["kind"];
  status?: number;
  message?: string;
  retryAttempt?: number;
  maxRetries?: number;
  delayMs?: number;
}

export type RouterUiReporter = (event: RouterUiEvent) => void;

export interface RouterErrorMessageInput {
  model: Model<Api>;
  message: string;
  stopReason?: AssistantMessage["stopReason"];
}
