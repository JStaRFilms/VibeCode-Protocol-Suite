import fs from 'node:fs';
import path from 'node:path';
import { defaultRunsDir, readJson } from './paths.mjs';

export function inspectRun(target) {
  const runPath = resolveRunJson(target);
  const data = readJson(runPath);
  return summarize(data, runPath);
}

export function latestRun(outputDir = defaultRunsDir()) {
  const root = path.resolve(outputDir);
  if (!fs.existsSync(root)) {
    throw new Error(`Output directory does not exist: ${root}`);
  }
  const candidates = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name, 'run.json'))
    .filter(filePath => fs.existsSync(filePath))
    .sort();
  if (!candidates.length) {
    throw new Error(`No TakomiFlow runs found in: ${root}`);
  }
  return summarize(readJson(candidates[candidates.length - 1]), candidates[candidates.length - 1]);
}

export function listRuns(outputDir = defaultRunsDir(), limit = 20) {
  const root = path.resolve(outputDir);
  if (!fs.existsSync(root)) {
    return { schemaVersion: 1, outputDir: root, runs: [] };
  }
  const runFiles = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name, 'run.json'))
    .filter(filePath => fs.existsSync(filePath))
    .sort()
    .reverse()
    .slice(0, Math.max(1, Number.parseInt(limit || '20', 10) || 20));
  return {
    schemaVersion: 1,
    outputDir: root,
    runs: runFiles.map(filePath => summarize(readJson(filePath), filePath)),
  };
}

function resolveRunJson(target) {
  if (!target) throw new Error('inspect requires --run <run.json|run-dir>');
  const resolved = path.resolve(target);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return path.join(resolved, 'run.json');
  }
  return resolved;
}

export function resolveRun(target) {
  const runJsonPath = resolveRunJson(target);
  const data = readJson(runJsonPath);
  return {
    runId: data.runId || path.basename(path.dirname(runJsonPath)),
    runDir: path.dirname(runJsonPath),
    downloadsDir: path.join(path.dirname(runJsonPath), 'downloads'),
    screenshotsDir: path.join(path.dirname(runJsonPath), 'screenshots'),
    data,
  };
}

function summarize(data, runJsonPath) {
  return {
    status: data.status,
    runId: data.runId,
    command: data.command,
    kind: data.kind,
    projectUrl: data.projectUrl,
    flowUrl: data.flowUrl,
    assets: data.assets || [],
    screenshots: data.screenshots || [],
    errors: data.errors || [],
    manualActions: data.manualActions || [],
    metadataPath: data.metadataPath || runJsonPath,
  };
}
