import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ContextManagerState } from "./state";
import { discoverSkillsFromFilesystem, findSkill, mergeSkills, normalizeName, skillIndexRenderGroups, sortedSkills, type SkillIndexRenderGroup } from "./skill-registry";
import { persistReportSnapshot, restoreReportFromSession } from "./session-state";
import { renderCompactCard, renderExpandedMarkdown, renderToolCall, resultText } from "./tool-renderers";

function renderSkillIndex(state: ContextManagerState): string {
  const skills = sortedSkills(state.skills);
  if (skills.length === 0) return "Available skills (names only): none discovered.";
  return ["Available skills (names only):", ...skills.map((skill) => `- ${skill.name}`)].join("\n");
}

function renderManifest(state: ContextManagerState, names: string[]): string {
  if (names.length === 0) return "No skills requested.";
  return names.map((name) => {
    const skill = findSkill(state.skills, name);
    if (!skill) {
      const close = sortedSkills(state.skills).filter((candidate) => normalizeName(candidate.name).includes(normalizeName(name).slice(0, 4))).slice(0, 5).map((candidate) => candidate.name);
      return [`Skill not found: ${name}`, close.length ? `Known close matches: ${close.join(", ")}` : ""].filter(Boolean).join("\n");
    }
    return [`Skill: ${skill.name}`, `Description: ${skill.description ?? "(no description discovered)"}`, `Location: ${skill.location ?? "(no location discovered)"}`].join("\n");
  }).join("\n\n");
}

const COMPACT_CATEGORY_LIMIT = 3;

function groupSummary(groups: SkillIndexRenderGroup[], maximum = groups.length): string {
  const visible = groups.slice(0, maximum).map((group) => `${group.category} ${group.skills.length}`);
  const overflow = groups.length - visible.length;
  return [...visible, ...(overflow > 0 ? [`+${overflow} more categories`] : [])].join(" · ");
}

function renderGroupedSkillIndex(groups: SkillIndexRenderGroup[]): string {
  if (groups.length === 0) return "No skills discovered.";
  return groups.map((group) => [
    `## ${group.category}`,
    "",
    ...group.skills.map((skill) => `- \`${skill.name}\`${skill.description ? ` — ${skill.description}` : ""}`),
  ].join("\n")).join("\n\n");
}

function skillMarkdown(text: string): string {
  const separator = text.indexOf("\n\n");
  return separator >= 0 ? text.slice(separator + 2) : text;
}

async function loadSkillContent(location: string): Promise<string> {
  const fileName = path.basename(location).toLowerCase();
  if (fileName !== "skill.md" && !location.toLowerCase().endsWith(".md")) throw new Error(`Refusing to load non-markdown skill location: ${location}`);
  return readFile(location, "utf8");
}

async function ensureSkillsDiscovered(state: ContextManagerState, cwd: string): Promise<void> {
  if (state.skills.size > 0) return;
  state.skills = mergeSkills(await discoverSkillsFromFilesystem(cwd));
  state.report.skillCount = state.skills.size;
}

