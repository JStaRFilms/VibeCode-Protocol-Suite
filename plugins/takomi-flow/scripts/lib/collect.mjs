import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, writeJson } from './paths.mjs';
import { reviewRun } from './review.mjs';

export async function collectRun(args = {}) {
  if (!args.run) throw new Error('collect requires --run <run.json|run-dir>');
  if (!args.targetDir) throw new Error('collect requires --target-dir <path>');
  const targetDir = ensureDir(path.resolve(args.targetDir));
  const review = await reviewRun({
    run: args.run,
    frames: args.frames || 0,
    reportPath: args.reportPath,
  });
  const copied = [];
  for (const asset of review.catalog.assets || []) {
    if (asset.exists) copied.push(copyFile(asset.path, path.join(targetDir, 'assets')));
    if (args.includeFrames) {
      for (const frame of asset.frames || []) copied.push(copyFile(frame, path.join(targetDir, 'frames')));
    }
  }
  if (review.reportPath && fs.existsSync(review.reportPath)) {
    copied.push(copyFile(review.reportPath, targetDir, 'report.md'));
  }
  const manifest = {
    schemaVersion: 1,
    status: copied.length ? 'collected' : 'empty',
    runId: review.runId,
    sourceRunDir: review.runDir,
    targetDir,
    copied,
    review,
  };
  manifest.manifestPath = writeJson(path.join(targetDir, 'takomi-flow-collection.json'), manifest);
  return manifest;
}

function copyFile(source, targetDir, name = path.basename(source)) {
  ensureDir(targetDir);
  const target = uniquePath(path.join(targetDir, name));
  fs.copyFileSync(source, target);
  return { source, target };
}

function uniquePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const parsed = path.parse(filePath);
  for (let i = 1; i < 1000; i += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${i}${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not create unique path for ${filePath}`);
}
