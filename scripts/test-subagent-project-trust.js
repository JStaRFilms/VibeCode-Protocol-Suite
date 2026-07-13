#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionDir = path.join(repoRoot, ".pi", "extensions", "takomi-subagents");
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function transpile(fileName, replacements) {
  const source = await fs.readFile(path.join(extensionDir, fileName), "utf8");
  let javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) {
    javascript = javascript.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
  }
  return dataModule(javascript);
}

const profileStub = dataModule(`export async function loadTakomiProfile() { return globalThis.__takomiTestProfile; }`);
const provenanceStub = dataModule(`
  export function hasUserGateAutoProvenance(entries) {
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      if (entry?.type === "custom" && entry.customType === "takomi-user-gate-auto-provenance") return entry.data?.authorized === true;
    }
    return false;
  }
`);
const routingStub = dataModule(`
  export async function loadTakomiModelRoutingSnapshot() { return {}; }
  export function applyTakomiRoutingDefaults(task) { return task; }
`);
const aliasesStub = dataModule(`export function resolveAgentName(name) { return name; }`);
const agentsStub = dataModule(`export function discoverTakomiAgents() { return [{ name: "project-agent", source: "project" }]; }`);
const delegationStub = dataModule(`
  export function createTakomiDelegationPlan(options) { return { ...options }; }
  export function renderTakomiDelegationPlan(plan) { return "plan:" + plan.launchMode; }
`);
const engineStub = dataModule(`
  export function createTakomiPiSubagentsEngine() {
    return {
      async execute(_name, params) {
        globalThis.__takomiTestExecutions += 1;
        if (params.task === "native cancellation") {
          return { content: [{ type: "text", text: "run cancelled" }], details: {} };
        }
        return { content: [{ type: "text", text: "ran" }], details: {} };
      },
    };
  }
`);
const uxStub = dataModule(`
  export function createTakomiUxTasks() { return []; }
  export function withTakomiUxDetails(details) { return details ?? {}; }
`);

const toolRunnerUrl = await transpile("tool-runner.ts", {
  "../takomi-runtime/profile": profileStub,
  "../takomi-runtime/gate-provenance": provenanceStub,
  "../takomi-runtime/model-routing-defaults": routingStub,
  "./agent-aliases": aliasesStub,
  "./agents": agentsStub,
  "./delegation-plan": delegationStub,
  "./pi-subagents-engine": engineStub,
  "./subagent-ux": uxStub,
});
const { executeTakomiSubagentTool } = await import(toolRunnerUrl);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-project-agent-gate-test-"));
const originalTrustOverride = process.env.TAKOMI_TRUST_PROJECT_AGENTS;
globalThis.__takomiTestExecutions = 0;
globalThis.__takomiTestProfile = {};

const runtimeEntry = (launchMode) => ({
  type: "custom",
  customType: "takomi-runtime-state",
  data: { launchMode },
});
const userGateEntry = (authorized) => ({
  type: "custom",
  customType: "takomi-user-gate-auto-provenance",
  data: { authorized },
});

async function launch({
  entries = [],
  hasUI = true,
  responses = [true],
  profile = {},
  pi = {},
  params = { agent: "project-agent", task: "perform work", agentScope: "project" },
} = {}) {
  globalThis.__takomiTestProfile = profile;
  const confirms = [];
  const executionsBefore = globalThis.__takomiTestExecutions;
  const result = await executeTakomiSubagentTool(pi, params, undefined, undefined, {
    cwd: tempRoot,
    hasUI,
    ui: {
      async confirm(title, detail) {
        confirms.push({ title, detail });
        return responses.shift() ?? false;
      },
    },
    sessionManager: { getEntries: () => entries },
  });
  return { result, confirms, executions: globalThis.__takomiTestExecutions - executionsBefore };
}

