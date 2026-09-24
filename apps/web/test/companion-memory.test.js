import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRepository, memoryScopeForIdentity } from "../lib/memory-repository.js";
import { contextualNextStep, memoryCandidateFromMessage, modelInputFromContext } from "../agent/companion-memory.js";

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

function contextFor(repo, input = "今天练什么？", messages = []) {
  return repo.buildContext({ current_conversation: { current_input: input, messages }, max_chars: 2000 });
}

test("a long-term goal is only a proposal until the user confirms; the next chat can use it", () => {
  const repo = createMemoryRepository({ storage: storage() });
  const candidate = memoryCandidateFromMessage("我以后想往人工智能方向发展。", []);
  assert.equal(candidate.type, "long_term");
  const proposed = repo.createMemory(candidate).memory;
  assert.equal(contextFor(repo).relevant_memory.length, 0);
  repo.confirmMemory(proposed.id);
  const context = contextFor(repo);
  assert.match(context.relevant_memory[0].content, /人工智能/);
  const request = modelInputFromContext(context, "今天练什么？", "你是小程");
  assert.match(request.system, /人工智能/);
  assert.equal(request.sources.memory[0], proposed.id);
});

test("memory is isolated by verified account scope", () => {
  const localStorage = storage();
  const repo = createMemoryRepository({ storage: localStorage, scope: memoryScopeForIdentity({ issuer: "https://id.test", subject: "A" }) });
  const item = repo.createMemory(memoryCandidateFromMessage("我以后想往人工智能方向发展", [])).memory;
  repo.confirmMemory(item.id);
  repo.setScope(memoryScopeForIdentity({ issuer: "https://id.test", subject: "B" }));
  assert.equal(contextFor(repo).relevant_memory.length, 0);
});

test("model input remains bounded and does not send all history", () => {
  const repo = createMemoryRepository({ storage: storage() });
  const messages = Array.from({ length: 40 }, (_, index) => ({ id: `m${index}`, role: "user", text: `第${index}条对话`, createdAt: new Date(2026, 8, 1, 0, index).toISOString() }));
  const context = contextFor(repo, "现在呢？", messages);
  const request = modelInputFromContext(context, "现在呢？", "你是小程");
  assert.ok(request.messages.length <= 13);
  assert.doesNotMatch(JSON.stringify(request), /第0条对话/);
  assert.equal(request.messages.at(-1).content, "现在呢？");
});

test("one confirmed goal creates one action; repeated weakness changes its judgment", () => {
  const memory = { id: "g1", type: "long_term", content: "我以后想往人工智能方向发展", status: "confirmed", confirmed_by_user: true };
  assert.equal(contextualNextStep({ memories: [{ ...memory, status: "proposed", confirmed_by_user: false }] }), null);
  const base = contextualNextStep({ memories: [memory] });
  assert.equal(base.duration_minutes, 20);
  const evidence = [1, 2].map(index => ({ id: `e${index}`, topic: "Python 递归边界", result: "终止条件判断错误", evidence_type: "wrong_answer" }));
  const adapted = contextualNextStep({ memories: [memory], evidence, today: { available_minutes: 10 } });
  assert.match(adapted.title, /递归边界/);
  assert.notEqual(adapted.title, base.title);
  assert.equal(adapted.duration_minutes, 10);
  assert.equal(contextualNextStep({ memories: [memory], evidence: evidence.map(item => ({ ...item, source_id: "same-session" })) }).title, base.title);
  assert.equal(contextualNextStep({ memories: [memory], currentAction: { id: "started", status: "accepted" } }).id, "started");
});

test("no memory leaves chat and Home usable, including offline local persistence", () => {
  const device = storage();
  const repo = createMemoryRepository({ storage: device });
  assert.equal(contextFor(repo).relevant_memory.length, 0);
  assert.equal(contextualNextStep({ memories: repo.listMemories() }), null);
  const item = repo.createMemory(memoryCandidateFromMessage("我以后想往人工智能方向发展", [])).memory;
  repo.confirmMemory(item.id);
  const reopened = createMemoryRepository({ storage: device });
  assert.equal(reopened.listMemories()[0].status, "confirmed");
  assert.equal(reopened.listMemories()[0].content, item.content);
});

test("ordinary greetings and questions do not create memory proposals", () => {
  assert.equal(memoryCandidateFromMessage("你好", []), null);
  assert.equal(memoryCandidateFromMessage("我以后想往人工智能方向发展吗？", []), null);
  assert.equal(memoryCandidateFromMessage("我以后想往人工智能方向发展", [{ content: "我以后想往人工智能方向发展", status: "confirmed" }]), null);
});
