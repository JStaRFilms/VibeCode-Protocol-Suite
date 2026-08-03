import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import pc from 'picocolors';
import { PATHS } from './utils.js';
import { STORE_PATH, MANIFEST_PATH } from './store.js';

const TAKOMI_PACKAGE_DIR = PATHS.root;

const HOME = os.homedir();

function getPathEntries() {
  return (process.env.PATH || '').split(path.delimiter).filter(Boolean);
}

function commandExists(command) {
  const pathEntries = getPathEntries();

  // Avoid shelling out on the hot launch path. On Windows, `where pi` is often
  // ~100ms by itself; a direct PATH scan is much cheaper and good enough for
  // npm/cmd shims. Keep `where`/`which` as a fallback for edge cases.
  const manualCandidates = process.platform === 'win32'
    ? (() => {
        const hasExtension = /\.(cmd|exe|bat|com)$/i.test(command);
        const extensions = hasExtension
          ? ['']
          : (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
              .split(';')
              .filter(Boolean)
              .sort((a, b) => (a.toLowerCase() === '.cmd' ? -1 : b.toLowerCase() === '.cmd' ? 1 : 0));
        return pathEntries.flatMap((entry) => extensions.map((extension) => path.join(entry, `${command}${extension.toLowerCase()}`)));
      })()
    : pathEntries.map((entry) => path.join(entry, command));

  for (const candidate of manualCandidates) {
    if (fs.existsSync(candidate)) return { found: true, path: candidate };
  }

  const probe = process.platform === 'win32'
    ? spawnSync('where', [command], { stdio: 'pipe', encoding: 'utf8' })
    : spawnSync('which', [command], { stdio: 'pipe', encoding: 'utf8' });

  if (probe.status === 0) {
    const matches = probe.stdout.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    const preferred = process.platform === 'win32'
      ? matches.find((entry) => /\.(cmd|exe|bat)$/i.test(entry))
      : matches[0];
    return { found: true, path: preferred || matches[0] || null };
  }

  return { found: false, path: null };
}

export function getPiAgentRoot(home = HOME) {
  return path.join(home, '.pi', 'agent');
}

export function getPiGlobalTargets(home = HOME) {
  const agentRoot = getPiAgentRoot(home);
  return {
    root: agentRoot,
    extensions: path.join(agentRoot, 'extensions'),
    prompts: path.join(agentRoot, 'prompts'),
    agents: path.join(agentRoot, 'agents'),
    themes: path.join(agentRoot, 'themes'),
    settings: path.join(agentRoot, 'settings.json'),
    takomi: path.join(home, '.pi', 'takomi'),
    routingPolicy: path.join(home, '.pi', 'takomi', 'model-routing.md'),
  };
}

export function getProjectPiTargets(cwd = process.cwd()) {
  return {
    root: path.join(cwd, '.pi'),
    extensions: path.join(cwd, '.pi', 'extensions'),
    prompts: path.join(cwd, '.pi', 'prompts'),
    agents: path.join(cwd, '.pi', 'agents'),
    themes: path.join(cwd, '.pi', 'themes'),
    settings: path.join(cwd, '.pi', 'settings.json'),
    takomiProfile: path.join(cwd, '.pi', 'takomi-profile.json'),
    routingPolicy: path.join(cwd, '.pi', 'takomi', 'model-routing.md'),
  };
}

export function getBundledPiAssetTargets() {
  const root = path.join(PATHS.root, '.pi');
  return {
    root,
    runtime: path.join(root, 'extensions', 'takomi-runtime'),
    subagents: path.join(root, 'extensions', 'takomi-subagents'),
    contextManager: path.join(root, 'extensions', 'takomi-context-manager'),
    prompts: path.join(root, 'prompts'),
    agents: path.join(root, 'agents'),
    themes: path.join(root, 'themes'),
    settings: path.join(root, 'settings.json'),
    routingPolicy: path.join(root, 'takomi', 'model-routing.md'),
    profile: path.join(root, 'takomi-profile.json'),
  };
}

async function getPackageJson() {
  try {
    return await fs.readJson(PATHS.packageJson);
  } catch {
    return {};
  }
}

async function getPackageFileEntries() {
  const pkg = await getPackageJson();
  return Array.isArray(pkg.files) ? pkg.files : [];
}

function getGlobalNodeModulesRoot(home = HOME) {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm', 'node_modules');
  }
  return path.join(home, '.npm-global', 'lib', 'node_modules');
}

