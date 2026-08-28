import { Command } from 'commander';
import prompts from 'prompts';
import pc from 'picocolors';
import figlet from 'figlet';
import fs from 'fs-extra';
import path from 'path';
import {
  PATHS,
  getWorkflows,
  getSkills,
  copySpecificWorkflows,
  copySpecificSkills,
  copyAllWorkflows,
  copyAllSkills,
  copyAgentReadme,
  copyAgentYamls,
  copyLegacyManual,
  copyBundledPiAssets,
  updateWorkflows,
  updateSkills,
  updateAgentYamls,
  updateLegacyManual,
  downloadDirectoryFromGitHub,
} from './utils.js';
import {
  HARNESS_MAP,
  detectHarnesses,
  printHarnessStatus,
  syncToAllHarnesses,
} from './harness.js';
import {
  STORE_PATH,
  initGlobalStore,
  getManifest,
  writeManifest,
  buildStoreSkillsReconcilePlan,
  buildStoreWorkflowsReconcilePlan,
  populateSkills,
  populateWorkflows,
  populateAgentYamls,
  getStoreSkills,
  getStoreWorkflows,
  isStoreInitialized,
} from './store.js';
import { runDoctor } from './doctor.js';
import { disableRawPiSubagentsActivation, ensurePiInstalled, ensurePiSubagentsInstalled, formatRawPiSubagentsDisableActions, formatRawPiSubagentsFindings, inspectRawPiSubagentsActivation, launchTakomiHarness, printPiInstallResult, printPiSubagentsInstallResult, updatePiCliPackage, updatePiManagedPackages, printPiManagedPackageUpdateResult } from './pi-harness.js';
import { installPiHarnessAssets, printPiInstallSummary, syncPiHarnessAssets, validatePiHarnessInstall } from './pi-installer.js';
import { offerPiOptionalFeatures } from './pi-optional-features.js';
import {
  buildSkillsReconcilePlan,
  getInstalledTakomiSkillNames,
  installBundledSkills,
  printSkillsInstallSummary,
  validateSkillsInstall,
  SKILLS_ROOT,
} from './skills-installer.js';
import {
  colorCategory,
  CORE_SKILLS,
  getSkillChoices,
  getSkillsForCategories,
  getUncategorizedSkills,
  getValidCoreSkills,
  listBundledSkillNames,
  SKILL_CATEGORIES,
} from './skills-catalog.js';
import { promptSkillCategoryTui } from './skills-selection-tui.js';
import { notifyIfTakomiUpdateAvailable, printTakomiUpdateStatus, upgradeTakomiPackage } from './update-check.js';
import { printTakomiStats } from './takomi-stats.js';

const packageJson = await fs.readJson(PATHS.packageJson);
const program = new Command();

// ─────────────────────────────────────────────────────────────────────────────
// takomi init (EXISTING — Backward Compatible)
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  console.log(pc.magenta(figlet.textSync('Takomi', { horizontalLayout: 'full' })));
  console.log(pc.cyan('   Your AI team. Activated. 🚀\n'));

  const response = await prompts([
    {
      type: 'multiselect',
      name: 'components',
      message: 'What components do you want to spawn?',
      choices: [
        { title: '.agent Folder (Workflows & Skills)', value: 'agent', selected: true, description: 'Recommended for Cursor/Windsurf' },
        { title: 'Agent YAMLs', value: 'yamls', description: 'For Kilo Code / Deep Source' },
        { title: 'Legacy Manual Protocols', value: 'legacy', description: 'Browser-based prompts' }
      ],
      min: 1,
      hint: '- Space to select. Return to submit'
    },
    // Workflow Selection (Only if .agent is selected)
    {
      type: (prev, values) => values.components.includes('agent') ? 'select' : null,
      name: 'workflowMode',
      message: 'How should we install Workflows?',
      choices: [
        { title: 'Install Core Workflows (Recommended)', value: 'core' },
        { title: 'Install All Workflows', value: 'all' },
        { title: 'Install All (Exclude Legacy)', value: 'no-legacy' },
        { title: 'Select Specific Workflows', value: 'custom' }
      ]
    },
    {
      type: (prev, values) => values.workflowMode === 'custom' ? 'multiselect' : null,
      name: 'selectedWorkflows',
      message: 'Select workflows to install:',
      choices: async () => {
        const workflows = await getWorkflows();
        return workflows.map(w => ({ title: w, value: w }));
      },
      hint: '- Space to select. Return to submit'
    },
    // Skill Selection (Only if .agent is selected)
    {
      type: (prev, values) => values.components.includes('agent') ? 'select' : null,
      name: 'skillMode',
      message: 'How should we install Skills?',
      choices: [
        { title: 'Install Core Skills (Recommended)', value: 'core', description: `8 essentials (${formatCoreSkillsSummary()})` },
        { title: 'Install All Skills', value: 'all', description: 'Install every bundled skill' },
        { title: 'Select Specific Skills', value: 'custom', description: 'Interactive category tree selection' }
      ]
    },
    // Destination
    {
      type: 'text',
      name: 'path',
      message: 'Where should we spawn these files?',
      initial: './'
    }
  ]);

  if (!response.components || !response.path) return; // User cancelled

  const destRoot = path.resolve(process.cwd(), response.path);
  console.log(pc.dim(`\nSpawning resources into: ${destRoot}...\n`));

  try {
    // 0. Install from local assets
    console.log(pc.cyan('📦 Installing from local bundle...\n'));

    if (await copyBundledPiAssets(destRoot)) {
      console.log(pc.green('✔ Installed Pi-native Takomi runtime (.pi).'));
    }

    // 1. Handle .agent Folder
    if (response.components.includes('agent')) {
      const agentDest = path.join(destRoot, '.agent');
      const workflowsDest = path.join(agentDest, 'workflows');
      const skillsDest = path.join(agentDest, 'skills');

      await fs.ensureDir(agentDest);
      await fs.ensureDir(workflowsDest);

      // Handle Workflows
      if (response.workflowMode === 'core') {
        console.log(pc.green('✔ Downloading Core Workflows...'));
        const coreWorkflows = [
          'vibe-genesis.md', 'vibe-design.md', 'vibe-build.md',
          'vibe-continueBuild.md', 'vibe-finalize.md', 'vibe-spawnTask.md',
          'vibe-primeAgent.md', 'vibe-syncDocs.md', 'stitch.md',
          'mode-orchestrator.md', 'mode-architect.md', 'mode-code.md',
          'mode-debug.md', 'mode-ask.md', 'mode-review.md', 'mode-visionary.md'
        ];
        await copySpecificWorkflows(coreWorkflows, workflowsDest);
      } else if (response.workflowMode === 'all') {
        console.log(pc.green('✔ Downloading all workflows...'));
        await copyAllWorkflows(workflowsDest, false);
      } else if (response.workflowMode === 'no-legacy') {
        console.log(pc.green('✔ Downloading workflows (skipping legacy)...'));
        await copyAllWorkflows(workflowsDest, true);
      } else if (response.workflowMode === 'custom' && response.selectedWorkflows) {
        console.log(pc.green(`✔ Downloading ${response.selectedWorkflows.length} specific workflows...`));
        await copySpecificWorkflows(response.selectedWorkflows, workflowsDest);
      }

      await fs.ensureDir(skillsDest);

      // Handle Skills
      if (response.skillMode === 'core') {
        console.log(pc.green('✔ Installing Core Skills...'));
        const core = await getValidCoreSkills();
        await copySpecificSkills(core, skillsDest);
      } else if (response.skillMode === 'all') {
        console.log(pc.green('✔ Installing all skills...'));
        await copyAllSkills(skillsDest);
      } else if (response.skillMode === 'custom') {
        const selectedSkills = await promptCustomSkillSelection([], { selectAllForNewCategories: true, title: 'Workspace Custom Skills Selection' });
        if (!selectedSkills || selectedSkills.length === 0) {
          console.log(pc.yellow('  No skills selected; skipping skills folder.'));
        } else {
          console.log(pc.green(`✔ Installing ${selectedSkills.length} specific skills...`));
          await copySpecificSkills(selectedSkills, skillsDest);
        }
      }

      // Copy .agent/README.md if it exists
      await copyAgentReadme(path.join(agentDest, 'README.md'));
    }

    // 2. Handle Agent YAMLs
    if (response.components.includes('yamls')) {
      console.log(pc.green('✔ Downloading Agent YAMLs...'));
      const yamlDest = path.join(destRoot, 'Takomi-Agents');
      await copyAgentYamls(yamlDest);
    }

    // 3. Handle Legacy Manual
    if (response.components.includes('legacy')) {
      console.log(pc.green('✔ Downloading Legacy Protocols...'));
      const legacyDest = path.join(destRoot, 'Legacy-Protocols');
      await copyLegacyManual(legacyDest);
    }

    console.log(pc.magenta('\n✨ Your toolkit is ready. Let\'s build something extraordinary. ✨'));
    console.log(pc.white(`\nNext steps:`));
    if (response.components.includes('agent')) {
      console.log(pc.gray(`1. Your .agent folder is armed and ready.`));
      console.log(pc.gray(`2. Your Pi-native .pi Takomi runtime is installed.`));
      console.log(pc.gray(`3. In Codex, say "use takomi genesis" (slash command optional).`));
    }
    console.log(pc.dim(`\n💡 Pro tip: Run "takomi install" to sync this toolkit across all your IDEs.\n`));

  } catch (error) {
    console.error(pc.red('Error during installation:'), error);
  }
}

