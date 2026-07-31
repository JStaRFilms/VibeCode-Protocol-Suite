import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAntigravityProvider, AntigravityProviderRuntime } from "./provider.ts";
import { installAntigravityUiBridge } from "./ui.ts";

export default function (pi: ExtensionAPI) {
  const runtime = new AntigravityProviderRuntime();

  registerAntigravityProvider(pi, runtime);
  installAntigravityUiBridge(pi, runtime);

  pi.registerCommand("antigravity-status", {
    description: "Show status of the Google Antigravity Pi model provider",
    handler: async (_args, ctx) => {
      const models = runtime.getModels().map((m) => m.id).join("\n- ");
      if (ctx.hasUI) {
        ctx.ui.notify(`Google Antigravity Extension Active.\nModels:\n- ${models}`, "info");
      }
    },
  });
}
