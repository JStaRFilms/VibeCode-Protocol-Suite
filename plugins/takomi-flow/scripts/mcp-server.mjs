#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerPrompts } from './lib/mcp-prompts.mjs';
import { registerResources } from './lib/mcp-resources.mjs';
import { registerTools } from './lib/mcp-tools.mjs';

const server = new McpServer({
  name: 'takomi-flow',
  version: '0.1.0',
});

registerTools(server);
registerResources(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
