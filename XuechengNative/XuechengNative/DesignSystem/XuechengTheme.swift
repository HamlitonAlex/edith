import SwiftUI

enum XuechengTheme {
    typealias Typography = XuechengTypography

    // Figma Make source, 2026-09-29: 8/12/16/24/32 scale and 24 pt page inset.
    enum Spacing {
        static let xSmall: CGFloat = 8
        static let small: CGFloat = 12
        static let medium: CGFloat = 16
        static let large: CGFloat = 24
        static let xLarge: CGFloat = 32
        static let page: CGFloat = 24
    }

    enum Radius {
        static let small: CGFloat = 12
        static let compact: CGFloat = 16
        static let medium: CGFloat = 20
        static let card: CGFloat = 24
        static let large: CGFloat = 28
        static let nextStep: CGFloat = 28
        static let input: CGFloat = 29
    }

    enum Materials {
        static let frosted: Material = .ultraThinMaterial
        static let floating: Material = .regularMaterial
    }

    enum ShadowLevel: Equatable {
        case small
        case medium
        case large
    }

    struct ShadowToken {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }

    // The nine typography roles are in XuechengTypography. The remaining
    // geometry below maps the Make source without adopting its CSS layout engine.
    static let pagePadding = Spacing.page
    static let space8 = Spacing.xSmall
    static let space12 = Spacing.small
    static let space16 = Spacing.medium
    static let space24 = Spacing.large
    static let space32 = Spacing.xLarge

    static let radius12 = Radius.small
    static let radius16 = Radius.compact
    static let radius20 = Radius.medium
    static let radius24 = Radius.card
    static let radius28 = Radius.large
    static let nextStepRadius = Radius.nextStep
    static let controlRadius = Radius.input
    static let nextStepTitleGap: CGFloat = 19
    static let nextStepReasonGap: CGFloat = 9
    static let nextStepDurationGap: CGFloat = 14
    static let nextStepActionGap: CGFloat = 25
    static let nextStepHorizontalInset: CGFloat = 28
    static let nextStepTopInset: CGFloat = 33
    static let nextStepBottomInset: CGFloat = 30
    static let pathMarkerTopInset: CGFloat = 9
    static let compactSectionGap: CGFloat = 14
    static let primaryActionIconSize: CGFloat = 15
    static let navigationRadius: CGFloat = 20
    static let navigationHeight: CGFloat = 58
    static let navigationItemHeight: CGFloat = 44
    static let navigationItemRadius: CGFloat = 15
    static let navigationIconSize: CGFloat = 20
    static let navigationIconLabelGap: CGFloat = 2
    static let navigationHorizontalInset: CGFloat = 22
    // The web preview's 19 pt bottom inset is replaced by the native safe area.
    static let navigationBottomInset: CGFloat = 0
    static let splashWordmarkSize: CGFloat = 29
    static let splashWordmarkTracking: CGFloat = 5.22
    static let splashMarkSize: CGFloat = 116
    static let splashMarkRadius: CGFloat = 31
    static let splashCaptionBottomInset: CGFloat = 72

    // Reference blur strengths; native Material has no exact CSS blur radius.
    static let frostedBlur: CGFloat = 24
    static let floatingBlur: CGFloat = 32

    static let canvasLight = color(hex: 0xE9E7E2)
    static let surfaceLight = color(hex: 0xF6F5F1)
    static let mistLight = color(hex: 0xEEECE7)
    static let graphiteLight = color(hex: 0x1D1D1B)
    static let charcoalLight = color(hex: 0x2A2926)
    static let textPrimaryLight = color(hex: 0x1D1D1B)
    static let textSecondaryLight = color(hex: 0x777570)
    static let borderLight = color(hex: 0xDCD9D2)
    static let ambientCoolLight = color(hex: 0xFFFFFF)
    static let ambientWarmLight = color(hex: 0xE0DDD6)
    static let ambientCanvasTopLight = color(hex: 0xF7F6F2)
    static let ambientCanvasMiddleLight = color(hex: 0xF1EFEA)
    static let ambientCanvasBottomLight = color(hex: 0xEBE8E2)
    static let splashCanvasTopLight = color(hex: 0xF8F7F3)
    static let splashCanvasMiddleLight = color(hex: 0xEFEDE8)
    static let splashCanvasBottomLight = color(hex: 0xE9E6E0)
    static let splashEdgeLight = color(hex: 0xC9C6BE)

