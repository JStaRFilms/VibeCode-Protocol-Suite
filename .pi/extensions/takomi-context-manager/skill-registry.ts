import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getSkillCategory } from "./skill-categories";
import type { SkillRecord } from "./types";

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function getString(input: unknown, keys: string[]): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function collectSkillsFromOptions(options: unknown): SkillRecord[] {
  if (!options || typeof options !== "object") return [];
  const skills = (options as { skills?: unknown }).skills;
  const rawList = Array.isArray(skills)
    ? skills
    : skills && typeof skills === "object"
      ? Object.values(skills as Record<string, unknown>)
      : [];
  return rawList.flatMap((item): SkillRecord[] => {
    const name = getString(item, ["name", "id", "title"]);
    if (!name) return [];
    return [{
      name,
      description: getString(item, ["description", "summary"]),
      location: getString(item, ["filePath", "location", "path", "file", "skillPath"]),
      category: getString(item, ["category", "group", "taxonomy"]),
      sourceCategory: getString(item, ["sourceCategory", "installerCategory"]),
      packageName: getString(item, ["package", "packageName", "sourceSlug", "source"]),
      source: "systemPromptOptions",
    }];
  });
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() ? decodeXmlEntities(match[1].trim()) : undefined;
}

export function collectSkillsFromXml(systemPrompt: string): SkillRecord[] {
  const root = systemPrompt.match(/<available_skills>([\s\S]*?)<\/available_skills>/i);
  if (!root) return [];
  const skills: SkillRecord[] = [];
  for (const match of root[1].matchAll(/<skill>([\s\S]*?)<\/skill>/gi)) {
    const name = extractTag(match[1], "name");
    if (!name) continue;
    skills.push({
      name,
      description: extractTag(match[1], "description"),
      location: extractTag(match[1], "location"),
      category: extractTag(match[1], "category") ?? extractTag(match[1], "group"),
      sourceCategory: extractTag(match[1], "source_category") ?? extractTag(match[1], "installer_category"),
      packageName: extractTag(match[1], "package") ?? extractTag(match[1], "source"),
      source: "xml",
    });
  }
  return skills;
}

export function mergeSkills(records: SkillRecord[]): Map<string, SkillRecord> {
  const merged = new Map<string, SkillRecord>();
  for (const skill of records) {
    const key = normalizeName(skill.name);
    const existing = merged.get(key);
    merged.set(key, existing ? {
      name: existing.name,
      description: existing.description ?? skill.description,
      location: existing.location ?? skill.location,
      category: existing.category ?? skill.category,
      sourceCategory: existing.sourceCategory ?? skill.sourceCategory,
      packageName: existing.packageName ?? skill.packageName,
      source: existing.source === "systemPromptOptions" ? existing.source : skill.source,
    } : skill);
  }
  return merged;
}

export function compareSkillText(a: string, b: string): number {
  return normalizeName(a).localeCompare(normalizeName(b), "en") || a.localeCompare(b, "en");
}

export function sortedSkills(skills: Map<string, SkillRecord>): SkillRecord[] {
  return [...skills.values()].sort((a, b) => compareSkillText(a.name, b.name));
}

export type SkillCategoryGroup = { category: string; skills: SkillRecord[] };

/** Safe, renderer-only skill fields. Keep discovery/source details out of tool results. */
export type SkillRenderProjection = Pick<SkillRecord, "name" | "description">;
export type SkillIndexRenderGroup = { category: string; skills: SkillRenderProjection[] };

function categorySlug(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return normalized || undefined;
}

function pathTaxonomyCategory(location: string | undefined): string | undefined {
  if (!location) return undefined;
  const segments = location.replace(/\\/g, "/").split("/").filter(Boolean);
  const skillsIndex = segments.map((segment) => segment.toLowerCase()).lastIndexOf("skills");
  if (skillsIndex < 0) return undefined;
  // A categorized filesystem layout is .../skills/<category>/<skill>/SKILL.md.
  // A normal flat skill root (.../skills/<skill>/SKILL.md) intentionally falls through.
  const afterSkills = segments.slice(skillsIndex + 1);
  return afterSkills.length >= 3 ? categorySlug(afterSkills[0]) : undefined;
}

