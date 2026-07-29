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

function assertSafePresentation(component, label) {
  for (const width of [40, 60]) {
    const output = render(component, width);
    assert.doesNotMatch(output, /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]|\x1B/, `${label} must remove terminal controls at ${width} columns`);
  }
}

async function snapshotTree(root, relative = "") {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const snapshot = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryRelative = path.join(relative, entry.name);
    const entryPath = path.join(root, entryRelative);
    const stats = await fs.stat(entryPath);
    snapshot.push(`${entry.isDirectory() ? "dir" : "file"}:${entryRelative}:${stats.size}:${stats.mtimeMs}`);
    if (entry.isDirectory()) snapshot.push(...await snapshotTree(root, entryRelative));
    else snapshot.push((await fs.readFile(entryPath)).toString("base64"));
  }
  return snapshot;
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
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/model-policy-gate.ts"),
    ],
  }, null, 2));
  execFileSync(process.execPath, [path.join(repoRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfigPath], { cwd: repoRoot, stdio: "inherit" });
  await addJsExtensions(outDir);
  await fs.mkdir(path.join(outDir, "src"), { recursive: true });
  await Promise.all([
    fs.copyFile(path.join(repoRoot, "src", "skills-catalog.js"), path.join(outDir, "src", "skills-catalog.js")),
    fs.copyFile(path.join(repoRoot, "src", "utils.js"), path.join(outDir, "src", "utils.js")),
    fs.copyFile(
      path.join(repoRoot, ".pi/extensions/takomi-context-manager/skill-categories.js"),
      path.join(outDir, ".pi/extensions/takomi-context-manager/skill-categories.js"),
    ),
  ]);

  const moduleAt = (relativePath) => import(pathToFileURL(path.join(outDir, relativePath)).href);
  const catalog = await moduleAt("src/skills-catalog.js");
  const registry = await moduleAt(".pi/extensions/takomi-context-manager/skill-registry.js");
  const renderers = await moduleAt(".pi/extensions/takomi-context-manager/tool-renderers.js");
  const { createState } = await moduleAt(".pi/extensions/takomi-context-manager/state.js");
  const { registerSkillTools } = await moduleAt(".pi/extensions/takomi-context-manager/skill-tools.js");
  const { registerPolicyTools } = await moduleAt(".pi/extensions/takomi-context-manager/policy-tools.js");
  const { registerDiagnostics } = await moduleAt(".pi/extensions/takomi-context-manager/diagnostics-tools.js");
  const { installModelPolicyGate } = await moduleAt(".pi/extensions/takomi-context-manager/model-policy-gate.js");
  const codingAgent = await import("@earendil-works/pi-coding-agent");
  const tui = await import("@earendil-works/pi-tui");

  codingAgent.initTheme();
  tui.setKeybindings(new tui.KeybindingsManager({
    ...tui.TUI_KEYBINDINGS,
    "app.tools.expand": { defaultKeys: "ctrl+o", description: "Toggle tool output" },
  }));

  const plainTheme = { fg: (_color, text) => text, bold: (text) => text };

  // Exercise the normal Pi path with Pi's real Skill fields and an upgrade-era
  // manifest whose owned entries predate persisted categories.
  const legacyHome = path.join(tempRoot, "legacy-home");
  const legacyRoot = path.join(legacyHome, ".agents", "skills");
  const legacyTakomiHome = path.join(legacyHome, ".takomi");
  const categorizedNames = [...new Set(catalog.SKILL_CATEGORIES.flatMap((category) => category.skills))];
  assert.ok(categorizedNames.length >= 88, "tracked installer taxonomy must cover the realistic 88-skill fixture");
  const legacyNames = categorizedNames.slice(0, 88);
  const legacyOwned = {};
  const piSkills = [];
  for (const [index, name] of legacyNames.entries()) {
    const directory = path.join(legacyRoot, name);
    const filePath = path.join(directory, "SKILL.md");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(filePath, `---\nname: ${name}\ndescription: Real Pi fixture ${index + 1}\n---\n`);
    legacyOwned[name] = index === 0 ? `legacy-hash-${index}` : {
      name,
      hash: `legacy-hash-${index}`,
      targetPath: directory,
      installedAt: "2026-06-10T00:00:00.000Z",
      takomiVersion: "2.1.43",
    };
    piSkills.push({
      name,
      description: `Real Pi fixture ${index + 1}`,
      filePath,
      baseDir: directory,
      sourceInfo: { path: filePath, source: "local", scope: "user", origin: "top-level", baseDir: directory },
      disableModelInvocation: false,
      ...(index === 0 ? { category: "explicit-upgrade-category" } : {}),
      ...(index === 1 ? { installerCategory: "explicit-source-category" } : {}),
    });
  }
  const staleName = categorizedNames[88];
  legacyOwned[staleName] = {
    name: staleName,
    hash: "stale-hash",
    targetPath: path.join(legacyRoot, "stale-manifest-target"),
    installedAt: "2026-06-10T00:00:00.000Z",
    takomiVersion: "2.1.43",
  };
  await fs.mkdir(legacyTakomiHome, { recursive: true });
  const legacyManifestPath = path.join(legacyTakomiHome, "skills-manifest.json");
  await fs.writeFile(legacyManifestPath, JSON.stringify({
    schemaVersion: 2,
    takomiVersion: "2.1.43",
    targetRoot: legacyRoot,
    mode: "all",
    selectedSkills: legacyNames,
    owned: legacyOwned,
  }, null, 2));

  const legacyTreeBeforeRuntime = await snapshotTree(legacyHome);
  const collectedPiSkills = registry.collectSkillsFromOptions({ skills: piSkills });
  assert.equal(collectedPiSkills.length, 88, "real Pi Skill[] options must expose all 88 flat global skills");
  assert.equal(collectedPiSkills[0].location, piSkills[0].filePath, "real Pi filePath must become the canonical registry location");
  const enrichedPiSkills = await registry.enrichSkillsWithInstallerTaxonomy(collectedPiSkills, { home: legacyHome, takomiHome: legacyTakomiHome });
  assert.equal(enrichedPiSkills.filter((skill) => skill.sourceCategory).length, 88, "legacy owned entries without categories must receive tracked catalog taxonomy at runtime");
  assert.equal(enrichedPiSkills[2].sourceCategory, catalog.getSkillCategory(enrichedPiSkills[2].name), "legacy fallback must come from canonical tracked SKILL_CATEGORIES");
  assert.equal(registry.skillCategory(enrichedPiSkills[0]), "explicit-upgrade-category", "explicit category metadata must outrank legacy catalog enrichment");
  assert.equal(registry.skillCategory(enrichedPiSkills[1]), "explicit-source-category", "Pi-supplied source taxonomy must not be overwritten by manifest fallback");
  assert.equal(registry.groupedSkills(enrichedPiSkills).some((group) => group.category === "uncategorized"), false, "88 legacy-owned flat skills must not collapse into uncategorized");

  const staleRecord = registry.collectSkillsFromOptions({ skills: [{
    name: staleName,
    description: "Stale ownership path",
    filePath: path.join(legacyRoot, staleName, "SKILL.md"),
    baseDir: path.join(legacyRoot, staleName),
    sourceInfo: { path: path.join(legacyRoot, staleName, "SKILL.md"), source: "local", scope: "user", origin: "top-level" },
    disableModelInvocation: false,
  }] });
  const descendantRecord = [{ ...staleRecord[0], location: path.join(legacyRoot, "stale-manifest-target", "nested", "SKILL.md") }];
  const mismatchedRecord = [{ ...staleRecord[0], location: piSkills[2].filePath }];
  assert.equal((await registry.enrichSkillsWithInstallerTaxonomy(staleRecord, { home: legacyHome, takomiHome: legacyTakomiHome }))[0].sourceCategory, undefined, "stale manifest targetPath must not enrich a different current path");
  assert.equal((await registry.enrichSkillsWithInstallerTaxonomy(descendantRecord, { home: legacyHome, takomiHome: legacyTakomiHome }))[0].sourceCategory, undefined, "manifest ownership must not extend to descendant or similarly prefixed paths");
  assert.equal((await registry.enrichSkillsWithInstallerTaxonomy(mismatchedRecord, { home: legacyHome, takomiHome: legacyTakomiHome }))[0].sourceCategory, undefined, "matching another owned skill path must not transfer taxonomy between names");
  assert.deepEqual(await snapshotTree(legacyHome), legacyTreeBeforeRuntime, "runtime taxonomy enrichment must not write the manifest, installed skills, or any new files");

  // Mirror a real `takomi setup skills` layout: flat global SKILL.md folders
  // plus the installer-owned registry under ~/.takomi.
  const installedHome = path.join(tempRoot, "installed-home");
  const installedRoot = path.join(installedHome, ".agents", "skills");
  const installedFixtures = [
    { name: "frontend-design", description: "Installed frontend skill", category: "frontend" },
    { name: "security-audit", description: "Installed security skill", category: "security" },
    { name: "takomi", description: "Explicit metadata wins", category: "core", explicitCategory: "frontmatter-override" },
  ];
  for (const fixture of installedFixtures) {
    const directory = path.join(installedRoot, fixture.name);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "SKILL.md"), [
      "---",
      `name: ${fixture.name}`,
      `description: ${fixture.description}`,
      ...(fixture.explicitCategory ? [`category: ${fixture.explicitCategory}`] : []),
      "---",
      "",
      `# ${fixture.name}`,
    ].join("\n"));
  }
  const manualDirectory = path.join(installedRoot, "manual-flat-skill");
  await fs.mkdir(manualDirectory, { recursive: true });
  await fs.writeFile(path.join(manualDirectory, "SKILL.md"), "---\nname: manual-flat-skill\ndescription: Unmanaged flat skill\n---\n");
  const installerOwned = Object.fromEntries(installedFixtures.map((fixture) => [fixture.name, {
    name: fixture.name,
    hash: `fixture-${fixture.name}`,
    targetPath: path.join(installedRoot, fixture.name),
    installedAt: "2026-07-13T00:00:00.000Z",
    takomiVersion: "2.1.44",
    category: fixture.category,
  }]));
  const takomiHome = path.join(installedHome, ".takomi");
  await fs.mkdir(takomiHome, { recursive: true });
  await fs.writeFile(path.join(takomiHome, "skills-manifest.json"), JSON.stringify({
    schemaVersion: 2,
    takomiVersion: "2.1.44",
    targetRoot: installedRoot,
    mode: "custom",
    selectedSkills: installedFixtures.map((fixture) => fixture.name),
    owned: installerOwned,
  }));
  const discoveredFixtureSkills = await registry.discoverSkillsFromFilesystem(path.join(tempRoot, "fixture-project"), { home: installedHome, takomiHome });
  const installedSkills = discoveredFixtureSkills.filter((skill) => skill.location?.startsWith(installedRoot));
  const installedGroups = registry.groupedSkills(installedSkills);
  assert.deepEqual(
    installedGroups.map((group) => [group.category, group.skills.map((skill) => skill.name)]),
    [
      ["frontend", ["frontend-design"]],
      ["frontmatter-override", ["takomi"]],
      ["security", ["security-audit"]],
      ["uncategorized", ["manual-flat-skill"]],
    ],
    "flat global skills must use path-bound installer taxonomy while explicit and unmanaged skills preserve precedence",
  );

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
  assert.deepEqual(skills.slice(0, 6).map(registry.skillCategory), ["explicit-metadata", "path-taxonomy", "path-taxonomy", "source-slug", "acme-kit", "uncategorized"], "category fallback must remain explicit metadata, path taxonomy, package/source slug, then uncategorized");
  assert.equal(registry.skillCategory({ name: "Source metadata", sourceCategory: "Installer Taxonomy", location: "/work/skills/path-taxonomy/source/SKILL.md", packageName: "package-fallback", source: "filesystem" }), "installer-taxonomy", "installer/source taxonomy must precede path and package metadata");
  assert.equal(registry.skillCategory({ name: "Explicit metadata", category: "Explicit", sourceCategory: "Installer", location: "/work/skills/path/source/SKILL.md", source: "filesystem" }), "explicit", "explicit metadata must precede installer/source taxonomy");

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
  const commands = new Map();
  const api = {
    registerTool: (tool) => tools.set(tool.name, tool),
    registerCommand: (name, command) => commands.set(name, command),
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
  for (const width of [40, 60, 120]) {
    const responsiveIndex = render(skillIndex.renderResult(indexResult, { expanded: false }, plainTheme), width);
    assert.ok(responsiveIndex.split("\n").every((line) => line.length <= width), `skill_index compact output must fit ${width} columns`);
    if (width < 80) {
      assert.doesNotMatch(responsiveIndex, /acme-kit 1 · explicit-metadata 1/, `skill_index category metadata must stack below the threshold at ${width} columns`);
      assert.match(responsiveIndex, /^acme-kit 1\s*$/m, `skill_index keeps the first category legible at ${width} columns`);
    } else {
      assert.match(responsiveIndex, /acme-kit 1 · explicit-metadata 1/, "skill_index category metadata stays compact on wide terminals");
    }
  }
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
  assert.match(healthyExpanded, /Takomi Context Problems/, "expanded problems mode renders the problems report");
  assert.doesNotMatch(healthyExpanded, /Context-manager tool usage|Prompt rewrite|File ledger/, "expanded problems mode does not promote the request to verbose content");

  state.report.modelRoutingCorrections.push({ toolName: "takomi_subagent", from: "bad-model", to: "approved-model", timestamp: new Date().toISOString() });
  const correctedReport = await contextReport.execute("corrected-report", { mode: "summary" }, undefined, undefined, toolContext);
  assert.equal(correctedReport.details.presentation.attentionCount, 1, "structured context_report attention count includes model-routing corrections");
  assert.equal(correctedReport.details.presentation.status, "warning", "structured context_report status includes model-routing corrections");
  assert.match(render(contextReport.renderResult(correctedReport, { expanded: false }, plainTheme)), /1 attention items/, "context_report compact metadata uses structured attention counts");
  const summaryExpanded = render(contextReport.renderResult(correctedReport, { expanded: true }, plainTheme));
  assert.match(summaryExpanded, /Requested mode: summary/, "expanded summary identifies the requested mode");
  assert.match(summaryExpanded, /Overview/, "expanded summary retains summary-appropriate overview content");
  assert.doesNotMatch(summaryExpanded, /Context-manager tool usage|Context-manager file ledger/, "expanded summary does not include verbose-only sections");
  assert.equal(correctedReport.content[0].text.includes("Context-manager tool usage"), false, "summary model-facing content remains summary-only");

  const verboseReport = await contextReport.execute("verbose-report", { mode: "verbose" }, undefined, undefined, toolContext);
  const verboseExpanded = render(contextReport.renderResult(verboseReport, { expanded: true }, plainTheme));
  assert.match(verboseExpanded, /Requested mode: verbose/, "expanded verbose identifies the requested mode");
  assert.match(verboseExpanded, /Context-manager tool usage/, "expanded verbose retains the full report");
  assert.match(verboseReport.content[0].text, /Context-manager tool usage/, "verbose model-facing content remains the full requested report");

  const terminalPayload = "\x1B[31mred\x1B[0m\x1B]8;;https://example.invalid\x07link\x1B]8;;\x07\x00\x08";
  const markdownPayload = `## Markdown heading\n\n**bold markdown** ${terminalPayload}`;
  assert.equal(
    renderers.sanitizePresentation(markdownPayload),
    "## Markdown heading\n\n**bold markdown** redlink",
    "the shared presentation sanitizer must remove ANSI, OSC, and unsafe C0 controls while retaining Markdown syntax",
  );

  const unsafeSkillName = `Unsafe skill ${terminalPayload}`;
  const unsafeMissingSkill = `Missing skill ${terminalPayload}`;
  state.skills.set(registry.normalizeName(unsafeSkillName), {
    name: unsafeSkillName,
    description: `Unsafe description ${terminalPayload}`,
    location: `/unsafe/${terminalPayload}/SKILL.md`,
    source: "filesystem",
  });
  const unsafeSkillIndex = await skillIndex.execute("unsafe-index", {}, undefined, undefined, toolContext);
  assert.ok(unsafeSkillIndex.content[0].text.includes(terminalPayload), "skill_index model-facing content must retain raw names");
  const unsafeSkillManifest = await skillManifest.execute("unsafe-manifest", { skills: [unsafeSkillName, unsafeMissingSkill] }, undefined, undefined, toolContext);
  assert.ok(unsafeSkillManifest.content[0].text.includes(terminalPayload), "skill_manifest model-facing names, descriptions, locations, and missing metadata must remain unchanged");
  const unsafeSkillLoadResult = {
    content: [{ type: "text", text: `Skill: ${unsafeSkillName}\nLocation: /unsafe/${terminalPayload}/SKILL.md\n\n${markdownPayload}` }],
    details: {
      found: true,
      skill: unsafeSkillName,
      description: `Unsafe description ${terminalPayload}`,
      location: `/unsafe/${terminalPayload}/SKILL.md`,
      lineCount: 4,
    },
  };

  const unsafePolicyName = `Unsafe policy ${terminalPayload}`;
  const unsafeMissingPolicy = `Missing policy ${terminalPayload}`;
  state.policies.set(registry.normalizeName(unsafePolicyName), {
    name: unsafePolicyName,
    description: `Unsafe policy description ${terminalPayload}`,
    content: markdownPayload,
    path: `/unsafe/${terminalPayload}.md`,
  });
  const unsafePolicyManifest = await policyManifest.execute("unsafe-policy-manifest", { policies: [unsafePolicyName, unsafeMissingPolicy] }, undefined, undefined, toolContext);
  const unsafePolicyLoad = await policyLoad.execute("unsafe-policy-load", { policies: [unsafePolicyName, unsafeMissingPolicy] }, undefined, undefined, toolContext);
  assert.ok(unsafePolicyManifest.content[0].text.includes(terminalPayload), "policy_manifest model-facing metadata must remain unchanged");
  assert.ok(unsafePolicyLoad.content[0].text.includes(terminalPayload), "policy_load model-facing content must remain unchanged");

  state.report.promptRewrite.warnings.push(`Unsafe diagnostic ${terminalPayload}`);
  state.report.blockedActions.push({
    toolName: `unsafe-tool ${terminalPayload}`,
    reason: `Unsafe diagnostic reason ${terminalPayload}`,
    timestamp: new Date().toISOString(),
  });
  const unsafeContextReport = await contextReport.execute("unsafe-context-report", { mode: "verbose" }, undefined, undefined, toolContext);
  assert.ok(unsafeContextReport.content[0].text.includes(terminalPayload), "context_report model-facing diagnostics must remain unchanged");

  const commandNotifications = [];
  await commands.get("context-report").handler("verbose", {
    ...toolContext,
    ui: { notify: (message, level) => commandNotifications.push({ message, level }) },
  });
  assert.equal(commandNotifications.length, 1, "the registered /context-report command must notify once");
  assert.equal(commandNotifications[0].level, "info", "the registered /context-report command retains its information level");
  assert.doesNotMatch(commandNotifications[0].message, /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]|\x1B/, "the registered /context-report command notification must remove terminal controls");
  assert.match(commandNotifications[0].message, /Unsafe diagnostic redlink/, "the registered /context-report command notification retains printable diagnostic text");

  const callCases = [
    ["skill_index call", skillIndex.renderCall({}, plainTheme)],
    ["skill_manifest call", skillManifest.renderCall({ skills: [unsafeSkillName] }, plainTheme)],
    ["skill_load call", skillLoad.renderCall({ skill: unsafeSkillName }, plainTheme)],
    ["policy_manifest call", policyManifest.renderCall({ policies: [unsafePolicyName] }, plainTheme)],
    ["policy_load call", policyLoad.renderCall({ policies: [unsafePolicyName] }, plainTheme)],
    ["context_report call", contextReport.renderCall({ mode: terminalPayload }, plainTheme)],
  ];
  for (const [label, component] of callCases) assertSafePresentation(component, label);

  const resultCases = [
    ["skill_index compact", skillIndex.renderResult(unsafeSkillIndex, { expanded: false }, plainTheme)],
    ["skill_index expanded", skillIndex.renderResult(unsafeSkillIndex, { expanded: true }, plainTheme)],
    ["skill_manifest compact", skillManifest.renderResult(unsafeSkillManifest, { expanded: false }, plainTheme)],
    ["skill_manifest expanded", skillManifest.renderResult(unsafeSkillManifest, { expanded: true }, plainTheme)],
    ["skill_load compact", skillLoad.renderResult(unsafeSkillLoadResult, { expanded: false }, plainTheme)],
    ["skill_load expanded", skillLoad.renderResult(unsafeSkillLoadResult, { expanded: true }, plainTheme)],
    ["policy_manifest compact", policyManifest.renderResult(unsafePolicyManifest, { expanded: false }, plainTheme)],
    ["policy_manifest expanded", policyManifest.renderResult(unsafePolicyManifest, { expanded: true }, plainTheme)],
    ["policy_load compact", policyLoad.renderResult(unsafePolicyLoad, { expanded: false }, plainTheme)],
    ["policy_load expanded", policyLoad.renderResult(unsafePolicyLoad, { expanded: true }, plainTheme)],
    ["context_report compact", contextReport.renderResult(unsafeContextReport, { expanded: false }, plainTheme)],
    ["context_report expanded", contextReport.renderResult(unsafeContextReport, { expanded: true }, plainTheme)],
  ];
  for (const [label, component] of resultCases) assertSafePresentation(component, label);
  for (const width of [40, 60]) {
    const expandedLoad = render(skillLoad.renderResult(unsafeSkillLoadResult, { expanded: true }, plainTheme), width);
    assert.match(expandedLoad, /Markdown heading/, `skill_load Markdown heading must remain functional at ${width} columns`);
    assert.match(expandedLoad, /bold markdown/, `skill_load Markdown emphasis content must remain functional at ${width} columns`);
  }

  const maliciousPolicyModel = `oauth-router/gpt-5.5${terminalPayload}`;
  const maliciousRequestedModel = `openai-codex/gpt-5.5${terminalPayload}`;
  const maliciousUnapprovedModel = `unapproved-provider/not-real${terminalPayload}-unapproved`;
  const gateProject = path.join(tempRoot, "model-policy-gate");
  await fs.mkdir(path.join(gateProject, ".pi"), { recursive: true });
  await fs.writeFile(path.join(gateProject, ".pi", "settings.json"), JSON.stringify({
    takomi: { routing: { approvedModels: [maliciousPolicyModel] } },
  }));
  const gateHandlers = new Map();
  const gateState = createState();
  installModelPolicyGate({
    on: (event, handler) => gateHandlers.set(event, handler),
    appendEntry: () => undefined,
  }, gateState);
  const gateNotifications = [];
  const gateSelections = [];
  const gateContext = {
    cwd: gateProject,
    ui: {
      select: async (title, options) => {
        gateSelections.push({ title, options });
        return options.find((option) => option.includes("oauth-router/gpt-5.5redlink"));
      },
      notify: (message, level) => gateNotifications.push({ message, level }),
    },
  };
  const toolCall = gateHandlers.get("tool_call");
  const explicitlyRecoveredInput = { model: maliciousRequestedModel };
  await toolCall({ toolName: "takomi_subagent", input: explicitlyRecoveredInput }, gateContext);
  assert.equal(explicitlyRecoveredInput.model, maliciousPolicyModel, "cross-provider change occurs only after the user selects the exact approved model ID");
  assert.equal(gateSelections.length, 1, "same-family cross-provider requests require explicit recovery selection");
  assert.equal(gateState.report.modelRoutingCorrections.at(-1).from, maliciousRequestedModel, "correction reporting retains the exact raw requested model ID");
  assert.equal(gateState.report.modelRoutingCorrections.at(-1).to, maliciousPolicyModel, "correction reporting retains the exact raw approved model ID");
  assert.doesNotMatch(gateNotifications.at(-1).message, /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]|\x1B/, "model correction notification must remove ANSI, OSC, and C0 controls");
  assert.match(gateNotifications.at(-1).message, /openai-codex\/gpt-5.5redlink -> oauth-router\/gpt-5.5redlink/, "explicit model-change notification retains printable model labels");

  const recoveredInput = { model: maliciousUnapprovedModel };
  await toolCall({ toolName: "takomi_subagent", input: recoveredInput }, gateContext);
  assert.equal(recoveredInput.model, maliciousPolicyModel, "recovery selection must map its sanitized label back to the raw approved model ID");
  assert.doesNotMatch(gateSelections.at(-1).title, /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]|\x1B/, "recovery title must remove ANSI, OSC, and C0 controls");
  assert.ok(gateSelections.at(-1).options.every((option) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]|\x1B/.test(option)), "recovery options must remove ANSI, OSC, and C0 controls");
  assert.equal(gateState.report.modelRoutingCorrections.at(-1).from, maliciousUnapprovedModel, "recovery report retains the exact raw requested model ID");
  assert.equal(gateState.report.modelRoutingCorrections.at(-1).to, maliciousPolicyModel, "recovery report retains the exact raw approved model ID");

  const toolResult = gateHandlers.get("tool_result");
  const failureRecovery = await toolResult({ toolName: "takomi_subagent", isError: true, content: "unknown provider" }, gateContext);
  assert.ok(gateSelections.at(-1).options.every((option) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]|\x1B/.test(option)), "failure recovery options must remove ANSI, OSC, and C0 controls");
  assert.match(failureRecovery.content[0].text, new RegExp(maliciousPolicyModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "failure recovery guidance keeps the raw selected model ID for routing");

  console.log("✓ context-manager renderer checks passed");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.rm(outDir, { recursive: true, force: true });
}
