#!/usr/bin/env node
import { parseArgs, printUsage } from './lib/args.mjs';
import { handleCommand } from './lib/commands.mjs';

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

try {
  if (!command || args.help) {
    printUsage();
  } else {
    await handleCommand(command, args);
  }
} catch (error) {
  console.error(`[TakomiFlow] ${error.message}`);
  process.exitCode = 1;
}
