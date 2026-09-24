import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAgentState, hydrateAgentState } from "../agent/index.js";

const iphoneSource = await readFile(new URL("../iphone.js", import.meta.url), "utf8");
const providerSource = await readFile(new URL("../agent/model-providers.js", import.meta.url), "utf8");

test("mobile chat submission has a single-flight guard and always releases it", () => {
  assert.match(iphoneSource, /let isSending = false;/);
  assert.match(iphoneSource, /if \(isSending\) \{/);
  assert.match(iphoneSource, /finally \{[\s\S]*isSending = false;/);
});

test("mobile storage and dialogs fail safely instead of breaking the page", () => {
  assert.match(iphoneSource, /function persistStorage\(/);
  assert.match(iphoneSource, /function showDialog\(/);
  assert.match(iphoneSource, /if \(!dialog\.open\) dialog\.showModal\(\)/);
  assert.match(iphoneSource, /safeAttachmentDataUrl\(/);
});

test("malformed persisted agent collections are normalized on hydration", () => {
  const saved = createAgentState();
  saved.long_term_goals = null;
  saved.pending_items = {};
  saved.learning_results = "stale";
  saved.skills.python = { label: "坏数据", evidence: null };
  saved.tutor_metrics.history = {};
  saved.current_state = "offline";
  const hydrated = hydrateAgentState(saved);
  assert.deepEqual(hydrated.long_term_goals, []);
  assert.deepEqual(hydrated.pending_items, []);
  assert.deepEqual(hydrated.learning_results, []);
  assert.ok(Array.isArray(hydrated.tutor_metrics.history));
  assert.ok(Array.isArray(hydrated.skills.ai_application.evidence));
  assert.equal(hydrated.current_state.energy, "unknown");
});

test("Gemini model discovery tolerates malformed capability metadata", async () => {
  assert.match(providerSource, /Array\.isArray\(item\.supportedGenerationMethods\)/);
  const { fetchProviderModels } = await import("../agent/model-providers.js");
  const models = await fetchProviderModels({
    providerId: "gemini",
    apiKey: "key",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ models: [{ name: "models/gemini-test", supportedGenerationMethods: "generateContent" }] }),
    }),
  });
  assert.deepEqual(models, ["gemini-test"]);
});

test("provider requests keep malformed payloads on the recoverable error path", async () => {
  const { fetchProviderModels, requestProviderReply } = await import("../agent/model-providers.js");
  const emptyModels = await fetchProviderModels({
    providerId: "gemini",
    apiKey: "key",
    fetchImpl: async () => ({ ok: true, json: async () => ({ models: null }) }),
  });
  assert.deepEqual(emptyModels, []);
  const reply = await requestProviderReply({
    providerId: "openai",
    apiKey: "key",
    model: "demo",
    messages: null,
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.messages, []);
      return { ok: true, json: async () => ({ choices: [{ message: { content: "可以继续。" } }] }) };
    },
  });
  assert.equal(reply, "可以继续。");
});
