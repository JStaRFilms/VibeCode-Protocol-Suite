import { loadCapabilities } from './capabilities.mjs';
import { normalizeRequest } from './request.mjs';

export function createAgentPlan(args = {}) {
  const request = normalizeRequest(args);
  const capabilities = loadCapabilities();
  const submit = Boolean(args.submit);
  const collectTarget = args.targetDir || args['target-dir'];
  return {
    schemaVersion: 1,
    status: 'ready',
    provider: capabilities.provider,
    summary: `${request.kind} ${request.mode} Flow job with ${request.variations} variation(s).`,
    request,
    gates: gates(request, submit),
    mcpSequence: mcpSequence(request, { submit, collectTarget }),
    cliSequence: cliSequence(request, { submit, collectTarget }),
    expectedOutputs: expectedOutputs(request, collectTarget),
    nextActions: nextActions(submit, collectTarget),
  };
}

function gates(request, submit) {
  const items = [
    {
      name: 'spend',
      required: submit,
      satisfied: request.allowSpend,
      note: 'Generation submission may spend Flow credits and requires allowSpend=true.',
    },
    {
      name: 'browser',
      required: submit,
      satisfied: false,
      note: 'Browser-opening MCP tools require allowBrowser=true at call time.',
    },
  ];
  return submit ? items : items.map(item => ({ ...item, required: false }));
}

function mcpSequence(request, options) {
  const workflowArgs = {
    kind: request.kind,
    prompt: request.prompt,
    variations: request.variations,
    aspectRatio: request.aspectRatio,
    durationSeconds: request.durationSeconds,
    mode: request.mode,
    modelHint: request.modelHint,
    outputDir: request.outputDir,
    allowSpend: request.allowSpend,
    extractFrames: request.extractFrames,
    sourceAssets: request.sourceAssets,
    projectUrl: request.projectUrl,
    reuseCurrentProject: request.reuseCurrentProject,
    allowNewProject: request.allowNewProject,
    freshChatOnFailure: request.freshChatOnFailure,
    editorWaitMs: request.editorWaitMs,
    submit: options.submit,
    allowBrowser: options.submit,
  };
  const steps = [
    { tool: 'takomi_flow_audit', arguments: { outputDir: request.outputDir } },
    { tool: 'takomi_flow_workflow', arguments: compact(workflowArgs) },
    { tool: 'takomi_flow_review', arguments: { run: '<run.json|run-dir>', frames: request.extractFrames || 0 } },
  ];
  if (options.collectTarget) {
    steps.push({
      tool: 'takomi_flow_collect',
      arguments: {
        run: '<run.json|run-dir>',
        targetDir: options.collectTarget,
        frames: request.extractFrames || 0,
        includeFrames: true,
      },
    });
  }
  return steps;
}

function cliSequence(request, options) {
  const base = [
    'node scripts/takomi-flow.mjs audit',
    `node scripts/takomi-flow.mjs workflow --kind ${request.kind} --prompt "${escapeArg(request.prompt)}"${optionArgs(request, options.submit)}`,
    `node scripts/takomi-flow.mjs review --run <run.json|run-dir> --frames ${request.extractFrames || 0}`,
  ];
  if (options.collectTarget) {
    base.push(`node scripts/takomi-flow.mjs collect --run <run.json|run-dir> --target-dir "${escapeArg(options.collectTarget)}" --frames ${request.extractFrames || 0} --include-frames`);
  }
  return base;
}

function optionArgs(request, submit) {
  const args = [];
  if (request.variations) args.push(`--variations ${request.variations}`);
  if (request.aspectRatio) args.push(`--aspect-ratio ${request.aspectRatio}`);
  if (request.durationSeconds) args.push(`--duration ${request.durationSeconds}`);
  if (request.mode) args.push(`--mode ${request.mode}`);
  if (request.modelHint) args.push(`--model "${escapeArg(request.modelHint)}"`);
  if (request.outputDir) args.push(`--output-dir "${escapeArg(request.outputDir)}"`);
  if (request.extractFrames) args.push(`--extract-frames ${request.extractFrames}`);
  if (request.sourceAssets.length) args.push(`--assets "${escapeArg(request.sourceAssets.join(','))}"`);
  if (request.projectUrl) args.push(`--project-url "${escapeArg(request.projectUrl)}"`);
  if (request.reuseCurrentProject) args.push('--reuse-current-project');
  if (request.allowNewProject) args.push('--allow-new-project');
  if (request.freshChatOnFailure === false) args.push('--fresh-chat-on-failure=false');
  if (request.editorWaitMs) args.push(`--editor-wait-ms ${request.editorWaitMs}`);
  if (submit) args.push('--submit --allow-browser --allow-spend');
  return args.length ? ` ${args.join(' ')}` : '';
}

function expectedOutputs(request, collectTarget) {
  const outputs = [
    `${request.outputDir}/requests/<timestamp>-request.json`,
    `${request.outputDir}/<runId>/run.json`,
    `${request.outputDir}/<runId>/downloads/`,
    `${request.outputDir}/<runId>/assets.json`,
    `${request.outputDir}/<runId>/report.md`,
  ];
  if (request.extractFrames) outputs.push(`${request.outputDir}/<runId>/frames/`);
  if (collectTarget) outputs.push(`${collectTarget}/takomi-flow-collection.json`);
  return outputs;
}

function nextActions(submit, collectTarget) {
  const actions = ['Run the audit step first and treat missing profile as a bootstrap/login gate.'];
  if (!submit) actions.push('Use the workflow step without submit to prepare and validate the request without spending credits.');
  if (submit) actions.push('Confirm the user explicitly approved spending Flow credits before running the submit step.');
  actions.push('After generation, review run metadata, errors, screenshots, and downloaded assets.');
  if (collectTarget) actions.push('Collect reviewed outputs into the downstream target folder for pipeline reuse.');
  return actions;
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function escapeArg(value) {
  return String(value).replaceAll('"', '\\"');
}