    static let canvasDark = color(hex: 0x141516)
    static let surfaceDark = color(hex: 0x202224)
    static let mistDark = color(hex: 0x292B2D)
    static let graphiteDark = color(hex: 0xF0EFEB)
    static let charcoalDark = color(hex: 0x141516)
    static let textPrimaryDark = color(hex: 0xF0EFEB)
    static let textSecondaryDark = color(hex: 0x979995)
    static let borderDark = color(hex: 0xFFFFFF).opacity(0.105)
    static let ambientCoolDark = color(hex: 0x5D5E5B)
    static let ambientWarmDark = color(hex: 0x686965)
    static let ambientCanvasTopDark = color(hex: 0x1C1D1D)
    static let ambientCanvasBottomDark = color(hex: 0x0F1010)
    static let splashCanvasMiddleDark = color(hex: 0x131414)
    static let splashEdgeDark = color(hex: 0x9C9D99)

    private static let glassWhite = color(hex: 0xFFFFFF)
    private static let shadowWarm = color(hex: 0x322F2A)

    static func canvas(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? canvasDark : canvasLight
    }

    static func surface(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? surfaceDark : surfaceLight
    }

    static func mist(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? mistDark : mistLight
    }

    static func graphite(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? graphiteDark : graphiteLight
    }

    static func charcoal(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? charcoalDark : charcoalLight
    }

    static func primaryText(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? textPrimaryDark : textPrimaryLight
    }

    static func secondaryText(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? textSecondaryDark : textSecondaryLight
    }

    static func border(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? borderDark : borderLight.opacity(0.72)
    }

    static func glassEdge(_ scheme: ColorScheme) -> Color {
        glassWhite.opacity(scheme == .dark ? 0.105 : 0.68)
    }

    static func glassHighlight(_ scheme: ColorScheme) -> Color {
        glassWhite.opacity(scheme == .dark ? 0.06 : 0.38)
    }

    static func navigationBackground(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? glassWhite.opacity(0.09) : surfaceLight.opacity(0.57)
    }

    static func navigationInactive(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? textSecondaryDark : color(hex: 0xAAA8A2)
    }

    static func navigationActive(_ scheme: ColorScheme) -> Color {
        glassWhite.opacity(scheme == .dark ? 0.09 : 0.48)
    }

    static func nextStepGradient(_ scheme: ColorScheme) -> [Color] {
        scheme == .dark
            ? [surfaceDark.opacity(0.70), mistDark.opacity(0.50)]
            : [glassWhite.opacity(0.70), color(hex: 0xEBE8E2).opacity(0.50)]
    }

    static func onGraphite(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? charcoalDark : surfaceLight
    }

    static func background(_ level: SurfaceLevel, scheme: ColorScheme) -> Color {
        switch level {
        case .normal: surface(scheme)
        case .frosted: glassWhite.opacity(scheme == .dark ? 0.055 : 0.46)
        case .floating: glassWhite.opacity(scheme == .dark ? 0.09 : 0.64)
        }
    }

    static func shadow(_ level: ShadowLevel, scheme: ColorScheme) -> ShadowToken {
        if scheme == .dark {
            switch level {
            case .small: ShadowToken(color: .black.opacity(0.16), radius: 10, x: 0, y: 7)
            case .medium: ShadowToken(color: .black.opacity(0.21), radius: 23, x: 0, y: 18)
            case .large: ShadowToken(color: .black.opacity(0.26), radius: 38, x: 0, y: 30)
            }
        }
        switch level {
        case .small: ShadowToken(color: shadowWarm.opacity(0.055), radius: 11, x: 0, y: 7)
        case .medium: ShadowToken(color: shadowWarm.opacity(0.075), radius: 24, x: 0, y: 18)
        case .large: ShadowToken(color: shadowWarm.opacity(0.095), radius: 34, x: 0, y: 26)
        }
    }

    private static func color(hex: UInt32) -> Color {
        Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
