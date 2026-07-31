import type { Api, Model } from "@earendil-works/pi-ai";

export interface AntigravityModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  compat?: Record<string, unknown>;
}

export interface AntigravityOptions {
  executablePath?: string;
  timeoutSeconds?: number;
  logFilePath?: string;
  modelId?: string;
  effort?: "low" | "medium" | "high";
}

export type AntigravityUiEventPhase = "start" | "streaming" | "success" | "error";

export interface AntigravityUiEvent {
  phase: AntigravityUiEventPhase;
  modelId?: string;
  message?: string;
}

export type AntigravityUiReporter = (event: AntigravityUiEvent) => void;
