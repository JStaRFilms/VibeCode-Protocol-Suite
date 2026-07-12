#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-context-renderer-test-"));
const outDir = path.join(repoRoot, ".tmp", `context-manager-renderers-${process.pid}`);
const tsconfigPath = path.join(tempRoot, "tsconfig.json");

async function addJsExtensions(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) await addJsExtensions(filePath);
    if (entry.isFile() && entry.name.endsWith(".js")) {
      const source = await fs.readFile(filePath, "utf8");
      await fs.writeFile(filePath, source.replace(/(from\s+["']\.\/?[^"']+)(["'])/g, "$1.js$2"));
    }
  }
}

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
    files: [
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/types.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/state.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/session-state.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/skill-registry.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/tool-renderers.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/skill-tools.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/policy-registry.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/policy-tools.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/extension-conflicts.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/diagnostics.ts"),
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/diagnostics-tools.ts"),
    ],
  }, null, 2));
  execFileSync(process.execPath, [path.join(repoRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfigPath], { cwd: repoRoot, stdio: "inherit" });
  await addJsExtensions(outDir);

  const moduleAt = (relativePath) => import(pathToFileURL(path.join(outDir, relativePath)).href);
  const registry = await moduleAt(".pi/extensions/takomi-context-manager/skill-registry.js");
  const renderers = await moduleAt(".pi/extensions/takomi-context-manager/tool-renderers.js");
  const { createState } = await moduleAt(".pi/extensions/takomi-context-manager/state.js");
  const { registerSkillTools } = await moduleAt(".pi/extensions/takomi-context-manager/skill-tools.js");
  const { registerPolicyTools } = await moduleAt(".pi/extensions/takomi-context-manager/policy-tools.js");
  const { registerDiagnostics } = await moduleAt(".pi/extensions/takomi-context-manager/diagnostics-tools.js");
  const codingAgent = await import("@earendil-works/pi-coding-agent");
  const tui = await import("@earendil-works/pi-tui");

  codingAgent.initTheme();
  tui.setKeybindings(new tui.KeybindingsManager({
    ...tui.TUI_KEYBINDINGS,
    "app.tools.expand": { defaultKeys: "ctrl+o", description: "Toggle tool output" },
  }));

  const plainTheme = { fg: (_color, text) => text, bold: (text) => text };
  const loadDirectory = path.join(tempRoot, "loadable");
  const loadPath = path.join(loadDirectory, "SKILL.md");
  await fs.mkdir(loadDirectory);
  await fs.writeFile(loadPath, "# Loadable instructions\n\ncomplete skill instructions\n");

  const skills = [
    { name: "Zulu", description: "Zulu description", category: "Explicit Metadata", packageName: "ignored", location: "/private/skills/path/ignored/SKILL.md", source: "filesystem" },
    { name: "Alpha", description: "Alpha description", location: "/work/skills/Path Taxonomy/alpha/SKILL.md", source: "filesystem" },
    { name: "Able", description: "Able description", location: "/work/skills/Path Taxonomy/able/SKILL.md", source: "filesystem" },
    { name: "Bravo", description: "Bravo description", packageName: "Source Slug", location: "/work/skills/bravo/SKILL.md", source: "filesystem" },
    { name: "Charlie", description: "Charlie description", location: "/work/node_modules/@acme/kit/skills/charlie/SKILL.md", source: "filesystem" },
    { name: "Delta", description: "Delta description", source: "xml" },
    { name: "Loader", description: "Loadable description", category: "Loader", location: loadPath, source: "filesystem" },
  ];
  assert.deepEqual(skills.slice(0, 6).map(registry.skillCategory), ["explicit-metadata", "path-taxonomy", "path-taxonomy", "source-slug", "acme-kit", "uncategorized"], "category precedence must be explicit metadata, path taxonomy, package/source slug, then uncategorized");

  const groups = registry.groupedSkills([...skills].reverse());
  assert.deepEqual(groups.map((group) => group.category), ["acme-kit", "explicit-metadata", "loader", "path-taxonomy", "source-slug", "uncategorized"], "categories must be alphabetized independently of discovery order");
  assert.deepEqual(groups.find((group) => group.category === "path-taxonomy").skills.map((skill) => skill.name), ["Able", "Alpha"], "skills in the same category must be alphabetized");

  const compact = render(renderers.renderCompactCard({
    status: "success",
    title: "Skill index",
    summary: "7 skills across 6 categories",
    metadata: "acme-kit 1 · +5 more categories",
  }, plainTheme));
  assert.match(compact, /✓ Skill index 7 skills across 6 categories/, "compact cards retain status and summary");
  assert.match(compact, /view details/, "compact cards include the configured expansion hint");

  const expanded = render(renderers.renderExpandedMarkdown({
    status: "warning",
    title: "Policy load",
    summary: "1 loaded · 1 unavailable",
    metadata: ["Missing: absent-policy"],
    markdown: "## Complete content\n\ncomplete-model-content",
  }, plainTheme));
  assert.match(expanded, /complete-model-content/, "expanded cards render complete supplied content");

  const state = createState();
  state.skills = new Map(skills.map((skill) => [skill.name.toLowerCase(), skill]));
  state.policies = new Map([
    ["alpha-policy", { name: "alpha-policy", description: "Alpha policy", content: "# Alpha policy\n\ncomplete alpha policy", path: "/private/policies/alpha.md" }],
    ["beta-policy", { name: "beta-policy", description: "Beta policy", content: "# Beta policy\n\ncomplete beta policy", path: "/private/policies/beta.md" }],
  ]);
  const tools = new Map();
  const api = {
    registerTool: (tool) => tools.set(tool.name, tool),
    registerCommand: () => undefined,
    appendEntry: () => undefined,
  };
  registerSkillTools(api, state);
  registerPolicyTools(api, state);
  registerDiagnostics(api, state);
  assert.deepEqual([...tools.keys()].sort(), ["context_report", "policy_load", "policy_manifest", "skill_index", "skill_load", "skill_manifest"], "focused suite registers all six scoped tool surfaces");
  const toolContext = { cwd: tempRoot, sessionManager: { getEntries: () => [] } };

  const skillIndex = tools.get("skill_index");
  const indexResult = await skillIndex.execute("index", {}, undefined, undefined, toolContext);
  assert.equal(indexResult.content[0].text, "Available skills (names only):\n- Able\n- Alpha\n- Bravo\n- Charlie\n- Delta\n- Loader\n- Zulu", "skill_index model-facing content remains the complete alphabetized names-only output");
  const detailJson = JSON.stringify(indexResult.details);
  assert.doesNotMatch(detailJson, /private|filesystem|ignored|"(?:location|packageName|source)"/, "skill_index details contain only the sanitized render projection");
  assert.deepEqual(indexResult.details.groups.find((group) => group.category === "path-taxonomy").skills.map((skill) => skill.name), ["Able", "Alpha"], "sanitized detail skills retain same-category alphabetization");
  const indexCompact = render(skillIndex.renderResult(indexResult, { expanded: false }, plainTheme));
  assert.match(indexCompact, /7 skills across 6 categories/, "skill_index compact renderer shows total and category counts");
  assert.match(indexCompact, /\+3 more categories/, "skill_index compact metadata is bounded with an explicit overflow count");
  const indexExpanded = render(skillIndex.renderResult(indexResult, { expanded: true }, plainTheme));
  assert.match(indexExpanded, /uncategorized 1/, "skill_index expanded metadata remains complete");
  for (const skill of skills) assert.match(indexExpanded, new RegExp(`- ${skill.name}`), "skill_index expanded renderer retains every skill");

  const skillManifest = tools.get("skill_manifest");
  const manifestResult = await skillManifest.execute("manifest", { skills: ["Alpha", "unknown"] }, undefined, undefined, toolContext);
  assert.match(manifestResult.content[0].text, /Skill: Alpha/, "skill_manifest model-facing content retains found details");
  assert.match(manifestResult.content[0].text, /Skill not found: unknown/, "skill_manifest model-facing content retains unavailable details");
  assert.match(render(skillManifest.renderResult(manifestResult, { expanded: false }, plainTheme)), /⚠ Skill manifest 1 found · 1 unavailable/, "skill_manifest compact renderer exposes missing status");
  assert.match(render(skillManifest.renderResult(manifestResult, { expanded: true }, plainTheme)), /Skill not found: unknown/, "skill_manifest expanded renderer retains complete content");

  const skillLoad = tools.get("skill_load");
  const loadResult = await skillLoad.execute("load", { skill: "Loader" }, undefined, undefined, toolContext);
  assert.match(render(skillLoad.renderResult(loadResult, { expanded: false }, plainTheme)), /✓ Loader Loadable description/, "skill_load compact renderer reports a successful load");
  assert.match(render(skillLoad.renderResult(loadResult, { expanded: true }, plainTheme)), /complete skill instructions/, "skill_load expanded renderer retains full loaded instructions");
  const missingLoad = await skillLoad.execute("missing-load", { skill: "missing" }, undefined, undefined, toolContext);
  assert.match(render(skillLoad.renderResult(missingLoad, { expanded: false }, plainTheme)), /✗ Skill load skill not found/, "skill_load compact renderer reports missing skills as errors");
  assert.match(render(skillLoad.renderResult(missingLoad, { expanded: true }, plainTheme)), /Skill not found: missing/, "skill_load expanded renderer retains missing-skill details");

  const policyManifest = tools.get("policy_manifest");
  const policyManifestResult = await policyManifest.execute("policy-manifest", { policies: ["alpha-policy", "missing-policy"] }, undefined, undefined, toolContext);
  assert.match(render(policyManifest.renderResult(policyManifestResult, { expanded: false }, plainTheme)), /⚠ Policy manifest 1 available · 1 unavailable/, "policy_manifest compact renderer reports unavailable policies");
  assert.match(render(policyManifest.renderResult(policyManifestResult, { expanded: true }, plainTheme)), /Policy not found: missing-policy/, "policy_manifest expanded renderer retains complete content");

  const policyLoad = tools.get("policy_load");
  const policyLoadResult = await policyLoad.execute("policy-load", { policies: ["alpha-policy", "missing-policy"] }, undefined, undefined, toolContext);
  assert.match(render(policyLoad.renderResult(policyLoadResult, { expanded: false }, plainTheme)), /⚠ Policy load 1 loaded · 1 unavailable/, "policy_load compact renderer reports partial loads");
  assert.match(render(policyLoad.renderResult(policyLoadResult, { expanded: true }, plainTheme)), /complete alpha policy/, "policy_load expanded renderer retains full policy content");

  const contextReport = tools.get("context_report");
  const healthyProblems = await contextReport.execute("healthy-problems", { mode: "problems" }, undefined, undefined, toolContext);
  assert.match(healthyProblems.content[0].text, /No problems detected/, "context_report preserves requested healthy problems mode for the model");
  assert.match(render(contextReport.renderResult(healthyProblems, { expanded: false }, plainTheme)), /✓ Context health Healthy/, "healthy problems output renders success instead of parsing as informational");
  const healthyExpanded = render(contextReport.renderResult(healthyProblems, { expanded: true }, plainTheme));
  assert.match(healthyExpanded, /Requested mode: problems/, "context_report expanded renderer retains the requested model-facing mode");
  assert.match(healthyExpanded, /Context-manager tool usage/, "context_report expanded renderer provides complete diagnostics");

  state.report.modelRoutingCorrections.push({ toolName: "takomi_subagent", from: "bad-model", to: "approved-model", timestamp: new Date().toISOString() });
  const correctedReport = await contextReport.execute("corrected-report", { mode: "summary" }, undefined, undefined, toolContext);
  assert.equal(correctedReport.details.presentation.attentionCount, 1, "structured context_report attention count includes model-routing corrections");
  assert.equal(correctedReport.details.presentation.status, "warning", "structured context_report status includes model-routing corrections");
  assert.match(render(contextReport.renderResult(correctedReport, { expanded: false }, plainTheme)), /1 attention items/, "context_report compact metadata uses structured attention counts");

  console.log("✓ context-manager renderer checks passed");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.rm(outDir, { recursive: true, force: true });
}
