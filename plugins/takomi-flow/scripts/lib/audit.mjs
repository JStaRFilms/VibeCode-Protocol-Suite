import fs from 'node:fs';
import { runDoctor } from './doctor.mjs';
import { loadCapabilities } from './capabilities.mjs';
import { listRuns } from './inspect.mjs';

export async function runAudit(args = {}) {
  const doctor = await runDoctor({
    profileDir: args.profileDir,
    outputDir: args.outputDir,
  });
  const capabilities = loadCapabilities();
  const history = listRuns(doctor.outputDir, args.limit || 5);
  const profileReady = fs.existsSync(doctor.profileDir);
  const browserReady = doctor.checks.every(check => (
    check.name === 'profileDir' || check.status !== 'failed'
  ));
  return {
    schemaVersion: 1,
    status: doctor.status === 'failed' ? 'failed' : 'ok',
    readiness: {
      browserAutomation: browserReady,
      flowProfile: profileReady,
      mediaReview: hasCheck(doctor, 'ffmpeg') && hasCheck(doctor, 'ffprobe'),
      mcpTools: capabilities.mcpTools.length,
      mcpResources: capabilities.mcpResources.length,
    },
    safeActions: [
      'capabilities',
      'examples',
      'plan',
      'template',
      'workflow without submit',
      'validate',
      'runs',
      'inspect',
      'assets',
      'review',
      'collect',
      'report',
      'selftest',
    ],
    gatedActions: [
      'bootstrap requires a headed browser and manual Google login',
      'observe requires allowBrowser=true',
      'generate requires allowBrowser=true and allowSpend=true',
      'workflow submit requires allowBrowser=true and allowSpend=true',
    ],
    doctor,
    recentRuns: history.runs,
    nextActions: nextActions(doctor, profileReady, history.runs),
  };
}

function hasCheck(doctor, name) {
  return doctor.checks.some(check => check.name === name && check.status === 'ok');
}

function nextActions(doctor, profileReady, runs) {
  const actions = [...doctor.recommendations];
  if (!profileReady) actions.push('Run bootstrap in headed mode and log into Google Flow manually.');
  if (!runs.length) actions.push('Run workflow to prepare the first request, or smoke after login.');
  if (runs.some(run => run.status === 'downloaded')) actions.push('Run review on downloaded runs before reusing assets.');
  if (!actions.length) actions.push('TakomiFlow is ready for safe no-spend workflow preparation.');
  return [...new Set(actions)];
}
