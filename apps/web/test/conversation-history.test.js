import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeStoredConversation,
  normalizeConversation,
  formatConversationTime,
  conversationDayLabel,
} from "../lib/conversation-history.js";

test("legacy and current snapshots merge without losing earlier messages", () => {
  const legacy = [
    { role: "user", text: "上午我想继续讨论界面" },
    { role: "assistant", text: "我们先确定日间和夜间。" },
  ];
  const current = [
    { role: "assistant", text: "我们先确定日间和夜间。" },
    { role: "user", text: "由用户自己选择", createdAt: "2026-09-11T01:30:00.000Z" },
  ];

  assert.deepEqual(mergeStoredConversation(legacy, current).map(item => item.text), [
    "上午我想继续讨论界面",
    "我们先确定日间和夜间。",
    "由用户自己选择",
  ]);
});

test("repeated short replies are preserved unless they are the actual snapshot overlap", () => {
  const legacy = [
    { role: "user", text: "可以" },
    { role: "assistant", text: "我记下了" },
    { role: "user", text: "可以" },
  ];
  const current = [
    { role: "user", text: "可以", createdAt: "2026-09-11T01:30:00.000Z" },
    { role: "assistant", text: "接下来确认氛围", createdAt: "2026-09-11T01:31:00.000Z" },
  ];

  assert.deepEqual(mergeStoredConversation(legacy, current).map(item => item.text), [
    "可以",
    "我记下了",
    "可以",
    "接下来确认氛围",
  ]);
});

test("legacy messages stay visible without inventing an exact time", () => {
  const normalized = normalizeConversation([{ role: "user", text: "旧记录" }]);
  assert.equal(normalized[0].createdAt, null);
  assert.equal(formatConversationTime(normalized[0].createdAt), "此前");
  assert.equal(conversationDayLabel(normalized[0].createdAt), "较早的对话");
});

test("new messages show useful day context and clock time", () => {
  const now = new Date("2026-09-11T08:00:00+08:00");
  const today = "2026-09-11T07:15:00+08:00";
  const yesterday = "2026-09-10T20:05:00+08:00";

  assert.equal(conversationDayLabel(today, now), "今天");
  assert.equal(conversationDayLabel(yesterday, now), "昨天");
  assert.match(formatConversationTime(today), /^\d{2}:\d{2}$/);
});
