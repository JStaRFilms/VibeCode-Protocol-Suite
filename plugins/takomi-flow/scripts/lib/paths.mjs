import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const FLOW_URL = process.env.TAKOMI_FLOW_URL || 'https://labs.google/fx/tools/flow';

export function defaultProfileDir() {
  return path.join(os.homedir(), '.takomi-flow', 'browser-profile');
}

export function defaultRunsDir() {
  return path.join(os.homedir(), '.takomi-flow', 'runs');
}

export function timestampId(label = 'flow') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('.', '-').replace('T', '-').replace('Z', '');
  return `${stamp}-${label}`;
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolvePath(value, fallback) {
  return path.resolve(value || fallback);
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  return filePath;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
