export type SkillRecord = {
  name: string;
  description?: string;
  location?: string;
  /** Explicit skill metadata, preferred over all other category sources. */
  category?: string;
  /** Category supplied by an installer/source registry for this exact skill path. */
  sourceCategory?: string;
  /** Package/source identifier used only when no explicit, registry, or path category exists. */
  packageName?: string;
  source: "systemPromptOptions" | "xml" | "filesystem" | "tool";
};

export type CandidateContext = {
  name: string;
  score: number;
  confidence: "high" | "medium";
  suggestedAction: "skill_load" | "skill_manifest";
  reasons: string[];
};

export type PolicyPack = {
  name: string;
  description: string;
  content: string;
  path?: string;
};

export type Prerequisite = { type: "policies"; policies: string[] };

export type SkillIndexDisplayMode = "hidden" | "candidates" | "all-names" | "auto";

export type ContextManagerConfig = {
  skillDisplay: {
    mode: SkillIndexDisplayMode;
    maxVisibleSkillNames: number;
    alwaysShowToolInstructions: boolean;
  };
  candidateRouter: {
    maxCandidates: number;
    highConfidence: number;
    mediumConfidence: number;
  };
  policyPaths: string[];
  policyFiles?: Record<string, string>;
  toolPrerequisites: Record<string, Prerequisite[]>;
  promptCompaction: {
    compactModelRouting: boolean;
    compactModelRegistry: boolean;
    compactSkillDescriptions: boolean;
  };
};

export type ContextReport = {
  timestamp: string;
  cwd: string;
  userPrompt: string;
  skillCount: number;
  candidates: CandidateContext[];
  loadedByTool: string[];
  loadedPolicies: string[];
  readFiles: string[];
  editedFiles: string[];
  writtenFiles: string[];
  blockedActions: Array<{ toolName: string; reason: string; timestamp: string }>;
  modelRoutingCorrections: Array<{ toolName: string; from: string; to: string; timestamp: string; recovery?: string }>;
  duplicateExtensionWarnings: Array<{ toolName: string; paths: string[] }>;
  sessionRestore: {
    attempted: boolean;
    restored: boolean;
    snapshotCount: number;
    toolResultCount: number;
    note: string;
  };
  promptRewrite: {
    attempted: boolean;
    changed: boolean;
    originalLength: number;
    rewrittenLength: number;
    removedSections: string[];
    warnings: string[];
  };
  toolCalls: {
    skillIndex: number;
    skillManifest: number;
    skillLoad: number;
    policyManifest: number;
    policyLoad: number;
    contextReport: number;
  };
};
