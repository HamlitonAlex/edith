import { deriveTutorFeedback } from "./user-model.js";

const directionLabel = goal => goal?.text || "未命名方向";

function latestObservation(state) {
  const event = state.recent_events?.at(-1);
  return event?.text || state.current_stage || "还没有足够的近期观察";
}

function buildContext(state) {
  return {
    stage: state.current_stage || "尚未确认阶段",
    current_state: { ...(state.current_state || {}) },
    constraints: (state.current_constraints || []).slice(-3),
    available_minutes: state.today_context?.available_minutes ?? null,
    recent_activity: (state.recent_events || []).slice(-3).map(event => event.text),
  };
}

function isSkillsExamDirection(goal) {
  return /技能高考|技能考试|高考/.test(`${goal?.id || ""} ${goal?.text || ""}`);
}

function relatedDirection(state) {
  const goals = state.long_term_goals || [];
  if (!goals.length) return null;
  if (state.current_state?.urgent_direction === "skills_exam") {
    const examGoal = goals.find(isSkillsExamDirection);
    if (examGoal) return examGoal;
  }
  const candidate = Object.values(state.direction_signals || {})
    .filter(signal => signal.status === "path_candidate")
    .sort((a, b) => (b.strength || 0) - (a.strength || 0))[0];
  if (candidate) {
    const matchingGoal = goals.find(goal => {
      if (candidate.id === "skills_exam") return isSkillsExamDirection(goal);
      if (candidate.id === "ai_product") return /AI\s*产品|产品/.test(goal.text || "");
      if (candidate.id === "network_foundations") return /网络|TCP|UDP|计算机/.test(goal.text || "");
      return false;
    });
    if (matchingGoal) return matchingGoal;
  }
  return goals[0];
}

function deferredPattern(state) {
  const records = [];
  for (const item of state.action_history || []) {
    if (["verified", "completed", "accepted", "rejected"].includes(item.outcome)) {
      records.length = 0;
      continue;
    }
    if (item.outcome === "deferred" || /推迟|延期|未完成/.test(item.reason || "")) records.push(item);
  }
  const days = new Set(records.map(item => item.at?.slice(0, 10)).filter(Boolean));
  return { count: records.length, unique_days: days.size };
}

function findProgressSkill(state) {
  return Object.entries(state.skills || {})
    .map(([id, skill]) => ({ id, ...skill }))
    .filter(skill => (skill.evidence || []).length >= 2 && (skill.confidence || 0) >= 0.65)
    .sort((a, b) => ((b.confidence || 0) + (b.evidence || []).length * 0.03) - ((a.confidence || 0) + (a.evidence || []).length * 0.03))[0] || null;
}

function chooseLearningArea(state) {
  return Object.entries(state.skills || {})
    .sort(([, a], [, b]) => (a.confidence ?? 0) - (b.confidence ?? 0))[0]?.[0] || "self_direction";
}

function skillForTutorDomain(domain) {
  if (domain === "computer") return "computer_basics";
  if (domain === "english") return "english_expression";
  return "general_knowledge";
}

function previousProposalCount(state, gapId) {
  return (state.decision_log || [])
    .filter(entry => entry.decision === "propose" && entry.gap_id === gapId)
    .length;
}

function compareDirections(state, selected) {
  const alternatives = (state.long_term_goals || [])
    .filter(goal => goal.id !== selected?.id)
    .map(goal => {
      if (state.current_state?.urgent_direction === "skills_exam" && isSkillsExamDirection(selected)) {
        return `为什么不是“${directionLabel(goal)}”：它仍然重要，但没有当前考试窗口紧迫，今天先不让它抢占检验时间。`;
      }
      return `为什么不是“${directionLabel(goal)}”：目前缺少与今天情境直接相连的证据，先不把它排在当前一步之前。`;
    });
  if (state.current_state?.energy === "low") alternatives.push("为什么不是休息：今天的低能量只属于 current_state；若没有可执行的最小动作，我会先让你休息，不把它写成长期方向。");
  else alternatives.push("为什么不是休息：当前没有观察到需要完全停下的能量信号，先用一小步验证判断；状态变化时随时改判。");
  return alternatives;
}

