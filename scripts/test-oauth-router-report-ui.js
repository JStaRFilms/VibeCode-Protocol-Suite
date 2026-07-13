#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = path.join(repoRoot, ".pi", "extensions", "oauth-router");
const sourceFiles = ["commands.ts", "index.ts", "report-ui.ts"].map((file) => path.join(extensionRoot, file));
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "oauth-router-report-test-"));
const outDir = path.join(repoRoot, ".tmp", `oauth-router-report-${process.pid}`);
const tsconfigPath = path.join(tempRoot, "tsconfig.json");

function stripAnsi(text) {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function createTheme() {
  const calls = [];
  const codes = { accent: 35, success: 32, warning: 33, error: 31, muted: 36, dim: 2 };
  return {
    calls,
    theme: {
      fg: (color, text) => {
        calls.push({ color, text });
        return `\x1b[${codes[color]}m${text}\x1b[0m`;
      },
      bold: (text) => `\x1b[1m${text}\x1b[0m`,
    },
  };
}

function createRuntime() {
  const now = Date.now();
  const accounts = [
    { id: "acct_healthy", label: "Primary\x1b[31m", provider: "openai-codex", upstreamId: "chatgpt-codex", enabled: true, weight: 2, expires: now + 3_600_000, createdAt: now, updatedAt: now, access: "secret", refresh: "secret" },
    { id: "acct_invalid", label: "Backup", provider: "openai-codex", upstreamId: "chatgpt-codex", enabled: true, weight: 1, expires: now + 3_600_000, createdAt: now, updatedAt: now, access: "secret", refresh: "secret" },
  ];
  const rows = [
    { id: "acct_healthy", label: accounts[0].label, upstream: "chatgpt-codex", provider: "openai-codex", enabled: true, weight: 2, authHealth: "ok", lastUsedAt: now - 2_000, lastStatus: 200, failures: 0, rateLimitCount: 0, authFailureCount: 0, successCount: 3, expires: now + 3_600_000 },
    { id: "acct_invalid", label: "Backup", upstream: "chatgpt-codex", provider: "openai-codex", enabled: true, weight: 1, authHealth: "invalid", cooldownUntil: now + 60_000, lastStatus: 401, failures: 1, rateLimitCount: 1, authFailureCount: 1, successCount: 0, lastError: "Bearer eyJheader.payload.signature", expires: now + 3_600_000 },
  ];
  const usage = (accountId) => ({
    accountId,
    fiveHour: { label: "5h", since: now - 1, until: now, requests: 4, input: 1234, output: 567, cacheRead: 12, cacheWrite: 3, totalTokens: 1816, costTotal: 0.0123 },
    weekly: { label: "weekly", since: now - 1, until: now, requests: 8, input: 2345, output: 678, cacheRead: 14, cacheWrite: 5, totalTokens: 3042, costTotal: 0.0234 },
    provider: {
      fetchedAt: now - 1_000,
      source: "provider",
      planType: "pro",
      fiveHour: { label: "5h", percentRemaining: 65, resetAt: now + 3_600_000 },
      weekly: { label: "weekly", percentRemaining: 25, resetAt: now + 86_400_000 },
      endpoint: "https://example.test/usage?access_token=sk-super-secret-token#refresh_token=opaque-refresh-value",
      rateLimitHeaders: { "x-ratelimit-remaining": "7" },
      message: "provider note password=not-for-display\x1b[2J",
      claimKeys: ["sub", "access_token"],
    },
  });
  return {
    getConfig: () => ({ models: [{ id: "model-a" }], upstreams: [{ id: "chatgpt-codex", label: "Codex", authMode: "oauth", oauthProviderId: "openai-codex", api: "openai-codex-responses", modelIds: ["model-a"] }] }),
    getStatusRows: () => rows,
    listAccounts: () => accounts,
    listUpstreams: () => [],
    getPolicy: () => "round-robin",
    getUsageSummary: (id) => usage(id),
    getUsageSummaries: () => accounts.map((account) => usage(account.id)),
    setEnabled: (id, enabled) => { const account = accounts.find((item) => item.id === id); account.enabled = enabled; },
    refreshUsageSnapshot: async () => { throw new Error("quota probe failed"); },
  };
}

function createContext(events, mode, hasUI = mode === "tui" || mode === "rpc") {
  return {
    // RPC can expose a widget transport even when its hasUI flag is false;
    // component factories remain TUI-only and are ignored by RPC.
    mode,
    hasUI,
    ui: {
      setWidget: (...args) => events.widgets.push(args),
      setStatus: (...args) => events.statuses.push(args),
      notify: (...args) => events.notifications.push(args),
    },
  };
}

function colorFor(calls, text) {
  return calls.find((call) => call.text === text)?.color;
}

try {
  await fs.writeFile(tsconfigPath, JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, skipLibCheck: true, noEmit: false, allowImportingTsExtensions: true, rewriteRelativeImportExtensions: true, rootDir: repoRoot, outDir },
    files: sourceFiles,
  }, null, 2));
  execFileSync(process.execPath, [path.join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfigPath], { cwd: repoRoot, stdio: "inherit" });

  const reportUi = await import(pathToFileURL(path.join(outDir, ".pi", "extensions", "oauth-router", "report-ui.js")).href);
  const commandsModule = await import(pathToFileURL(path.join(outDir, ".pi", "extensions", "oauth-router", "commands.js")).href);
  const routerExtension = await import(pathToFileURL(path.join(outDir, ".pi", "extensions", "oauth-router", "index.js")).href);
  const exactKeyFixtures = [
    { input: "access_token:opaque-bare-access", output: "access_token:[redacted]" },
    { input: 'access_token:"opaque-bare-key-quoted-value"', output: 'access_token:"[redacted]"' },
    { input: '"access_token":opaque-quoted-key-bare-value', output: '"access_token":[redacted]' },
    { input: '"access_token":"opaque-quoted-access"', output: '"access_token":"[redacted]"' },
    { input: "ACCESS_TOKEN = opaque-case-access", output: "ACCESS_TOKEN = [redacted]" },
    { input: '"AcCeSs_ToKeN" : \'opaque-case-quoted-access\'', output: '"AcCeSs_ToKeN" : \'[redacted]\'' },
    { input: 'Authorization:"Basic opaque-basic-quoted"', output: 'Authorization:"[redacted]"' },
  ];
  for (const fixture of exactKeyFixtures) {
    assert.equal(reportUi.sanitizeReportText(fixture.input), fixture.output, `direct sanitizer redacts ${fixture.input}`);
  }

  const secretForms = [
    ...exactKeyFixtures.map(({ input }) => input),
    "Authorization: Basic basic-secret | account_id=acct_normal | status=200",
    'authorization=Digest username="digest-user", realm="digest-realm", nonce="digest-nonce" | status=healthy',
    "Authorization: Negotiate negotiate-secret | user_id=user_normal | status=connected",
    "Authorization: Bearer bearer-secret | account_id=acct_bearer | status=active",
    "authorization: Custom custom multi word secret\x1b[31m | account_id=acct_custom | status=active",
    '"authorization": "Bearer json-bearer-secret", "account_id": "acct_json", "status": "ok"',
    '"authorization": "Basic json-basic-secret"',
    '{"authorization": "Digest username=\\"json-digest-user\\", realm=\\"json-digest-realm\\""}',
    '"authorization": "Negotiate json-negotiate-secret"',
    '"authorization": "Custom json custom multi word secret"',
    '"ACCESS_TOKEN": "json-access-secret", "refresh_token": "json-refresh-secret", "id_token": "json-id-secret", "client_secret": "json-client-secret", "code": "json-code-secret", "api-key": "json-api-secret"',
    '"zipcode": "90210", "account_code": "visible-account-code", "decode": "visible-decode", "monocode": "visible-monocode", "authorization_status": "approved"',
    'Bearer "opaque-bearer-value"',
    "bearer 'opaque-bearer-value-two'",
    "https://example.test/callback?access_token=opaque-query-access&refresh-token=opaque-query-refresh&id_token=opaque-query-id&client_secret=opaque-query-client&code=opaque-query-code&api_key=opaque-query-api&api-key=opaque-query-api-hyphen&apikey=opaque-query-apikey&account_id=acct_url&status=ok#access-token=opaque-fragment-access&refresh_token=opaque-fragment-refresh&id-token=opaque-fragment-id&client-secret=opaque-fragment-client&code=opaque-fragment-code&api_key=opaque-fragment-api",
    "authorization=Bearer opaque-header-value | api_key=opaque-key-value | account_id=acct_header | status=ok",
    "account_id=acct_12345 user_id=user_12345 authorization_status=approved status=healthy",
  ];
  const secretText = ["# oauth-router", ...secretForms].join("\n");
  const secretPattern = /(?:basic-secret|bearer-secret|digest-(?:user|realm|nonce)|negotiate-secret|custom multi word secret|json-(?:access|bearer|basic|digest-(?:user|realm)|negotiate|refresh|id|client|code|api)-secret|json custom multi word secret|opaque-[\w-]+|\x1b)/i;
  const suffixCollisionFixture = '"zipcode": "90210", "account_code": "visible-account-code", "decode": "visible-decode", "monocode": "visible-monocode", "authorization_status": "approved"';
  const sanitizedSecretText = reportUi.createRouterReportLines(secretText).join("\n");
  assert.doesNotMatch(sanitizedSecretText, secretPattern, "all authorization, OAuth URL/JSON values, and controls are redacted");
  assert.match(sanitizedSecretText, /Authorization: \[redacted\] \| account_id=acct_normal \| status=200/, "plain Basic authorization redacts its entire field value");
  assert.match(sanitizedSecretText, /"authorization": "\[redacted\]"/, "quoted JSON authorization retains JSON presentation while redacting its full value");
  assert.match(sanitizedSecretText, /"ACCESS_TOKEN": "\[redacted\]", "refresh_token": "\[redacted\]", "id_token": "\[redacted\]", "client_secret": "\[redacted\]"/, "exact case-insensitive JSON sensitive keys redact");
  assert.match(sanitizedSecretText, new RegExp(suffixCollisionFixture.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "JSON suffix-collision keys remain visible");
  assert.match(sanitizedSecretText, /account_id=acct_12345 user_id=user_12345 authorization_status=approved status=healthy/, "normal identifiers and status text remain visible");
  assert.match(sanitizedSecretText, /account_id=acct_url&status=ok/, "normal URL account IDs and status values remain visible");

  const rpcRedactionEvents = { widgets: [], statuses: [], notifications: [] };
  commandsModule.emitRouterReport(createContext(rpcRedactionEvents, "rpc"), secretText);
  assert.doesNotMatch(rpcRedactionEvents.widgets[0][1].join("\n"), secretPattern, "RPC report fallback redacts multi-word authorization and URL credentials");
  assert.match(rpcRedactionEvents.widgets[0][1].join("\n"), new RegExp(suffixCollisionFixture.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "RPC suffix-collision fixture preserves ordinary JSON keys");

  const tuiRedactionEvents = { widgets: [], statuses: [], notifications: [] };
  commandsModule.emitRouterReport(createContext(tuiRedactionEvents, "tui"), secretText);
  assert.equal(typeof tuiRedactionEvents.widgets[0][1], "function", "TUI redaction fixture receives a component");
  for (const width of [40, 60, 120]) {
    const { theme } = createTheme();
    const lines = tuiRedactionEvents.widgets[0][1](undefined, theme).render(width);
    assert.ok(lines.every((line) => stripAnsi(line).length <= width), `redacted TUI report fits ${width} columns`);
    assert.doesNotMatch(stripAnsi(lines.join("\n")), secretPattern, "TUI report redacts multi-word authorization and URL credentials");
    if (width === 120) assert.match(stripAnsi(lines.join("\n")), /"zipcode": "90210"/, "TUI suffix-collision fixture preserves ordinary JSON keys");
  }

  const semanticLines = [
    "enabled=false state=healthy",
    "state=auth=invalid healthy",
    "state=degraded healthy",
    "state=cooldown healthy",
    "state=penalty healthy",
    "state=disabled healthy",
    "state=inactive healthy",
    "state=healthy enabled=true",
    "Provider: PRO | provider quota",
    "Local: 4 req / 1,816 tokens",
  ];
  const semanticTheme = createTheme();
  reportUi.createRouterReportWidget(semanticLines.join("\n"))(undefined, semanticTheme.theme).render(120);
  assert.equal(colorFor(semanticTheme.calls, semanticLines[0]), "muted", "enabled=false never receives success styling");
  assert.equal(colorFor(semanticTheme.calls, semanticLines[1]), "error", "invalid auth is styled before healthy");
  for (const line of semanticLines.slice(2, 5)) assert.equal(colorFor(semanticTheme.calls, line), "warning", `${line} is degraded styling`);
  for (const line of semanticLines.slice(5, 7)) assert.equal(colorFor(semanticTheme.calls, line), "muted", `${line} is inactive styling`);
  assert.equal(colorFor(semanticTheme.calls, semanticLines[7]), "success", "healthy enabled state remains success");
  assert.equal(colorFor(semanticTheme.calls, semanticLines[8]), "accent", "provider quota category label uses accent styling");
  assert.equal(colorFor(semanticTheme.calls, semanticLines[9]), "muted", "local usage category label uses distinct styling");

  const runtime = createRuntime();
  const commands = new Map();
  commandsModule.registerRouterCommands({ registerCommand: (name, command) => commands.set(name, command) }, runtime);
  const events = { widgets: [], statuses: [], notifications: [] };
  const rpcCtx = createContext(events, "rpc");

  for (const [name, args] of [["router-status", ""], ["router-accounts", ""], ["router-usage", "acct_healthy"], ["router-quota", "acct_healthy"], ["router-usage-raw", "acct_healthy"], ["router-login", "help"], ["router-enable", "acct_invalid"]]) {
    await commands.get(name).handler(args, rpcCtx);
  }
  assert.equal(events.widgets.length, 7, "status, accounts, quota, raw, help, and action reports replace one widget");
  assert.ok(events.widgets.every(([key, content, options]) => key === reportUi.ROUTER_REPORT_WIDGET_KEY && Array.isArray(content) && options.placement === "belowEditor"), "RPC context receives a real sanitized string-array widget fallback");
  assert.ok(events.statuses.length >= 6, "report commands keep live footer health status");
  assert.equal(events.notifications.length, 0, "visible RPC widget confirmations suppress routine duplicate notifications");

  const statusLines = events.widgets[0][1].join("\n");
  assert.match(statusLines, /healthy/, "status renders healthy state");
  assert.match(statusLines, /auth=invalid/, "status renders degraded auth state");
  assert.match(events.widgets[1][1].join("\n"), /Compact account list/, "accounts report renders its compact view");
  assert.match(events.widgets[6][1].join("\n"), /Enabled account/, "action report remains visibly confirmed when components are ignored");

  const usageLines = events.widgets[2][1].join("\n");
  assert.match(usageLines, /Local:/, "usage distinguishes locally observed traffic");
  assert.match(usageLines, /Provider/, "usage labels provider quota separately");
  assert.match(usageLines, /\[[█░]{18}\]/, "RPC fallback retains full provider quota bars");
  const detailedRawLines = events.widgets[4][1].join("\n");
  assert.doesNotMatch(detailedRawLines, /super-secret|opaque-refresh|not-for-display|\x1b/, "raw report redacts provider secrets and controls");
  assert.match(events.widgets.at(-2)[1].join("\n"), /router-clear/, "help documents report dismissal");

  const tuiEvents = { widgets: [], statuses: [], notifications: [] };
  await commands.get("router-status").handler("", createContext(tuiEvents, "tui"));
  assert.equal(typeof tuiEvents.widgets[0][1], "function", "interactive TUI receives the themed component factory");
  for (const width of [40, 60, 120]) {
    const { theme } = createTheme();
    assert.ok(tuiEvents.widgets[0][1](undefined, theme).render(width).every((line) => stripAnsi(line).length <= width), `interactive report fits ${width} columns`);
  }
  const interactiveUsage = reportUi.createRouterReportWidget(events.widgets[2][1].join("\n"));
  assert.match(interactiveUsage(undefined, createTheme().theme).render(40).join("\n"), /\[[█░]{8}\]/, "quota bars compact at narrow widths");

  await commands.get("router-clear").handler("", rpcCtx);
  assert.deepEqual(events.widgets.at(-1), [reportUi.ROUTER_REPORT_WIDGET_KEY, undefined], "clear removes the shared widget predictably");
  assert.deepEqual(events.statuses.at(-1), ["oauth-router", "oauth-router 1/2 healthy | round-robin"], "clear restores the live footer health status");
  await commands.get("router-refresh-usage").handler("acct_healthy", rpcCtx);
  assert.deepEqual(events.notifications.at(-1), ["oauth-router usage refreshed with 1 failure(s)", "error"], "failure notification is retained exactly");

  const lifecycleHandlers = new Map();
  const lifecycleCommands = new Map();
  routerExtension.default({
    registerProvider: () => {},
    registerCommand: (name, command) => lifecycleCommands.set(name, command),
    on: (event, handler) => lifecycleHandlers.set(event, handler),
  });
  const lifecycleOrder = [];
  const originalEvents = { widgets: [], statuses: [], notifications: [] };
  const originalCtx = createContext(originalEvents, "rpc", false);
  const originalSetWidget = originalCtx.ui.setWidget;
  originalCtx.ui.setWidget = (...args) => {
    lifecycleOrder.push(args[1] === undefined ? "old-clear" : "old-report");
    originalSetWidget(...args);
  };
  await lifecycleHandlers.get("session_start")({}, originalCtx);
  await lifecycleCommands.get("router-debug-report").handler("", originalCtx);
  assert.equal(originalEvents.widgets.at(-1)[0], reportUi.ROUTER_REPORT_WIDGET_KEY, "RPC lifecycle test shows the report before shutdown");
  await lifecycleHandlers.get("session_shutdown")({});
  assert.deepEqual(originalEvents.widgets.at(-1), [reportUi.ROUTER_REPORT_WIDGET_KEY, undefined], "session shutdown clears the old RPC report widget when hasUI is false");

  const replacementEvents = { widgets: [], statuses: [], notifications: [] };
  const replacementCtx = createContext(replacementEvents, "rpc", false);
  const replacementSetWidget = replacementCtx.ui.setWidget;
  replacementCtx.ui.setWidget = (...args) => {
    lifecycleOrder.push(args[1] === undefined ? "replacement-clear" : "replacement-report");
    replacementSetWidget(...args);
  };
  await lifecycleHandlers.get("session_start")({}, replacementCtx);
  assert.deepEqual(lifecycleOrder, ["old-report", "old-clear"], "old RPC widget clears before session replacement");
  await lifecycleCommands.get("router-debug-report").handler("", replacementCtx);
  await lifecycleHandlers.get("session_shutdown")({});
  assert.deepEqual(replacementEvents.widgets.at(-1), [reportUi.ROUTER_REPORT_WIDGET_KEY, undefined], "replacement session shutdown clears its RPC report widget when hasUI is false");

  const oauthFlow = await fs.readFile(path.join(extensionRoot, "oauth-flow.ts"), "utf8");
  assert.match(oauthFlow, /ctx\.ui\.notify\(`\$\{provider\.name\}: \$\{info\.instructions \?\? "Finish login in your browser\."\}`, "info"\)/, "OAuth instruction notification remains exact");
  assert.match(oauthFlow, /ctx\.ui\.notify\(`Open \$\{info\.verificationUri\} and enter code \$\{info\.userCode\}`, "info"\)/, "device-code notification remains exact");
  console.log("✓ oauth-router themed report tests passed");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.rm(outDir, { recursive: true, force: true });
}
