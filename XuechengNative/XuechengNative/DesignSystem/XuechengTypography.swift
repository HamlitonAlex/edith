import SwiftUI

// Metrics from the 2026-09-29 Figma Make source. Font files are not bundled;
// system sans/serif are explicit iOS fallbacks, not a claim of font parity.
enum XuechengTypography {
    enum Family: String {
        case primarySans = "Noto Sans SC"
        case editorialSerif = "Noto Serif SC"
        case brandLatin = "DM Sans"
    }

    struct Token {
        let family: Family
        let size: CGFloat
        let weight: Font.Weight
        let lineHeight: CGFloat
        let letterSpacing: CGFloat

        var font: Font {
            // No font files or UIAppFonts entries are bundled at this stage.
            let design: Font.Design = family == .editorialSerif ? .serif : .default
            return .system(size: size, weight: weight, design: design)
        }

        var lineSpacing: CGFloat { max(0, lineHeight - size) }
    }

    static let display = Token(family: .editorialSerif, size: 32, weight: .medium, lineHeight: 42.88, letterSpacing: -0.64)
    static let pageTitle = Token(family: .editorialSerif, size: 28, weight: .medium, lineHeight: 39.76, letterSpacing: -0.336)
    static let sectionTitle = Token(family: .editorialSerif, size: 18, weight: .medium, lineHeight: 27, letterSpacing: 0)
    static let capabilityTitle = Token(family: .editorialSerif, size: 16, weight: .medium, lineHeight: 24, letterSpacing: 0)
    static let body = Token(family: .primarySans, size: 14, weight: .regular, lineHeight: 24.08, letterSpacing: 0.07)
    static let secondaryBody = Token(family: .primarySans, size: 12, weight: .regular, lineHeight: 20.16, letterSpacing: 0.06)
    static let secondary = secondaryBody
    static let caption = Token(family: .primarySans, size: 10, weight: .medium, lineHeight: 15, letterSpacing: 0.25)
    static let metadata = Token(family: .primarySans, size: 9, weight: .medium, lineHeight: 13.05, letterSpacing: 0.63)
    static let buttonLabel = Token(family: .primarySans, size: 12, weight: .medium, lineHeight: 12, letterSpacing: 0.12)
    static let button = buttonLabel

    static let brandLatin = Token(family: .brandLatin, size: 9, weight: .semibold, lineHeight: 12, letterSpacing: 3.78)
    static let splashWordmark = Token(family: .editorialSerif, size: 29, weight: .medium, lineHeight: 39, letterSpacing: 5.22)
    static let splashTagline = Token(family: .editorialSerif, size: 10, weight: .regular, lineHeight: 15, letterSpacing: 1.8)
}
