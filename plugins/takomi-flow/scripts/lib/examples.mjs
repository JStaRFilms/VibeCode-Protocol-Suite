import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(MODULE_DIR, '..', '..');
const EXAMPLES_PATH = path.join(PLUGIN_ROOT, 'assets', 'examples.json');

export function loadExamples(name = undefined) {
  const data = JSON.parse(fs.readFileSync(EXAMPLES_PATH, 'utf8'));
  if (!name) return data;
  const example = data.examples.find(item => item.name === name);
  if (!example) {
    throw new Error(`Unknown example "${name}". Available: ${data.examples.map(item => item.name).join(', ')}`);
  }
  return { schemaVersion: data.schemaVersion, example };
}
