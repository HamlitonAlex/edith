import test from "node:test";
import assert from "node:assert/strict";
import { MODEL_PROVIDERS, fetchProviderModels, requestProviderReply } from "../agent/model-providers.js";

test("catalog covers major domestic, international and local providers", () => {
  for (const id of ["openai", "anthropic", "gemini", "deepseek", "qwen", "zhipu", "moonshot", "doubao", "minimax", "mistral", "groq", "xai", "openrouter", "ollama", "custom"]) {
    assert.ok(MODEL_PROVIDERS.some(provider => provider.id === id), id);
  }
});

test("OpenAI compatible providers fetch models with bearer authentication", async () => {
  let request;
  const models = await fetchProviderModels({ providerId: "deepseek", apiKey: "secret", fetchImpl: async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ data: [{ id: "deepseek-chat" }] }) };
  }});
  assert.deepEqual(models, ["deepseek-chat"]);
  assert.match(request.url, /\/models$/);
  assert.equal(request.options.headers.authorization, "Bearer secret");
});

test("Gemini uses its native API shape", async () => {
  let body;
  const reply = await requestProviderReply({ providerId: "gemini", apiKey: "key", model: "gemini-2.5-flash", messages: [{ role: "user", content: "你好" }], fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "你好，我在。" }] } }] }) };
  }});
  assert.equal(reply, "你好，我在。");
  assert.equal(body.contents[0].parts[0].text, "你好");
});