function formatCoreSkillsSummary() {
  return CORE_SKILLS.join(', ');
}

async function promptCustomSkillSelection(initialSelected = [], options = {}) {
  const tuiSelection = await promptSkillCategoryTui({
    initialSelected,
    title: options.title || 'Custom Skills Selection',
  });
  if (Array.isArray(tuiSelection)) return tuiSelection;
  if (tuiSelection === null) return null;

  const initialSet = new Set(initialSelected);
  const uncategorized = await getUncategorizedSkills();
  const categoryChoices = SKILL_CATEGORIES.map((category) => ({
    title: colorCategory(category),
    value: category.id,
    selected: category.skills.some((skill) => initialSet.has(skill)),
    description: category.description,
  }));

  if (uncategorized.length) {
    categoryChoices.push({
      title: pc.dim('[Other / Uncategorized]'),
      value: '__uncategorized',
      selected: uncategorized.some((skill) => initialSet.has(skill)),
      description: 'Bundled skills that are not assigned to a curated category yet.',
    });
  }

  const categoryResponse = await prompts({
    type: 'multiselect',
    name: 'categories',
    message: 'Select skill categories:',
    choices: categoryChoices,
    hint: '- Space to select. Return to continue',
  });

  if (!categoryResponse.categories) return null;

  const selected = new Set();
  const selectedCategories = categoryResponse.categories;

  for (const categoryId of selectedCategories) {
    const category = SKILL_CATEGORIES.find((item) => item.id === categoryId);
    const skillNames = categoryId === '__uncategorized'
      ? uncategorized
      : (await getSkillsForCategories([categoryId]));
    const categoryHadInitialSelection = skillNames.some((skill) => initialSet.has(skill));
    const defaultSelected = options.selectAllForNewCategories && !categoryHadInitialSelection
      ? skillNames
      : skillNames.filter((skill) => initialSet.has(skill));

    const skillResponse = await prompts({
      type: 'multiselect',
      name: 'skills',
      message: `Select skills in ${category?.title || 'Other / Uncategorized'}:`,
      choices: await getSkillChoices(skillNames, defaultSelected),
      hint: '- Space to select. Return to continue',
    });

    if (!skillResponse.skills) return null;
    for (const skill of skillResponse.skills) selected.add(skill);
  }

  return [...selected].sort();
}

async function confirmSkillRemovalIfNeeded(selectedSkills, mode) {
  const plan = await buildSkillsReconcilePlan(selectedSkills);
  if (plan.toRemove.length === 0) return true;

  console.log(pc.yellow('\nTakomi will remove deselected Takomi-managed skills only:'));
  for (const skill of plan.toRemove) console.log(pc.dim(`  - ${skill}`));
  console.log(pc.dim('\nManual skills and modified Takomi skills are preserved.'));

  const response = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: `Remove ${plan.toRemove.length} Takomi-managed skill${plan.toRemove.length === 1 ? '' : 's'} for "${mode}"?`,
    initial: false,
  });

  return Boolean(response.confirm);
}

async function promptSkillsInstallSelection() {
  const envMode = process.env.TAKOMI_SKILLS_MODE;
  if (envMode) {
    const mode = envMode.toLowerCase();
    if (mode === 'core') return { mode, selectedSkills: await getValidCoreSkills() };
    if (mode === 'all') return { mode, selectedSkills: await listBundledSkillNames() };
    if (mode === 'none') return { mode, selectedSkills: [] };
    if (mode === 'leave-as-is' || mode === 'leave') return { mode: 'leave-as-is', leaveAsIs: true };
  }

  const installed = await getInstalledTakomiSkillNames();
  const hasTakomiSkills = installed.length > 0;
  const choices = hasTakomiSkills
    ? [
        { title: 'Leave As Is', value: 'leave-as-is', selected: true, description: `Recommended: keep ${installed.length} Takomi-managed skill${installed.length === 1 ? '' : 's'} unchanged.` },
        { title: 'Present Custom', value: 'present-custom', description: 'Review your current Takomi-managed skills and adjust selections.' },
        { title: 'Core Skills', value: 'core', description: `[Recommended defaults] ${formatCoreSkillsSummary()}` },
        { title: 'Custom', value: 'custom', description: 'Choose categories and individual skills.' },
        { title: 'All Skills', value: 'all', description: 'Install every bundled Takomi skill.' },
        { title: 'None', value: 'none', description: 'Disable Takomi-managed skills after confirmation.' },
      ]
    : [
        { title: 'Core Skills', value: 'core', selected: true, description: `[Recommended defaults] ${formatCoreSkillsSummary()}` },
        { title: 'Custom', value: 'custom', description: 'Choose categories and individual skills.' },
        { title: 'All Skills', value: 'all', description: 'Install every bundled Takomi skill.' },
        { title: 'None', value: 'none', description: 'Do not install Takomi skills.' },
      ];

  const response = await prompts({
    type: 'select',
    name: 'mode',
    message: 'Skills Installation',
    choices,
  });

  if (!response.mode) return null;

  if (response.mode === 'leave-as-is') {
    return { mode: response.mode, leaveAsIs: true, ownedCount: installed.length };
  }

  let selectedSkills = [];
  if (response.mode === 'core') {
    selectedSkills = await getValidCoreSkills();
  } else if (response.mode === 'all') {
    const confirmAll = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Install every bundled skill? This may add skill discovery noise in supported harnesses.',
      initial: false,
    });
    if (!confirmAll.confirm) return { mode: 'leave-as-is', leaveAsIs: true, ownedCount: installed.length };
    selectedSkills = await listBundledSkillNames();
  } else if (response.mode === 'none') {
    selectedSkills = [];
  } else if (response.mode === 'present-custom') {
    const customSelection = await promptCustomSkillSelection(installed, { selectAllForNewCategories: true, title: 'Present Custom Skills' });
    if (!customSelection) return null;
    selectedSkills = customSelection;
  } else if (response.mode === 'custom') {
    const customSelection = await promptCustomSkillSelection([], { selectAllForNewCategories: true, title: 'Custom Skills Selection' });
    if (!customSelection) return null;
    selectedSkills = customSelection;
  }

  const confirmedRemoval = await confirmSkillRemovalIfNeeded(selectedSkills, response.mode);
  if (!confirmedRemoval) {
    return { mode: 'leave-as-is', leaveAsIs: true, ownedCount: installed.length };
  }

  return { mode: response.mode, selectedSkills };
}

