#!/usr/bin/env node
import assert from "node:assert/strict";
import fsSync from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { KeybindingsManager } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/keybindings.js";
import { CustomEditor } from "../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/custom-editor.js";
import { InteractiveMode } from "../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionDir = path.join(repoRoot, ".pi", "extensions", "takomi-subagents");
const nativeRoot = path.join(repoRoot, "node_modules", "pi-subagents");
const fixtureRoot = path.join(repoRoot, ".tmp", `production-lifecycle-${process.pid}`);
const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-production-lifecycle-"));
const workspace = path.join(runtimeRoot, "workspace");
const sessionFile = path.join(runtimeRoot, "session.jsonl");
const originalChildEnv = process.env.PI_SUBAGENT_CHILD;
const originalParentSessionEnv = process.env.PI_SUBAGENT_PARENT_SESSION;
delete process.env.PI_SUBAGENT_CHILD;
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function transpileTakomi(fileName, replacements = {}) {
  const source = await fs.readFile(path.join(extensionDir, fileName), "utf8");
  let javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) {
    javascript = javascript.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
  }
  return dataModule(javascript);
}

async function sourceFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : entry.name.endsWith(".ts") ? [target] : [];
  }))).flat();
}

async function compilePinnedNative() {
  const pkg = JSON.parse(await fs.readFile(path.join(nativeRoot, "package.json"), "utf8"));
  assert.equal(pkg.version, "0.31.0", "production lifecycle evidence uses pinned pi-subagents@0.31.0");
  await fs.rm(fixtureRoot, { recursive: true, force: true });
  for (const sourceFile of await sourceFiles(path.join(nativeRoot, "src"))) {
    const target = path.join(fixtureRoot, path.relative(nativeRoot, sourceFile)).replace(/\.ts$/, ".js");
    const source = await fs.readFile(sourceFile, "utf8");
    const javascript = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replaceAll(".ts\"", ".js\"").replaceAll(".ts'", ".js'");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, javascript);
  }
  await fs.writeFile(path.join(fixtureRoot, "package.json"), JSON.stringify({ type: "module" }));
}

await Promise.all([
  fs.mkdir(workspace, { recursive: true }),
  fs.writeFile(sessionFile, ""),
]);
await compilePinnedNative();

const nativeExtensionUrl = pathToFileURL(path.join(fixtureRoot, "src", "extension", "index.js")).href;
const watcherUrl = pathToFileURL(path.join(fixtureRoot, "src", "runs", "background", "result-watcher.js")).href;
const renderUrl = pathToFileURL(path.join(fixtureRoot, "src", "tui", "render.js")).href;
const sharedUrl = pathToFileURL(path.join(fixtureRoot, "src", "shared", "types.js")).href;
const nativeShared = await import(sharedUrl);
const asyncRoot = nativeShared.ASYNC_DIR;
const resultsRoot = nativeShared.RESULTS_DIR;
const artifactsRoot = nativeShared.TEMP_ARTIFACTS_DIR;
await Promise.all([
  fs.mkdir(asyncRoot, { recursive: true }),
  fs.mkdir(resultsRoot, { recursive: true }),
  fs.mkdir(artifactsRoot, { recursive: true }),
]);

async function cleanupProductionArtifacts() {
  for (const file of await fs.readdir(resultsRoot)) {
    if (file.startsWith("takomi-production-run-")) {
      await fs.rm(path.join(resultsRoot, file), { force: true });
    }
  }
  for (const entry of await fs.readdir(asyncRoot)) {
    if (entry.startsWith("takomi-production-run-")) {
      await fs.rm(path.join(asyncRoot, entry), { recursive: true, force: true });
    }
  }
}
await cleanupProductionArtifacts();

