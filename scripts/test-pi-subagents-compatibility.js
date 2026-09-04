import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(
  root,
  ".pi",
  "extensions",
  "takomi-subagents",
  "pi-subagents-compatibility.json",
);
const adapterPath = path.join(root, ".pi", "extensions", "takomi-subagents", "pi-subagents-internal.ts");
const packagePath = path.join(root, "package.json");
const cliPath = path.join(root, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js");
const extensionPath = path.join(root, ".pi", "extensions", "takomi-subagents", "index.ts");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const adapterSource = await readFile(adapterPath, "utf8");

assert.equal(manifest.schemaVersion, 1);
assert.equal(packageJson.dependencies["pi-subagents"], manifest.piSubagentsVersion);
for (const packageName of [
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
]) {
  assert.equal(packageJson.devDependencies[packageName], manifest.piVersion, `${packageName} must be exact`);
}

assert.ok(Array.isArray(manifest.privateModules) && manifest.privateModules.length > 0);
for (const entry of manifest.privateModules) {
  assert.match(entry.specifier, /^pi-subagents\/.+\.ts$/);
  assert.ok(Array.isArray(entry.requiredExports) && entry.requiredExports.length > 0);
  const adapterSpecifier = entry.specifier.replace(/^pi-subagents\//, "").replace(/\.ts$/, "");
  assert.ok(adapterSource.includes(`spec("${adapterSpecifier}")`), `${entry.specifier} is not loaded by the adapter`);
  for (const exportName of entry.requiredExports) {
    assert.ok(adapterSource.includes(exportName), `${entry.specifier} does not validate ${exportName}`);
  }
}

const child = spawn(
  process.execPath,
  [
    cliPath,
    "--mode",
    "rpc",
    "--no-session",
    "--no-extensions",
    "--extension",
    extensionPath,
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-context-files",
    "--offline",
    "--approve",
  ],
  {
    cwd: root,
    env: { ...process.env, PI_OFFLINE: "1", NO_COLOR: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  },
);

let stdout = "";
let stderr = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout += chunk;
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const response = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Pi compatibility probe timed out\n${stderr}`)), 20_000);
  const inspect = () => {
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        if (message.type === "response" && message.command === "get_state") {
          clearTimeout(timeout);
          resolve(message);
          return;
        }
      } catch {
        // Pi may emit non-protocol startup diagnostics; keep waiting for the RPC response.
      }
    }
  };
  child.stdout.on("data", inspect);
  child.once("exit", (code) => {
    clearTimeout(timeout);
    reject(new Error(`Pi compatibility probe exited with ${code}\n${stderr}`));
  });
});

child.stdin.write(`${JSON.stringify({ type: "get_state" })}\n`);
try {
  const message = await response;
  assert.equal(message.success, true, stderr);
} finally {
  child.kill();
}

console.log(
  `pi-subagents ${manifest.piSubagentsVersion} private API is compatible with Pi ${manifest.piVersion}`,
);