function normalizeHarnessSyncMode(value) {
  return ['copy', 'symlink', 'auto'].includes(value) ? value : 'copy';
}

async function promptHarnessSyncMode(initial = 'auto') {
  const normalizedInitial = normalizeHarnessSyncMode(initial);
  const choices = [
    { title: 'Auto (try symlink, copy if blocked)', value: 'auto', description: 'Best fallback when Windows permissions or filesystems block symlinks.' },
    { title: 'Symlink / Junction (single source of truth)', value: 'symlink', description: 'Each managed skill/workflow points back to ~/.takomi; edits update one canonical copy.' },
    { title: 'Copy (independent files)', value: 'copy', description: 'Most compatible; changes do not flow back to ~/.takomi.' },
  ];
  const response = await prompts({
    type: 'select',
    name: 'syncMode',
    message: 'How should Takomi sync store resources into harness folders?',
    choices,
    initial: Math.max(0, choices.findIndex((choice) => choice.value === normalizedInitial)),
  });
  if (!response.syncMode) return null;
  return normalizeHarnessSyncMode(response.syncMode);
}

function collectSyncFailures(syncSummary) {
  return Object.entries(syncSummary || {})
    .filter(([, result]) => result?.ok === false)
    .map(([id, result]) => ({ id, errors: result.errors?.length ? result.errors : ['unknown sync error'] }));
}

function printSyncFailures(failures) {
  if (!failures.length) return;
  console.log(pc.yellow('\nSome harnesses did not fully sync:'));
  for (const failure of failures) {
    console.log(pc.dim(`  - ${failure.id}: ${failure.errors.join('; ')}`));
  }
  process.exitCode = 1;
}

async function syncGlobalStoreAndLinkedHarnesses(selection = null) {
  if (!await isStoreInitialized()) {
    return { syncedHarnesses: 0, storeSkillsCount: 0 };
  }

  const manifest = await getManifest();
  const storeSkills = path.join(STORE_PATH, 'skills');
  await fs.ensureDir(storeSkills);

  const existingStoreOwnedSkills = Object.keys(manifest.bundledOwned?.skills || {});
  let skillMode = selection?.selectedSkills || (selection?.mode && selection.mode !== 'leave-as-is' ? selection.mode : null);
  if (!skillMode && existingStoreOwnedSkills.length > 0) {
    skillMode = existingStoreOwnedSkills;
  }
  if (!skillMode && manifest.lastSkillPopulate?.mode) {
    skillMode = manifest.lastSkillPopulate.mode;
  }

  let copiedSkills = [];
  if (skillMode) {
    copiedSkills = await populateSkills(skillMode);
  }

  const existingStoreOwnedWorkflows = Object.keys(manifest.bundledOwned?.workflows || {});
  if (existingStoreOwnedWorkflows.length > 0) {
    await populateWorkflows(existingStoreOwnedWorkflows);
  } else if (manifest.lastWorkflowPopulate?.mode) {
    await populateWorkflows(manifest.lastWorkflowPopulate.mode);
  }

  if (manifest.linkedHarnesses && manifest.linkedHarnesses.length > 0) {
    const detected = detectHarnesses();
    const linked = detected.filter(h => manifest.linkedHarnesses.includes(h.id));
    if (linked.length > 0) {
      console.log(pc.cyan(`\n📡 Syncing refreshed store to ${linked.length} linked IDE(s)...\n`));
      const envSyncMode = process.env.TAKOMI_HARNESS_SYNC_MODE;
      const syncMode = normalizeHarnessSyncMode(envSyncMode || manifest.syncMode || 'copy');
      const syncSummary = await syncToAllHarnesses(linked, STORE_PATH, {
        useOwnership: true,
        owned: manifest.harnessOwned,
        linkMode: syncMode,
      });
      const syncFailures = collectSyncFailures(syncSummary);
      manifest.harnessOwned = manifest.harnessOwned || {};
      for (const harness of linked) {
        manifest.harnessOwned[harness.id] = syncSummary[harness.id]?.owned || manifest.harnessOwned[harness.id] || {};
      }
      await writeManifest(manifest);
      printSyncFailures(syncFailures);
      const successfulCount = linked.length - syncFailures.length;
      console.log(pc.green(`✔ Synced to ${successfulCount}/${linked.length} connected IDE(s).`));
      return { syncedHarnesses: successfulCount, storeSkillsCount: copiedSkills.length };
    }
  }

  return { syncedHarnesses: 0, storeSkillsCount: copiedSkills.length };
}

async function installSkillsTarget() {
  console.log(pc.magenta('🧰 Takomi Skills Install\n'));
  try {
    const selection = await promptSkillsInstallSelection();
    if (!selection) return;

    const storeActive = await isStoreInitialized();
    const manifest = storeActive ? await getManifest() : null;
    const piLinkedToStore = Boolean(manifest?.linkedHarnesses?.includes('pi'));

    if (selection.leaveAsIs) {
      if (!piLinkedToStore) {
        printSkillsInstallSummary({
          leaveAsIs: true,
          targetRoot: SKILLS_ROOT,
          ownedCount: selection.ownedCount || (await getInstalledTakomiSkillNames()).length,
        });
      }
      const storeSyncResult = await syncGlobalStoreAndLinkedHarnesses(null);
      if (!storeSyncResult.syncedHarnesses && !piLinkedToStore) {
        console.log(pc.dim('\nGlobal skills were not changed.\n'));
      }
      return;
    }

    if (!piLinkedToStore) {
      const result = await installBundledSkills(program.version(), selection);
      const validation = await validateSkillsInstall(selection.selectedSkills);
      printSkillsInstallSummary(result, validation);
    }

    const storeSyncResult = await syncGlobalStoreAndLinkedHarnesses(selection);
    if (!storeSyncResult.syncedHarnesses && !piLinkedToStore) {
      console.log(pc.dim('\nShared skills target is ready. For per-harness global paths, run "takomi setup" or "takomi sync".\n'));
    }
  } catch (error) {
    console.log(pc.red('\nSkills install failed.'));
    console.log(pc.dim(String(error?.message || error)));
  }
}

