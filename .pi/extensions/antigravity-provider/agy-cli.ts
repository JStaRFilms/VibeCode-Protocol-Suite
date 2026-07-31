import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Context } from "@earendil-works/pi-ai";
import type { AntigravityOptions } from "./types.ts";

export function writeContextFile(context: Context, sessionId = "default"): string {
  const parts: string[] = [];

  // Pure Completion Mode Directive to clarify harness identity to agy
  parts.push(
    "[SYSTEM DIRECTIVE: You are executing as a text completion backend inside the Pi/Takomi agent harness. Do NOT attempt to run local tools or shell commands. Respond with plain text or code.]"
  );

  if (context.systemPrompt) {
    parts.push(`[SYSTEM PROMPT]\n${context.systemPrompt}`);
  }

  if (Array.isArray(context.messages)) {
    // Write all messages up to the latest user prompt
    const historyMessages = context.messages.slice(0, Math.max(0, context.messages.length - 1));
    for (const msg of historyMessages) {
      const roleLabel = msg.role.toUpperCase();
      if (typeof msg.content === "string") {
        parts.push(`[${roleLabel}]\n${msg.content}`);
      } else if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .map((c) => {
            if ("text" in c && typeof c.text === "string") return c.text;
            return "";
          })
          .filter(Boolean)
          .join("\n");
        if (textParts) {
          parts.push(`[${roleLabel}]\n${textParts}`);
        }
      }
    }
  }

  const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const tempFilePath = path.join(os.tmpdir(), `takomi_antigravity_ctx_${cleanSessionId}.md`);
  fs.writeFileSync(tempFilePath, parts.join("\n\n"), "utf8");

  return tempFilePath;
}

export function formatContextToPrompt(context: Context, sessionId = "default"): string {
  if (!Array.isArray(context.messages) || context.messages.length === 0) {
    const tempPath = writeContextFile(context, sessionId);
    return `@[${tempPath}]\n\n[USER REQUEST]\nHello`;
  }

  const lastMsg = context.messages[context.messages.length - 1];
  let latestText = "";

  if (typeof lastMsg.content === "string") {
    latestText = lastMsg.content;
  } else if (Array.isArray(lastMsg.content)) {
    latestText = lastMsg.content
      .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
      .filter(Boolean)
      .join("\n");
  }

  const tempPath = writeContextFile(context, sessionId);

  return `@[${tempPath}]\n\n[CURRENT USER REQUEST]\n${latestText || "Hello"}`;
}

export function executeAgyStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  options?: AntigravityOptions & { signal?: AbortSignal }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const executable = options?.executablePath ?? (process.platform === "win32" ? "agy.exe" : "agy");
    const timeoutSec = options?.timeoutSeconds ?? 300;
    const args: string[] = ["-p", prompt, "--print-timeout", `${timeoutSec}s`, "--dangerously-skip-permissions"];

    if (options?.modelId) {
      const rawModel = options.modelId.replace(/^antigravity\//, "");
      args.push("--model", rawModel);
    }

    if (options?.logFilePath) {
      args.push("--log-file", options.logFilePath);
    }

    // shell: false to avoid cmd.exe 8,191 command line limit on Windows
    const child = spawn(executable, args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let fullOutput = "";
    let stderrOutput = "";

    if (options?.signal) {
      if (options.signal.aborted) {
        child.kill();
        return reject(new Error("Request was aborted before execution"));
      }
      options.signal.addEventListener("abort", () => {
        child.kill();
        reject(new Error("Request was aborted"));
      }, { once: true });
    }

    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString("utf8");
      fullOutput += chunk;
      onChunk(chunk);
    });

    child.stderr.on("data", (data: Buffer) => {
      stderrOutput += data.toString("utf8");
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn agy CLI process: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code === 0 || fullOutput.length > 0) {
        resolve(fullOutput);
      } else {
        reject(
          new Error(`agy CLI exited with code ${code}. Stderr: ${stderrOutput.slice(-300) || "none"}`)
        );
      }
    });
  });
}
