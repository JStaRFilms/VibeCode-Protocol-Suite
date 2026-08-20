export const CORE_SKILLS = [
  'takomi',
  'sync-docs',
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
    id: 'dev-workflows',
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
      'shared-resend-portfolio',
      'jules',
      'anti-gravity',
      'audit-website',
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
    description: 'Video creation, motion graphics, animation, and art workflows.',
    skills: [
      'hyperframes',
      'remotion',
      'remotion-real-ui-video',
      'zack-d-films-production-suite',
      'algorithmic-art',
      'blender-mcp-scene-director',
    ],
  },
  {
    id: 'ai-media',
    title: 'AI Media / Content Creation',
    color: 'magenta',
    description: 'AI media generation, video, audio, and photo tools.',
    skills: [
      'takomi-flow',
      'ai-avatar-video',
      'ai-marketing-videos',
      'photo-book-builder',
      'ai-podcast-creation',
      'ai-product-photography',
      'ai-social-media-content',
      'ai-voice-cloning',
    ],
  },
  {
    id: 'marketing-seo',
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
    id: 'office-docs',
    title: 'Docs / Office / Extraction',
    color: 'yellow',
    description: 'Document formats (PDF, DOCX, PPTX, XLSX), extraction, and READMEs.',
    skills: [
      'office-docs',
      'high-fidelity-extraction',
      'crafting-effective-readmes',
      'exam-creator-skill',
    ],
  },
  {
    id: 'skill-authoring',
    title: 'Skill Building / Prompting / Orchestration',
    color: 'cyan',
    description: 'Skill authoring, prompt engineering, and orchestration helpers.',
    skills: [
      'skill-creator',
      'prompt-engineering',
      'subagent-driven-development',
      'spawn-task',
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
