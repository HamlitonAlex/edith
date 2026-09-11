const ACTIONS = [
  {
    id: "general-agriculture-01",
    goal_id: "build-xuecheng",
    skill_id: "general_knowledge",
    title: "看《世界历史速成课 #1：农业革命》前 11 分钟",
    duration_minutes: 20,
    platform: "哔哩哔哩",
    resource: { title: "世界历史速成课 #1：农业革命", url: "https://www.bilibili.com/video/BV1fSr7YoEJ7/", image: "./assets/resource-agriculture.webp" },
    instructions: "不倍速观看；只观察技术变化后，谁获得了什么、又付出了什么。",
    completion_criteria: "不用复述定义，用自己的话说出一个收益、一个代价，以及它怎样改变了社会关系。",
    why_now: "你未来想做产品。如果只懂 AI，很容易把所有问题都理解成技术问题。农业革命是人类第一次大规模改变生产关系的案例，它能帮助你观察技术如何改变社会结构。今天不是为了背历史，而是为产品判断建立一个更宽的坐标。",
    judgment: "我认为现在继续堆功能的边际价值，低于补一块能改变产品判断的通识坐标。",
    counterpoint: "反方理由是项目正在开发，保持编码连续性也很重要；如果今天只有 10 分钟，我会改为产品文档任务。",
    reconsider_if: "你今天有必须完成的构建故障，或可用时间少于 15 分钟。",
    evidence_required: ["收益", "代价", "社会关系"],
  },
  {
    id: "product-why-card-01",
    goal_id: "build-xuecheng",
    skill_id: "product",
    title: "为学程当前推荐补写一段“为什么是你、为什么是现在”",
    duration_minutes: 15,
    platform: "Windows · 项目文档",
    resource: { title: "PRODUCT.md", url: null },
    instructions: "打开 PRODUCT.md，选一条当前安排，用三句话连接用户目标、当前缺口和今天的行动。",
    completion_criteria: "三句话分别能回答：和长期目标有什么关系、当前缺口是什么、为什么不是以后再做。",
    why_now: "你刚刚抓住了学程与普通任务软件之间最关键的差异。趁判断仍然清楚，把它变成可检验的产品规则，比继续增加界面更有价值。",
    judgment: "我认为先把“为什么是你、为什么是现在”写成规则，比增加更多页面更重要。",
    counterpoint: "如果核心对话链路当前完全不可运行，应先修复阻断问题，再写产品规则。",
    reconsider_if: "现有版本存在阻断对话或无法保存状态的故障。",
    evidence_required: ["长期目标", "当前缺口", "现在"],
  },
];

export function diagnose(state) {
  const missing = [];
  if (!state.long_term_goals.length) missing.push("长期目标");
  if (!state.today_context?.available_minutes) missing.push("今天可用时间");
  const repeatedDelay = state.action_history.filter(item => item.reason.includes("推迟")).length >= 2;
  return {
    focus: repeatedDelay ? "降低行动阻力，同时保持方向连续" : "把产品判断建立在更宽的知识与真实证据上",
    evidence: [state.current_stage, ...state.current_constraints.slice(-2)],
    missing,
    confidence: missing.length ? 0.68 : 0.82,
  };
}

export function decideNextAction(state, diagnosis) {
  if (!state.long_term_goals.length) return null;
  const primaryGoal = state.long_term_goals[0];
  if (primaryGoal.id !== "build-xuecheng") {
    const available = state.today_context?.available_minutes;
    return {
      id: `clarify-goal-${Date.now()}`,
      goal_id: primaryGoal.id,
      skill_id: "self_direction",
      title: `把“${primaryGoal.text}”讲成一个真实场景`,
      duration_minutes: available ? Math.min(15, Math.max(8, available)) : 12,
      platform: "学程 · 对话",
      resource: null,
      instructions: "我会一次问一个问题。先告诉我：如果这个方向真的开始发生，你的一天里最先会出现什么可观察的变化？",
      completion_criteria: "能说出一个现实中看得见的变化，而不是只重复抽象目标。",
      why_now: `你刚确认“${primaryGoal.text}”是当前长期方向，但我还不知道它在现实生活中长什么样。先把它落到一个场景，后面的学习安排才不会是通用模板。`,
      judgment: "目前最重要的不是立刻塞入课程，而是先把长期方向和现实生活连接起来。",
      counterpoint: "如果你今天已有明确、紧迫且与目标直接相关的任务，我会先帮助你处理那个任务。",
      reconsider_if: "你告诉我今天已有更具体、更紧迫的现实安排",
      evidence_required: ["现实场景", "可观察变化"],
      proposed_at: new Date().toISOString(),
      status: "proposed",
      diagnosis: diagnosis.focus,
    };
  }
  const unfinished = ACTIONS.filter(candidate => !state.action_history.some(item => item.action_id === candidate.id && item.outcome === "verified"));
  const selected = unfinished.find(candidate => state.skills[candidate.skill_id]?.confidence < 0.5) || unfinished[0] || ACTIONS[1];
  const available = state.today_context?.available_minutes;
  const duration = available ? Math.min(selected.duration_minutes, Math.max(10, available)) : selected.duration_minutes;
  return { ...selected, duration_minutes: duration, proposed_at: new Date().toISOString(), status: "proposed", diagnosis: diagnosis.focus };
}

export function formatProposal(action, confidence = 0.7) {
  return `我的判断：\n${action.judgment}\n\n下一件事：\n${action.title}\n\n时间：\n${action.duration_minutes} 分钟\n\n为什么现在值得做：\n${action.why_now}\n\n怎么做：\n${action.instructions}\n\n完成标准：\n${action.completion_criteria}\n\n我的保留意见：\n${action.counterpoint}\n\n把握：${Math.round(confidence * 100)}%。如果“${action.reconsider_if}”，我会改变判断。\n\n你可以接受、缩短、推迟、反对，或者继续追问。最终由你决定。`;
}
