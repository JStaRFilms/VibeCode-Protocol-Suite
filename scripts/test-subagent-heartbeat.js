#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionDir = path.join(repoRoot, ".pi", "extensions", "takomi-subagents");

function dataModule(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

async function transpile(fileName, replacements = {}) {
  const source = await fs.readFile(path.join(extensionDir, fileName), "utf8");
  let javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) {
    javascript = javascript.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
  }
  return dataModule(javascript);
}

const heartbeatUrl = await transpile("result-heartbeat.ts");
const heartbeat = await import(heartbeatUrl);

const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
const callbacks = new Map();
const requestedCadences = [];
let nextTimerId = 0;
let clearCount = 0;

globalThis.setInterval = (callback, cadence) => {
  requestedCadences.push(cadence);
  const timer = { id: ++nextTimerId, unref() {} };
  callbacks.set(timer, callback);
  return timer;
};
globalThis.clearInterval = (timer) => {
  clearCount += 1;
  callbacks.delete(timer);
};

try {
  assert.equal(heartbeat.TAKOMI_SUBAGENT_HEARTBEAT_MS, 125, "active partial rows must use the validated 125ms cadence");

  let firstInvalidations = 0;
  let secondInvalidations = 0;
  const firstContext = { state: {}, invalidate: () => { firstInvalidations += 1; } };
  const secondContext = { state: {}, invalidate: () => { secondInvalidations += 1; } };

  heartbeat.ensureTakomiSubagentResultHeartbeat(firstContext);
  heartbeat.ensureTakomiSubagentResultHeartbeat(secondContext);
  heartbeat.ensureTakomiSubagentResultHeartbeat(firstContext);
  assert.deepEqual(requestedCadences, [125, 125], "each row starts one 125ms timer and duplicate renders start none");
  assert.equal(callbacks.size, 2, "two simultaneous partial rows must own two independent timers");

  callbacks.get(firstContext.state.takomiSubagentHeartbeatTimer)();
  callbacks.get(secondContext.state.takomiSubagentHeartbeatTimer)();
  callbacks.get(secondContext.state.takomiSubagentHeartbeatTimer)();
  assert.equal(firstInvalidations, 1, "the first timer invalidates only its own row");
  assert.equal(secondInvalidations, 2, "the second timer invalidates only its own row");
  assert.equal(heartbeat.getTakomiSubagentHeartbeatFrame(firstContext), 1, "first row keeps an isolated frame");
  assert.equal(heartbeat.getTakomiSubagentHeartbeatFrame(secondContext), 2, "second row keeps an isolated frame");

  // Exercise the renderer heartbeat integration. Rendering the same partial row
  // must reuse Takomi's timer rather than creating a second animation timer.
  const textStubUrl = dataModule(`
    export class Text { constructor(text, x, y) { this.text = text; this.x = x; this.y = y; } }
    export class Spacer { constructor(lines) { this.lines = lines; } }
    export class Container { constructor() { this.children = []; } addChild(child) { this.children.push(child); } }
    export function visibleWidth(value) { return [...value].length; }
  `);
  const uxUrl = await transpile("subagent-ux.ts", { "@earendil-works/pi-tui": textStubUrl });
  const internalsRenderStubUrl = dataModule(`
    export function renderNativeSubagentResult(_result, options) {
      return { text: options.expanded ? "native expanded" : "takomi_subagent running" };
    }
  `);
  const nativeRenderUrl = await transpile("native-render.ts", {
    "@earendil-works/pi-tui": textStubUrl,
    "./pi-subagents-internal": internalsRenderStubUrl,
    "./subagent-ux": uxUrl,
    "./result-heartbeat": heartbeatUrl,
  });
  const nativeRender = await import(nativeRenderUrl);
  const theme = { fg: (_color, value) => value, bold: (value) => value };
  const partialResult = { content: [{ type: "text", text: "running" }], details: { mode: "single", results: [{ agent: "worker", progress: { status: "running" } }] } };
  const flatten = (component) => component?.text ?? component?.children?.map(flatten).filter(Boolean).join("\n") ?? "";

  const firstRendered = nativeRender.renderTakomiSubagentResult(partialResult, { expanded: false, isPartial: true }, theme, firstContext);
  const secondRendered = nativeRender.renderTakomiSubagentResult(partialResult, { expanded: true, isPartial: true }, theme, secondContext);
  assert.match(flatten(firstRendered), /takomi_subagent running/, "compact partial rendering remains active");
  assert.match(flatten(secondRendered), /native expanded/, "expanded partial rendering remains available");
  assert.equal(callbacks.size, 2, "renderer must not create a conflicting second timer");
  assert.equal(firstContext.state.subagentResultAnimationTimer, undefined, "Takomi must not install the native legacy timer");

  nativeRender.renderTakomiSubagentResult(partialResult, { expanded: false, isPartial: false }, theme, firstContext);
  assert.equal(callbacks.size, 1, "rendering a settled result clears only that row heartbeat");
  assert.equal(firstContext.state.takomiSubagentHeartbeatTimer, undefined, "settled row timer state is cleared");
  assert.equal(secondContext.state.takomiSubagentHeartbeatTimer.id > 0, true, "another active row remains unaffected by settlement");

  // Load the actual extension entry point with only its external collaborators
  // stubbed, then invoke the lifecycle callbacks it registers.
  const typeboxStubUrl = dataModule(`
    const schema = (...args) => ({ args });
    export const Type = new Proxy({}, { get: () => schema });
  `);
  const entryNativeStubUrl = dataModule(`
    export function renderTakomiSubagentCall() {}
    export function renderTakomiSubagentResult() {}
  `);
  const internalsStubUrl = dataModule(`export async function loadPiSubagentsInternals() { return {}; }`);
  const toolRunnerStubUrl = dataModule(`export async function executeTakomiSubagentTool() { return {}; }`);
  const detachedStubUrl = dataModule(`
    export async function initializeDetachedSession() { globalThis.__detachedRestores = (globalThis.__detachedRestores ?? 0) + 1; }
    export function clearDetachedResults() { globalThis.__detachedClears = (globalThis.__detachedClears ?? 0) + 1; }
    export function registerDetachedCompletionNotifications(pi) {
      globalThis.__detachedRegistrations = (globalThis.__detachedRegistrations ?? 0) + 1;
      const unsubscribe = pi.events.on("subagent:async-complete", () => {});
      return () => { globalThis.__detachedUnregisters = (globalThis.__detachedUnregisters ?? 0) + 1; unsubscribe(); };
    }
  `);
  const indexUrl = await transpile("index.ts", {
    typebox: typeboxStubUrl,
    "./detached-results": detachedStubUrl,
    "./native-render": entryNativeStubUrl,
    "./pi-subagents-internal": internalsStubUrl,
    "./result-heartbeat": heartbeatUrl,
    "./tool-runner": toolRunnerStubUrl,
  });
  const extension = await import(indexUrl);
  const lifecycleHandlers = new Map();
  const eventHandlers = new Map();
  let completionUnsubscribed = false;
  await extension.default({
    registerTool() {},
    events: {
      on(event, handler) {
        eventHandlers.set(event, handler);
        return () => { completionUnsubscribed = true; eventHandlers.delete(event); };
      },
    },
    on(event, handler) { lifecycleHandlers.set(event, handler); },
  });
  assert.equal(eventHandlers.has("subagent:async-complete"), true, "extension installs event-driven completion notification without polling");
  assert.equal(globalThis.__detachedRegistrations, 1, "completion notification lifecycle is registered once");
  assert.deepEqual(
    [...lifecycleHandlers.keys()].sort(),
    ["agent_end", "session_shutdown", "session_start"],
    "extension must register same-session and session-boundary cleanup",
  );

  let abandonedInvalidations = 0;
  const abandonedContext = { state: {}, invalidate: () => { abandonedInvalidations += 1; } };
  heartbeat.ensureTakomiSubagentResultHeartbeat(abandonedContext);
  callbacks.get(abandonedContext.state.takomiSubagentHeartbeatTimer)();
  callbacks.get(abandonedContext.state.takomiSubagentHeartbeatTimer)();
  assert.equal(abandonedInvalidations, 2, "abandoned row can remain apparently valid and keep invalidating");
  assert.equal(callbacks.size, 2, "abandoned and active rows remain registered before turn cleanup");
  lifecycleHandlers.get("agent_end")();
  assert.equal(callbacks.size, 0, "agent_end clears abandoned same-session rows even when invalidate never throws");
  assert.equal(abandonedContext.state.takomiSubagentHeartbeatTimer, undefined, "agent_end clears abandoned timer state");
  assert.equal(secondContext.state.takomiSubagentHeartbeatTimer, undefined, "agent_end clears every remaining row from the completed turn");

  const sessionStartContext = { state: {}, invalidate() {} };
  heartbeat.ensureTakomiSubagentResultHeartbeat(sessionStartContext);
  await lifecycleHandlers.get("session_start")({}, {});
  assert.equal(callbacks.size, 0, "session_start retains replacement-session cleanup");
  assert.equal(globalThis.__detachedRestores, 1, "session_start restores authenticated detached provenance");

  const sessionShutdownContext = { state: {}, invalidate() {} };
  heartbeat.ensureTakomiSubagentResultHeartbeat(sessionShutdownContext);
  lifecycleHandlers.get("session_shutdown")();
  assert.equal(callbacks.size, 0, "session_shutdown retains shutdown cleanup");
  assert.equal(globalThis.__detachedClears, 1, "session_shutdown clears detached provenance storage");
  assert.equal(globalThis.__detachedUnregisters, 1, "session shutdown releases the completion notification lifecycle");
  assert.equal(completionUnsubscribed, true, "session shutdown releases the completion event listener");

  const staleContext = { state: {}, invalidate: () => { throw new Error("Extension context no longer active"); } };
  heartbeat.ensureTakomiSubagentResultHeartbeat(staleContext);
  callbacks.get(staleContext.state.takomiSubagentHeartbeatTimer)();
  assert.equal(callbacks.size, 0, "a stale row still self-disposes when invalidation fails");
  assert.ok(clearCount >= 6, "all settlement, lifecycle, and stale-row paths clear their timers");

  console.log("✓ takomi subagent heartbeat cadence, concurrency, rendering, and lifecycle tests passed");
} finally {
  heartbeat.clearAllTakomiSubagentResultHeartbeats();
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
}
