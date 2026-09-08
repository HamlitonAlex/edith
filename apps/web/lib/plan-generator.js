const clean = (value) => String(value ?? "").trim();

export function validateBrief(input) {
  const errors = {};
  if (!new Set(["personal", "family"]).has(input.mode)) errors.mode = "请选择个人或家庭方案";
  if (!clean(input.goal)) errors.goal = "请描述最终希望能够完成什么";
  if (!clean(input.currentState)) errors.currentState = "请描述目前已经能做到什么";
  const minutes = Number(input.weeklyMinutes);
  if (!Number.isFinite(minutes) || minutes < 20 || minutes > 3000) {
    errors.weeklyMinutes = "每周时间请填写 20—3000 分钟";
  }
  if (input.mode === "family" && !clean(input.learnerName)) {
    errors.learnerName = "请填写孩子的称呼";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function buildActions(input, weeklyMinutes) {
  const sessions = weeklyMinutes >= 150 ? 3 : weeklyMinutes >= 60 ? 2 : 1;
  const reserve = Math.max(5, Math.round(weeklyMinutes * 0.15));
  const sessionMinutes = Math.max(10, Math.floor((weeklyMinutes - reserve) / sessions));
  const actor = input.mode === "family" ? input.learnerName : "你";
  return [
    `${actor}完成 1 次 ${sessionMinutes} 分钟的起点任务，保留作品或过程记录`,
    ...(sessions >= 2 ? [`完成 ${sessions - 1} 次各 ${sessionMinutes} 分钟的变式练习，逐步减少提示`] : []),
    `预留 ${reserve} 分钟回看：说明哪里会、哪里需要帮助，以及下一步是否继续`,
  ];
}

export function createPlan(input, now = new Date()) {
  const validation = validateBrief(input);
  if (!validation.valid) throw new Error("brief is incomplete");

  const weeklyMinutes = Number(input.weeklyMinutes);
  const isFamily = input.mode === "family";
  const voiceConfirmed = !isFamily || input.learnerVoice === "confirmed";
  const subject = isFamily ? input.learnerName : clean(input.learnerName) || "我";
  const constraints = clean(input.constraints) || "暂未提供额外限制";
  const interests = clean(input.interests) || "尚未确定偏好，将从小任务观察";

  return {
    id: `plan-${now.getTime()}`,
    mode: input.mode,
    version: 1,
    status: voiceConfirmed ? "draft" : "discussion",
    createdAt: now.toISOString(),
    subject,
    direction: clean(input.goal),
    baseline: clean(input.currentState),
    constraints,
    weeklyMinutes,
    interests,
    participantVoice: isFamily ? input.learnerVoice : "self",
    stages: [
      { title: "确认起点", purpose: "用一个低压力任务区分已有能力与需要帮助的部分", gate: "得到一份可复看的起点作品或过程记录" },
      { title: "有反馈地练习", purpose: "围绕真实目标练习，先提供支持，再逐步减少提示", gate: "能在较少提示下完成相似任务并解释做法" },
      { title: "独立应用", purpose: "换材料或情境，检验能否迁移，而不是只重复原题", gate: "能独立完成一次真实应用，并说明局限或需要的帮助" },
    ],
    currentActions: buildActions(input, weeklyMinutes),
    evidence: [
      "保留实际作品、录音、过程截图或可复述的任务结果",
      "记录完成时需要了多少提示，而不只记录是否完成",
      "用不同材料再做一次；单次成功不标记为稳定掌握",
    ],
    assumptions: [
      `当前目标“${clean(input.goal)}”适合先作为探索方向，而非确定承诺`,
      `每周可稳定投入约 ${weeklyMinutes} 分钟`,
      isFamily && !voiceConfirmed ? "目标由家长提供，孩子意见尚未确认" : "参与者愿意先尝试一个短周期",
    ],
    risks: [
      `起点信息来自自述，需用第一个任务校准：${clean(input.currentState)}`,
      `现实限制：${constraints}`,
      `兴趣与材料偏好：${interests}`,
    ],
    history: [],
  };
}

export function adoptPlan(plan, now = new Date()) {
  if (plan.status === "discussion") throw new Error("participant voice is not confirmed");
  return { ...plan, status: "active", adoptedAt: now.toISOString() };
}

export function reviseTimeBudget(plan, weeklyMinutes, now = new Date()) {
  const minutes = Number(weeklyMinutes);
  if (!Number.isFinite(minutes) || minutes < 20 || minutes > 3000) throw new Error("invalid time budget");
  const input = { mode: plan.mode, learnerName: plan.subject };
  return {
    ...plan,
    version: plan.version + 1,
    weeklyMinutes: minutes,
    currentActions: buildActions(input, minutes),
    adoptedAt: now.toISOString(),
    history: [
      ...plan.history,
      { version: plan.version, weeklyMinutes: plan.weeklyMinutes, changedAt: now.toISOString(), reason: "每周可投入时间发生变化" },
    ],
  };
}

export function planToMarkdown(plan) {
  const list = (items) => items.map((item) => `- ${item}`).join("\n");
  return `# ${plan.subject}的学习方案 · 第 ${plan.version} 版\n\n` +
    `状态：${plan.status}\n\n## 方向\n\n${plan.direction}\n\n` +
    `## 起点\n\n${plan.baseline}\n\n## 现实约束\n\n${plan.constraints}\n\n` +
    `每周时间：${plan.weeklyMinutes} 分钟\n\n## 当前行动\n\n${list(plan.currentActions)}\n\n` +
    `## 掌握与迁移证据\n\n${list(plan.evidence)}\n\n## 假设与风险\n\n${list([...plan.assumptions, ...plan.risks])}\n`;
}
