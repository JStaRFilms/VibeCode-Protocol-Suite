#!/usr/bin/env node
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import assert from 'node:assert/strict';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-skills-test-'));
process.env.TAKOMI_HOME_DIR = path.join(tempRoot, '.takomi');
process.env.TAKOMI_STORE_PATH = path.join(tempRoot, '.takomi');
process.env.TAKOMI_SKILLS_ROOT = path.join(tempRoot, '.agents', 'skills');

const catalog = await import('../src/skills-catalog.js');
const installer = await import('../src/skills-installer.js');
const store = await import('../src/store.js');
const harness = await import('../src/harness.js');

const skillPath = (name) => path.join(process.env.TAKOMI_SKILLS_ROOT, name);

function assertHarnessSkillPath(id, relativePath) {
  assert.equal(harness.HARNESS_MAP[id].targets.skills, path.join(os.homedir(), ...relativePath));
}

async function resetSkillsInstallState() {
  await fs.remove(process.env.TAKOMI_SKILLS_ROOT);
  await fs.remove(installer.SKILLS_MANIFEST_PATH);
}

try {
  assertHarnessSkillPath('antigravity', ['.gemini', 'config', 'skills']);
  assert.equal(harness.HARNESS_MAP.antigravity.targets.workflows, path.join(os.homedir(), '.gemini', 'config', 'global_workflows'));
  assertHarnessSkillPath('claude_code', ['.claude', 'skills']);
  assertHarnessSkillPath('codex', ['.codex', 'skills']);
  assertHarnessSkillPath('cursor', ['.cursor', 'skills']);
  assertHarnessSkillPath('pi', ['.agents', 'skills']);
  assertHarnessSkillPath('kilocode', ['.kilocode', 'skills']);
  assertHarnessSkillPath('windsurf', ['.codeium', 'windsurf', 'skills']);
  assert.equal(Boolean(harness.HARNESS_MAP.gemini_cli), false, 'deprecated Gemini CLI should not be a sync target');
  assert.equal(Boolean(harness.HARNESS_MAP.antigravity_cli), false, 'Antigravity CLI should not use the old separate config target');

  const core = await catalog.getValidCoreSkills();
  assert.deepEqual(core, [
    'takomi',
    'grill-me',
    'code-review',
    'sync-docs',
    'security-audit',
    'agent-recovery',
    'avoid-feature-creep',
    'git-commit-generation',
  ]);
  assert.equal(core.includes('context7'), false, 'context7 must not be core');
  assert.equal(core.includes('spawn-task'), false, 'spawn-task must not be core');
  assert.equal(catalog.getSkillCategory('frontend-ui'), 'frontend', 'catalog taxonomy must expose the installer category');
  assert.equal(catalog.getSkillCategory('web-dev-standards'), 'dev-workflows', 'standards must use the dev-workflows category');
  assert.equal(catalog.getSkillCategory('hyperframes'), 'video-motion', 'hyperframes must use the video-motion category');
  assert.equal(catalog.getSkillCategory('office-docs'), 'office-docs', 'office-docs must use the office-docs category');
  assert.equal(catalog.getSkillCategory('convex'), 'convex', 'convex must use the convex category');
  assert.equal(catalog.getSkillCategory('agent-engineering'), 'agent-engineering', 'agent-engineering must use the agent-engineering category');
  assert.equal(catalog.getSkillCategory('code-intelligence'), 'code-intelligence', 'code-intelligence must use the code-intelligence category');
  assert.equal(catalog.getSkillCategory('engineering-principles'), 'principles', 'engineering-principles must use the principles category');
  assert.equal(catalog.getSkillCategory('not-a-bundled-skill'), undefined, 'unknown skill names must not receive guessed categories');

  const allSkills = await catalog.listBundledSkillNames();

  // Manual folder with the same name as a bundled skill must not be overwritten
  // or claimed in the ownership manifest, even on repeated installs.
  await resetSkillsInstallState();
  await fs.ensureDir(skillPath('takomi'));
  await fs.writeFile(path.join(skillPath('takomi'), 'SKILL.md'), 'manual takomi collision');

  let result = await installer.installBundledSkills('test', { mode: 'core', selectedSkills: core });
  assert.equal(result.selectedCount, core.length, 'first core install selected count mismatch');
  assert.deepEqual(result.preservedManual, ['takomi'], 'manual same-name skill should be preserved on first install');
  assert.equal(await fs.readFile(path.join(skillPath('takomi'), 'SKILL.md'), 'utf8'), 'manual takomi collision');
  assert.equal(await fs.pathExists(skillPath('sync-docs')), true, 'non-colliding core skill should install');

  result = await installer.installBundledSkills('test', { mode: 'core', selectedSkills: core });
  assert.deepEqual(result.preservedManual, ['takomi'], 'manual same-name skill should remain preserved on repeat install');
  let manifest = await installer.readSkillsInstallManifest();
  assert.equal(manifest.selectedSkills.includes('takomi'), true, 'manifest should remember selected manual collision');
  assert.equal(Boolean(manifest.owned.takomi), false, 'manifest must not claim ownership of manual collision');

  // Switching to none prunes only unmodified Takomi-owned skills. Modified owned
  // skills and manual collisions are preserved and tracked consistently.
  await fs.appendFile(path.join(skillPath('sync-docs'), 'SKILL.md'), '\nmanual edit');
  result = await installer.installBundledSkills('test', { mode: 'none', selectedSkills: [] });
  assert.equal(await fs.pathExists(skillPath('git-commit-generation')), false, 'unmodified owned skill should be pruned when switching to none');
  assert.equal(await fs.pathExists(skillPath('sync-docs')), true, 'modified owned skill should be preserved when switching to none');
  assert.equal(await fs.pathExists(skillPath('takomi')), true, 'manual same-name skill should be preserved when switching to none');
  assert.deepEqual(result.preservedModified, ['sync-docs'], 'modified owned skill should be reported');
  manifest = await installer.readSkillsInstallManifest();
  assert.deepEqual(manifest.selectedSkills, [], 'none mode should record no selected skills');
  assert.equal(Boolean(manifest.owned['sync-docs']), true, 'modified owned skill should stay tracked for safe future pruning');
  assert.equal(Boolean(manifest.owned.takomi), false, 'manual collision should remain unowned');

  result = await installer.installBundledSkills('test', { mode: 'none', selectedSkills: [] });
  assert.equal(await fs.pathExists(skillPath('sync-docs')), true, 'repeat none install should keep modified owned skill');
  assert.equal(await fs.pathExists(skillPath('takomi')), true, 'repeat none install should keep manual collision');
  manifest = await installer.readSkillsInstallManifest();
  assert.deepEqual(manifest.selectedSkills, [], 'repeat none install should keep manifest selection consistent');
  assert.equal(Object.keys(manifest.owned).sort().join(','), 'sync-docs', 'repeat none install should keep only modified owned entry');

  // Refresh core after an all install should prune deselected optional skills while
  // preserving unrelated manual skills.
  await resetSkillsInstallState();
  result = await installer.installBundledSkills('test', { mode: 'all', selectedSkills: allSkills });
  assert.equal(result.selectedCount, allSkills.length, 'all mode should select every bundled skill');
  assert.equal(await fs.pathExists(skillPath('ai-media')), true);
  manifest = await installer.readSkillsInstallManifest();
  assert.equal(manifest.owned['frontend-ui'].category, 'frontend', 'installer manifest must persist real catalog taxonomy for flat skills');
  assert.equal(manifest.owned['web-dev-standards'].category, 'dev-workflows', 'future explicit installs must persist transactional email taxonomy');
  assert.equal(manifest.owned.hyperframes.category, 'video-motion', 'atomic hyperframes package must use video-motion taxonomy');
  assert.equal(manifest.owned.convex.category, 'convex', 'atomic convex package must use convex taxonomy');
  assert.equal(manifest.owned['office-docs'].category, 'office-docs', 'atomic office-docs package must use office-docs taxonomy');

  await fs.ensureDir(skillPath('my-manual-skill'));
  await fs.writeFile(path.join(skillPath('my-manual-skill'), 'SKILL.md'), 'manual skill');

  result = await installer.installBundledSkills('test', { mode: 'core', selectedSkills: core });
  assert.equal(result.selectedCount, core.length, 'core mode selected count mismatch');
  assert.equal(await fs.pathExists(skillPath('ai-media')), false, 'deselected Takomi-owned optional skill should be pruned');
  assert.equal(await fs.pathExists(skillPath('my-manual-skill')), true, 'manual skill must be preserved');
  assert.equal(await fs.pathExists(skillPath('security-audit')), true, 'security-audit should remain core');
  assert.equal(await fs.pathExists(skillPath('git-commit-generation')), true, 'git-commit-generation should remain core');

  manifest = await installer.readSkillsInstallManifest();
  assert.equal(manifest.mode, 'core');
  assert.equal(manifest.selectedSkills.includes('context7'), false);
  assert.equal(manifest.selectedSkills.includes('spawn-task'), false);
  assert.equal(manifest.selectedSkills.includes('git-commit-generation'), true);
  assert.equal(manifest.owned['git-commit-generation'].category, 'core', 'refreshed core manifest entries retain installer category metadata');

  await store.initGlobalStore();
  await store.populateSkills('all');
  assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'skills', 'ai-media')), true, 'all store populate should copy optional skills');
  await fs.ensureDir(path.join(store.STORE_PATH, 'skills', 'manual-store-skill'));
  await fs.writeFile(path.join(store.STORE_PATH, 'skills', 'manual-store-skill', 'SKILL.md'), 'manual store skill');
  await store.populateSkills('core');
  assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'skills', 'ai-media')), false, 'store should prune deselected Takomi-owned optional skills');
  assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'skills', 'manual-store-skill')), true, 'store should preserve manual skills');
  assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'skills', 'security-audit')), true, 'store core should include security-audit');

  await store.populateWorkflows('all');
  assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'workflows', 'agent_reset.md')), true, 'all workflow populate should copy optional workflows');
  await fs.writeFile(path.join(store.STORE_PATH, 'workflows', 'manual-workflow.md'), 'manual workflow');
  await store.populateWorkflows('core');
  assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'workflows', 'agent_reset.md')), false, 'store should prune deselected Takomi-owned workflows');
  assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'workflows', 'manual-workflow.md')), true, 'store should preserve manual workflows');
  assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'workflows', 'vibe-build.md')), true, 'store core should include vibe-build workflow');

  const harnessTarget = path.join(tempRoot, 'harness-skills');
  let syncResult = await harness.syncDirectory(path.join(store.STORE_PATH, 'skills'), harnessTarget, '', {
    useOwnership: true,
    preserveManual: true,
    prune: true,
    returnDetails: true,
  });
  assert.equal(await fs.pathExists(path.join(harnessTarget, 'security-audit')), true, 'harness sync should copy selected store skills');
  await fs.ensureDir(path.join(harnessTarget, 'manual-harness-skill'));
  await fs.writeFile(path.join(harnessTarget, 'manual-harness-skill', 'SKILL.md'), 'manual harness skill');
  await store.populateSkills(['takomi']);
  syncResult = await harness.syncDirectory(path.join(store.STORE_PATH, 'skills'), harnessTarget, '', {
    owned: syncResult.owned,
    preserveManual: true,
    prune: true,
    returnDetails: true,
  });
  assert.equal(await fs.pathExists(path.join(harnessTarget, 'security-audit')), false, 'harness sync should prune deselected Takomi-owned skills');
  assert.equal(await fs.pathExists(path.join(harnessTarget, 'manual-harness-skill')), true, 'harness sync should preserve manual skills');
  assert.equal(await fs.pathExists(path.join(harnessTarget, 'takomi')), true, 'harness sync should keep selected skills');

  const linkedHarnessTarget = path.join(tempRoot, 'linked-harness-skills');
  const linkResult = await harness.syncDirectory(path.join(store.STORE_PATH, 'skills'), linkedHarnessTarget, '', {
    preserveManual: true,
    prune: true,
    returnDetails: true,
    linkMode: 'auto',
  });
  assert.equal(linkResult.copied >= 1, true, 'link-mode harness sync should materialize store skills');
  assert.equal(['symlink', 'copy'].includes(linkResult.owned.takomi.syncMethod), true, 'link-mode sync should record the materialization method');
  if (linkResult.owned.takomi.syncMethod === 'symlink') {
    assert.equal((await fs.lstat(path.join(linkedHarnessTarget, 'takomi'))).isSymbolicLink(), true, 'symlink sync should create a link/junction to the store skill');
  }

  console.log('✓ skill selection installer tests passed');
} finally {
  await fs.remove(tempRoot);
}