export function diagnose(state) {
  const missing = [];
  if (!(state.long_term_goals || []).length) missing.push("长期目标");
  if (!state.today_context?.available_minutes) missing.push("今天可用时间");
  const related = relatedDirection(state);
  const delays = deferredPattern(state);
  const progressSkill = findProgressSkill(state);
  const tutorFeedback = deriveTutorFeedback(state);
  let gap;
  let focus;
  const examIsUrgent = state.current_state?.urgent_direction === "skills_exam" && related;
  if (examIsUrgent) {
    gap = {
      id: "exam_readiness",
      label: "考试检验",
      rationale: "考试进入紧迫窗口，但近期行为仍被产品实践占用，最大缺口是把时间转回可测的考试证据。",
      signal: "技能高考临近",
    };
    focus = "先处理紧迫且可验证的考试风险，再回到长期产品方向";
  } else if (tutorFeedback.lowered_failure) {
    const signal = tutorFeedback.lowered_failure;
    gap = {
      id: "prerequisite_diagnosis",
      label: "前置知识诊断",
      skill_id: skillForTutorDomain(signal.domain),
      topic: signal.topic,
      rationale: `“${signal.topic}”已经连续两次在降阶后仍未形成掌握证据，当前最大缺口是前置概念，而不是继续重复同一讲法。`,
      signal: "连续降阶后仍未掌握",
    };
    focus = `先回到“${signal.topic}”的前置知识，找出真正卡点再决定是否继续推进`;
  } else if (tutorFeedback.repeated_prompting) {
    const signal = tutorFeedback.repeated_prompting;
    gap = {
      id: "tutor_recovery",
      label: "换一种方式复现",
      skill_id: skillForTutorDomain(signal.domain),
      topic: signal.topic,
      rationale: `最近两次“${signal.topic}”都需要多次提示，当前缺口是讲法与步幅不合适，不应直接提高难度。`,
      signal: "连续两次提示过多",
    };
    focus = `降低“${signal.topic}”的步幅，换一种更容易主动作答的方式复现`;
  } else if (tutorFeedback.recurring_english_error) {
    const signal = tutorFeedback.recurring_english_error;
    gap = {
      id: "english_recurrence",
      label: "英语表达复现",
      skill_id: "english_expression",
      topic: signal.topic,
      rationale: `同一个英语表达错误已经在两次验证中出现，当前最大缺口是轻量复现与即时修正，而不是悄悄换到新内容。`,
      signal: "同一英语错误重复出现",
    };
    focus = `用两句轻量复现修正“${signal.topic}”，让正确表达真正留下来`;
  } else if (tutorFeedback.interrupted_task) {
    const signal = tutorFeedback.interrupted_task;
    gap = {
      id: "activation_friction",
      label: "启动阻力",
      skill_id: skillForTutorDomain(signal.domain),
      topic: signal.topic,
      rationale: `“${signal.topic}”已经有两次 Tutor 中断，当前更像任务负担或时机不合适，需要修复启动条件，而不是归因于执行力。`,
      signal: "同一 Tutor 任务中断两次",
      tutor_interruption: true,
    };
    focus = `先修复“${signal.topic}”的启动条件，再决定是否继续投入`;
  } else if (tutorFeedback.domain_shift) {
    const signal = tutorFeedback.domain_shift;
    gap = {
      id: "direction_transition",
      label: "方向过渡",
      skill_id: skillForTutorDomain(signal.to),
      topic: signal.to,
      rationale: `最近的两次学习已经转向${signal.to}，但此前的${signal.from}仍在路径中；当前缺口是确认这次变化是阶段性切换还是长期转向。`,
      signal: "新领域连续出现",
    };
    focus = `确认从${signal.from}转向${signal.to}的意图，再安排下一步`;
  } else if (tutorFeedback.rapid_mastery) {
    const signal = tutorFeedback.rapid_mastery;
    gap = {
      id: "tutor_transfer",
      label: "迁移应用",
      skill_id: skillForTutorDomain(signal.domain),
      topic: signal.topic,
      rationale: `“${signal.topic}”已经连续两次快速独立通过，重复基础讲解的收益变低，当前缺口是迁移到新场景。`,
      signal: "连续两次快速掌握",
    };
    focus = `把“${signal.topic}”迁移到新场景，检验能力是否真正稳定`;
  } else if (delays.unique_days >= 3 || (delays.unique_days === 0 && delays.count >= 3)) {
    gap = {
      id: "activation_friction",
      label: "启动阻力",
      rationale: "连续三次建议没有完成，当前最大缺口是动作太重或启动条件不合适，而不是再补一份内容。",
      signal: "连续三次推迟",
    };
    focus = "先降低启动阻力，再验证方向是否仍然成立";
  } else if (progressSkill) {
    gap = {
      id: "apply_and_explain",
      label: "迁移与解释",
      skill_id: progressSkill.id,
      rationale: `已有${progressSkill.evidence.length}条真实证据，当前最大缺口从“理解”转为“在新场景独立应用并解释”。`,
      signal: "已有多条验证证据",
    };
    focus = "提高难度，把已验证能力迁移到新的真实场景";
  } else {
    gap = {
      id: "reality_anchor",
      label: "现实锚点",
      rationale: "方向已经存在，但还缺少一个能在今天观察到结果的具体场景。",
      signal: "方向到行动的证据不足",
    };
    focus = "把长期方向落到一个现实中可观察的变化";
  }
  const context = buildContext(state);
  const hasStage = Boolean(state.current_stage);
  const confidence = missing.length ? 0.68 : Math.min(0.92, 0.82 + (hasStage ? 0.04 : 0) + (related?.confidence >= 0.85 ? 0.03 : 0));
  const recentObservation = latestObservation(state);
  const observation = gap.id === "activation_friction"
    ? gap.tutor_interruption
      ? `同一 Tutor 任务已经中断两次。${recentObservation}`
      : `最近${delays.unique_days || delays.count}天的建议都被推迟。${recentObservation}`
      : gap.id === "apply_and_explain"
      ? `已经留下${progressSkill.evidence.length}条真实证据，但还没有新场景的迁移证据。${recentObservation}`
      : gap.id === "exam_readiness"
        ? `观察到技能高考进入紧迫窗口，而近期行为仍偏向产品实践。${recentObservation}`
        : recentObservation;
  const whyNot = compareDirections(state, related);
  const question = related
    ? `我还不太确定现在该怎样把“${directionLabel(related)}”落下来。我想先确认一件事：你今天大概有多少可用时间，精力又处在什么状态？`
    : "我还不太确定你现在更该补哪一块。我想先确认一件事：你此刻最想改变的现实问题是什么？";
  return {
    focus,
    observation,
    current_context: context,
    related_direction: related,
    gap,
    missing,
    evidence: [state.current_stage, ...(state.current_constraints || []).slice(-2), gap.signal].filter(Boolean),
    why_not_other_directions: whyNot,
    progress_skill: progressSkill,
    tutor_feedback: tutorFeedback,
    confidence,
    question,
  };
}

