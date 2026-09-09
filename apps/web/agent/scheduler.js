export function scheduledCheck(state, hour) {
  if (hour >= 6 && hour < 10) return { kind: "morning", question: "结合今天的时间和长期方向，现在最值得推进什么？" };
  if (hour >= 16 && hour < 19 && state.next_recommended_action) return { kind: "evening", question: "现实安排或精力变了吗？原行动要维持、缩短还是推迟？" };
  if (hour >= 21) return { kind: "reflection", question: "今天真正改变了什么？", form_required: false };
  return null;
}
