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
    messages: [
      { role: "assistant", text: "我已经明白一件重要的事：如果还要你每天打开应用、整理信息，它就没有真正融入生活。" },
      { role: "assistant", text: "所以在文件、微信、抖音收藏和日历真正接入前，我不会把这里包装成“已经了解你”。现在我只依据我们说过的话继续搭建。" },
    ],
    areas: DEVELOPMENT_AREAS.map(([id, title, description]) => {
      if (id === "projects") return { id, title, description, status: "active", note: "正在以真实开源产品作为第一个项目制目标" };
      if (id === "future") return { id, title, description, status: "observing", note: "涉及 AI 协作、产品判断与持续执行" };
      return { id, title, description, status: "background", note: "尚未形成判断" };
    }),
    memories: [
      { key: "project-goal", confidence: 0.92, text: "希望完成并发布私人教育助手开源项目", source: "连续对话" },
      { key: "usage-cost", confidence: 0.94, text: "不希望每天手工记录、打卡或维护复杂系统", source: "连续对话" },
      { key: "initiative-preference", confidence: 0.9, text: "希望助手主动联系，但主动程度和安静时段必须可调", source: "连续对话" },
    ],
    tasks: [
      { id: "market-research", status: "completed", title: "完成相邻产品体验研究", detail: "提炼出关系—行动—路径的产品顺序" },
      { id: "redesign-home", status: "working", title: "把你说过的偏好整理成可纠正的工作方式", detail: "不要求问卷、每日打卡或重复输入" },
    ],
    schedule: [
      {
        id: "general-evening",
        time: "18:00–18:30",
        area: "通识",
        platform: "哔哩哔哩",
        action: "观看",
        contentTitle: "世界历史速成课程 #1：农业革命",
        contentUrl: "https://www.bilibili.com/video/BV1fSr7YoEJ7/",
        completion: "看完 11 分钟视频，说出农业革命带来的一个收益和一个代价",
        status: "ready",
      },
    ],
    activeDirection: "把私人教育助手做成可安装的开源产品",
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