function packageSlug(location: string | undefined): string | undefined {
  if (!location) return undefined;
  const segments = location.replace(/\\/g, "/").split("/").filter(Boolean);
  const nodeModulesIndex = segments.map((segment) => segment.toLowerCase()).lastIndexOf("node_modules");
  if (nodeModulesIndex < 0) return undefined;
  const first = segments[nodeModulesIndex + 1];
  if (!first) return undefined;
  if (first.startsWith("@")) {
    const second = segments[nodeModulesIndex + 2];
    return second ? categorySlug(`${first.slice(1)}-${second}`) : categorySlug(first.slice(1));
  }
  return categorySlug(first);
}

/**
 * Category precedence is deterministic and does not infer from a skill name:
 * explicit skill metadata → installer/source taxonomy → path/package metadata
 * → uncategorized.
 */
export function skillCategory(skill: SkillRecord): string {
  return categorySlug(skill.category)
    ?? categorySlug(skill.sourceCategory)
    ?? pathTaxonomyCategory(skill.location)
    ?? categorySlug(skill.packageName)
    ?? packageSlug(skill.location)
    ?? "uncategorized";
}

export function groupedSkills(skills: Iterable<SkillRecord>): SkillCategoryGroup[] {
  const grouped = new Map<string, SkillRecord[]>();
  for (const skill of skills) {
    const category = skillCategory(skill);
    const entries = grouped.get(category) ?? [];
    entries.push(skill);
    grouped.set(category, entries);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => compareSkillText(a, b))
    .map(([category, entries]) => ({ category, skills: entries.sort((a, b) => compareSkillText(a.name, b.name)) }));
}

/**
 * Project the registry into the only fields the skill-index renderer needs.
 * Locations and discovery metadata must remain internal to the registry.
 */
export function skillIndexRenderGroups(skills: Iterable<SkillRecord>): SkillIndexRenderGroup[] {
  return groupedSkills(skills).map(({ category, skills: entries }) => ({
    category,
    skills: entries.map(({ name, description }) => ({ name, description })),
  }));
}

export function findSkill(skills: Map<string, SkillRecord>, name: string): SkillRecord | undefined {
  const key = normalizeName(name);
  const exact = skills.get(key);
  if (exact) return exact;
  const matches = sortedSkills(skills).filter((skill) => normalizeName(skill.name).includes(key));
  return matches.length === 1 ? matches[0] : undefined;
}

