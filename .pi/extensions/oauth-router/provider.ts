import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEvent,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
  streamSimpleOpenAICodexResponses,
  streamSimpleOpenAICompletions,
  streamSimpleOpenAIResponses,
} from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadRouterConfig } from "./config.ts";
import { refreshAccountCredentials, getModelAuthForAccount, refreshProviderUsageSnapshot } from "./oauth-flow.ts";
import { RouterAccountStore } from "./oauth-store.ts";
import { chooseEligibleAccount } from "./policies.ts";
import { RouterStateStore } from "./state.ts";
import type {
  DelegateSelection,
  EligibleAccount,
  FailureClassification,
  RouterConfig,
  RouterErrorMessageInput,
  RouterModelConfig,
  RouterStatusRow,
  RouterUiEvent,
  RouterUiReporter,
  RouterUpstreamConfig,
  RoutingPolicyName,
  StoredRouterAccount,
} from "./types.ts";

function now() {
  return Date.now();
}

function parseRetryAfterMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp)) return Math.max(0, timestamp - now());
  return undefined;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Request was aborted"));
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new Error("Request was aborted"));
    }, { once: true });
  });
}

function isMeaningfulEvent(event: AssistantMessageEvent): boolean {
  switch (event.type) {
    case "text_delta":
    case "thinking_delta":
    case "toolcall_delta":
      return event.delta.length > 0;
    case "text_end":
    case "thinking_end":
      return event.content.length > 0;
    case "toolcall_end":
      return true;
    case "done":
      return event.message.content.length > 0;
    default:
      return false;
  }
}

function createErrorMessage({ model, message, stopReason = "error" }: RouterErrorMessageInput): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason,
    errorMessage: message,
    timestamp: Date.now(),
  };
}

function isAbortLike(message?: string, signal?: AbortSignal, stopReason?: string): boolean {
  if (signal?.aborted || stopReason === "aborted") return true;
  const lower = (message ?? "").toLowerCase();
  return lower.includes("abort") || lower.includes("cancelled") || lower.includes("canceled");
}

function isClientNetworkFailure(lower: string): boolean {
  return [
    "codex sse response headers timed out",
    "response headers timed out",
    "headers timeout",
    "headers timed out",
    "fetch failed",
    "network",
    "econnreset",
    "etimedout",
    "enotfound",
    "eai_again",
    "socket hang up",
    "connection reset",
    "connection terminated",
    "und_err_headers_timeout",
  ].some((token) => lower.includes(token));
}

function isContextOverflowFailure(lower: string): boolean {
  return [
    "context_length_exceeded",
    "context length exceeded",
    "context window exceeded",
    "exceeds the context window",
    "exceeds the model's maximum context length",
    "exceeds model's maximum context length",
    "maximum context length",
    "too many tokens",
    "token limit exceeded",
  ].some((token) => lower.includes(token));
}

function classifyFailure(
  status: number | undefined,
  headers: Record<string, string>,
  message: string,
  config: RouterConfig,
): FailureClassification {
  const retryAfterMs = parseRetryAfterMs(headers["retry-after"]) ?? config.rateLimitCooldownMs;
  const lower = message.toLowerCase();

  if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return { kind: "rate-limit", status: status ?? 429, retryAfterMs, message };
  }

  if (isContextOverflowFailure(lower)) {
    return { kind: "context-overflow", status, message };
  }

  if (status === 401 || status === 403 || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return { kind: "auth", status: status ?? 401, message };
  }

  if (isClientNetworkFailure(lower)) {
    return { kind: "client-network", status, message };
  }

  if (status !== undefined && status >= 500) {
    return { kind: "transient", status, message };
  }

  if (lower.includes("timeout") || lower.includes("service unavailable") || lower.includes("overloaded")) {
    return { kind: "transient", status: status ?? 500, message };
  }

  return { kind: "fatal", status, message };
}

