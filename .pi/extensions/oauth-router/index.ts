import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerRouterCommands, formatStatusReport } from "./commands.ts";
import { registerRouterProvider, RouterRuntime } from "./provider.ts";
import type { RouterUiEvent } from "./types.ts";

function getHealthSummary(runtime: RouterRuntime) {
  const rows = runtime.getStatusRows();
  const healthy = rows.filter((row) => {
    if (!row.enabled) return false;
    if (row.authHealth !== "ok") return false;
    if (row.cooldownUntil && row.cooldownUntil > Date.now()) return false;
    if (row.penaltyUntil && row.penaltyUntil > Date.now()) return false;
    return true;
  }).length;

  return `oauth-router ${healthy}/${rows.length || 0} healthy | ${runtime.getPolicy()}`;
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return "now";
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  return `${Math.round(ms / 1_000)}s`;
}

function truncate(text: string | undefined, max = 110): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, Math.max(0, max - 1))}…` : clean;
}

function formatRoute(event: RouterUiEvent): string {
  const parts = [event.accountLabel || event.accountId, event.upstreamId].filter(Boolean);
  return parts.length ? parts.join(" @ ") : "router";
}

function formatActivityStatus(event: RouterUiEvent): string {
  const route = formatRoute(event);
  const model = event.modelId ? `${event.modelId} ` : "";
  const reason = truncate(event.message, 70);

  switch (event.phase) {
    case "attempt": {
      const retry = event.retryAttempt && event.maxRetries
        ? ` retry ${event.retryAttempt}/${event.maxRetries}`
        : "";
      return `oauth-router contacting ${model}via ${route}${retry}`;
    }
    case "retry":
      return `oauth-router retry ${event.retryAttempt}/${event.maxRetries} in ${formatDuration(event.delayMs)} | ${reason || event.failureKind || "network error"}`;
    case "failover":
      return `oauth-router failover from ${route} | ${reason || event.failureKind || "upstream error"}`;
    case "success":
      return `oauth-router ok: ${model}via ${route}`;
    case "error":
      return `oauth-router error | ${reason || event.failureKind || "request failed"}`;
  }
}

function notifyActivity(ctx: ExtensionContext, event: RouterUiEvent) {
  if (event.phase === "attempt" || event.phase === "success") return;

  const message = formatActivityStatus(event);
  const level = event.phase === "error" ? "error" : "info";
  ctx.ui.notify(message, level);
}

function installRouterUiBridge(pi: ExtensionAPI, runtime: RouterRuntime, notifyOnLoad = false) {
  let activeCtx: ExtensionContext | undefined;

  const setBaseStatus = (ctx: ExtensionContext) => {
    activeCtx = ctx;
    if (ctx.hasUI) ctx.ui.setStatus("oauth-router", getHealthSummary(runtime));
  };

  runtime.setUiReporter((event) => {
    const ctx = activeCtx;
    if (!ctx?.hasUI) return;
    try {
      ctx.ui.setStatus("oauth-router", formatActivityStatus(event));
      notifyActivity(ctx, event);
    } catch {
      // Best-effort UI only; never disturb provider streaming.
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    setBaseStatus(ctx);
    if (notifyOnLoad) ctx.ui.notify("oauth-router loaded", "info");
  });

  pi.on("agent_start", async (_event, ctx) => {
    setBaseStatus(ctx);
  });

  pi.on("turn_start", async (_event, ctx) => {
    setBaseStatus(ctx);
  });

  pi.on("turn_end", async (_event, ctx) => {
    setBaseStatus(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    setBaseStatus(ctx);
  });

  pi.on("session_shutdown", async () => {
    activeCtx = undefined;
  });
}

export default function (pi: ExtensionAPI) {
  const runtime = new RouterRuntime();

  registerRouterProvider(pi, runtime);
  registerRouterCommands(pi, runtime);
  installRouterUiBridge(pi, runtime, false);

  pi.registerCommand("router-debug-report", {
    description: "Show a detailed oauth-router report in the UI only",
    handler: async (_args, ctx) => {
      const report = formatStatusReport(runtime);
      ctx.ui.setWidget("oauth-router-report", report.split(/\r?\n/), { placement: "belowEditor" });
      ctx.ui.notify("oauth-router debug report updated", "info");
    },
  });
}
