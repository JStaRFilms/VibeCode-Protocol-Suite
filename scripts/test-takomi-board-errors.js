#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(repoRoot, ".pi", "extensions", "takomi-runtime", "index.ts");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-board-error-test-"));
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-board-workspace-"));
const outDir = path.join(repoRoot, ".tmp", `board-errors-${process.pid}`);
const tsconfigPath = path.join(tempRoot, "tsconfig.json");

function resultText(result) {
  return result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
}

async function addLocalImportExtensions(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await addLocalImportExtensions(filePath);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;

    const source = await fs.readFile(filePath, "utf8");
    const matches = [...source.matchAll(/(from\s+["']|import\(["'])(\.[^"']+)(["'])/g)];
    let rewritten = source;
    for (const match of matches) {
      const [, prefix, specifier, suffix] = match;
      if (specifier.endsWith(".js")) continue;
      const absolute = path.resolve(path.dirname(filePath), specifier);
      let replacement;
      const fileCandidate = `${absolute}.js`;
      const indexCandidate = path.join(absolute, "index.js");
      if (await fs.stat(fileCandidate).then(() => true).catch(() => false)) replacement = `${specifier}.js`;
      else if (await fs.stat(indexCandidate).then(() => true).catch(() => false)) replacement = `${specifier}/index.js`;
      if (replacement) rewritten = rewritten.replace(`${prefix}${specifier}${suffix}`, `${prefix}${replacement}${suffix}`);
    }
    if (rewritten !== source) await fs.writeFile(filePath, rewritten, "utf8");
  }
}

try {
  await fs.writeFile(tsconfigPath, JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      skipLibCheck: true,
      noEmit: false,
      rootDir: repoRoot,
      outDir,
    },
    files: [sourceFile],
  }, null, 2));
  execFileSync(process.execPath, [path.join(repoRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfigPath], { cwd: repoRoot, stdio: "inherit" });
  await addLocalImportExtensions(outDir);
  await fs.copyFile(
    path.join(repoRoot, ".pi", "extensions", "takomi-runtime", "takomi-stats.js"),
    path.join(outDir, ".pi", "extensions", "takomi-runtime", "takomi-stats.js"),
  );

  const registeredTools = new Map();
  const pi = {
    events: { on() {} },
    appendEntry() {},
    on() {},
    registerCommand() {},
    registerShortcut() {},
    registerTool(tool) { registeredTools.set(tool.name, tool); },
  };
  const { default: registerRuntime } = await import(pathToFileURL(path.join(outDir, ".pi", "extensions", "takomi-runtime", "index.js")).href);
  const codingAgent = await import("@earendil-works/pi-coding-agent");
  const tui = await import("@earendil-works/pi-tui");
  codingAgent.initTheme();
  tui.setKeybindings(new tui.KeybindingsManager({
    ...tui.TUI_KEYBINDINGS,
    "app.tools.expand": { defaultKeys: "ctrl+o", description: "Toggle tool output" },
  }));
  registerRuntime(pi);
  const board = registeredTools.get("takomi_board");
  assert.ok(board, "runtime registers takomi_board");

  const notifications = [];
  const ctx = {
    cwd: workspace,
    hasUI: false,
    ui: { notify(message, level) { notifications.push({ message, level }); } },
  };
  const execute = (params) => board.execute("test", params, undefined, undefined, ctx);
  const sessionId = "orch-20260712-114201";
  await execute({
    action: "init_session",
    sessionId,
    title: "Semantic error test",
    tasks: [{ id: "BLD-002", title: "Guard completion", role: "code", stage: "build", checklist: ["Run tests"] }],
  });

  const paths = {
    masterPlan: path.join(workspace, "docs", "tasks", "orchestrator-sessions", sessionId, "master_plan.md"),
  };
  const authoredPlan = "# Human Master Plan\n\nThis detailed plan is canonical.\n\n## Architecture\n\n- Preserve this exact prose.\n";
  await fs.writeFile(paths.masterPlan, authoredPlan, "utf8");
  const expansion = await execute({
    action: "expand_stage",
    sessionId,
    stage: "build",
    masterPlanMarkdown: "short replacement",
    tasks: [{ id: "BLD-003", title: "Implement safely", role: "coder", checklist: ["Verify"], expectedArtifacts: ["code"] }],
  });
  assert.equal(await fs.readFile(paths.masterPlan, "utf8"), authoredPlan, "stage expansion preserves a human-authored master plan byte-for-byte");
  assert.equal(expansion.details.masterPlanDisposition, "preserved", "stage expansion reports preservation disposition");
  assert.match(resultText(expansion), /WARNING: Preserved/, "stage expansion visibly warns when incoming content is rejected");

  await execute({ action: "update_task", sessionId, taskId: "BLD-003", status: "in-progress" });
  assert.equal(await fs.readFile(paths.masterPlan, "utf8"), authoredPlan, "task status changes cannot alter the authored master plan");

  const currentHash = (await import("node:crypto")).createHash("sha256").update(authoredPlan).digest("hex");
  const hashFailure = await execute({
    action: "replace_master_plan",
    sessionId,
    confirmReplaceMasterPlan: true,
    expectedCurrentSha256: "0".repeat(64),
    masterPlanMarkdown: "replacement",
  });
  assert.equal(hashFailure.details.error.code, "master-plan-hash-mismatch", "destructive replacement fails closed on hash mismatch");
  assert.equal(await fs.readFile(paths.masterPlan, "utf8"), authoredPlan, "hash mismatch leaves the plan untouched");

  const replacement = "# Intentionally Replaced\n";
  const replaced = await execute({
    action: "replace_master_plan",
    sessionId,
    confirmReplaceMasterPlan: true,
    expectedCurrentSha256: currentHash,
    masterPlanMarkdown: replacement,
  });
  assert.equal(await fs.readFile(paths.masterPlan, "utf8"), replacement, "confirmed matching-hash replacement succeeds with exact bytes");
  assert.equal(replaced.details.masterPlanDisposition, "written", "explicit replacement reports written disposition");

  const cases = [
    {
      name: "missing session identifier",
      args: { action: "show_session" },
      code: "missing-session-id",
      severity: "warning",
      text: "sessionId is required for show_session",
    },
    {
      name: "missing update identifiers",
      args: { action: "update_task" },
      code: "missing-task-context",
      severity: "warning",
      text: "sessionId and taskId are required for update_task",
    },
    {
      name: "unknown task",
      args: { action: "update_task", sessionId, taskId: "UNKNOWN" },
      code: "task-not-found",
      severity: "error",
      text: `Task UNKNOWN not found in session ${sessionId}`,
    },
    {
      name: "incomplete completion gate",
      args: { action: "update_task", sessionId, taskId: "BLD-002", status: "completed" },
      code: "completion-gate",
      severity: "warning",
      text: "Task BLD-002 cannot be marked completed until every checklist item is done.",
    },
    {
      name: "hidden upstream persona",
      args: {
        action: "init_session",
        sessionId: "orch-20260712-114202",
        title: "Reject Oracle",
        tasks: [{ title: "Write architecture", role: "architect", preferredAgent: "oracle", expectedArtifacts: ["architecture.md"] }],
      },
      code: "invalid-task-routing",
      severity: "error",
      text: "hidden or unknown agent 'oracle'",
    },
    {
      name: "write capability mismatch",
      args: {
        action: "init_session",
        sessionId: "orch-20260712-114203",
        title: "Reject read-only writer",
        tasks: [{ title: "Write audit", role: "reviewer", expectedArtifacts: ["audit.md"] }],
      },
      code: "invalid-task-routing",
      severity: "error",
      text: "requires writable artifacts",
    },
    {
      name: "existing session initialization",
      args: { action: "init_session", sessionId, title: "Duplicate" },
      code: "session-already-exists",
      severity: "warning",
      text: `Session ${sessionId} already exists`,
    },
    {
      name: "invalid expansion",
      args: { action: "expand_stage", sessionId },
      code: "invalid-expansion",
      severity: "warning",
      text: "sessionId, stage, and at least one task are required for expand_stage",
    },
  ];

  const theme = { fg: (_color, value) => value, bold: (value) => value };
  for (const testCase of cases) {
    const result = await execute(testCase.args);
    assert.equal(result.details.error.code, testCase.code, `${testCase.name} carries an explicit semantic error code`);
    assert.equal(result.details.error.severity, testCase.severity, `${testCase.name} carries an explicit semantic severity`);
    assert.match(resultText(result), new RegExp(testCase.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${testCase.name} preserves model-facing error text`);

    // Pi can omit the transport-level isError flag when it invokes renderResult;
    // the registered renderer must still use the semantic details from execute.
    const presentation = board.renderResult({ ...result, isError: undefined }, { expanded: false, isError: false }, theme, { args: testCase.args })
      .render(100).join("\n");
    const icon = testCase.severity === "error" ? "✗" : "⚠";
    assert.match(presentation, new RegExp(icon), `${testCase.name} renders its semantic severity through the registered execute branch`);
    assert.match(presentation, new RegExp(testCase.text.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${testCase.name} renderer retains the error explanation`);
  }

  const partialContextPresentation = board.renderResult(
    { content: [{ type: "text", text: "Created session" }], details: { sessionId } },
    { expanded: false, isError: false },
    theme,
    {},
  ).render(60).join("\n");
  assert.match(partialContextPresentation, /Takomi board/, "registered board renderer tolerates a partial context without args");

  assert.deepEqual(notifications, [], "board validation failures do not emit unrelated success notifications");
  console.log("✓ registered takomi_board validation branches carry semantic warning/error details and render them");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.rm(workspace, { recursive: true, force: true });
  await fs.rm(outDir, { recursive: true, force: true });
}
