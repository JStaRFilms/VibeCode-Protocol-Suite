#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPath, copyOwnedTree } from '../src/owned-tree.js';
import { collectTakomiStats } from '../src/takomi-stats.js';
import { collectTakomiStats as collectRuntimeTakomiStats } from '../.pi/extensions/takomi-runtime/takomi-stats.js';
import { getSourceCheckoutLaunchArgs } from '../src/pi-harness.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-regression-test-'));

try {
  const packageJson = await fs.readJson(path.join(repoRoot, 'package.json'));
  assert.ok(!packageJson.files.includes('plugins'), 'npm package allowlist must not include the entire plugins tree because nested pnpm node_modules contain hard links rejected by npm');
  assert.ok(packageJson.files.includes('plugins/takomi-flow/scripts'), 'npm package retains Takomi Flow runtime scripts through explicit allowlisting');

  const cli = path.join(repoRoot, 'bin', 'takomi.js');
  const env = {
    ...process.env,
    TAKOMI_HOME_DIR: path.join(tempRoot, '.takomi'),
    TAKOMI_STORE_PATH: path.join(tempRoot, '.takomi'),
    TAKOMI_SKILLS_ROOT: path.join(tempRoot, '.agents', 'skills'),
    NO_COLOR: '1',
  };

  const { stdout } = await execFileAsync(process.execPath, [cli, 'sync', 'not-a-target'], { cwd: repoRoot, env });
  assert.match(stdout, /Unsupported sync target: not-a-target/, 'legacy sync alias should route to sync handling');
  assert.doesNotMatch(stdout, /Unsupported upgrade target/, 'legacy sync alias must not route to upgrade/refresh handling');

  const sourceLaunchArgs = getSourceCheckoutLaunchArgs(repoRoot);
  assert.ok(sourceLaunchArgs.includes('--no-extensions'), 'source checkout launch must disable duplicate global extension discovery');
  assert.equal(sourceLaunchArgs.filter((arg) => arg === '--extension').length, 6, 'source checkout launch must explicitly load every project Takomi extension once');
  assert.ok(sourceLaunchArgs.some((arg) => arg.endsWith(path.join('antigravity-provider', 'index.ts'))), 'source checkout launch must include the Antigravity provider');
  assert.deepEqual(getSourceCheckoutLaunchArgs(tempRoot), [], 'ordinary projects must retain normal global extension discovery');

  const tree = path.join(tempRoot, 'tree');
  const outside = path.join(tempRoot, 'outside-secret.txt');
  await fs.ensureDir(tree);
  await fs.writeFile(path.join(tree, 'owned.txt'), 'owned');
  await fs.writeFile(outside, 'secret-v1');
  const link = path.join(tree, 'outside-link');
  let symlinkCreated = false;
  try {
    await fs.symlink(outside, link);
    symlinkCreated = true;
  } catch (error) {
    if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error;
    console.log('↷ skipped symlink hash assertion on this platform');
  }
  if (symlinkCreated) {
    const first = await hashPath(tree);
    await fs.writeFile(outside, 'secret-v2');
    const second = await hashPath(tree);
    assert.equal(first, second, 'hashPath must not follow symlinks outside the tree');
    await assert.rejects(() => copyOwnedTree(tree, path.join(tempRoot, 'copied-tree')), /Refusing to copy symlink/, 'managed copy should fail loudly on symlinks');
  }

  const statsHome = path.join(tempRoot, 'stats-home');
  const statsCwd = path.join(tempRoot, 'stats-project');
  const sessionsDir = path.join(statsHome, '.pi', 'agent', 'sessions');
  await fs.ensureDir(sessionsDir);
  await fs.writeFile(path.join(sessionsDir, 'session.jsonl'), [
    JSON.stringify({ type: 'session', id: 's1', cwd: statsCwd, timestamp: '2026-01-01T00:00:00.000Z' }),
    '{bad json}',
    JSON.stringify({ type: 'message', timestamp: '2026-01-01T00:00:01.000Z', message: { role: 'user', content: [{ type: 'text', text: 'hello' }] } }),
    JSON.stringify({ type: 'message', timestamp: '2026-01-01T00:00:02.000Z', message: { role: 'assistant', model: 'gpt-5.4', usage: { input: 10, cacheRead: 2, output: 3, totalTokens: 15 }, content: [{ type: 'toolCall', name: 'takomi_subagent', arguments: { tasks: [{}, {}] } }] } }),
  ].join('\r\n'));
  const stats = await collectTakomiStats({ home: statsHome, cwd: statsCwd });
  assert.equal(stats.totals.input, 10, 'stats streaming should preserve usage parsing');
  assert.equal(stats.totals.toolCalls, 1, 'stats streaming should preserve tool call counting');
  assert.equal(stats.mostSubagentsSession.subagentCalls, 2, 'stats streaming should preserve subagent task counting');

  await fs.writeFile(path.join(sessionsDir, 'gpt-5-6-pricing.jsonl'), [
    JSON.stringify({ type: 'model_change', timestamp: '2026-07-29T23:59:58.000Z', modelId: 'gpt-5.6-luna' }),
    JSON.stringify({ type: 'message', timestamp: '2026-07-29T23:59:59.000Z', message: { role: 'assistant', model: 'gpt-5.6-luna', usage: { input: 1_000_000, output: 0 }, content: [] } }),
    JSON.stringify({ type: 'message', timestamp: '2026-07-30T00:00:00.000Z', message: { role: 'assistant', model: 'gpt-5.6-luna', usage: { input: 1_000_000, output: 0 }, content: [] } }),
    JSON.stringify({ type: 'model_change', timestamp: '2026-07-29T23:59:58.000Z', modelId: 'gpt-5.6-terra' }),
    JSON.stringify({ type: 'message', timestamp: '2026-07-29T23:59:59.000Z', message: { role: 'assistant', model: 'gpt-5.6-terra', usage: { input: 0, output: 1_000_000 }, content: [] } }),
    JSON.stringify({ type: 'message', timestamp: '2026-07-30T00:00:00.000Z', message: { role: 'assistant', model: 'gpt-5.6-terra', usage: { input: 0, output: 1_000_000 }, content: [] } }),
  ].join('\n'));
  const pricingStats = await collectTakomiStats({ home: statsHome, cwd: statsCwd });
  assert.equal(pricingStats.byDay.find((row) => row.key === '2026-07-29')?.cost, 16, 'GPT-5.6 usage before July 30 must retain the legacy Luna and Terra prices');
  assert.equal(pricingStats.byDay.find((row) => row.key === '2026-07-30')?.cost, 12.2, 'GPT-5.6 usage on and after July 30 must use the lower Luna and Terra prices');
  const runtimePricingStats = await collectRuntimeTakomiStats({ home: statsHome, cwd: statsCwd });
  assert.equal(runtimePricingStats.byDay.find((row) => row.key === '2026-07-29')?.cost, 16, 'the /takomi-stats runtime must retain legacy GPT-5.6 prices');
  assert.equal(runtimePricingStats.byDay.find((row) => row.key === '2026-07-30')?.cost, 12.2, 'the /takomi-stats runtime must use current GPT-5.6 prices');

  console.log('✓ regression tests passed');
} finally {
  await fs.remove(tempRoot);
}