function parseFrontmatter(text: string): Record<string, string> {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const parsed = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!parsed) continue;
    data[parsed[1]] = parsed[2].replace(/^['\"]|['\"]$/g, "").trim();
  }
  return data;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readSkillFile(filePath: string): Promise<SkillRecord | undefined> {
  try {
    const text = await readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(text);
    const name = frontmatter.name?.trim() || path.basename(path.dirname(filePath));
    const description = frontmatter.description?.trim();
    if (!name || !description) return undefined;
    return {
      name,
      description,
      location: filePath,
      category: frontmatter.category?.trim() || frontmatter.group?.trim(),
      packageName: frontmatter.package?.trim() || frontmatter.source?.trim(),
      source: "filesystem",
    };
  } catch {
    return undefined;
  }
}

async function collectSkillFiles(root: string, directMarkdownFiles = false, depth = 0, maxDepth = 8): Promise<string[]> {
  if (depth > maxDepth || !await pathExists(root)) return [];
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  if (await pathExists(path.join(root, "SKILL.md"))) files.push(path.join(root, "SKILL.md"));
  if (directMarkdownFiles && depth === 0) {
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(path.join(root, entry.name));
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if ([".git", "node_modules"].includes(entry.name)) continue;
    files.push(...await collectSkillFiles(path.join(root, entry.name), false, depth + 1, maxDepth));
  }
  return [...new Set(files)];
}

async function collectPackageSkillRoots(nodeModulesRoot: string): Promise<string[]> {
  if (!await pathExists(nodeModulesRoot)) return [];
  const roots: string[] = [];
  let packages: Array<{ name: string; isDirectory(): boolean }> = [];
  try {
    packages = await readdir(nodeModulesRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const pkg of packages) {
    if (!pkg.isDirectory()) continue;
    if (pkg.name.startsWith("@")) {
      const scopeRoot = path.join(nodeModulesRoot, pkg.name);
      let scoped: Array<{ name: string; isDirectory(): boolean }> = [];
      try {
        scoped = await readdir(scopeRoot, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const scopedPkg of scoped) if (scopedPkg.isDirectory()) roots.push(path.join(scopeRoot, scopedPkg.name, "skills"));
      continue;
    }
    roots.push(path.join(nodeModulesRoot, pkg.name, "skills"));
  }
  return roots;
}

export type InstallerTaxonomyEntry = { category: string; skillFilePath: string };

export type InstallerTaxonomyOptions = {
  home?: string;
  takomiHome?: string;
};

function canonicalPath(filePath: string): string {
  const resolved = path.normalize(path.resolve(filePath));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/**
 * Read Takomi's installer ownership registry without mutating or reconciling it.
 * Legacy owned entries without category metadata use the tracked catalog's
 * stable primary category, so upgrades do not require another installer run.
 */
export async function readInstallerTaxonomy(options: InstallerTaxonomyOptions = {}): Promise<Map<string, InstallerTaxonomyEntry>> {
  const home = options.home ?? os.homedir();
  const manifestPath = path.join(options.takomiHome ?? process.env.TAKOMI_HOME_DIR ?? path.join(home, ".takomi"), "skills-manifest.json");
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      targetRoot?: unknown;
      owned?: Record<string, unknown>;
    };
    const targetRoot = typeof manifest.targetRoot === "string" && manifest.targetRoot.trim()
      ? manifest.targetRoot
      : path.join(home, ".agents", "skills");
    const taxonomy = new Map<string, InstallerTaxonomyEntry>();
    for (const [name, rawEntry] of Object.entries(manifest.owned ?? {})) {
      if (!rawEntry || (typeof rawEntry !== "object" && typeof rawEntry !== "string")) continue;
      const entry = typeof rawEntry === "object" ? rawEntry as Record<string, unknown> : {};
      const manifestCategory = typeof entry.category === "string" && entry.category.trim()
        ? entry.category.trim()
        : undefined;
      const category = manifestCategory ?? getSkillCategory(name);
      if (!category) continue;
      const targetPath = typeof entry.targetPath === "string" && entry.targetPath.trim()
        ? entry.targetPath
        : path.join(targetRoot, name);
      taxonomy.set(normalizeName(name), {
        category,
        skillFilePath: canonicalPath(path.join(targetPath, "SKILL.md")),
      });
    }
    return taxonomy;
  } catch {
    return new Map();
  }
}

/**
 * Enrich records already supplied by Pi using exact name + canonical SKILL.md
 * ownership. This remains independent from filesystem discovery and read-only.
 */
export function applyInstallerTaxonomy(skills: SkillRecord[], taxonomy: Map<string, InstallerTaxonomyEntry>): SkillRecord[] {
  return skills.map((skill) => {
    const entry = taxonomy.get(normalizeName(skill.name));
    if (!entry || !skill.location || canonicalPath(skill.location) !== entry.skillFilePath) return skill;
    return { ...skill, sourceCategory: skill.sourceCategory ?? entry.category };
  });
}

export async function enrichSkillsWithInstallerTaxonomy(
  skills: SkillRecord[],
  options: InstallerTaxonomyOptions = {},
): Promise<SkillRecord[]> {
  if (skills.length === 0) return skills;
  return applyInstallerTaxonomy(skills, await readInstallerTaxonomy(options));
}

function ancestorSkillRoots(cwd: string): string[] {
  const roots: string[] = [];
  let current = path.resolve(cwd || process.cwd());
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    roots.push(path.join(current, ".agents", "skills"));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  roots.push(path.resolve(cwd || process.cwd(), ".pi", "skills"));
  return roots;
}

export async function discoverSkillsFromFilesystem(cwd = process.cwd(), options: InstallerTaxonomyOptions = {}): Promise<SkillRecord[]> {
  const home = options.home ?? os.homedir();
  const roots = [
    { root: path.join(home, ".pi", "agent", "skills"), directMarkdownFiles: true },
    { root: path.join(home, ".agents", "skills"), directMarkdownFiles: false },
    ...ancestorSkillRoots(cwd).map((root) => ({ root, directMarkdownFiles: root.endsWith(`${path.sep}.pi${path.sep}skills`) })),
    ...(await collectPackageSkillRoots(path.join(home, ".pi", "agent", "npm", "node_modules"))).map((root) => ({ root, directMarkdownFiles: false })),
  ];
  const skillFiles = new Set<string>();
  for (const { root, directMarkdownFiles } of roots) {
    for (const file of await collectSkillFiles(root, directMarkdownFiles)) skillFiles.add(file);
  }
  const skills = (await Promise.all([...skillFiles].map(readSkillFile))).filter((skill): skill is SkillRecord => Boolean(skill));
  return enrichSkillsWithInstallerTaxonomy(skills, options);
}
