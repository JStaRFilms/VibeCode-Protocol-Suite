import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir, writeJson } from './paths.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(MODULE_DIR, '..', '..');
const TEMPLATE_DIR = path.join(PLUGIN_ROOT, 'assets', 'templates');
const TEMPLATES = {
  video: 'video-request.json',
  image: 'image-request.json',
};

export function listTemplates() {
  return Object.keys(TEMPLATES).map(kind => ({ kind, path: templatePath(kind) }));
}

export function loadTemplate(kind) {
  const filePath = templatePath(kind);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeTemplate(kind, outputDir) {
  const template = loadTemplate(kind);
  const destinationDir = ensureDir(path.resolve(outputDir));
  const destination = path.join(destinationDir, TEMPLATES[kind]);
  writeJson(destination, template);
  return { kind, destination, template };
}

function templatePath(kind) {
  const fileName = TEMPLATES[String(kind || '').toLowerCase()];
  if (!fileName) {
    throw new Error(`Unknown template "${kind}". Expected image or video.`);
  }
  return path.join(TEMPLATE_DIR, fileName);
}
