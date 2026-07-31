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
    id: "antigravity/gemini-3.5-pro",
    name: "Antigravity Gemini 3.5 Pro",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gemini-3.6-flash",
    name: "Antigravity Gemini 3.6 Flash",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 64_000,
  },
  {
    id: "antigravity/gemini-3.6-ultra",
    name: "Antigravity Gemini 3.6 Ultra",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 2_000_000,
    maxTokens: 128_000,
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
