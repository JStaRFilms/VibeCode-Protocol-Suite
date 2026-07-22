import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(MODULE_DIR, '..', '..');
const CAPABILITIES_PATH = path.join(PLUGIN_ROOT, 'assets', 'capabilities.json');

export function loadCapabilities() {
  return JSON.parse(fs.readFileSync(CAPABILITIES_PATH, 'utf8'));
}
