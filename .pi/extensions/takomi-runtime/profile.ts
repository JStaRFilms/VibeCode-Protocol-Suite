import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  TakomiDispatchDefaults,
  TakomiProfile,
  TakomiPersona,
  VibeLifecycleStage,
} from "../../../src/pi-takomi-core";

export const DEFAULT_TAKOMI_PROFILE: TakomiProfile = {
  version: 1,
  autoOrchestrate: true,
  launchMode: "auto",
  foreground: true,
  background: true,
  reviewAfterImplementation: true,
  roles: {
    orchestrator: { agent: "orchestrator", dispatchPolicy: "subagent" },
    architect: { agent: "architect", dispatchPolicy: "subagent" },
    designer: { agent: "designer", dispatchPolicy: "subagent" },
    coder: { agent: "coder", dispatchPolicy: "subagent" },
    worker: { agent: "worker", dispatchPolicy: "subagent" },
    reviewer: { agent: "reviewer", dispatchPolicy: "review-first" },
  },
  stages: {
    genesis: { agent: "architect", dispatchPolicy: "subagent" },
    design: { agent: "designer", dispatchPolicy: "subagent" },
    build: { agent: "coder", dispatchPolicy: "subagent" },
  },
  review: {
    enabled: true,
    agent: "reviewer",
    maxIterations: 2,
    sameConversation: true,
  },
};

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parts = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return parts.length ? parts : undefined;
}

function mergeDefaults(
  base?: TakomiDispatchDefaults,
  next?: TakomiDispatchDefaults,
): TakomiDispatchDefaults | undefined {
  if (!base && !next) return undefined;
  const fallbackModels = cleanStringArray(next?.fallbackModels) ?? cleanStringArray(base?.fallbackModels);
  return {
    ...base,
    ...next,
    fallbackModels,
  };
}

function mergeProfile(base: TakomiProfile, next?: Partial<TakomiProfile>): TakomiProfile {
  if (!next) return base;
  const roles = { ...(base.roles ?? {}) };
  for (const [role, defaults] of Object.entries(next.roles ?? {}) as Array<[TakomiPersona, TakomiDispatchDefaults]>) {
    roles[role] = mergeDefaults(roles[role], defaults);
  }

  const stages = { ...(base.stages ?? {}) };
  for (const [stage, defaults] of Object.entries(next.stages ?? {}) as Array<[VibeLifecycleStage, TakomiDispatchDefaults]>) {
    stages[stage] = mergeDefaults(stages[stage], defaults);
  }

  return {
    ...base,
    ...next,
    version: 1,
    autoOrchestrate: next.autoOrchestrate ?? base.autoOrchestrate,
    launchMode: next.launchMode ?? base.launchMode ?? "auto",
    foreground: next.foreground ?? base.foreground ?? true,
    background: next.background ?? base.background ?? true,
    reviewAfterImplementation: next.reviewAfterImplementation ?? base.reviewAfterImplementation ?? true,
    roles,
    stages,
    review: {
      ...base.review,
      ...next.review,
      enabled: next.review?.enabled ?? base.review?.enabled ?? true,
      sameConversation: next.review?.sameConversation ?? base.review?.sameConversation ?? true,
    },
  };
}

async function readProfileFile(filePath: string): Promise<Partial<TakomiProfile> | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Partial<TakomiProfile>;
  } catch {
    return undefined;
  }
}

export async function loadTakomiProfile(cwd: string): Promise<TakomiProfile> {
  const projectProfilePath = path.join(cwd, ".pi", "takomi-profile.json");
  const userProfilePath = path.join(os.homedir(), ".pi", "agent", "takomi", "profile.json");
  const projectProfile = await readProfileFile(projectProfilePath);
  const userProfile = await readProfileFile(userProfilePath);
  return mergeProfile(mergeProfile(DEFAULT_TAKOMI_PROFILE, userProfile), projectProfile);
}

export function getProfileDefaults(
  profile: TakomiProfile,
  role: TakomiPersona,
  stage?: VibeLifecycleStage,
): TakomiDispatchDefaults {
  return {
    ...(stage ? profile.stages?.[stage] : undefined),
    ...profile.roles?.[role],
  };
}
