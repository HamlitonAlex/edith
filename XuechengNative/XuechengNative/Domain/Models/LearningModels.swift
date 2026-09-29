import Foundation

// Core V2 models are independent of SwiftUI, PreviewFixtures, and transport DTOs.
enum XuechengDomain {
    struct Direction: Codable, Equatable, Identifiable {
        let id: String
        let title: String
    }

    struct Goal: Codable, Equatable, Identifiable {
        enum Status: String, Codable { case proposed, confirmed, paused, completed, archived }
        let id: String
        let directionID: String
        let title: String
        let status: Status
        let capabilityIDs: [String]
    }

    struct CapabilityDefinition: Codable, Equatable, Identifiable {
        let id: String
        let version: Int
        let title: String
        let prerequisiteIDs: [String]
        let order: Int
    }

    enum EvidenceType: String, Codable { case recall, explain, apply, transfer }
    enum Difficulty: String, Codable { case introductory, standard, advanced }
    enum Correctness: String, Codable { case correct, partial, incorrect }
    enum Independence: String, Codable { case independent, clarification, cue, scaffold, solution }
    enum Evaluator: String, Codable { case deterministic, human, modelProposal }

    struct PracticeTask: Codable, Equatable, Identifiable {
        let id: String
        let version: Int
        let capabilityID: String
        let title: String
        let prompt: String
        let expectedAnswer: String
        let evidenceType: EvidenceType
        let difficulty: Difficulty
    }

    struct Attempt: Codable, Equatable, Identifiable {
        let id: String
        let learnerID: String
        let taskID: String
        let taskVersion: Int
        let response: String
        let hintCount: Int
        let independence: Independence
        let retryCount: Int
        let submittedAt: Date
    }

    // Immutable observation. No mastery verdict belongs on an evidence record.
    struct Evidence: Codable, Equatable, Identifiable {
        let id: String
        let learnerID: String
        let capabilityID: String
        let taskID: String
        let taskVersion: Int
        let attemptID: String
        let type: EvidenceType
        let correctness: Correctness
        let independence: Independence
        let hintCount: Int
        let retryCount: Int
        let difficulty: Difficulty
        let evaluator: Evaluator
        let confidence: Double
        let observedAt: Date
    }

    struct SkillState: Codable, Equatable {
        enum Level: String, Codable { case unknown, learning, weak, stable }
        let learnerID: String
        let capabilityID: String
        let level: Level
        let evidenceCount: Int
        let updatedAt: Date?
    }

    struct NextStepCandidate: Codable, Equatable {
        let capabilityID: String
        let taskID: String
        let reason: String
    }

    struct NextStep: Codable, Equatable, Identifiable {
        enum Status: String, Codable { case generated, started, completed, replaced }
        let id: String
        let learnerID: String
        let capabilityID: String
        let taskID: String
        let reason: String
        let status: Status
        let createdAt: Date
    }
}
