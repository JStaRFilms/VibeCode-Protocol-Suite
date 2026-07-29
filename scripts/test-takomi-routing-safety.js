#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(repoRoot, ".pi", "extensions", "takomi-runtime", "model-routing-defaults.ts");
const gatePath = path.join(repoRoot, ".pi", "extensions", "takomi-context-manager", "model-policy-gate.ts");
const source = await fs.readFile(sourcePath, "utf8");
const lifecycleRoutingSource = await fs.readFile(path.join(repoRoot, "src", "pi-takomi-core", "routing.ts"), "utf8");
const gateSource = await fs.readFile(gatePath, "utf8");
const routingStub = `data:text/javascript;base64,${Buffer.from('export async function resolveTakomiRoutingPolicy(){ return { source: "missing" }; }').toString("base64")}`;
let javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
javascript = javascript.replaceAll('"./routing-policy"', JSON.stringify(routingStub));
const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
const routing = await import(moduleUrl);
let lifecycleJavascript = ts.transpileModule(lifecycleRoutingSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const workflowStub = `data:text/javascript;base64,${Buffer.from('export function getWorkflowDefinition(id){ return { preferredRole: id === "vibe-design" ? "designer" : id === "vibe-build" ? "coder" : "architect" }; }').toString("base64")}`;
lifecycleJavascript = lifecycleJavascript.replaceAll('"./workflows"', JSON.stringify(workflowStub));
const lifecycleRouting = await import(`data:text/javascript;base64,${Buffer.from(lifecycleJavascript).toString("base64")}`);
assert.equal(lifecycleRouting.detectLifecycleStage("design the payment system architecture"), "genesis", "technical architecture routes to Genesis, never UI/UX Design");
assert.equal(lifecycleRouting.detectLifecycleStage("create responsive UI mockups"), "design", "UI/UX requests route to the Design lifecycle stage");

const overlaid = routing.mergeTakomiRoutingSettings(
  {
    takomi: { routing: {
      defaultProvider: "oauth-router",
      approvedModels: ["oauth-router/gpt-5.6-sol"],
      roleDefaults: {
        coder: { model: "oauth-router/gpt-5.6-sol", thinking: "low" },
        reviewer: { model: "oauth-router/gpt-5.5", thinking: "high" },
      },
    } },
  },
  {
    takomi: { routing: {
      defaultProvider: "openai-codex",
      approvedModels: ["openai-codex/gpt-5.6-terra"],
      roleDefaults: { coder: { model: "openai-codex/gpt-5.6-terra" } },
    } },
  },
);
assert.deepEqual(overlaid.approvedModels, ["openai-codex/gpt-5.6-terra"], "project allowlist replaces the global allowlist instead of merging providers");
assert.equal(overlaid.defaultProvider, "openai-codex", "project default provider overrides global configuration");
assert.deepEqual(overlaid.agentDefaults.find((entry) => entry.agent === "coder"), {
  agent: "coder",
  model: "openai-codex/gpt-5.6-terra",
  thinking: "low",
  fallbackModels: undefined,
  source: "project role default",
}, "project role fields deep-overlay global role fields");
assert.equal(overlaid.agentDefaults.find((entry) => entry.agent === "reviewer")?.source, "global role default", "unmodified global role defaults remain available");

const legacyInferred = routing.mergeTakomiRoutingSettings(
  {
    subagents: { agentOverrides: {
      scout: { model: "openai-codex/gpt-5.6-luna", thinking: "high" },
      worker: { model: "openai-codex/gpt-5.6-terra", fallbackModels: ["openai-codex/gpt-5.6-sol:low"] },
    } },
  },
  {},
);
assert.deepEqual(legacyInferred.approvedModels, [], "role defaults and legacy overrides never become an implicit strict allowlist");
assert.deepEqual(
  legacyInferred.preferredModels,
  ["openai-codex/gpt-5.6-luna", "openai-codex/gpt-5.6-terra", "openai-codex/gpt-5.6-sol"],
  "legacy models remain soft fallback preferences when strict allowlisting is disabled",
);
assert.equal(legacyInferred.agentDefaults.some((entry) => entry.agent === "scout"), false, "legacy hidden personas do not reappear as public role defaults");

const approved = ["oauth-router/gpt-5.6-sol"];
assert.equal(routing.isTakomiModelApproved("openai-codex/gpt-5.6-sol", approved), false, "approval is provider-qualified and exact");
assert.doesNotMatch(source, /approvedModelEquivalent|modelFamily/, "family-equivalence routing helpers are removed");

const explicit = routing.applyTakomiRoutingDefaults({
  agent: "coder",
  model: "openai-codex/gpt-5.6-sol",
}, {
  approvedModels: approved,
  preferredModels: approved,
  sourceFiles: [],
  agentDefaults: [{ agent: "coder", model: "oauth-router/gpt-5.6-sol", fallbackModels: ["oauth-router/gpt-5.4"] }],
});
assert.equal(explicit.model, "openai-codex/gpt-5.6-sol", "explicit provider-qualified model remains atomic");
assert.equal(explicit.fallbackModels, undefined, "role fallbacks are not attached to an explicit model unless the task supplies them");

const explicitFallback = routing.applyTakomiRoutingDefaults({
  agent: "coder",
  model: "openai-codex/gpt-5.6-sol",
  fallbackModels: ["openai-codex/gpt-5.6-terra"],
}, {
  approvedModels: ["openai-codex/gpt-5.6-sol", "openai-codex/gpt-5.6-terra"],
  preferredModels: [],
  sourceFiles: [],
  agentDefaults: [{ agent: "coder", fallbackModels: ["oauth-router/gpt-5.4"] }],
});
assert.deepEqual(explicitFallback.fallbackModels, ["openai-codex/gpt-5.6-terra"], "only explicit task fallbacks authorize fallback for an explicit model");

assert.doesNotMatch(source, /collectModelsFromPolicy|extractPreferredProvider/, "executable routing does not parse Markdown policy prose");
assert.doesNotMatch(gateSource, /approvedModelEquivalent/, "policy gate cannot silently perform family-equivalent substitution");
const [architectPrompt, designerPrompt, workerPrompt, engineSource] = await Promise.all([
  fs.readFile(path.join(repoRoot, ".pi", "agents", "architect.md"), "utf8"),
  fs.readFile(path.join(repoRoot, ".pi", "agents", "designer.md"), "utf8"),
  fs.readFile(path.join(repoRoot, ".pi", "agents", "worker.md"), "utf8"),
  fs.readFile(path.join(repoRoot, ".pi", "extensions", "takomi-subagents", "pi-subagents-engine.ts"), "utf8"),
]);
assert.match(architectPrompt.split("---")[1], /tools:.*write/, "architect can author Genesis Markdown artifacts");
assert.match(designerPrompt.split("---")[1], /tools:.*write/, "designer can author UI\/UX Markdown artifacts");
assert.match(workerPrompt, /name: worker/, "Takomi supplies its own generic write-capable worker persona");
assert.match(engineSource, /TAKOMI_PUBLIC_AGENT_NAMES/, "native pi-subagents discovery is filtered to canonical Takomi personas");
console.log("✓ exact provider routing, explicit fallback boundaries, and advisory-only Markdown are enforced");
