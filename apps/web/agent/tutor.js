const topicFromText = text => {
  if (/for\s*循环|Python.{0,12}for/i.test(text)) return "Python for 循环";
  if (/MySQL|SQL|查询执行顺序/i.test(text)) return "MySQL 查询执行顺序";
  if (/C语言|C\s*语言|指针|数组/i.test(text)) return "C 语言基础";
  if (/量子纠缠/.test(text)) return "量子纠缠";
  if (/英语|English|英文|口语|表达/i.test(text)) return "英语表达";
  const match = text.match(/(?:学|练习|讨论|关于|掌握)(?:一下|一下的|一下吧)?[：:\s]*([^，。！？!?]+)/);
  return match?.[1]?.trim() || "这个知识点";
};

export function inferTutorDomain(text = "", action = {}) {
  const source = `${text} ${action.title || ""} ${action.instructions || ""}`;
  if (/(?:Python|MySQL|SQL|C语言|C\s*语言|编程|代码|循环|变量|语法|数据库|查询)/i.test(source)) return "computer";
  if (/(?:英语|English|英文|口语|表达|grammar|sentence)/i.test(source)) return "english";
  return "general_knowledge";
}

function tutorSkillId(domain, action) {
  if (domain === "computer") return "computer_basics";
  if (domain === "english") return "english_expression";
  return action.skill_id || "general_knowledge";
}

export function inferTutorTopic(text = "", action = {}) {
  const fromText = topicFromText(text);
  if (fromText !== "这个知识点") return fromText;
  return topicFromText(`${action.title || ""} ${action.instructions || ""}`);
}

function classifyError(text, session) {
  if (session?.domain === "english" && /\b(?:he|she|it)\s+go\b|yesterday|last\s+(?:day|week)/i.test(text)) return "expression";
  if (/看(?:得懂|懂)|理解(?:例子|示例).{0,12}(?:写不出|不会写|自己写不出来|动手不会)/.test(text)) return "knows_but_cannot_write";
  if (/漏看条件|没看条件|忽略条件|条件.{0,6}(?:漏|忘|没)/.test(text)) return "condition_missed";
  if (/先.+后.+顺序|顺序(?:总是)?错|步骤顺序|顺序错/.test(text)) return "step_order";
  if (/语法|少了冒号|少冒号|报错|syntax|for\s+\w+\s+in\s+range\([^)]*\)\s+print/i.test(text)) return "syntax";
  if (/以为|误以为|就是(?:可以)?超光速|不包含|一直到\s*3|等于\s*3/.test(text)) return "concept_misunderstood";
  return null;
}

const domainHint = session => {
  if (session.domain === "computer") return "把它当成一个小程序：先说输入，再说每一步会发生什么，最后说输出。";
  if (session.domain === "english") return "先用你自己的句子说一遍，不追求一次完美，我只改最影响意思的一处。";
  return "先用一个生活里的例子说说它，再把例子和概念对应起来。";
};

function addTurn(next, observation) {
  next.turns = [...(next.turns || []), { at: observation.at, text: observation.text }].slice(-12);
  next.attempts = (next.attempts || 0) + 1;
  return next;
}

function addError(next, error) {
  if (!error) return;
  next.error_causes = [...new Set([...(next.error_causes || []), error])].slice(-6);
  next.last_error_cause = error;
}

export function beginTutor(action, observation = {}) {
  const text = observation.text || "";
  const domain = inferTutorDomain(text, action);
  const topic = inferTutorTopic(text, action);
  return {
    action_id: action.id,
    skill_id: tutorSkillId(domain, action),
    mode: "tutor",
    domain,
    topic,
    step: 1,
    attempts: 0,
    hints_used: 0,
    adaptations: 0,
    difficulty: "normal",
    stage: "baseline",
    status: "learning",
    error_causes: [],
    turns: [],
    prompt: `好，我们只做“${topic}”这一小步。开始前先摸一下基础：你现在知道什么，或会从哪里开始？只说会的部分也可以。`,
  };
}

export function isTutorCompletionEvidence(text = "", session = {}) {
  if (text.length < 18) return false;
  const concrete = text.length >= 28 && /具体场景/.test(text) && /(?:最小行动|可观察变化|能解释|独立|写出|输出)/.test(text);
  const independent = /(?:我能独立|自己完成|掌握了|会写出|能解释清楚|我会[^。！？!?]{0,12}(?:解释|写))/.test(text)
    && /(?:例子|场景|为什么|步骤|结果|输出|写|range|循环)/i.test(text);
  return Boolean(concrete || independent || (session.stage === "transfer" && /新场景|迁移/.test(text)));
}