function delegateStream(
  upstream: RouterUpstreamConfig,
  model: Model<Api>,
  context: Context,
  options: SimpleStreamOptions | undefined,
): AssistantMessageEventStream {
  switch (upstream.api) {
    case "openai-completions":
      return streamSimpleOpenAICompletions(model as Model<"openai-completions">, context, options);
    case "openai-responses":
      return streamSimpleOpenAIResponses(model as Model<"openai-responses">, context, options);
    case "openai-codex-responses":
      return streamSimpleOpenAICodexResponses(model as Model<"openai-codex-responses">, context, options);
    default:
      throw new Error(`Unsupported upstream api: ${upstream.api}`);
  }
}

export class RouterRuntime {
  private config: RouterConfig;
  private accounts: RouterAccountStore;
  private state: RouterStateStore;
  private uiReporter?: RouterUiReporter;

  constructor() {
    this.config = loadRouterConfig();
    this.accounts = new RouterAccountStore();
    this.state = new RouterStateStore(this.config.policy);
    this.state.pruneAccountIds(this.accounts.list().map((account) => account.id));
  }

  reloadConfig() {
    this.config = loadRouterConfig();
    this.accounts.reload();
    this.state.pruneAccountIds(this.accounts.list().map((account) => account.id));
  }

  setUiReporter(reporter?: RouterUiReporter) {
    this.uiReporter = reporter;
  }

  private emitUi(event: RouterUiEvent) {
    try {
      this.uiReporter?.(event);
    } catch {
      // UI updates must never affect model streaming or retry behavior.
    }
  }

  getConfig(): RouterConfig {
    this.reloadConfig();
    return this.config;
  }

  listUpstreams(): RouterUpstreamConfig[] {
    return this.getConfig().upstreams;
  }

  listAccounts(): StoredRouterAccount[] {
    this.reloadConfig();
    return this.accounts.list();
  }

  getAccount(id: string): StoredRouterAccount | undefined {
    this.reloadConfig();
    return this.accounts.get(id);
  }

  addAccount(account: StoredRouterAccount) {
    this.accounts.add(account);
    this.state.ensureAccount(account.id);
  }

  updateAccount(account: StoredRouterAccount) {
    this.accounts.update(account);
    this.state.ensureAccount(account.id);
  }

  removeAccount(id: string) {
    this.accounts.remove(id);
    this.state.pruneAccountIds(this.accounts.list().map((account) => account.id));
  }

  renameAccount(id: string, label: string) {
    this.accounts.rename(id, label);
  }

  setEnabled(id: string, enabled: boolean) {
    this.accounts.setEnabled(id, enabled);
    if (enabled) this.state.clearHealth(id);
  }

  setWeight(id: string, weight: number) {
    this.accounts.setWeight(id, weight);
  }

  clearAccountHealth(id: string) {
    this.state.clearHealth(id);
  }

  getUsageSummaries() {
    this.reloadConfig();
    return this.accounts.list().map((account) => this.state.getUsageSummary(account.id));
  }

  getUsageSummary(id: string) {
    this.reloadConfig();
    if (!this.accounts.get(id)) throw new Error(`Unknown account: ${id}`);
    return this.state.getUsageSummary(id);
  }

  async refreshUsageSnapshot(id: string) {
    this.reloadConfig();
    let account = this.accounts.get(id);
    if (!account) throw new Error(`Unknown account: ${id}`);
    const upstream = this.getUpstream(account.upstreamId);
    if (!upstream) throw new Error(`Unknown upstream for account ${id}: ${account.upstreamId}`);

    const refreshIfPossible = async (reason: string): Promise<boolean> => {
      if (!account || account.provider === "api-key") return false;
      try {
        account = await refreshAccountCredentials(account);
        this.accounts.update(account);
        this.state.clearHealth(id);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.state.markAuthFailure(id, 401, `Unable to refresh OAuth credentials for usage probe (${reason}): ${message}`);
        throw error;
      }
    };

    if (account.provider !== "api-key" && account.expires - this.config.tokenRefreshSkewMs <= now()) {
      await refreshIfPossible("expired access token");
    }

    let snapshot = await refreshProviderUsageSnapshot(account, upstream);
    if (account.provider !== "api-key" && (snapshot.status === 401 || snapshot.status === 403)) {
      const refreshed = await refreshIfPossible(`provider quota probe returned HTTP ${snapshot.status}`);
      if (refreshed) snapshot = await refreshProviderUsageSnapshot(account, upstream);
    }

    this.state.setProviderUsage(id, snapshot);
    return snapshot;
  }

