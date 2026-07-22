import fs from 'fs-extra';
import path from 'path';
import pc from 'picocolors';
import { PATHS } from './utils.js';
import { CORE_SKILLS, SKILL_CATEGORIES } from '../.pi/extensions/takomi-context-manager/skill-categories.js';

export { CORE_SKILLS, SKILL_CATEGORIES, getSkillCategory } from '../.pi/extensions/takomi-context-manager/skill-categories.js';

const colorFns = {
  cyan: pc.cyan,
  blue: pc.blue,
  red: pc.red,
  green: pc.green,
  magenta: pc.magenta,
  yellow: pc.yellow,
};

export function colorCategory(category) {
  const color = colorFns[category.color] || ((value) => value);
  return color(`[${category.title}]`);
}

export async function listBundledSkillNames() {
  const entries = await fs.readdir(PATHS.skills);
  const skills = [];
  for (const entry of entries) {
    const stat = await fs.stat(path.join(PATHS.skills, entry));
    if (stat.isDirectory()) skills.push(entry);
  }
  return skills.sort();
}

export async function readSkillDescription(skillName) {
  try {
    const skillPath = path.join(PATHS.skills, skillName, 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const frontmatter = match?.[1] || '';
    const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (!descriptionMatch) return '';
    return descriptionMatch[1].trim().replace(/^['"]|['"]$/g, '');
  } catch {
    return '';
  }
}

export async function getSkillChoices(skillNames, selected = []) {
  const selectedSet = new Set(selected);
  const choices = [];
  for (const skillName of skillNames) {
    choices.push({
      title: skillName,
      value: skillName,
      selected: selectedSet.has(skillName),
      description: await readSkillDescription(skillName),
    });
  }
  return choices;
}

export async function getValidCoreSkills() {
  const bundled = new Set(await listBundledSkillNames());
  return CORE_SKILLS.filter((skill) => bundled.has(skill));
}

export async function getSkillsForCategories(categoryIds) {
  const bundled = new Set(await listBundledSkillNames());
  const selected = new Set();
  for (const category of SKILL_CATEGORIES) {
    if (!categoryIds.includes(category.id)) continue;
    for (const skill of category.skills) {
      if (bundled.has(skill)) selected.add(skill);
    }
  }
  return [...selected].sort();
}

export async function getUncategorizedSkills() {
  const bundled = await listBundledSkillNames();
  const categorized = new Set(SKILL_CATEGORIES.flatMap((category) => category.skills));
  return bundled.filter((skill) => !categorized.has(skill));
}
