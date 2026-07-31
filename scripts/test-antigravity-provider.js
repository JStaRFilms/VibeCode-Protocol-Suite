import assert from "node:assert";
import fs from "node:fs";
import { formatContextToPrompt, writeContextFile } from "../.pi/extensions/antigravity-provider/agy-cli.ts";
import { ANTIGRAVITY_MODELS, AntigravityProviderRuntime } from "../.pi/extensions/antigravity-provider/provider.ts";

console.log("🧪 Running Antigravity Provider Tests...");

// Test 1: Verify model catalog entries
assert.strictEqual(ANTIGRAVITY_MODELS.length, 3, "Should define 3 Antigravity models");
const modelIds = ANTIGRAVITY_MODELS.map((m) => m.id);
assert.ok(modelIds.includes("antigravity/gemini-3.5-pro"), "Should include gemini-3.5-pro");
assert.ok(modelIds.includes("antigravity/gemini-3.6-flash"), "Should include gemini-3.6-flash");
assert.ok(modelIds.includes("antigravity/gemini-3.6-ultra"), "Should include gemini-3.6-ultra");

console.log("✅ Test 1 Passed: Model catalog definitions valid");

// Test 2: Verify file-based context generation
const mockContext = {
  systemPrompt: "You are a helpful coding assistant.",
  messages: [
    { role: "user", content: "Hello, world!" },
    { role: "assistant", content: "Hello! How can I help you today?" },
    { role: "user", content: "Write a quick sorting function in JS." },
  ],
};

const tempFilePath = writeContextFile(mockContext, "test_session");
assert.ok(fs.existsSync(tempFilePath), "Context file should exist on disk");

const fileContent = fs.readFileSync(tempFilePath, "utf8");
assert.ok(
  fileContent.includes("SYSTEM DIRECTIVE: You are executing as a text completion backend inside the Pi/Takomi agent harness"),
  "Should include Pure Completion Mode Directive"
);
assert.ok(fileContent.includes("You are a helpful coding assistant."), "Should include system prompt");
assert.ok(fileContent.includes("[USER]\nHello, world!"), "Should format past user message");
assert.ok(fileContent.includes("[ASSISTANT]\nHello! How can I help you today?"), "Should format past assistant message");

const promptResult = formatContextToPrompt(mockContext, "test_session");
assert.ok(promptResult.startsWith("@["), "Prompt should use agy @[file] context tag syntax");
assert.ok(promptResult.includes("[CURRENT USER REQUEST]\nWrite a quick sorting function in JS."), "Prompt should contain current turn request");

console.log("✅ Test 2 Passed: File-based context generation and @file tag format valid");

// Test 3: Verify AntigravityProviderRuntime model transformation
const runtime = new AntigravityProviderRuntime();
const models = runtime.getModels();
assert.strictEqual(models.length, 3, "Runtime should expose 3 models");
for (const model of models) {
  assert.strictEqual(model.provider, "antigravity", `Model ${model.id} should have provider 'antigravity'`);
  assert.strictEqual(model.api, "antigravity-api", `Model ${model.id} should have api 'antigravity-api'`);
}

console.log("✅ Test 3 Passed: Runtime model mapping valid");
console.log("🎉 All Antigravity Provider Tests Passed Successfully!");
