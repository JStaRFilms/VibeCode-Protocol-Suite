#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(repoRoot, ".pi", "extensions", "takomi-runtime", "tool-renderers.ts");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-runtime-renderer-test-"));
const outDir = path.join(repoRoot, ".tmp", `runtime-renderers-${process.pid}`);
const tsconfigPath = path.join(tempRoot, "tsconfig.json");

function render(component, width = 120) {
  return component.render(width).join("\n").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
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

  const renderers = await import(pathToFileURL(path.join(outDir, ".pi", "extensions", "takomi-runtime", "tool-renderers.js")).href);
  const codingAgent = await import("@earendil-works/pi-coding-agent");
  const tui = await import("@earendil-works/pi-tui");
  codingAgent.initTheme();
  tui.setKeybindings(new tui.KeybindingsManager({
    ...tui.TUI_KEYBINDINGS,
    "app.tools.expand": { defaultKeys: "ctrl+o", description: "Toggle tool output" },
  }));
  const theme = { fg: (_color, value) => value, bold: (value) => value };

  const modeResult = {
    content: [{ type: "text", text: "Takomi mode set to model:build (explicit request)." }],
    details: { mode: "build", source: "model", role: "orchestrator", stage: "build", workflow: "vibe-build" },
  };
  assert.match(render(renderers.renderTakomiModeCall({ mode: "build" }, theme)), /takomi_mode build/, "mode call identifies the requested mode");
  const modeCompact = render(renderers.renderTakomiModeResult(modeResult, { expanded: false }, theme));
  assert.match(modeCompact, /✓ Takomi mode model:build/, "mode compact card has status, title, and summary");
  assert.match(modeCompact, /ctrl\+o/, "mode compact card has the configured expansion hint");
  assert.equal(modeCompact.split("\n").length, 2, "mode compact card remains bounded");
  assert.doesNotMatch(modeCompact, /explicit request/, "mode compact card omits long result detail");
  assert.match(render(renderers.renderTakomiModeResult(modeResult, { expanded: true }, theme)), /explicit request/, "mode expanded card retains complete model-facing result");

  const routingResult = {
    content: [{ type: "text", text: "Takomi routing policy saved (project).\n\nPolicy: /repo/.pi/takomi/model-routing.md\nSettings: /repo/.pi/settings.json\n\nDetected routing defaults:\n- coder → gpt-5.4" }],
    details: { preview: { scope: "project" }, result: { detectedDefaults: ["coder → gpt-5.4"] } },
  };
  assert.match(render(renderers.renderTakomiRoutingCall({ scope: "project" }, theme)), /takomi_apply_routing_policy project/, "routing call does not expose policy body");
  const routingCompact = render(renderers.renderTakomiRoutingResult(routingResult, { expanded: false }, theme));
  assert.match(routingCompact, /✓ Takomi routing project policy saved/, "routing compact card summarizes saved scope");
  assert.doesNotMatch(routingCompact, /model-routing\.md/, "routing compact card omits path wall");
  assert.match(render(renderers.renderTakomiRoutingResult(routingResult, { expanded: true }, theme)), /model-routing\.md/, "routing expanded card retains complete policy result");

  const workflowResult = {
    content: [{ type: "text", text: "Vibe Build\n\n# Build playbook\n\nImplement the approved design in small verified steps." }],
    details: { id: "vibe-build", title: "Vibe Build", purpose: "Implement approved work" },
  };
  assert.match(render(renderers.renderTakomiWorkflowCall({ workflow: "vibe-build" }, theme)), /takomi_workflow vibe-build/, "workflow call identifies the selected playbook");
  assert.match(render(renderers.renderTakomiWorkflowResult(workflowResult, { expanded: false }, theme)), /✓ Takomi workflow Vibe Build/, "workflow compact card summarizes the selected playbook");
  assert.match(render(renderers.renderTakomiWorkflowResult(workflowResult, { expanded: true }, theme)), /Implement the approved design in small verified steps/, "workflow expanded card renders complete playbook text");

  const boardResult = {
    content: [{ type: "text", text: "Updated task BLD-002 in session orch-20260712-114201.\nStatus: completed" }],
    details: { sessionId: "orch-20260712-114201", taskId: "BLD-002", task: { id: "BLD-002", status: "completed" } },
  };
  assert.match(render(renderers.renderTakomiBoardCall({ action: "update_task" }, theme)), /takomi_board update_task/, "board call identifies the action");
  const boardCompact = render(renderers.renderTakomiBoardResult(boardResult, { expanded: false }, theme, { action: "update_task", sessionId: "orch-20260712-114201", taskId: "BLD-002" }));
  assert.match(boardCompact, /✓ Task BLD-002 status: completed/, "board compact card summarizes task state");
  assert.equal(boardCompact.split("\n").length, 2, "board compact card remains bounded");
  assert.match(render(renderers.renderTakomiBoardResult(boardResult, { expanded: true }, theme, { action: "update_task", sessionId: "orch-20260712-114201", taskId: "BLD-002" })), /Updated task BLD-002/, "board expanded card retains complete model-facing result");

  const blockedBoard = {
    content: [{ type: "text", text: "sessionId and taskId are required for update_task" }],
    details: { error: { code: "missing-task-context", message: "sessionId and taskId are required for update_task", severity: "warning" } },
    isError: true,
  };
  const semanticOnlyBlockedBoard = { ...blockedBoard, isError: undefined };
  assert.match(render(renderers.renderTakomiBoardResult(semanticOnlyBlockedBoard, { expanded: false, isError: false }, theme, { action: "update_task" })), /⚠ Task update sessionId and taskId are required/, "board warnings render from explicit semantic details, not top-level isError");

  const boardActionResults = {
    init_session: boardResult,
    expand_stage: { content: [{ type: "text", text: "Expanded build stage." }], details: { sessionId: "orch-20260712-114201" } },
    show_workflows: { content: [{ type: "text", text: "vibe-genesis: Foundation" }], details: {} },
    show_session: { content: [{ type: "text", text: "# Session" }], details: { sessionId: "orch-20260712-114201" } },
    update_task: boardResult,
  };
  const noControls = /[\x00-\x08\x0B-\x1F\x7F-\x9F]/;
  function assertAtWidths(label, component) {
    for (const width of [40, 60]) {
      const output = render(component(), width);
      assert.ok(output.length > 0, `${label} renders at width ${width}`);
      assert.doesNotMatch(output, noControls, `${label} strips terminal controls at width ${width}`);
    }
  }

  for (const expanded of [false, true]) {
    assertAtWidths(`mode ${expanded ? "expanded" : "compact"}`, () => renderers.renderTakomiModeResult(modeResult, { expanded }, theme));
    assertAtWidths(`routing ${expanded ? "expanded" : "compact"}`, () => renderers.renderTakomiRoutingResult(routingResult, { expanded }, theme));
    assertAtWidths(`workflow ${expanded ? "expanded" : "compact"}`, () => renderers.renderTakomiWorkflowResult(workflowResult, { expanded }, theme));
    for (const [action, actionResult] of Object.entries(boardActionResults)) {
      const args = { action, sessionId: "orch-20260712-114201", taskId: "BLD-002", stage: "build" };
      assertAtWidths(`board ${action} call`, () => renderers.renderTakomiBoardCall(args, theme));
      assertAtWidths(`board ${action} ${expanded ? "expanded" : "compact"}`, () => renderers.renderTakomiBoardResult(actionResult, { expanded }, theme, args));
    }
  }

  assertAtWidths("mode missing args", () => renderers.renderTakomiModeCall(undefined, theme));
  assertAtWidths("routing missing args", () => renderers.renderTakomiRoutingCall(undefined, theme));
  assertAtWidths("workflow missing args", () => renderers.renderTakomiWorkflowCall(undefined, theme));
  assertAtWidths("board missing context.args", () => renderers.renderTakomiBoardResult(boardResult, { expanded: false }, theme, undefined));

  const maliciousText = "Safe text \x1b[31mred\x1b[0m \x1b]8;;https://evil.example\x07link\x1b]8;;\x07\x00\x1f";
  const maliciousResult = {
    content: [{ type: "text", text: maliciousText }],
    details: { mode: "build\x1b[2J", source: "model\x00", role: "code\x1b]2;spoof\x07" },
  };
  const maliciousPresentation = render(renderers.renderTakomiModeResult(maliciousResult, { expanded: true }, theme), 60);
  assert.doesNotMatch(maliciousPresentation, /\x1b|\x00|\x1f|https:\/\/evil/, "renderer presentation strips ANSI, OSC, and C0 controls");
  assert.equal(maliciousResult.content[0].text, maliciousText, "renderer sanitization does not mutate model-facing result content");
  assertAtWidths("malicious mode presentation", () => renderers.renderTakomiModeResult(maliciousResult, { expanded: true }, theme));

  console.log("✓ runtime renderer cards are compact, semantic, control-safe, and resilient at 40/60 columns");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.rm(outDir, { recursive: true, force: true });
}
