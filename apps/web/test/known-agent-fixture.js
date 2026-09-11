import { createAgentState } from "../agent/state.js";

export function createKnownAgentState(now = new Date()) {
  const state = createAgentState(now);
  state.current_stage = "把长期方向落实到日常行动";
  state.long_term_goals = [{ id: "goal-learning-rhythm", text: "建立稳定而自主的学习节奏", confidence: 0.92, source: "测试对话" }];
  state.active_goals = ["从现实场景开始形成下一步"];
  state.interests = ["自主学习", "真实项目"];
  state.current_constraints = ["今天的精力有限"];
  state.today_context = { available_minutes: 20 };
  return state;
}
