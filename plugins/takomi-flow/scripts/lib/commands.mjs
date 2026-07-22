import { defaultProfileDir, defaultRunsDir, FLOW_URL, resolvePath } from './paths.mjs';
import { closeFlowBrowser, launchFlowBrowser } from './browser.mjs';
import { createRun, baseResult, saveResult } from './result.mjs';
import { capture, inspectFlowState, openFlow } from './flow-ui.mjs';
import { launchTrustedChrome } from './trusted-chrome.mjs';
import * as api from './api.mjs';

export async function handleCommand(command, args) {
  if (command === 'prepare') return prepare(args);
  if (command === 'workflow') return printJson(await api.workflow({
    ...args,
    outputDir: args['output-dir'],
    allowSpend: booleanArg(args['allow-spend']),
    extractFrames: args['extract-frames'],
    sourceAssets: args.assets,
    allowBrowser: booleanArg(args['allow-browser']),
    profileDir: args['profile-dir'],
    browserChannel: args['browser-channel'],
    cdpUrl: args['cdp-url'],
    headless: booleanArg(args.headless),
    submit: booleanArg(args.submit),
    projectUrl: args['project-url'],
    reuseCurrentProject: args['reuse-current-project'],
    allowNewProject: args['allow-new-project'],
    freshChatOnFailure: args['fresh-chat-on-failure'],
    editorWaitMs: args['editor-wait-ms'],
  }));
  if (command === 'template') return template(args);
  if (command === 'examples') return printJson(api.examples({ name: args.name }));
  if (command === 'trusted-chrome') return printJson(launchTrustedChrome({
    profileDir: args['profile-dir'],
    chromePath: args['chrome-path'],
    port: args.port,
    url: args.url,
    printCommand: booleanArg(args['print-command']),
  }));
  if (command === 'validate') return printJson(api.validate({ request: args.request }));
  if (command === 'bootstrap') return bootstrap(args);
  if (command === 'doctor') return doctor(args);
  if (command === 'audit') return printJson(await api.audit({
    profileDir: args['profile-dir'],
    outputDir: args['output-dir'],
    limit: args.limit,
  }));
  if (command === 'capabilities') return printJson(api.capabilities());
  if (command === 'plan') return printJson(api.plan({
    ...args,
    outputDir: args['output-dir'],
    allowSpend: booleanArg(args['allow-spend']),
    extractFrames: args['extract-frames'],
    sourceAssets: args.assets,
    submit: booleanArg(args.submit),
    targetDir: args['target-dir'],
  }));
  if (command === 'observe') return observe(args);
  if (command === 'smoke') return smoke(args);
  if (command === 'generate') return printJson(await api.generate({
    request: args.request,
    profileDir: args['profile-dir'],
    browserChannel: args['browser-channel'],
    cdpUrl: args['cdp-url'],
    headless: booleanArg(args.headless),
    projectUrl: args['project-url'],
    reuseCurrentProject: args['reuse-current-project'],
    allowNewProject: args['allow-new-project'],
    freshChatOnFailure: args['fresh-chat-on-failure'],
    editorWaitMs: args['editor-wait-ms'],
  }));
  if (command === 'selftest') return printJson(await api.selftest({ outputDir: args['output-dir'] }));
  if (command === 'inspect') return printJson(api.inspect({ run: args.run }));
  if (command === 'latest') return printJson(api.latest({ outputDir: args['output-dir'] }));
  if (command === 'runs') return printJson(api.runs({ outputDir: args['output-dir'], limit: args.limit }));
  if (command === 'assets') return assets(args);
  if (command === 'review') return printJson(await api.review({
    run: args.run,
    frames: args.frames || 0,
    reportPath: args['report-path'],
  }));
  if (command === 'collect') return printJson(await api.collect({
    run: args.run,
    targetDir: args['target-dir'],
    frames: args.frames || 0,
    includeFrames: booleanArg(args['include-frames']),
    reportPath: args['report-path'],
  }));
  if (command === 'report') return printJson(api.report({
    run: args.run,
    outputDir: args['output-dir'],
    limit: args.limit,
    reportPath: args['report-path'],
  }));
  throw new Error(`Unknown command: ${command}`);
}

function booleanArg(value) {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

async function observe(cliArgs) {
  printJson(await api.observe({
    profileDir: cliArgs['profile-dir'],
    outputDir: cliArgs['output-dir'],
    browserChannel: cliArgs['browser-channel'],
    cdpUrl: cliArgs['cdp-url'],
    headless: booleanArg(cliArgs.headless),
  }));
}

async function doctor(cliArgs) {
  const report = await api.doctor({
    profileDir: cliArgs['profile-dir'],
    outputDir: cliArgs['output-dir'],
  });
  printJson(report);
}

async function assets(cliArgs) {
  printJson(await api.assets({ run: cliArgs.run, frames: cliArgs.frames || 0 }));
}

async function prepare(cliArgs) {
  printJson(api.prepare(cliArgs));
}

function template(cliArgs) {
  printJson(api.template({ kind: cliArgs.kind, outputDir: cliArgs['output-dir'] }));
}

async function bootstrap(cliArgs) {
  const outputDir = resolvePath(cliArgs['output-dir'], defaultRunsDir());
  const run = createRun({ outputDir }, 'bootstrap');
  const profileDir = resolvePath(cliArgs['profile-dir'], defaultProfileDir());
  const result = baseResult('manual_action_required', run, {
    command: 'bootstrap',
    flowUrl: FLOW_URL,
    profileDir,
    manualActions: ['Log into Google Flow in the opened browser, then close it when finished.'],
  });
  const browser = await launchFlowBrowser({
    profileDir,
    downloadsDir: run.downloadsDir,
    browserChannel: cliArgs['browser-channel'],
    cdpUrl: cliArgs['cdp-url'],
    headless: booleanArg(cliArgs.headless),
  });
  try {
    await openFlow(browser.page);
    result.screenshots.push(await capture(browser.page, run, 'bootstrap-opened'));
    Object.assign(result, await inspectFlowState(browser.page));
    console.log(`[TakomiFlow] Browser opened for login/profile setup: ${FLOW_URL}`);
    console.log('[TakomiFlow] Close the browser window when login/setup is complete.');
    if (!browser.attached) await browser.context.waitForEvent('close', { timeout: 30 * 60 * 1000 }).catch(() => {});
  } finally {
    await closeFlowBrowser(browser);
    saveResult(run, result);
    console.log(`[TakomiFlow] Result: ${result.metadataPath}`);
  }
}

async function smoke(cliArgs) {
  const outputDir = resolvePath(cliArgs['output-dir'], defaultRunsDir());
  const run = createRun({ outputDir }, 'smoke');
  const profileDir = resolvePath(cliArgs['profile-dir'], defaultProfileDir());
  const browser = await launchFlowBrowser({
    profileDir,
    downloadsDir: run.downloadsDir,
    browserChannel: cliArgs['browser-channel'],
    cdpUrl: cliArgs['cdp-url'],
    headless: booleanArg(cliArgs.headless),
  });
  const result = baseResult('ok', run, { command: 'smoke', flowUrl: FLOW_URL, profileDir });
  try {
    await openFlow(browser.page);
    result.screenshots.push(await capture(browser.page, run, 'smoke-flow'));
    const state = await inspectFlowState(browser.page);
    Object.assign(result, state);
    if (state.manualActions.length) result.status = 'manual_action_required';
  } catch (error) {
    result.status = 'failed';
    result.errors.push(error.message);
  } finally {
    await closeFlowBrowser(browser);
    saveResult(run, result);
    printJson(result);
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}
