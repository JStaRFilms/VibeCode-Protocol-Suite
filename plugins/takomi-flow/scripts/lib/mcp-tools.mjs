import * as z from 'zod/v4';
import * as api from './api.mjs';

export function registerTools(server) {
  const register = toolRegister(server);
  register('takomi_flow_capabilities', 'List supported TakomiFlow kinds, modes, outputs, commands, and safety rules.', {}, () => api.capabilities());
  register('takomi_flow_doctor', 'Check local TakomiFlow readiness: Playwright, FFmpeg, FFprobe, profile path, and output path.', {
    profileDir: z.string().optional(),
    outputDir: z.string().optional(),
  }, args => api.doctor(args));
  register('takomi_flow_audit', 'Summarize TakomiFlow readiness, safe actions, gated actions, and recent run state.', {
    profileDir: z.string().optional(),
    outputDir: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }, args => api.audit(args));
  register('takomi_flow_examples', 'Return TakomiFlow example requests and downstream handoff patterns.', {
    name: z.string().optional(),
  }, args => api.examples(args));
  register('takomi_flow_plan', 'Create a safe agent execution plan with MCP calls, CLI fallbacks, gates, and expected outputs.', {
    kind: z.enum(['video', 'image']),
    prompt: z.string(),
    variations: z.number().int().positive().optional(),
    aspectRatio: z.string().optional(),
    durationSeconds: z.number().positive().optional(),
    mode: z.string().optional(),
    modelHint: z.string().optional(),
    outputDir: z.string().optional(),
    allowSpend: z.boolean().optional(),
    extractFrames: z.number().int().nonnegative().optional(),
    sourceAssets: z.array(z.string()).optional(),
    projectUrl: z.string().optional(),
    reuseCurrentProject: z.boolean().optional(),
    allowNewProject: z.boolean().optional(),
    freshChatOnFailure: z.boolean().optional(),
    editorWaitMs: z.number().int().positive().optional(),
    submit: z.boolean().optional(),
    targetDir: z.string().optional(),
  }, args => api.plan(args));
  registerRequestTools(register);
  registerBrowserTools(register);
  registerResultTools(register);
}

function registerRequestTools(register) {
  register('takomi_flow_template', 'Return or write a video/image request template.', {
    kind: z.enum(['video', 'image']).optional(),
    outputDir: z.string().optional(),
  }, args => api.template(args));
  const requestShape = {
    kind: z.enum(['video', 'image']),
    prompt: z.string(),
    variations: z.number().int().positive().optional(),
    aspectRatio: z.string().optional(),
    durationSeconds: z.number().positive().optional(),
    mode: z.string().optional(),
    modelHint: z.string().optional(),
    outputDir: z.string().optional(),
    allowSpend: z.boolean().optional(),
    extractFrames: z.number().int().nonnegative().optional(),
    sourceAssets: z.array(z.string()).optional(),
    projectUrl: z.string().optional(),
    reuseCurrentProject: z.boolean().optional(),
    allowNewProject: z.boolean().optional(),
    freshChatOnFailure: z.boolean().optional(),
    editorWaitMs: z.number().int().positive().optional(),
    notes: z.string().optional(),
  };
  register('takomi_flow_prepare', 'Create a prepared request JSON file for a Flow image or video generation.', requestShape, args => api.prepare(args));
  register('takomi_flow_workflow', 'Prepare, validate, and optionally submit a Flow image/video generation from one agent call.', {
    ...requestShape,
    submit: z.boolean().optional(),
    allowBrowser: z.boolean().optional(),
    profileDir: z.string().optional(),
    browserChannel: z.string().optional(),
    cdpUrl: z.string().optional(),
    headless: z.boolean().optional(),
  }, args => api.workflow(args));
  register('takomi_flow_validate', 'Validate a TakomiFlow request JSON before opening Flow or spending credits.', {
    request: z.string(),
  }, args => api.validate(args));
}

function registerBrowserTools(register) {
  register('takomi_flow_observe', 'Open Flow and observe UI controls/screenshots. Requires allowBrowser=true.', {
    allowBrowser: z.boolean(),
    profileDir: z.string().optional(),
    outputDir: z.string().optional(),
    browserChannel: z.string().optional(),
    cdpUrl: z.string().optional(),
    headless: z.boolean().optional(),
  }, args => requireBrowser(args, () => api.observe(args)));
  register('takomi_flow_generate', 'Run guarded Flow generation from a request file. Requires allowBrowser=true and request allowSpend=true to submit.', {
    allowBrowser: z.boolean(),
    request: z.string(),
    profileDir: z.string().optional(),
    browserChannel: z.string().optional(),
    cdpUrl: z.string().optional(),
    headless: z.boolean().optional(),
    projectUrl: z.string().optional(),
    reuseCurrentProject: z.boolean().optional(),
    allowNewProject: z.boolean().optional(),
    freshChatOnFailure: z.boolean().optional(),
    editorWaitMs: z.number().int().positive().optional(),
  }, args => requireBrowser(args, () => api.generate(args)));
}

function registerResultTools(register) {
  register('takomi_flow_selftest', 'Run deterministic no-spend TakomiFlow checks, including media catalog/frame extraction.', {
    outputDir: z.string().optional(),
  }, args => api.selftest(args));
  register('takomi_flow_inspect', 'Summarize a TakomiFlow run.json or run directory.', { run: z.string() }, args => api.inspect(args));
  register('takomi_flow_latest', 'Summarize the latest TakomiFlow run under an output directory.', {
    outputDir: z.string().optional(),
  }, args => api.latest(args));
  register('takomi_flow_runs', 'List recent TakomiFlow runs under an output directory.', {
    outputDir: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }, args => api.runs(args));
  register('takomi_flow_assets', 'Catalog downloaded run assets and optionally extract video review frames.', {
    run: z.string(),
    frames: z.number().int().nonnegative().optional(),
  }, args => api.assets(args));
  register('takomi_flow_review', 'Inspect a run, catalog assets, extract review frames, and write a Markdown handoff.', {
    run: z.string(),
    frames: z.number().int().nonnegative().optional(),
    reportPath: z.string().optional(),
  }, args => api.review(args));
  register('takomi_flow_collect', 'Copy reviewed assets, frames, report, and manifest into a downstream target folder.', {
    run: z.string(),
    targetDir: z.string(),
    frames: z.number().int().nonnegative().optional(),
    includeFrames: z.boolean().optional(),
    reportPath: z.string().optional(),
  }, args => api.collect(args));
  register('takomi_flow_report', 'Create a Markdown report for a run or recent TakomiFlow history.', {
    run: z.string().optional(),
    outputDir: z.string().optional(),
    limit: z.number().int().positive().optional(),
    reportPath: z.string().optional(),
  }, args => api.report(args));
}

function toolRegister(server) {
  return (name, description, inputSchema, handler) => {
    server.registerTool(name, { description, inputSchema }, async args => {
      const structuredContent = await handler(args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    });
  };
}

function requireBrowser(args, handler) {
  if (!args?.allowBrowser) {
    return {
      schemaVersion: 1,
      status: 'blocked',
      errors: [],
      manualActions: ['Set allowBrowser=true to permit TakomiFlow to open or drive a browser.'],
    };
  }
  return handler();
}
