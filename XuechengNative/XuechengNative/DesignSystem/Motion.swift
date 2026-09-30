import SwiftUI

/// Shared motion tokens for the native Xuecheng experience.
/// Keep interaction motion short, navigation/state changes calm, and ambient
/// motion slow enough to remain present without competing with learning.
enum XuechengMotion {
    static let fastInteraction = Animation.easeOut(duration: 0.18)
    static let standardTransition = Animation.smooth(duration: 0.36)
    static let selectionSpring = Animation.spring(duration: 0.36, bounce: 0.12)
    static let releaseSpring = Animation.spring(duration: 0.28, bounce: 0.10)

    static let ambientBreathing = Animation.easeInOut(duration: 3.0)
    static let listeningBreathing = Animation.easeInOut(duration: 1.8)
    static let thinkingBreathing = Animation.easeInOut(duration: 3.2)
    static let splashAmbientReveal = Animation.easeOut(duration: 1.5)
    static let nextStepEntrance = Animation.smooth(duration: 0.48).delay(0.08)

    static let splashDisplaySeconds: TimeInterval = 1.7
    static let splashStaggerMilliseconds: UInt64 = 150

    static let buttonPressedScale: CGFloat = 0.96
    static let surfacePressedScale: CGFloat = 0.98
    static let tabSelectedScale: CGFloat = 1.05
    static let companionRestingScale: CGFloat = 1.015
    static let companionListeningScale: CGFloat = 1.02
    static let companionThinkingScale: CGFloat = 1.015
    static let companionBreathingScale: CGFloat = 1.03
    static let disabledOpacity: Double = 0.56
}
