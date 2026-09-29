import Foundation

// One replaceable source of sample content for the static UI validation app.
enum PreviewFixtures {
    static let todayPathTitle = "Python 基础"
    static let todayPathSummary = "递归的终止条件 · 需要巩固"
    static let todayReviewSummary = "递归边界还需一次独立验证"
    static let todayScheduleSummary = "14:00 · 编程练习"
    static let learningSelfSummary = "遇到边界条件时会主动提问"
    static let direction = Direction(
        id: "ai-apps",
        title: "把编程基础学扎实，逐步走向 AI 应用开发",
        summary: "把编程基础学扎实"
    )

    static let goal = Goal(id: "programming-foundation", title: "把编程基础学扎实", directionID: direction.id, status: .confirmed)

    static let evidence: [Evidence] = [
        Evidence(id: "python-functions", capabilityID: "python", type: .apply,
                 task: "编写一个数据整理函数", summary: "能独立完成变量与函数的基础练习。",
                 result: .correct, hints: 0, independent: true, date: Date(timeIntervalSince1970: 1_790_000_000)),
        Evidence(id: "recursion-boundary", capabilityID: "recursion", type: .apply,
                 task: "递归边界基础题", summary: "基础题中两次未能正确判断何时停止。",
                 result: .incorrect, hints: 0, independent: true, date: Date(timeIntervalSince1970: 1_790_086_400)),
        Evidence(id: "debugging-hint", capabilityID: "debugging", type: .explain,
                 task: "跟踪函数调用过程", summary: "已能在提示下找到一次错误分支。",
                 result: .partial, hints: 1, independent: false, date: Date(timeIntervalSince1970: 1_790_172_800))
    ]

    static let practices: [Practice] = [
        Practice(id: "function-task", capabilityID: "python", title: "数据整理函数", summary: "编写一个数据整理函数"),
        Practice(id: "recursion-task", capabilityID: "recursion", title: "递归边界练习", summary: "递归边界练习"),
        Practice(id: "debugging-task", capabilityID: "debugging", title: "跟踪函数调用", summary: "跟踪函数调用过程")
    ]

    static let capabilities: [Capability] = [
        Capability(id: "python", title: "Python 基础表达", domain: "编程基础",
                   description: "用变量、函数与简单结构表达问题。", state: .stable,
                   masteryLevel: "多次独立应用", prerequisites: [], evidenceIDs: ["python-functions"],
                   latestPracticeID: "function-task", nextVerification: "在新的小任务里复用函数。",
                   stateReason: "已有多次独立应用记录，近期表现一致。"),
        Capability(id: "recursion", title: "递归的终止条件", domain: "编程基础",
                   description: "判断递归何时应当停止。", state: .weak,
                   masteryLevel: "需要独立验证", prerequisites: ["Python 基础表达"], evidenceIDs: ["recursion-boundary"],
                   latestPracticeID: "recursion-task", nextVerification: "在一道变式题中独立说明并实现终止条件。",
                   stateReason: "最近的练习反复出现相同错误，仍需要独立验证。"),
        Capability(id: "debugging", title: "递归错误定位", domain: "编程实践",
                   description: "通过调用过程定位递归错误。", state: .learning,
                   masteryLevel: "学习中", prerequisites: ["递归的终止条件"], evidenceIDs: ["debugging-hint"],
                   latestPracticeID: "debugging-task", nextVerification: "独立定位另一段代码的错误分支。",
                   stateReason: "已有学习尝试，但尚缺少低提示的独立应用证据。"),
        Capability(id: "rag", title: "检索增强应用", domain: "AI 应用",
                   description: "结合检索与生成完成应用任务。", state: .unknown,
                   masteryLevel: "尚无证据", prerequisites: ["Python 基础表达", "递归错误定位"], evidenceIDs: [],
                   latestPracticeID: nil, nextVerification: "完成进入该能力前的基础诊断。",
                   stateReason: "前置能力仍在学习中，目前不作掌握判断。")
    ]

    static let nextStep = NextStep(
        id: "next-recursion", title: "练习递归的终止条件",
        reason: "上次练习在判断何时停止时还不稳定。先用一道变式题巩固这个边界。",
        capabilityID: "recursion", estimatedMinutes: 20, sourceDescription: "最近的练习表现"
    )

    static let studySession = StudySession(
        id: "session-recursion", capabilityID: "recursion", title: "递归的终止条件",
        prompts: [
            .understand: "这次只聚焦一个问题：怎样判断递归应当停下来？先看你的想法，再一起验证。",
            .attempt: "请用自己的话说明：一个递归函数什么时候不应继续调用自己？",
            .hint: "我们先收窄问题，再换一道题检验你的判断。",
            .retry: "换个情境：计算列表元素个数时，空列表应当返回什么？为什么？",
            .evidence: "已经完成两次示例尝试。回看时，需要区分独立作答和获得提示后的表现。"
        ]
    )

    static let sessionResult = SessionResult(
        evidenceSummary: "能在变式题中指出空列表是终止条件。",
        evidenceTypes: "Explain · Apply",
        independence: "第一次独立尝试；第二次前获得 1 次方向提示。",
        taskResult: "已完成示例练习；仍需一次低提示的独立验证。",
        previousState: .learning, currentState: .learning,
        stateReason: "这次练习提供了新的线索，但提示后的成功还不足以判断这项能力已经稳定。",
        nextVerification: "独立完成另一道递归边界题，并说明为什么不会无限调用。"
    )

    static let learner = LearnerProfile(
        id: "preview-learner", displayName: "我", directionID: direction.id,
        currentStage: "巩固编程基础", learningPreference: "先理解原因，再通过练习验证",
        recentChange: "你已经能解释递归终止条件，并完成一道基础练习。",
        companionUnderstanding: "正在学习 Python；更喜欢先理解原因，再通过练习验证。学习偏好和长期方向由你决定，小程只提供建议。"
    )

    static let conversation = ConversationSample(
        userMessage: "昨天练习递归时，我总是不确定什么时候该停。",
        companionMessage: "上次练习时，你主要卡在终止条件。我们先从这里开始，一起看看什么时候该停下来。",
        followUp: "先想想：如果条件一直不成立，会发生什么？",
        suggestedPrompts: [
            "为什么推荐这一步？", "为什么这项能力还需要巩固？", "我想调整今天的计划",
            "我觉得这条学习证据不准确", "我想调整长期方向"
        ],
        scheduleSuggestion: "明天再练一次递归终止条件，预计 20 分钟。"
    )

    static let scheduleEntries: [ScheduleEntry] = [
        ScheduleEntry(id: "today-programming", timeLabel: "14:00", title: "编程练习", status: .confirmed),
        ScheduleEntry(id: "tomorrow-recursion", timeLabel: "明天", title: "复习递归边界", status: .suggested)
    ]

    static func capability(id: String) -> Capability? { capabilities.first { $0.id == id } }
    static func latestEvidence(for capability: Capability) -> String {
        evidence.first { capability.evidenceIDs.contains($0.id) }?.summary ?? "尚无可用的练习证据。"
    }
    static func latestPractice(for capability: Capability) -> String {
        practices.first { $0.id == capability.latestPracticeID }?.summary ?? "尚未开始"
    }
}
