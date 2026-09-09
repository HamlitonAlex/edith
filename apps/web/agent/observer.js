const includesAny = (text, words) => words.some(word => text.includes(word));

export function observe(rawText, now = new Date()) {
  const text = String(rawText || "").trim();
  const duration = text.match(/(\d+(?:\.\d+)?)\s*(分钟|小时)/);
  return {
    id: `observation-${now.getTime()}`,
    at: now.toISOString(),
    source: "conversation",
    text,
    signals: {
      asks_why: includesAny(text, ["为什么", "有啥用", "意义"]),
      accepts: includesAny(text, ["接受", "可以", "开始吧", "就这个", "现在做"]),
      rejects: includesAny(text, ["不想做", "不要这个", "取消", "没必要"]),
      final_reject: includesAny(text, ["我决定取消", "还是取消", "仍然取消", "最终不做"]),
      delays: includesAny(text, ["明天", "推迟", "晚点", "改天"]),
      tired: includesAny(text, ["累", "困", "没精力", "不想动"]),
      busy: includesAny(text, ["没时间", "要上学", "去学校", "拍摄", "临时有事", "加班"]),
      completed: includesAny(text, ["完成了", "做完", "看完", "学完"]),
      confused: includesAny(text, ["没懂", "不明白", "不会", "卡住"]),
      wants_hint: includesAny(text, ["提示", "思路", "引导"]),
      duration_minutes: duration ? Math.round(Number(duration[1]) * (duration[2] === "小时" ? 60 : 1)) : null,
    },
  };
}
