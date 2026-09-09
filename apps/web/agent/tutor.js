export function beginTutor(action) {
  return {
    action_id: action.id,
    skill_id: action.skill_id,
    step: 1,
    hints_used: 0,
    status: "learning",
    prompt: `好，我们只做这一小步。${action.instructions}\n\n完成后不用写总结，直接用自己的话告诉我：${action.completion_criteria}`,
  };
}

export function tutorReply(session, observation) {
  const next = { ...session };
  if (observation.signals.confused || observation.signals.wants_hint) {
    next.hints_used += 1;
    const hints = [
      "先别找标准答案。只选一个具体的人：农民、统治者或普通家庭。技术变化后，他得到的东西和失去的东西分别是什么？",
      "再缩小一点：稳定粮食可能让人口增加，但定居、劳动和权力关系也会变化。你先判断其中哪一项更像收益，哪一项更像代价。",
      "我可以继续解释，但先请你补完这句话：农业让____变得更容易，同时让____成为新的问题。",
    ];
    next.prompt = hints[Math.min(next.hints_used - 1, hints.length - 1)];
    return next;
  }
  next.prompt = "先说你的思路，不需要一次说对。我会判断你卡在事实、概念，还是因果关系。";
  return next;
}
