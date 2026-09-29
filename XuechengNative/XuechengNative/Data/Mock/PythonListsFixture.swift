import Foundation

// Deterministic in-memory fixture for product and domain validation, not user data.
enum PythonListsFixture {
    static let direction = XuechengDomain.Direction(id: "direction.python", title: "学好 Python 基础")
    static let goal = XuechengDomain.Goal(
        id: "goal.python.lists", directionID: direction.id, title: "掌握 Python 列表基础",
        status: .confirmed,
        capabilityIDs: ["python.list.basics", "python.list.traversal", "python.list.comprehension"]
    )
    static let capabilities: [XuechengDomain.CapabilityDefinition] = [
        .init(id: "python.list.basics", version: 1, title: "列表基础", prerequisiteIDs: [], order: 1),
        .init(id: "python.list.traversal", version: 1, title: "遍历列表", prerequisiteIDs: ["python.list.basics"], order: 2),
        .init(id: "python.list.comprehension", version: 1, title: "列表推导式", prerequisiteIDs: ["python.list.traversal"], order: 3)
    ]
    static let practices: [XuechengDomain.PracticeTask] = [
        .init(id: "list.01", version: 1, capabilityID: "python.list.basics", title: "列表索引",
              prompt: "Python 中 [3, 5, 7][1] 的结果是什么？", expectedAnswer: "5",
              evidenceType: .recall, difficulty: .introductory),
        .init(id: "list.02", version: 1, capabilityID: "python.list.basics", title: "列表长度",
              prompt: "Python 中 len([3, 5, 7]) 的结果是什么？", expectedAnswer: "3",
              evidenceType: .recall, difficulty: .introductory),
        .init(id: "list.03", version: 1, capabilityID: "python.list.basics", title: "列表切片",
              prompt: "Python 中 [3, 5, 7][1:] 的结果是什么？", expectedAnswer: "[5,7]",
              evidenceType: .apply, difficulty: .standard),
        .init(id: "list.04", version: 1, capabilityID: "python.list.traversal", title: "遍历求和",
              prompt: "sum([2, 4, 6]) 的结果是什么？", expectedAnswer: "12",
              evidenceType: .apply, difficulty: .standard),
        .init(id: "list.05", version: 1, capabilityID: "python.list.comprehension", title: "推导式",
              prompt: "[x*2 for x in [1,2]] 的结果是什么？", expectedAnswer: "[2,4]",
              evidenceType: .apply, difficulty: .standard)
    ]

    static func repository() -> InMemoryLearningRepository {
        .init(capabilities: capabilities, practices: practices)
    }
}
