import Foundation

enum LearningPolicyError: Error, Equatable {
    case missingTask, mismatchedTaskVersion, missingCapability, goalNotConfirmed
}

struct EvidencePolicy {
    // Fixed-answer tasks are deliberate for the first, narrow Python Lists MVP.
    // A model proposal is never silently treated as a verified performance result.
    func evaluate(_ attempt: XuechengDomain.Attempt, for task: XuechengDomain.PracticeTask) throws -> XuechengDomain.Evidence {
        guard attempt.taskID == task.id, attempt.taskVersion == task.version else {
            throw LearningPolicyError.mismatchedTaskVersion
        }
        let normalize: (String) -> String = {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
                .replacingOccurrences(of: " ", with: "")
        }
        let correctness: XuechengDomain.Correctness = normalize(attempt.response) == normalize(task.expectedAnswer)
            ? .correct : .incorrect
        // Exact string matching cannot verify an open explanation or transfer.
        // Keep its observation, but exclude it from authoritative aggregation.
        let requiresRubric = task.evidenceType == .explain || task.evidenceType == .transfer
        return .init(
            id: "evidence:\(attempt.id)", learnerID: attempt.learnerID,
            capabilityID: task.capabilityID, taskID: task.id, taskVersion: task.version,
            attemptID: attempt.id, type: task.evidenceType, correctness: correctness,
            independence: attempt.independence, hintCount: attempt.hintCount,
            retryCount: attempt.retryCount, difficulty: task.difficulty,
            evaluator: requiresRubric ? .modelProposal : .deterministic,
            confidence: requiresRubric ? 0.5 : 1, observedAt: attempt.submittedAt
        )
    }
}

struct SkillStateAggregator {
    func aggregate(
        learnerID: String, capabilityID: String,
        evidence: [XuechengDomain.Evidence], previous: XuechengDomain.SkillState? = nil
    ) -> XuechengDomain.SkillState {
        let eligible = evidence.filter {
            $0.learnerID == learnerID && $0.capabilityID == capabilityID &&
            $0.evaluator != .modelProposal && $0.confidence >= 0.8
        }.sorted { $0.observedAt < $1.observedAt }
        let independentPasses = eligible.filter {
            $0.correctness == .correct && $0.independence == .independent &&
            $0.hintCount == 0 && $0.retryCount == 0
        }
        let distinctTasks = Set(independentPasses.map(\.taskID))
        let hasApply = independentPasses.contains { $0.type == .apply || $0.type == .transfer }
        let failures = eligible.filter { $0.correctness == .incorrect }
        let newFailures = failures.filter { $0.observedAt > (previous?.updatedAt ?? .distantPast) }

        let level: XuechengDomain.SkillState.Level
        if eligible.isEmpty {
            level = .unknown
        } else if previous?.level == .stable && newFailures.count >= 2 {
            level = .weak
        } else if previous?.level == .stable {
            level = .stable // One failure is evidence, not an immediate demotion.
        } else if distinctTasks.count >= 3 && hasApply {
            level = .stable
        } else if failures.count >= 2 {
            level = .weak
        } else {
            level = .learning
        }
        return .init(learnerID: learnerID, capabilityID: capabilityID,
                     level: level, evidenceCount: eligible.count,
                     updatedAt: eligible.last?.observedAt)
    }
}

struct NextStepSelectionPolicy {
    func candidate(
        goal: XuechengDomain.Goal,
        capabilities: [XuechengDomain.CapabilityDefinition],
        states: [XuechengDomain.SkillState],
        tasks: [XuechengDomain.PracticeTask],
        reviewDueIDs: Set<String> = [], activePracticeID: String? = nil,
        completedTaskIDs: Set<String> = []
    ) throws -> XuechengDomain.NextStepCandidate? {
        guard goal.status == .confirmed else { throw LearningPolicyError.goalNotConfirmed }
        let byID = Dictionary(uniqueKeysWithValues: capabilities.map { ($0.id, $0) })
        let levels = Dictionary(uniqueKeysWithValues: states.map { ($0.capabilityID, $0.level) })
        let eligible = goal.capabilityIDs.compactMap { byID[$0] }.filter { capability in
            capability.prerequisiteIDs.allSatisfy { levels[$0] == .stable } &&
            levels[capability.id] != .stable &&
            tasks.contains { $0.capabilityID == capability.id }
        }
        let ranked = eligible.sorted { left, right in
            func rank(_ item: XuechengDomain.CapabilityDefinition) -> Int {
                if reviewDueIDs.contains(item.id) { return 0 }
                if levels[item.id] == .weak { return 1 }
                if tasks.contains(where: { $0.id == activePracticeID && $0.capabilityID == item.id }) { return 2 }
                return 3
            }
            if rank(left) != rank(right) { return rank(left) < rank(right) }
            if left.order != right.order { return left.order < right.order }
            return left.id < right.id
        }
        guard let chosen = ranked.first else { return nil }
        let orderedTasks = tasks.filter { $0.capabilityID == chosen.id }.sorted { $0.id < $1.id }
        let task = orderedTasks.first { !completedTaskIDs.contains($0.id) } ?? orderedTasks[0]
        let reason = reviewDueIDs.contains(chosen.id) ? "这项能力需要复习验证。" :
            levels[chosen.id] == .weak ? "最近的练习显示这项能力仍需巩固。" :
            "这是当前目标中先修条件已满足的下一项练习。"
        return .init(capabilityID: chosen.id, taskID: task.id, reason: reason)
    }

    // Only the application service calls this after selecting a candidate.
    func official(_ candidate: XuechengDomain.NextStepCandidate,
                  learnerID: String, now: Date) -> XuechengDomain.NextStep {
        .init(id: "step:\(learnerID):\(candidate.capabilityID):\(candidate.taskID)",
              learnerID: learnerID, capabilityID: candidate.capabilityID,
              taskID: candidate.taskID, reason: candidate.reason,
              status: .generated, createdAt: now)
    }
}
