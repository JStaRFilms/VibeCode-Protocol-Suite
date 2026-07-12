import os from "node:os";
import path from "node:path";
import type { ContextManagerState } from "./state";
import { sortedSkills } from "./skill-registry";
import { syncReportLedger } from "./state";
import { renderDuplicateExtensionGuidance } from "./extension-conflicts";

export type ContextReportMode = "summary" | "verbose" | "problems";

type IssueSeverity = "info" | "attention" | "blocked" | "failed";

type ReportIssue = {
  severity: IssueSeverity;
  title: string;
  impact: string;
  fix: string;
  details?: string[];
  timestamp?: string;
};

function normalizeMode(modeOrVerbose: ContextReportMode | boolean = "summary"): ContextReportMode {
  if (modeOrVerbose === true) return "verbose";
  if (modeOrVerbose === false) return "summary";
  return modeOrVerbose;
}

function projectName(cwd: string): string {
  return cwd ? path.basename(cwd) || cwd : "unknown";
}

function fmtNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function reductionPercent(originalLength: number, rewrittenLength: number): number {
  if (originalLength <= 0) return 0;
  return Math.round((1 - rewrittenLength / originalLength) * 1000) / 10;
}

function statusIcon(severity: IssueSeverity): string {
  if (severity === "failed") return "❌";
  if (severity === "blocked") return "⛔";
  if (severity === "attention") return "⚠";
  return "ℹ";
}

function issueRank(severity: IssueSeverity): number {
  if (severity === "failed") return 0;
  if (severity === "blocked") return 1;
  if (severity === "attention") return 2;
  return 3;
}

