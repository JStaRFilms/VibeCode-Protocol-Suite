#!/usr/bin/env node
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import pc from 'picocolors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const HOME = os.homedir();

// Files and folders that should NEVER be deleted
const PROTECTED_NAMES = new Set([
  '.system',
  '.git',
  '.gitignore',
  'copywriting.zip',
]);

const HARNESS_TARGETS = [
  { id: 'shared', name: 'Pi / Shared Agent Skills', path: path.join(HOME, '.agents', 'skills') },
  { id: 'antigravity', name: 'Antigravity (Modern)', path: path.join(HOME, '.gemini', 'config', 'skills') },
  { id: 'gemini_legacy', name: 'Gemini CLI (Legacy)', path: path.join(HOME, '.gemini', 'skills') },
  { id: 'claude', name: 'Claude Code', path: path.join(HOME, '.claude', 'skills') },
  { id: 'kilocode', name: 'KiloCode', path: path.join(HOME, '.kilocode', 'skills') },
  { id: 'windsurf', name: 'Windsurf', path: path.join(HOME, '.codeium', 'windsurf', 'skills') },
  { id: 'windsurf_nested', name: 'Windsurf (Legacy Nested)', path: path.join(HOME, '.codeium', 'windsurf', 'windsurf', 'skills') },
  { id: 'pi_legacy', name: 'Pi Agent Legacy Skills', path: path.join(HOME, '.pi', 'agent', 'skills') },
  { id: 'cursor', name: 'Cursor', path: path.join(HOME, '.cursor', 'skills') },
  { id: 'codex', name: 'Codex Skills', path: path.join(HOME, '.codex', 'skills') },
  { id: 'takomi_store', name: 'Takomi Global Store', path: path.join(HOME, '.takomi', 'skills'), manifest: path.join(HOME, '.takomi', 'manifest.json') },
];

const MANIFESTS = [
  path.join(HOME, '.takomi', 'skills-manifest.json'),
  path.join(HOME, '.takomi', 'manifest.json'),
];

const TMP_DIRECTORIES = [
  path.join(repoRoot, 'tmp', 'Matt-skills'),
  path.join(repoRoot, 'tmp', 'p-stack-skills'),
];

async function scanDirectory(dirPath) {
  if (!await fs.pathExists(dirPath)) return { toRemove: [], protectedItems: [] };
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const toRemove = [];
    const protectedItems = [];

    for (const entry of entries) {
      if (PROTECTED_NAMES.has(entry.name) || entry.name.startsWith('.')) {
        protectedItems.push(entry.name);
      } else {
        toRemove.push(entry.name);
      }
    }
    return { toRemove, protectedItems };
  } catch {
    return { toRemove: [], protectedItems: [] };
  }
}

async function run() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute') || args.includes('-f');
  const includeTmp = args.includes('--tmp');
  const skipCodex = !args.includes('--include-codex');

  const onlyArg = args.find(a => a.startsWith('--only='));
  const onlyFilters = onlyArg ? onlyArg.replace('--only=', '').split(',').map(s => s.trim()) : null;

  console.log(pc.magenta('\n🛡️  Takomi Global Skills Clean & Reset Utility\n'));

  if (!isExecute) {
    console.log(pc.yellow('🔍 DRY RUN MODE (No files will be deleted). Pass --execute to apply changes.\n'));
  } else {
    console.log(pc.red('⚠️  EXECUTION MODE: Deleting skills from target directories...\n'));
  }

  if (onlyFilters) {
    console.log(pc.cyan(`Targeting only: ${onlyFilters.join(', ')}\n`));
  }

  let totalToRemove = 0;
  let totalProtected = 0;

  for (const target of HARNESS_TARGETS) {
    if (onlyFilters && !onlyFilters.includes(target.id)) {
      continue;
    }

    if (target.id === 'codex' && skipCodex) {
      console.log(`${pc.yellow('Codex Skills')}: ${pc.dim(target.path)} (SKIPPED by default for safety — pass --include-codex to clean)`);
      continue;
    }

    if (target.path && await fs.pathExists(target.path)) {
      const { toRemove, protectedItems } = await scanDirectory(target.path);
      totalToRemove += toRemove.length;
      totalProtected += protectedItems.length;

      console.log(`${pc.cyan(target.name)}: ${pc.dim(target.path)}`);
      if (protectedItems.length > 0) {
        console.log(`  ${pc.green('🛡️  Protected (will NOT delete):')} ${protectedItems.join(', ')}`);
      }
      console.log(`  ${pc.bold('Skills to remove:')} ${toRemove.length} folders ${toRemove.length > 0 ? `(${toRemove.slice(0, 5).join(', ')}${toRemove.length > 5 ? '...' : ''})` : ''}`);

      if (isExecute && toRemove.length > 0) {
        for (const item of toRemove) {
          await fs.remove(path.join(target.path, item));
        }
        console.log(`  ${pc.green('✔ Cleaned.')}`);
      }
      console.log('');
    }
  }

  if (isExecute) {
    for (const manifest of MANIFESTS) {
      if (await fs.pathExists(manifest)) {
        await fs.remove(manifest);
        console.log(`  ${pc.green('✔ Reset tracking manifest:')} ${pc.dim(manifest)}`);
      }
    }
    console.log('');
  }

  if (includeTmp) {
    console.log(pc.cyan('Temporary Migration Folders:'));
    for (const tmpDir of TMP_DIRECTORIES) {
      if (await fs.pathExists(tmpDir)) {
        console.log(`  Found: ${pc.dim(tmpDir)}`);
        if (isExecute) {
          await fs.remove(tmpDir);
          console.log(`  ${pc.green('✔ Removed temporary migration folder.')}`);
        }
      }
    }
    console.log('');
  }

  console.log(pc.white('─────────────────────────────────────────────────────────────────'));
  if (!isExecute) {
    console.log(pc.white(`Summary: ${totalToRemove} skills flagged for cleanup, ${totalProtected} special files protected.`));
    console.log(pc.dim('\nTo execute full clean across all harnesses:'));
    console.log(pc.green('  node scripts/clean-installed-skills.mjs --execute --tmp\n'));
    console.log(pc.dim('To clean ONLY Shared (~/.agents) and Antigravity (~/.gemini):'));
    console.log(pc.green('  node scripts/clean-installed-skills.mjs --execute --only=shared,antigravity,gemini_legacy\n'));
  } else {
    console.log(pc.green('✨ Global skills reset complete (Codex and special files safely preserved)!'));
    console.log(pc.white('\nNext step: Run fresh install across your chosen harnesses:'));
    console.log(pc.cyan('  node bin/takomi.js install skills'));
    console.log(pc.cyan('  node bin/takomi.js sync\n'));
  }
}

run().catch(console.error);
