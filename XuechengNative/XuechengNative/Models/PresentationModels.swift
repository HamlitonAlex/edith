import Foundation

// Presentation-only shapes for the native UI prototype. They are not persistence or API models.
struct Direction: Identifiable, Hashable {
    let id: String
    let title: String
    let summary: String
}

struct Goal: Identifiable, Hashable {
    let id: String
    let title: String
    let directionID: String
    let status: Status

    enum Status: Hashable { case proposed, confirmed, paused, completed, archived }
}

enum CapabilityState: String, CaseIterable, Hashable {
    case unknown, learning, weak, stable

    var title: String {
        switch self {
        case .unknown: "待了解"
        case .learning: "学习中"
        case .weak: "需要巩固"
        case .stable: "较稳定"
        }
    }
}

struct Capability: Identifiable, Hashable {
    let id: String
    let title: String
    let domain: String
    let description: String
    let state: CapabilityState
    let masteryLevel: String
    let prerequisites: [String]
    let evidenceIDs: [String]
    let latestPracticeID: String?
    let nextVerification: String
    let stateReason: String
}

struct Evidence: Identifiable, Hashable {
    enum Kind: String, Hashable { case recall, explain, apply, transfer }
    enum Result: Hashable { case correct, partial, incorrect }

    let id: String
    let capabilityID: String
    let type: Kind
    let task: String
    let summary: String
    let result: Result
    let hints: Int
    let independent: Bool
    let date: Date
}

struct Practice: Identifiable, Hashable {
    let id: String
    let capabilityID: String
    let title: String
    let summary: String
}

struct NextStep: Identifiable, Hashable {
    let id: String
    let title: String
    let reason: String
    let capabilityID: String
    let estimatedMinutes: Int
    let sourceDescription: String
}

struct StudySession: Identifiable, Hashable {
    enum Phase: Int, CaseIterable, Hashable {
        case understand, attempt, hint, retry, evidence

        var title: String {
            switch self {
            case .understand: "理解"
            case .attempt: "尝试"
            case .hint: "提示"
            case .retry: "再尝试"
            case .evidence: "回看表现"
            }
        }
    }

    let id: String
    let capabilityID: String
    let title: String
    let prompts: [Phase: String]
}

struct LearnerProfile: Identifiable, Hashable {
    let id: String
    let displayName: String
    let directionID: String
    let currentStage: String
    let learningPreference: String
    let recentChange: String
    let companionUnderstanding: String
}

struct SessionResult: Hashable {
    let evidenceSummary: String
    let evidenceTypes: String
    let independence: String
    let taskResult: String
    let previousState: CapabilityState
    let currentState: CapabilityState
    let stateReason: String
    let nextVerification: String
}

struct ConversationSample: Hashable {
    let userMessage: String
    let companionMessage: String
    let followUp: String
    let suggestedPrompts: [String]
    let scheduleSuggestion: String
}

struct ScheduleEntry: Identifiable, Hashable {
    enum Status: Hashable { case confirmed, suggested }

    let id: String
    let timeLabel: String
    let title: String
    let status: Status

    var statusTitle: String { status == .confirmed ? "已确认" : "待确认建议" }
}
