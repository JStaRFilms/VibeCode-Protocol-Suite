import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(MODULE_DIR, '..', '..');

export const RESOURCES = [
  {
    name: 'takomi-flow-contract',
    uri: 'takomi-flow://contract',
    file: path.join(PLUGIN_ROOT, 'references', 'flow-provider-contract.md'),
    mimeType: 'text/markdown',
    description: 'TakomiFlow provider contract and agent workflow.',
  },
  {
    name: 'takomi-flow-capabilities',
    uri: 'takomi-flow://capabilities',
    file: path.join(PLUGIN_ROOT, 'assets', 'capabilities.json'),
    mimeType: 'application/json',
    description: 'Machine-readable TakomiFlow capabilities.',
  },
  {
    name: 'takomi-flow-examples',
    uri: 'takomi-flow://examples',
    file: path.join(PLUGIN_ROOT, 'assets', 'examples.json'),
    mimeType: 'application/json',
    description: 'Machine-readable TakomiFlow request and handoff examples.',
  },
  {
    name: 'takomi-flow-request-schema',
    uri: 'takomi-flow://schemas/request',
    file: path.join(PLUGIN_ROOT, 'assets', 'request.schema.json'),
    mimeType: 'application/schema+json',
    description: 'JSON Schema for TakomiFlow request files.',
  },
  {
    name: 'takomi-flow-result-schema',
    uri: 'takomi-flow://schemas/result',
    file: path.join(PLUGIN_ROOT, 'assets', 'result.schema.json'),
    mimeType: 'application/schema+json',
    description: 'JSON Schema for TakomiFlow run result metadata.',
  },
  {
    name: 'takomi-flow-collection-schema',
    uri: 'takomi-flow://schemas/collection',
    file: path.join(PLUGIN_ROOT, 'assets', 'collection.schema.json'),
    mimeType: 'application/schema+json',
    description: 'JSON Schema for TakomiFlow collection manifests.',
  },
  {
    name: 'takomi-flow-video-template',
    uri: 'takomi-flow://templates/video',
    file: path.join(PLUGIN_ROOT, 'assets', 'templates', 'video-request.json'),
    mimeType: 'application/json',
    description: 'Video request template.',
  },
  {
    name: 'takomi-flow-image-template',
    uri: 'takomi-flow://templates/image',
    file: path.join(PLUGIN_ROOT, 'assets', 'templates', 'image-request.json'),
    mimeType: 'application/json',
    description: 'Image request template.',
  },
];

export function readResourceFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}