  resetUsage(id: string) {
    this.reloadConfig();
    if (!this.accounts.get(id)) throw new Error(`Unknown account: ${id}`);
    this.state.resetUsage(id);
  }

  setPolicy(policy: RoutingPolicyName) {
    this.state.setPolicy(policy);
  }

  getPolicy(): RoutingPolicyName {
    return this.state.getPolicy(this.config.policy);
  }

  async refreshAccount(id: string): Promise<StoredRouterAccount> {
    const account = this.accounts.get(id);
    if (!account) throw new Error(`Unknown account: ${id}`);
    const refreshed = await refreshAccountCredentials(account);
    this.accounts.update(refreshed);
    this.state.clearHealth(id);
    return refreshed;
  }

  getProviderModels() {
    return this.getConfig().models.map((model) => ({
      id: model.id,
      name: model.name,
      reasoning: model.reasoning,
      input: model.input,
      cost: model.cost,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      compat: model.compat,
    }));
  }

  getStatusRows(): RouterStatusRow[] {
    this.reloadConfig();
    return this.accounts.list().map((account) => {
      const state = this.state.ensureAccount(account.id);
      return {
        id: account.id,
        label: account.label,
        upstream: account.upstreamId,
        provider: account.provider,
        enabled: account.enabled,
        weight: account.weight,
        authHealth: state.authHealth,
        cooldownUntil: state.cooldownUntil,
        penaltyUntil: state.penaltyUntil,
        lastUsedAt: state.lastUsedAt,
        lastStatus: state.lastStatus,
        failures: state.failures,
        rateLimitCount: state.rateLimitCount,
        authFailureCount: state.authFailureCount,
        successCount: state.successCount,
        lastError: state.lastError,
        expires: account.expires,
      };
    });
  }

  private getModelConfig(modelId: string): RouterModelConfig {
    const model = this.config.models.find((entry) => entry.id === modelId);
    if (!model) throw new Error(`Model is not configured for oauth-router: ${modelId}`);
    return model;
  }

  private getUpstream(upstreamId: string): RouterUpstreamConfig | undefined {
    return this.config.upstreams.find((upstream) => upstream.id === upstreamId);
  }

  private getEligibleAccounts(modelId: string, excludedIds: Set<string>): EligibleAccount[] {
    const modelConfig = this.getModelConfig(modelId);
    const allowedUpstreams = new Set(modelConfig.route?.upstreamIds ?? []);
    const hasRouteFilter = allowedUpstreams.size > 0;
    const currentTime = now();

    return this.accounts
      .list()
      .filter((account) => !excludedIds.has(account.id))
      .map((account) => ({ account, upstream: this.getUpstream(account.upstreamId), state: this.state.ensureAccount(account.id) }))
      .filter((entry): entry is { account: StoredRouterAccount; upstream: RouterUpstreamConfig; state: ReturnType<RouterStateStore["ensureAccount"]> } => Boolean(entry.upstream))
      .filter(({ account, upstream, state }) => {
        if (!account.enabled) return false;
        if (!upstream.enabled) return false;
        if (!upstream.modelIds.includes(modelId)) return false;
        if (hasRouteFilter && !allowedUpstreams.has(upstream.id)) return false;
        if (state.authHealth === "invalid") return false;
        if (state.cooldownUntil && state.cooldownUntil > currentTime) return false;
        if (state.penaltyUntil && state.penaltyUntil > currentTime) return false;
        return true;
      })
      .map(({ account, upstream, state }) => ({ account, upstream, modelConfig, state }));
  }

