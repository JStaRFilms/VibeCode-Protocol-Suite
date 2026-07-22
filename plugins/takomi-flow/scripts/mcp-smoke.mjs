#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'takomi-flow-smoke', version: '0.1.0' });
const pluginRoot = path.resolve(import.meta.dirname, '..');
const reviewRunDir = path.join(os.tmpdir(), 'takomi-flow-mcp-smoke-review');
const transport = new StdioClientTransport({
  command: 'node',
  args: ['scripts/mcp-server.mjs'],
  cwd: pluginRoot,
});

try {
  prepareReviewRun(reviewRunDir);
  await client.connect(transport);
  const tools = await client.listTools();
  const capabilities = await client.callTool({
    name: 'takomi_flow_capabilities',
    arguments: {},
  });
  const audit = await client.callTool({
    name: 'takomi_flow_audit',
    arguments: { outputDir: 'C:/Users/johno/.takomi-flow/runs', limit: 3 },
  });
  const examples = await client.callTool({
    name: 'takomi_flow_examples',
    arguments: { name: 'cinematic-video' },
  });
  const plan = await client.callTool({
    name: 'takomi_flow_plan',
    arguments: {
      kind: 'video',
      prompt: 'MCP smoke test planned video prompt',
      variations: 2,
      extractFrames: 2,
    },
  });
  const workflow = await client.callTool({
    name: 'takomi_flow_workflow',
    arguments: {
      kind: 'image',
      prompt: 'MCP smoke test image prompt',
      variations: 1,
      outputDir: 'C:/Users/johno/.takomi-flow/runs',
    },
  });
  const observeBlocked = await client.callTool({
    name: 'takomi_flow_observe',
    arguments: { allowBrowser: false },
  });
  const runs = await client.callTool({
    name: 'takomi_flow_runs',
    arguments: { outputDir: 'C:/Users/johno/.takomi-flow/runs', limit: 3 },
  });
  const report = await client.callTool({
    name: 'takomi_flow_report',
    arguments: {
      outputDir: 'C:/Users/johno/.takomi-flow/runs',
      limit: 3,
      reportPath: 'C:/Users/johno/.takomi-flow/runs/mcp-smoke-report.md',
    },
  });
  const review = await client.callTool({
    name: 'takomi_flow_review',
    arguments: { run: reviewRunDir, frames: 0 },
  });
  const collect = await client.callTool({
    name: 'takomi_flow_collect',
    arguments: {
      run: reviewRunDir,
      targetDir: path.join(reviewRunDir, 'collected'),
      frames: 0,
    },
  });
  const resources = await client.listResources();
  const contract = await client.readResource({ uri: 'takomi-flow://contract' });
  const examplesResource = await client.readResource({ uri: 'takomi-flow://examples' });
  const requestSchema = await client.readResource({ uri: 'takomi-flow://schemas/request' });
  const resultSchema = await client.readResource({ uri: 'takomi-flow://schemas/result' });
  const collectionSchema = await client.readResource({ uri: 'takomi-flow://schemas/collection' });
  const prompts = await client.listPrompts();
  const videoPrompt = await client.getPrompt({
    name: 'takomi_flow_video_workflow',
    arguments: { topic: 'test video', variations: '1' },
  });
  const reviewPrompt = await client.getPrompt({
    name: 'takomi_flow_review_workflow',
    arguments: { run: reviewRunDir, frames: '2' },
  });
  const collectPrompt = await client.getPrompt({
    name: 'takomi_flow_collect_workflow',
    arguments: { run: reviewRunDir, targetDir: path.join(reviewRunDir, 'collected') },
  });
  console.log(JSON.stringify({
    status: 'ok',
    toolCount: tools.tools.length,
    toolNames: tools.tools.map(tool => tool.name),
    capabilitiesStatus: capabilities.structuredContent?.provider || 'unknown',
    auditStatus: audit.structuredContent?.status || 'unknown',
    examplesStatus: examples.structuredContent?.example?.name || 'unknown',
    planStatus: plan.structuredContent?.status || 'unknown',
    workflowStatus: workflow.structuredContent?.status || 'unknown',
    observeBlockedStatus: observeBlocked.structuredContent?.status || 'unknown',
    runsStatus: runs.structuredContent?.schemaVersion || 'unknown',
    reportStatus: report.structuredContent?.status || 'unknown',
    reviewStatus: review.structuredContent?.status || 'unknown',
    collectStatus: collect.structuredContent?.status || 'unknown',
    resourceCount: resources.resources.length,
    contractBytes: contract.contents?.[0]?.text?.length || 0,
    examplesBytes: examplesResource.contents?.[0]?.text?.length || 0,
    requestSchemaBytes: requestSchema.contents?.[0]?.text?.length || 0,
    resultSchemaBytes: resultSchema.contents?.[0]?.text?.length || 0,
    collectionSchemaBytes: collectionSchema.contents?.[0]?.text?.length || 0,
    promptCount: prompts.prompts.length,
    videoPromptMessages: videoPrompt.messages?.length || 0,
    reviewPromptMessages: reviewPrompt.messages?.length || 0,
    collectPromptMessages: collectPrompt.messages?.length || 0,
  }, null, 2));
} finally {
  await client.close();
}

function prepareReviewRun(runDir) {
  const downloadsDir = path.join(runDir, 'downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  const assetPath = path.join(downloadsDir, 'sample.png');
  fs.writeFileSync(assetPath, 'takomi-flow-smoke-image');
  fs.writeFileSync(path.join(runDir, 'run.json'), `${JSON.stringify({
    schemaVersion: 1,
    status: 'downloaded',
    runId: 'mcp-smoke-review',
    command: 'mcp-smoke',
    kind: 'image',
    assets: [assetPath],
    screenshots: [],
    errors: [],
    manualActions: [],
    metadataPath: path.join(runDir, 'run.json'),
  }, null, 2)}\n`);
}
