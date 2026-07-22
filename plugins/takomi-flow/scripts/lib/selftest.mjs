import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defaultRunsDir, ensureDir, readJson, writeJson } from './paths.mjs';
import { runDoctor } from './doctor.mjs';
import { loadCapabilities } from './capabilities.mjs';
import { loadTemplate } from './templates.mjs';
import { createPreparedRequest } from './request.mjs';
import { validateRequestFile } from './request-validator.mjs';
import { createRun, saveResult, baseResult } from './result.mjs';
import { catalogAssets } from './media.mjs';
import { createReport } from './report.mjs';
import { runWorkflow } from './workflow.mjs';
import { reviewRun } from './review.mjs';
import { runAudit } from './audit.mjs';
import { collectRun } from './collect.mjs';
import { loadExamples } from './examples.mjs';
import { createAgentPlan } from './agent-plan.mjs';

const execFileAsync = promisify(execFile);

export async function runSelfTest(options = {}) {
  const outputDir = path.resolve(options.outputDir || defaultRunsDir(), 'selftest');
  ensureDir(outputDir);
  const steps = [];
  steps.push(await step('doctor', () => runDoctor({ outputDir })));
  steps.push(await step('audit', () => runAudit({ outputDir })));
  steps.push(await step('capabilities', () => loadCapabilities()));
  steps.push(await step('examples', () => loadExamples('cinematic-video')));
  steps.push(await step('agentPlan', () => createAgentPlan({
    kind: 'video',
    prompt: 'TakomiFlow self-test planned video prompt',
    variations: 2,
    aspectRatio: '16:9',
    durationSeconds: 8,
    extractFrames: 2,
  })));
  steps.push(await step('videoTemplate', () => loadTemplate('video')));
  steps.push(await step('imageTemplate', () => loadTemplate('image')));
  const prepared = await step('prepareAndValidate', () => prepareAndValidate(outputDir));
  steps.push(prepared);
  steps.push(await step('workflow', () => noSpendWorkflow(outputDir)));
  steps.push(await step('settingsPlan', () => verifySettingsPlan(outputDir)));
  steps.push(await step('guardedGenerate', () => guardedGenerate(prepared.data?.requestPath)));
  const catalog = await step('assetCatalog', () => syntheticAssetCatalog(outputDir));
  steps.push(catalog);
  steps.push(await step('report', () => selftestReport(catalog.data?.runDir)));
  steps.push(await step('review', () => selftestReview(catalog.data?.runDir)));
  steps.push(await step('collect', () => selftestCollect(catalog.data?.runDir, outputDir)));
  const failed = steps.some(item => item.status !== 'ok');
  return {
    schemaVersion: 1,
    status: failed ? 'failed' : 'ok',
    outputDir,
    steps,
  };
}

async function step(name, fn) {
  try {
    return { name, status: 'ok', data: await fn() };
  } catch (error) {
    return { name, status: 'failed', error: error.message };
  }
}

function prepareAndValidate(outputDir) {
  const { requestPath, request } = createPreparedRequest({
    kind: 'video',
    prompt: 'TakomiFlow self-test video prompt',
    variations: 1,
    'output-dir': outputDir,
    'extract-frames': 2,
  });
  return { requestPath, request, validation: validateRequestFile(requestPath) };
}

function guardedGenerate(requestPath) {
  if (!requestPath) throw new Error('No request path available.');
  const request = readJson(requestPath);
  if (request.allowSpend) throw new Error('Self-test request unexpectedly allows spend.');
  return {
    requestPath,
    wouldSubmit: false,
    reason: 'allowSpend is false, so generate must be blocked by the spend guard.',
  };
}

async function noSpendWorkflow(outputDir) {
  return runWorkflow({
    kind: 'image',
    prompt: 'TakomiFlow self-test image prompt',
    variations: 1,
    outputDir,
  });
}

async function verifySettingsPlan(outputDir) {
  const result = await runWorkflow({
    kind: 'video',
    prompt: 'TakomiFlow settings plan prompt',
    variations: 2,
    aspectRatio: '16:9',
    durationSeconds: 8,
    outputDir,
  });
  if (!result.settingsPlan?.selectorDependent?.length) {
    throw new Error('Expected selector-dependent settings in workflow result.');
  }
  return result.settingsPlan;
}

async function syntheticAssetCatalog(outputDir) {
  const run = createRun({ outputDir }, 'selftest-asset');
  const videoPath = path.join(run.downloadsDir, 'sample.mp4');
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=duration=2:size=320x180:rate=24',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    videoPath,
  ]);
  const result = baseResult('downloaded', run, {
    command: 'selftest',
    kind: 'video',
    assets: [videoPath],
  });
  saveResult(run, result);
  const catalog = await catalogAssets(run, [videoPath], { frames: 2 });
  return { ...catalog, runDir: run.runDir };
}

function selftestReport(runDir) {
  if (!runDir) throw new Error('No self-test run directory available.');
  return createReport({ run: runDir });
}

async function selftestReview(runDir) {
  if (!runDir) throw new Error('No self-test run directory available.');
  return reviewRun({ run: runDir, frames: 2 });
}

async function selftestCollect(runDir, outputDir) {
  if (!runDir) throw new Error('No self-test run directory available.');
  return collectRun({
    run: runDir,
    targetDir: path.join(outputDir, 'collected'),
    frames: 2,
    includeFrames: true,
  });
}
