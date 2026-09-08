const includesAny = (text, terms) => terms.some((term) => text.includes(term));

export function interpretCapture(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    return {
      actor: "self",
      kind: "self_report",
      visibility: "private",
      goalHint: null,
      needsImmediateDecision: false,
      reply: "我还没有听到内容。你可以像平时说话一样，说刚才发生了什么。",
    };
  }

  const isFamilyObservation = includesAny(text, ["孩子", "女儿", "儿子", "他刚", "她刚"]);
  const isMaterial = includesAny(text, ["文章", "链接", "视频", "资料", "先存", "收藏"]);
  const wasMissed = includesAny(text, ["没来得及", "没学", "没做", "太累", "忘了"]);
  const goalHint = includesAny(text, ["数据", "表格", "周报"])
    ? "data-analysis"
    : includesAny(text, ["英语", "英文", "开口"])
      ? "spoken-english"
      : null;

  if (isMaterial) {
    return {
      actor: "self",
      kind: "artifact",
      visibility: "private",
      goalHint,
      needsImmediateDecision: false,
      reply: `收到了。我先把它保存为待整理材料${goalHint ? "，关联到当前学习方向" : ""}。你现在不用继续填写。`,
    };
  }

  if (isFamilyObservation) {
    return {
      actor: "parent",
      kind: "self_report",
      visibility: "guardian",
      goalHint,
      needsImmediateDecision: false,
      reply: "已经记下，这是你的观察。我会保留说话者身份，不替孩子下结论；需要形成家庭决定时再一起确认。",
    };
  }

  if (wasMissed) {
    return {
      actor: "self",
      kind: "self_report",
      visibility: "private",
      goalHint,
      needsImmediateDecision: false,
      reply: "已经记下今天没有按原计划发生。我先不改方案；如果这种情况形成趋势，再带着依据来问你。",
    };
  }

  return {
    actor: "self",
    kind: "self_report",
    visibility: "private",
    goalHint,
    needsImmediateDecision: false,
    reply: "已经记下。你现在不用判断它属于记录、问题还是计划，我会先放进今天的生活流。",
  };
}
