import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { executeAgyStream, formatContextToPrompt } from "./agy-cli.ts";
import type { AntigravityModelConfig, AntigravityUiReporter } from "./types.ts";

export const ANTIGRAVITY_MODELS: AntigravityModelConfig[] = [
  {
    id: "antigravity/gemini-3.6-flash-high",
    name: "Antigravity Gemini 3.6 Flash (High)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0.15 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gemini-3.6-flash-medium",
    name: "Antigravity Gemini 3.6 Flash (Medium)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0.15 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gemini-3.6-flash-low",
    name: "Antigravity Gemini 3.6 Flash (Low)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0.15, output: 0.60, cacheRead: 0.0375, cacheWrite: 0.15 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gemini-3.5-flash-high",
    name: "Antigravity Gemini 3.5 Flash (High)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0.075, output: 0.30, cacheRead: 0.01875, cacheWrite: 0.075 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gemini-3.5-flash-medium",
    name: "Antigravity Gemini 3.5 Flash (Medium)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0.075, output: 0.30, cacheRead: 0.01875, cacheWrite: 0.075 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gemini-3.5-flash-low",
    name: "Antigravity Gemini 3.5 Flash (Low)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0.075, output: 0.30, cacheRead: 0.01875, cacheWrite: 0.075 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gemini-3.1-pro-high",
    name: "Antigravity Gemini 3.1 Pro (High)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1.25, output: 5.00, cacheRead: 0.3125, cacheWrite: 1.25 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gemini-3.1-pro-low",
    name: "Antigravity Gemini 3.1 Pro (Low)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 1.25, output: 5.00, cacheRead: 0.3125, cacheWrite: 1.25 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/claude-sonnet-4-6",
    name: "Antigravity Claude Sonnet 4.6 (Thinking)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
    contextWindow: 200_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/claude-opus-4-6-thinking",
    name: "Antigravity Claude Opus 4.6 (Thinking)",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
    contextWindow: 200_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gpt-oss-120b-medium",
    name: "Antigravity GPT-OSS 120B (Medium)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.35, output: 1.40, cacheRead: 0.07, cacheWrite: 0.35 },
    contextWindow: 128_000,
    maxTokens: 32_000,
  },
];

export class AntigravityProviderRuntime {
  private uiReporter?: AntigravityUiReporter;

  setUiReporter(reporter?: AntigravityUiReporter) {
    this.uiReporter = reporter;
  }

  private emitUi(event: Parameters<AntigravityUiReporter>[0]) {
    try {
      this.uiReporter?.(event);
    } catch {
      // Ignore UI callback errors
    }
  }

  getModels(): Model<Api>[] {
    return ANTIGRAVITY_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: m.reasoning,
      input: m.input,
      cost: m.cost,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      api: "antigravity-api" as Api,
      provider: "antigravity",
      baseUrl: "http://localhost:0",
      apiKey: "antigravity-cli",
      compat: m.compat,
    }));
  }

  stream(
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions
  ): AssistantMessageEventStream {
    const stream = createAssistantMessageEventStream();

    (async () => {
      this.emitUi({ phase: "start", modelId: model.id });

      try {
        const prompt = formatContextToPrompt(context);
        let fullText = "";

        await executeAgyStream(
          prompt,
          (chunk) => {
            fullText += chunk;
            this.emitUi({ phase: "streaming", modelId: model.id });
            const partialMsg: AssistantMessage = {
              role: "assistant",
              content: [{ type: "text", text: fullText }],
              api: model.api,
              provider: model.provider,
              model: model.id,
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
              },
              stopReason: "stop",
              timestamp: Date.now(),
            };
            stream.push({
              type: "text_delta",
              contentIndex: 0,
              delta: chunk,
              partial: partialMsg,
            });
          },
          { signal: options?.signal, modelId: model.id }
        );

        const doneMsg: AssistantMessage = {
          role: "assistant",
          content: [{ type: "text", text: fullText }],
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        };

        stream.push({
          type: "done",
          reason: "stop",
          message: doneMsg,
        });

        this.emitUi({ phase: "success", modelId: model.id });
        stream.end();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emitUi({ phase: "error", modelId: model.id, message: err.message });

        const errorMsg: AssistantMessage = {
          role: "assistant",
          content: [],
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "error",
          errorMessage: err.message,
          timestamp: Date.now(),
        };

        stream.push({
          type: "error",
          reason: "error",
          error: errorMsg,
        });
        stream.end();
      }
    })();

    return stream;
  }
}

export function registerAntigravityProvider(
  pi: ExtensionAPI,
  runtime: AntigravityProviderRuntime
) {
  pi.registerProvider("antigravity", {
    baseUrl: "http://localhost:0",
    apiKey: "antigravity-cli",
    api: "antigravity-api" as Api,
    models: runtime.getModels(),
    streamSimple: (model, context, options) => runtime.stream(model, context, options),
  });
}