  private async prepareSelection(
    eligible: EligibleAccount,
    model: Model<Api>,
    options?: SimpleStreamOptions,
  ): Promise<DelegateSelection> {
    let account = eligible.account;

    if (account.provider !== "api-key" && account.expires - this.config.tokenRefreshSkewMs <= now()) {
      account = await refreshAccountCredentials(account);
      this.accounts.update(account);
      this.state.clearHealth(account.id);
    }

    const auth = await getModelAuthForAccount(account);
    const headers = {
      ...(eligible.upstream.headers ?? {}),
      ...(auth.headers ?? {}),
    };
    const delegatedModel = {
      ...model,
      id: eligible.modelConfig.id,
      name: eligible.modelConfig.name,
      reasoning: eligible.modelConfig.reasoning,
      input: eligible.modelConfig.input,
      cost: eligible.modelConfig.cost,
      contextWindow: eligible.modelConfig.contextWindow,
      maxTokens: eligible.modelConfig.maxTokens,
      compat: eligible.modelConfig.compat,
      api: eligible.upstream.api,
      baseUrl: auth.baseUrl ?? eligible.upstream.baseUrl,
      headers,
    } as Model<Api>;

    return {
      account,
      upstream: eligible.upstream,
      modelConfig: eligible.modelConfig,
      auth,
      headers,
      delegatedModel,
    };
  }

  private markFailure(accountId: string, failure: FailureClassification) {
    switch (failure.kind) {
      case "rate-limit":
        this.state.markRateLimit(accountId, failure.retryAfterMs ?? this.config.rateLimitCooldownMs, failure.status, failure.message);
        break;
      case "auth":
        this.state.markAuthFailure(accountId, failure.status, failure.message);
        break;
      case "transient":
        this.state.markTransientFailure(
          accountId,
          this.config.transientPenaltyMs,
          failure.status,
          failure.message,
        );
        break;
      case "client-network":
        if (this.config.clientNetworkPenaltyMs > 0) {
          this.state.markTransientFailure(accountId, this.config.clientNetworkPenaltyMs, failure.status ?? 500, failure.message);
        } else {
          this.state.recordClientNetworkFailure(accountId, failure.status, failure.message);
        }
        break;
      case "context-overflow":
        // Context-size failures are request-level, not account-health failures.
        // Do not cool down or quarantine accounts; Pi needs the overflow error surfaced
        // directly so its built-in compaction recovery can compact and retry.
        break;
      case "fatal":
        this.state.markTransientFailure(accountId, this.config.transientPenaltyMs, failure.status ?? 500, failure.message);
        break;
    }
  }

  private getClientNetworkRetryDelayMs(retryIndex: number): number {
    const baseDelayMs = Math.max(0, this.config.clientNetworkRetryBaseDelayMs);
    const uncappedDelayMs = baseDelayMs * 2 ** retryIndex;
    const maxDelayMs = this.config.clientNetworkMaxRetryDelayMs;
    return maxDelayMs > 0 ? Math.min(uncappedDelayMs, maxDelayMs) : uncappedDelayMs;
  }

  private async tryAccountWithClientNetworkRetries(
    selection: DelegateSelection,
    outerStream: ReturnType<typeof createAssistantMessageEventStream>,
    context: Context,
    modelId: string,
    options?: SimpleStreamOptions,
  ): Promise<{ completed: boolean; emittedMeaningfulOutput: boolean; failure?: FailureClassification }> {
    for (let retryIndex = 0; ; retryIndex += 1) {
      const result = await this.trySingleAccount(selection, outerStream, context, options);
      const failure = result.failure;
      const canRetry =
        !result.completed &&
        !result.emittedMeaningfulOutput &&
        failure?.kind === "client-network" &&
        retryIndex < this.config.clientNetworkMaxRetries;

      if (!canRetry || !failure) return result;

      const delayMs = this.getClientNetworkRetryDelayMs(retryIndex);
      this.emitUi({
        phase: "retry",
        modelId,
        accountId: selection.account.id,
        accountLabel: selection.account.label,
        upstreamId: selection.account.upstreamId,
        failureKind: failure.kind,
        status: failure.status,
        message: failure.message,
        retryAttempt: retryIndex + 1,
        maxRetries: this.config.clientNetworkMaxRetries,
        delayMs,
      });
      await sleep(delayMs, options?.signal);
      this.state.markAttempt(selection.account.id, modelId);
      this.emitUi({
        phase: "attempt",
        modelId,
        accountId: selection.account.id,
        accountLabel: selection.account.label,
        upstreamId: selection.account.upstreamId,
        retryAttempt: retryIndex + 2,
        maxRetries: this.config.clientNetworkMaxRetries,
      });
    }
  }

