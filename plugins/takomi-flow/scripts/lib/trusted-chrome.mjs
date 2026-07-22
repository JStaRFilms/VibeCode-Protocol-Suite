import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { ensureDir, FLOW_URL } from './paths.mjs';

export function defaultTrustedProfileDir() {
  return path.join(os.homedir(), '.takomi-flow', 'trusted-chrome-profile');
}

export function launchTrustedChrome(args = {}) {
  const port = Number.parseInt(args.port || '9222', 10) || 9222;
  const userDataDir = ensureDir(path.resolve(args.profileDir || defaultTrustedProfileDir()));
  const executable = args.chromePath || findChromeExecutable();
  const chromeArgs = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--new-window',
    args.url || FLOW_URL,
  ];
  if (args.printCommand) {
    return result({ executable, chromeArgs, port, userDataDir, launched: false });
  }
  const child = spawn(executable, chromeArgs, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  return result({ executable, chromeArgs, port, userDataDir, launched: true, processId: child.pid });
}

function result(data) {
  return {
    schemaVersion: 1,
    status: 'ok',
    cdpUrl: `http://127.0.0.1:${data.port}`,
    loginUrl: data.chromeArgs[data.chromeArgs.length - 1],
    userDataDir: data.userDataDir,
    executable: data.executable,
    args: data.chromeArgs,
    launched: data.launched,
    processId: data.processId,
    nextActions: [
      'Log into Google Flow manually in the opened Chrome window.',
      `After login, use --cdp-url http://127.0.0.1:${data.port} with observe, smoke, workflow, or generate.`,
      'Keep this Chrome window open while TakomiFlow attaches to it.',
    ],
  };
}

function findChromeExecutable() {
  const candidates = process.platform === 'win32' ? [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ] : [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find(candidate => candidate && fs.existsSync(candidate));
  if (!found) throw new Error('Could not find Chrome. Pass --chrome-path <path-to-chrome>.');
  return found;
}