try {
  delete process.env.TAKOMI_TRUST_PROJECT_AGENTS;

  // A model can persist takomi_mode's visible auto launch state, but cannot
  // create the dedicated user command provenance entry.
  const modelAuto = await launch({ entries: [runtimeEntry("auto")], hasUI: false });
  assert.equal(modelAuto.executions, 0, "model/runtime auto is not project-agent authorization");
  assert.match(modelAuto.result.content[0].text, /require interactive approval/i);

  const profileAuto = await launch({ profile: { launchMode: "auto" }, hasUI: false });
  assert.equal(profileAuto.executions, 0, "profile auto is not project-agent authorization");
  const defaultAuto = await launch({ profile: {}, hasUI: false });
  assert.equal(defaultAuto.executions, 0, "default auto is not project-agent authorization");

  const userAuto = await launch({ entries: [runtimeEntry("auto"), userGateEntry(true)], hasUI: false });
  assert.equal(userAuto.confirms.length, 0, "user gate-auto provenance skips the project-agent prompt");
  assert.equal(userAuto.executions, 1, "user gate-auto provenance authorizes noninteractive execution");

  const switchedAwayEntries = [runtimeEntry("auto"), userGateEntry(true), runtimeEntry("manual"), userGateEntry(false)];
  const switchedAway = await launch({ entries: switchedAwayEntries, hasUI: false });
  assert.equal(switchedAway.executions, 0, "latest review/manual gate decision revokes authorization");
  assert.match(switchedAway.result.content[0].text, /require interactive approval/i);

  const interactive = await launch({ profile: { launchMode: "auto" } });
  assert.equal(interactive.confirms.length, 1, "interactive approval remains available without provenance");
  assert.equal(interactive.executions, 1, "interactive approval still permits this one launch");

  process.env.TAKOMI_TRUST_PROJECT_AGENTS = "true";
  const envOverride = await launch({ hasUI: false });
  assert.equal(envOverride.executions, 1, "TAKOMI_TRUST_PROJECT_AGENTS still authorizes no-UI execution");
  delete process.env.TAKOMI_TRUST_PROJECT_AGENTS;

  // Make a real review-gate stop, then add user authorization and auto mode.
  const reviewGatePi = {};
  const reviewGateParams = { agent: "project-agent", task: "review gate hard stop", agentScope: "project" };
  const reviewGateStopped = await launch({ pi: reviewGatePi, entries: [runtimeEntry("manual"), userGateEntry(true)], params: reviewGateParams });
  assert.equal(reviewGateStopped.executions, 0, "manual review gate stops before execution");
  assert.match(reviewGateStopped.result.content[0].text, /review gate/i);
  const reviewGateStillStopped = await launch({ pi: reviewGatePi, entries: [runtimeEntry("auto"), userGateEntry(true)], params: reviewGateParams, hasUI: false });
  assert.equal(reviewGateStillStopped.executions, 0, "authorization does not clear a review-gate hard stop");
  assert.match(reviewGateStillStopped.result.content[0].text, /already stopped \(review-gate\)/i);

  const nativeStopPi = {};
  const nativeParams = { agent: "project-agent", task: "native cancellation", agentScope: "project" };
  const nativeStopped = await launch({ pi: nativeStopPi, entries: [runtimeEntry("auto"), userGateEntry(true)], params: nativeParams, hasUI: false });
  assert.equal(nativeStopped.executions, 1, "native cancellation reaches the native runner once");
  const nativeStillStopped = await launch({ pi: nativeStopPi, entries: [runtimeEntry("auto"), userGateEntry(true)], params: nativeParams, hasUI: false });
  assert.equal(nativeStillStopped.executions, 0, "authorization does not clear a native cancellation hard stop");
  assert.match(nativeStillStopped.result.content[0].text, /already stopped \(native-pause-cancel-or-block\)/i);

  console.log("✓ project-agent user gate provenance, profile/default isolation, revocation, overrides, and hard-stop preservation");
} finally {
  if (originalTrustOverride === undefined) delete process.env.TAKOMI_TRUST_PROJECT_AGENTS;
  else process.env.TAKOMI_TRUST_PROJECT_AGENTS = originalTrustOverride;
  delete globalThis.__takomiTestExecutions;
  delete globalThis.__takomiTestProfile;
  await fs.rm(tempRoot, { recursive: true, force: true });
}