const originalWatch = fsSync.watch;
const activeResultWatchers = new Set();
let resultWatcherCreates = 0;
fsSync.watch = function instrumentedWatch(target, ...args) {
  const watcher = originalWatch.call(this, target, ...args);
  if (path.resolve(String(target)) === path.resolve(resultsRoot)) {
    resultWatcherCreates += 1;
    activeResultWatchers.add(watcher);
    const close = watcher.close.bind(watcher);
    let closed = false;
    watcher.close = () => {
      if (!closed) {
        closed = true;
        activeResultWatchers.delete(watcher);
      }
      return close();
    };
  }
  return watcher;
};
syncBuiltinESMExports();

const internalsUrl = dataModule(`
  import fs from "node:fs";
  import path from "node:path";
  import { createResultWatcher } from ${JSON.stringify(watcherUrl)};
  import { renderWidget } from ${JSON.stringify(renderUrl)};
  import { ASYNC_DIR, RESULTS_DIR, TEMP_ARTIFACTS_DIR, WIDGET_KEY } from ${JSON.stringify(sharedUrl)};
  export { ASYNC_DIR, RESULTS_DIR, TEMP_ARTIFACTS_DIR, WIDGET_KEY };
  export async function loadPiSubagentsInternals() {
    return {
      ASYNC_DIR, RESULTS_DIR, TEMP_ARTIFACTS_DIR, WIDGET_KEY, renderWidget, createResultWatcher,
      resolveCurrentSessionId: (manager) => manager.getSessionFile() ?? manager.getSessionId(),
      DEFAULT_ARTIFACT_CONFIG: {},
      discoverPiAgents: () => ({ agents: [{ name: "coder", source: "user" }] }),
      createSubagentExecutor({ pi, state }) {
        globalThis.__productionExecutorBindings.push(state);
        return {
          async execute(_toolId, params, _signal, _onUpdate, ctx) {
            const sequence = ++globalThis.__productionRunSequence;
            const id = "takomi-production-run-" + sequence;
            const asyncDir = path.join(ASYNC_DIR, id);
            fs.mkdirSync(asyncDir, { recursive: true });
            pi.events.emit("subagent:async-started", {
              id, runId: id, asyncDir, sessionId: ctx.sessionManager.getSessionFile() ?? ctx.sessionManager.getSessionId(),
              mode: "single", agent: params.agent, agents: [params.agent], pid: 4200 + sequence,
            });
            setTimeout(() => {
              const completion = {
                id, runId: id, asyncDir, sessionId: ctx.sessionManager.getSessionFile() ?? ctx.sessionManager.getSessionId(),
                cwd: ctx.cwd, mode: "single", state: "complete", success: true,
                agent: params.agent, summary: "Production lifecycle completed " + sequence + ".", durationMs: 25,
                nestedChildren: [],
                results: [{
                  agent: params.agent, success: true,
                  output: "Production lifecycle completed " + sequence + ".\\n- [x] Verify production lifecycle",
                }],
              };
              const temporary = path.join(RESULTS_DIR, id + ".tmp");
              fs.writeFileSync(temporary, JSON.stringify(completion));
              fs.renameSync(temporary, path.join(RESULTS_DIR, id + ".json"));
            }, 800);
            return {
              content: [{ type: "text", text: "Background subagent started: " + id }],
              details: { mode: "single", results: [], asyncId: id, runId: id, asyncDir },
            };
          },
        };
      },
    };
  }
  export function renderNativeSubagentResult() {}
`);

