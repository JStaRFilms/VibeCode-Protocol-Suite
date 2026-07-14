#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionDir = path.join(repoRoot, ".pi", "extensions", "takomi-subagents");
const nativeAcceptancePath = path.join(repoRoot, "node_modules", "pi-subagents", "src", "runs", "shared", "acceptance.ts");
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function transpile(filePath, replacements = {}) {
  let javascript = ts.transpileModule(await fs.readFile(filePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) {
    javascript = javascript.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
  }
  return dataModule(javascript);
}

const state = {
  baseCwd: repoRoot,
  currentSessionId: "acceptance-test",
  subagentInProgress: false,
  asyncJobs: new Map(),
  foregroundRuns: new Map(),
  foregroundControls: new Map(),
  lastForegroundControlId: null,
  pendingForegroundControlNotices: new Map(),
  cleanupTimers: new Map(),
  lastUiContext: null,
  poller: null,
  completionSeen: new Map(),
  watcher: null,
  watcherRestartTimer: null,
  resultFileCoalescer: { schedule: () => false, clear() {} },
};
let capturedParams;
const internalsUrl = dataModule(`
  export async function loadPiSubagentsInternals() {
    return {
      TEMP_ARTIFACTS_DIR: "/tmp/takomi-acceptance",
      discoverPiAgents: () => ({ agents: [{ name: "worker" }, { name: "reviewer" }] }),
      createSubagentExecutor() {
        return { async execute(_id, params) {
          globalThis.__takomiAcceptanceCapturedParams = params;
          return { content: [{ type: "text", text: "ok" }], details: { mode: "single", results: [] } };
        } };
      },
    };
  }
`);
const lifecycleUrl = dataModule(`
  const state = globalThis.__takomiAcceptanceState;
  export async function ensureTakomiAsyncLifecycle() { return { state, generation: 1, ownership: "takomi" }; }
  export function getTakomiAsyncLifecycleSnapshot() { return { state, generation: 1, ownership: "takomi" }; }
`);
const aliasesUrl = dataModule(`export function resolveAgentName(name) { return name; }`);
const routingUrl = dataModule(`
  export function applyTakomiRoutingDefaults(value) { return value; }
  export function loadTakomiModelRoutingSnapshotSync() { return {}; }
`);
globalThis.__takomiAcceptanceState = state;
const engineUrl = await transpile(path.join(extensionDir, "pi-subagents-engine.ts"), {
  "./pi-subagents-internal": internalsUrl,
  "./async-lifecycle": lifecycleUrl,
  "./agent-aliases": aliasesUrl,
  "../takomi-runtime/model-routing-defaults": routingUrl,
});
const nativeAcceptanceUrl = await transpile(nativeAcceptancePath);
const [{ createTakomiPiSubagentsEngine }, acceptance] = await Promise.all([
  import(engineUrl),
  import(nativeAcceptanceUrl),
]);

const ctx = {
  cwd: repoRoot,
  model: undefined,
  modelRegistry: { getAvailable: () => [] },
  sessionManager: { getSessionFile: () => null, getSessionId: () => "acceptance-test" },
};
const engine = createTakomiPiSubagentsEngine({});
async function mappedAcceptance(explicit) {
  delete globalThis.__takomiAcceptanceCapturedParams;
  await engine.execute("acceptance", {
    agent: "reviewer",
    task: "Review the current changes and report findings without edits.",
    async: true,
    ...(explicit === undefined ? {} : { acceptance: explicit }),
  }, undefined, undefined, ctx);
  capturedParams = globalThis.__takomiAcceptanceCapturedParams;
  assert.ok(capturedParams, "production Takomi engine forwards native execution params");
  return capturedParams.acceptance;
}

function reportFence(report) {
  return `done\n\n\`\`\`acceptance-report\n${JSON.stringify(report)}\n\`\`\``;
}

try {
  const defaultMapped = await mappedAcceptance(undefined);
  assert.deepEqual(
    defaultMapped,
    { level: "none", reason: "No explicit Takomi acceptance contract." },
    "normal Takomi task omission maps to a valid disabled native contract, not auto inference",
  );
  const normalConfig = acceptance.resolveEffectiveAcceptance({
    explicit: defaultMapped,
    agentName: "reviewer",
    task: "Review the current changes and report findings without edits.",
    mode: "single",
    async: true,
  });
  assert.equal(normalConfig.level, "none", "ordinary reviewer tasks have no enforced acceptance contract");
  const normalLedger = await acceptance.evaluateAcceptance({ acceptance: normalConfig, output: "No blockers found.", cwd: repoRoot });
  assert.equal(normalLedger.status, "not-required", "ordinary successful reviewer output is not falsely rejected");

  const explicitContract = {
    level: "checked",
    criteria: ["Return truthful findings"],
    evidence: ["residual-risks"],
  };
  const explicitMapped = await mappedAcceptance(explicitContract);
  assert.deepEqual(explicitMapped, explicitContract, "explicit Takomi acceptance is forwarded unchanged");
  const explicitConfig = acceptance.resolveEffectiveAcceptance({
    explicit: explicitMapped,
    agentName: "reviewer",
    task: "Review the current changes without edits.",
    mode: "single",
    async: true,
  });
  assert.equal(explicitConfig.level, "checked", "explicit checked acceptance remains enforced");

  const acceptedLedger = await acceptance.evaluateAcceptance({
    acceptance: explicitConfig,
    output: reportFence({
      criteriaSatisfied: [{ id: "criterion-1", status: "satisfied", evidence: "Reviewed the diff." }],
      changedFiles: ["src/example.ts"],
      testsAddedOrUpdated: ["test/example.test.ts"],
      commandsRun: [{ command: "npm test", result: "passed", summary: "passed" }],
      residualRisks: [],
      noStagedFiles: true,
    }),
    cwd: repoRoot,
  });
  assert.equal(acceptedLedger.status, "checked", "truthful explicit acceptance succeeds");

  const rejectedLedger = await acceptance.evaluateAcceptance({
    acceptance: explicitConfig,
    output: reportFence({
      criteriaSatisfied: [{ id: "criterion-1", status: "not-satisfied", evidence: "A blocker remains." }],
      changedFiles: ["src/example.ts"],
      testsAddedOrUpdated: ["test/example.test.ts"],
      commandsRun: [{ command: "npm test", result: "passed", summary: "passed" }],
      residualRisks: ["blocker remains"],
      noStagedFiles: true,
    }),
    cwd: repoRoot,
  });
  assert.equal(rejectedLedger.status, "rejected", "explicitly failed acceptance remains rejected");
  assert.match(acceptance.acceptanceFailureMessage(rejectedLedger), /criterion-1.*not-satisfied/i, "explicit rejection reports the truthful criterion cause");

  const attestedConfig = acceptance.resolveEffectiveAcceptance({
    explicit: "attested",
    agentName: "reviewer",
    task: "Review without edits.",
    mode: "single",
    async: true,
  });
  const malformedLedger = await acceptance.evaluateAcceptance({
    acceptance: attestedConfig,
    output: reportFence({ criteriaSatisfied: "not-an-array", residualRisks: [] }),
    cwd: repoRoot,
  });
  assert.equal(malformedLedger.status, "rejected", "malformed explicit attestation is rejected");
  assert.match(malformedLedger.childReportParseError, /criteriaSatisfied: expected array/i, "malformed attestation exposes its schema error");

  console.log("✓ Takomi default acceptance plus explicit accept, reject, and malformed attestation tests passed");
} finally {
  delete globalThis.__takomiAcceptanceCapturedParams;
  delete globalThis.__takomiAcceptanceState;
}
