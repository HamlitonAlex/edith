import test from "node:test";
import assert from "node:assert/strict";

import { adoptPlan, createPlan, planToMarkdown, reviseTimeBudget, validateBrief } from "../lib/plan-generator.js";

const personal = {
  mode: "personal",
  learnerName: "Alex",
  goal: "独立完成一份数据周报",
  currentState: "会使用表格，但不会解释指标变化",
  weeklyMinutes: 120,
  constraints: "工作日容易加班",
  interests: "用自己的工作数据练习",
  learnerVoice: "self",
};

test("a complete personal brief generates an executable draft", () => {
  const plan = createPlan(personal, new Date("2026-09-06T00:00:00Z"));
  assert.equal(plan.status, "draft");
  assert.equal(plan.version, 1);
  assert.equal(plan.stages.length, 3);
  assert.ok(plan.currentActions.join(" ").includes("分钟"));
  assert.ok(plan.evidence.some((item) => item.includes("提示")));
});

test("an unconfirmed child goal remains a discussion draft", () => {
  const plan = createPlan({ ...personal, mode: "family", learnerName: "小树", learnerVoice: "unconfirmed" });
  assert.equal(plan.status, "discussion");
  assert.throws(() => adoptPlan(plan), /participant voice/);
});

test("adoption and time revision preserve plan history", () => {
  const active = adoptPlan(createPlan(personal), new Date("2026-09-06T01:00:00Z"));
  const revised = reviseTimeBudget(active, 30, new Date("2026-09-07T01:00:00Z"));
  assert.equal(revised.version, 2);
  assert.equal(revised.weeklyMinutes, 30);
  assert.equal(revised.history[0].weeklyMinutes, 120);
  assert.notDeepEqual(revised.currentActions, active.currentActions);
});

test("brief validation and export expose missing data and current version", () => {
  assert.equal(validateBrief({ mode: "personal", weeklyMinutes: 5 }).valid, false);
  const markdown = planToMarkdown(createPlan(personal));
  assert.match(markdown, /第 1 版/);
  assert.match(markdown, /独立完成一份数据周报/);
});
