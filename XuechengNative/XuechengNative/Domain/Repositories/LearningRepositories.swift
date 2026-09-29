import Foundation

protocol CapabilityRepository {
    func capabilities() -> [XuechengDomain.CapabilityDefinition]
}
protocol PracticeRepository {
    func practices() -> [XuechengDomain.PracticeTask]
    func attempt(id: String, learnerID: String) -> XuechengDomain.Attempt?
    func attempts(learnerID: String) -> [XuechengDomain.Attempt]
}
protocol EvidenceRepository {
    func evidence(learnerID: String, capabilityID: String) -> [XuechengDomain.Evidence]
}
protocol SkillStateRepository {
    func state(learnerID: String, capabilityID: String) -> XuechengDomain.SkillState?
}
protocol NextStepRepository {
    func currentStep(learnerID: String) -> XuechengDomain.NextStep?
}

struct LearningCommit {
    let attempt: XuechengDomain.Attempt
    let evidence: XuechengDomain.Evidence
    let state: XuechengDomain.SkillState
    let nextStep: XuechengDomain.NextStep?
}

protocol LearningRepository: CapabilityRepository, PracticeRepository, EvidenceRepository,
    SkillStateRepository, NextStepRepository {
    // Storage operation only: decisions are made by the application coordinator.
    // false means the attempt already exists; no evidence or state is overwritten.
    func commit(_ change: LearningCommit) -> Bool
    func setCurrentStep(_ step: XuechengDomain.NextStep?)
}

// One process only. The coordinator actor serializes domain commands; this store
// is intentionally not a replacement for durable or multi-user backend storage.
final class InMemoryLearningRepository: LearningRepository {
    private let definitions: [XuechengDomain.CapabilityDefinition]
    private let tasks: [XuechengDomain.PracticeTask]
    private var attemptsByKey: [String: XuechengDomain.Attempt] = [:]
    private var evidenceByAttemptKey: [String: XuechengDomain.Evidence] = [:]
    private var statesByKey: [String: XuechengDomain.SkillState] = [:]
    private var currentByLearner: [String: XuechengDomain.NextStep] = [:]
    private let lock = NSLock()

    init(capabilities: [XuechengDomain.CapabilityDefinition], practices: [XuechengDomain.PracticeTask]) {
        definitions = capabilities
        tasks = practices
    }

    private func key(_ learnerID: String, _ id: String) -> String { "\(learnerID):\(id)" }

    func capabilities() -> [XuechengDomain.CapabilityDefinition] { definitions }
    func practices() -> [XuechengDomain.PracticeTask] { tasks }

    func attempt(id: String, learnerID: String) -> XuechengDomain.Attempt? {
        lock.lock(); defer { lock.unlock() }
        return attemptsByKey[key(learnerID, id)]
    }

    func attempts(learnerID: String) -> [XuechengDomain.Attempt] {
        lock.lock(); defer { lock.unlock() }
        return attemptsByKey.values.filter { $0.learnerID == learnerID }
    }

    func evidence(learnerID: String, capabilityID: String) -> [XuechengDomain.Evidence] {
        lock.lock(); defer { lock.unlock() }
        return evidenceByAttemptKey.values.filter {
            $0.learnerID == learnerID && $0.capabilityID == capabilityID
        }.sorted { $0.observedAt < $1.observedAt }
    }

    func state(learnerID: String, capabilityID: String) -> XuechengDomain.SkillState? {
        lock.lock(); defer { lock.unlock() }
        return statesByKey[key(learnerID, capabilityID)]
    }

    func currentStep(learnerID: String) -> XuechengDomain.NextStep? {
        lock.lock(); defer { lock.unlock() }
        return currentByLearner[learnerID]
    }

    func setCurrentStep(_ step: XuechengDomain.NextStep?) {
        guard let step else { return }
        lock.lock(); defer { lock.unlock() }
        currentByLearner[step.learnerID] = step
    }

    func commit(_ change: LearningCommit) -> Bool {
        lock.lock(); defer { lock.unlock() }
        let attemptKey = key(change.attempt.learnerID, change.attempt.id)
        guard attemptsByKey[attemptKey] == nil else { return false }
        precondition(change.evidence.attemptID == change.attempt.id)
        precondition(change.evidence.learnerID == change.attempt.learnerID)
        precondition(change.state.learnerID == change.attempt.learnerID)
        if let step = change.nextStep { precondition(step.learnerID == change.attempt.learnerID) }
        attemptsByKey[attemptKey] = change.attempt
        evidenceByAttemptKey[attemptKey] = change.evidence // append-only key
        statesByKey[key(change.state.learnerID, change.state.capabilityID)] = change.state
        currentByLearner[change.attempt.learnerID] = change.nextStep // one official step per learner
        return true
    }
}
