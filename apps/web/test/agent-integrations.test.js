import test from "node:test";
import assert from "node:assert/strict";
import { createAgentState, createKnownAgentState } from "../agent/state.js";
import { createModelContext, requestModelJudgment } from "../agent/model-gateway.js";
import { createObsidianIndex, proposeObsidianWrite, searchObsidian } from "../agent/obsidian.js";

test("model context contains evidence and principles without exposing unrelated storage", () => {
  const context = createModelContext(createKnownAgentState(), "我为什么现在要学这个？");
  assert.match(context.long_term_goals[0].text, /私人教育伙伴/);
  assert.ok(context.principles.length >= 3);
  assert.equal(context.latest_message, "我为什么现在要学这个？");
  assert.equal("messages" in context, false);
});

test("unconfigured model gateway fails honestly instead of inventing AI output", async () => {
  const result = await requestModelJudgment({ endpoint: "", model: "" });
  assert.deepEqual(result, { available: false, reason: "model_not_configured" });
});

test("model gateway cannot directly mutate agent state", async () => {
  const original = createAgentState();
  const context = createModelContext(original, "给我建议");
  const result = await requestModelJudgment({
    endpoint: "https://example.invalid/v1/chat/completions",
    apiKey: "temporary-key",
    model: "test-model",
    context,
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "建议先验证当前能力，并保留反方理由。" } }] }) }),
  });
  assert.equal(result.available, true);
  assert.equal(original.next_recommended_action, null);
  assert.equal("state" in result, false);
});

test("Obsidian search stays a knowledge source separate from agent memory", () => {
  const index = createObsidianIndex([
    { path: "网络/TCP与UDP.md", content: "TCP 强调可靠传输，UDP 更轻量。" },
    { path: "产品/学程.md", content: "学程要解释为什么是用户现在值得做的事。" },
  ]);
  const results = searchObsidian(index, "TCP 可靠传输");
  assert.equal(results[0].path, "网络/TCP与UDP.md");
  assert.equal("memory" in results[0], false);
});

test("Obsidian writes are proposals until the user confirms", () => {
  const proposal = proposeObsidianWrite({ path: "通识/农业革命.md", title: "农业革命", markdown: "# 农业革命", learningEvidence: "用户解释了收益与代价" });
  assert.equal(proposal.requires_confirmation, true);
  assert.equal(proposal.status, "awaiting_user_confirmation");
});
