export function beginTutor(action) {
  return {
    action_id: action.id,
    skill_id: action.skill_id,
    step: 1,
    hints_used: 0,
    status: "learning",
    prompt: `好，我们只做这一小步。${action.instructions}\n\n不用写正式总结，直接用自己的话告诉我：${action.completion_criteria}`,
  };
}

export function tutorReply(session, observation) {
  const next = { ...session, hints_used: session.hints_used + 1 };
  const hints = [
    "先不找标准答案。说一个你今天真实遇到的场景：当时有谁、发生了什么、你希望哪里不同？",
    "再缩小一点：只找一个能被看到或听到的变化，不用先证明它一定正确。",
    "补完这句话就可以：在____场景里，我希望先让____发生一点变化；我能尝试的最小行动是____。",
  ];
  next.prompt = observation.signals.confused || observation.signals.wants_hint
    ? hints[Math.min(next.hints_used - 1, hints.length - 1)]
    : "先说你的思路，不需要一次说对。我会判断你卡在场景、变化，还是行动。";
  return next;
}