export function registerSkillTools(pi: ExtensionAPI, state: ContextManagerState): void {
  pi.registerTool({
    name: "skill_index",
    label: "Skill Index",
    description: "Return the available skill names only. Use this to inspect capability names without loading descriptions or full instructions.",
    promptSnippet: "List available skill names only for progressive skill loading",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      await ensureSkillsDiscovered(state, ctx.cwd);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.skillIndex += 1;
      persistReportSnapshot(pi, state, "skill_index");
      const groups = skillIndexRenderGroups(state.skills.values());
      return { content: [{ type: "text", text: renderSkillIndex(state) }], details: { skillCount: state.skills.size, groups } };
    },
    renderCall(_args, theme) {
      return renderToolCall("skill_index", undefined, theme);
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details as { skillCount?: number; groups?: SkillIndexRenderGroup[] } | undefined;
      const groups = details?.groups ?? [];
      const count = details?.skillCount ?? groups.reduce((total, group) => total + group.skills.length, 0);
      if (!expanded) {
        return renderCompactCard({
          status: count ? "success" : "pending",
          title: "Skill index",
          summary: count ? `${count} skills across ${groups.length} categories` : "no skills discovered",
          metadata: groups.length ? groupSummary(groups, COMPACT_CATEGORY_LIMIT) : undefined,
        }, theme);
      }
      return renderExpandedMarkdown({
        status: count ? "success" : "pending",
        title: "Skill index",
        summary: count ? `${count} skills across ${groups.length} categories` : "no skills discovered",
        metadata: groups.length ? [groupSummary(groups)] : undefined,
        markdown: renderGroupedSkillIndex(groups),
      }, theme);
    },
  });

  pi.registerTool({
    name: "skill_manifest",
    label: "Skill Manifest",
    description: "Return descriptions and locations for selected skills without loading full SKILL.md instructions.",
    promptSnippet: "Show selected skill descriptions and locations without full instructions",
    parameters: Type.Object({ skills: Type.Array(Type.String({ description: "Skill name to inspect" })) }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      await ensureSkillsDiscovered(state, ctx.cwd);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.skillManifest += 1;
      persistReportSnapshot(pi, state, "skill_manifest");
      const found = params.skills.filter((name) => Boolean(findSkill(state.skills, name)));
      const missing = params.skills.filter((name) => !findSkill(state.skills, name));
      return { content: [{ type: "text", text: renderManifest(state, params.skills) }], details: { requested: params.skills, found, missing } };
    },
    renderCall(args, theme) {
      return renderToolCall("skill_manifest", `${args.skills.length} requested`, theme);
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details as { requested?: string[]; found?: string[]; missing?: string[] } | undefined;
      const requested = details?.requested ?? [];
      const found = details?.found ?? [];
      const missing = details?.missing ?? [];
      const status = missing.length ? "warning" : requested.length ? "success" : "pending";
      const summary = missing.length ? `${found.length} found · ${missing.length} unavailable` : requested.length ? `${found.length} skills available` : "no skills requested";
      const metadata = missing.length ? `Missing: ${missing.join(", ")}` : `${requested.length} requested`;
      if (!expanded) return renderCompactCard({ status, title: "Skill manifest", summary, metadata }, theme);
      return renderExpandedMarkdown({ status, title: "Skill manifest", summary, metadata: [metadata], markdown: resultText(result) }, theme);
    },
  });

  pi.registerTool({
    name: "skill_load",
    label: "Skill Load",
    description: "Load the full SKILL.md content for one selected skill that will actually be used.",
    promptSnippet: "Load full SKILL.md instructions for one selected skill",
    parameters: Type.Object({ skill: Type.String({ description: "Exact skill name to load" }) }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      await ensureSkillsDiscovered(state, ctx.cwd);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.skillLoad += 1;
      const skill = findSkill(state.skills, params.skill);
      if (!skill?.location) {
        persistReportSnapshot(pi, state, "skill_load_not_found");
        return { content: [{ type: "text", text: renderManifest(state, [params.skill]) }], details: { found: false, requested: params.skill }, isError: true };
      }
      try {
        const content = await loadSkillContent(skill.location);
        state.report.loadedByTool = [...new Set([...state.report.loadedByTool, skill.name])].sort();
        persistReportSnapshot(pi, state, "skill_load");
        return {
          content: [{ type: "text", text: [`Skill: ${skill.name}`, `Location: ${skill.location}`, "", content].join("\n") }],
          details: {
            found: true,
            skill: skill.name,
            description: skill.description,
            location: skill.location,
            lineCount: content.split(/\r?\n/).length,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        persistReportSnapshot(pi, state, "skill_load_error");
        return { content: [{ type: "text", text: message }], details: { found: true, skill: skill.name, error: message }, isError: true };
      }
    },
    renderCall(args, theme) {
      return renderToolCall("skill_load", args.skill, theme);
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details as { found?: boolean; skill?: string; description?: string; location?: string; lineCount?: number; error?: string } | undefined;
      const text = resultText(result);
      if (details?.error || details?.found === false) {
        const summary = details?.error ?? "skill not found";
        if (!expanded) return renderCompactCard({ status: "error", title: "Skill load", summary }, theme);
        return renderExpandedMarkdown({ status: "error", title: "Skill load", summary, markdown: text }, theme);
      }

      const name = details?.skill ?? "skill";
      const summary = details?.description ?? "skill instructions loaded";
      const metadata = `${details?.lineCount ?? text.split(/\r?\n/).length} lines`;
      if (!expanded) return renderCompactCard({ status: "success", title: name, summary, metadata }, theme);

      const container = new Container();
      container.addChild(new Text(`${theme.fg("success", "✓")} ${theme.fg("accent", theme.bold(name))} ${theme.fg("muted", "skill instructions")}`, 0, 0));
      if (details?.description) container.addChild(new Text(theme.fg("muted", details.description), 0, 0));
      if (details?.location) container.addChild(new Text(theme.fg("dim", details.location), 0, 0));
      container.addChild(new Text(theme.fg("dim", keyHint("app.tools.expand", "collapse")), 0, 0));
      container.addChild(new Markdown(skillMarkdown(text), 0, 1, getMarkdownTheme()));
      return container;
    },
  });
}
