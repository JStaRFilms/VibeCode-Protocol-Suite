import fs from 'fs-extra';
import path from 'path';
import pc from 'picocolors';
import { PATHS } from './utils.js';

export const CORE_SKILLS = [
  'takomi',
  'sync-docs',
  'code-review',
  'security-audit',
  'optimize-agent-context',
  'agent-recovery',
  'avoid-feature-creep',
  'ai-sdk',
  'git-commit-generation',
];

export const SKILL_CATEGORIES = [
  {
    id: 'core',
    title: 'Core / Recommended',
    color: 'cyan',
    description: 'Essential skills for efficient Takomi usage.',
    skills: CORE_SKILLS,
  },
  {
    id: 'developer',
    title: 'Developer / Frameworks',
    color: 'blue',
    description: 'Framework, repo, and developer workflow helpers.',
    skills: [
      'ai-sdk',
      'nextjs-standards',
      'context7',
      'monorepo-management',
      'upgrading-expo',
      'github-ops',
      'git-worktree',
      'git-commit-generation',
      'pr-comment-fix',
      'jules',
      'gemini',
      'anti-gravity',
    ],
  },
  {
    id: 'security',
    title: 'Security / Review',
    color: 'red',
    description: 'Security, audit, and review workflows.',
    skills: [
      'security-audit',
      'audit-website',
      'code-review',
      'jstar-reviewer',
      'convex-security-audit',
      'convex-security-check',
    ],
  },
  {
    id: 'convex',
    title: 'Convex',
    color: 'green',
    description: 'Convex framework skills and best practices.',
    skills: [
      'convex',
      'convex-agents',
      'convex-best-practices',
      'convex-component-authoring',
      'convex-cron-jobs',
      'convex-file-storage',
      'convex-functions',
      'convex-http-actions',
      'convex-migrations',
      'convex-realtime',
      'convex-schema-validator',
      'convex-security-audit',
      'convex-security-check',
    ],
  },
  {
    id: 'frontend',
    title: 'Frontend / UI',
    color: 'magenta',
    description: 'Frontend implementation, UI/UX, components, and testing.',
    skills: [
      'frontend-design',
      'web-design-guidelines',
      'building-native-ui',
      'ui-ux-pro-max',
      'component-analysis',
      '21st-dev-components',
      'stitch',
      'webapp-testing',
      'figma',
    ],
  },
  {
    id: 'docs-office',
    title: 'Docs / Office / Extraction',
    color: 'yellow',
    description: 'Document formats, extraction, and README support.',
    skills: [
      'pdf',
      'docx',
      'pptx',
      'xlsx',
      'high-fidelity-extraction',
      'crafting-effective-readmes',
      'exam-creator-skill',
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing / SEO / Copy',
    color: 'green',
    description: 'Marketing, SEO, naming, pricing, and social strategy.',
    skills: [
      'copywriting',
      'marketing-ideas',
      'pricing-strategy',
      'programmatic-seo',
      'seo-ready',
      'social-content',
      'twitter-automation',
      'google-trends',
      'domain-name-brainstormer',
      'global-brand-namer',
      'youtube-pipeline',
    ],
  },
  {
    id: 'ai-media',
    title: 'AI Media / Content Creation',
    color: 'magenta',
    description: 'Optional AI media/content skills. Not installed by default.',
    skills: [
      'ai-avatar-video',
      'ai-marketing-videos',
      'ai-podcast-creation',
      'ai-product-photography',
      'ai-social-media-content',
      'ai-voice-cloning',
      'takomi-flow',
    ],
  },
  {
    id: 'creative-video',
    title: 'Creative / Video / Art',
    color: 'blue',
    description: 'Creative visuals, video, animation, and art workflows.',
    skills: [
      'algorithmic-art',
      'blender-mcp-scene-director',
      'takomi-flow',
      'remotion',
      'remotion-real-ui-video',
      'youtube-pipeline',
      'ai-avatar-video',
      'ai-marketing-videos',
      'photo-book-builder',
      'hyperframes',
      'general-video',
      'motion-graphics',
    ],
  },
  {
    id: 'hyperframes',
    title: 'HyperFrames',
    color: 'magenta',
    description: 'HTML-native video creation and animation framework.',
    skills: [
      'hyperframes',
      'hyperframes-core',
      'hyperframes-keyframes',
      'hyperframes-animation',
      'hyperframes-creative',
      'hyperframes-media',
      'hyperframes-registry',
      'hyperframes-cli',
      'remotion-to-hyperframes',
      'media-use',
      'embedded-captions',
      'faceless-explainer',
      'general-video',
      'motion-graphics',
      'music-to-video',
      'pr-to-video',
      'product-launch-video',
      'slideshow',
      'talking-head-recut',
      'website-to-video',
    ],
  },
  {
    id: 'skill-building',
    title: 'Skill Building / Prompting / Orchestration',
    color: 'cyan',
    description: 'Skill authoring, prompt engineering, and optional orchestration helpers.',
    skills: [
      'skill-creator',
      'prompt-engineering',
      'subagent-driven-development',
      'spawn-task',
    ],
  },
];

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
