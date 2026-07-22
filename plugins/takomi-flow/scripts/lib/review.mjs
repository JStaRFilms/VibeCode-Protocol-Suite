import { inspectRun, resolveRun } from './inspect.mjs';
import { catalogAssets } from './media.mjs';
import { createReport } from './report.mjs';

export async function reviewRun(args = {}) {
  if (!args.run) throw new Error('review requires --run <run.json|run-dir>');
  const summary = inspectRun(args.run);
  const run = resolveRun(args.run);
  const catalog = await catalogAssets(run, run.data.assets || [], {
    frames: args.frames || 0,
  });
  const report = createReport({
    run: args.run,
    reportPath: args.reportPath,
  });
  return {
    schemaVersion: 1,
    status: reviewStatus(summary, catalog),
    runId: summary.runId,
    runDir: run.runDir,
    summary,
    catalog,
    reportPath: report.reportPath,
    nextActions: nextActions(summary, catalog),
  };
}

function reviewStatus(summary, catalog) {
  if (summary.errors?.length) return 'attention_required';
  if (summary.manualActions?.length) return 'manual_action_required';
  if (catalog.assets?.some(asset => asset.errors?.length || !asset.exists)) return 'attention_required';
  if (catalog.assets?.length) return 'review_ready';
  return summary.status || 'unknown';
}

function nextActions(summary, catalog) {
  const actions = [];
  if (summary.errors?.length) actions.push('Review run errors before reusing assets.');
  if (summary.manualActions?.length) actions.push(...summary.manualActions);
  if (catalog.assets?.some(asset => asset.frames?.length)) actions.push('Review extracted frames for video quality.');
  if (catalog.assets?.length) actions.push('Use reportPath for the human handoff.');
  if (!catalog.assets?.length) actions.push('No assets were cataloged; inspect screenshots and run metadata.');
  return actions;
}