const tuiStub = dataModule(`export function visibleWidth(value) { return [...value].length; }`);
const uxUrl = await transpileTakomi("subagent-ux.ts", { "@earendil-works/pi-tui": tuiStub });
const detachedUrl = await transpileTakomi("detached-results.ts", {
  "./pi-subagents-internal": internalsUrl,
  "./subagent-ux": uxUrl,
});
const lifecycleUrl = await transpileTakomi("async-lifecycle.ts", { "./pi-subagents-internal": internalsUrl });
const aliasesStub = dataModule(`export function resolveAgentName(name) { return name; }`);
const routingStub = dataModule(`
  export function applyTakomiRoutingDefaults(value) { return value; }
  export function loadTakomiModelRoutingSnapshotSync() { return {}; }
  export async function loadTakomiModelRoutingSnapshot() { return {}; }
`);
const engineUrl = await transpileTakomi("pi-subagents-engine.ts", {
  "./pi-subagents-internal": internalsUrl,
  "./agent-aliases": aliasesStub,
  "../takomi-runtime/model-routing-defaults": routingStub,
  "./async-lifecycle": lifecycleUrl,
});
const profileStub = dataModule(`export async function loadTakomiProfile() { return { launchMode: "auto" }; }`);
const provenanceStub = dataModule(`export function hasUserGateAutoProvenance() { return false; }`);
const agentsStub = dataModule(`export function discoverTakomiAgents() { return [{ name: "coder", source: "user" }]; }`);
const delegationStub = dataModule(`
  export function createTakomiDelegationPlan(options) { return { ...options }; }
  export function renderTakomiDelegationPlan() { return "plan"; }
`);
const toolRunnerUrl = await transpileTakomi("tool-runner.ts", {
  "../takomi-runtime/profile": profileStub,
  "../takomi-runtime/gate-provenance": provenanceStub,
  "../takomi-runtime/model-routing-defaults": routingStub,
  "./agent-aliases": aliasesStub,
  "./agents": agentsStub,
  "./delegation-plan": delegationStub,
  "./detached-results": detachedUrl,
  "./pi-subagents-engine": engineUrl,
  "./subagent-ux": uxUrl,
});
const typeboxStub = dataModule(`
  const schema = (...args) => ({ args });
  export const Type = new Proxy({}, { get: () => schema });
`);
const nativeRenderStub = dataModule(`export function renderTakomiSubagentCall() {} export function renderTakomiSubagentResult() {}`);
const heartbeatStub = dataModule(`export function clearAllTakomiSubagentResultHeartbeats() {}`);
const indexUrl = await transpileTakomi("index.ts", {
  typebox: typeboxStub,
  "./async-lifecycle": lifecycleUrl,
  "./detached-results": detachedUrl,
  "./native-render": nativeRenderStub,
  "./pi-subagents-internal": internalsUrl,
  "./result-heartbeat": heartbeatStub,
  "./tool-runner": toolRunnerUrl,
});
const [takomiExtension, lifecycleModule, nativeExtension] = await Promise.all([
  import(indexUrl),
  import(lifecycleUrl),
  import(nativeExtensionUrl),
]);

const identityTheme = new Proxy({}, {
  get: (_target, key) => key === "bold" ? (value) => value : (_color, value) => value,
});

function createHarness(name) {
  const eventHandlers = new Map();
  const lifecycleHandlers = new Map();
  const entries = [];
  const widgets = [];
  const messages = [];
  let toolsExpanded = false;
  let renderRequests = 0;
  const emissions = [];
  const tools = new Map();
  const waiters = [];
  const pi = {
    registerTool(value) { tools.set(value.name, value); },
    registerMessageRenderer() {},
    registerCommand() {},
    getSessionName() { return name; },
    events: {
      on(event, handler) {
        const handlers = eventHandlers.get(event) ?? new Set();
        handlers.add(handler);
        eventHandlers.set(event, handlers);
        return () => handlers.delete(handler);
      },
      emit(event, payload) {
        emissions.push({ event, payload });
        for (const handler of [...(eventHandlers.get(event) ?? [])]) {
          Promise.resolve(handler(payload)).catch((error) => {
            for (const waiter of waiters.splice(0)) waiter.reject(error);
          });
        }
      },
    },
    on(event, handler) {
      const handlers = lifecycleHandlers.get(event) ?? [];
      handlers.push(handler);
      lifecycleHandlers.set(event, handlers);
    },
    appendEntry(customType, data) { entries.push({ type: "custom", customType, data }); },
    sendMessage(message, options) {
      messages.push({ message, options });
      for (const waiter of [...waiters]) {
        if (messages.length >= waiter.count) {
          waiters.splice(waiters.indexOf(waiter), 1);
          waiter.resolve();
        }
      }
    },
  };
  const sessionManager = {
    getSessionId: () => `${name}-session`,
    getSessionFile: () => sessionFile,
    getHeader: () => ({}),
    getEntries: () => entries,
    getBranch: () => entries,
  };
  const ctx = {
    cwd: workspace,
    hasUI: true,
    sessionManager,
    ui: {
      theme: identityTheme,
      setWidget(key, value) { widgets.push({ key, value, toolsExpanded }); },
      requestRender() { renderRequests += 1; },
      confirm: async () => true,
      getToolsExpanded: () => toolsExpanded,
      setToolsExpanded(value) { toolsExpanded = value; renderRequests += 1; },
    },
  };
  function waitForMessages(count, timeoutMs = 3000) {
    if (messages.length >= count) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = waiters.findIndex((waiter) => waiter.resolve === wrappedResolve);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error(`completion timed out at ${messages.length}/${count}; emissions=${emissions.map((item) => item.event).join(",")}`));
      }, timeoutMs);
      const wrappedResolve = () => { clearTimeout(timeout); resolve(); };
      waiters.push({ count, resolve: wrappedResolve, reject });
    });
  }
  return {
    pi, ctx, entries, widgets, messages, emissions, tools, eventHandlers, lifecycleHandlers, waitForMessages,
    get toolsExpanded() { return toolsExpanded; },
    get renderRequests() { return renderRequests; },
  };
}