  private async trySingleAccount(
    selection: DelegateSelection,
    outerStream: ReturnType<typeof createAssistantMessageEventStream>,
    context: Context,
    options?: SimpleStreamOptions,
  ): Promise<{ completed: boolean; emittedMeaningfulOutput: boolean; failure?: FailureClassification }> {
    let responseStatus: number | undefined;
    let responseHeaders: Record<string, string> = {};
    const buffered: AssistantMessageEvent[] = [];
    let emittedMeaningfulOutput = false;

    const streamOptions: SimpleStreamOptions = {
      ...options,
      apiKey: selection.auth.apiKey,
      headers: {
        ...(options?.headers ?? {}),
        ...selection.headers,
      },
      maxRetries: options?.maxRetries ?? this.config.upstreamMaxRetries,
      maxRetryDelayMs: options?.maxRetryDelayMs ?? this.config.upstreamMaxRetryDelayMs,
      onResponse: async (response, responseModel) => {
        responseStatus = response.status;
        responseHeaders = response.headers;
        await options?.onResponse?.(response, responseModel);
      },
      onPayload: options?.onPayload,
    };

    const inner = delegateStream(selection.upstream, selection.delegatedModel, context, streamOptions);

    for await (const event of inner) {
      if (event.type === "error") {
        const message = event.error.errorMessage || "Upstream request failed";
        if (isAbortLike(message, options?.signal, event.error.stopReason)) {
          outerStream.push({
            ...event,
            reason: "aborted",
            error: { ...event.error, stopReason: "aborted", errorMessage: message },
          });
          return {
            completed: true,
            emittedMeaningfulOutput,
            failure: { kind: "fatal", status: responseStatus, message },
          };
        }

        const failure = classifyFailure(responseStatus, responseHeaders, message, this.config);

        if (failure.kind === "context-overflow") {
          outerStream.push(event);
          return { completed: true, emittedMeaningfulOutput, failure };
        }

        this.markFailure(selection.account.id, failure);

        if (!emittedMeaningfulOutput) {
          return { completed: false, emittedMeaningfulOutput: false, failure };
        }

        outerStream.push(event);
        return { completed: false, emittedMeaningfulOutput: true, failure };
      }

      if (!emittedMeaningfulOutput && isMeaningfulEvent(event)) {
        for (const pending of buffered) outerStream.push(pending);
        buffered.length = 0;
        emittedMeaningfulOutput = true;
      }

      if (emittedMeaningfulOutput) {
        outerStream.push(event);
      } else {
        buffered.push(event);
      }

      if (event.type === "done") {
        if (!emittedMeaningfulOutput) {
          for (const pending of buffered) outerStream.push(pending);
          buffered.length = 0;
        }
        this.state.recordUsage(selection.account.id, selection.modelConfig.id, event.message.usage, responseStatus ?? 200);
        this.state.markSuccess(selection.account.id, responseStatus ?? 200);
        return { completed: true, emittedMeaningfulOutput };
      }
    }

    return {
      completed: false,
      emittedMeaningfulOutput,
      failure: {
        kind: "transient",
        status: responseStatus,
        message: "Upstream stream ended unexpectedly",
      },
    };
  }

