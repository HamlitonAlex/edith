import Foundation
import XCTest
@testable import XuechengNative

final class LearningDomainTests: XCTestCase {
    private let learner = "learner-a"

    private func attempt(_ id: String, task: XuechengDomain.PracticeTask,
                         response: String, hints: Int = 0,
                         independence: XuechengDomain.Independence = .independent,
                         learnerID: String = "learner-a") -> XuechengDomain.Attempt {
        .init(id: id, learnerID: learnerID, taskID: task.id, taskVersion: task.version,
              response: response, hintCount: hints, independence: independence,
              retryCount: 0, submittedAt: Date(timeIntervalSince1970: 1_800_000_000))
    }

    func testFirstEvidenceMovesUnknownToLearningButNotStable() async throws {
        let store = PythonListsFixture.repository()
        let coordinator = StudySessionCoordinator(repository: store)
        let task = PythonListsFixture.practices[0]
        let result = try await coordinator.submit(attempt("a1", task: task, response: "5"), goal: PythonListsFixture.goal)
        XCTAssertEqual(result.skillState.level, .learning)
        XCTAssertEqual(result.skillState.evidenceCount, 1)
        XCTAssertEqual(result.evidence.correctness, .correct)
    }

    func testHintedSuccessIsNotIndependentApply() throws {
        let task = PythonListsFixture.practices[2]
        let item = try EvidencePolicy().evaluate(attempt("hinted", task: task, response: "[5,7]",
                                                         hints: 1, independence: .cue), for: task)
        let state = SkillStateAggregator().aggregate(learnerID: learner, capabilityID: task.capabilityID,
                                                     evidence: [item])
        XCTAssertEqual(item.hintCount, 1)
        XCTAssertEqual(state.level, .learning)
    }

    func testOpenExplanationNeedsTrustedRubricBeforeStateChange() throws {
        let task = XuechengDomain.PracticeTask(id: "explain-1", version: 1,
            capabilityID: "python.list.basics", title: "解释索引", prompt: "解释为什么索引从零开始",
            expectedAnswer: "因为索引表示偏移量", evidenceType: .explain, difficulty: .standard)
        let item = try EvidencePolicy().evaluate(attempt("explain-a", task: task,
            response: task.expectedAnswer), for: task)
        XCTAssertEqual(item.evaluator, .modelProposal)
        XCTAssertEqual(SkillStateAggregator().aggregate(learnerID: learner,
            capabilityID: task.capabilityID, evidence: [item]).level, .unknown)
    }

    func testThreeDifferentIndependentTasksCanBecomeStable() async throws {
        let store = PythonListsFixture.repository()
        let coordinator = StudySessionCoordinator(repository: store)
        var state: XuechengDomain.SkillState?
        for (index, task) in PythonListsFixture.practices.prefix(3).enumerated() {
            state = try await coordinator.submit(attempt("pass-\(index)", task: task,
                                                         response: task.expectedAnswer),
                                                 goal: PythonListsFixture.goal).skillState
        }
        XCTAssertEqual(state?.level, .stable)
        XCTAssertEqual(store.currentStep(learnerID: learner)?.capabilityID, "python.list.traversal")
    }

    func testIncorrectAttemptIsRecordedButNotSuccessEvidence() async throws {
        let store = PythonListsFixture.repository()
        let coordinator = StudySessionCoordinator(repository: store)
        let task = PythonListsFixture.practices[0]
        let result = try await coordinator.submit(attempt("wrong", task: task, response: "999"), goal: PythonListsFixture.goal)
        XCTAssertNotNil(store.attempt(id: "wrong", learnerID: learner))
        XCTAssertEqual(result.evidence.correctness, .incorrect)
        XCTAssertNotEqual(result.skillState.level, .stable)
    }

    func testConversationAloneCannotUpdateSkillState() {
        let store = PythonListsFixture.repository()
        _ = "我懂 Python 列表了" // No Attempt, so no Evidence or state write path.
        XCTAssertNil(store.state(learnerID: learner, capabilityID: "python.list.basics"))
    }

