#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const runtimeDir = path.join(repoRoot, ".pi", "extensions", "takomi-runtime");
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function transpile(fileName, replacements) {
  const source = await fs.readFile(path.join(runtimeDir, fileName), "utf8");
  let javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) {
    javascript = javascript.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
  }
  return dataModule(javascript);
}

const commandTextStub = dataModule(`
  export const commandHelp = () => "help";
  export const completions = () => [];
  export const statusText = () => "status";
  export const workflowPrompt = (stage, prompt) => "workflow:" + stage + (prompt ? ":" + prompt : "");
`);
const routingStub = dataModule(`
  export const previewTakomiRoutingPolicy = () => ({});
  export const renderRoutingPolicyPreview = () => "";
  export const resolveTakomiRoutingPolicy = async () => ({ source: "missing" });
`);
const statsStub = dataModule(`export const collectTakomiStats = async () => ({}); export const renderTakomiStats = () => "";`);
const agentsStub = dataModule(`export const discoverTakomiAgents = () => [];`);

const commandsUrl = await transpile("commands.ts", {
  "./command-text": commandTextStub,
  "./routing-policy": routingStub,
  "./takomi-stats.js": statsStub,
  "../takomi-subagents/agents": agentsStub,
});
const { registerTakomiCommands } = await import(commandsUrl);

const commands = new Map();
const pi = { registerCommand(name, definition) { commands.set(name, definition); } };
const state = {
  enabled: true,
  autoOrch: false,
  launchMode: "manual",
  planMode: false,
  role: "general",
  subagentsEnabled: true,
};
const provenance = [];
const notifications = [];
const stageCalls = [];
const context = {
  cwd: repoRoot,
  ui: { notify(message, level) { notifications.push({ message, level }); } },
};

registerTakomiCommands(pi, {
  getState: () => state,
  async updateState(ctx, mutator, message) {
    mutator();
    const text = typeof message === "function" ? message() : message;
    if (text) ctx.ui.notify(text, "info");
  },
  recordUserGateAutoProvenance(authorized) { provenance.push(authorized); },
  async resetRuntime() {},
  setStageAndWorkflow(stage) { stageCalls.push(stage); },
  async createPlanSession() { return ""; },
  async hasGenesisArtifacts() { return false; },
  subagentController: { hasRuns: () => false, getStatusSummary: () => "" },
});

const handler = commands.get("takomi").handler;
await handler("build preserve this optional request", context);
assert.deepEqual(stageCalls, ["build"], "stage command sets the requested lifecycle stage");
assert.deepEqual(notifications.at(-1), { message: "workflow:build:preserve this optional request", level: "info" }, "stage command restores workflowPrompt(stage, prompt), including optional request text");
notifications.length = 0;
state.stage = "design";
state.workflow = "vibe-design";

await handler("mode code", context);
assert.deepEqual(notifications, [], "code mode notification is deduplicated when the runtime widget represents the active mode");
assert.equal(state.role, "coder", "main-agent code mode selects the canonical coder persona");
assert.equal(state.stage, "design", "main-agent mode changes do not mutate the lifecycle stage");

await handler("gate auto", context);
assert.deepEqual(provenance, [true], "/takomi gate auto records explicit user authorization");
assert.equal(state.launchMode, "auto");
assert.deepEqual(notifications, [], "gate success is represented by the active runtime widget");

await handler("subagents off", context);
assert.equal(state.subagentsEnabled, false);
assert.deepEqual(notifications, [], "subagent changes are represented by the active runtime widget");

const directNotificationCount = notifications.length;
await handler("mode review", context);
assert.deepEqual(provenance, [true, false], "review mode cannot retain auto authorization");
assert.equal(state.launchMode, "manual");
assert.equal(notifications.length, directNotificationCount, "mode success is deduplicated only when the live runtime widget represents review state");

await handler("gate manual", context);
assert.deepEqual(provenance, [true, false, false], "/takomi gate manual revokes authorization");
assert.equal(notifications.length, directNotificationCount, "gate success is deduplicated while the live runtime widget represents state");
await handler("subagents on", context);
assert.equal(notifications.length, directNotificationCount, "subagent success is deduplicated while the live runtime widget represents state");

await handler("gate invalid", context);
assert.deepEqual(notifications.at(-1), { message: "Usage: /takomi gate <auto|review|manual>", level: "warning" }, "invalid gate input remains visibly notified");
await handler("help", context);
assert.deepEqual(notifications.at(-1), { message: "help", level: "info" }, "explicit help remains visibly notified");

console.log("✓ stage prompts, direct feedback, and represented-state notification deduplication are preserved");
