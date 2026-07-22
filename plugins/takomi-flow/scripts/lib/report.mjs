import fs from 'node:fs';
import path from 'node:path';
import { defaultRunsDir, ensureDir, resolvePath } from './paths.mjs';
import { inspectRun, listRuns, resolveRun } from './inspect.mjs';

export function createReport(args = {}) {
  if (args.run) return createRunReport(args);
  return createHistoryReport(args);
}

function createRunReport(args) {
  const run = resolveRun(args.run);
  const summary = inspectRun(args.run);
  const catalog = readOptionalJson(path.join(run.runDir, 'assets.json'));
  const markdown = renderRunReport(summary, run.runDir, catalog);
  const reportPath = resolvePath(args.reportPath, path.join(run.runDir, 'report.md'));
  writeText(reportPath, markdown);
  return {
    schemaVersion: 1,
    status: 'ok',
    mode: 'run',
    runId: summary.runId,
    reportPath,
    markdown,
  };
}

function createHistoryReport(args) {
  const outputDir = resolvePath(args.outputDir, defaultRunsDir());
  const history = listRuns(outputDir, args.limit || 10);
  const markdown = renderHistoryReport(history);
  const reportPath = resolvePath(args.reportPath, path.join(outputDir, 'takomi-flow-report.md'));
  writeText(reportPath, markdown);
  return {
    schemaVersion: 1,
    status: 'ok',
    mode: 'history',
    outputDir,
    reportPath,
    runCount: history.runs.length,
    markdown,
  };
}

function renderRunReport(summary, runDir, catalog) {
  const lines = [
    '# TakomiFlow Run Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Run: ${summary.runId || 'unknown'}`,
    `Status: ${summary.status || 'unknown'}`,
    `Command: ${summary.command || 'unknown'}`,
    `Kind: ${summary.kind || 'unknown'}`,
    `Project URL: ${summary.projectUrl || 'unknown'}`,
    `Run directory: ${runDir}`,
    `Metadata: ${summary.metadataPath || 'unknown'}`,
    '',
  ];
  pushList(lines, 'Manual Actions', summary.manualActions);
  pushList(lines, 'Errors', summary.errors);
  pushList(lines, 'Screenshots', summary.screenshots);
  pushList(lines, 'Assets', summary.assets);
  if (catalog) pushCatalog(lines, catalog);
  return `${lines.join('\n')}\n`;
}

function renderHistoryReport(history) {
  const lines = [
    '# TakomiFlow Run History',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Output directory: ${history.outputDir}`,
    `Runs: ${history.runs.length}`,
    '',
  ];
  if (!history.runs.length) {
    lines.push('No TakomiFlow runs were found.', '');
    return `${lines.join('\n')}\n`;
  }
  lines.push('| Run | Status | Command | Kind | Assets | Manual Actions | Errors |');
  lines.push('| --- | --- | --- | --- | ---: | ---: | ---: |');
  for (const run of history.runs) {
    lines.push([
      cell(run.runId),
      cell(run.status),
      cell(run.command),
      cell(run.kind),
      run.assets?.length || 0,
      run.manualActions?.length || 0,
      run.errors?.length || 0,
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  lines.push('');
  lines.push('## Latest Details', '');
  for (const run of history.runs.slice(0, 5)) {
    lines.push(`### ${run.runId || 'unknown run'}`, '');
    lines.push(`- Status: ${run.status || 'unknown'}`);
    if (run.projectUrl) lines.push(`- Project URL: ${run.projectUrl}`);
    lines.push(`- Metadata: ${run.metadataPath || 'unknown'}`);
    if (run.errors?.length) lines.push(`- Errors: ${run.errors.join('; ')}`);
    if (run.manualActions?.length) lines.push(`- Manual actions: ${run.manualActions.join('; ')}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function pushList(lines, title, values = []) {
  lines.push(`## ${title}`, '');
  if (!values.length) {
    lines.push('None.', '');
    return;
  }
  for (const value of values) lines.push(`- ${value}`);
  lines.push('');
}

function pushCatalog(lines, catalog) {
  lines.push('## Asset Catalog', '');
  lines.push(`Catalog: ${catalog.assetCatalogPath || catalog.catalogPath || 'unknown'}`);
  lines.push(`Assets cataloged: ${catalog.assets?.length || 0}`);
  const frames = (catalog.assets || []).flatMap(asset => asset.frames || []);
  if (frames.length) {
    lines.push('', '### Review Frames', '');
    for (const frame of frames) lines.push(`- ${frame}`);
  }
  lines.push('');
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return { catalogPath: filePath, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text);
}

function cell(value) {
  return String(value || '').replace(/\|/g, '\\|');
}