async function fireLifecycle(harness, event) {
  for (const handler of harness.lifecycleHandlers.get(event) ?? []) await handler({}, harness.ctx);
}

function renderWidgetText(widget) {
  const component = typeof widget === "function" ? widget(undefined, identityTheme) : widget;
  assert.ok(component && typeof component.render === "function", "running widget exposes a production TUI component");
  return component.render(100).join("\n");
}

async function settleRegistration() {
  await Promise.resolve();
  await Promise.resolve();
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function executeAndAssert(harness, expectedMessageCount, previousSnapshot, exerciseKeyDispatch = false) {
  const tool = harness.tools.get("takomi_subagent");
  assert.ok(tool, "default Takomi registration exposes the production tool");
  const bindingsBefore = globalThis.__productionExecutorBindings.length;
  const result = await tool.execute(`production-call-${expectedMessageCount}`, {
    agent: "coder",
    task: "Exercise production async lifecycle",
    async: true,
    checklist: ["Verify production lifecycle"],
  }, new AbortController().signal, undefined, harness.ctx);
  const snapshot = lifecycleModule.getTakomiAsyncLifecycleSnapshot(harness.pi);
  assert.ok(snapshot, "Takomi lifecycle state always exists for its executor");
  assert.equal(globalThis.__productionExecutorBindings.at(-1), snapshot.state, "executor state identity equals the active Takomi lifecycle state");
  assert.equal(snapshot.state.poller, null, "Takomi lifecycle introduces no polling loop");
  assert.equal(snapshot.state.subagentInProgress, false, "detached launch clears the foreground/global single-dispatch guard");
  assert.equal(snapshot.state.asyncJobs.get(result.details.asyncId)?.status, "running", "post-spawn async-started state is running");
  if (previousSnapshot) {
    assert.notEqual(snapshot.state, previousSnapshot.state, "lifecycle replacement exposes a new state identity");
    assert.ok(snapshot.generation > previousSnapshot.generation, "lifecycle replacement advances generation");
    assert.equal(globalThis.__productionExecutorBindings.length, bindingsBefore + 1, "execution rebuilds the executor for the new lifecycle generation");
  }
  const runningWidget = harness.widgets.at(-1);
  assert.ok(runningWidget?.value, "async-started immediately leaves one visible widget");
  assert.match(renderWidgetText(runningWidget.value), /running/i, "rendered production widget labels the post-spawn run as running");
  assert.equal(new Set(harness.widgets.filter((entry) => entry.value).map((entry) => entry.key)).size, 1, "native and Takomi rendering share one widget key");
  assert.equal(activeResultWatchers.size, 1, "exactly one native result watcher is active");

  const widgetCountBeforeHeartbeat = harness.widgets.length;
  const renderRequestsBeforeHeartbeat = harness.renderRequests;
  if (exerciseKeyDispatch) {
    let historicalExpanded = false;
    const historicalResult = { setExpanded(value) { historicalExpanded = value; } };
    const productionAppState = {
      toolOutputExpanded: false,
      customHeader: undefined,
      builtInHeader: undefined,
      chatContainer: { children: [historicalResult] },
      ui: { requestRender() {} },
      setToolsExpanded: InteractiveMode.prototype.setToolsExpanded,
    };
    const editor = new CustomEditor({}, {}, new KeybindingsManager());
    editor.onAction("app.tools.expand", () => {
      InteractiveMode.prototype.toggleToolOutputExpansion.call(productionAppState);
      harness.ctx.ui.setToolsExpanded(productionAppState.toolOutputExpanded);
    });
    editor.handleInput("\x0f");
    assert.equal(harness.toolsExpanded, true, "real Ctrl+O dispatch toggles Pi's app.tools.expand state with the async widget present");
    assert.equal(historicalExpanded, true, "Pi's production expansion method still expands historical tool results");
  }
  await delay(520);
  const heartbeatWidgets = harness.widgets.slice(widgetCountBeforeHeartbeat).filter((entry) => entry.value);
  assert.ok(heartbeatWidgets.length >= 2, "bounded heartbeat rebuilds the native widget while the async job exists");
  assert.ok(harness.renderRequests > renderRequestsBeforeHeartbeat, "each animation heartbeat requests a real Pi render");
  const heartbeatFrames = heartbeatWidgets.map((entry) => renderWidgetText(entry.value));
  assert.ok(new Set(heartbeatFrames).size >= 2, "native widget heartbeat advances actual rendered spinner frames");
  if (exerciseKeyDispatch) {
    assert.equal(heartbeatWidgets.at(-1).toolsExpanded, true, "heartbeat rebuilds the widget from the current global expansion state");
  }

  await harness.waitForMessages(expectedMessageCount);
  assert.equal(harness.messages.length, expectedMessageCount, "each async execution emits exactly one completion card");
  const completion = harness.messages.at(-1);
  assert.equal(completion.options.triggerTurn, true, "completion card is event-driven into the parent turn");
  assert.match(completion.message.details.resultPreview, /Production lifecycle completed/, "completion card includes the final answer");
  assert.match(completion.message.details.resultPreview, /Checklist provenance: 1\/1/, "completion card includes trusted checklist provenance");
  assert.equal(harness.widgets.at(-1).value, undefined, "completion clears the running widget without a status call");
  const widgetsAfterCompletion = harness.widgets.length;
  await delay(180);
  const postCompletionWidgets = harness.widgets.slice(widgetsAfterCompletion).filter((entry) => entry.value);
  assert.ok(
    postCompletionWidgets.every((entry) => !/running/i.test(renderWidgetText(entry.value))),
    "completion stops running animation frames while allowing native completed-job retention",
  );
  return snapshot;
}

async function shutdownAndAssert(harness) {
  await fireLifecycle(harness, "session_shutdown");
  assert.equal(activeResultWatchers.size, 0, "shutdown closes the sole watcher");
  assert.equal([...harness.eventHandlers.values()].reduce((count, handlers) => count + handlers.size, 0), 0, "shutdown removes watcher/widget/completion event subscriptions");
  assert.equal(harness.widgets.at(-1).value, undefined, "shutdown leaves no widget behind");
  assert.equal(lifecycleModule.getTakomiAsyncLifecycleSnapshot(harness.pi), undefined, "shutdown disposes the active Takomi lifecycle state");
  assert.equal(globalThis.__piSubagentRuntimeCleanup, undefined, "shutdown releases native watcher ownership");
  assert.equal(globalThis.__takomiPiSubagentRuntimeCleanup, undefined, "shutdown releases Takomi lifecycle ownership");

  for (const emission of harness.emissions.filter((item) => item.event === "subagent:async-started")) {
    await fs.rm(emission.payload.asyncDir, { recursive: true, force: true });
  }
}

async function runTakomiOnlyLifecycle() {
  const harness = createHarness("takomi-only");
  await takomiExtension.default(harness.pi);
  await fireLifecycle(harness, "session_start");
  const snapshot = await executeAndAssert(harness, 1, undefined, true);
  assert.equal(snapshot.ownership, "takomi", "Takomi owns the sole watcher when standalone is absent");
  await shutdownAndAssert(harness);
}

async function runRegistrationOrder(order) {
  const harness = createHarness(order);
  let snapshot;
  if (order === "native-before-takomi") {
    nativeExtension.default(harness.pi);
    await takomiExtension.default(harness.pi);
  } else {
    await takomiExtension.default(harness.pi);
    nativeExtension.default(harness.pi);
  }
  await settleRegistration();
  await fireLifecycle(harness, "session_start");
  snapshot = await executeAndAssert(harness, 1);
  assert.equal(snapshot.ownership, "native", "Takomi keeps executor state while standalone owns the sole watcher");

  await takomiExtension.default(harness.pi);
  await settleRegistration();
  const afterTakomiReload = lifecycleModule.getTakomiAsyncLifecycleSnapshot(harness.pi);
  assert.ok(afterTakomiReload && afterTakomiReload.generation > snapshot.generation, "Takomi reload replaces the lifecycle generation");
  snapshot = await executeAndAssert(harness, 2, snapshot);

  nativeExtension.default(harness.pi);
  await settleRegistration();
  await fireLifecycle(harness, "session_start");
  snapshot = await executeAndAssert(harness, 3, snapshot);
  assert.equal(snapshot.ownership, "native", "Takomi tracks events after standalone ownership takeover");
  await shutdownAndAssert(harness);
}

try {
  globalThis.__productionExecutorBindings = [];
  globalThis.__productionRunSequence = 0;
  await runTakomiOnlyLifecycle();
  await runRegistrationOrder("native-before-takomi");
  await runRegistrationOrder("takomi-before-native");
  assert.ok(resultWatcherCreates >= 6, "Takomi-only, real registration orders, and reloads exercised native watcher creation");
  console.log("✓ Takomi-only and actual standalone native-before/Takomi-before lifecycle ownership, running UI, reload, completion, and cleanup passed");
} finally {
  const takomiCleanup = globalThis.__takomiPiSubagentRuntimeCleanup;
  if (typeof takomiCleanup === "function") takomiCleanup();
  const nativeCleanup = globalThis.__piSubagentRuntimeCleanup;
  if (typeof nativeCleanup === "function") nativeCleanup();
  fsSync.watch = originalWatch;
  syncBuiltinESMExports();
  delete globalThis.__piSubagentRuntimeCleanup;
  delete globalThis.__takomiPiSubagentRuntimeCleanup;
  delete globalThis.__takomiPiSubagentLifecycleGeneration;
  delete globalThis.__piSubagentEventUnsubscribes;
  delete globalThis.__piSubagentVisibleControlNotices;
  delete globalThis.__pi_subagents_notify_unsubscribe__;
  delete globalThis.__takomi_detached_notify_handler__;
  delete globalThis.__pi_subagents_notify_seen__;
  delete globalThis.__takomi_detached_trusted_launches__;
  delete globalThis.__productionExecutorBindings;
  delete globalThis.__productionRunSequence;
  if (originalChildEnv === undefined) delete process.env.PI_SUBAGENT_CHILD;
  else process.env.PI_SUBAGENT_CHILD = originalChildEnv;
  if (originalParentSessionEnv === undefined) delete process.env.PI_SUBAGENT_PARENT_SESSION;
  else process.env.PI_SUBAGENT_PARENT_SESSION = originalParentSessionEnv;
  await cleanupProductionArtifacts();
  await fs.rm(fixtureRoot, { recursive: true, force: true });
  await fs.rm(runtimeRoot, { recursive: true, force: true });
}
