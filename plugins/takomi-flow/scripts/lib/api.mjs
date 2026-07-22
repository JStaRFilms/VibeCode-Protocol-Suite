import { createPreparedRequest } from './request.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { validateRequestFile } from './request-validator.mjs';
import { runDoctor } from './doctor.mjs';
import { loadCapabilities } from './capabilities.mjs';
import { listTemplates, loadTemplate, writeTemplate } from './templates.mjs';
import { runSelfTest } from './selftest.mjs';
import { inspectRun, latestRun, listRuns, resolveRun } from './inspect.mjs';
import { catalogAssets } from './media.mjs';
import { observeFlow } from './observe.mjs';
import { generateFromRequest } from './generation.mjs';
import { createReport } from './report.mjs';
import { runWorkflow } from './workflow.mjs';
import { reviewRun } from './review.mjs';
import { runAudit } from './audit.mjs';
import { collectRun } from './collect.mjs';
import { loadExamples } from './examples.mjs';
import { createAgentPlan } from './agent-plan.mjs';

export async function doctor(args = {}) {
  return runDoctor({ profileDir: args.profileDir, outputDir: args.outputDir });
}

export function capabilities() {
  return loadCapabilities();
}

export async function observe(args = {}) {
  return observeFlow({
    profileDir: args.profileDir,
    outputDir: args.outputDir,
    browserChannel: args.browserChannel,
    cdpUrl: args.cdpUrl,
    headless: Boolean(args.headless),
  });
}

export function template(args = {}) {
  if (!args.kind) return { templates: listTemplates() };
  if (args.outputDir) return writeTemplate(args.kind, args.outputDir);
  return loadTemplate(args.kind);
}

export function prepare(args = {}) {
  const { request, requestPath } = createPreparedRequest(args);
  return { status: 'prepared', requestPath, request };
}

export function validate(args = {}) {
  return validateRequestFile(args.request);
}

export async function selftest(args = {}) {
  return runSelfTest({ outputDir: args.outputDir });
}

export function inspect(args = {}) {
  return inspectRun(args.run);
}

export function latest(args = {}) {
  return latestRun(args.outputDir);
}

export function runs(args = {}) {
  return listRuns(args.outputDir, args.limit);
}

export async function assets(args = {}) {
  const run = resolveRun(args.run);
  return catalogAssets(run, assetPathsForRun(run), { frames: args.frames || 0 });
}

export async function generate(args = {}) {
  return generateFromRequest(args);
}

export function report(args = {}) {
  return createReport(args);
}

export async function workflow(args = {}) {
  return runWorkflow(args);
}

export async function review(args = {}) {
  return reviewRun(args);
}

export async function audit(args = {}) {
  return runAudit(args);
}

export async function collect(args = {}) {
  return collectRun(args);
}

export function examples(args = {}) {
  return loadExamples(args.name);
}

export function plan(args = {}) {
  return createAgentPlan(args);
}

function assetPathsForRun(run) {
  if (run.data.assets?.length) return run.data.assets;
  if (!fs.existsSync(run.downloadsDir)) return [];
  return fs.readdirSync(run.downloadsDir)
    .map(name => path.join(run.downloadsDir, name))
    .filter(filePath => fs.statSync(filePath).isFile());
}