async function installAllTargets(options = {}) {
  await installPiTarget(options);
  await installSkillsTarget();
}

async function offerRawPiSubagentsHardening({ interactive = process.stdin.isTTY && process.stdout.isTTY } = {}) {
  const audit = await inspectRawPiSubagentsActivation({ cwd: process.cwd() });
  if (!audit.findings.length) return;

  console.log(pc.yellow('\n⚠ Raw Pi subagents activation detected'));
  console.log(pc.dim(formatRawPiSubagentsFindings(audit.findings)));
  console.log(pc.dim('\nTakomi keeps pi-subagents installed as an internal module, but raw Pi activation exposes the separate `subagent` tool next to `takomi_subagent`.'));

  let shouldDisable = process.env.TAKOMI_DISABLE_RAW_PI_SUBAGENTS === '1';
  if (interactive && process.env.TAKOMI_DISABLE_RAW_PI_SUBAGENTS !== '1') {
    const response = await prompts({
      type: 'confirm',
      name: 'disable',
      message: 'Disable raw Pi subagents activation so agents only see takomi_subagent?',
      initial: true,
    });
    shouldDisable = response.disable === true;
  }

  if (!shouldDisable) {
    console.log(pc.yellow(interactive
      ? 'Leaving raw Pi subagents activation unchanged.'
      : 'Non-interactive run: leaving raw Pi subagents activation unchanged. Set TAKOMI_DISABLE_RAW_PI_SUBAGENTS=1 to disable automatically.'));
    return;
  }

  const result = await disableRawPiSubagentsActivation({ cwd: process.cwd() });
  console.log(pc.green('✔ Disabled raw Pi subagents activation'));
  console.log(pc.dim(formatRawPiSubagentsDisableActions(result.actions)));
}

async function installPiTarget(options = {}) {
  const { offerOptionalFeatures = true } = options;
  console.log(pc.magenta('🧭 Pi Harness Preflight\n'));
  const report = await runDoctor({ version: program.version() });

  if (!report.pi.installed) {
    console.log(pc.cyan('\n📦 Installing Pi...\n'));
    const installResult = await ensurePiInstalled();
    printPiInstallResult(installResult);
    if (!installResult.ok) {
      console.log(pc.yellow('\nPi harness install stopped because Pi could not be installed.'));
      console.log(pc.dim('Retry manually with: npm install -g @earendil-works/pi-coding-agent\n'));
      return;
    }
  }

  if (!report.piSubagents.localInstalled && !report.piSubagents.globalInstalled) {
    console.log(pc.cyan('\n📦 Installing pi-subagents...\n'));
    const installResult = await ensurePiSubagentsInstalled();
    printPiSubagentsInstallResult(installResult);
    if (!installResult.ok) {
      console.log(pc.yellow('\nPi harness install stopped because pi-subagents could not be installed.'));
      console.log(pc.dim('Retry manually with: npm install -g pi-subagents\n'));
      return;
    }
  }

  console.log(pc.cyan('\n📦 Installing Takomi Pi harness assets...\n'));
  try {
    const result = await installPiHarnessAssets(program.version());
    const validation = await validatePiHarnessInstall();
    printPiInstallSummary(result, validation);
    await offerRawPiSubagentsHardening();
    if (offerOptionalFeatures) {
      console.log(pc.cyan('\n🧩 Optional Takomi Pi feature packs...\n'));
      await offerPiOptionalFeatures({ interactive: true });
    }
    console.log(pc.cyan('\n📦 Checking Pi-managed extension package updates...\n'));
    printPiManagedPackageUpdateResult(await updatePiManagedPackages());
    await offerRawPiSubagentsHardening();
    console.log(pc.dim('\nNext: cd <project> && takomi\n'));
  } catch (error) {
    console.log(pc.red('\nPi harness asset install failed.'));
    console.log(pc.dim(String(error?.message || error)));
  }
}

async function installPiOptionalFeaturesTarget() {
  console.log(pc.magenta('🧩 Takomi Optional Pi Features\n'));
  const pi = await ensurePiInstalled();
  printPiInstallResult(pi);
  if (!pi.ok) return;
  await offerPiOptionalFeatures({ interactive: true });
  await offerRawPiSubagentsHardening();
  console.log(pc.cyan('\n📦 Checking Pi-managed extension package updates...\n'));
  printPiManagedPackageUpdateResult(await updatePiManagedPackages());
  await offerRawPiSubagentsHardening();
}

async function syncPiTarget() {
  console.log(pc.magenta('📡 Takomi Pi Sync\n'));
  try {
    const result = await syncPiHarnessAssets(program.version());
    const validation = await validatePiHarnessInstall();
    printPiInstallSummary(result, validation);
    await offerRawPiSubagentsHardening();
    console.log(pc.cyan('\n📦 Checking Pi-managed extension package updates...\n'));
    printPiManagedPackageUpdateResult(await updatePiManagedPackages());
    await offerRawPiSubagentsHardening();
  } catch (error) {
    console.log(pc.red('\nPi sync failed.'));
    console.log(pc.dim(String(error?.message || error)));
  }
}

async function syncSkillsTarget() {
  console.log(pc.magenta('📡 Takomi Skills Sync\n'));
  try {
    const selection = await promptSkillsInstallSelection();
    if (!selection) return;

    const storeActive = await isStoreInitialized();
    const manifest = storeActive ? await getManifest() : null;
    const piLinkedToStore = Boolean(manifest?.linkedHarnesses?.includes('pi'));

    if (selection.leaveAsIs) {
      if (!piLinkedToStore) {
        printSkillsInstallSummary({
          leaveAsIs: true,
          targetRoot: SKILLS_ROOT,
          ownedCount: selection.ownedCount || (await getInstalledTakomiSkillNames()).length,
        });
      }
      const storeSyncResult = await syncGlobalStoreAndLinkedHarnesses(null);
      if (!storeSyncResult.syncedHarnesses && !piLinkedToStore) {
        console.log(pc.dim('\nGlobal skills were not changed.\n'));
      }
      return;
    }

    if (!piLinkedToStore) {
      const result = await installBundledSkills(program.version(), selection);
      const validation = await validateSkillsInstall(selection.selectedSkills);
      printSkillsInstallSummary(result, validation);
    }

    const storeSyncResult = await syncGlobalStoreAndLinkedHarnesses(selection);
    if (!storeSyncResult.syncedHarnesses && !piLinkedToStore) {
      console.log(pc.dim('\nShared skills target is ready. For per-harness global paths, run "takomi setup" or "takomi sync".\n'));
    }
  } catch (error) {
    console.log(pc.red('\nSkills sync failed.'));
    console.log(pc.dim(String(error?.message || error)));
  }
}

async function syncAllTargets() {
  await syncPiTarget();
  await syncSkillsTarget();
}

async function setup(target) {
  await install(target);
}

async function refresh(target = 'all') {
  const normalizedTarget = target || 'all';

  if (normalizedTarget === 'project') {
    await updateProjectResources();
    return;
  }

  await upgrade(normalizedTarget);
}

