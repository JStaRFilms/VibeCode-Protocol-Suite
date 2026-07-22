#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTheme } from "@earendil-works/pi-coding-agent";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionDir = path.join(repoRoot, ".pi", "extensions", "takomi-subagents");
const pinnedPackagePath = path.join(repoRoot, "node_modules", "pi-subagents", "package.json");
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

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

async function sourceFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(entryPath) : entry.name.endsWith(".ts") ? [entryPath] : [];
  }));
  return files.flat();
}

/**
 * Node does not strip TypeScript inside node_modules. Compile a disposable copy
 * of the installed source so these assertions exercise the actual pinned
 * pi-subagents renderer, rather than a hand-written native-render substitute.
 */
async function pinnedRendererUrl() {
  const pinnedPackage = JSON.parse(await fs.readFile(pinnedPackagePath, "utf8"));
  assert.equal(pinnedPackage.version, "0.31.0", "visual evidence must use pinned pi-subagents@0.31.0");

  const sourceRoot = path.dirname(pinnedPackagePath);
  const fixtureRoot = path.join(repoRoot, ".tmp", `pinned-pi-subagents-${process.pid}`);
  await fs.rm(fixtureRoot, { recursive: true, force: true });
  try {
    for (const sourceFile of await sourceFiles(path.join(sourceRoot, "src"))) {
      const relative = path.relative(sourceRoot, sourceFile);
      const target = path.join(fixtureRoot, relative).replace(/\.ts$/, ".js");
      const source = await fs.readFile(sourceFile, "utf8");
      const javascript = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
        .replaceAll(".ts\"", ".js\"")
        .replaceAll(".ts'", ".js'");
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, javascript);
    }
    await fs.writeFile(path.join(fixtureRoot, "package.json"), JSON.stringify({ type: "module" }));
    return {
      url: pathToFileURL(path.join(fixtureRoot, "src", "tui", "render.js")).href,
      extensionUrl: pathToFileURL(path.join(fixtureRoot, "src", "extension", "index.js")).href,
      fixtureRoot,
    };
  } catch (error) {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
    throw error;
  }
}

function withTerminalWidth(width, render) {
  const terminal = process.stdout;
  const original = Object.getOwnPropertyDescriptor(terminal, "columns");
  Object.defineProperty(terminal, "columns", { configurable: true, value: width + 4 });
  try {
    return render();
  } finally {
    if (original) Object.defineProperty(terminal, "columns", original);
    else delete terminal.columns;
  }
}

