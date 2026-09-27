import SwiftUI

enum XuechengTheme {
    enum TextRole {
        case display
        case pageTitle
        case sectionTitle
        case body
        case caption
        case meta
        case wordmark
        case nextStepTitle
        case editorialQuote
        case editorialEmphasis
        case userMessage
        case brandMeta
        case tagline
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

    // Values are mapped from the 2026-09-26 Figma Make export.
    static let pagePadding: CGFloat = 24
    static let space8: CGFloat = 8
    static let space12: CGFloat = 12
    static let space16: CGFloat = 16
    static let space24: CGFloat = 24
    static let space32: CGFloat = 32

    static let radius12: CGFloat = 12
    static let radius16: CGFloat = 16
    static let radius20: CGFloat = 20
    static let radius24: CGFloat = 24
    static let radius28: CGFloat = 28
    static let nextStepRadius: CGFloat = 30
    static let controlRadius: CGFloat = 36

    // Native materials replace the CSS blur values; these are reference strengths only.
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
    static let ambientCoolLight = color(hex: 0xCDD6DD)
    static let ambientWarmLight = color(hex: 0xCDC9C1)

    static let canvasDark = color(hex: 0x141516)
    static let surfaceDark = color(hex: 0x202224)
    static let mistDark = color(hex: 0x292B2D)
    static let graphiteDark = color(hex: 0xF0EFEB)
    static let charcoalDark = color(hex: 0x141516)
    static let textPrimaryDark = color(hex: 0xF0EFEB)
    static let textSecondaryDark = color(hex: 0x979995)
    static let borderDark = Color.white.opacity(0.105)
    static let ambientCoolDark = color(hex: 0x718091)
    static let ambientWarmDark = color(hex: 0x796B5F)

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

    static func onGraphite(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? charcoalDark : surfaceLight
    }

    static func font(_ role: TextRole) -> Font {
        switch role {
        case .display: .system(size: 34, weight: .regular, design: .serif)
        case .pageTitle: .system(size: 26, weight: .regular, design: .serif)
        case .sectionTitle: .system(size: 19, weight: .regular, design: .serif)
        case .body: .system(size: 15, weight: .regular, design: .default)
        case .caption: .system(size: 13, weight: .regular, design: .default)
        case .meta: .system(size: 10, weight: .medium, design: .default)
        case .wordmark: .system(size: 29, weight: .medium, design: .serif)
        case .nextStepTitle: .system(size: 29, weight: .regular, design: .serif)
        case .editorialQuote: .system(size: 20, weight: .regular, design: .serif)
        case .editorialEmphasis: .system(size: 17, weight: .regular, design: .serif)
        case .userMessage: .system(size: 14, weight: .regular, design: .serif)
        case .brandMeta: .system(size: 9, weight: .semibold, design: .default)
        case .tagline: .system(size: 10, weight: .regular, design: .serif)
        }
    }

    static func shadow(_ level: ShadowLevel, scheme: ColorScheme) -> ShadowToken {
        let opacity: Double = scheme == .dark ? 0.24 : 1
        switch level {
        case .small:
            ShadowToken(color: Color.black.opacity(0.07 * opacity), radius: 10, x: 0, y: 3)
        case .medium:
            ShadowToken(color: Color.black.opacity(0.09 * opacity), radius: 20, x: 0, y: 8)
        case .large:
            ShadowToken(color: Color.black.opacity(0.12 * opacity), radius: 30, x: 0, y: 16)
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
