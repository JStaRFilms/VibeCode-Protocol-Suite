import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AntigravityProviderRuntime } from "./provider.ts";
import type { AntigravityUiEvent } from "./types.ts";

export function installAntigravityUiBridge(
  pi: ExtensionAPI,
  runtime: AntigravityProviderRuntime
) {
  let activeCtx: ExtensionContext | undefined;

  const setStatus = (ctx: ExtensionContext, text: string) => {
    activeCtx = ctx;
    if (ctx.hasUI) {
      try {
        ctx.ui.setStatus("antigravity-provider", text);
      } catch {
        // UI updates are best-effort
      }
    }
  };

  runtime.setUiReporter((event: AntigravityUiEvent) => {
    if (!activeCtx?.hasUI) return;
    const model = event.modelId ? `${event.modelId} ` : "";

    switch (event.phase) {
      case "start":
        setStatus(activeCtx, `antigravity connecting to ${model}...`);
        break;
      case "streaming":
        setStatus(activeCtx, `antigravity streaming ${model}`);
        break;
      case "success":
        setStatus(activeCtx, `antigravity active (${model.trim()})`);
        break;
      case "error":
        setStatus(activeCtx, `antigravity error: ${event.message || "unknown"}`);
        if (activeCtx.hasUI) {
          activeCtx.ui.notify(`Antigravity provider error: ${event.message}`, "error");
        }
        break;
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    setStatus(ctx, "antigravity ready");
  });

  pi.on("turn_start", async (_event, ctx) => {
    setStatus(ctx, "antigravity processing turn");
  });

  pi.on("turn_end", async (_event, ctx) => {
    setStatus(ctx, "antigravity ready");
  });
}