export function decideNextAction(state, diagnosis) {
  if (!(state.long_term_goals || []).length) return null;
  const primaryGoal = diagnosis.related_direction || state.long_term_goals[0];
  const available = state.today_context?.available_minutes;
  const friction = diagnosis.gap?.id === "activation_friction";
  const duration = friction ? Math.min(8, available || 5) : available ? Math.min(15, Math.max(8, available)) : 12;
  const progressSkill = diagnosis.progress_skill;
  const skillId = diagnosis.gap?.skill_id || progressSkill?.id || chooseLearningArea(state);
  const repeatIndex = previousProposalCount(state, diagnosis.gap?.id);
  const feedbackApplied = [];
  const feedback = diagnosis.tutor_feedback || {};
  let title;
  let instructions;
  let completionCriteria;
  let expectedGain;
  let whyNow;
  let judgment;
  if (diagnosis.gap?.id === "prerequisite_diagnosis") {
    const topic = diagnosis.gap.topic || "这个知识点";
    feedbackApplied.push("lowered_failure");
    title = `回到“${topic}”的前置基础做一次小诊断`;
    instructions = "先不重讲原题，只回答一个更基础的问题：它需要哪些输入、规则或步骤？如果说不清，标出最小缺口；如果说得清，再用一个新例子试一次。";
    completionCriteria = "留下一个前置概念判断、一个最小缺口，以及是否能进入新例子的决定。";
    expectedGain = "找到真正的前置卡点，避免在同一难度上继续消耗。";
    whyNow = `同一知识点已经连续两次降阶后仍未形成掌握证据，现在先诊断前置知识，比继续重复讲解更可靠。`;
    judgment = "降阶仍失败更像前置概念没有接上，先定位缺口，不把它解释成执行力问题。";
  } else if (diagnosis.gap?.id === "tutor_recovery") {
    const topic = diagnosis.gap.topic || "这个知识点";
    feedbackApplied.push("repeated_prompting");
    title = `用一个更小的例子复现“${topic}”`;
    instructions = "不提高难度，只选一个最小例子；先说输入和第一步，我只在必要处给一次提示，再让你自己接着完成。";
    completionCriteria = "独立说出最小例子的关键一步，并指出这次讲法哪里更容易。";
    expectedGain = "换掉让你反复求提示的讲法，保住主动理解。";
    whyNow = `最近两次“${topic}”都需要多次提示，今天先换步幅和表达方式，不急着进入新难度。`;
    judgment = "重复要提示说明当前讲法需要调整，而不是继续把同一内容讲得更长。";
  } else if (diagnosis.gap?.id === "english_recurrence") {
    const topic = diagnosis.gap.topic || "英语表达";
    feedbackApplied.push("recurring_english_error");
    title = `用两句轻量复现修正“${topic}”`;
    instructions = "先写一句和上次相似、但时间或人物不同的英文句子，再写一句你真实会用的话；我只指出最影响意思的一处，并让你马上改写。";
    completionCriteria = "独立改写两句英文，并能说出这次修正对应的规则。";
    expectedGain = "把反复出现的表达错误变成可迁移的正确用法。";
    whyNow = "同一个表达错误已经在两次验证中出现，现在用两句短复现及时修正，比直接换新内容更有效。";
    judgment = "这是稳定的重复错误信号，安排轻量复现即可，不需要一次上完整语法课。";
  } else if (diagnosis.gap?.id === "direction_transition") {
    const signal = feedback.domain_shift;
    feedbackApplied.push("domain_shift");
    title = `确认从${signal?.from || "原方向"}转向${signal?.to || "新方向"}，再选下一步`;
    instructions = "先用一句话说清：这次转向是今天的兴趣、阶段性切换，还是接下来一段时间的重点？然后选一个 10 分钟内能验证的新动作。";
    completionCriteria = "留下转向的时间范围、选择理由和一个可验证的小动作。";
    expectedGain = "把新兴趣和长期路径分开，既不压掉变化，也不让一次兴起改写长期方向。";
    whyNow = "新领域已经连续出现，但还需要确认它的持续性；先做一次短确认，避免把阶段性兴趣误当成永久转向。";
    judgment = "方向变化值得被认真听见，但需要两次以上的连续信号后再决定是否改变路径。";
  } else if (diagnosis.gap?.id === "tutor_transfer") {
    const topic = diagnosis.gap.topic || "这个知识点";
    feedbackApplied.push("rapid_mastery");
    title = `把“${topic}”迁移到一个新场景`;
    instructions = "不再重复定义，选一个你没练过的真实场景，独立写出输入、判断和结果；最后解释为什么这样做。";
    completionCriteria = "在新场景独立完成一次应用，并解释关键判断。";
    expectedGain = "确认快速掌握能迁移，而不是只记住熟悉例子。";
    whyNow = `你已经连续两次快速独立通过“${topic}”，重复基础讲解的收益变低，现在适合提高一个台阶。`;
    judgment = "已有两次快速验证，足以尝试迁移；如果新场景卡住，再回到具体缺口。";
  } else if (friction) {
    if (diagnosis.gap?.tutor_interruption) feedbackApplied.push("interrupted_task");
    const variants = [
      {
        title: `用 ${duration} 分钟拆掉“${primaryGoal.text}”的启动阻力`,
        instructions: "先判断卡点更像任务太大、时间安排不合适、临时状态不好、你不认可这个方向，还是我判断错了；再只打开相关材料，写下一个具体问题，到点就停。",
        completion: "留下卡点判断、一个具体问题和下一次可以接上的位置。",
      },
      {
        title: `给“${primaryGoal.text}”留一个轻量入口`,
        instructions: `不要求完成整项任务，只选一个最容易开始的材料或动作，试做 ${duration} 分钟；如果仍然卡住，就记下是时间、内容、方式还是方向的问题。`,
        completion: "留下一个实际试过的入口，以及它是否值得继续。",
      },
      {
        title: `把“${primaryGoal.text}”改成一次可接受的尝试`,
        instructions: "从任务、时间、状态、方向和判断这五项里选最像原因的一项，只做对应的最小尝试；不把没完成解释成执行力问题。",
        completion: "留下你选择的原因、一次最小尝试和下一步调整。",
      },
    ][Math.min(repeatIndex, 2)];
    title = variants.title;
    instructions = variants.instructions;
    completionCriteria = variants.completion;
    expectedGain = "先恢复可启动性，区分真正的方向问题与动作过重造成的推迟。";
    whyNow = diagnosis.gap?.tutor_interruption
      ? `同一 Tutor 任务已经中断两次，今天先把动作缩到足以开始的大小，确认是负担、时机还是方式的问题。`
      : `同类建议已经连续三次被推迟，今天最有价值的不是再增加内容，而是把动作缩到足以开始的大小。${primaryGoal.text}仍保留，但先用一次低负担启动验证。`;
    judgment = diagnosis.gap?.tutor_interruption
      ? "两次中断说明当前执行入口需要修复，不应把它解释成执行力问题。"
      : "连续三次没有完成说明启动条件需要调整，不应继续把责任归因给你。";
  } else if (diagnosis.gap?.id === "apply_and_explain") {
    title = `把“${progressSkill.label}”迁移到一个新场景并解释`;
    instructions = `选一个你尚未练过的真实场景，用“输入、判断、结果”三句话完成一次应用；再说明为什么这样判断。`;
    completionCriteria = "给出一个新场景、可观察结果和一段能让别人复现的解释。";
    expectedGain = "验证能力能否脱离熟悉题目迁移，避免把做过两次误认为真正掌握。";
    whyNow = `你已经留下${progressSkill.evidence.length}条真实证据，继续重复基础解释的收益变低；现在适合提高一个台阶，用新场景检验迁移。`;
    judgment = "已有证据支持提高难度，但还不足以宣称稳定掌握，所以用一次可解释的迁移来检验。";
  } else if (diagnosis.gap?.id === "exam_readiness") {
    const variants = [
      {
        title: `用 ${duration} 分钟完成一轮“${primaryGoal.text}”高频检验`,
        instructions: "选一个最近考试范围内的高频小题，先独立作答，再用错因和下一步复习点记录结果；不打开产品开发任务。",
        completion: "留下题目、作答结果、错因（或掌握依据）和下一轮复习点。",
      },
      {
        title: `用 ${duration} 分钟回放一题“${primaryGoal.text}”的错因`,
        instructions: "从最近做过的一道题开始，不急着刷新题；复述当时的判断、错在哪里、下次先看什么，最后补一条仍不确定的地方。",
        completion: "留下原题、错因复述和一个下一轮先检查的线索。",
      },
      {
        title: `用 ${duration} 分钟口述一题“${primaryGoal.text}”的判断`,
        instructions: "不看答案，选一道熟悉范围内的小题，用‘已知、判断、结论’口述一遍；说不清的地方就标成下一轮复习点。",
        completion: "留下一次口述记录、一个不确定点和是否需要回看材料的决定。",
      },
    ][Math.min(repeatIndex, 2)];
    title = variants.title;
    instructions = variants.instructions;
    completionCriteria = variants.completion;
    expectedGain = "把临近考试的焦虑转成可测证据，同时保留产品方向，不让短期风险被长期兴趣掩盖。";
    whyNow = "技能高考已经进入紧迫窗口，而你最近仍在投入产品；今天先做一轮可测检验，能最快暴露风险。AI 产品仍在路径里，但不是此刻的第一优先级。";
    judgment = "当前阶段先处理考试风险更负责任，因为它有明确截止时间和可验证结果。";
  } else {
    title = `把“${primaryGoal.text}”推进到一个现实场景`;
    instructions = "我会一次问一个问题。先说：如果这个方向今天真的前进了一小步，你的现实生活里会出现什么看得见的变化？";
    completionCriteria = "能说出一个具体场景、一项可观察变化，以及你愿意尝试的最小行动。";
    expectedGain = "把长期方向落到今天真实可见的场景，避免用一张固定计划替代判断。";
    whyNow = `你已经确认“${primaryGoal.text}”是当前方向，但我掌握的证据还不足以替你选择外部课程。先把目标落到真实场景，后续推荐才会属于你，而不是套用一份固定清单。`;
    judgment = "目前最重要的不是立刻塞入一门课程，而是先确认目标在现实生活中具体长什么样。";
  }
  const nextAction = {
    title,
    duration_minutes: duration,
    instructions,
    completion_criteria: completionCriteria,
  };
  const constraint = state.current_constraints?.at(-1);
  return {
    id: `judgment-${Date.now()}`,
    goal_id: primaryGoal.id,
    skill_id: skillId,
    title,
    duration_minutes: duration,
    estimated_time: duration,
    platform: "学程 · 对话",
    resource: null,
    instructions,
    suggested_method: instructions,
    completion_criteria: completionCriteria,
    completion_evidence: completionCriteria,
    observation: diagnosis.observation,
    current_context: diagnosis.current_context,
    related_direction: primaryGoal,
    gap: diagnosis.gap,
    next_action: nextAction,
    feedback_applied: feedbackApplied,
    tutor_feedback: diagnosis.tutor_feedback,
    expected_gain: expectedGain,
    why_now: `${whyNow}${constraint ? ` 当前还要把“${constraint}”作为现实限制。` : ""}`,
    why_not_other_directions: diagnosis.why_not_other_directions,
    judgment,
    counterpoint: "如果你今天有更紧迫的现实任务，或这条依据与你的实际不符，我会先听你补充，再调整或撤回建议。",
    reconsider_if: "你补充了更紧迫的安排、已有能力证据或明确想用的材料",
    evidence_required: ["具体场景", "可观察变化", "最小行动"],
    proposed_at: new Date().toISOString(),
    status: "proposed",
    diagnosis: diagnosis.focus,
    confidence: diagnosis.confidence,
    presentation_variant: repeatIndex,
  };
}

