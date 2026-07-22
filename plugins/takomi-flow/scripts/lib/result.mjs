import path from 'node:path';
import { ensureDir, timestampId, writeJson } from './paths.mjs';

export function createRun(requestOrArgs, label = 'flow') {
  const outputDir = path.resolve(requestOrArgs.outputDir || requestOrArgs['output-dir']);
  const runId = timestampId(label);
  const runDir = ensureDir(path.join(outputDir, runId));
  const downloadsDir = ensureDir(path.join(runDir, 'downloads'));
  const screenshotsDir = ensureDir(path.join(runDir, 'screenshots'));
  return { runId, runDir, downloadsDir, screenshotsDir };
}

export function baseResult(status, run, data = {}) {
  return {
    schemaVersion: 1,
    status,
    runId: run.runId,
    assets: [],
    screenshots: [],
    errors: [],
    manualActions: [],
    ...data,
    metadataPath: path.join(run.runDir, 'run.json'),
  };
}

export function saveResult(run, result) {
  const finalResult = { ...result, metadataPath: path.join(run.runDir, 'run.json') };
  writeJson(finalResult.metadataPath, finalResult);
  return finalResult;
}