async function readJsonIfExists(filePath) {
  try {
    if (await fs.pathExists(filePath)) return await fs.readJson(filePath);
  } catch {}
  return null;
}

async function writeJsonWithBackup(filePath, value, backupLabel = 'takomi-backup') {
  await fs.ensureDir(path.dirname(filePath));
  if (await fs.pathExists(filePath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copy(filePath, `${filePath}.${backupLabel}-${stamp}`);
  }
  await fs.writeJson(filePath, value, { spaces: 2 });
}

function removeRawPiSubagentsPackageEntries(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { changed: false, settings };
  if (!Array.isArray(settings.packages)) return { changed: false, settings };
  const before = settings.packages.length;
  const nextPackages = settings.packages.filter((entry) => entry !== 'npm:pi-subagents' && entry !== 'pi-subagents');
  if (nextPackages.length === before) return { changed: false, settings };
  return { changed: true, settings: { ...settings, packages: nextPackages } };
}

export async function inspectRawPiSubagentsActivation({ cwd = process.cwd(), home = HOME } = {}) {
  const user = getPiGlobalTargets(home);
  const project = getProjectPiTargets(cwd);
  const legacyExtension = path.join(user.extensions, 'subagent');
  const findings = [];

  for (const [scope, filePath] of [['user', user.settings], ['project', project.settings]]) {
    const settings = await readJsonIfExists(filePath);
    const packages = Array.isArray(settings?.packages) ? settings.packages : [];
    if (packages.includes('npm:pi-subagents') || packages.includes('pi-subagents')) {
      findings.push({ type: 'settings-package', scope, path: filePath });
    }
  }

  if (await fs.pathExists(path.join(legacyExtension, 'index.ts')) || await fs.pathExists(path.join(legacyExtension, 'index.js'))) {
    findings.push({ type: 'legacy-extension', scope: 'user', path: legacyExtension });
  }

  return { findings };
}

export async function disableRawPiSubagentsActivation({ cwd = process.cwd(), home = HOME } = {}) {
  const user = getPiGlobalTargets(home);
  const project = getProjectPiTargets(cwd);
  const actions = [];

  for (const [scope, filePath] of [['user', user.settings], ['project', project.settings]]) {
    const settings = await readJsonIfExists(filePath);
    const result = removeRawPiSubagentsPackageEntries(settings);
    if (result.changed) {
      await writeJsonWithBackup(filePath, result.settings, 'takomi-disable-raw-pi-subagents');
      actions.push({ type: 'settings-package-removed', scope, path: filePath });
    }
  }

  const legacyExtension = path.join(user.extensions, 'subagent');
  if (await fs.pathExists(path.join(legacyExtension, 'index.ts')) || await fs.pathExists(path.join(legacyExtension, 'index.js'))) {
    const disabledRoot = path.join(user.root, 'disabled-extensions');
    await fs.ensureDir(disabledRoot);
    let dest = path.join(disabledRoot, 'subagent');
    if (await fs.pathExists(dest)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      dest = path.join(disabledRoot, `subagent-${stamp}`);
    }
    await fs.move(legacyExtension, dest, { overwrite: false });
    actions.push({ type: 'legacy-extension-moved', scope: 'user', path: legacyExtension, disabledPath: dest });
  }

  return { actions };
}

export function formatRawPiSubagentsFindings(findings = []) {
  if (!findings.length) return 'No raw pi-subagents activation found.';
  return findings.map((finding) => {
    if (finding.type === 'settings-package') return `- ${finding.scope} settings package entry: ${finding.path}`;
    if (finding.type === 'legacy-extension') return `- legacy raw subagent extension: ${finding.path}`;
    return `- ${finding.path || JSON.stringify(finding)}`;
  }).join('\n');
}

export function formatRawPiSubagentsDisableActions(actions = []) {
  if (!actions.length) return 'No raw pi-subagents activation changes were needed.';
  return actions.map((action) => {
    if (action.type === 'settings-package-removed') return `- removed raw pi-subagents package from ${action.scope} settings: ${action.path}`;
    if (action.type === 'legacy-extension-moved') return `- moved raw subagent extension out of Pi extensions: ${action.path} -> ${action.disabledPath}`;
    return `- ${action.path || JSON.stringify(action)}`;
  }).join('\n');
}

export async function inspectPiSubagentsDependency(home = HOME) {
  const pkg = await getPackageJson();
  const declaredVersion = pkg?.dependencies?.['pi-subagents'] || null;
  const localPackageJson = path.join(TAKOMI_PACKAGE_DIR, 'node_modules', 'pi-subagents', 'package.json');
  const globalPackageJson = path.join(getGlobalNodeModulesRoot(home), 'pi-subagents', 'package.json');

  let localVersion = null;
  let globalVersion = null;

  try {
    if (await fs.pathExists(localPackageJson)) {
      const localPkg = await fs.readJson(localPackageJson);
      localVersion = localPkg.version || null;
    }
  } catch {}

  try {
    if (await fs.pathExists(globalPackageJson)) {
      const globalPkg = await fs.readJson(globalPackageJson);
      globalVersion = globalPkg.version || null;
    }
  } catch {}

  const bin = commandExists('pi-subagents');

  return {
    declaredVersion,
    localInstalled: Boolean(localVersion),
    localVersion,
    localPackageJson,
    globalInstalled: Boolean(globalVersion),
    globalVersion,
    globalPackageJson,
    binaryInstalled: bin.found,
    binaryPath: bin.path,
  };
}

export async function detectPiCommand(options = {}) {
  const { includeVersion = true } = options;
  const binary = commandExists('pi');
  if (!binary.found) {
    return { installed: false, path: null, version: null };
  }

  if (!includeVersion) {
    return { installed: true, path: binary.path, version: null };
  }

  const versionProbe = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', `& '${(binary.path || 'pi').replace(/'/g, "''")}' --version`], { stdio: 'pipe', encoding: 'utf8' })
    : spawnSync(binary.path || 'pi', ['--version'], { stdio: 'pipe', encoding: 'utf8' });
  const output = [versionProbe.stdout, versionProbe.stderr].filter(Boolean).join('\n').trim();
  return {
    installed: true,
    path: binary.path,
    version: versionProbe.status === 0 ? (output || null) : null,
  };
}

export async function inspectBundledPiAssets() {
  const targets = getBundledPiAssetTargets();
  const checks = {
    root: await fs.pathExists(targets.root),
    runtime: await fs.pathExists(targets.runtime),
    subagents: await fs.pathExists(targets.subagents),
    contextManager: await fs.pathExists(targets.contextManager),
    prompts: await fs.pathExists(targets.prompts),
    agents: await fs.pathExists(targets.agents),
    themes: await fs.pathExists(targets.themes),
    settings: await fs.pathExists(targets.settings),
    routingPolicy: await fs.pathExists(targets.routingPolicy),
    profile: await fs.pathExists(targets.profile),
  };

  const packageReady = await fs.pathExists(targets.root);
  const packageFiles = await getPackageFileEntries();
  const packageIncluded = packageFiles.includes('.pi') || packageFiles.some((entry) => entry.startsWith('.pi/')) || packageReady;

  return {
    targets,
    checks,
    packageReady,
    packageIncluded,
  };
}

export async function inspectInstalledTakomiPiHarness(home = HOME) {
  const targets = getPiGlobalTargets(home);
  const runtime = path.join(targets.extensions, 'takomi-runtime');
  const subagents = path.join(targets.extensions, 'takomi-subagents');
  const contextManager = path.join(targets.extensions, 'takomi-context-manager');
  const core = path.join(path.dirname(targets.root), 'src', 'pi-takomi-core');
  const piSubagentsModule = path.join(targets.root, 'node_modules', 'pi-subagents');

  return {
    targets,
    runtimeInstalled: await fs.pathExists(runtime),
    subagentsInstalled: await fs.pathExists(subagents),
    contextManagerInstalled: await fs.pathExists(contextManager),
    coreInstalled: await fs.pathExists(core),
    piSubagentsModuleInstalled: await fs.pathExists(piSubagentsModule),
    promptsInstalled: await fs.pathExists(targets.prompts),
    agentsInstalled: await fs.pathExists(targets.agents),
    themesInstalled: await fs.pathExists(targets.themes),
    settingsPresent: await fs.pathExists(targets.settings),
    routingPolicyPresent: await fs.pathExists(targets.routingPolicy),
    manifestPresent: await fs.pathExists(MANIFEST_PATH),
    storePresent: await fs.pathExists(STORE_PATH),
  };
}

function quoteWindowsCommandArg(value) {
  const text = String(value);
  if (text.length === 0) return '""';
  if (!/[\s"&|<>^()%!]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function resolveCommandForSpawn(command, args = []) {
  if (process.platform !== 'win32') return { command, args };
  if (/\.(exe|com)$/i.test(command)) return { command, args };

  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', [command, ...args].map(quoteWindowsCommandArg).join(' ')],
  };
}

export function runCommand(command, args) {
  const resolved = resolveCommandForSpawn(command, args);
  return spawnSync(resolved.command, resolved.args, { stdio: 'pipe', encoding: 'utf8', shell: false });
}

function runCommandWithTimeout(command, args, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const resolved = resolveCommandForSpawn(command, args);
    const child = spawn(resolved.command, resolved.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, ...result });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32' && child.pid) {
        try { spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' }); } catch {}
      } else {
        try { child.kill(); } catch {}
        setTimeout(() => {
          try { child.kill('SIGKILL'); } catch {}
        }, 1500).unref?.();
      }
      try { child.stdout?.destroy(); } catch {}
      try { child.stderr?.destroy(); } catch {}
      finish({ status: null });
    }, timeoutMs);
    timer.unref?.();

    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => finish({ status: 1, error }));
    child.on('close', (code) => finish({ status: timedOut ? null : code }));
  });
}

async function installOrUpdatePiCli({ force = false } = {}) {
  const before = await detectPiCommand();
  if (before.installed && !force) {
    return { ok: true, changed: false, report: 'Pi already available.' };
  }

  const attempts = [
    { command: 'npm', args: ['install', '-g', '@earendil-works/pi-coding-agent'] },
    { command: 'npm.cmd', args: ['install', '-g', '@earendil-works/pi-coding-agent'] },
  ];

  let lastError = 'Unknown install failure.';
  for (const attempt of attempts) {
    const result = runCommand(attempt.command, attempt.args);
    if (result.status === 0) {
      const after = await detectPiCommand();
      if (after.installed) {
        return {
          ok: true,
          changed: true,
          report: (result.stdout || result.stderr || (force ? 'Updated Pi.' : 'Installed Pi.')).trim(),
          version: after.version,
          action: force ? 'Updated' : 'Installed',
        };
      }
      lastError = 'npm install reported success, but pi was still not detected.';
      continue;
    }
    lastError = [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || lastError;
  }

  return { ok: false, changed: false, report: lastError };
}

export async function ensurePiInstalled() {
  return installOrUpdatePiCli({ force: false });
}

export async function updatePiCliPackage() {
  return installOrUpdatePiCli({ force: true });
}

export function printPiInstallResult(result) {
  if (result.ok) {
    console.log(pc.green(`✔ ${result.action || (result.changed ? 'Installed' : 'Validated')} Pi`));
    if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-4).join('\n')));
    return;
  }
  console.log(pc.red('✗ Failed to install Pi'));
  if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-8).join('\n')));
}

export async function ensurePiSubagentsInstalled() {
  const before = await inspectPiSubagentsDependency();
  if (before.localInstalled || before.globalInstalled) {
    return { ok: true, changed: false, report: 'pi-subagents already available.' };
  }

  const attempts = [
    { command: 'npm', args: ['install', '-g', 'pi-subagents'] },
    { command: 'npm.cmd', args: ['install', '-g', 'pi-subagents'] },
  ];

  let lastError = 'Unknown install failure.';
  for (const attempt of attempts) {
    const result = runCommand(attempt.command, attempt.args);
    if (result.status === 0) {
      const after = await inspectPiSubagentsDependency();
      if (after.localInstalled || after.globalInstalled) {
        return {
          ok: true,
          changed: true,
          report: (result.stdout || result.stderr || 'Installed pi-subagents.').trim(),
        };
      }
      lastError = 'npm install reported success, but pi-subagents was still not detected.';
      continue;
    }
    lastError = [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || lastError;
  }

  return { ok: false, changed: false, report: lastError };
}

export function printPiSubagentsInstallResult(result) {
  if (result.ok) {
    console.log(pc.green(`✔ ${result.changed ? 'Installed' : 'Validated'} pi-subagents`));
    if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-4).join('\n')));
    return;
  }
  console.log(pc.red('✗ Failed to install pi-subagents'));
  if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-8).join('\n')));
}

function getPiPackageUpdateTimeoutMs(timeoutMs) {
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) return timeoutMs;
  const envValue = Number(process.env.TAKOMI_PI_PACKAGE_UPDATE_TIMEOUT_MS || '');
  if (Number.isFinite(envValue) && envValue > 0) return envValue;
  return 180_000;
}

export async function updatePiManagedPackages({ timeoutMs } = {}) {
  if (process.env.TAKOMI_SKIP_PI_PACKAGE_UPDATE === '1') {
    return { ok: true, changed: false, report: 'Skipped Pi extension package update because TAKOMI_SKIP_PI_PACKAGE_UPDATE=1.' };
  }

  const pi = await detectPiCommand({ includeVersion: false });
  if (!pi.installed) return { ok: false, changed: false, report: 'Pi is not installed.' };

  // Only reconcile Pi-managed extension/package entries here. Plain `pi update`
  // also self-updates the Pi CLI (`npm install -g @earendil-works/pi-coding-agent`).
  // If Takomi times out and kills that process, npm can leave the global `pi`
  // shim temporarily removed on Windows. `--extensions` avoids touching the Pi
  // executable while still updating optional/user package packs.
  const effectiveTimeoutMs = getPiPackageUpdateTimeoutMs(timeoutMs);
  const command = pi.path || 'pi';
  const updateArgs = ['update', '--extensions'];
  const updateCommandText = `pi ${updateArgs.join(' ')}`;
  const result = await runCommandWithTimeout(command, updateArgs, effectiveTimeoutMs);
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  if (result.timedOut) {
    return {
      ok: false,
      changed: false,
      report: `Timed out after ${Math.round(effectiveTimeoutMs / 1000)}s while running \`${updateCommandText}\`. Takomi setup is complete; retry package updates later with \`${updateCommandText}\` or skip this step with TAKOMI_SKIP_PI_PACKAGE_UPDATE=1. Increase the timeout with TAKOMI_PI_PACKAGE_UPDATE_TIMEOUT_MS=<ms>. Last output:\n${output}`.trim(),
    };
  }

  return {
    ok: result.status === 0,
    changed: result.status === 0,
    report: output || (result.status === 0 ? 'All Pi-managed extension packages are up to date.' : `${updateCommandText} failed.`),
  };
}

export function printPiManagedPackageUpdateResult(result) {
  if (result.ok) {
    console.log(pc.green('✔ Updated all Pi-managed extension packages'));
    if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-8).join('\n')));
    return;
  }
  console.log(pc.yellow('⚠ Could not update Pi-managed extension packages'));
  if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-8).join('\n')));
}

