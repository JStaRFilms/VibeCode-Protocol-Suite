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
  export const workflowPrompt = () => "workflow";
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
const context = {
  cwd: repoRoot,
  ui: { notify() {} },
};

registerTakomiCommands(pi, {
  getState: () => state,
  async updateState(_ctx, mutator) { mutator(); },
  recordUserGateAutoProvenance(authorized) { provenance.push(authorized); },
  async resetRuntime() {},
  setStageAndWorkflow() {},
  async createPlanSession() { return ""; },
  async hasGenesisArtifacts() { return false; },
  subagentController: { hasRuns: () => false, getStatusSummary: () => "" },
});

const handler = commands.get("takomi").handler;
await handler("gate auto", context);
assert.deepEqual(provenance, [true], "/takomi gate auto records explicit user authorization");
assert.equal(state.launchMode, "auto");

await handler("gate review", context);
assert.deepEqual(provenance, [true, false], "/takomi gate review revokes authorization");
assert.equal(state.launchMode, "manual");

await handler("gate manual", context);
assert.deepEqual(provenance, [true, false, false], "/takomi gate manual also revokes authorization");
assert.equal(state.launchMode, "manual");

await handler("mode review", context);
assert.deepEqual(provenance, [true, false, false, false], "review mode cannot retain auto authorization");
assert.equal(state.launchMode, "manual");

console.log("✓ /takomi gate auto writes provenance; review/manual paths revoke it");
