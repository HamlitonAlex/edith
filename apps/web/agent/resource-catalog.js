const SOURCE = "用户提供的《通识博主清单 4.0》截图";

const rows = [
  ["奶爸财经", "douyin", 10, "serious", ["经济"], "经济；建议家长与孩子一起看并讨论吸收"],
  ["无穷小亮的科普日常", "bilibili", 8, "serious", ["生物"], "生物；鉴定网络热门生物系列"],
  ["科学旅行号", "douyin", 6, "serious", ["宇宙", "科学"], "宇宙；科幻画面与简明文案"],
  ["一方见地（摇摄）", "douyin", 6, "serious", ["植物", "审美"], "植物；画质优美，表达优雅"],
  ["安森垚", "douyin", 10, "serious", ["百科"], "大百科；信息密度较高"],
  ["不刷题的吴姥姥", "bilibili", 10, "serious", ["物理"], "物理；用直观实验解释知识"],
  ["利利川", "bilibili", 8, "serious", ["地理", "人文"], "中国各省份的特点与人文"],
  ["赛雷三分钟", "bilibili", 8, "serious", ["百科"], "百科；内容紧凑，带一点幽默"],
  ["小透明明TM", "bilibili", 8, "serious", ["艺术", "人文"], "艺术人文；理性、硬核，信息密度较高"],
  ["医学边界", "bilibili", 10, "serious", ["医学"], "医疗科普、医学史、疾病常识"],
  ["小Q不是导盲犬", "bilibili", 10, "serious", ["时事", "国际关系", "历史"], "时事与国际关系，兼具趣味性和专业性"],
  ["沈万一", "douyin", 8, "serious", ["人文", "历史"], "人文历史；文化素养向"],
  ["汉字五千年", "bilibili", 10, "serious", ["人文", "历史"], "可搜索的资源系列，不是博主", "series"],
  ["星球研究所", "bilibili", 8, "serious", ["地理"], "地理；电影级制作"],
  ["方斯塔夫", "bilibili", 8, "serious", ["生物"], "深度解析冷门生物话题"],
  ["寻色中国", "tencent-video", 8, "serious", ["审美", "传统文化"], "收费纪录片；从色彩理解传统文化", "series"],
  ["混知", "douyin", 6, "playful", ["百科"], "搞笑漫画风的综合知识"],
  ["亿点点不一样", "bilibili", 8, "playful", ["百科", "科学"], "多领域科普；影视剧式表达"],
  ["毕导", "bilibili", 8, "playful", ["科学"], "把严肃知识讲得有趣；节奏快、逻辑严密"],
  ["桃矢王唯", "douyin", 10, "playful", ["法律"], "结合现实事件讲法律，表达通俗"],
  ["模型师老原儿", "bilibili", 6, "playful", ["生物"], "通过模型讲生物知识"],
  ["画渣花小格", "bilibili", 6, "playful", ["生活常识", "百科"], "把有趣知识画成漫画"],
  ["热爱干饭饭", "douyin", 8, "playful", ["地理"], "地理；风格清新，话题贴近日常"],
  ["兔叭咯", "bilibili", 10, "playful", ["医学"], "单口相声式医疗科普"],
  ["肥志百科", "bilibili", 6, "playful", ["自然", "人文", "百科"], "用可爱动画讲自然与人文"],
  ["门捷列夫很忙", "bilibili", 10, "playful", ["化学"], "收费纪录片；趣味化学科普", "series"],
  ["小Lin说", "bilibili", 10, "playful", ["经济"], "经济；通俗、内容紧凑"],
  ["我是不白吃", "bilibili", 6, "playful", ["食物", "历史", "百科"], "Q版动画讲食物背后的历史文化与知识"],
  ["斑马百科", "bilibili", 6, "playful", ["百科"], "篇幅较短、Q版表达，面向低龄"],
  ["历史调研室", "bilibili", 8, "serious", ["外国史", "历史"], "外国史；历史唯物主义视角"],
  ["浪花姜", "bilibili", 8, "serious", ["中国史", "历史"], "中国史与杂谈；信息量较大"],
  ["勇敢de冰", "bilibili", 10, "serious", ["中国史", "历史"], "中国史"],
  ["小王Albert", "bilibili", 10, "serious", ["中国史", "外国史", "时事", "历史"], "结合时事讲中外史，有一定难度"],
  ["奔放的小豆豆", "douyin", 8, "serious", ["中国近代史", "历史"], "中国近代史；通俗且覆盖较全"],
  ["思维实验室", "bilibili", 10, "serious", ["军事", "历史", "科学", "经济", "哲学"], "多领域、高密度信息，逻辑清晰"],
  ["稚嫩的魔法师", "bilibili", 10, "serious", ["中国史", "外国史", "历史"], "中外史；重脉络，不直接代替观众下结论"],
  ["史图馆", "bilibili", 8, "serious", ["中国史", "外国史", "时事", "历史"], "以地图讲中外史"],
  ["安州牧", "bilibili", 10, "serious", ["中国史", "历史"], "中国史；合集较多，适合系统了解"],
  ["如果历史是一群喵", "bilibili", 6, "playful", ["中国史", "历史"], "Q版、简短的中国史动画", "series"],
  ["喷点历史", "bilibili", 6, "playful", ["中国史", "外国史", "历史"], "中外史；合集较全，含儿童动画系列"],
  ["混子哥边画边讲", "douyin", 6, "playful", ["中国史", "历史"], "边画边讲中国史，直观易懂"],
  ["小约翰可汗", "bilibili", 8, "playful", ["外国史", "人物", "历史"], "从人物角度讲外国史"],
];

export const GENERAL_KNOWLEDGE_RESOURCES = rows.map((row, index) => ({
  id: `gk-${String(index + 1).padStart(2, "0")}`,
  name: row[0], platform: row[1], min_age: row[2], tone: row[3], topics: row[4], note: row[5],
  kind: row[6] || "creator", source: SOURCE,
  verification_status: "user_supplied_unverified", requires_verification: true,
  transcription_confidence: ["一方见地（摇摄）", "桃矢王唯", "兔叭咯"].includes(row[0]) ? "needs_review" : "high",
}));

const normalize = value => String(value || "").trim().toLowerCase();

export function findResourceCandidates({ topic = "", age, tone, platform } = {}) {
  const query = normalize(topic);
  return GENERAL_KNOWLEDGE_RESOURCES.filter(item => {
    if (Number.isFinite(age) && age < item.min_age) return false;
    if (tone && item.tone !== tone) return false;
    if (platform && item.platform !== platform) return false;
    return !query || [item.name, item.note, ...item.topics].some(value => normalize(value).includes(query));
  });
}

export function canRecommendResource(resource) {
  return Boolean(resource && resource.verification_status === "verified" && resource.url && resource.content_scope);
}
