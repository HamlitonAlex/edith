import assert from "node:assert/strict";
import test from "node:test";
import { buildAiContext, buildContextFromAgentState } from "../agent/context-builder.js";

test("context builder keeps only confirmed memories in the stable context", () => {
  const context = buildAiContext({
    current_user: { name: "小程", current_stage: "Python 基础", long_term_goals: ["通过技能高考"], interests: ["编程"] },
    current_conversation: { current_input: "我想继续练 Python", messages: [{ id: "m1", role: "user", text: "昨天我学了列表", occurred_at: "2030-01-01T08:00:00.000Z" }] },
    memories: [
      { id: "memory-confirmed", status: "confirmed", confirmed_by_user: true, content: "用户偏好先看例子再练习。", topic: "Python", importance: .8 },
      { id: "memory-proposed", status: "proposed", content: "用户也许想转前端。", topic: "前端" },
      { id: "memory-archived", status: "archived", content: "过期信息", topic: "Python" },
    ],
    proposed_memories: [{ id: "memory-proposed", status: "proposed", content: "用户也许想转前端。", topic: "前端" }],
  });

  assert.equal(context.current_input, "我想继续练 Python");
  assert.deepEqual(context.current_user.long_term_goals, ["通过技能高考"]);
  assert.equal(context.relevant_memory[0].id, "memory-confirmed");
  assert.equal(context.relevant_memory.some(item => item.id === "memory-proposed"), false);
  assert.equal(context.relevant_memory.some(item => item.id === "memory-archived"), false);
  assert.equal(context.proposed_memories[0].id, "memory-proposed");
});

test("context builder excludes unconfirmed daily logs, deleted records, and data owned by another user", () => {
  const context = buildAiContext({
    current_user: { id: "user-a", name: "小程" },
    current_conversation: {
      user_id: "user-a",
      current_input: "继续练递归",
      messages: [
        { id: "message-a", user_id: "user-a", role: "user", text: "我想练递归", occurred_at: "2030-01-01T08:00:00.000Z" },
        { id: "message-b", user_id: "user-b", role: "user", text: "other-user-only-message", occurred_at: "2030-01-01T08:01:00.000Z" },
      ],
    },
    memories: [
      { id: "memory-a", user_id: "user-a", status: "confirmed", confirmed_by_user: true, content: "用户希望先理解递归终止条件。", topic: "递归" },
      { id: "memory-b", user_id: "user-b", status: "confirmed", confirmed_by_user: true, content: "other-user-only-memory", topic: "递归" },
      { id: "memory-deleted", user_id: "user-a", status: "confirmed", confirmed_by_user: true, deleted_at: "2030-01-01T08:02:00.000Z", content: "deleted-memory", topic: "递归" },
    ],
    learning_evidence: [
      { id: "evidence-a", user_id: "user-a", topic: "递归", skill: "Python", evidence_type: "correct_answer", result: "能写出终止条件", source_type: "exercise" },
      { id: "evidence-b", user_id: "user-b", topic: "递归", skill: "Python", evidence_type: "correct_answer", result: "other-user-only-evidence", source_type: "exercise" },
    ],
    daily_log: {
      id: "daily-a", user_id: "user-a", date: "2030-01-01", status: "proposed", confirmed_by_user: false,
      completed: ["other-user-only-daily-log"], ai_summary: "other-user-only-daily-log",
    },
  });

  assert.deepEqual(context.relevant_memory.map(item => item.id), ["memory-a"]);
  assert.deepEqual(context.relevant_learning_evidence.map(item => item.id), ["evidence-a"]);
  assert.deepEqual(context.recent_conversation.map(item => item.id), ["message-a"]);
  assert.equal(context.today_state.daily_log, null);
  assert.equal(JSON.stringify(context).includes("other-user-only"), false);
  assert.equal(JSON.stringify(context).includes("deleted-memory"), false);
});

