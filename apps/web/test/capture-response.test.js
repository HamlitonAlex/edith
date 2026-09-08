import test from "node:test";
import assert from "node:assert/strict";

import { interpretCapture } from "../lib/capture-response.js";

test("a missed activity is stored without immediately changing the plan", () => {
  const result = interpretCapture("今天太累了，英语没来得及学");

  assert.equal(result.kind, "self_report");
  assert.match(result.reply, /先不改方案/);
  assert.equal(result.needsImmediateDecision, false);
});

test("a parent's observation remains attributed to the parent", () => {
  const result = interpretCapture("孩子刚才自己拿地图查了路线");

  assert.equal(result.actor, "parent");
  assert.equal(result.visibility, "guardian");
  assert.match(result.reply, /你的观察/);
  assert.match(result.reply, /不替孩子下结论/);
});

test("shared material becomes an inbox item rather than a mastery claim", () => {
  const result = interpretCapture("把这篇文章先存到数据分析");

  assert.equal(result.kind, "artifact");
  assert.equal(result.goalHint, "data-analysis");
  assert.match(result.reply, /待整理材料/);
});

test("ordinary speech is accepted without commands", () => {
  const result = interpretCapture("刚才练习的时候第三道题还是不会");

  assert.equal(result.kind, "self_report");
  assert.match(result.reply, /已经记下/);
  assert.equal(result.needsImmediateDecision, false);
});
