import test from "node:test";
import assert from "node:assert/strict";
import { createCompanionState, receiveMessage } from "../lib/companion-state.js";

test("starts with a named companion and visible real-world progress", () => {
  const state = createCompanionState();
  assert.equal(state.assistantName, "小程");
  assert.equal(state.theme, "peach");
  assert.match(state.activeDirection, /可安装的开源产品/);
  assert.equal(state.tasks.find((task) => task.id === "market-research").status, "completed");
  assert.equal(state.areas.find((area) => area.id === "projects").status, "active");
  assert.equal(state.schedule[0].time, "18:00–18:30");
  assert.equal(state.schedule[0].platform, "哔哩哔哩");
  assert.match(state.schedule[0].contentTitle, /农业革命/);
  assert.match(state.schedule[0].completion, /一个收益和一个代价/);
});

test("natural project conversation updates map, memory and tasks", () => {
  const state = receiveMessage(createCompanionState(), "我想把这个教育助手做成 GitHub 开源项目");
  assert.match(state.activeDirection, /教育助手/);
  assert.equal(state.areas.find((area) => area.id === "projects").status, "active");
  assert.equal(state.schedule[0].time, "18:00–18:30");
  assert.equal(state.schedule[0].platform, "哔哩哔哩");
  assert.equal(state.memories.find((memory) => memory.key === "project-goal").source, "连续对话");
  assert.equal(state.tasks.find((task) => task.id === "redesign-home").status, "working");
});

test("life constraints remain observations rather than character judgments", () => {
  const state = receiveMessage(createCompanionState(), "最近加班太累，总是没时间");
  assert.equal(state.areas.find((area) => area.id === "wellbeing").status, "observing");
  assert.match(state.messages.at(-1).text, /生活条件/);
  assert.equal(state.memories.at(-1).confidence, 0.65);
});