test("context builder keeps provenance as a short reference and clips raw conversation", () => {
  const rawSource = `DO-NOT-COPY-SOURCE:${"私人聊天内容".repeat(200)}`;
  const context = buildAiContext({
    current_user: { id: "user-a", name: "小程" },
    current_conversation: {
      user_id: "user-a",
      current_input: "递归的终止条件是什么？",
      messages: [{ id: "message-a", user_id: "user-a", role: "user", text: rawSource, occurred_at: "2030-01-01T08:00:00.000Z" }],
    },
    memories: [{
      id: "memory-a", user_id: "user-a", status: "confirmed", confirmed_by_user: true,
      content: "用户希望先理解递归终止条件。", topic: "递归", source_type: "conversation", source_id: "message-a",
      source_excerpt: rawSource, source_metadata: { raw_transcript: rawSource, private_attachment: "never-copy" },
    }],
  });

  assert.deepEqual(context.relevant_memory[0].source, { type: "conversation", id: "message-a" });
  assert.equal(Object.hasOwn(context.relevant_memory[0], "source_excerpt"), false);
  assert.ok(context.recent_conversation[0].text.length <= 640);
  assert.equal(JSON.stringify(context).includes(rawSource), false);
  assert.equal(JSON.stringify(context).includes("never-copy"), false);
});

test("context builder never coerces an arbitrary source payload into model context", () => {
  const rawSource = `PRIVATE-SOURCE-PAYLOAD:${"不应复制".repeat(100)}`;
  const context = buildAiContext({
    current_user: { id: "user-a", name: "小程" },
    current_conversation: { user_id: "user-a", current_input: "继续练递归" },
    memories: [{
      id: "memory-a", user_id: "user-a", status: "confirmed", confirmed_by_user: true,
      content: "用户希望先理解递归终止条件。", topic: "递归", source: rawSource,
    }],
  });

  assert.equal(context.relevant_memory[0].source_type, null);
  assert.equal(context.relevant_memory[0].source, null);
  assert.equal(JSON.stringify(context).includes("PRIVATE-SOURCE-PAYLOAD"), false);
});

test("context builder includes a daily log only after the user explicitly confirms it", () => {
  const common = {
    current_user: { id: "user-a", name: "小程" },
    current_date: "2030-01-01",
    current_conversation: { user_id: "user-a", current_input: "总结今天" },
  };
  const unconfirmed = buildAiContext({
    ...common,
    daily_log: { id: "log-a", user_id: "user-a", date: "2030-01-01", status: "confirmed", confirmed_by_user: false, ai_summary: "不应进入上下文" },
  });
  const confirmed = buildAiContext({
    ...common,
    daily_log: { id: "log-a", user_id: "user-a", date: "2030-01-01", status: "confirmed", confirmed_by_user: true, completed: ["完成递归练习"], ai_summary: "今天完成了递归练习。" },
  });

  assert.equal(unconfirmed.today_state.daily_log, null);
  assert.deepEqual(confirmed.today_state.daily_log, {
    date: "2030-01-01",
    completed: ["完成递归练习"],
    problems: [],
    learned: [],
    tomorrow_plan: "",
    ai_summary: "今天完成了递归练习。",
    status: "confirmed",
  });
});

test("relevance ordering and budget trimming are deterministic when source arrays arrive in another order", () => {
  const records = ["a", "b", "c"].map(id => ({
    id: `memory-${id}`, user_id: "user-a", status: "confirmed", confirmed_by_user: true,
    content: `递归记忆 ${id}`, topic: "递归", importance: .7, created_at: "2030-01-01T00:00:00.000Z",
  }));
  const evidence = ["a", "b", "c"].map(id => ({
    id: `evidence-${id}`, user_id: "user-a", topic: "递归", skill: "Python", evidence_type: "correct_answer",
    result: `递归证据 ${id}`, source_type: "exercise", confidence: .7, created_at: "2030-01-01T00:00:00.000Z",
  }));
  const common = {
    current_user: { id: "user-a", name: "小程" },
    current_conversation: { user_id: "user-a", current_input: "继续练递归" },
    max_chars: 3000,
    now: Date.parse("2030-01-02T00:00:00.000Z"),
  };
  const forward = buildAiContext({ ...common, memories: records, learning_evidence: evidence });
  const reverse = buildAiContext({ ...common, memories: [...records].reverse(), learning_evidence: [...evidence].reverse() });

  assert.deepEqual(forward.relevant_memory.map(item => item.id), reverse.relevant_memory.map(item => item.id));
  assert.deepEqual(forward.relevant_learning_evidence.map(item => item.id), reverse.relevant_learning_evidence.map(item => item.id));
  assert.deepEqual(forward, buildAiContext({ ...common, memories: records, learning_evidence: evidence }));
});

