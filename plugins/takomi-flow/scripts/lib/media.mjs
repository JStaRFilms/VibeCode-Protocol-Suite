import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ensureDir, writeJson } from './paths.mjs';

const execFileAsync = promisify(execFile);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export async function catalogAssets(run, assets = [], options = {}) {
  const catalog = [];
  const frameCount = Math.max(0, Number.parseInt(options.frames || '0', 10) || 0);
  for (const assetPath of assets) {
    const absolutePath = path.resolve(assetPath);
    if (!fs.existsSync(absolutePath)) {
      catalog.push({ path: absolutePath, exists: false, errors: ['Asset file not found.'] });
      continue;
    }
    const kind = classifyAsset(absolutePath);
    const item = {
      path: absolutePath,
      exists: true,
      kind,
      bytes: fs.statSync(absolutePath).size,
      frames: [],
      metadata: {},
      errors: [],
    };
    if (kind === 'video') {
      item.metadata = await probeMedia(absolutePath).catch(error => ({ probeError: error.message }));
      if (frameCount > 0) {
        item.frames = await extractFrames(absolutePath, path.join(run.runDir, 'frames'), frameCount)
          .catch(error => {
            item.errors.push(error.message);
            return [];
          });
      }
    }
    catalog.push(item);
  }
  const catalogPath = path.join(run.runDir, 'assets.json');
  writeJson(catalogPath, { schemaVersion: 1, runId: run.runId, assets: catalog });
  return { catalogPath, assets: catalog };
}

export function classifyAsset(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'unknown';
}

async function probeMedia(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=width,height,codec_type,codec_name',
    '-of', 'json',
    filePath,
  ]);
  return JSON.parse(stdout);
}

async function extractFrames(filePath, framesDir, count) {
  ensureDir(framesDir);
  const outputPattern = path.join(framesDir, `${path.basename(filePath, path.extname(filePath))}_%03d.jpg`);
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', filePath,
    '-vf', 'fps=1,scale=640:-1',
    '-frames:v', String(count),
    outputPattern,
  ]);
  return fs.readdirSync(framesDir)
    .filter(name => name.startsWith(path.basename(filePath, path.extname(filePath))) && name.endsWith('.jpg'))
    .sort()
    .map(name => path.join(framesDir, name));
}