    func testOneFailureDoesNotDemoteStableState() throws {
        let task = PythonListsFixture.practices[0]
        let failure = try EvidencePolicy().evaluate(attempt("later-fail", task: task, response: "no"), for: task)
        let previous = XuechengDomain.SkillState(learnerID: learner, capabilityID: task.capabilityID,
                                                  level: .stable, evidenceCount: 3,
                                                  updatedAt: Date(timeIntervalSince1970: 1_799_999_999))
        let current = SkillStateAggregator().aggregate(learnerID: learner, capabilityID: task.capabilityID,
                                                        evidence: [failure], previous: previous)
        XCTAssertEqual(current.level, .stable)
    }

    func testRepeatedIncorrectAttemptsBecomeWeak() throws {
        let task = PythonListsFixture.practices[0]
        let policy = EvidencePolicy()
        let first = try policy.evaluate(attempt("failure-1", task: task, response: "no"), for: task)
        let second = try policy.evaluate(attempt("failure-2", task: task, response: "still no"), for: task)
        let state = SkillStateAggregator().aggregate(learnerID: learner,
            capabilityID: task.capabilityID, evidence: [first, second])
        XCTAssertEqual(state.level, .weak)
    }

    func testPrerequisiteBlocksOfficialNextStep() throws {
        let goal = XuechengDomain.Goal(id: "g", directionID: "d", title: "遍历列表", status: .confirmed,
                                        capabilityIDs: ["python.list.traversal"])
        let candidate = try NextStepSelectionPolicy().candidate(goal: goal,
            capabilities: PythonListsFixture.capabilities, states: [], tasks: PythonListsFixture.practices)
        XCTAssertNil(candidate)
    }

    func testCandidateDoesNotWriteOfficialStep() throws {
        let store = PythonListsFixture.repository()
        let candidate = try NextStepSelectionPolicy().candidate(goal: PythonListsFixture.goal,
            capabilities: store.capabilities(), states: [], tasks: store.practices())
        XCTAssertNotNil(candidate)
        XCTAssertNil(store.currentStep(learnerID: learner))
    }

    func testOnlyOneCurrentStepPerLearner() async throws {
        let store = PythonListsFixture.repository()
        let coordinator = StudySessionCoordinator(repository: store)
        let first = try await coordinator.recommend(learnerID: learner, goal: PythonListsFixture.goal)
        let second = try await coordinator.recommend(learnerID: learner, goal: PythonListsFixture.goal)
        XCTAssertNotNil(first)
        XCTAssertEqual(second, store.currentStep(learnerID: learner))
        XCTAssertEqual(store.currentStep(learnerID: learner)?.learnerID, learner)
    }

    func testDuplicateAttemptDoesNotDuplicateEvidence() async throws {
        let store = PythonListsFixture.repository()
        let coordinator = StudySessionCoordinator(repository: store)
        let task = PythonListsFixture.practices[0]
        let input = attempt("same", task: task, response: "5")
        _ = try await coordinator.submit(input, goal: PythonListsFixture.goal)
        let repeated = try await coordinator.submit(input, goal: PythonListsFixture.goal)
        XCTAssertTrue(repeated.wasDuplicate)
        XCTAssertEqual(store.evidence(learnerID: learner, capabilityID: task.capabilityID).count, 1)
        do {
            _ = try await coordinator.submit(attempt("same", task: task, response: "0"), goal: PythonListsFixture.goal)
            XCTFail("Changed payload for the same attempt ID must be rejected")
        } catch StudySessionError.duplicateAttemptConflict { }
    }

    func testDifferentLearnersRemainIsolated() async throws {
        let store = PythonListsFixture.repository()
        let coordinator = StudySessionCoordinator(repository: store)
        let task = PythonListsFixture.practices[0]
        _ = try await coordinator.submit(attempt("shared-id", task: task, response: "5"), goal: PythonListsFixture.goal)
        _ = try await coordinator.submit(attempt("shared-id", task: task, response: "0", learnerID: "learner-b"),
                                         goal: PythonListsFixture.goal)
        XCTAssertEqual(store.evidence(learnerID: learner, capabilityID: task.capabilityID).count, 1)
        XCTAssertEqual(store.evidence(learnerID: "learner-b", capabilityID: task.capabilityID).count, 1)
    }
}
