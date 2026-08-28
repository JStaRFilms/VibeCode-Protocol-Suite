export const CORE_SKILLS = [
  'takomi',
  'grill-me',
  'code-review',
  'sync-docs',
  'security-audit',
  'agent-recovery',
  'avoid-feature-creep',
  'git-commit-generation',
];

export const SKILL_CATEGORIES = [
  {
    id: 'core',
    title: 'Core / Recommended',
    color: 'cyan',
    description: 'Essential always-active skills for baseline agent development.',
    skills: CORE_SKILLS,
  },
  {
    id: 'code-intelligence',
    title: 'Code Intelligence & Comprehension',
    color: 'blue',
    description: 'Decision archaeology (why), runtime dataflow (how), blast radius, and debugging.',
    skills: [
      'code-intelligence',
    ],
  },
  {
    id: 'principles',
    title: 'Engineering Principles',
    color: 'yellow',
    description: '21 foundational engineering, state, and context discipline principles.',
    skills: [
      'engineering-principles',
    ],
  },
  {
    id: 'dev-workflows',
    title: 'Developer / Frameworks',
    color: 'blue',
    description: 'Framework standards, git tools, developer modes, and helper clients.',
    skills: [
      'web-dev-standards',
      'ai-sdk',
      'git-github-tools',
      'context7',
      'jules',
      'anti-gravity',
      'wait-what',
      'bro',
      'poteto-mode',
    ],
  },
  {
    id: 'security',
    title: 'Security & Web Audits',
    color: 'red',
    description: 'Security audit protocols and website analysis.',
    skills: [
      'security-audit',
      'audit-website',
    ],
  },
  {
    id: 'frontend',
    title: 'Frontend / UI',
    color: 'magenta',
    description: 'Unified frontend design, UI/UX, prototyping, components, and testing suite.',
    skills: [
      'frontend-ui',
    ],
  },
  {
    id: 'convex',
    title: 'Convex Suite',
    color: 'green',
    description: 'Unified Convex backend framework suite.',
    skills: [
      'convex',
    ],
  },
  {
    id: 'video-motion',
    title: 'Video / Motion / Art',
    color: 'blue',
    description: 'Video creation (HyperFrames, Remotion, Zack), animation, and art workflows.',
    skills: [
      'hyperframes',
      'remotion',
      'zack-d-films-production-suite',
      'algorithmic-art',
    ],
  },
  {
    id: 'ai-media',
    title: 'AI Media / Content Creation',
    color: 'magenta',
    description: 'AI media generation, Google Flow, avatar video, audio, and photo tools.',
    skills: [
      'ai-media',
    ],
  },
  {
    id: 'marketing-seo',
    title: 'Marketing / SEO / Growth',
    color: 'green',
    description: 'Marketing strategy, copywriting, SEO, naming, pricing, and social suite.',
    skills: [
      'marketing-growth',
    ],
  },
  {
    id: 'office-docs',
    title: 'Docs / Office / Extraction',
    color: 'yellow',
    description: 'Office documents (PDF, DOCX, PPTX, XLSX, exams), technical writing, and web intelligence.',
    skills: [
      'office-docs',
      'high-fidelity-extraction',
    ],
  },
  {
    id: 'agent-engineering',
    title: 'Agent Engineering & Prompting',
    color: 'cyan',
    description: 'Skill authoring, prompt engineering, context optimization, SDD, and task spawning.',
    skills: [
      'agent-engineering',
    ],
  },
];

/**
 * Resolve a bundled skill to its canonical installer category. Some skills are
 * intentionally listed in multiple browsing categories; the first catalog
 * entry is the stable primary taxonomy used by install manifests and reports.
 */
export function getSkillCategory(skillName) {
  return SKILL_CATEGORIES.find((category) => category.skills.includes(skillName))?.id;
}