function collectIssues(state: ContextManagerState): ReportIssue[] {
  const report = state.report;
  const issues: ReportIssue[] = [];

  if (report.promptRewrite.attempted && report.promptRewrite.rewrittenLength === 0) {
    issues.push({
      severity: "failed",
      title: "Prompt rewrite returned an empty prompt",
      impact: "The context manager may not have returned usable prompt context.",
      fix: "Reload Pi and retry. If it repeats, inspect prompt-rewriter warnings and recent extension changes.",
    });
  }

  for (const warning of report.promptRewrite.warnings) {
    issues.push({
      severity: "attention",
      title: "Prompt rewrite warning",
      impact: warning,
      fix: "Review prompt rewrite configuration or run context_report({ mode: \"verbose\" }) for details.",
    });
  }

  for (const action of report.blockedActions.slice(-5)) {
    issues.push({
      severity: "blocked",
      title: `${action.toolName} was blocked by a context-manager gate`,
      impact: "A required prerequisite prevented the operation from running at that point in the session.",
      fix: action.reason.includes("Retry") || action.reason.includes("retry")
        ? "Follow the gate guidance and retry the original operation if it is still needed."
        : "Review the blocked action details in verbose mode before retrying.",
      details: [action.reason.split(/\r?\n/)[0]].filter(Boolean),
      timestamp: action.timestamp,
    });
  }

  for (const correction of report.modelRoutingCorrections ?? []) {
    issues.push({
      severity: "attention",
      title: "Model routing was corrected",
      impact: `${correction.from} was replaced with ${correction.to}.`,
      fix: "Use the approved provider-qualified model ID in future takomi_subagent calls.",
      timestamp: correction.timestamp,
    });
  }

  if (report.duplicateExtensionWarnings.length > 0) {
    const tools = report.duplicateExtensionWarnings.map((warning) => warning.toolName);
    const paths = [...new Set(report.duplicateExtensionWarnings.flatMap((warning) => warning.paths))];
    issues.push({
      severity: "attention",
      title: "Duplicate Takomi extension registrations",
      impact: `${tools.length} Takomi tool${tools.length === 1 ? "" : "s"} are registered from both global and project extension paths; behavior may depend on load order.`,
      fix: "Use scripts/pi-dev.ps1 while developing Takomi, or remove/sync the stale duplicate extension source for normal Pi sessions.",
      details: [`Tools: ${tools.join(", ")}`, ...paths],
    });
  }

  if (report.skillCount === 0) {
    issues.push({
      severity: "info",
      title: "No skills discovered by context-manager",
      impact: "This only describes context-manager discovery, not necessarily all Pi skill state.",
      fix: "Run `/reload` after skill or extension changes, then retry context_report.",
    });
  }

  if (report.sessionRestore.attempted && !report.sessionRestore.restored && report.toolCalls.contextReport > 1) {
    issues.push({
      severity: "info",
      title: "No previous context-manager history restored",
      impact: "The report is based on current in-memory state and discovery only.",
      fix: "No action is needed unless you expected earlier context-manager tool calls in this Pi session.",
    });
  }

  return issues.sort((a, b) => issueRank(a.severity) - issueRank(b.severity) || (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
}

function overallStatus(issues: ReportIssue[]): { label: string; next: string; warningCount: number } {
  const actionable = issues.filter((issue) => issue.severity !== "info");
  const highest = issues[0]?.severity;
  if (!issues.length) return { label: "✅ Healthy", next: "No action needed.", warningCount: 0 };
  if (!actionable.length) return { label: "ℹ Informational", next: issues[0].fix, warningCount: 0 };
  if (highest === "failed") return { label: "❌ Failed", next: actionable[0].fix, warningCount: actionable.length };
  if (highest === "blocked") return { label: "⛔ Blocked", next: actionable[0].fix, warningCount: actionable.length };
  return { label: "⚠ Attention Required", next: actionable[0].fix, warningCount: actionable.length };
}

export type ContextReportPresentation = {
  status: "success" | "warning" | "error" | "pending";
  summary: string;
  attentionCount: number;
};

/** Structured execution metadata shared by context_report renderers. */
export function contextReportPresentation(state: ContextManagerState): ContextReportPresentation {
  syncReportLedger(state);
  const issues = collectIssues(state);
  const overall = overallStatus(issues);
  const actionable = issues.filter((issue) => issue.severity !== "info");
  const status = issues.length === 0
    ? "success"
    : actionable.some((issue) => issue.severity === "failed" || issue.severity === "blocked")
      ? "error"
      : actionable.length > 0
        ? "warning"
        : "pending";
  return {
    status,
    summary: overall.label.replace(/^[^\w]+\s*/, ""),
    attentionCount: overall.warningCount,
  };
}

function promptRewriteState(state: ContextManagerState): string {
  const rewrite = state.report.promptRewrite;
  if (!rewrite.attempted) return "Not run yet";
  if (rewrite.rewrittenLength === 0) return "Failed";
  if (!rewrite.changed) return "Checked · no change";
  return `Applied · ${reductionPercent(rewrite.originalLength, rewrite.rewrittenLength)}% reduction`;
}

function restoreState(state: ContextManagerState): string {
  const restore = state.report.sessionRestore;
  if (!restore.attempted) return "Not checked yet";
  if (!restore.restored) return "No prior history found";
  const sources: string[] = [];
  if (restore.snapshotCount > 0) sources.push("snapshots");
  if (restore.toolResultCount > 0) sources.push("tool history");
  return `Restored from ${sources.join(" and ") || "session history"}`;
}

function policyState(state: ContextManagerState): string {
  const available = state.policies.size;
  const loaded = state.report.loadedPolicies.length;
  if (available === 0 && loaded === 0) return "None discovered";
  if (loaded === 0) return `${available} available · none loaded`;
  return `${loaded} loaded`;
}

function contextToolCalls(state: ContextManagerState): number {
  const calls = state.report.toolCalls;
  return calls.skillIndex + calls.skillManifest + calls.skillLoad + calls.policyManifest + calls.policyLoad + calls.contextReport;
}

function renderHeader(state: ContextManagerState, status: ReturnType<typeof overallStatus>, title = "Takomi Context Report"): string[] {
  const report = state.report;
  return [
    title,
    "─".repeat(title.length),
    `Status : ${status.label}`,
    `Project: ${projectName(report.cwd)}`,
    `Updated: ${report.timestamp}`,
  ];
}

function renderSummaryLine(label: string, value: string): string {
  return `  ${label.padEnd(16)} ${value}`;
}

function renderSummary(state: ContextManagerState): string {
  syncReportLedger(state);
  const issues = collectIssues(state);
  const status = overallStatus(issues);
  const report = state.report;
  const lines = [
    ...renderHeader(state, status),
    "",
    "Overview",
    renderSummaryLine("Session restore", restoreState(state)),
    renderSummaryLine("Skills", `${fmtNumber(report.skillCount)} discovered, ${report.loadedByTool.length} loaded`),
    renderSummaryLine("Policies", policyState(state)),
    renderSummaryLine("Prompt rewrite", promptRewriteState(state)),
    renderSummaryLine("Warnings", status.warningCount === 0 ? "None" : String(status.warningCount)),
  ];

  const visibleProblems = issues.filter((issue) => issue.severity !== "info").slice(0, 3);
  if (visibleProblems.length > 0) {
    lines.push("", "Needs attention");
    visibleProblems.forEach((issue, index) => {
      lines.push(`  ${index + 1}. ${statusIcon(issue.severity)} ${issue.title}`);
      lines.push(`     ${issue.fix.replace(/`/g, "")}`);
      if (issue.details?.[0]) lines.push(`     ${issue.details[0].replace(/`/g, "")}`);
    });
    const remaining = issues.filter((issue) => issue.severity !== "info").length - visibleProblems.length;
    if (remaining > 0) lines.push(`  …and ${remaining} more. Run context_report({ mode: "problems" }).`);
  }

  lines.push("", `Next: ${status.next.replace(/`/g, "")}`);
  return lines.join("\n");
}

function renderSessionRestore(state: ContextManagerState): string[] {
  const restore = state.report.sessionRestore;
  return [
    "## Session Restore",
    "",
    `**Result:** ${restore.restored ? "✅ Restored" : restore.attempted ? "ℹ No prior history found" : "ℹ Not checked yet"}`,
    "",
    "| Source | Result |",
    "|---|---:|",
    "| Current in-memory state | Active |",
    `| Context-manager snapshots | ${restore.snapshotCount} restored |`,
    `| Pi tool results | ${restore.toolResultCount} scanned |`,
    `| Filesystem skill discovery | ${state.report.skillCount > 0 ? "Used" : "No skills found"} |`,
    "",
    restore.note,
  ];
}

function renderSkills(state: ContextManagerState): string[] {
  const report = state.report;
  const sourceCounts = sortedSkills(state.skills).reduce((counts, skill) => {
    counts.set(skill.source, (counts.get(skill.source) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const loaded = report.loadedByTool.length ? report.loadedByTool.map((skill) => `- \`${skill}\``) : ["No skills have been loaded through `skill_load` in restored/current context-manager state."];
  const candidateRows = report.candidates.length
    ? report.candidates.map((candidate) => `| \`${candidate.name}\` | ${candidate.confidence} | ${report.loadedByTool.includes(candidate.name) ? "Loaded" : "Not loaded"} |`)
    : ["No candidate skills recorded for the latest prompt rewrite."];
  const sourceRows = [...sourceCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([source, count]) => `| ${source} | ${count} |`);

  return [
    "## Skills",
    "",
    `**Skills discovered:** ${fmtNumber(report.skillCount)}  `,
    `**Skills loaded this session:** ${report.loadedByTool.length}`,
    "",
    "### Loaded Skills",
    "",
    ...loaded,
    "",
    "### Candidate Skills",
    "",
    ...(report.candidates.length ? ["| Skill | Confidence | State |", "|---|---:|---|", ...candidateRows] : candidateRows),
    "",
    "### Discovery Sources",
    "",
    ...(sourceRows.length ? ["| Source | Skills Found |", "|---|---:|", ...sourceRows] : ["No discovery sources recorded."]),
  ];
}

