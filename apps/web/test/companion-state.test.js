import test from "node:test";
import assert from "node:assert/strict";
import { createCompanionState, receiveMessage } from "../lib/companion-state.js";

test("starts without fabricated memories, tasks or recommendations", () => {
  const state = createCompanionState();
  assert.equal(state.assistantName, "小程");
  assert.equal(state.theme, "peach");
  assert.equal(state.activeDirection, "");
  assert.deepEqual(state.memories, []);
  assert.deepEqual(state.tasks, []);
  assert.deepEqual(state.schedule, []);
  assert.ok(state.areas.every(area => area.status === "background"));
});

test("natural project conversation updates map, memory and tasks", () => {
  const state = receiveMessage(createCompanionState(), "我想把这个教育助手做成 GitHub 开源项目");
  assert.match(state.activeDirection, /教育助手/);
  assert.equal(state.areas.find((area) => area.id === "projects").status, "active");
  assert.deepEqual(state.schedule, []);
  assert.equal(state.memories.find((memory) => memory.key === "project-goal").source, "本次对话");
  assert.equal(state.tasks.find((task) => task.id === "clarify-project").status, "working");
});

test("life constraints remain observations rather than character judgments", () => {
  const state = receiveMessage(createCompanionState(), "最近加班太累，总是没时间");
  assert.equal(state.areas.find((area) => area.id === "wellbeing").status, "observing");
  assert.match(state.messages.at(-1).text, /生活条件/);
  assert.equal(state.memories.at(-1).confidence, 0.65);
});
