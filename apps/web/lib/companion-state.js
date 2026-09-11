export const DEVELOPMENT_AREAS = [
  ["wellbeing", "身心基础", "健康、运动、休息、情绪与韧性"],
  ["agency", "自主性", "兴趣、选择、自我管理与自由探索"],
  ["language", "语言能力", "表达、沟通、英语与多元信息获取"],
  ["general", "通识结构", "历史、地理、科学、社会与文化"],
  ["projects", "项目制实践", "发现问题、创造、协作与真实成果"],
  ["future", "未来能力", "逻辑、问题解决、AI 协作与信息判断"],
  ["realworld", "现实能力", "财商、职业、生活技能与社会参与"],
  ["academic", "基础学习", "必要的学科基础与先备能力"],
];

export function createCompanionState() {
  return {
    assistantName: "小程",
    theme: "peach",
    messages: [],
    areas: DEVELOPMENT_AREAS.map(([id, title, description]) => ({ id, title, description, status: "background", note: "尚未形成判断" })),
    memories: [],
    tasks: [],
    schedule: [],
    activeDirection: "",
    initiative: 0.65,
  };
}

const hasAny = (text, words) => words.some((word) => text.includes(word));

export function receiveMessage(current, rawText) {
  const text = String(rawText || "").trim();
  if (!text) return current;
  const state = structuredClone(current);
  state.messages.push({ role: "user", text });
  if (hasAny(text, ["项目", "GitHub", "开源", "软件", "智能体", "助手"])) {
    state.activeDirection = "完成并公开发布一个真正可安装的私人教育助手";
    const projectArea = state.areas.find((area) => area.id === "projects");
    projectArea.status = "active"; projectArea.note = "正在以真实开源产品作为第一个项目制目标";
    const futureArea = state.areas.find((area) => area.id === "future");
    futureArea.status = "observing"; futureArea.note = "涉及 AI 协作、产品判断与持续执行";
    if (!state.memories.some((item) => item.key === "project-goal")) state.memories.push({ key:"project-goal", confidence:0.92, text:"希望完成并发布私人教育助手开源项目", source:"本次对话" });
    if (!state.tasks.some((task) => task.id === "clarify-project")) state.tasks.push({ id:"clarify-project", status:"working", title:"整理项目目标与第一阶段交付边界", detail:"从对话中持续更新，不要求填写问卷" });
    state.messages.push({ role:"assistant", text:"我先把它放进发展地图的“项目制实践”，并关联到 AI 协作能力。现在还不是正式方案：我会先理解你为什么想做、希望它改变什么，以及现实中能投入多少。刚才这一步我已经记入地图。" });
  } else if (hasAny(text, ["累", "没时间", "加班", "睡眠", "身体"])) {
    const area = state.areas.find((item) => item.id === "wellbeing"); area.status = "observing"; area.note = "现实精力可能影响当前路径，仍需结合更多情境确认";
    state.memories.push({ key:`context-${Date.now()}`, confidence:0.65, text, source:"本次对话（待确认）" });
    state.messages.push({ role:"assistant", text:"我先把这看作一个可能影响行动的生活条件，而不是把它解释成你不够坚持。这是最近偶尔发生，还是已经持续一段时间了？" });
  } else {
    state.memories.push({ key:`note-${Date.now()}`, confidence:0.55, text, source:"本次对话（尚未归类）" });
    state.messages.push({ role:"assistant", text:"我听到了。现在我还不急着把它归成目标或问题；我会先保留原话。它对你来说更像一件想推进的事，还是一件想弄明白的事？" });
  }
  return state;
}
