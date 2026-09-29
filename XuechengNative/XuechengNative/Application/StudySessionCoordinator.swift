import Foundation

enum StudySessionError: Error, Equatable {
    case duplicateAttemptConflict
    case taskOutsideGoal
}

struct StudySubmission {
    let attempt: XuechengDomain.Attempt
    let evidence: XuechengDomain.Evidence
    let skillState: XuechengDomain.SkillState
    let nextStep: XuechengDomain.NextStep?
    let wasDuplicate: Bool
}

// The only MVP command path from an answer to Evidence, SkillState, and an
// official NextStep. No UI, conversation, memory, or daily log writes state.
actor StudySessionCoordinator {
    private let repository: any LearningRepository
    private let evidencePolicy = EvidencePolicy()
    private let aggregator = SkillStateAggregator()
    private let selection = NextStepSelectionPolicy()

    init(repository: any LearningRepository) { self.repository = repository }

    func recommend(learnerID: String, goal: XuechengDomain.Goal, now: Date = Date()) throws -> XuechengDomain.NextStep? {
        let definitions = repository.capabilities()
        let states = definitions.compactMap { repository.state(learnerID: learnerID, capabilityID: $0.id) }
        let completed = Set(repository.attempts(learnerID: learnerID).map(\.taskID))
        guard let candidate = try selection.candidate(
            goal: goal, capabilities: definitions, states: states,
            tasks: repository.practices(), completedTaskIDs: completed
        ) else { return nil }
        let step = selection.official(candidate, learnerID: learnerID, now: now)
        repository.setCurrentStep(step)
        return step
    }

    func submit(_ attempt: XuechengDomain.Attempt, goal: XuechengDomain.Goal) throws -> StudySubmission {
        if let existing = repository.attempt(id: attempt.id, learnerID: attempt.learnerID) {
            guard existing == attempt else { throw StudySessionError.duplicateAttemptConflict }
            guard let saved = repository.evidence(learnerID: attempt.learnerID,
                                                  capabilityID: repository.practices().first(where: { $0.id == attempt.taskID })?.capabilityID ?? "")
                .first(where: { $0.attemptID == attempt.id }),
                  let state = repository.state(learnerID: attempt.learnerID, capabilityID: saved.capabilityID)
            else { throw StudySessionError.duplicateAttemptConflict }
            return .init(attempt: existing, evidence: saved, skillState: state,
                         nextStep: repository.currentStep(learnerID: attempt.learnerID), wasDuplicate: true)
        }
        guard goal.status == .confirmed else { throw LearningPolicyError.goalNotConfirmed }
        guard let task = repository.practices().first(where: { $0.id == attempt.taskID }) else {
            throw LearningPolicyError.missingTask
        }
        guard goal.capabilityIDs.contains(task.capabilityID) else { throw StudySessionError.taskOutsideGoal }
        guard repository.capabilities().contains(where: { $0.id == task.capabilityID }) else {
            throw LearningPolicyError.missingCapability
        }
        let evidence = try evidencePolicy.evaluate(attempt, for: task)
        let old = repository.state(learnerID: attempt.learnerID, capabilityID: task.capabilityID)
        let allEvidence = repository.evidence(learnerID: attempt.learnerID, capabilityID: task.capabilityID) + [evidence]
        let state = aggregator.aggregate(learnerID: attempt.learnerID, capabilityID: task.capabilityID,
                                         evidence: allEvidence, previous: old)
        let definitions = repository.capabilities()
        let states = definitions.map { definition in
            definition.id == task.capabilityID ? state :
                (repository.state(learnerID: attempt.learnerID, capabilityID: definition.id) ??
                 .init(learnerID: attempt.learnerID, capabilityID: definition.id,
                       level: .unknown, evidenceCount: 0, updatedAt: nil))
        }
        let completed = Set(repository.attempts(learnerID: attempt.learnerID).map(\.taskID)).union([task.id])
        let candidate = try selection.candidate(goal: goal, capabilities: definitions, states: states,
                                                 tasks: repository.practices(), completedTaskIDs: completed)
        let next = candidate.map { selection.official($0, learnerID: attempt.learnerID, now: attempt.submittedAt) }
        let change = LearningCommit(attempt: attempt, evidence: evidence, state: state, nextStep: next)
        guard repository.commit(change) else { throw StudySessionError.duplicateAttemptConflict }
        return .init(attempt: attempt, evidence: evidence, skillState: state,
                     nextStep: next, wasDuplicate: false)
    }
}