async function upgrade(target = 'all') {
  const normalizedTarget = target || 'all';
  const supportedTargets = new Set(['all', 'pi', 'skills', 'cli']);

  if (!supportedTargets.has(normalizedTarget)) {
    console.log(pc.yellow(`Unsupported upgrade target: ${normalizedTarget}`));
    console.log(pc.dim('Supported targets: all, cli, pi, skills'));
    console.log(pc.dim('Use plain "takomi upgrade" for the one-command upgrade path.\n'));
    return;
  }

  console.log(pc.magenta('⬆ Takomi One-Command Upgrade\n'));

  const upgradeExitCode = upgradeTakomiPackage();
  if (upgradeExitCode !== 0) {
    process.exitCode = upgradeExitCode;
    return;
  }

  if (normalizedTarget === 'cli') {
    return;
  }

  if (normalizedTarget === 'pi') {
    console.log(pc.cyan('\n📦 Updating Pi CLI...\n'));
    printPiInstallResult(await updatePiCliPackage());
    await installPiTarget({ offerOptionalFeatures: false });
    return;
  }

  if (normalizedTarget === 'skills') {
    await installSkillsTarget();
    return;
  }

  console.log(pc.cyan('\n📦 Updating Pi CLI...\n'));
  printPiInstallResult(await updatePiCliPackage());
  await installAllTargets({ offerOptionalFeatures: false });
  console.log(pc.magenta('\n✨ Fully upgraded. Next: run `takomi` from your project.\n'));
}

function printUnsupportedInstallTarget(target) {
  console.log(pc.yellow(`Unsupported install target: ${target}`));
  console.log(pc.dim('Supported targets right now: pi, pi-features, skills, all'));
  console.log(pc.dim('Use plain "takomi install" for the existing interactive global installer.\n'));
}

function printUnsupportedSyncTarget(target) {
  console.log(pc.yellow(`Unsupported sync target: ${target}`));
  console.log(pc.dim('Supported targets right now: pi, skills, all'));
  console.log(pc.dim('Use plain "takomi sync" for the existing interactive global sync.\n'));
}

// ─────────────────────────────────────────────────────────────────────────────
// takomi install (NEW — Global Setup + Harness Routing)
// ─────────────────────────────────────────────────────────────────────────────