function renderPoliciesSection(state: ContextManagerState): string[] {
  const policies = [...state.policies.values()].sort((a, b) => a.name.localeCompare(b.name));
  const loaded = state.report.loadedPolicies.length ? state.report.loadedPolicies.map((policy) => `- \`${policy}\``) : ["No policies loaded in restored/current context-manager state."];
  const availableRows = policies.map((policy) => `| \`${policy.name}\` | ${policy.description.replace(/\|/g, "\\|")} | ${policy.path ? `\`${policy.path}\`` : "generated/default"} |`);
  const modelRouting = policies.find((policy) => policy.name === "model-routing");

  return [
    "## Policies",
    "",
    "### Loaded Policies",
    "",
    ...loaded,
    "",
    "### Available Policies",
    "",
    ...(availableRows.length ? ["| Policy | Purpose | Source |", "|---|---|---|", ...availableRows] : ["No policy packs discovered."]),
    "",
    "### Gated Tools",
    "",
    ...(modelRouting
      ? [
        "| Tool | Required Policy | State |",
        "|---|---|---|",
        "| `takomi_subagent` | `model-routing` | " + (state.report.loadedPolicies.includes("model-routing") ? "Ready" : "Loads on demand / gated") + " |",
      ]
      : ["No gated tool policy mapping discovered."]),
  ];
}

function renderPromptRewrite(state: ContextManagerState): string[] {
  const rewrite = state.report.promptRewrite;
  const reduction = reductionPercent(rewrite.originalLength, rewrite.rewrittenLength);
  return [
    "## Prompt Rewrite",
    "",
    `**Result:** ${rewrite.attempted ? rewrite.rewrittenLength === 0 ? "❌ Failed" : rewrite.changed ? "✅ Applied" : "ℹ Checked, no change" : "ℹ Not run yet"}`,
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Original length | ${fmtNumber(rewrite.originalLength)} characters |`,
    `| Rewritten length | ${fmtNumber(rewrite.rewrittenLength)} characters |`,
    `| Reduction | ${reduction}% |`,
    "",
    rewrite.removedSections.length ? "Compressed areas:" : "No compressed areas recorded.",
    ...rewrite.removedSections.map((section) => `- ${section}`),
    "",
    rewrite.warnings.length ? "Rewrite warnings:" : "No rewrite warnings were recorded.",
    ...rewrite.warnings.map((warning) => `- ${warning}`),
  ];
}

