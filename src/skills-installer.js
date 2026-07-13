import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import pc from 'picocolors';
import { PATHS } from './utils.js';
import { getSkillCategory, getValidCoreSkills, listBundledSkillNames } from './skills-catalog.js';

const HOME = os.homedir();
const TAKOMI_HOME = process.env.TAKOMI_HOME_DIR || path.join(HOME, '.takomi');
export const SKILLS_MANIFEST_PATH = path.join(TAKOMI_HOME, 'skills-manifest.json');
export const SKILLS_ROOT = process.env.TAKOMI_SKILLS_ROOT || path.join(HOME, '.agents', 'skills');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function hashDirectory(dir) {
  if (!await fs.pathExists(dir)) return null;
  const entries = [];
  async function walk(current, prefix = '') {
    const names = (await fs.readdir(current)).sort();
    for (const name of names) {
      const full = path.join(current, name);
      const rel = path.join(prefix, name).replace(/\\/g, '/');
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        entries.push(`dir:${rel}`);
        await walk(full, rel);
      } else {
        entries.push(`file:${rel}:${sha256(await fs.readFile(full))}`);
      }
    }
  }
  await walk(dir);
  return sha256(entries.join('\n'));
}

function normalizeOwnedEntry(name, entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return {
      name,
      hash: entry,
      targetPath: path.join(SKILLS_ROOT, name),
      installedAt: undefined,
      takomiVersion: undefined,
      category: getSkillCategory(name),
    };
  }
  return {
    name,
    hash: entry.hash,
    targetPath: entry.targetPath || path.join(SKILLS_ROOT, name),
    installedAt: entry.installedAt,
    takomiVersion: entry.takomiVersion,
    category: entry.category || getSkillCategory(name),
  };
}

function getOwnedMap(manifest) {
  const owned = {};
  for (const [name, entry] of Object.entries(manifest?.owned || {})) {
    const normalized = normalizeOwnedEntry(name, entry);
    if (normalized?.hash) owned[name] = normalized;
  }
  return owned;
}

export async function readSkillsInstallManifest() {
  try {
    if (await fs.pathExists(SKILLS_MANIFEST_PATH)) return await fs.readJson(SKILLS_MANIFEST_PATH);
  } catch {}
  return null;
}

export async function writeSkillsInstallManifest(manifest) {
  await fs.ensureDir(TAKOMI_HOME);
  await fs.writeJson(SKILLS_MANIFEST_PATH, manifest, { spaces: 2 });
}

export async function getInstalledTakomiSkillNames() {
  return Object.keys(getOwnedMap(await readSkillsInstallManifest())).sort();
}

export async function buildSkillsReconcilePlan(selectedSkills = []) {
  const manifest = await readSkillsInstallManifest();
  const owned = getOwnedMap(manifest);
  const selected = new Set(selectedSkills);
  return {
    owned: Object.keys(owned).sort(),
    selected: [...selected].sort(),
    toInstall: [...selected].sort(),
    toRemove: Object.keys(owned).filter((name) => !selected.has(name)).sort(),
  };
}

