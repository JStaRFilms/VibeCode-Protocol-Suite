import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { createAccountFromUpstream } from "./oauth-flow.ts";
import { createRouterReportLines, createRouterReportWidget, ROUTER_REPORT_WIDGET_KEY, ROUTER_REPORT_WIDGET_OPTIONS } from "./report-ui.ts";
import type { RouterStatusRow, RouterUsageSummary, RouterUsageWindowSummary, RoutingPolicyName, StoredRouterAccount } from "./types.ts";
import { RouterRuntime } from "./provider.ts";

function formatWhen(timestamp?: number): string {
  if (!timestamp) return "never";
  return new Date(timestamp).toLocaleString();
}

function formatRelative(target?: number): string {
  if (!target) return "-";
  const delta = target - Date.now();
  if (delta <= 0) return "expired";
  const seconds = Math.ceil(delta / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}h`;
}

function formatAgo(timestamp?: number): string {
  if (!timestamp) return "never";
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return `${Math.max(1, Math.ceil(delta / 1000))}s ago`;
  if (delta < 3_600_000) return `${Math.ceil(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.ceil(delta / 3_600_000)}h ago`;
  return `${Math.ceil(delta / 86_400_000)}d ago`;
}

function formatLastUsedSummary(timestamp?: number): string {
  if (!timestamp) return "never";
  return `${formatWhen(timestamp)} (${formatAgo(timestamp)})`;
}

function isHealthy(row: RouterStatusRow): boolean {
  if (!row.enabled) return false;
  if (row.authHealth !== "ok") return false;
  if (row.cooldownUntil && row.cooldownUntil > Date.now()) return false;
  if (row.penaltyUntil && row.penaltyUntil > Date.now()) return false;
  return true;
}

function formatHealth(row: RouterStatusRow): string {
  if (isHealthy(row)) return "healthy";
  if (row.authHealth !== "ok") return `auth=${row.authHealth}`;
  if (row.cooldownUntil && row.cooldownUntil > Date.now()) return `cooldown ${formatRelative(row.cooldownUntil)}`;
  if (row.penaltyUntil && row.penaltyUntil > Date.now()) return `penalty ${formatRelative(row.penaltyUntil)}`;
  return "inactive";
}

export function formatStatusReport(runtime: RouterRuntime): string {
  const config = runtime.getConfig();
  const rows = runtime.getStatusRows();
  const accountsById = new Map(runtime.listAccounts().map((account) => [account.id, account]));
  const healthyRows = rows.filter((row) => isHealthy(row));
  const healthy = healthyRows.length;
  const enabled = rows.filter((row) => row.enabled).length;
  const usableModels = config.models
    .filter((model) => {
      const routeFilter = new Set(model.route?.upstreamIds ?? []);
      return healthyRows.some((row) => {
        const upstream = config.upstreams.find((entry) => entry.id === row.upstream);
        if (!upstream?.modelIds.includes(model.id)) return false;
        if (routeFilter.size > 0 && !routeFilter.has(row.upstream)) return false;
        return true;
      });
    })
    .map((model) => model.id);
  const lastUsedRow = [...rows]
    .filter((row) => row.lastUsedAt)
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))[0];
  const lastUsedLine = lastUsedRow
    ? `${lastUsedRow.id} | ${lastUsedRow.label} | ${lastUsedRow.upstream} | ${formatLastUsedSummary(lastUsedRow.lastUsedAt)}`
    : "none yet";
  const upstreams = config.upstreams.map((upstream) => {
    const auth = upstream.authMode === "oauth" ? `oauth:${upstream.oauthProviderId}` : "api-key";
    const activeCount = rows.filter((row) => row.upstream === upstream.id && row.enabled).length;
    return `- ${upstream.id} | ${upstream.label} | ${auth} | ${upstream.api} | active=${activeCount} | models=${upstream.modelIds.join(", ")}`;
  });

  const accounts = rows.length
    ? [...rows]
        .sort((a, b) => {
          const aTime = a.lastUsedAt ?? 0;
          const bTime = b.lastUsedAt ?? 0;
          if (aTime !== bTime) return bTime - aTime;
          return a.label.localeCompare(b.label);
        })
        .map((row) => {
          const account = accountsById.get(row.id);
          const plan = typeof account?.meta?.planType === "string" ? account.meta.planType : "unknown";
          const health = formatHealth(row);

          return [
            `- ${row.id} | ${row.label} | plan=${plan}`,
            `  upstream=${row.upstream} enabled=${row.enabled} weight=${row.weight} state=${health}`,
            `  lastUsed=${formatLastUsedSummary(row.lastUsedAt)} | lastStatus=${row.lastStatus ?? "-"} | expires=${formatWhen(row.expires)}`,
            `  successes=${row.successCount} failures=${row.failures} 429s=${row.rateLimitCount} authFailures=${row.authFailureCount}`,
            row.lastError ? `  lastError=${row.lastError}` : undefined,
          ].filter((line): line is string => Boolean(line)).join("\n");
        })
    : ["- No accounts configured yet. Use /router-login add."];

  return [
    "# oauth-router status",
    "",
    `Policy: ${runtime.getPolicy()}`,
    `Accounts: ${rows.length} total | ${enabled} enabled | ${healthy} healthy`,
    `Usable models now: ${usableModels.length > 0 ? usableModels.join(", ") : "none"}`,
    `Last used account: ${lastUsedLine}`,
    "",
    "## Upstreams",
    ...upstreams,
    "",
    "## Accounts",
    ...accounts,
  ].join("\n");
}

export async function refreshUsageAfterCredentialChange(runtime: RouterRuntime, accountId: string): Promise<string> {
  try {
    const snapshot = await runtime.refreshUsageSnapshot(accountId);
    const windows = [snapshot.fiveHour ? "5h" : undefined, snapshot.weekly ? "weekly" : undefined].filter(Boolean).join("/");
    return ` Provider usage refreshed (${snapshot.source}${windows ? `, ${windows}` : ""}).`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return ` Provider usage refresh failed: ${message}`;
  }
}

function formatAccountsReport(runtime: RouterRuntime): string {
  const rows = runtime.getStatusRows();
  const accounts = rows.length
    ? [...rows]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((row) => {
          const lastUsed = row.lastUsedAt ? formatAgo(row.lastUsedAt) : "never";
          return `- ${row.id} | ${row.label} | enabled=${row.enabled} | weight=${row.weight} | state=${formatHealth(row)} | lastUsed=${lastUsed} | 429s=${row.rateLimitCount} | authFailures=${row.authFailureCount}`;
        })
    : ["- No accounts configured yet. Use /router-login add."];

  return [
    "# oauth-router accounts",
    "",
    "Compact account list. Use /router-status for full routing details and /router-usage for usage windows.",
    "",
    ...accounts,
  ].join("\n");
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatCost(value: number): string {
  if (!value) return "$0";
  return `$${value.toFixed(value < 0.01 ? 6 : 4)}`;
}

function formatUsageWindow(window: RouterUsageWindowSummary): string {
  return `${window.label}: ${window.requests} req | tokens=${formatNumber(window.totalTokens)} input=${formatNumber(window.input)} output=${formatNumber(window.output)} cache=${formatNumber(window.cacheRead + window.cacheWrite)} cost=${formatCost(window.costTotal)}`;
}

function findDuplicateAccount(account: StoredRouterAccount, accounts: StoredRouterAccount[]): StoredRouterAccount | undefined {
  const accountId = typeof account.meta?.accountId === "string" ? account.meta.accountId : undefined;
  if (!accountId) return undefined;
  return accounts.find((candidate) => {
    const candidateAccountId = typeof candidate.meta?.accountId === "string" ? candidate.meta.accountId : undefined;
    return candidate.provider === account.provider && candidate.upstreamId === account.upstreamId && candidateAccountId === accountId;
  });
}

async function shouldReplaceDuplicateAccount(ctx: ExtensionCommandContext, duplicate: StoredRouterAccount): Promise<boolean> {
  const message = `This OAuth identity already exists as ${duplicate.id} (${duplicate.label}). Keeping both entries can make refresh tokens fight each other.`;
  if (!ctx.hasUI) return true;
  return ctx.ui.confirm("Duplicate OAuth account detected", `${message}\n\nUpdate the existing account with these new credentials instead?`);
}

function quotaBar(percent?: number, width = 18): string {
  if (percent === undefined || !Number.isFinite(percent)) return "[??????????????????]";
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((value / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)}]`;
}

function formatProviderQuota(window: { label: string; used?: number; limit?: number; remaining?: number; percentRemaining?: number; resetAt?: number }): string {
  const pct = window.percentRemaining !== undefined ? Math.round(window.percentRemaining) : undefined;
  const extra = [
    window.remaining !== undefined ? `remaining=${formatNumber(window.remaining)}` : undefined,
    window.used !== undefined ? `used=${formatNumber(window.used)}` : undefined,
    window.limit !== undefined ? `limit=${formatNumber(window.limit)}` : undefined,
  ].filter(Boolean).join(" | ");
  const reset = window.resetAt ? `reset ${formatRelative(window.resetAt)}` : "reset unknown";
  return `${window.label.padEnd(6)} ${quotaBar(pct)} ${pct ?? "?"}% left | ${reset}${extra ? ` | ${extra}` : ""}`;
}

function formatProviderVisual(summary: RouterUsageSummary): string[] {
  const provider = summary.provider;
  if (!provider) return ["Provider: not refreshed yet — run /router-refresh-usage all"];
  const plan = provider.planType ? provider.planType.toUpperCase() : "UNKNOWN";
  const fetched = formatAgo(provider.fetchedAt);
  return [
    `Provider: ${plan} | ${provider.source} | refreshed ${fetched}`,
    provider.fiveHour ? formatProviderQuota(provider.fiveHour) : "5h     [n/a] no provider window returned",
    provider.weekly ? formatProviderQuota(provider.weekly) : "weekly [n/a] no provider window returned",
  ];
}

function formatProviderRaw(summary: RouterUsageSummary): string[] {
  const provider = summary.provider;
  if (!provider) return ["provider: not inspected yet; run /router-refresh-usage <id>"];
  const identity = [
    provider.planType ? `plan=${provider.planType}` : undefined,
    provider.accountId ? `account=${provider.accountId}` : undefined,
    provider.email ? `email=${provider.email}` : undefined,
    provider.subject ? `sub=${provider.subject}` : undefined,
  ].filter(Boolean);
  return [
    `provider: ${provider.source} | fetched=${formatLastUsedSummary(provider.fetchedAt)}`,
    identity.length > 0 ? `identity: ${identity.join(" | ")}` : "identity: no readable identity claims",
    provider.fiveHour ? formatProviderQuota(provider.fiveHour) : undefined,
    provider.weekly ? formatProviderQuota(provider.weekly) : undefined,
    provider.endpoint ? `endpoint: ${provider.endpoint} | status=${provider.status ?? "-"}` : undefined,
    provider.rateLimitHeaders && Object.keys(provider.rateLimitHeaders).length > 0 ? `headers: ${Object.entries(provider.rateLimitHeaders).map(([key, value]) => `${key}=${value}`).join(" | ")}` : undefined,
    `tokenExpires=${formatWhen(provider.expires)}`,
    provider.message ? `note: ${provider.message}` : undefined,
    provider.claimKeys?.length ? `claimKeys: ${provider.claimKeys.join(", ")}` : undefined,
  ].filter((line): line is string => Boolean(line));
}

export function formatUsageReport(runtime: RouterRuntime, accountId?: string): string {
  const accounts = runtime.listAccounts();
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const summaries = accountId ? [runtime.getUsageSummary(accountId)] : runtime.getUsageSummaries();

  const rows = summaries.length
    ? summaries.map((summary) => {
        const account = accountMap.get(summary.accountId);
        const title = account ? `${account.label} (${summary.accountId})` : summary.accountId;
        return [
          `## ${title}`,
          ...formatProviderVisual(summary),
          `Local: ${summary.fiveHour.requests} req / ${formatNumber(summary.fiveHour.totalTokens)} tokens in 5h · ${summary.weekly.requests} req / ${formatNumber(summary.weekly.totalTokens)} tokens weekly`,
          `Raw: /router-usage-raw ${summary.accountId}`,
        ].join("\n");
      })
    : ["No accounts configured yet. Use /router-login add."];

  return [
    "# oauth-router usage",
    "",
    "Provider bars show OpenAI/Codex reported quota remaining. Local line shows only traffic routed through this extension.",
    "",
    ...rows,
  ].join("\n");
}

export function formatUsageRawReport(runtime: RouterRuntime, accountId?: string): string {
  const accounts = runtime.listAccounts();
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const summaries = accountId ? [runtime.getUsageSummary(accountId)] : runtime.getUsageSummaries();
  const rows = summaries.map((summary) => {
    const account = accountMap.get(summary.accountId);
    return [
      `## ${account ? `${account.label} (${summary.accountId})` : summary.accountId}`,
      formatUsageWindow(summary.fiveHour),
      formatUsageWindow(summary.weekly),
      ...formatProviderRaw(summary),
    ].filter((line): line is string => Boolean(line)).join("\n");
  });
  return ["# oauth-router usage raw", "", ...rows].join("\n");
}

export function emitRouterReport(ctx: ExtensionCommandContext, text: string) {
  // A single key gives every report predictable replacement semantics. RPC
  // accepts string-array widgets only; ctx.hasUI is true there, so ctx.mode is
  // the capability signal that prevents its visible report from being ignored.
  if (ctx.mode === "tui") {
    ctx.ui.setWidget(ROUTER_REPORT_WIDGET_KEY, createRouterReportWidget(text), ROUTER_REPORT_WIDGET_OPTIONS);
    return;
  }
  ctx.ui.setWidget(ROUTER_REPORT_WIDGET_KEY, createRouterReportLines(text), ROUTER_REPORT_WIDGET_OPTIONS);
}

export function clearRouterReport(ctx: ExtensionCommandContext) {
  ctx.ui.setWidget(ROUTER_REPORT_WIDGET_KEY, undefined);
}

async function pickUpstream(runtime: RouterRuntime, ctx: ExtensionCommandContext, requestedId?: string) {
  const upstreams = runtime.listUpstreams().filter((upstream) => upstream.enabled);
  if (upstreams.length === 0) throw new Error("No enabled upstreams are configured");

  if (requestedId) {
    const matched = upstreams.find((upstream) => upstream.id === requestedId);
    if (!matched) throw new Error(`Unknown upstream: ${requestedId}`);
    return matched;
  }

  if (!ctx.hasUI) return upstreams[0]!;

  const choice = await ctx.ui.select(
    "Choose an upstream",
    upstreams.map((upstream) => `${upstream.id} — ${upstream.label}`),
  );
  if (!choice) throw new Error("Cancelled by user");
  const id = choice.split(" — ")[0]?.trim();
  const selected = upstreams.find((upstream) => upstream.id === id);
  if (!selected) throw new Error(`Unknown upstream: ${id}`);
  return selected;
}

function formatAccountChoice(account: StoredRouterAccount, row?: RouterStatusRow): string {
  return `${account.id} — ${account.label} — enabled=${row?.enabled ?? account.enabled} — weight=${row?.weight ?? account.weight} — state=${row ? formatHealth(row) : "unknown"}`;
}

async function pickAccount(runtime: RouterRuntime, ctx: ExtensionCommandContext, requestedId?: string, title = "Choose an account"): Promise<StoredRouterAccount> {
  const accounts = runtime.listAccounts();
  if (accounts.length === 0) throw new Error("No accounts configured yet. Use /router-login add.");

  if (requestedId) {
    const matched = accounts.find((account) => account.id === requestedId);
    if (!matched) throw new Error(`Unknown account: ${requestedId}`);
    return matched;
  }

  if (!ctx.hasUI) throw new Error("Account id required. Run /router-accounts to see available accounts.");

  const rows = new Map(runtime.getStatusRows().map((row) => [row.id, row]));
  const choice = await ctx.ui.select(
    title,
    accounts.map((account) => formatAccountChoice(account, rows.get(account.id))),
  );
  if (!choice) throw new Error("Cancelled by user");
  const id = choice.split(" — ")[0]?.trim();
  const selected = accounts.find((account) => account.id === id);
  if (!selected) throw new Error(`Unknown account: ${id}`);
  return selected;
}

async function pickUsageTarget(runtime: RouterRuntime, ctx: ExtensionCommandContext, requestedId?: string): Promise<"all" | string> {
  if (requestedId === "all") return "all";
  if (requestedId) return (await pickAccount(runtime, ctx, requestedId)).id;
  if (!ctx.hasUI) throw new Error("Usage: /router-refresh-usage <id|all>");

  const accounts = runtime.listAccounts();
  if (accounts.length === 0) throw new Error("No accounts configured yet. Use /router-login add.");
  const rows = new Map(runtime.getStatusRows().map((row) => [row.id, row]));
  const allLabel = "all — refresh all accounts";
  const choice = await ctx.ui.select("Refresh usage metadata for", [allLabel, ...accounts.map((account) => formatAccountChoice(account, rows.get(account.id)))]);
  if (!choice) throw new Error("Cancelled by user");
  if (choice === allLabel) return "all";
  const id = choice.split(" — ")[0]?.trim();
  if (!id) throw new Error("No account selected");
  return id;
}

async function getLabel(ctx: ExtensionCommandContext, fallback: string, provided?: string) {
  if (provided && provided.trim()) return provided.trim();
  if (!ctx.hasUI) return fallback;
  const response = await ctx.ui.input("Account label:", fallback);
  return response?.trim() || fallback;
}

async function getRequiredLabel(ctx: ExtensionCommandContext, fallback: string, provided?: string) {
  if (provided && provided.trim()) return provided.trim();
  if (!ctx.hasUI) throw new Error("Account label required");
  const response = await ctx.ui.input("Account label:", fallback);
  const label = response?.trim();
  if (!label) throw new Error("Account label cannot be empty");
  return label;
}

function normalizePolicy(input?: string): RoutingPolicyName | undefined {
  if (!input) return undefined;
  const value = input.trim().toLowerCase();
  if (value === "round-robin" || value === "rr") return "round-robin";
  if (value === "weighted-round-robin" || value === "wrr" || value === "weighted") return "weighted-round-robin";
  return undefined;
}

function parseArgs(args: string): string[] {
  return args
    .trim()
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function setFooterStatus(ctx: ExtensionCommandContext, runtime: RouterRuntime) {
  const rows = runtime.getStatusRows();
  const healthy = rows.filter((row) => isHealthy(row)).length;
  ctx.ui.setStatus("oauth-router", `oauth-router ${healthy}/${rows.length || 0} healthy | ${runtime.getPolicy()}`);
}

function showCommandHint(ctx: ExtensionCommandContext, title: string, lines: string[]) {
  emitRouterReport(ctx, [`# ${title}`, "", ...lines].join("\n"));
}

async function handleRouterLogin(runtime: RouterRuntime, args: string, ctx: ExtensionCommandContext) {
  const [command = "help", first, ...rest] = parseArgs(args);

  switch (command) {
    case "add": {
      const allowDuplicate = rest.includes("--allow-duplicate");
      const labelParts = rest.filter((part) => part !== "--allow-duplicate");
      const upstream = await pickUpstream(runtime, ctx, first);
      const label = await getLabel(ctx, `${upstream.label} ${runtime.listAccounts().length + 1}`, labelParts.join(" "));
      const account = await createAccountFromUpstream(upstream, label, ctx);
      const duplicate = findDuplicateAccount(account, runtime.listAccounts());
      if (duplicate && !allowDuplicate) {
        const replace = await shouldReplaceDuplicateAccount(ctx, duplicate);
        if (!replace) throw new Error("Cancelled duplicate account add");
        runtime.updateAccount({
          ...duplicate,
          access: account.access,
          refresh: account.refresh,
          expires: account.expires,
          meta: account.meta,
          updatedAt: Date.now(),
        });
        runtime.clearAccountHealth(duplicate.id);
        const usageMessage = await refreshUsageAfterCredentialChange(runtime, duplicate.id);
        setFooterStatus(ctx, runtime);
        emitRouterReport(ctx, `Updated existing account ${duplicate.id} (${duplicate.label}) with fresh credentials instead of adding a duplicate.${usageMessage}`);
        return;
      }
      runtime.addAccount(account);
      const usageMessage = await refreshUsageAfterCredentialChange(runtime, account.id);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Added account ${account.id} (${account.label}) for upstream ${upstream.id}.${usageMessage}`);
      return;
    }
    case "list": {
      emitRouterReport(ctx, formatAccountsReport(runtime));
      setFooterStatus(ctx, runtime);
      return;
    }
    case "delete":
    case "remove": {
      const account = await pickAccount(runtime, ctx, first, "Choose account to delete");
      if (ctx.hasUI) {
        const ok = await ctx.ui.confirm("Remove account?", `Delete router account ${account.id} (${account.label})? This removes stored tokens and usage state for that router account.`);
        if (!ok) throw new Error("Cancelled by user");
      }
      runtime.removeAccount(account.id);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Removed account ${account.id}.`);
      return;
    }
    case "rename": {
      const account = await pickAccount(runtime, ctx, first, "Choose account to rename");
      const label = await getRequiredLabel(ctx, account.label, rest.join(" "));
      runtime.renameAccount(account.id, label);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Renamed account ${account.id} to ${label}.`);
      return;
    }
    case "relogin": {
      const existing = await pickAccount(runtime, ctx, first, "Choose account to re-login");
      const upstream = runtime.listUpstreams().find((entry) => entry.id === existing.upstreamId);
      if (!upstream) throw new Error(`Unknown upstream for account ${existing.id}: ${existing.upstreamId}`);
      if (ctx.hasUI) {
        const ok = await ctx.ui.confirm("Re-login account?", `Replace OAuth/API credentials for ${existing.id} (${existing.label}) and clear auth failure state?`);
        if (!ok) throw new Error("Cancelled by user");
      }
      const fresh = await createAccountFromUpstream(upstream, existing.label, ctx);
      runtime.updateAccount({
        ...existing,
        provider: fresh.provider,
        upstreamId: fresh.upstreamId,
        access: fresh.access,
        refresh: fresh.refresh,
        expires: fresh.expires,
        meta: fresh.meta,
        updatedAt: Date.now(),
      });
      runtime.clearAccountHealth(existing.id);
      const usageMessage = await refreshUsageAfterCredentialChange(runtime, existing.id);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Re-logged account ${existing.id} (${existing.label}) and cleared auth state.${usageMessage}`);
      return;
    }
    case "refresh": {
      const account = await pickAccount(runtime, ctx, first, "Choose account to refresh");
      const refreshed = await runtime.refreshAccount(account.id);
      const usageMessage = await refreshUsageAfterCredentialChange(runtime, refreshed.id);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Refreshed account ${refreshed.id} (${refreshed.label}).${usageMessage}`);
      return;
    }
    case "help":
    default: {
      emitRouterReport(
        ctx,
        [
          "# oauth-router commands",
          "",
          "- /router-login add [upstreamId] [label] [--allow-duplicate]",
          "- /router-login list",
          "- /router-login remove <id>",
          "- /router-login delete <id>",
          "- /router-login rename <id> <new label>",
          "- /router-login relogin <id>",
          "- /router-login refresh <id>",
          "- /router-status",
          "- /router-accounts",
          "- /router-usage [id]",
          "- /router-usage-raw [id]",
          "- /router-refresh-usage <id|all>",
          "- /router-enable <id>",
          "- /router-disable <id>",
          "- /router-policy <round-robin|weighted-round-robin>",
          "- /router-weight <id> <n>",
          "- /router-clear (dismiss the current report)",
        ].join("\n"),
      );
      return;
    }
  }
}

export function registerRouterCommands(pi: ExtensionAPI, runtime: RouterRuntime) {
  pi.registerCommand("router-login", {
    description: "Manage oauth-router accounts",
    handler: async (args, ctx) => handleRouterLogin(runtime, args || "", ctx),
  });

  pi.registerCommand("router-clear", {
    description: "Dismiss the current oauth-router report widget",
    handler: async (_args, ctx) => {
      clearRouterReport(ctx);
      setFooterStatus(ctx, runtime);
    },
  });

  pi.registerCommand("router-status", {
    description: "Show oauth-router health and routing state",
    handler: async (_args, ctx) => {
      emitRouterReport(ctx, formatStatusReport(runtime));
      setFooterStatus(ctx, runtime);
    },
  });

  pi.registerCommand("router-accounts", {
    description: "Show compact oauth-router account list",
    handler: async (_args, ctx) => {
      emitRouterReport(ctx, formatAccountsReport(runtime));
      setFooterStatus(ctx, runtime);
    },
  });

  pi.registerCommand("router-usage", {
    description: "Show oauth-router visual provider quota and local usage",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      emitRouterReport(ctx, formatUsageReport(runtime, id));
      setFooterStatus(ctx, runtime);
    },
  });

  pi.registerCommand("router-usage-raw", {
    description: "Show raw oauth-router usage/provider quota details",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      emitRouterReport(ctx, formatUsageRawReport(runtime, id));
      setFooterStatus(ctx, runtime);
    },
  });

  pi.registerCommand("router-quota", {
    description: "Alias for visual oauth-router usage/quota",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      emitRouterReport(ctx, formatUsageReport(runtime, id));
      setFooterStatus(ctx, runtime);
    },
  });

  pi.registerCommand("router-refresh-usage", {
    description: "Refresh oauth-router account metadata and best-effort provider quota",
    handler: async (args, ctx) => {
      const [requestedId] = parseArgs(args || "");
      const target = await pickUsageTarget(runtime, ctx, requestedId);
      const ids = target === "all" ? runtime.listAccounts().map((account) => account.id) : [target];
      const failures: string[] = [];

      for (const accountId of ids) {
        try {
          await runtime.refreshUsageSnapshot(accountId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`- ${accountId}: ${message}`);
        }
      }

      const report = formatUsageReport(runtime, target === "all" ? undefined : target);
      emitRouterReport(ctx, failures.length ? [report, "", "## Refresh failures", ...failures].join("\n") : report);
      if (failures.length) ctx.ui.notify(`oauth-router usage refreshed with ${failures.length} failure(s)`, "error");
      setFooterStatus(ctx, runtime);
    },
  });

  pi.registerCommand("router-rename", {
    description: "Rename an oauth-router account",
    handler: async (args, ctx) => {
      const [id, ...labelParts] = parseArgs(args || "");
      const account = await pickAccount(runtime, ctx, id, "Choose account to rename");
      const label = await getRequiredLabel(ctx, account.label, labelParts.join(" "));
      runtime.renameAccount(account.id, label);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Renamed account ${account.id} to ${label}.`);
    },
  });

  pi.registerCommand("router-delete", {
    description: "Delete an oauth-router account",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      const account = await pickAccount(runtime, ctx, id, "Choose account to delete");
      if (ctx.hasUI) {
        const ok = await ctx.ui.confirm("Delete account?", `Delete router account ${account.id} (${account.label})? This removes stored tokens and usage state.`);
        if (!ok) throw new Error("Cancelled by user");
      }
      runtime.removeAccount(account.id);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Deleted account ${account.id}.`);
    },
  });

  pi.registerCommand("router-relogin", {
    description: "Re-login and recover an oauth-router account",
    handler: async (args, ctx) => handleRouterLogin(runtime, `relogin ${args || ""}`, ctx),
  });

  pi.registerCommand("router-enable", {
    description: "Enable an oauth-router account",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      const account = await pickAccount(runtime, ctx, id, "Choose account to enable");
      runtime.setEnabled(account.id, true);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Enabled account ${account.id}.`);
    },
  });

  pi.registerCommand("router-disable", {
    description: "Disable an oauth-router account",
    handler: async (args, ctx) => {
      const [id] = parseArgs(args || "");
      const account = await pickAccount(runtime, ctx, id, "Choose account to disable");
      runtime.setEnabled(account.id, false);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Disabled account ${account.id}.`);
    },
  });

  pi.registerCommand("router-policy", {
    description: "Set oauth-router routing policy",
    handler: async (args, ctx) => {
      const raw = (args || "").trim();
      const policy = normalizePolicy(raw);
      if (!raw) {
        showCommandHint(ctx, "router-policy", [
          `Current policy: ${runtime.getPolicy()}`,
          "",
          "Usage: /router-policy <round-robin|weighted-round-robin>",
          "Aliases: rr, wrr, weighted",
        ]);
        return;
      }
      if (!policy) {
        showCommandHint(ctx, "router-policy", [
          `Unrecognized policy: ${raw}`,
          "",
          `Current policy: ${runtime.getPolicy()}`,
          "Valid values: round-robin, weighted-round-robin",
        ]);
        return;
      }
      runtime.setPolicy(policy);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Routing policy set to ${policy}.`);
    },
  });

  pi.registerCommand("router-weight", {
    description: "Set oauth-router account weight for weighted round robin",
    handler: async (args, ctx) => {
      const [id, rawWeight] = parseArgs(args || "");
      const account = await pickAccount(runtime, ctx, id, "Choose account to reweight");
      let weight = Number(rawWeight);
      if (!Number.isFinite(weight) && ctx.hasUI) {
        const response = await ctx.ui.input("Account weight:", String(account.weight));
        weight = Number(response);
      }
      if (!Number.isFinite(weight)) {
        showCommandHint(ctx, "router-weight", ["Usage: /router-weight <id> <n>", "Example: /router-weight acct_ab12cd34 3"]);
        return;
      }
      runtime.setWeight(account.id, weight);
      setFooterStatus(ctx, runtime);
      emitRouterReport(ctx, `Updated weight for ${account.id} to ${Math.max(1, Math.floor(weight))}.`);
    },
  });
}