  stream(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream {
    this.reloadConfig();
    this.state.clearAbortHealth(this.accounts.list().map((account) => account.id));
    const outer = createAssistantMessageEventStream();

    (async () => {
      const tried = new Set<string>();
      let lastFailure: FailureClassification | undefined;
      let emittedMeaningfulOutput = false;

      try {
        while (true) {
          if (options?.signal?.aborted) {
            outer.push({ type: "error", reason: "aborted", error: createErrorMessage({ model, message: "Request was aborted", stopReason: "aborted" }) });
            outer.end();
            return;
          }

          const eligible = this.getEligibleAccounts(model.id, tried);
          const policy = this.getPolicy();
          const cursor = this.state.getCursor(policy);
          const picked = chooseEligibleAccount(policy, eligible, cursor);

          if (!picked.selected) {
            const message = lastFailure
              ? `No healthy oauth-router accounts remaining after failover. Last error: ${lastFailure.message}`
              : `No healthy oauth-router accounts are configured for model ${model.id}. Add accounts with /router-login add.`;
            this.emitUi({
              phase: "error",
              modelId: model.id,
              failureKind: lastFailure?.kind,
              status: lastFailure?.status,
              message,
            });
            outer.push({ type: "error", reason: "error", error: createErrorMessage({ model, message }) });
            outer.end();
            return;
          }

          this.state.advanceCursor(policy, picked.nextCursor);
          tried.add(picked.selected.account.id);
          this.state.markAttempt(picked.selected.account.id, model.id);
          this.emitUi({
            phase: "attempt",
            modelId: model.id,
            accountId: picked.selected.account.id,
            accountLabel: picked.selected.account.label,
            upstreamId: picked.selected.account.upstreamId,
          });

          let selection: DelegateSelection;
          try {
            selection = await this.prepareSelection(picked.selected, model, options);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (isAbortLike(message, options?.signal)) {
              outer.push({ type: "error", reason: "aborted", error: createErrorMessage({ model, message, stopReason: "aborted" }) });
              outer.end();
              return;
            }
            lastFailure = { kind: "auth", status: 401, message };
            this.markFailure(picked.selected.account.id, lastFailure);
            this.emitUi({
              phase: "failover",
              modelId: model.id,
              accountId: picked.selected.account.id,
              accountLabel: picked.selected.account.label,
              upstreamId: picked.selected.account.upstreamId,
              failureKind: lastFailure.kind,
              status: lastFailure.status,
              message: lastFailure.message,
            });
            continue;
          }

          const result = await this.tryAccountWithClientNetworkRetries(selection, outer, context, model.id, options);
          if (result.completed) {
            this.emitUi(result.failure
              ? {
                phase: "error",
                modelId: model.id,
                accountId: selection.account.id,
                accountLabel: selection.account.label,
                upstreamId: selection.account.upstreamId,
                failureKind: result.failure.kind,
                status: result.failure.status,
                message: result.failure.message,
              }
              : {
                phase: "success",
                modelId: model.id,
                accountId: selection.account.id,
                accountLabel: selection.account.label,
                upstreamId: selection.account.upstreamId,
              });
            outer.end();
            return;
          }

          emittedMeaningfulOutput ||= result.emittedMeaningfulOutput;
          lastFailure = result.failure;

          if (emittedMeaningfulOutput) {
            this.emitUi({
              phase: "error",
              modelId: model.id,
              accountId: selection.account.id,
              accountLabel: selection.account.label,
              upstreamId: selection.account.upstreamId,
              failureKind: lastFailure?.kind,
              status: lastFailure?.status,
              message: lastFailure?.message ?? "Upstream failed after partial output; failover is unsafe.",
            });
            outer.end();
            return;
          }

          if (lastFailure) {
            this.emitUi({
              phase: "failover",
              modelId: model.id,
              accountId: selection.account.id,
              accountLabel: selection.account.label,
              upstreamId: selection.account.upstreamId,
              failureKind: lastFailure.kind,
              status: lastFailure.status,
              message: lastFailure.message,
            });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const aborted = isAbortLike(message, options?.signal);
        this.emitUi({
          phase: "error",
          modelId: model.id,
          message: aborted ? "Request was aborted" : message,
        });
        outer.push({ type: "error", reason: aborted ? "aborted" : "error", error: createErrorMessage({ model, message, stopReason: aborted ? "aborted" : "error" }) });
        outer.end();
      }
    })();

    return outer;
  }
}

export function registerRouterProvider(pi: ExtensionAPI, runtime: RouterRuntime) {
  const config = runtime.getConfig();
  pi.registerProvider(config.providerName, {
    baseUrl: "https://oauth-router.local",
    // Pi treats all-caps apiKey placeholders as legacy environment-variable references.
    // Keep this dummy key clearly literal; real upstream credentials are injected in streamSimple.
    apiKey: "oauth-router-disabled",
    api: "oauth-router-api",
    models: runtime.getProviderModels(),
    streamSimple: (model, context, options) => runtime.stream(model, context, options),
  });
}
