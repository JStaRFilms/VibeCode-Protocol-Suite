#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
    return { url: pathToFileURL(path.join(fixtureRoot, "src", "tui", "render.js")).href, fixtureRoot };
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
const heartbeatStubUrl = dataModule(`
  export function ensureTakomiSubagentResultHeartbeat() {}
  export function clearTakomiSubagentResultHeartbeat() {}
  export function getTakomiSubagentHeartbeatFrame() { return 0; }
`);
const pinnedRenderer = await pinnedRendererUrl();
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
  function visibleWidth(value) {
    let width = 0;
    for (const char of value) {
      if (/\p{Mark}/u.test(char) || char === "\u200d" || char === "\ufe0f") continue;
      width += /[\p{Extended_Pictographic}\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff01-\uff60]/u.test(char) ? 2 : 1;
    }
    return width;
  }
  function occurrences(text, value) {
    return text.split(value).length - 1;
  }
  function customLines(text) {
    return text.split("\n").filter((line) => /^  (?:↳|checklist)/.test(line) || /^Checklist:/.test(line));
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
    assert.match(output, /Checklist:/, `${label} retains concise checklist information`);
    for (const line of output.split("\n")) assert.ok(visibleWidth(line) <= width, `${label} line fits ${width} columns: ${line}`);
  }

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
  assert.match(expanded, /Checklist:/, "expanded adds concise checklist information native lacks");
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