export async function inspectPiHarnessEnvironment(cwd = process.cwd()) {
  const pi = await detectPiCommand();
  const bundled = await inspectBundledPiAssets();
  const installed = await inspectInstalledTakomiPiHarness();
  const piSubagents = await inspectPiSubagentsDependency();
  const rawPiSubagentsActivation = await inspectRawPiSubagentsActivation({ cwd });
  const project = getProjectPiTargets(cwd);

  return {
    pi,
    bundled,
    installed,
    piSubagents,
    rawPiSubagentsActivation,
    project: {
      targets: project,
      settingsPresent: await fs.pathExists(project.settings),
      routingPolicyPresent: await fs.pathExists(project.routingPolicy),
      profilePresent: await fs.pathExists(project.takomiProfile),
    },
  };
}

function printFirstRunGuidance(reason) {
  console.log(pc.magenta('\n🎯 Welcome to Takomi\n'));
  if (reason) console.log(pc.yellow(reason));
  console.log(pc.white('\nRecommended first step:'));
  console.log(pc.cyan('  takomi setup pi'));
  console.log(pc.dim('    Set up the Pi-native Takomi harness.'));
  console.log(pc.white('\nOptional setup:'));
  console.log(pc.dim('  takomi setup pi-features  Add optional Pi feature packs'));
  console.log(pc.dim('  takomi setup skills       Install global Takomi skills'));
  console.log(pc.dim('  takomi setup all          Set up Pi + skills'));
  console.log(pc.white('\nDiagnostics and help:'));
  console.log(pc.dim('  takomi doctor             Check installation health'));
  console.log(pc.dim('  takomi status             Show connected harnesses/toolkit status'));
  console.log(pc.dim('  takomi --help             Show all commands\n'));
}

