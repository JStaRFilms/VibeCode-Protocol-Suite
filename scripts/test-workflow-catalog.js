#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  path.join(repoRoot, "src", "pi-takomi-core", "types.ts"),
  path.join(repoRoot, "src", "pi-takomi-core", "workflows.ts"),
  path.join(repoRoot, ".pi", "extensions", "takomi-runtime", "workflow-catalog.ts"),
];
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-workflow-catalog-test-"));
const outDir = path.join(repoRoot, ".tmp", `workflow-catalog-${process.pid}`);
const tsconfigPath = path.join(tempRoot, "tsconfig.json");

function text(payload) {
  return payload.content.map((part) => part.text).join("\n");
}

try {
  await fs.writeFile(tsconfigPath, JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "CommonJS",
      moduleResolution: "Node",
      ignoreDeprecations: "6.0",
      strict: true,
      skipLibCheck: true,
      types: ["node"],
      noEmit: false,
      rootDir: repoRoot,
      outDir,
    },
    files: sourceFiles,
  }, null, 2));
  execFileSync(process.execPath, [path.join(repoRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfigPath], { cwd: repoRoot, stdio: "inherit" });

  await fs.writeFile(path.join(outDir, "package.json"), '{"type":"commonjs"}');
  const workflows = require(path.join(outDir, "src", "pi-takomi-core", "workflows.js"));
  const adapters = require(path.join(outDir, ".pi", "extensions", "takomi-runtime", "workflow-catalog.js"));
  const catalog = workflows.listWorkflowCatalog();
  const embeddedIds = catalog.filter((workflow) => workflow.availability === "embedded").map((workflow) => workflow.id);
  const definitionIds = workflows.listWorkflowDefinitions().map((workflow) => workflow.id);

  assert.deepEqual(definitionIds, embeddedIds, "every embedded workflow definition is represented by the canonical catalog");
  assert.deepEqual(Object.keys(workflows.WORKFLOWS), embeddedIds, "the embedded workflow map covers every canonical embedded workflow ID");

  const discovery = adapters.discoverWorkflowPlaybooks();
  const board = adapters.showWorkflowCatalogForBoard();
  assert.deepEqual(discovery.details.workflows.map((workflow) => workflow.id), embeddedIds, "workflow discovery exposes every canonical embedded workflow ID");
  assert.deepEqual(board.details.workflows.map((workflow) => workflow.id), embeddedIds, "board show_workflows exposes every canonical embedded workflow ID");

  for (const entry of catalog) {
    const definition = workflows.getWorkflowDefinition(entry.id);
    assert.equal(definition.title, entry.name, `${entry.id} definition name derives from catalog`);
    assert.equal(definition.stage, entry.stage, `${entry.id} definition stage derives from catalog`);
    assert.equal(definition.purpose, entry.description, `${entry.id} definition description derives from catalog`);
    for (const payload of [discovery, board]) {
      const output = text(payload);
      assert.match(output, new RegExp(entry.id.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")), `${entry.id} is present in catalog payload`);
      assert.ok(output.includes(entry.name), `${entry.id} catalog payload uses canonical name`);
      assert.ok(output.includes(entry.stage), `${entry.id} catalog payload uses canonical stage`);
      assert.ok(output.includes(entry.description), `${entry.id} catalog payload uses canonical description`);
      assert.ok(output.includes(`[${entry.availability}]`), `${entry.id} catalog payload uses canonical availability`);
    }

    const loaded = adapters.discoverWorkflowPlaybooks(entry.id);
    assert.equal(loaded.details.id, entry.id, `${entry.id} direct discovery loads the requested playbook`);
    assert.ok(text(loaded).includes(definition.playbook), `${entry.id} direct discovery returns its complete playbook`);
  }

  assert.doesNotMatch(text(board), /fallback summary:/i, "board catalog stays compact and does not duplicate playbooks");
  console.log("✓ workflow catalog is canonical, complete, and separately framed by workflow and board APIs");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.rm(outDir, { recursive: true, force: true });
}