test("budget trims stable profile before the current input, task, and necessary conversation", () => {
  const currentInput = "这句当前问题必须完整保留";
  const context = buildAiContext({
    current_user: {
      id: "user-a", name: "小程",
      current_stage: { text: "当前阶段 ".repeat(80), status: "confirmed", confirmed_by_user: true },
      long_term_goals: Array.from({ length: 12 }, (_, index) => ({
        text: `长期目标 ${index} ${"目标细节 ".repeat(60)}`, status: "confirmed", confirmed_by_user: true,
      })),
      interests: Array.from({ length: 12 }, (_, index) => ({
        text: `兴趣 ${index} ${"细节 ".repeat(40)}`, status: "confirmed", confirmed_by_user: true,
      })),
    },
    current_conversation: {
      user_id: "user-a", current_input: currentInput,
      messages: [{ id: "necessary-message", user_id: "user-a", role: "user", text: "请先解释递归终止条件", occurred_at: "2030-01-01T08:00:00.000Z" }],
    },
    current_task: { id: "task-a", user_id: "user-a", title: "练递归", why_now: "先把终止条件练稳" },
    max_chars: 1200,
  });

  assert.equal(context.current_input, currentInput);
  assert.equal(context.current_task.title, "练递归");
  assert.equal(context.recent_conversation[0].id, "necessary-message");
  assert.ok(context.current_user.long_term_goals.length < 12);
  assert.ok(JSON.stringify(context).length <= 1200);
});

test("learning evidence remains separate from memory and never asserts mastery by itself", () => {
  const context = buildAiContext({
    current_user: { id: "user-a", name: "小程" },
    current_conversation: { user_id: "user-a", current_input: "我会递归了吗？" },
    learning_evidence: [{
      id: "evidence-a", user_id: "user-a", topic: "递归", skill: "Python", evidence_type: "correct_answer",
      result: "完成了一道递归练习", source_type: "exercise", mastered: true,
    }],
  });

  assert.equal(context.relevant_memory.length, 0);
  assert.equal(context.relevant_learning_evidence.length, 1);
  assert.equal(Object.hasOwn(context.relevant_learning_evidence[0], "mastered"), false);
  assert.equal(JSON.stringify(context).includes('"mastered"'), false);
});

test("context builder has a stable budget and retains the current user input", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({
    id: `message-${index}`,
    role: index % 2 ? "assistant" : "user",
    text: `第 ${index} 条上下文 ${"练习说明 ".repeat(30)}`,
    occurred_at: `2030-01-01T08:${String(index).padStart(2, "0")}:00.000Z`,
  }));
  const input = {
    current_conversation: { current_input: "这句当前问题必须保留", messages },
    memories: Array.from({ length: 30 }, (_, index) => ({ id: `memory-${index}`, status: "confirmed", confirmed_by_user: true, type: "recent_event", content: `记忆 ${index} ${"细节 ".repeat(100)}`, importance: index / 30 })),
    learning_evidence: Array.from({ length: 30 }, (_, index) => ({ id: `evidence-${index}`, topic: "Python", skill: "编程", evidence_type: "tutor_verification", result: `证据 ${index} ${"结果 ".repeat(100)}`, source_type: "tutor", confidence: .7 })),
    max_chars: 1600,
  };
  const first = buildAiContext(input);
  const second = buildAiContext(input);

  assert.equal(first.current_input, "这句当前问题必须保留");
  assert.ok(first.recent_conversation.length <= 12);
  assert.ok(first.truncation.omitted_messages > 0);
  assert.ok(JSON.stringify(first).length <= 1600);
  assert.deepEqual(first, second);
});

test("agent state projection does not mutate existing local-first state", () => {
  const state = {
    current_stage: "基础巩固",
    long_term_goals: [{ text: "能够独立完成项目" }],
    interests: ["Python"],
    current_state: { energy: "normal" },
    memory: [{ id: "old-memory", status: "recorded", text: "用户完成了一次练习", at: "2030-01-01T08:00:00.000Z" }],
    learning_results: [{ id: "result-1", topic: "递归", domain: "Python", learned: "能解释终止条件", confidence: .8, at: "2030-01-01T09:00:00.000Z" }],
  };
  const before = structuredClone(state);
  const context = buildContextFromAgentState({ agentState: state, latestMessage: "继续做递归题" });

  assert.deepEqual(state, before);
  assert.equal(context.relevant_memory.length, 0);
  assert.equal(context.proposed_memories[0].id, "old-memory");
  assert.equal(context.relevant_learning_evidence[0].id, "result-1");
});