export function getSourceCheckoutLaunchArgs(cwd) {
  const packageJson = path.join(cwd, 'package.json');
  const extensionsRoot = path.join(cwd, '.pi', 'extensions');
  const required = [
    path.join(extensionsRoot, 'oauth-router', 'index.ts'),
    path.join(extensionsRoot, 'takomi-runtime', 'index.ts'),
    path.join(extensionsRoot, 'takomi-subagents', 'index.ts'),
    path.join(extensionsRoot, 'takomi-context-manager', 'index.ts'),
    path.join(extensionsRoot, 'notify-sound', 'index.ts'),
    path.join(extensionsRoot, 'antigravity-provider', 'index.ts'),
  ];
  const promptsRoot = path.join(cwd, '.pi', 'prompts');
  const theme = path.join(cwd, '.pi', 'themes', 'takomi-noir.json');

  let isTakomiSourceCheckout = false;
  try {
    const pkg = fs.readJsonSync(packageJson);
    isTakomiSourceCheckout = pkg?.name === 'takomi'
      && required.every((entry) => fs.existsSync(entry))
      && fs.existsSync(promptsRoot)
      && fs.existsSync(theme);
  } catch {}

  if (!isTakomiSourceCheckout) return [];

  // Normal Pi auto-discovery would load both the globally installed Takomi
  // extensions and this checkout's project copies. Besides tool conflicts,
  // both runtime instances register lifecycle/UI handlers, which causes slow
  // startup and duplicated headers/widgets/footers. Match scripts/pi-dev.ps1:
  // disable discovery and load exactly one local development set.
  return [
    '--no-extensions',
    ...required.flatMap((entry) => ['--extension', entry]),
    '--no-prompt-templates',
    '--prompt-template', promptsRoot,
    '--no-themes',
    '--theme', theme,
  ];
}

