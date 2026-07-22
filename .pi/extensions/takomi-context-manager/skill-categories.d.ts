export type SkillCategory = {
  id: string;
  title: string;
  color: string;
  description: string;
  skills: string[];
};

export const CORE_SKILLS: string[];
export const SKILL_CATEGORIES: SkillCategory[];
export function getSkillCategory(skillName: string): string | undefined;