export function formatProposalSummary(action) {
  return `下一步：${action.title}\n\n为什么现在：${action.why_now}\n\n预计用时：${action.duration_minutes} 分钟`;
}

export function formatProposal(action, confidence = action.confidence ?? 0.7) {
  const context = action.current_context || {};
  const direction = action.related_direction?.text || action.related_direction || "当前方向";
  const gap = action.gap?.label || "当前缺口";
  const alternatives = action.why_not_other_directions?.length ? `\n\n为什么不是其他方向：\n${action.why_not_other_directions.join("\n")}` : "";
  return `我的判断：\n${action.judgment}\n\n我观察到：\n${action.observation}\n\n当前情境：\n${context.stage || "尚未确认阶段"}${context.available_minutes ? `，今天约 ${context.available_minutes} 分钟` : "，今天可用时间未确认"}\n\n关联方向：\n${direction}\n\n当前缺口：\n${gap}\n\n下一件事：\n${action.title}\n\n时间：\n${action.duration_minutes} 分钟\n\n为什么现在值得做：\n${action.why_now}${alternatives}\n\n怎么做：\n${action.instructions}\n\n完成标准：\n${action.completion_criteria}\n\n我的保留意见：\n${action.counterpoint}\n\n把握：${Math.round(confidence * 100)}%。如果“${action.reconsider_if}”，我会改变判断。\n\n你可以接受、缩短、推迟、反对，或者继续追问。最终由你决定。`;
}
