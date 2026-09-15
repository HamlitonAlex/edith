const includesAny = (text, words) => words.some(word => text.includes(word));

export function observe(rawText, now = new Date()) {
  const text = String(rawText || "").trim();
  const duration = text.match(/(\d+(?:\.\d+)?)\s*(分钟|小时)/);
  const mood = text.match(/情绪：\s*(专注|稳定|疲惫|焦虑|低落|有信心)/)?.[1] || null;
  const asksAction = /下一步|帮我(?:判断|安排)|该(?:学|做)|给我(?:建议|安排)|怎么办|计划|想学|想做|推进|开始/.test(text);
  const asksDiscussion = /聊聊|讨论|说说|你觉得|怎么看|听我说|吐槽/.test(text);
  const directionMentions = [];
  if (/(?:AI\s*产品|产品想法|新项目|做产品|做软件|陪人学习)/i.test(text)) directionMentions.push("ai_product");
  if (/(?:技能高考|技能考试|高考)/.test(text)) directionMentions.push("skills_exam");
  if (/(?:网络|TCP|UDP|计算机基础)/i.test(text)) directionMentions.push("network_foundations");
  return {
    id: `observation-${now.getTime()}`,
    at: now.toISOString(),
    source: "conversation",
    text,
    signals: {
      asks_why: includesAny(text, ["为什么", "有啥用", "意义"]),
      accepts: includesAny(text, ["接受", "可以", "开始吧", "就这个", "现在做", "对", "没错", "准确"]),
      rejects: includesAny(text, ["不想做", "不想学", "不要这个", "取消", "没必要"]),
      final_reject: includesAny(text, ["我决定取消", "还是取消", "仍然取消", "最终不做"]),
      delays: includesAny(text, ["明天", "推迟", "晚点", "改天"]),
      tired: includesAny(text, ["累", "困", "疲惫", "没精力", "不想动"]),
      mood,
      intent: asksAction ? "action" : asksDiscussion ? "discussion" : "listening",
      busy: includesAny(text, ["没时间", "要上学", "去学校", "拍摄", "临时有事", "加班"]),
      new_idea: includesAny(text, ["新想法", "产品想法", "突然想到", "突然有个", "灵感", "想做一个"]),
      wants_new_direction: includesAny(text, ["换个方向", "换一个方向", "想换方向", "改个方向"]),
      wants_other: includesAny(text, ["我想做别的", "想做别的事", "想换个事情", "想做另一件"]),
      direction_mentions: directionMentions,
      skills_exam_urgent: /(?:技能高考|技能考试|高考).{0,12}(?:临近|快到了|即将|还有\s*(?:\d+|几|两|三|一)\s*(?:天|周|个月)|倒计时)/.test(text),
      skills_exam_resolved: /(?:技能高考|技能考试|高考).{0,12}(?:已经考完|已考完|完成了|完成|结束)/.test(text),
      completed: includesAny(text, ["完成了", "做完", "看完", "学完"]),
      confused: includesAny(text, ["没懂", "不懂", "还是不明白", "不明白", "不会", "卡住", "不清楚"]),
      uncertain: /还没想好|没想好|不确定(?:学|做|选|该|方向)|不知道(?:学|做|选|该)/.test(text),
      wants_hint: includesAny(text, ["提示", "思路", "引导"]),
      wants_answer: /直接(?:告诉|给我)(?:答案|结果|代码)|不要问了|别问了|给我标准答案/.test(text),
      tutor_question: /为什么|怎么(?:理解|写|做)|有啥区别|区别是什么|什么意思|能举个例子|举例/.test(text),
      can_read_cannot_write: /看(?:得懂|懂)|理解(?:例子|示例).{0,12}(?:写不出|不会写|自己写不出来|动手不会)/.test(text),
      weak_baseline: /只知道|基础(?:很弱|不好)|完全不会|从零|没学过|不知道从哪/.test(text),
      fast_understanding: /能解释|理解了|掌握了|会写|独立完成|自己写得出|说得清楚/.test(text),
      duration_minutes: duration ? Math.round(Number(duration[1]) * (duration[2] === "小时" ? 60 : 1)) : null,
    },
  };
}