const tuiStubUrl = dataModule(`
  export class Text {
    constructor(text) { this.text = text; }
    render(width) { return this.text.split("\\n"); }
    invalidate() {}
  }
  export class Spacer {
    constructor(lines) { this.lines = lines; }
    render() { return Array(this.lines).fill(""); }
    invalidate() {}
  }
  export class Container {
    constructor() { this.children = []; }
    addChild(child) { this.children.push(child); }
    render(width) { return this.children.flatMap((child) => child.render(width)); }
    invalidate() {}
  }
  export function visibleWidth(value) {
    let width = 0;
    for (const char of value) {
      if (/\\p{Mark}/u.test(char) || char === "\\u200d" || char === "\\ufe0f") continue;
      width += /[\\p{Extended_Pictographic}\\u1100-\\u115f\\u2e80-\\ua4cf\\uac00-\\ud7a3\\uf900-\\ufaff\\uff01-\\uff60]/u.test(char) ? 2 : 1;
    }
    return width;
  }
`);
const uxUrl = await transpile("subagent-ux.ts", { "@earendil-works/pi-tui": tuiStubUrl });
const ux = await import(uxUrl);
const detachedInternalsUrl = dataModule(`
  let roots;
  let restoreGate;
  export function setDetachedRoots(value) { roots = value; }
  export function deferDetachedRoots() {
    let release;
    restoreGate = new Promise((resolve) => { release = resolve; });
    return () => release();
  }
  export async function loadPiSubagentsInternals() {
    if (restoreGate) {
      const gate = restoreGate;
      await gate;
      if (restoreGate === gate) restoreGate = undefined;
    }
    if (!roots) throw new Error("detached roots not configured");
    return roots;
  }
`);
const detachedInternals = await import(detachedInternalsUrl);
const detachedUrl = await transpile("detached-results.ts", {
  "./subagent-ux": uxUrl,
  "./pi-subagents-internal": detachedInternalsUrl,
});
const detached = await import(detachedUrl);
const asyncFixtureSource = JSON.parse(await fs.readFile(path.join(repoRoot, "scripts", "fixtures", "pi-subagents-0.31.0-async.json"), "utf8"));
const heartbeatStubUrl = dataModule(`
  export function ensureTakomiSubagentResultHeartbeat() {}
  export function clearTakomiSubagentResultHeartbeat() {}
  export function getTakomiSubagentHeartbeatFrame() { return 0; }
`);
const pinnedRenderer = await pinnedRendererUrl();
initTheme("dark", false);
try {
  const nativeRendererUrl = dataModule(`
    export { renderSubagentResult as renderNativeSubagentResult } from ${JSON.stringify(pinnedRenderer.url)};
  `);
  const rendererUrl = await transpile("native-render.ts", {
    "@earendil-works/pi-tui": tuiStubUrl,
    "./subagent-ux": uxUrl,
    "./result-heartbeat": heartbeatStubUrl,
    "./pi-subagents-internal": nativeRendererUrl,
  });
  const renderer = await import(rendererUrl);
  const theme = { fg: (_color, value) => value, bold: (value) => value };
  const context = { state: {}, invalidate() {} };

  function render(result, options, width = 60, renderContext = context) {
    return withTerminalWidth(width, () => renderer.renderTakomiSubagentResult(result, options, theme, renderContext).render(width).join("\n"));
  }
  function plain(value) {
    return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  }
  function visibleWidth(value) {
    let width = 0;
    for (const char of plain(value)) {
      if (/\p{Mark}/u.test(char) || char === "\u200d" || char === "\ufe0f") continue;
      width += /[\p{Extended_Pictographic}\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff01-\uff60]/u.test(char) ? 2 : 1;
    }
    return width;
  }
  function occurrences(text, value) {
    return text.split(value).length - 1;
  }
  function customLines(text) {
    return text.split("\n").filter((line) => /^  (?:↳|checklist|output .* fallback)/.test(line) || /^Checklist(?: provenance)?:/.test(line));
  }
  function nativeSingleHeaders(text, agent) {
    return text.split("\n").filter((line) => !/^Task:/.test(line) && new RegExp(`^\\S.*\\b${agent}\\b`).test(line));
  }
  function assertCompactBounds(output, width, label) {
    assert.ok(customLines(output).length <= 3, `${label} custom output stays within three compact lines`);
    assert.doesNotMatch(output, /Task for |"messages"|"role"|\{\s*"/, `${label} has no prompt, JSON, or message dump`);
    for (const line of output.split("\n")) assert.ok(visibleWidth(line) <= width, `${label} line fits ${width} columns: ${line}`);
  }
  function assertExpandedChecklistBounds(output, width, label) {
    assert.ok(customLines(output).length <= 2, `${label} checklist supplement stays within two expanded lines`);
    assert.match(output, /Checklist provenance:/, `${label} retains concise checklist provenance`);
    for (const line of output.split("\n")) assert.ok(visibleWidth(line) <= width, `${label} line fits ${width} columns: ${line}`);
  }

  assert.equal(asyncFixtureSource.package, "pi-subagents@0.31.0", "async fixture is pinned to the installed native schema");
  assert.deepEqual(asyncFixtureSource.sourceSchemas, [
    "src/runs/background/async-execution.ts",
    "src/runs/background/run-status.ts",
    "src/runs/background/subagent-runner.ts",
    "src/runs/background/result-watcher.ts",
  ], "async fixture records the native launch/status/completion schema sources");

  const fixtureBase = path.join(repoRoot, ".tmp", `detached-fixture-${process.pid}`);
  const nativeBase = path.join(fixtureBase, "pi-subagents");
  const materialize = (value) => JSON.parse(JSON.stringify(value).replaceAll("C:/tmp/pi-subagents", nativeBase.replaceAll("\\", "/")));
  const asyncFixture = materialize(asyncFixtureSource);
  const workspace = path.join(nativeBase, "workspace");
  const sessionsDir = path.join(nativeBase, "sessions");
  const asyncRoot = path.join(nativeBase, "async-subagent-runs");
  const resultRoot = path.join(nativeBase, "async-subagent-results");
  const artifactRoot = path.join(nativeBase, "artifacts");
  const conversationRoot = path.join(workspace, ".pi", "takomi", "subagent-conversations");
  await Promise.all([workspace, sessionsDir, asyncRoot, resultRoot, artifactRoot, conversationRoot].map((dir) => fs.mkdir(dir, { recursive: true })));
  await fs.writeFile(path.join(sessionsDir, "parent.jsonl"), "");
  await fs.mkdir(asyncFixture.launch.details.asyncDir, { recursive: true });

  const persistedEntries = [];
  const sessionManager = {
    getSessionId: () => "pi-parent-session-id",
    getSessionFile: () => path.join(sessionsDir, "parent.jsonl"),
    getHeader: () => ({ parentSession: path.join(sessionsDir, "lineage-parent.jsonl") }),
    getEntries: () => persistedEntries,
    getBranch: () => persistedEntries,
  };
  const detachedPi = {
    appendEntry(customType, data) { persistedEntries.push({ type: "custom", customType, data }); },
  };
  const detachedContext = { cwd: workspace, sessionManager };
  const roots = { ASYNC_DIR: asyncRoot, RESULTS_DIR: resultRoot, TEMP_ARTIFACTS_DIR: artifactRoot };
  detachedInternals.setDetachedRoots(roots);
  const childSessionRoot = path.join(sessionsDir, "parent");
  const validChildSession = path.join(childSessionRoot, "reviewer.jsonl");
  await fs.mkdir(childSessionRoot, { recursive: true });
  await fs.writeFile(validChildSession, "");
  asyncFixture.completion.sessionFile = validChildSession;
  asyncFixture.completion.results[0].sessionFile = validChildSession;

  // Execute the pinned native result watcher against the fixture so schema drift
  // is caught at the emitter/adapter boundary, not only by static fixture labels.
  const watcherModule = await import(pathToFileURL(path.join(pinnedRenderer.fixtureRoot, "src", "runs", "background", "result-watcher.js")).href);
  const emittedNative = [];
  const watcherState = {
    currentSessionId: asyncFixture.completion.sessionId,
    baseCwd: workspace,
    completionSeen: new Map(),
    watcher: null,
    watcherRestartTimer: null,
  };
  const nativeWatcher = watcherModule.createResultWatcher({
    events: { emit(channel, payload) { emittedNative.push({ channel, payload }); } },
  }, watcherState, resultRoot, 10 * 60 * 1000);
  const watcherPayload = structuredClone(asyncFixture.completion);
  watcherPayload.id = watcherPayload.runId = "native-emitter-adapter";
  watcherPayload.asyncDir = path.join(asyncRoot, "native-emitter-adapter");
  await fs.writeFile(path.join(resultRoot, "native-emitter-adapter.json"), JSON.stringify(watcherPayload));
  nativeWatcher.primeExistingResults();
  for (let attempt = 0; attempt < 20 && emittedNative.length === 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  nativeWatcher.stopResultWatcher();
  assert.equal(emittedNative.length, 1, "pinned native result watcher emits the executable fixture once");
  assert.equal(emittedNative[0].channel, "subagent:async-complete", "adapter listens to the native completion event channel");
  assert.equal(emittedNative[0].payload.runId, "native-emitter-adapter", "adapter fixture preserves native run identity");
  assert.ok(Array.isArray(emittedNative[0].payload.results), "adapter fixture preserves native result children schema");

  const detachedTasks = ux.createTakomiUxTasks([{
    agent: "reviewer",
    task: "Review the detached implementation.",
    checklist: ["Trace schema", "Add tests"],
  }]);
  await detached.initializeDetachedSession(detachedPi, detachedContext);
  await detached.rememberDetachedLaunch(detachedPi, asyncFixture.launch, detachedTasks, detachedContext, workspace);
  assert.equal(persistedEntries.length, 1, "detached launch lookup is persisted in a bounded Takomi custom entry");
  assert.deepEqual(persistedEntries[0].data, { version: 2, id: "async-review-007" }, "persisted launch data contains no asserted roots, tasks, or checklist state");
  const runningStatus = await detached.resolveDetachedStatusResult(detachedPi, { action: "status", id: "async-review" }, asyncFixture.runningStatus);
  assert.equal(runningStatus.details.takomiDetachedHydration.state, "missing", "running status truthfully reports that no completion result exists yet");

  assert.equal(await detached.captureDetachedCompletion(detachedPi, asyncFixture.completion), true, "exact workspace/session/run completion is captured");
  const completedStatus = await detached.resolveDetachedStatusResult(
    detachedPi,
    { action: "status", id: "async-review" },
    asyncFixture.completedStatus,
  );
  assert.equal(completedStatus.details.mode, "single", "completed status restores the native single-result mode");
  assert.equal(completedStatus.details.results[0].finalOutput, asyncFixture.completion.results[0].output, "unchanged native Markdown output resolves to finalOutput");
  assert.equal(completedStatus.details.results[0].acceptance.status, "rejected", "rejected acceptance is retained beside final output");
  assert.equal(completedStatus.details.results[0].sessionFile, validChildSession, "child session file is retained only inside the current native session root");
  assert.equal(completedStatus.details.results[0].takomiDetachedSession.state, "complete", "valid child session provenance is explicit");
  assert.equal(completedStatus.details.takomiUx.tasks[0].checklist[0].id, "task-1-item-1", "current-process detached checklist provenance survives completion");
  assert.equal(completedStatus.details.takomiDetached.checklistProvenance, "trusted-launch", "current-process launch state is the only trusted checklist source");

  for (const width of [40, 60]) {
    const launch = render(asyncFixture.launch, { expanded: false }, width);
    assert.match(launch, /async run is detached/i, `detached launch keeps native no-poll guidance at ${width}`);
    assert.doesNotMatch(launch, /Review completed|checklist \d/, `detached launch does not invent completion detail at ${width}`);
    for (const line of launch.split("\n")) assert.ok(visibleWidth(line) <= width, `detached launch line fits ${width} columns: ${line}`);

    const completed = render(completedStatus, { expanded: false }, width);
    assert.match(completed, /Review completed/, `completed detached status shows the useful final answer at ${width}`);
    assert.equal(occurrences(completed, "Review completed"), 1, `completed detached status shows the final-answer opening exactly once at ${width}`);
    assert.match(completed, /checklist 1\/2 complete/, `completed detached status shows the correct 1/2 checklist state at ${width}`);
    assert.equal(occurrences(completed, "checklist 1/2 complete"), 1, `completed detached status shows one checklist summary at ${width}`);
    assert.match(completed, /rejected/i, `rejected acceptance does not suppress output at ${width}`);
    assertCompactBounds(completed, width, `completed detached status at ${width}`);

    // Render the fixture's native Markdown unchanged, including both checkbox lines.
    const expandedDetached = render(completedStatus, { expanded: true }, width);
    assert.match(expandedDetached, /Review completed/, `expanded detached status preserves native final output at ${width}`);
    assert.match(plain(expandedDetached), /\[x\] Trace schema/, `expanded detached status renders the unchanged checked fixture at ${width}`);
    assert.match(plain(expandedDetached), /\[ \] Add tests/, `expanded detached status renders the unchanged unchecked fixture at ${width}`);
    assert.equal(occurrences(plain(expandedDetached), "[x] Trace schema"), 1, `expanded detached checked item occurs exactly once at ${width}`);
    assert.equal(occurrences(plain(expandedDetached), "[ ] Add tests"), 1, `expanded detached unchecked item occurs exactly once at ${width}`);
    assert.match(expandedDetached, /Task: Review the detached/, `expanded detached status preserves native task detail at ${width}`);
    assert.match(expandedDetached, /Artifacts:/, `expanded detached status preserves native artifact detail at ${width}`);
    assertExpandedChecklistBounds(expandedDetached, width, `completed detached status expanded at ${width}`);
  }

  // A new extension object restores only this exact workspace/session lineage.
  const restoredPi = { appendEntry() {} };
  await detached.initializeDetachedSession(restoredPi, detachedContext);
  assert.equal(await detached.captureDetachedCompletion(restoredPi, asyncFixture.completion), true, "process/session restoration rehydrates matching launch provenance");
  const wrongWorkspace = structuredClone(asyncFixture.completion);
  wrongWorkspace.cwd = path.join(nativeBase, "other-workspace");
  await fs.mkdir(wrongWorkspace.cwd, { recursive: true });
  assert.equal(await detached.captureDetachedCompletion(restoredPi, wrongWorkspace), false, "wrong workspace completion cannot hydrate");
  const wrongSession = structuredClone(asyncFixture.completion);
  wrongSession.sessionId = "wrong-session";
  assert.equal(await detached.captureDetachedCompletion(restoredPi, wrongSession), false, "wrong Pi session identity cannot hydrate");
  const wrongRun = structuredClone(asyncFixture.completion);
  wrongRun.id = wrongRun.runId = "unknown-run";
  assert.equal(await detached.captureDetachedCompletion(restoredPi, wrongRun), false, "unknown run id cannot hydrate");
  const conflictingRun = structuredClone(asyncFixture.completion);
  conflictingRun.id = "async-review-other";
  assert.equal(await detached.captureDetachedCompletion(restoredPi, conflictingRun), false, "conflicting payload ids cannot hydrate");

  persistedEntries.push({
    type: "custom",
    customType: "takomi-detached-launch",
    data: {
      version: 2,
      id: "async-review-007",
      asyncRoot: path.join(fixtureBase, "attacker-root"),
      tasks: [{ checklist: [{ text: "Forged complete", done: true }] }],
    },
  });
  delete globalThis.__takomi_detached_trusted_launches__;
  const restartedPi = { appendEntry() {} };
  await detached.initializeDetachedSession(restartedPi, detachedContext);
  assert.equal(await detached.captureDetachedCompletion(restartedPi, asyncFixture.completion), true, "restart derives current roots and exact run identity instead of trusting persisted root claims");
  const restartedStatus = await detached.resolveDetachedStatusResult(restartedPi, { action: "status", id: "async-review-007" }, asyncFixture.completedStatus);
  assert.equal(restartedStatus.details.takomiUx.tasks.length, 0, "restart does not restore persisted task or checklist self-claims");
  assert.equal(restartedStatus.details.takomiDetached.checklistProvenance, "unavailable-after-restart", "restart fails closed with explicit unavailable checklist provenance");
  const restartedCompact = render(restartedStatus, { expanded: false }, 60);
  assert.match(restartedCompact, /checklist provenance unavailable/i, "restart visibly labels unavailable checklist provenance");
  assert.doesNotMatch(restartedCompact, /Forged complete/, "persisted checklist tampering never reaches rendering");

  async function rememberRun(id) {
    const asyncDir = path.join(asyncRoot, id);
    await fs.mkdir(asyncDir, { recursive: true });
    const launch = structuredClone(asyncFixture.launch);
    launch.details.asyncId = launch.details.runId = id;
    launch.details.asyncDir = asyncDir;
    await detached.rememberDetachedLaunch(restoredPi, launch, detachedTasks, detachedContext, workspace);
    return launch;
  }
  await rememberRun("async-review-008");
  const ambiguous = await detached.resolveDetachedStatusResult(restoredPi, { action: "status", id: "async-review-00" }, asyncFixture.completedStatus);
  assert.equal(ambiguous.details.takomiDetachedHydration.state, "rejected", "prefix-ambiguous status ids cannot hydrate");
  const traversalStatus = structuredClone(asyncFixture.completedStatus);
  traversalStatus.content[0].text = `Run: async-review-008\nState: complete\nDir: ${path.join(asyncRoot, "async-review-008")}\nResult: ${path.join(resultRoot, "..", "escape.json")}`;
  const traversal = await detached.resolveDetachedStatusResult(restoredPi, { action: "status", id: "async-review-008" }, traversalStatus);
  assert.equal(traversal.details.takomiDetachedHydration.state, "rejected", "result traversal is rejected before reading");

  async function fallbackStatus(id, outputPath, bytes) {
    await rememberRun(id);
    if (bytes !== undefined) await fs.writeFile(outputPath, bytes);
    const payload = structuredClone(asyncFixture.completion);
    payload.id = payload.runId = id;
    payload.asyncDir = path.join(asyncRoot, id);
    payload.success = true;
    payload.state = "complete";
    payload.results[0].success = true;
    payload.results[0].output = "";
    payload.results[0].artifactPaths.outputPath = outputPath;
    payload.summary = `Summary fallback for ${id}.\n- [x] Trace schema\n- [ ] Add tests`;
    assert.equal(await detached.captureDetachedCompletion(restoredPi, payload), true, `${id} payload identity is valid`);
    const nativeStatus = { content: [{ type: "text", text: `Run: ${id}\nState: complete\nDir: ${path.join(asyncRoot, id)}` }], details: { mode: "single", results: [] } };
    return detached.resolveDetachedStatusResult(restoredPi, { action: "status", id }, nativeStatus);
  }

  const missingPath = path.join(artifactRoot, "missing-output.md");
  const missingArtifact = await fallbackStatus("async-missing-artifact", missingPath);
  assert.equal(missingArtifact.details.results[0].takomiDetachedOutput.fallbackState, "missing", "missing artifact retains explicit fallback error state");
  assert.equal(missingArtifact.details.results[0].takomiDetachedOutput.source, "summary", "missing artifact is truthfully labeled as summary fallback");
  const oversizedPath = path.join(artifactRoot, "oversized-output.md");
  const oversizedArtifact = await fallbackStatus("async-oversized-artifact", oversizedPath, "x".repeat(70 * 1024));
  assert.equal(oversizedArtifact.details.results[0].takomiDetachedOutput.fallbackState, "truncated", "oversized artifact is bounded and labeled truncated");
  assert.ok(oversizedArtifact.details.results[0].finalOutput.length <= 64 * 1024, "oversized artifact read is byte-bounded");
  const utf8BoundaryPath = path.join(artifactRoot, "utf8-boundary-output.md");
  const utf8BoundaryArtifact = await fallbackStatus("async-utf8-boundary", utf8BoundaryPath, `${"a".repeat(64 * 1024 - 1)}€tail`);
  assert.equal(utf8BoundaryArtifact.details.results[0].takomiDetachedOutput.fallbackState, "truncated", "multibyte boundary truncation remains truncated rather than corrupt");
  assert.equal(utf8BoundaryArtifact.details.results[0].finalOutput, "a".repeat(64 * 1024 - 1), "UTF-8 truncation drops only the incomplete trailing scalar");
  const corruptPath = path.join(artifactRoot, "corrupt-output.md");
  const corruptArtifact = await fallbackStatus("async-corrupt-artifact", corruptPath, Buffer.from([0xc3, 0x28]));
  assert.equal(corruptArtifact.details.results[0].takomiDetachedOutput.fallbackState, "corrupt", "invalid UTF-8 artifact is labeled corrupt");
  const ioPath = path.join(artifactRoot, "directory-not-file");
  await fs.mkdir(ioPath);
  const ioArtifact = await fallbackStatus("async-io-artifact", ioPath);
  assert.equal(ioArtifact.details.results[0].takomiDetachedOutput.fallbackState, "io", "non-file artifact failures are classified as I/O");
  assert.equal(detached.classifyPathError(Object.assign(new Error("denied"), { code: "EACCES" })), "permission", "permission errors have a distinct provenance classification");
  const outsidePath = path.join(fixtureBase, "outside-output.md");
  await fs.writeFile(outsidePath, "outside");
  const escapedArtifact = await fallbackStatus("async-traversal-artifact", outsidePath);
  assert.equal(escapedArtifact.details.results[0].takomiDetachedOutput.fallbackState, "rejected", "artifact traversal is rejected");
  const symlinkPath = path.join(artifactRoot, "escaped-link.md");
  try {
    await fs.symlink(outsidePath, symlinkPath, "file");
    const symlinkArtifact = await fallbackStatus("async-symlink-artifact", symlinkPath);
    assert.equal(symlinkArtifact.details.results[0].takomiDetachedOutput.fallbackState, "rejected", "artifact symlink escape is rejected");
  } catch (error) {
    if (!["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) throw error;
    assert.ok(true, `symlink creation unavailable on this host (${error.code}); traversal confinement remains covered`);
  }

  async function sessionPathStatus(id, sessionFile) {
    await rememberRun(id);
    const payload = structuredClone(asyncFixture.completion);
    payload.id = payload.runId = id;
    payload.asyncDir = path.join(asyncRoot, id);
    payload.results[0].sessionFile = sessionFile;
    payload.sessionFile = sessionFile;
    assert.equal(await detached.captureDetachedCompletion(restoredPi, payload), true, `${id} completion is otherwise valid`);
    return detached.resolveDetachedStatusResult(restoredPi, { action: "status", id }, {
      content: [{ type: "text", text: `Run: ${id}\nState: complete\nDir: ${path.join(asyncRoot, id)}` }],
      details: { mode: "single", results: [] },
    });
  }
  const validConversationSession = path.join(conversationRoot, "review-cycle", "conversation.jsonl");
  await fs.mkdir(path.dirname(validConversationSession), { recursive: true });
  await fs.writeFile(validConversationSession, "");
  const acceptedConversation = await sessionPathStatus("async-conversation-session", validConversationSession);
  assert.equal(acceptedConversation.details.results[0].sessionFile, validConversationSession, "conversationId session under the canonical current-workspace root is accepted");
  assert.equal(acceptedConversation.details.results[0].takomiDetachedSession.state, "complete", "accepted conversationId session provenance is explicit");

  const escapedSession = await sessionPathStatus("async-session-escape", outsidePath);
  assert.equal(escapedSession.details.results[0].sessionFile, undefined, "child session path outside the approved session roots is omitted");
  assert.equal(escapedSession.details.results[0].takomiDetachedSession.state, "rejected", "child session path escape is explicitly rejected");
  const conversationTraversal = path.join(conversationRoot, "..", "escaped-conversation.jsonl");
  await fs.writeFile(conversationTraversal, "");
  const traversedConversation = await sessionPathStatus("async-conversation-traversal", conversationTraversal);
  assert.equal(traversedConversation.details.results[0].sessionPath, undefined, "conversationId traversal outside its independently approved root is omitted");
  assert.equal(traversedConversation.details.results[0].takomiDetachedSession.state, "rejected", "conversationId traversal is explicitly rejected");
  const otherWorkspace = path.join(nativeBase, "other-conversation-workspace");
  const otherConversation = path.join(otherWorkspace, ".pi", "takomi", "subagent-conversations", "review", "conversation.jsonl");
  await fs.mkdir(path.dirname(otherConversation), { recursive: true });
  await fs.writeFile(otherConversation, "");
  const wrongWorkspaceConversation = await sessionPathStatus("async-conversation-wrong-workspace", otherConversation);
  assert.equal(wrongWorkspaceConversation.details.results[0].sessionFile, undefined, "conversationId session from a different workspace is omitted");
  assert.equal(wrongWorkspaceConversation.details.results[0].takomiDetachedSession.state, "rejected", "conversationId roots are bound to the exact current workspace");
  const conversationSymlink = path.join(conversationRoot, "review-cycle", "escaped-conversation.jsonl");
  try {
    await fs.symlink(outsidePath, conversationSymlink, "file");
    const symlinkConversation = await sessionPathStatus("async-conversation-symlink", conversationSymlink);
    assert.equal(symlinkConversation.details.results[0].sessionPath, undefined, "symlink-escaped conversationId session is omitted");
    assert.equal(symlinkConversation.details.results[0].takomiDetachedSession.state, "rejected", "conversationId session symlink escape is rejected");
  } catch (error) {
    if (!["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) throw error;
  }
  const sessionSymlink = path.join(childSessionRoot, "escaped-session.jsonl");
  try {
    await fs.symlink(outsidePath, sessionSymlink, "file");
    const symlinkSession = await sessionPathStatus("async-session-symlink", sessionSymlink);
    assert.equal(symlinkSession.details.results[0].sessionPath, undefined, "symlink-escaped child sessionPath is omitted");
    assert.equal(symlinkSession.details.results[0].takomiDetachedSession.state, "rejected", "symlink-escaped session provenance is rejected");
  } catch (error) {
    if (!["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) throw error;
  }

  await rememberRun("async-oversized-result");
  await fs.writeFile(path.join(resultRoot, "async-oversized-result.json"), "x".repeat(1024 * 1024 + 1));
  const oversizedResult = await detached.resolveDetachedStatusResult(restoredPi, { action: "status", id: "async-oversized-result" }, {
    content: [{ type: "text", text: `Run: async-oversized-result\nState: complete\nDir: ${path.join(asyncRoot, "async-oversized-result")}\nResult: ${path.join(resultRoot, "async-oversized-result.json")}` }],
    details: { mode: "single", results: [] },
  });
  assert.equal(oversizedResult.details.takomiDetachedHydration.state, "oversized", "oversized result provenance is distinct from truncation and corruption");

  for (const width of [40, 60]) {
    const output = render(missingArtifact, { expanded: false }, width);
    assert.match(output, /Summary fallback/, `missing artifact completion remains useful at ${width}`);
    assert.match(output, /output summary fallback: missing/, `missing artifact provenance is visible at ${width}`);
    assert.match(output, /checklist 1\/2 complete/, `missing artifact checklist remains correct at ${width}`);
    assertCompactBounds(output, width, `missing artifact completion at ${width}`);
  }

  // Replace native notification registration, claim its shared dedupe key, and
  // emit one enriched native-rendered message directly from the completion event.
  let nativeUnsubscribed = 0;
  globalThis.__pi_subagents_notify_unsubscribe__ = () => { nativeUnsubscribed += 1; };
  delete globalThis.__pi_subagents_notify_seen__;
  const eventHandlers = new Set();
  const messages = [];
  const notifyPi = {
    events: {
      on(channel, handler) {
        assert.equal(channel, "subagent:async-complete");
        eventHandlers.add(handler);
        return () => eventHandlers.delete(handler);
      },
    },
    appendEntry() {},
    sendMessage(message, options) { messages.push({ message, options }); },
  };
  await detached.initializeDetachedSession(notifyPi, detachedContext);
  await detached.rememberDetachedLaunch(notifyPi, asyncFixture.launch, detachedTasks, detachedContext, workspace);
  const unregisterNotify = detached.registerDetachedCompletionNotifications(notifyPi);
  assert.equal(nativeUnsubscribed, 1, "Takomi safely replaces native notification registration instead of adding a second notice");
  await Promise.all([...eventHandlers].map((handler) => handler(asyncFixture.completion)));
  assert.equal(messages.length, 1, "completion event itself emits exactly one visible notification");
  assert.equal(messages[0].options.triggerTurn, true, "completion event delivers the useful final answer to the parent turn");
  assert.match(messages[0].message.details.resultPreview, /Review completed/, "completion notification includes final answer");
  assert.match(messages[0].message.details.resultPreview, /Checklist provenance: 1\/2/, "completion notification includes bounded checklist provenance");
  const notificationFirstLine = messages[0].message.details.resultPreview.split("\n", 1)[0];
  assert.match(notificationFirstLine, /Checklist provenance: 1\/2/, "notification first line starts with bounded checklist provenance");
  assert.match(notificationFirstLine, /Review completed\./, "notification first line includes the final-answer opening");
  assert.match(messages[0].message.details.resultPreview, /acceptance rejected/, "rejected acceptance remains visible");
  assert.equal(occurrences(messages[0].message.details.resultPreview, "Review completed."), 1, "notification contains the exact final-answer opening once");
  assert.equal(occurrences(messages[0].message.details.resultPreview, "Checklist provenance:"), 1, "notification contains exactly one checklist provenance label");
  assert.equal(occurrences(messages[0].message.details.resultPreview, "- [x] Trace schema"), 1, "notification contains the checked checklist item exactly once");
  assert.equal(occurrences(messages[0].message.details.resultPreview, "- [ ] Add tests"), 1, "notification contains the unchecked checklist item exactly once");
  await Promise.all([...eventHandlers].map((handler) => handler(asyncFixture.completion)));
  assert.equal(messages.length, 1, "shared native completion key dedupes repeated events");
  unregisterNotify();

  // Register the installed extension itself and route Takomi's sendMessage
  // through its real subagent-notify renderer. This is executable collapsed UI
  // evidence, rather than another assertion against resultPreview alone.
  delete globalThis.__pi_subagents_notify_seen__;
  const pinnedExtension = await import(pinnedRenderer.extensionUrl);
  const actualRenderers = new Map();
  const actualEventHandlers = new Map();
  const actualLifecycleHandlers = new Map();
  const actualRenderedMessages = [];
  const actualPi = {
    registerMessageRenderer(type, callback) { actualRenderers.set(type, callback); },
    registerTool() {},
    registerCommand() {},
    events: {
      on(channel, handler) {
        const handlers = actualEventHandlers.get(channel) ?? new Set();
        handlers.add(handler);
        actualEventHandlers.set(channel, handlers);
        return () => handlers.delete(handler);
      },
    },
    on(event, handler) {
      const handlers = actualLifecycleHandlers.get(event) ?? new Set();
      handlers.add(handler);
      actualLifecycleHandlers.set(event, handlers);
    },
    appendEntry() {},
    sendMessage(message, options) {
      const messageRenderer = actualRenderers.get(message.customType);
      assert.ok(messageRenderer, `native message renderer is registered for ${message.customType}`);
      const component = messageRenderer(message, { expanded: false }, theme);
      actualRenderedMessages.push({ message, options, collapsed: plain(component.render(60).join("\n")) });
    },
  };
  const inheritedChildFlag = process.env.PI_SUBAGENT_CHILD;
  delete process.env.PI_SUBAGENT_CHILD;
  try {
    pinnedExtension.default(actualPi);
  } finally {
    if (inheritedChildFlag === undefined) delete process.env.PI_SUBAGENT_CHILD;
    else process.env.PI_SUBAGENT_CHILD = inheritedChildFlag;
  }
  assert.ok(actualRenderers.has("subagent-notify"), "pinned extension registers its actual subagent-notify renderer");
  await detached.initializeDetachedSession(actualPi, detachedContext);
  await detached.rememberDetachedLaunch(actualPi, asyncFixture.launch, detachedTasks, detachedContext, workspace);
  const unregisterActualNotify = detached.registerDetachedCompletionNotifications(actualPi);
  const completeHandlers = actualEventHandlers.get("subagent:async-complete") ?? new Set();
  await Promise.all([...completeHandlers].map((handler) => handler(asyncFixture.completion)));
  assert.equal(actualRenderedMessages.length, 1, "Takomi sendMessage reaches the actual pinned notification renderer exactly once");
  const actualCollapsed = actualRenderedMessages[0].collapsed;
  assert.match(actualCollapsed, /Checklist provenance: 1\/2.*Review completed\./, "actual native collapsed notification visibly combines checklist and answer on its preview line");
  assert.equal(occurrences(actualCollapsed, "Checklist provenance:"), 1, "actual native collapsed notification visibly renders checklist provenance once");
  assert.equal(occurrences(actualCollapsed, "Review completed."), 1, "actual native collapsed notification visibly renders the answer opening once");
  unregisterActualNotify();
  for (const handler of actualLifecycleHandlers.get("session_shutdown") ?? []) handler();

  function eventHarness() {
    const handlers = new Set();
    const sent = [];
    return {
      handlers,
      sent,
      pi: {
        events: { on(_channel, handler) { handlers.add(handler); return () => handlers.delete(handler); } },
        appendEntry() {},
        sendMessage(message, options) { sent.push({ message, options }); },
      },
      async emit(payload) { await Promise.all([...handlers].map((handler) => handler(payload))); },
    };
  }
  function completionFor(id) {
    const payload = structuredClone(asyncFixture.completion);
    payload.id = payload.runId = id;
    payload.asyncDir = path.join(asyncRoot, id);
    return payload;
  }
  async function launchFor(targetPi, id) {
    const launch = structuredClone(asyncFixture.launch);
    launch.details.asyncId = launch.details.runId = id;
    launch.details.asyncDir = path.join(asyncRoot, id);
    await fs.mkdir(launch.details.asyncDir, { recursive: true });
    await detached.rememberDetachedLaunch(targetPi, launch, detachedTasks, detachedContext, workspace);
  }

  delete globalThis.__pi_subagents_notify_seen__;
  const raceHarness = eventHarness();
  await detached.initializeDetachedSession(raceHarness.pi, detachedContext);
  const unregisterRace = detached.registerDetachedCompletionNotifications(raceHarness.pi);
  const racePayload = completionFor("async-race-before-launch");
  await raceHarness.emit(racePayload);
  assert.equal(raceHarness.sent.length, 0, "valid-looking completion before launch registration is held, not displayed");
  await launchFor(raceHarness.pi, "async-race-before-launch");
  assert.equal(raceHarness.sent.length, 1, "launch registration drains the bounded pending completion exactly once");

  await launchFor(raceHarness.pi, "async-malformed-then-valid");
  const malformed = completionFor("async-malformed-then-valid");
  malformed.cwd = path.join(nativeBase, "wrong-cwd");
  await raceHarness.emit(malformed);
  assert.equal(raceHarness.sent.length, 1, "malformed completion does not emit or claim the native dedupe key");
  await raceHarness.emit(completionFor("async-malformed-then-valid"));
  assert.equal(raceHarness.sent.length, 2, "later valid completion with the same id remains deliverable exactly once");

  for (let index = 0; index < 33; index += 1) {
    await raceHarness.emit(completionFor(`async-pending-bound-${String(index).padStart(2, "0")}`));
  }
  await launchFor(raceHarness.pi, "async-pending-bound-00");
  assert.equal(raceHarness.sent.length, 2, "pending queue evicts its oldest entry at the fixed size bound");
  await launchFor(raceHarness.pi, "async-pending-bound-32");
  assert.equal(raceHarness.sent.length, 3, "pending queue retains and drains its newest bounded entry");
  await raceHarness.emit(completionFor("async-pending-expired"));
  const realDateNow = Date.now;
  Date.now = () => realDateNow() + 31_000;
  try {
    await launchFor(raceHarness.pi, "async-pending-expired");
  } finally {
    Date.now = realDateNow;
  }
  assert.equal(raceHarness.sent.length, 3, "pending queue drops entries beyond its fixed TTL");

  // Takomi-first registration survives a later native notifier registration.
  let lateNativeMessages = 0;
  let lateNativeUnsubscribed = 0;
  const previousTakomiSlot = globalThis.__pi_subagents_notify_unsubscribe__;
  previousTakomiSlot();
  const lateNativeHandler = () => { lateNativeMessages += 1; };
  const lateNativeUnsubscribe = raceHarness.pi.events.on("subagent:async-complete", lateNativeHandler);
  globalThis.__pi_subagents_notify_unsubscribe__ = () => { lateNativeUnsubscribed += 1; lateNativeUnsubscribe(); };
  await Promise.resolve();
  assert.equal(lateNativeUnsubscribed, 1, "Takomi-first registration removes a notifier registered later by native pi-subagents");
  assert.equal(raceHarness.handlers.size, 1, "the enriched global handler survives native-later registration");
  await launchFor(raceHarness.pi, "async-native-later-order");
  await raceHarness.emit(completionFor("async-native-later-order"));
  assert.equal(lateNativeMessages, 0, "native-later duplicate notifier never emits a visible message");
  assert.equal(raceHarness.sent.length, 4, "Takomi-first/native-later order still emits exactly one enriched message");

  // Reload replaces the old Takomi handler; shutdown of the stale generation is
  // idempotent and cannot remove the current global handler.
  const reloadHarness = eventHarness();
  await detached.initializeDetachedSession(reloadHarness.pi, detachedContext);
  const unregisterReload = detached.registerDetachedCompletionNotifications(reloadHarness.pi);
  assert.equal(raceHarness.handlers.size, 0, "extension reload removes the stale Takomi event handler");
  unregisterRace();
  assert.equal(reloadHarness.handlers.size, 1, "stale-generation shutdown leaves the reloaded handler alive");
  unregisterReload();
  assert.equal(reloadHarness.handlers.size, 0, "current-generation shutdown removes its handler");

  // session_start can race an already-emitted native completion while root
  // derivation is awaiting I/O. The event payload must survive even if the
  // native result file has already been removed.
  delete globalThis.__pi_subagents_notify_seen__;
  delete globalThis.__takomi_detached_trusted_launches__;
  const restoreRaceId = "async-session-start-restore-race";
  const restoreRaceAsyncDir = path.join(asyncRoot, restoreRaceId);
  const restoreRaceResultFile = path.join(resultRoot, `${restoreRaceId}.json`);
  await fs.mkdir(restoreRaceAsyncDir, { recursive: true });
  const restoreRacePayload = completionFor(restoreRaceId);
  await fs.writeFile(restoreRaceResultFile, JSON.stringify(restoreRacePayload));
  await fs.rm(restoreRaceResultFile);
  await assert.rejects(fs.access(restoreRaceResultFile), "restore race fixture has no native result file to fall back to");
  const restoreRaceEntries = [{ type: "custom", customType: "takomi-detached-launch", data: { version: 2, id: restoreRaceId } }];
  const restoreRaceContext = {
    cwd: workspace,
    sessionManager: { ...sessionManager, getEntries: () => restoreRaceEntries, getBranch: () => restoreRaceEntries },
  };
  const restoreRaceHarness = eventHarness();
  const unregisterRestoreRace = detached.registerDetachedCompletionNotifications(restoreRaceHarness.pi);
  const releaseRestore = detachedInternals.deferDetachedRoots();
  const restoring = detached.initializeDetachedSession(restoreRaceHarness.pi, restoreRaceContext);
  await restoreRaceHarness.emit(restoreRacePayload);
  assert.equal(restoreRaceHarness.sent.length, 0, "completion arriving during async session_start restore remains pending");
  releaseRestore();
  await restoring;
  assert.equal(restoreRaceHarness.sent.length, 1, "restored launch flushes its matching pending completion exactly once");
  assert.match(restoreRaceHarness.sent[0].message.details.resultPreview.split("\n", 1)[0], /Checklist unavailable after restart.*Review completed\./, "restored completion visibly combines unavailable provenance and answer opening");
  await restoreRaceHarness.emit(restoreRacePayload);
  assert.equal(restoreRaceHarness.sent.length, 1, "restored completion remains globally deduped after pending flush");
  unregisterRestoreRace();

  detached.clearDetachedResults(restoredPi);
  const cleaned = await detached.resolveDetachedStatusResult(restoredPi, { action: "status", id: "async-review-007" }, asyncFixture.completedStatus);
  assert.equal(cleaned.details.takomiDetachedHydration.state, "rejected", "session cleanup removes detached launch/completion state");
  await fs.rm(fixtureBase, { recursive: true, force: true });

  const tasks = ux.createTakomiUxTasks([{
    agent: "coder",
    task: "Implement compact UX.",
    checklist: ["Trace schema", "Add tests", "Duplicate", "Duplicate", "Case Exact"],
  }]);
  assert.deepEqual(tasks[0].checklist.map(({ id, index, stateSource }) => ({ id, index, stateSource })), [
    { id: "task-1-item-1", index: 0, stateSource: "input" },
    { id: "task-1-item-2", index: 1, stateSource: "input" },
    { id: "task-1-item-3", index: 2, stateSource: "input" },
    { id: "task-1-item-4", index: 3, stateSource: "input" },
    { id: "task-1-item-5", index: 4, stateSource: "input" },
  ], "checklist IDs and indexes remain stable");

  const resolved = ux.resolvedChecklist(tasks[0].checklist, [
    "- [x] trace schema\n- [x] Add tests.\n- [x] Duplicate\n- [x] Case Exact\n- [ ] Case Exact",
    "- [x] Trace schema\n- [x] Add tests",
  ]);
  assert.equal(resolved[0].done, true, "an exact unique report updates its unique item");
  assert.equal(resolved[0].stateSource, "agent-reported", "self-report is explicitly attributed");
  assert.equal(resolved[1].done, true, "later exact punctuation-preserving match updates");
  assert.equal(resolved[2].done, false, "duplicate source labels are rejected as collisions");
  assert.equal(resolved[3].done, false, "all duplicate source labels remain unchanged");
  assert.equal(resolved[4].done, false, "duplicate reports in one message are rejected");

  const malicious = "safe\u001b[31mRED\u001b[0m\u001b]8;;https://evil.example\u0007LINK\u001b]8;;\u0007\u0000 end";
  assert.equal(ux.sanitizeUntrustedText(malicious), "safeREDLINK end", "terminal controls are removed");
  const wide = ux.boundNarrative(`界🙂é ${"界".repeat(100)}`, { maxLines: 1, maxColumns: 20 });
  assert.ok(visibleWidth(wide.lines[0]) <= 20, "wide Unicode clipping respects visible columns");

  function makeRow(agent, status, finalText) {
    return {
      agent,
      task: `Task for ${agent}: this deliberately long prompt must not appear in compact output.`,
      exitCode: status === "completed" ? 0 : -1,
      progress: { status, toolCount: 2, tokens: 321, durationMs: 50 },
      usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 1 },
      messages: [{ role: "assistant", content: [{ type: "text", text: `Working on ${agent} with a deliberately long narrative update for dynamic width.\nShared progress line.\n- [x] Trace schema` }] }],
      finalOutput: finalText,
    };
  }
  function detailsFor(mode, rows, taskInputs) {
    return ux.withTakomiUxDetails({ mode, results: rows }, ux.createTakomiUxTasks(taskInputs));
  }

  const singleCompletedRow = makeRow("coder", "completed", "Native preview line.\nSecond final detail.\nThird final detail.");
  const singleCompletedDetails = detailsFor("single", [singleCompletedRow], [{ agent: "coder", task: singleCompletedRow.task, checklist: ["Trace schema", "Add tests"] }]);
  for (const width of [40, 60]) {
    const completed = render({ content: [{ type: "text", text: "done" }], details: singleCompletedDetails }, { expanded: false }, width);
    assert.equal(occurrences(completed, "Native preview line."), 1, `single completed native preview is not repeated at ${width}`);
    assert.equal(nativeSingleHeaders(completed, "coder").length, 1, `single completed has one native agent header at ${width}`);
    assert.match(completed, /↳ Second final detail\./, `single completed appends subordinate final detail at ${width}`);
    assertCompactBounds(completed, width, `single completed at ${width}`);
    assertExpandedChecklistBounds(
      render({ content: [{ type: "text", text: "done" }], details: singleCompletedDetails }, { expanded: true }, width),
      width,
      `single completed expanded at ${width}`,
    );
  }

  const singleActiveRow = makeRow("coder", "running", "");
  const singleActiveDetails = detailsFor("single", [singleActiveRow], [{ agent: "coder", task: singleActiveRow.task, checklist: ["Trace schema"] }]);
  for (const width of [40, 60]) {
    const active = render({ content: [{ type: "text", text: "active" }], details: singleActiveDetails }, { expanded: false, isPartial: true }, width);
    assert.equal(nativeSingleHeaders(active, "coder").length, 1, `single active has one native agent header at ${width}`);
    assert.equal(occurrences(active, "Shared progress line."), 1, `single active repeated narrative is deduped at ${width}`);
    assertCompactBounds(active, width, `single active at ${width}`);
    assertExpandedChecklistBounds(
      render({ content: [{ type: "text", text: "active" }], details: singleActiveDetails }, { expanded: true, isPartial: true }, width),
      width,
      `single active expanded at ${width}`,
    );
  }

  const fourRows = ["architect", "coder", "reviewer", "tester"].map((agent) => makeRow(agent, "completed", `Final ${agent}.\nShared final detail.`));
  const fourTasks = fourRows.map((row) => ({ agent: row.agent, task: row.task, checklist: ["Trace schema", "Add tests"] }));
  for (const mode of ["parallel", "chain"]) {
    for (const partial of [true, false]) {
      const rows = partial ? fourRows.map((row) => ({ ...row, exitCode: -1, progress: { ...row.progress, status: "running" } })) : fourRows;
      const details = detailsFor(mode, rows, fourTasks);
      for (const width of [40, 60]) {
        const label = `${mode} ${partial ? "active" : "completed"} at ${width}`;
        const output = render({ content: [{ type: "text", text: "state" }], details }, { expanded: false, isPartial: partial }, width);
        for (const agent of ["architect", "coder", "reviewer", "tester"]) {
          assert.equal(output.split("\n").filter((line) => new RegExp(`:\\s*${agent}\\b`).test(line)).length, 1, `${label} keeps one native row for ${agent}`);
        }
        assert.equal(occurrences(output, partial ? "Shared progress line." : "Shared final detail."), 1, `${label} dedupes repeated narrative`);
        assertCompactBounds(output, width, label);
        assertExpandedChecklistBounds(
          render({ content: [{ type: "text", text: "state" }], details }, { expanded: true, isPartial: partial }, width),
          width,
          `${label} expanded`,
        );
      }
    }
  }

  const expanded = render({ content: [{ type: "text", text: "done" }], details: singleCompletedDetails }, { expanded: true }, 60);
  assert.doesNotMatch(expanded, /Takomi additions|All explicit assistant narrative|Assistant message \d/, "expanded removes Takomi debug/replay labels");
  assert.equal(nativeSingleHeaders(expanded, "coder").length, 1, "expanded does not duplicate the native agent header");
  assert.equal(occurrences(expanded, "Native preview line."), 1, "expanded final answer is rendered only by native pi-subagents");
  assert.ok(customLines(expanded).length <= 2, "expanded checklist supplement stays within two lines");
  assert.match(expanded, /Checklist provenance:/, "expanded adds concise checklist provenance native lacks");
  assert.doesNotMatch(expanded, /not verified truth|agent-reported self-report/, "expanded avoids verbose provenance walls");

  const errorLifecycle = render(
    { content: [{ type: "text", text: "result error" }], details: { mode: "single", results: [] }, isError: true },
    { expanded: false },
    60,
    { ...context, isError: true },
  );
  assert.match(errorLifecycle, /takomi_subagent failed/, "result/context errors remain visibly failed");

  console.log("✓ pinned pi-subagents@0.31.0 native-first active/completed single, parallel, and chain visual coverage passed at 40/60 columns");
} finally {
  await fs.rm(pinnedRenderer.fixtureRoot, { recursive: true, force: true });
}