export async function installBundledSkills(version = 'unknown', options = {}) {
  const bundled = new Set(await listBundledSkillNames());
  const selectedSkills = Array.isArray(options.selectedSkills)
    ? options.selectedSkills
    : await getValidCoreSkills();
  const selected = [...new Set(selectedSkills)].filter((name) => bundled.has(name)).sort();
  const selectedSet = new Set(selected);
  const prune = options.prune !== false;
  const mode = options.mode || 'core';

  await fs.ensureDir(SKILLS_ROOT);

  const previousManifest = await readSkillsInstallManifest();
  const previousOwned = getOwnedMap(previousManifest);
  const nextOwned = {};
  const installed = [];
  const pruned = [];
  const missing = [];
  const preservedManual = [];
  const preservedModified = [];
  const skippedUnknown = selectedSkills.filter((name) => !bundled.has(name)).sort();

  if (prune) {
    for (const [name, ownedEntry] of Object.entries(previousOwned)) {
      if (selectedSet.has(name)) continue;
      const dest = ownedEntry.targetPath || path.join(SKILLS_ROOT, name);
      if (!await fs.pathExists(dest)) continue;
      const currentHash = await hashDirectory(dest);
      if (currentHash && currentHash === ownedEntry.hash) {
        await fs.remove(dest);
        pruned.push(name);
      } else {
        preservedModified.push(name);
        nextOwned[name] = ownedEntry;
      }
    }
  }

  for (const name of selected) {
    const src = path.join(PATHS.skills, name);
    const dest = path.join(SKILLS_ROOT, name);
    const previous = previousOwned[name];

    if (!await fs.pathExists(src)) {
      missing.push(name);
      continue;
    }

    if (await fs.pathExists(dest)) {
      const currentHash = await hashDirectory(dest);
      if (!previous) {
        preservedManual.push(name);
        continue;
      }
      if (currentHash && previous.hash && currentHash !== previous.hash) {
        preservedModified.push(name);
        nextOwned[name] = previous;
        continue;
      }
      await fs.remove(dest);
    }

    await fs.copy(src, dest, { overwrite: true, errorOnExist: false });
    const hash = await hashDirectory(dest);
    nextOwned[name] = {
      name,
      hash,
      targetPath: dest,
      installedAt: new Date().toISOString(),
      takomiVersion: version,
      category: getSkillCategory(name),
    };
    installed.push(name);
  }

  // Keep selected, previously-owned modified resources tracked so future
  // deselection still preserves them instead of treating them as manual files.
  for (const name of selected) {
    if (!nextOwned[name] && previousOwned[name]) nextOwned[name] = previousOwned[name];
  }

  const manifest = {
    schemaVersion: 2,
    takomiVersion: version,
    installedAt: previousManifest?.installedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    targetRoot: SKILLS_ROOT,
    mode,
    selectedSkills: selected,
    owned: Object.fromEntries(Object.entries(nextOwned).sort(([a], [b]) => a.localeCompare(b))),
    lastRun: {
      installed,
      pruned,
      preservedManual,
      preservedModified,
      skippedUnknown,
      missing,
    },
  };

  await writeSkillsInstallManifest(manifest);
  return {
    targetRoot: SKILLS_ROOT,
    manifest,
    count: installed.length,
    selectedCount: selected.length,
    installed,
    pruned,
    preservedManual,
    preservedModified: [...new Set(preservedModified)].sort(),
    skippedUnknown,
    missing,
  };
}

export async function validateSkillsInstall(selectedSkills = null) {
  const expected = Array.isArray(selectedSkills) ? selectedSkills : (await readSkillsInstallManifest())?.selectedSkills || await getValidCoreSkills();
  const missing = [];
  for (const name of expected) {
    if (!await fs.pathExists(path.join(SKILLS_ROOT, name))) missing.push(name);
  }
  return { root: SKILLS_ROOT, expected: expected.length, missing, ok: missing.length === 0 };
}

export function printSkillsInstallSummary(result, validation) {
  if (result?.leaveAsIs) {
    console.log(pc.green('\n✔ Left Takomi skills unchanged'));
    console.log(pc.white(`  Root:     ${result.targetRoot}`));
    console.log(pc.white(`  Manifest: ${SKILLS_MANIFEST_PATH}`));
    console.log(pc.white(`  Owned:    ${result.ownedCount}`));
    return;
  }

  console.log(pc.green('\n✔ Reconciled Takomi skills'));
  console.log(pc.white(`  Root:      ${result.targetRoot}`));
  console.log(pc.white(`  Manifest:  ${SKILLS_MANIFEST_PATH}`));
  console.log(pc.white(`  Selected:  ${result.selectedCount}`));
  console.log(pc.white(`  Installed: ${result.installed.length}`));
  console.log(pc.white(`  Removed:   ${result.pruned.length}`));
  if (result.preservedManual.length) {
    console.log(pc.yellow(`  Preserved manual name collisions: ${result.preservedManual.join(', ')}`));
  }
  if (result.preservedModified.length) {
    console.log(pc.yellow(`  Preserved modified Takomi skills: ${result.preservedModified.join(', ')}`));
  }
  if (result.skippedUnknown.length) {
    console.log(pc.yellow(`  Skipped unknown bundled skills: ${result.skippedUnknown.join(', ')}`));
  }
  console.log(pc.white(`  Status:    ${validation.ok ? 'ok' : `missing ${validation.missing.length}`}`));
}
