export const installCommand = "npm install -g takomi && takomi setup pi";

export const installOptions = [
  {
    id: "pi",
    label: "PI through CLI",
    command: installCommand,
    description:
      "Install Takomi's CLI, then let it configure PI so the CLI becomes the entry point into the PI-powered workflow.",
    bullets: [
      "Best path for full Takomi context management and extension orchestration.",
      "Gives you setup, refresh, status, doctor, skill sync, and PI feature packs.",
      "Use this when you want the most complete Takomi experience.",
    ],
  },
  {
    id: "codex",
    label: "Codex Plugin",
    command:
      "use takomi-codex to plan this feature and coordinate sub-agents",
    description:
      "Use the repo-local Codex plugin as a PI-free UI alternative for Takomi task discipline and sub-agent coordination.",
    bullets: [
      "No PI install required for the core orchestration mindset.",
      "Good for roadbooks, task packets, parent coordination, and review gates.",
      "You will not get every PI context-management extension, but you get a sane workflow.",
    ],
  },
  {
    id: "skill",
    label: "Raw Skill",
    command:
      "npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill takomi",
    description:
      "Install the Takomi skill into coding agents such as Anti-Gravity, Kilo Code, or other skill-aware environments.",
    bullets: [
      "Portable path for agents that can load raw skills.",
      "Useful when you want Takomi guidance without the full CLI/PI stack.",
      "Pairs well with existing agent workflows and model-specific tools.",
    ],
  },
] as const;

export const repositoryUrl =
  "https://github.com/JStaRFilms/VibeCode-Protocol-Suite";

export const navLinks = [
  { href: "/docs", label: "Documents" },
  { href: "/installation", label: "Installation" },
  { href: "/coding", label: "Coding" },
  { href: "/codex", label: "Codex Plugin" },
] as const;

export const quickLinks = [
  {
    href: "/docs",
    title: "Documents",
    text: "Roadbooks, feature blueprints, onboarding, and workflow references.",
  },
  {
    href: "/installation",
    title: "Installation",
    text: "Choose PI through CLI, Codex plugin, or raw skill installation.",
  },
  {
    href: "/coding",
    title: "Coding",
    text: "How Takomi routes Genesis, Design, Build, Review, and recovery work.",
  },
  {
    href: "/codex",
    title: "Codex Plugin",
    text: "Use Takomi as a PI-free Codex orchestration and sub-agent workflow.",
  },
] as const;