function renderToolUsage(state: ContextManagerState): string[] {
  const calls = state.report.toolCalls;
  return [
    "## Context-Manager Tool Usage",
    "",
    "| Tool | Calls |",
    "|---|---:|",
    `| \`skill_index\` | ${calls.skillIndex} |`,
    `| \`skill_manifest\` | ${calls.skillManifest} |`,
    `| \`skill_load\` | ${calls.skillLoad} |`,
    `| \`policy_manifest\` | ${calls.policyManifest} |`,
    `| \`policy_load\` | ${calls.policyLoad} |`,
    `| \`context_report\` | ${calls.contextReport} |`,
    "",
    `Total context-manager tool calls observed: ${contextToolCalls(state)}.` ,
  ];
}

function renderGatesAndCorrections(state: ContextManagerState): string[] {
  const report = state.report;
  const lines = [
    "## Gates and Corrections",
    "",
    `**Blocked actions:** ${report.blockedActions.length}  `,
    `**Model-routing corrections:** ${(report.modelRoutingCorrections ?? []).length}`,
  ];
  if (report.blockedActions.length === 0 && !(report.modelRoutingCorrections ?? []).length) {
    lines.push("", "No blocked actions or model-routing corrections recorded.");
    return lines;
  }
  for (const action of report.blockedActions.slice(-5)) {
    lines.push("", `### ${action.toolName}`, "", `- **Time:** ${action.timestamp}`, `- **Cause:** ${action.reason.split(/\r?\n/)[0] || "Context-manager gate blocked the action."}`, "- **Recovery:** Follow the gate guidance; retry may be required.");
  }
  for (const correction of (report.modelRoutingCorrections ?? []).slice(-5)) {
    lines.push("", `### Model correction`, "", `- **Time:** ${correction.timestamp}`, `- **Change:** \`${correction.from}\` → \`${correction.to}\``, `- **Tool:** ${correction.toolName}`);
  }
  return lines;
}

function renderExtensionDiagnostics(state: ContextManagerState): string[] {
  return [
    "## Extension Diagnostics",
    "",
    ...(state.report.duplicateExtensionWarnings.length
      ? renderDuplicateExtensionGuidance(state.report.duplicateExtensionWarnings, state.report.cwd)
      : ["✅ No duplicate extension registrations detected."]),
  ];
}

function renderFileLedger(state: ContextManagerState): string[] {
  const report = state.report;
  return [
    "## Context-Manager File Ledger",
    "",
    "| Activity | Files |",
    "|---|---:|",
    `| Read | ${report.readFiles.length} |`,
    `| Edited | ${report.editedFiles.length} |`,
    `| Written | ${report.writtenFiles.length} |`,
    "",
    "This ledger only includes activity explicitly tracked by the context manager.",
  ];
}

function renderScope(): string[] {
  return [
    "## Scope",
    "",
    "- This report covers Takomi context-manager state.",
    "- It is not a complete Pi transcript or activity audit.",
    "- Pi Alt-C remains the source of truth for token and context-window statistics.",
    "- Native Pi tools may not appear unless their activity is mirrored into context-manager state.",
    "- Run `/reload` after installing or updating extensions.",
  ];
}