async function install(target) {
  if (target) {
    if (target === 'pi') {
      await installPiTarget();
      return;
    }
    if (target === 'skills') {
      await installSkillsTarget();
      return;
    }
    if (target === 'pi-features' || target === 'features' || target === 'optional') {
      await installPiOptionalFeaturesTarget();
      return;
    }
    if (target === 'all') {
      await installAllTargets();
      return;
    }

    printUnsupportedInstallTarget(target);
    return;
  }
  console.log(pc.magenta(figlet.textSync('Takomi', { horizontalLayout: 'full' })));
  console.log(pc.cyan('   🌐 One install. Every IDE. Zero friction.\n'));

  // 1. Detect harnesses
  const detected = detectHarnesses();
  printHarnessStatus(detected);

  if (detected.length === 0) {
    console.log(pc.yellow('  No AI harnesses detected on this machine.'));
    console.log(pc.dim(`  We support: ${Object.values(HARNESS_MAP).map(h => h.name).join(', ')}`));
    console.log(pc.dim('  Run "takomi init" instead for per-project setup.\n'));
    return;
  }

  // 2. Let user select which harnesses to configure
  const harnessResponse = await prompts({
    type: 'multiselect',
    name: 'harnesses',
    message: 'Which harnesses should we configure?',
    choices: detected.map(h => ({
      title: h.name,
      value: h.id,
      selected: true,
      description: path.relative(process.env.USERPROFILE || process.env.HOME || '', h.rootPath),
    })),
    min: 1,
    hint: '- Space to select. Return to submit',
  });

  if (!harnessResponse.harnesses || harnessResponse.harnesses.length === 0) return;

  const selectedHarnesses = detected.filter(h => harnessResponse.harnesses.includes(h.id));
  const existingStoreManifest = await getManifest();
  const existingStoreOwnedSkills = Object.keys(existingStoreManifest.bundledOwned?.skills || {});
  const existingStoreOwnedWorkflows = Object.keys(existingStoreManifest.bundledOwned?.workflows || {});
  const hasExistingStoreSkills = existingStoreOwnedSkills.length > 0;
  const hasExistingStoreWorkflows = existingStoreOwnedWorkflows.length > 0;

  // 3. Ask what to install
  const contentResponse = await prompts([
    {
      type: 'multiselect',
      name: 'content',
      message: 'What should we install globally?',
      choices: [
        { title: 'Skills', value: 'skills', selected: true, description: `${(await getSkills()).length} available` },
        { title: 'Workflows', value: 'workflows', selected: true, description: `${(await getWorkflows()).length} available` },
        { title: 'Agent YAMLs (custom_modes.yaml → KiloCode)', value: 'yamls', selected: selectedHarnesses.some(h => h.id === 'kilocode'), description: 'For KiloCode modes' },
      ],
      min: 1,
      hint: '- Space to select. Return to submit',
    },
    // Skill pack selection
    {
      type: (prev, values) => values.content.includes('skills') ? 'select' : null,
      name: 'skillMode',
      message: 'Which skill pack?',
      choices: [
        ...(hasExistingStoreSkills ? [{ title: 'Leave As Is (Recommended)', value: 'leave-as-is', description: `Keep ${existingStoreOwnedSkills.length} Takomi-managed store skill${existingStoreOwnedSkills.length === 1 ? '' : 's'} unchanged.` }] : []),
        ...(hasExistingStoreSkills ? [{ title: 'Present Custom', value: 'present-custom', description: 'Review current Takomi-managed store skills and adjust selections.' }] : []),
        { title: 'Core (Recommended defaults)', value: 'core', description: `8 essentials (${formatCoreSkillsSummary()})` },
        { title: `All (${(await getSkills()).length} skills)`, value: 'all' },
        { title: 'Custom selection', value: 'custom' },
      ],
    },
    // Workflow pack selection
    {
      type: (prev, values) => values.content.includes('workflows') ? 'select' : null,
      name: 'workflowMode',
      message: 'Which workflow pack?',
      choices: [
        ...(hasExistingStoreWorkflows ? [{ title: 'Leave As Is (Recommended)', value: 'leave-as-is', description: `Keep ${existingStoreOwnedWorkflows.length} Takomi-managed workflow${existingStoreOwnedWorkflows.length === 1 ? '' : 's'} unchanged.` }] : []),
        { title: 'Core (16 essentials)', value: 'core', description: 'vibe-build, mode-architect...' },
        { title: `All (${(await getWorkflows()).length} workflows)`, value: 'all' },
        { title: 'All (Exclude Legacy)', value: 'no-legacy' },
        { title: 'Custom selection', value: 'custom' },
      ],
    },
    {
      type: (prev, values) => values.workflowMode === 'custom' ? 'multiselect' : null,
      name: 'selectedWorkflows',
      message: 'Select workflows:',
      choices: async () => {
        const workflows = await getWorkflows();
        return workflows.map(w => ({ title: w, value: w }));
      },
      hint: '- Space to select. Return to submit',
    },
  ]);

  if (!contentResponse.content) return;

  const syncMode = await promptHarnessSyncMode(
    (hasExistingStoreSkills || hasExistingStoreWorkflows) ? existingStoreManifest.syncMode : 'auto'
  );
  if (!syncMode) return;

  try {
    // 4. Initialize global store
    console.log(pc.cyan(`\n📦 Creating global store (${STORE_PATH})...\n`));
    await initGlobalStore();

    // 5. Populate store from package assets
    if (contentResponse.content.includes('skills')) {
      let skillMode = contentResponse.skillMode;
      if (contentResponse.skillMode === 'leave-as-is') {
        console.log(pc.green(`  ✔ Left ${existingStoreOwnedSkills.length} Takomi-managed store skill${existingStoreOwnedSkills.length === 1 ? '' : 's'} unchanged`));
      } else {
        if (contentResponse.skillMode === 'present-custom') {
          const customSelection = await promptCustomSkillSelection(existingStoreOwnedSkills, { selectAllForNewCategories: true, title: 'Present Global Store Custom Skills' });
          if (!customSelection) return;
          skillMode = customSelection;
        } else if (contentResponse.skillMode === 'custom') {
          const customSelection = await promptCustomSkillSelection([], { selectAllForNewCategories: true, title: 'Global Store Custom Skills' });
          if (!customSelection) return;
          skillMode = customSelection;
        }

        const plan = await buildStoreSkillsReconcilePlan(skillMode);
        if (plan.toRemove.length > 0) {
          console.log(pc.yellow('\nTakomi will remove deselected Takomi-managed skills from the global store only:'));
          for (const skill of plan.toRemove) console.log(pc.dim(`  - ${skill}`));
          console.log(pc.dim('\nManual/imported store skills and modified Takomi skills are preserved.'));
          const confirmStorePrune = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `Remove ${plan.toRemove.length} Takomi-managed store skill${plan.toRemove.length === 1 ? '' : 's'}?`,
            initial: false,
          });
          if (!confirmStorePrune.confirm) {
            console.log(pc.green('  ✔ Left global store skills unchanged'));
            skillMode = null;
          }
        }

        if (skillMode) {
          const skills = await populateSkills(skillMode);
          console.log(pc.green(`  ✔ ${skills.length} skills loaded into store`));
        }
      }
    }

    if (contentResponse.content.includes('workflows')) {
      let workflowMode = contentResponse.workflowMode === 'custom'
        ? contentResponse.selectedWorkflows
        : contentResponse.workflowMode;
      if (contentResponse.workflowMode === 'leave-as-is') {
        console.log(pc.green(`  ✔ Left ${existingStoreOwnedWorkflows.length} Takomi-managed workflow${existingStoreOwnedWorkflows.length === 1 ? '' : 's'} unchanged`));
      } else {
        const plan = await buildStoreWorkflowsReconcilePlan(workflowMode);
        if (plan.toRemove.length > 0) {
          console.log(pc.yellow('\nTakomi will remove deselected Takomi-managed workflows from the global store only:'));
          for (const workflow of plan.toRemove) console.log(pc.dim(`  - ${workflow}`));
          console.log(pc.dim('\nManual/imported store workflows and modified Takomi workflows are preserved.'));
          const confirmWorkflowPrune = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `Remove ${plan.toRemove.length} Takomi-managed workflow${plan.toRemove.length === 1 ? '' : 's'}?`,
            initial: false,
          });
          if (!confirmWorkflowPrune.confirm) {
            console.log(pc.green('  ✔ Left global store workflows unchanged'));
            workflowMode = null;
          }
        }

        if (workflowMode) {
          const workflows = await populateWorkflows(workflowMode);
          console.log(pc.green(`  ✔ ${workflows.length} workflows loaded into store`));
        }
      }
    }

    if (contentResponse.content.includes('yamls')) {
      const yamls = await populateAgentYamls();
      console.log(pc.green(`  ✔ ${yamls.length} agent YAMLs loaded into store`));
    }

    // 6. Sync store to all selected harnesses
    console.log(pc.cyan('\n📡 Syncing to harnesses...\n'));
    let manifest = await getManifest();
    const syncSummary = await syncToAllHarnesses(selectedHarnesses, STORE_PATH, {
      useOwnership: true,
      owned: manifest.harnessOwned,
      linkMode: syncMode,
    });

    // 7. Update manifest
    const syncFailures = collectSyncFailures(syncSummary);
    const successfulHarnesses = selectedHarnesses.filter(h => !syncFailures.some(failure => failure.id === h.id));
    manifest = await getManifest();
    manifest.linkedHarnesses = successfulHarnesses.map(h => h.id);
    manifest.syncMode = syncMode;
    manifest.installed.skills = await getStoreSkills();
    manifest.installed.workflows = await getStoreWorkflows();
    manifest.harnessOwned = manifest.harnessOwned || {};
    for (const harness of selectedHarnesses) {
      manifest.harnessOwned[harness.id] = syncSummary[harness.id]?.owned || manifest.harnessOwned[harness.id] || {};
    }
    await writeManifest(manifest);
    printSyncFailures(syncFailures);

    // 8. Summary
    console.log(pc.magenta(syncFailures.length ? '\n⚠ Your command center is partially synced. ⚠' : '\n✨ Your command center is live. ✨'));
    console.log(pc.white(`\n  Store:     ${STORE_PATH}`));
    console.log(pc.white(`  Sync mode: ${syncMode}`));
    console.log(pc.white(`  Connected: ${successfulHarnesses.map(h => h.name).join(', ') || 'none'}`));
    console.log(pc.dim(`\n  Add skills:    takomi add <github-url>`));
    console.log(pc.dim(`  Sync updates:  takomi sync\n`));

  } catch (error) {
    console.error(pc.red('\nError during global installation:'), error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// takomi sync (NEW — Re-sync store to all harnesses)
// ─────────────────────────────────────────────────────────────────────────────

async function sync(target) {
  if (target) {
    if (target === 'pi') {
      await syncPiTarget();
      return;
    }
    if (target === 'skills') {
      await syncSkillsTarget();
      return;
    }
    if (target === 'all') {
      await syncAllTargets();
      return;
    }
    printUnsupportedSyncTarget(target);
    return;
  }
  console.log(pc.magenta('📡 Syncing your toolkit to all connected IDEs...\n'));

  // Check if global store exists
  if (!await isStoreInitialized()) {
    console.log(pc.yellow('No command center found. Run "takomi install" first.\n'));
    return;
  }

  const manifest = await getManifest();
  const detected = detectHarnesses();

  if (detected.length === 0) {
    console.log(pc.yellow('No AI harnesses detected.\n'));
    return;
  }

  // Let user pick which harnesses to sync to
  const response = await prompts({
    type: 'multiselect',
    name: 'harnesses',
    message: 'Sync to which harnesses?',
    choices: detected.map(h => ({
      title: h.name,
      value: h.id,
      selected: manifest.linkedHarnesses.includes(h.id),
    })),
    min: 1,
    hint: '- Space to select. Return to submit',
  });

  if (!response.harnesses || response.harnesses.length === 0) return;

  const selectedHarnesses = detected.filter(h => response.harnesses.includes(h.id));

  const envSyncMode = process.env.TAKOMI_HARNESS_SYNC_MODE;
  const syncMode = normalizeHarnessSyncMode(envSyncMode || manifest.syncMode || 'copy');
  console.log(pc.cyan(`\n📡 Syncing from global store (${syncMode})...\n`));
  const syncSummary = await syncToAllHarnesses(selectedHarnesses, STORE_PATH, {
    useOwnership: true,
    owned: manifest.harnessOwned,
    linkMode: syncMode,
  });

  // Update manifest with current harnesses
  const syncFailures = collectSyncFailures(syncSummary);
  const successfulHarnessIds = response.harnesses.filter(id => !syncFailures.some(failure => failure.id === id));
  manifest.linkedHarnesses = [...new Set([...manifest.linkedHarnesses, ...successfulHarnessIds])];
  if (!envSyncMode) manifest.syncMode = syncMode;
  manifest.harnessOwned = manifest.harnessOwned || {};
  for (const harness of selectedHarnesses) {
    manifest.harnessOwned[harness.id] = syncSummary[harness.id]?.owned || manifest.harnessOwned[harness.id] || {};
  }
  await writeManifest(manifest);
  printSyncFailures(syncFailures);

  const skills = await getStoreSkills();
  const workflows = await getStoreWorkflows();
  const syncedCount = successfulHarnessIds.length;
  console.log(pc.magenta(syncFailures.length
    ? `\n⚠ ${skills.length} skills and ${workflows.length} workflows partially synced to ${syncedCount}/${selectedHarnesses.length} IDE(s).\n`
    : `\n✨ ${skills.length} skills and ${workflows.length} workflows synced to ${syncedCount} IDE(s). Ready to build.\n`));
}

// ─────────────────────────────────────────────────────────────────────────────
// takomi add <url> (NEW — Fetch remote skills from GitHub)
// ─────────────────────────────────────────────────────────────────────────────

async function add(url) {
  console.log(pc.magenta('📥 Adding new capabilities to your toolkit...\n'));

  // Parse GitHub URL → owner/repo
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) {
    console.log(pc.red('That doesn\'t look like a GitHub URL. Expected: https://github.com/owner/repo'));
    return;
  }

  const repoSlug = match[1].replace(/\.git$/, '');
  console.log(pc.dim(`  Repo: ${repoSlug}\n`));

  // Initialize store if needed
  await initGlobalStore();

  // Try to find skills in common locations
  const skillsDest = path.join(STORE_PATH, 'skills');
  const workflowsDest = path.join(STORE_PATH, 'workflows');

  console.log(pc.cyan('📡 Fetching from GitHub...\n'));

  // Try assets/.agent/skills/ first (Takomi structure)
  const githubOptions = { repo: repoSlug };

  let skillCount = await downloadDirectoryFromGitHub(
    'assets/.agent/skills',
    skillsDest,
    null,
    250,
    githubOptions
  );

  // Fallback: try .agent/skills/
  if (skillCount === 0) {
    skillCount = await downloadDirectoryFromGitHub(
      '.agent/skills',
      skillsDest,
      null,
      250,
      githubOptions
    );
  }

  // Try workflows
  let workflowCount = await downloadDirectoryFromGitHub(
    'assets/.agent/workflows',
    workflowsDest,
    (item) => item.name.endsWith('.md'),
    250,
    githubOptions
  );

  if (workflowCount === 0) {
    workflowCount = await downloadDirectoryFromGitHub(
      '.agent/workflows',
      workflowsDest,
      (item) => item.name.endsWith('.md'),
      250,
      githubOptions
    );
  }

  if (skillCount === 0 && workflowCount === 0) {
    console.log(pc.yellow('  No skills or workflows found in repo.'));
    console.log(pc.dim('  Expected structure: .agent/skills/ or assets/.agent/skills/\n'));
    return;
  }

  console.log(pc.green(`\n  ✔ ${skillCount} skills and ${workflowCount} workflows added to your command center.`));

  // Update manifest
  const manifest = await getManifest();
  manifest.installed.skills = await getStoreSkills();
  manifest.installed.workflows = await getStoreWorkflows();
  await writeManifest(manifest);

  // Offer to sync
  if (manifest.linkedHarnesses.length > 0) {
    const syncResponse = await prompts({
      type: 'confirm',
      name: 'doSync',
      message: 'Push these to your connected IDEs now?',
      initial: true,
    });

    if (syncResponse.doSync) {
      const detected = detectHarnesses();
      const linked = detected.filter(h => manifest.linkedHarnesses.includes(h.id));
      const syncSummary = await syncToAllHarnesses(linked, STORE_PATH, {
        useOwnership: true,
        owned: manifest.harnessOwned,
        linkMode: normalizeHarnessSyncMode(process.env.TAKOMI_HARNESS_SYNC_MODE || manifest.syncMode || 'copy'),
      });
      const syncFailures = collectSyncFailures(syncSummary);
      manifest.harnessOwned = manifest.harnessOwned || {};
      for (const harness of linked) {
        manifest.harnessOwned[harness.id] = syncSummary[harness.id]?.owned || manifest.harnessOwned[harness.id] || {};
      }
      await writeManifest(manifest);
      printSyncFailures(syncFailures);
      console.log(pc.magenta(syncFailures.length
        ? `\n⚠ Live on ${linked.length - syncFailures.length}/${linked.length} IDE(s); some harnesses need attention.\n`
        : `\n✨ Live on ${linked.length} IDE(s). You're armed and ready.\n`));
    }
  } else {
    console.log(pc.dim('\n  Run "takomi sync" when you want to push these to your IDEs.\n'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// takomi harnesses (NEW — Show detected harnesses + status)
// ─────────────────────────────────────────────────────────────────────────────

async function harnesses() {
  console.log(pc.magenta('🔌 Your Connected IDEs\n'));

  const detected = detectHarnesses();
  printHarnessStatus(detected);

  // Show store status if initialized
  if (await isStoreInitialized()) {
    const manifest = await getManifest();
    const skills = await getStoreSkills();
    const workflows = await getStoreWorkflows();

    console.log(pc.cyan('📦 Command Center Status\n'));
    console.log(pc.white(`  Location:  ${STORE_PATH}`));
    console.log(pc.white(`  Skills:    ${skills.length} ready to deploy`));
    console.log(pc.white(`  Workflows: ${workflows.length} available`));
    console.log(pc.white(`  Sync mode: ${manifest.syncMode || 'copy'}`));
    console.log(pc.white(`  Connected: ${manifest.linkedHarnesses.join(', ') || 'none'}`));
    console.log(pc.dim(`  Updated:   ${manifest.updatedAt}\n`));
  } else {
    console.log(pc.dim('  No command center yet. Run "takomi install" to build your toolkit.\n'));
  }
}

async function status() {
  await harnesses();
}

async function updateProjectResources() {
  console.log(pc.magenta('📡 Updating your toolkit from GitHub...\n'));

  const storeExists = await isStoreInitialized();

  const response = await prompts([
    {
      type: 'multiselect',
      name: 'components',
      message: 'What components do you want to update from GitHub?',
      choices: [
        { title: '.agent (Workflows & Skills)', value: 'agent', selected: true },
        { title: 'Agent YAMLs', value: 'yamls' },
        { title: 'Legacy Protocols', value: 'legacy' },
        ...(storeExists ? [{ title: 'Global Store', value: 'global', description: 'Update ~/.takomi/' }] : []),
      ],
      hint: '- Space to select. Return to submit'
    }
  ]);

  if (!response.components || response.components.length === 0) return;

  const destRoot = process.cwd();
  let remoteDownloadCount = 0;
  let remoteUpdateRequested = false;
  const remoteFailures = [];
  const runRemoteUpdate = async (label, updater) => {
    remoteUpdateRequested = true;
    try {
      remoteDownloadCount += await updater();
    } catch (error) {
      remoteFailures.push(`${label}: ${error.message}`);
    }
  };

  if (response.components.includes('agent')) {
    const agentDest = path.join(destRoot, '.agent');
    await runRemoteUpdate('workflows', () => updateWorkflows(path.join(agentDest, 'workflows')));
    await runRemoteUpdate('skills', () => updateSkills(path.join(agentDest, 'skills')));
  }

  if (response.components.includes('yamls')) {
    await runRemoteUpdate('agent YAMLs', () => updateAgentYamls(path.join(destRoot, 'Takomi-Agents')));
  }

  if (response.components.includes('legacy')) {
    await runRemoteUpdate('legacy protocols', () => updateLegacyManual(path.join(destRoot, 'Legacy-Protocols')));
  }

  // Update global store if selected
  if (response.components.includes('global')) {
    console.log(pc.cyan('\n📡 Updating global store from package assets...\n'));
    const skills = await populateSkills('all');
    const workflows = await populateWorkflows('all');
    const yamls = await populateAgentYamls();
    console.log(pc.green(`  ✔ ${skills.length} skills, ${workflows.length} workflows, ${yamls.length} YAMLs updated`));

    // Auto-sync to linked harnesses
    const manifest = await getManifest();
    if (manifest.linkedHarnesses.length > 0) {
      const detected = detectHarnesses();
      const linked = detected.filter(h => manifest.linkedHarnesses.includes(h.id));
      if (linked.length > 0) {
        const syncMode = normalizeHarnessSyncMode(process.env.TAKOMI_HARNESS_SYNC_MODE || manifest.syncMode || 'copy');
        console.log(pc.cyan(`\n📡 Auto-syncing to linked harnesses (${syncMode})...\n`));
        const syncSummary = await syncToAllHarnesses(linked, STORE_PATH, {
          useOwnership: true,
          owned: manifest.harnessOwned,
          linkMode: syncMode,
        });
        const syncFailures = collectSyncFailures(syncSummary);
        manifest.harnessOwned = manifest.harnessOwned || {};
        for (const harness of linked) {
          manifest.harnessOwned[harness.id] = syncSummary[harness.id]?.owned || manifest.harnessOwned[harness.id] || {};
        }
        printSyncFailures(syncFailures);
      }
    }

    manifest.installed.skills = await getStoreSkills();
    manifest.installed.workflows = await getStoreWorkflows();
    await writeManifest(manifest);
  }

  if (remoteFailures.length) {
    console.log(pc.red('\nSome project resources failed to download from GitHub:'));
    for (const failure of remoteFailures) console.log(pc.dim(`  - ${failure}`));
    process.exitCode = 1;
    return;
  }

  if (remoteUpdateRequested && remoteDownloadCount === 0) {
    console.log(pc.red('\nNo project resources were downloaded from GitHub. Check the network or repository paths.'));
    process.exitCode = 1;
    return;
  }

  console.log(pc.magenta('\n✨ Your toolkit is fresh and ready to ship.'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Registration
// ─────────────────────────────────────────────────────────────────────────────

program
  .name('takomi')
  .description('Your AI team. Activated. 🎯')
  .version(packageJson.version)
  .addHelpText('after', `
Primary flow:
  takomi setup        Set Takomi up once
  takomi refresh      Update/upgrade/sync everything
  takomi status       Check what is connected
  takomi              Launch Takomi in this project

Examples:
  takomi setup pi     Set up the Pi harness
  takomi setup pi-features  Add optional Pi feature packs
  takomi setup skills Install bundled skills
  takomi setup project
  takomi refresh      One-command maintenance
  takomi refresh pi   Refresh only Pi-related pieces

Legacy aliases still work:
  install -> setup, sync -> sync, upgrade -> refresh, init -> setup project,
  harnesses -> status, update -> refresh project
`);

program
  .command('setup [target]')
  .description('Set up Takomi: guided setup, or setup pi|pi-features|skills|project|all')
  .action(async (target) => {
    if (target === 'project') {
      await init();
      return;
    }
    await setup(target);
  });

program
  .command('refresh [target]')
  .description('One-command refresh: update Takomi plus Pi/assets/skills, or refresh pi|skills|project|all')
  .action(refresh);

program
  .command('status')
  .description('Show connected IDEs and Takomi toolkit status')
  .action(status);

program
  .command('stats [view]')
  .description('Show Takomi token, model, project, session, tool, and subagent usage stats')
  .option('--json', 'Print machine-readable JSON')
  .option('--full', 'Print the detailed debug-style stats view')
  .option('--home <path>', 'Override home directory for Pi history scanning')
  .option('--cwd <path>', 'Override project directory for project-local stats')
  .option('--sessions-root <paths>', 'Additional session JSONL root(s), separated by ; on Windows or : on POSIX')
  .option('--project-root <paths>', 'Discover project-local .pi/takomi and .pi/agent/sessions roots under these path(s)')
  .option('--run-history <path>', 'Additional subagent run-history JSONL file')
  .option('--stats-config <path>', 'Local stats config JSON file (defaults to ~/.takomi/stats.local.json, then .takomi-stats.local.json)')
  .option('--since <date|range>', 'Filter from YYYY-MM-DD or relative range like 7d, 4w, 3m')
  .option('--limit <n>', 'Rows per section', '8')
  .action((view, options) => printTakomiStats({ ...options, view, limit: Number(options.limit) || 8 }));

// Per-project setup (legacy alias)
program
  .command('init', { hidden: true })
  .description('Legacy alias: use "takomi setup project"')
  .action(init);

// Global installer (legacy alias)
program
  .command('install [target]', { hidden: true })
  .description('Legacy alias: use "takomi setup [target]"')
  .action(setup);

// Re-sync (legacy alias)
program
  .command('sync [target]', { hidden: true })
  .description('Legacy alias for global store sync')
  .action(sync);

// Add remote skills (NEW)
program
  .command('add <url>')
  .description('Import skills from any GitHub repo')
  .action(add);

// Show harness status (NEW)
program
  .command('harnesses', { hidden: true })
  .description('Legacy alias: use "takomi status"')
  .action(harnesses);

program
  .command('doctor')
  .description('Run Pi/Takomi installation diagnostics')
  .action(() => runDoctor({ version: program.version() }));

program
  .command('check-update', { hidden: true })
  .description('Check whether a newer Takomi package is available')
  .action(() => printTakomiUpdateStatus(program.version()));

program
  .command('upgrade [target]', { hidden: true })
  .description('Legacy alias: use "takomi refresh [target]"')
  .action(refresh);

// Update from GitHub (legacy alias)
program
  .command('update', { hidden: true })
  .description('Legacy alias: use "takomi refresh project"')
  .action(updateProjectResources);

if (process.argv.length <= 2) {
  notifyIfTakomiUpdateAvailable(program.version());
  const exitCode = await launchTakomiHarness(process.cwd());
  process.exitCode = exitCode;
} else {
  program.parse();
}
