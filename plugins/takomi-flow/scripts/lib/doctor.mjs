import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defaultProfileDir, defaultRunsDir, ensureDir, FLOW_URL } from './paths.mjs';
import { loadPlaywright } from './playwright-loader.mjs';

const execFileAsync = promisify(execFile);

export async function runDoctor(options = {}) {
  const profileDir = path.resolve(options.profileDir || defaultProfileDir());
  const outputDir = path.resolve(options.outputDir || defaultRunsDir());
  const checks = [];
  checks.push({ name: 'node', status: 'ok', version: process.version });
  checks.push(await checkPlaywright());
  checks.push(await checkExecutable('ffmpeg', ['-version']));
  checks.push(await checkExecutable('ffprobe', ['-version']));
  checks.push(checkPath('profileDir', profileDir, false));
  checks.push(checkPath('outputDir', outputDir, true));
  const failed = checks.some(check => check.status === 'failed');
  return {
    schemaVersion: 1,
    status: failed ? 'failed' : 'ok',
    flowUrl: FLOW_URL,
    profileDir,
    outputDir,
    checks,
    recommendations: recommendations(checks),
  };
}

async function checkPlaywright() {
  try {
    await loadPlaywright();
    return { name: 'playwright', status: 'ok' };
  } catch (error) {
    return { name: 'playwright', status: 'failed', message: error.message };
  }
}

async function checkExecutable(name, args) {
  try {
    const { stdout, stderr } = await execFileAsync(name, args, { timeout: 10000 });
    const version = `${stdout || stderr}`.split(/\r?\n/).find(Boolean) || '';
    return { name, status: 'ok', version };
  } catch (error) {
    return { name, status: 'warning', message: `${name} is unavailable: ${error.message}` };
  }
}

function checkPath(name, targetPath, createIfMissing) {
  if (fs.existsSync(targetPath)) {
    return { name, status: 'ok', path: targetPath, exists: true };
  }
  if (createIfMissing) {
    ensureDir(targetPath);
    return { name, status: 'ok', path: targetPath, exists: true, created: true };
  }
  return {
    name,
    status: 'warning',
    path: targetPath,
    exists: false,
    message: 'Profile does not exist yet. Run bootstrap to create it and log into Flow.',
  };
}

function recommendations(checks) {
  return checks
    .filter(check => check.status !== 'ok')
    .map(check => {
      if (check.name === 'playwright') return 'Run pnpm install in the TakomiFlow plugin folder.';
      if (check.name === 'ffmpeg' || check.name === 'ffprobe') return 'Install FFmpeg if media metadata or frame extraction is needed.';
      if (check.name === 'profileDir') return 'Run bootstrap in headed mode and log into Google Flow manually.';
      return check.message || `Review ${check.name}.`;
    });
}