export async function launchTakomiHarness(cwd = process.cwd()) {
  // Keep the common `takomi` path lean. A full environment inspection shells out
  // to `pi --version`, which costs multiple seconds on Windows before Pi even
  // starts. For launch we only need to know the command exists and the required
  // global Takomi extensions are present; `takomi doctor` still performs the
  // complete diagnostic check.
  const [pi, installed] = await Promise.all([
    detectPiCommand({ includeVersion: false }),
    inspectInstalledTakomiPiHarness(),
  ]);

  if (!pi.installed) {
    printFirstRunGuidance('Pi is not installed yet.');
    return 1;
  }

  if (!installed.runtimeInstalled || !installed.subagentsInstalled) {
    printFirstRunGuidance('Takomi Pi harness is not fully installed yet.');
    return 1;
  }

  const env = {
    ...process.env,
    TAKOMI_HARNESS: '1',
    // Avoid Pi's blocking startup version check on this wrapped launch path.
    // Takomi runtime schedules its own UI-safe delayed check after session_start.
    PI_SKIP_VERSION_CHECK: process.env.PI_SKIP_VERSION_CHECK ?? '1',
    TAKOMI_DELAYED_PI_VERSION_CHECK: process.env.TAKOMI_DELAYED_PI_VERSION_CHECK ?? '1',
  };

  return await new Promise((resolve) => {
    const launchArgs = getSourceCheckoutLaunchArgs(cwd);
    const resolved = resolveCommandForSpawn(pi.path || 'pi', launchArgs);
    const child = spawn(resolved.command, resolved.args, {
      cwd,
      stdio: 'inherit',
      env,
      shell: false,
      windowsHide: false,
    });

    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}