export function tutorReply(session, observation) {
  const next = addTurn({ ...session, step: (session.step || 1) + 1 }, observation);
  const { signals = {}, text = "" } = observation;
  const error = classifyError(text, next);
  addError(next, error);

  if (signals.wants_answer) {
    next.hints_used = (next.hints_used || 0) + 1;
    next.stage = "hint";
    next.prompt = next.domain === "computer"
      ? `先给你一个不泄底的提示：把“${next.topic}”拆成输入、变化、输出三格，先填第一格；你写出一行，我再帮你看。`
      : next.domain === "english"
        ? "先给一个半成品提示：先说主语和时间，再自己补动词或句子。你先试一版。"
        : "先给你一个方向提示：把概念换成一个具体例子，再说这个例子里谁影响了谁。你先说第一句。";
    return next;
  }

  if (signals.confused) {
    next.adaptations = (next.adaptations || 0) + 1;
    next.stage = "scaffold";
    if (next.adaptations >= 2) next.difficulty = "lower";
    const variants = [
      `${domainHint(next)}先只回答一个小问题：${next.topic}里最先发生的那一步是什么？`,
      `我们换一种讲法，不再堆定义。想象一个日常例子：${next.topic}像什么？先说一个相似的东西。`,
      `再降一格，只看一个动作：如果我给你一个最小例子，你觉得第一步会看到什么？不用解释全部。`,
    ];
    next.prompt = variants[Math.min(next.adaptations - 1, variants.length - 1)];
    return next;
  }

  if (signals.can_read_cannot_write || error === "knows_but_cannot_write") {
    next.stage = "practice";
    next.prompt = next.domain === "computer"
      ? "那就不再看完整例子。先写一个填空骨架：`for ____ in ____:`，你只需要补两个空，写完我再问下一步。"
      : "我们从半成品开始：先写一句你想表达的话，留一个空也没关系，我只帮你补最关键的一处。";
    return next;
  }

  if (signals.fast_understanding && text.length >= 22 && !error) {
    next.stage = "transfer";
    next.difficulty = "higher";
    next.prompt = `基础解释已经比较清楚了。现在换一个${next.topic}的新场景：请你自己设计一个小例子并说明每一步为什么这样做。`;
    return next;
  }

  if (signals.tutor_question || signals.asks_why) {
    next.stage = "explain";
    next.prompt = next.topic.includes("range") || /for 循环/.test(next.topic)
      ? "把 `range(3)` 想成从 0 走到门前但不进 3 号门，所以得到 0、1、2。你换句话说：为什么最后一个数不出现？"
      : `${domainHint(next)}你刚问的这个点，先用一个小例子验证；然后请你用自己的话复述一遍，我只确认是否真的连起来了。`;
    return next;
  }

  if (error) {
    next.stage = "repair";
    const repairs = {
      concept_misunderstood: /量子纠缠/.test(next.topic)
        ? "纠缠体现的是相关性，不能用来超光速传递消息。先用自己的话换句话说：相关性和传消息差在哪里？"
        : "这里更像是边界概念混在一起了。先看一个最小反例，再用自己的话说：它明确不包含什么？",
      condition_missed: "先别重做整题，只把题目里的条件圈出来：哪一个条件会改变你的判断？",
      step_order: "先把步骤排成 1、2、3，不写代码；你觉得哪一步必须发生在前面，为什么？",
      syntax: "思路可能已经有了，先只检查语法边界（缩进、冒号和括号）。你改一处后把这一行贴回来。",
      expression: "意思已经能看懂了，只改一个关键点：过去发生的动作要和时间词配套。你用自己的句子再说一次。",
    };
    next.prompt = repairs[error] || `我们先定位“${next.topic}”的一个小卡点：你觉得是哪一步出了问题？`;
    return next;
  }

  if (signals.weak_baseline) {
    next.stage = "scaffold";
    next.prompt = `没关系，我们从最小例子开始。关于“${next.topic}”，先只判断一个输入会发生什么；我给你例子，你来猜下一步。`;
    return next;
  }

  next.stage = next.stage === "baseline" ? "scaffold" : next.stage;
  next.prompt = `先说你的思路，不需要一次说对。我会判断你卡在概念、条件、步骤，还是写法；这一步只回答一个小问题：${next.topic}最关键的变化是什么？`;
  return next;
}