function displayPath(filePath: string | undefined, cwd: string): string {
  if (!filePath) return "generated/default";
  const relative = path.relative(cwd, filePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return relative;
  const home = os.homedir();
  if (filePath.startsWith(home)) return `~${filePath.slice(home.length)}`;
  return filePath;
}

function clip(value: string, max = 110): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function renderVerbose(state: ContextManagerState): string {
  syncReportLedger(state);
  const issues = collectIssues(state);
  const status = overallStatus(issues);
  const report = state.report;
  const rewrite = report.promptRewrite;
  const restore = report.sessionRestore;
  const sourceCounts = sortedSkills(state.skills).reduce((counts, skill) => {
    counts.set(skill.source, (counts.get(skill.source) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const calls = report.toolCalls;
  const lines = [
    ...renderHeader(state, status, "Takomi Context Report — Verbose"),
    renderSummaryLine("Warnings", status.warningCount === 0 ? "None" : String(status.warningCount)),
    "",
    "Overview",
    renderSummaryLine("Session restore", restoreState(state)),
    renderSummaryLine("Skills", `${fmtNumber(report.skillCount)} discovered, ${report.loadedByTool.length} loaded`),
    renderSummaryLine("Policies", `${state.policies.size} available, ${report.loadedPolicies.length} loaded`),
    renderSummaryLine("Prompt rewrite", promptRewriteState(state)),
    renderSummaryLine("Gated actions", report.blockedActions.length ? `${report.blockedActions.length} recorded` : "None"),
    renderSummaryLine("Extensions", report.duplicateExtensionWarnings.length ? `${report.duplicateExtensionWarnings.length} duplicate tool registrations` : "No conflicts"),
    "",
    "Session restore",
    renderSummaryLine("Result", restore.restored ? "Restored" : restore.attempted ? "No prior history found" : "Not checked yet"),
    renderSummaryLine("Snapshots", `${restore.snapshotCount} restored`),
    renderSummaryLine("Tool results", `${restore.toolResultCount} scanned`),
    renderSummaryLine("Skill discovery", report.skillCount > 0 ? "Filesystem scan used" : "No skills found"),
    `  Note             ${restore.note}`,
    "",
    "Skills",
    renderSummaryLine("Discovered", fmtNumber(report.skillCount)),
    renderSummaryLine("Loaded", String(report.loadedByTool.length)),
    ...(report.loadedByTool.length ? ["  Loaded skills", ...report.loadedByTool.map((skill) => `    - ${skill}`)] : ["  Loaded skills   None recorded"]),
    ...(report.candidates.length ? ["  Candidate skills", ...report.candidates.map((candidate) => `    - ${candidate.name} (${candidate.confidence}, ${report.loadedByTool.includes(candidate.name) ? "loaded" : "not loaded"})`)] : ["  Candidate skills None recorded"]),
    ...(sourceCounts.size ? ["  Discovery sources", ...[...sourceCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([source, count]) => `    - ${source}: ${count}`)] : ["  Discovery sources None recorded"]),
    "",
    "Policies",
    renderSummaryLine("Available", String(state.policies.size)),
    renderSummaryLine("Loaded", report.loadedPolicies.length ? report.loadedPolicies.join(", ") : "None"),
    ...(state.policies.size ? ["  Available policies", ...[...state.policies.values()].sort((a, b) => a.name.localeCompare(b.name)).map((policy) => `    - ${policy.name}: ${clip(policy.description)}\n      source: ${displayPath(policy.path, report.cwd)}`)] : ["  Available policies None discovered"]),
    "  Gated tools",
    state.policies.has("model-routing")
      ? `    - takomi_subagent requires model-routing (${report.loadedPolicies.includes("model-routing") ? "ready" : "loads on demand / gated"})`
      : "    - No gated tool policy mapping discovered",
    "",
    "Prompt rewrite",
    renderSummaryLine("Result", rewrite.attempted ? rewrite.rewrittenLength === 0 ? "Failed" : rewrite.changed ? "Applied" : "Checked, no change" : "Not run yet"),
    renderSummaryLine("Original", `${fmtNumber(rewrite.originalLength)} chars`),
    renderSummaryLine("Rewritten", `${fmtNumber(rewrite.rewrittenLength)} chars`),
    renderSummaryLine("Reduction", `${reductionPercent(rewrite.originalLength, rewrite.rewrittenLength)}%`),
    ...(rewrite.removedSections.length ? ["  Compressed areas", ...rewrite.removedSections.map((section) => `    - ${section}`)] : ["  Compressed areas None recorded"]),
    ...(rewrite.warnings.length ? ["  Rewrite warnings", ...rewrite.warnings.map((warning) => `    - ${warning}`)] : ["  Rewrite warnings None"]),
    "",
    "Context-manager tool usage",
    renderSummaryLine("skill_index", String(calls.skillIndex)),
    renderSummaryLine("skill_manifest", String(calls.skillManifest)),
    renderSummaryLine("skill_load", String(calls.skillLoad)),
    renderSummaryLine("policy_manifest", String(calls.policyManifest)),
    renderSummaryLine("policy_load", String(calls.policyLoad)),
    renderSummaryLine("context_report", String(calls.contextReport)),
    renderSummaryLine("Total", String(contextToolCalls(state))),
    "",
    "Gates and corrections",
    renderSummaryLine("Blocked", String(report.blockedActions.length)),
    renderSummaryLine("Corrections", String((report.modelRoutingCorrections ?? []).length)),
    ...(report.blockedActions.length ? report.blockedActions.slice(-5).flatMap((action) => [
      `  - ${action.toolName} at ${action.timestamp}`,
      `    cause: ${action.reason.split(/\r?\n/)[0] || "Context-manager gate blocked the action."}`,
    ]) : ["  No blocked actions recorded"]),
    ...((report.modelRoutingCorrections ?? []).length ? (report.modelRoutingCorrections ?? []).slice(-5).map((correction) => `  - ${correction.from} -> ${correction.to} (${correction.toolName}, ${correction.timestamp})`) : ["  No model-routing corrections recorded"]),
    "",
    "Extension diagnostics",
    ...(report.duplicateExtensionWarnings.length ? [
      `  Duplicate registrations: ${report.duplicateExtensionWarnings.length} tool(s)`,
      ...report.duplicateExtensionWarnings.map((warning) => `  - ${warning.toolName}\n    global : ${displayPath(warning.paths[0], report.cwd)}\n    project: ${displayPath(warning.paths[1], report.cwd)}`),
      "  Fix: use scripts/pi-dev.ps1 while developing Takomi, or remove/sync stale duplicates for normal Pi sessions.",
    ] : ["  No duplicate extension registrations detected"]),
    "",
    "Context-manager file ledger",
    renderSummaryLine("Read", String(report.readFiles.length)),
    renderSummaryLine("Edited", String(report.editedFiles.length)),
    renderSummaryLine("Written", String(report.writtenFiles.length)),
    "  This ledger only includes activity explicitly tracked by the context manager.",
    "",
    "Scope",
    "  - Covers Takomi context-manager state only.",
    "  - Not a complete Pi transcript or activity audit.",
    "  - Pi Alt-C remains the source of truth for token/context-window statistics.",
    "  - Native Pi tools may not appear unless mirrored into context-manager state.",
    "  - Run /reload after installing or updating extensions.",
  ];
  return lines.join("\n");
}

function renderProblems(state: ContextManagerState): string {
  syncReportLedger(state);
  const issues = collectIssues(state).filter((issue) => issue.severity !== "info");
  if (issues.length === 0) return ["Takomi Context Problems", "───────────────────────", "✅ No problems detected."].join("\n");
  const status = overallStatus(issues);
  const lines = [
    "Takomi Context Problems",
    "───────────────────────",
    `Status: ${status.label}`,
    `Issues: ${issues.length}`,
  ];
  for (const [index, issue] of issues.entries()) {
    lines.push("", `${index + 1}. ${statusIcon(issue.severity)} ${issue.title}`, `   Impact: ${issue.impact.replace(/`/g, "")}`, `   Fix   : ${issue.fix.replace(/`/g, "")}`);
    if (issue.timestamp) lines.push(`   Time  : ${issue.timestamp}`);
    if (issue.details?.length) {
      lines.push("   Details:");
      for (const detail of issue.details) lines.push(`   - ${detail.replace(/`/g, "")}`);
    }
  }
  return lines.join("\n");
}

export function renderReport(state: ContextManagerState, modeOrVerbose: ContextReportMode | boolean = "summary"): string {
  const mode = normalizeMode(modeOrVerbose);
  if (mode === "verbose") return renderVerbose(state);
  if (mode === "problems") return renderProblems(state);
  return renderSummary(state);
}
