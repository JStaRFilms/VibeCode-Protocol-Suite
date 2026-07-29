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
  export async function loadTakomiModelRoutingSnapshot() { return { approvedModels: [] }; }
  export function applyTakomiRoutingDefaults(task) { return task; }
  export function isTakomiModelApproved() { return true; }
`);
const aliasesStub = dataModule(`export function resolveAgentName(name) { return name; }`);
const agentsStub = dataModule(`
  export function discoverTakomiAgents() {
    return ["project-agent", "second-agent"].map((name) => ({ name, source: "project", defaultContext: globalThis.__takomiTestAgentDefaultContext }));
  }
`);
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
        if (params.task === "native interrupt") {
          return { content: [{ type: "text", text: "interrupted" }], details: { results: [{ interrupted: true }] } };
        }
        if (params.task === "execution cancellation") {
          throw new Error("execution aborted");
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
const detachedStub = dataModule(`
  export async function rememberDetachedLaunch() {}
  export async function resolveDetachedStatusResult(_pi, _params, result) { return result; }
`);
const internalsStub = dataModule(`export async function loadPiSubagentsInternals() { return { ASYNC_DIR: "/tmp/async", RESULTS_DIR: "/tmp/results", TEMP_ARTIFACTS_DIR: "/tmp/artifacts" }; }`);

const toolRunnerUrl = await transpile("tool-runner.ts", {
  "../takomi-runtime/profile": profileStub,
  "../takomi-runtime/gate-provenance": provenanceStub,
  "../takomi-runtime/model-routing-defaults": routingStub,
  "./agent-aliases": aliasesStub,
  "./agents": agentsStub,
  "./delegation-plan": delegationStub,
  "./detached-results": detachedStub,
  "./pi-subagents-internal": internalsStub,
  "./pi-subagents-engine": engineStub,
  "./subagent-ux": uxStub,
});
const { executeTakomiSubagentTool, findTaskCwdMismatch, taskRequiresWrite } = await import(toolRunnerUrl);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-project-agent-gate-test-"));
const externalRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-subagent-target-test-"));
await fs.mkdir(path.join(tempRoot, "subdir"));
const originalTrustOverride = process.env.TAKOMI_TRUST_PROJECT_AGENTS;
globalThis.__takomiTestExecutions = 0;
globalThis.__takomiTestProfile = {};
globalThis.__takomiTestAgentDefaultContext = undefined;

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
const userEntry = (id) => ({ type: "message", id, message: { role: "user", content: id } });
const assistantEntry = (id) => ({ type: "message", id, message: { role: "assistant", content: id } });
const customEntry = (id) => ({ type: "custom", id, customType: "test-entry", data: {} });

async function launch({
  entries = [],
  hasUI = true,
  responses = [true],
  profile = {},
  pi = {},
  sessionId = "test-session",
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
    sessionManager: {
      getEntries: () => entries,
      getSessionId: () => sessionId,
    },
  });
  return { result, confirms, executions: globalThis.__takomiTestExecutions - executionsBefore };
}

async function assertChangedLaunchRequiresNewReview(name, initialParams, changedParams, entries) {
  const pi = {};
  const stopped = await launch({ pi, entries, params: initialParams });
  assert.equal(stopped.executions, 0, `${name}: initial manual plan stops before execution`);

  const changed = await launch({
    pi,
    entries: [...entries, userEntry(`user-turn-${name}`)],
    params: { ...changedParams, confirmLaunch: true },
  });
  assert.equal(changed.executions, 0, `${name}: changed launch cannot consume the prior review`);
  assert.match(changed.result.content[0].text, /review gate/i, `${name}: changed launch receives a fresh review gate`);
}

try {
  delete process.env.TAKOMI_TRUST_PROJECT_AGENTS;

  assert.equal(taskRequiresWrite({ task: "Do not edit files.", requiredCapabilities: [] }), false, "explicit read-only capabilities override negated write-language inference");
  assert.equal(taskRequiresWrite({ task: "Edit the files." }), true, "write-language inference remains available when capabilities are omitted");
  assert.equal(taskRequiresWrite({ task: "Review only.", requiredCapabilities: ["write-code"] }), true, "explicit write capabilities remain enforced");
  assert.equal(
    await findTaskCwdMismatch({ agent: "reviewer", task: `Review the implementation in ${externalRoot}.`, cwd: tempRoot }, false),
    path.resolve(externalRoot),
    "an existing external directory in task prose is reported when cwd was omitted",
  );
  assert.equal(
    await findTaskCwdMismatch({ agent: "reviewer", task: `Review the implementation in ${externalRoot}.`, cwd: tempRoot }, true),
    undefined,
    "an explicit cwd remains authoritative even when task prose references another directory",
  );
  assert.equal(
    await findTaskCwdMismatch({ agent: "reviewer", task: "Review the default route path /. without editing files.", cwd: tempRoot }, false),
    undefined,
    "route-like prose that trims to a bare filesystem root does not trigger cwd mismatch feedback",
  );

  process.env.TAKOMI_TRUST_PROJECT_AGENTS = "1";
  const explicitExternalCwd = await launch({
    params: { agent: "project-agent", task: "Review only.", cwd: externalRoot, requiredCapabilities: [] },
    hasUI: false,
  });
  assert.equal(explicitExternalCwd.executions, 1, "an explicit absolute cwd can launch a task in an external repository");
  delete process.env.TAKOMI_TRUST_PROJECT_AGENTS;

  const listed = await launch({ params: { action: "list", agentScope: "both" }, hasUI: false });
  assert.equal(listed.executions, 0, "Takomi list is served by canonical discovery without invoking native pi-subagents management");
  assert.match(listed.result.content[0].text, /^Takomi personas:/, "Takomi list uses the canonical persona surface");
  assert.doesNotMatch(listed.result.content[0].text, /Executable agents|oracle|delegate|planner/, "Takomi list does not expose the native builtin catalog");

  const models = await launch({ params: { action: "models", agent: "project-agent", agentScope: "both" }, hasUI: false });
  assert.equal(models.executions, 0, "Takomi model inspection does not delegate custom personas to native builtin-only management");
  assert.match(models.result.content[0].text, /^Takomi model routing for project-agent:/, "Takomi model inspection resolves the custom persona directly");
  assert.doesNotMatch(models.result.content[0].text, /Builtin agent .* not found/, "Takomi model inspection cannot produce the native builtin lookup failure");

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

  const turnOne = userEntry("user-turn-1");
  const turnTwo = userEntry("user-turn-2");
  const manualAuthorized = [turnOne, runtimeEntry("manual"), userGateEntry(true)];
  const newerManualAuthorized = [...manualAuthorized, turnTwo];

  // A review-gate approval is valid only for the matching request on a newer
  // genuine user turn, and the stored approval can be consumed only once.
  const reviewGatePi = {};
  const reviewGateParams = { agent: "project-agent", task: "review gate hard stop", agentScope: "project" };
  const reviewGateApprovalParams = { ...reviewGateParams, confirmLaunch: true };
  const reviewGateStopped = await launch({ pi: reviewGatePi, entries: manualAuthorized, params: reviewGateParams });
  assert.equal(reviewGateStopped.executions, 0, "manual review gate stops before execution");
  assert.match(reviewGateStopped.result.content[0].text, /review gate/i);

  const sameTurnRetry = await launch({ pi: reviewGatePi, entries: manualAuthorized, params: reviewGateApprovalParams });
  assert.equal(sameTurnRetry.executions, 0, "same-turn autonomous confirmLaunch retry stays blocked");
  assert.match(sameTurnRetry.result.content[0].text, /already stopped \(review-gate\)/i);

  const nonUserEntries = [...manualAuthorized, customEntry("custom-1"), assistantEntry("assistant-1")];
  const nonUserRetry = await launch({ pi: reviewGatePi, entries: nonUserEntries, params: reviewGateApprovalParams });
  assert.equal(nonUserRetry.executions, 0, "custom and model entries do not establish a newer user turn");

  const noConfirmRetry = await launch({ pi: reviewGatePi, entries: newerManualAuthorized, params: reviewGateParams });
  assert.equal(noConfirmRetry.executions, 0, "a newer user turn without confirmLaunch stays blocked");

  const mismatchedParams = { ...reviewGateApprovalParams, task: "different request" };
  const mismatchedRetry = await launch({ pi: reviewGatePi, entries: newerManualAuthorized, params: mismatchedParams });
  assert.equal(mismatchedRetry.executions, 0, "confirmLaunch cannot consume a differently fingerprinted review gate");
  assert.match(mismatchedRetry.result.content[0].text, /review gate/i);

  const previewRetry = await launch({ pi: reviewGatePi, entries: newerManualAuthorized, params: { ...reviewGateApprovalParams, previewOnly: true } });
  assert.equal(previewRetry.executions, 0, "previewOnly cannot consume a review-gate approval");
  assert.match(previewRetry.result.content[0].text, /already stopped \(review-gate\)/i);

  const approvedRetry = await launch({ pi: reviewGatePi, entries: newerManualAuthorized, params: reviewGateApprovalParams });
  assert.equal(approvedRetry.executions, 1, "newer genuine user approval launches the matching request once");

  // Every execution-affecting task and global launch field must invalidate a
  // prior review. Each case changes exactly one effective field.
  const mutationBase = {
    agent: "project-agent",
    task: "fingerprint mutation",
    workflow: "workflow-a",
    skills: ["skill-a"],
    model: "model-a",
    fallbackModels: ["fallback-a"],
    thinking: "low",
    conversationId: "conversation-a",
    checklist: ["checklist item"],
    context: "fresh",
    async: false,
    clarify: false,
    agentScope: "project",
  };
  for (const [name, changedParams] of [
    ["task-agent", { ...mutationBase, agent: "second-agent" }],
    ["task-text", { ...mutationBase, task: "changed task" }],
    ["task-workflow", { ...mutationBase, workflow: "workflow-b" }],
    ["task-skills", { ...mutationBase, skills: ["skill-b"] }],
    ["task-model", { ...mutationBase, model: "model-b" }],
    ["task-fallback-models", { ...mutationBase, fallbackModels: ["fallback-b"] }],
    ["task-thinking", { ...mutationBase, thinking: "high" }],
    ["task-conversation-id", { ...mutationBase, conversationId: "conversation-b" }],
    ["task-checklist", { ...mutationBase, checklist: [{ text: "checklist item", done: true }] }],
    ["global-context", { ...mutationBase, context: "fork" }],
    ["global-async", { ...mutationBase, async: true }],
    ["global-clarify", { ...mutationBase, clarify: true }],
    ["global-agent-scope", { ...mutationBase, agentScope: "both" }],
  ]) {
    await assertChangedLaunchRequiresNewReview(name, mutationBase, changedParams, manualAuthorized);
  }

  const parallelMutationBase = {
    tasks: [
      { agent: "project-agent", task: "parallel first", cwd: "." },
      { agent: "project-agent", task: "parallel second", cwd: "." },
    ],
    concurrency: 2,
    worktree: false,
    agentScope: "project",
  };
  for (const [name, changedParams] of [
    ["task-cwd", { ...parallelMutationBase, tasks: [{ ...parallelMutationBase.tasks[0], cwd: "subdir" }, parallelMutationBase.tasks[1]] }],
    ["global-concurrency", { ...parallelMutationBase, concurrency: 1 }],
    ["global-worktree", { ...parallelMutationBase, worktree: true }],
    ["parallel-order", { ...parallelMutationBase, tasks: [...parallelMutationBase.tasks].reverse() }],
  ]) {
    await assertChangedLaunchRequiresNewReview(name, parallelMutationBase, changedParams, manualAuthorized);
  }
  await assertChangedLaunchRequiresNewReview(
    "mode",
    { ...mutationBase, task: "mode mutation" },
    { tasks: [{ agent: "project-agent", task: "mode mutation" }], agentScope: "project" },
    manualAuthorized,
  );

  // An omitted context is never equivalent to an explicit context, even when
  // the native default would resolve both calls to the same value.
  const explicitFreshPi = {};
  const explicitFresh = { agent: "project-agent", task: "explicit fresh versus implicit", context: "fresh", agentScope: "project" };
  const explicitFreshStopped = await launch({ pi: explicitFreshPi, entries: manualAuthorized, params: explicitFresh });
  assert.equal(explicitFreshStopped.executions, 0);
  const implicitAfterExplicitFresh = await launch({
    pi: explicitFreshPi,
    entries: newerManualAuthorized,
    params: { agent: "project-agent", task: explicitFresh.task, agentScope: "project", confirmLaunch: true },
  });
  assert.equal(implicitAfterExplicitFresh.executions, 0, "retrying explicit fresh as omitted requires a new review");
  assert.match(implicitAfterExplicitFresh.result.content[0].text, /review gate/i);

  const implicitFreshPi = {};
  const implicitFresh = { agent: "project-agent", task: "implicit versus explicit fresh", agentScope: "project" };
  const implicitFreshStopped = await launch({ pi: implicitFreshPi, entries: manualAuthorized, params: implicitFresh });
  assert.equal(implicitFreshStopped.executions, 0);
  const explicitFreshAfterImplicit = await launch({
    pi: implicitFreshPi,
    entries: newerManualAuthorized,
    params: { ...implicitFresh, context: "fresh", confirmLaunch: true },
  });
  assert.equal(explicitFreshAfterImplicit.executions, 0, "retrying omitted context as explicit fresh requires a new review");
  assert.match(explicitFreshAfterImplicit.result.content[0].text, /review gate/i);

  // A fork default may come from native built-ins/settings. Supplying one via
  // the Takomi discovery stub proves it cannot make omitted input approve fork.
  globalThis.__takomiTestAgentDefaultContext = "fork";
  const implicitForkPi = {};
  const implicitFork = { agent: "project-agent", task: "implicit versus explicit fork", agentScope: "project" };
  const implicitForkStopped = await launch({ pi: implicitForkPi, entries: manualAuthorized, params: implicitFork });
  assert.equal(implicitForkStopped.executions, 0);
  const explicitForkAfterImplicit = await launch({
    pi: implicitForkPi,
    entries: newerManualAuthorized,
    params: { ...implicitFork, context: "fork", confirmLaunch: true },
  });
  assert.equal(explicitForkAfterImplicit.executions, 0, "native default fork cannot make omitted approval valid for explicit fork");
  assert.match(explicitForkAfterImplicit.result.content[0].text, /review gate/i);

  const identicalImplicitApproved = await launch({
    pi: implicitForkPi,
    entries: newerManualAuthorized,
    params: { ...implicitFork, confirmLaunch: true },
  });
  assert.equal(identicalImplicitApproved.executions, 1, "an identical omitted retry launches after newer user approval");
  globalThis.__takomiTestAgentDefaultContext = undefined;

  const repeatedApproval = await launch({ pi: reviewGatePi, entries: newerManualAuthorized, params: reviewGateApprovalParams });
  assert.equal(repeatedApproval.executions, 0, "consumed approval cannot be reused on the same user turn");
  assert.match(repeatedApproval.result.content[0].text, /review gate/i);

  const prematureConfirmPi = {};
  const prematureConfirm = await launch({ pi: prematureConfirmPi, entries: manualAuthorized, params: { ...reviewGateParams, task: "premature confirm", confirmLaunch: true } });
  assert.equal(prematureConfirm.executions, 0, "confirmLaunch cannot bypass creation of an initial review plan");

  // Expiration removes approval provenance; the attempted approval creates a
  // fresh review plan instead of launching from the stale gate.
  const originalDateNow = Date.now;
  let now = 1_000;
  Date.now = () => now;
  try {
    const ttlPi = {};
    const ttlParams = { ...reviewGateParams, task: "expired review gate" };
    const ttlStopped = await launch({ pi: ttlPi, entries: manualAuthorized, params: ttlParams });
    assert.equal(ttlStopped.executions, 0);
    now += 10 * 60 * 1_000 + 1;
    const ttlRetry = await launch({ pi: ttlPi, entries: newerManualAuthorized, params: { ...ttlParams, confirmLaunch: true } });
    assert.equal(ttlRetry.executions, 0, "expired review-gate approval cannot launch");
    assert.match(ttlRetry.result.content[0].text, /review gate/i);
  } finally {
    Date.now = originalDateNow;
  }

  // New-user confirmLaunch is specific to review-gate records. Project-agent
  // denial/approval-required and native cancellation/interrupt records remain hard stops.
  const deniedPi = {};
  const deniedParams = { agent: "project-agent", task: "project agent denied", agentScope: "project" };
  const denied = await launch({ pi: deniedPi, entries: [turnOne, runtimeEntry("auto")], responses: [false], params: deniedParams });
  assert.equal(denied.executions, 0);
  const deniedRetry = await launch({ pi: deniedPi, entries: [turnOne, turnTwo, runtimeEntry("auto")], params: { ...deniedParams, confirmLaunch: true } });
  assert.equal(deniedRetry.executions, 0, "new-user confirmLaunch does not clear project-agent denial");
  assert.match(deniedRetry.result.content[0].text, /already stopped \(project-agent-denied\)/i);

  const approvalRequiredPi = {};
  const approvalRequiredParams = { agent: "project-agent", task: "project agent approval required", agentScope: "project" };
  await launch({ pi: approvalRequiredPi, entries: [turnOne, runtimeEntry("auto")], hasUI: false, params: approvalRequiredParams });
  const approvalRequiredRetry = await launch({ pi: approvalRequiredPi, entries: [turnOne, turnTwo, runtimeEntry("auto")], hasUI: false, params: { ...approvalRequiredParams, confirmLaunch: true } });
  assert.equal(approvalRequiredRetry.executions, 0, "new-user confirmLaunch does not clear project-agent approval-required stop");
  assert.match(approvalRequiredRetry.result.content[0].text, /already stopped \(project-agent-approval-required\)/i);

  for (const [task, expectedReason] of [
    ["native cancellation", "native-pause-cancel-or-block"],
    ["native interrupt", "native-interrupt"],
    ["execution cancellation", "execution-cancelled"],
  ]) {
    const nativeStopPi = {};
    const nativeParams = { agent: "project-agent", task, agentScope: "project" };
    const nativeStopped = await launch({ pi: nativeStopPi, entries: [turnOne, runtimeEntry("auto"), userGateEntry(true)], params: nativeParams, hasUI: false });
    assert.equal(nativeStopped.executions, 1, `${task} reaches the native runner once`);
    const nativeStillStopped = await launch({ pi: nativeStopPi, entries: [turnOne, turnTwo, runtimeEntry("auto"), userGateEntry(true)], params: { ...nativeParams, confirmLaunch: true }, hasUI: false });
    assert.equal(nativeStillStopped.executions, 0, `new-user confirmLaunch does not clear ${task}`);
    assert.match(nativeStillStopped.result.content[0].text, new RegExp(`already stopped \\(${expectedReason}\\)`, "i"));
  }

  console.log("✓ project-agent provenance and one-shot newer-user review-gate approval preserve all other hard stops");
} finally {
  if (originalTrustOverride === undefined) delete process.env.TAKOMI_TRUST_PROJECT_AGENTS;
  else process.env.TAKOMI_TRUST_PROJECT_AGENTS = originalTrustOverride;
  delete globalThis.__takomiTestExecutions;
  delete globalThis.__takomiTestProfile;
  delete globalThis.__takomiTestAgentDefaultContext;
  await Promise.all([
    fs.rm(tempRoot, { recursive: true, force: true }),
    fs.rm(externalRoot, { recursive: true, force: true }),
  ]);
}
