import SwiftUI

enum SurfaceLevel: Equatable {
    case normal
    case frosted
    case floating
}

enum XuechengInteractionState: Equatable {
    case normal
    case pressed
    case selected
    case disabled
}

struct GlassCard<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let level: SurfaceLevel
    let radius: CGFloat
    var interaction: XuechengInteractionState
    let content: Content

    init(
        level: SurfaceLevel = .frosted,
        radius: CGFloat = XuechengTheme.radius28,
        interaction: XuechengInteractionState = .normal,
        @ViewBuilder content: () -> Content
    ) {
        self.level = level
        self.radius = radius
        self.interaction = interaction
        self.content = content()
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
    }

    private var shadow: XuechengTheme.ShadowToken {
        let token = XuechengTheme.shadow(level == .floating ? .medium : .small, scheme: scheme)
        guard interaction == .pressed else { return token }
        return XuechengTheme.ShadowToken(
            color: token.color.opacity(0.72),
            radius: token.radius * 0.76,
            x: token.x,
            y: token.y * 0.72
        )
    }

    @ViewBuilder
    private var materialBackground: some View {
        switch level {
        case .normal:
            shape.fill(XuechengTheme.surface(scheme))
        case .frosted:
            shape
                .fill(XuechengTheme.Materials.frosted)
                .overlay(shape.fill(XuechengTheme.background(.frosted, scheme: scheme)))
        case .floating:
            shape
                .fill(XuechengTheme.Materials.floating)
                .overlay(shape.fill(XuechengTheme.background(.floating, scheme: scheme)))
        }
    }

    var body: some View {
        content
            .background {
                ZStack {
                    materialBackground
                    if interaction == .selected {
                        shape.fill(XuechengTheme.glassHighlight(scheme).opacity(0.32))
                    }
                }
            }
            .overlay {
                shape.strokeBorder(
                    interaction == .selected
                        ? XuechengTheme.glassEdge(scheme)
                        : (level == .normal ? XuechengTheme.border(scheme).opacity(0.8) : XuechengTheme.glassEdge(scheme)),
                    lineWidth: 0.7
                )
            }
            .shadow(color: level == .normal ? .clear : shadow.color, radius: shadow.radius, x: shadow.x, y: shadow.y)
            .scaleEffect(interaction == .pressed && !reduceMotion ? XuechengMotion.surfacePressedScale : 1)
            .opacity(interaction == .disabled ? XuechengMotion.disabledOpacity : 1)
            .animation(
                reduceMotion ? nil : (interaction == .pressed ? XuechengMotion.fastInteraction : XuechengMotion.releaseSpring),
                value: interaction
            )
    }
}

struct NormalSurface<Content: View>: View {
    let content: Content
    let radius: CGFloat
    var interaction: XuechengInteractionState = .normal

    init(
        radius: CGFloat = XuechengTheme.radius20,
        interaction: XuechengInteractionState = .normal,
        @ViewBuilder content: () -> Content
    ) {
        self.radius = radius
        self.interaction = interaction
        self.content = content()
    }

    var body: some View {
        GlassCard(level: .normal, radius: radius, interaction: interaction) { content }
    }
}

struct FrostedSurface<Content: View>: View {
    let content: Content
    let radius: CGFloat
    var interaction: XuechengInteractionState = .normal

    init(
        radius: CGFloat = XuechengTheme.radius28,
        interaction: XuechengInteractionState = .normal,
        @ViewBuilder content: () -> Content
    ) {
        self.radius = radius
        self.interaction = interaction
        self.content = content()
    }

    var body: some View {
        GlassCard(level: .frosted, radius: radius, interaction: interaction) { content }
    }
}

struct FloatingSurface<Content: View>: View {
    let content: Content
    let radius: CGFloat
    var interaction: XuechengInteractionState = .normal

    init(
        radius: CGFloat = XuechengTheme.radius28,
        interaction: XuechengInteractionState = .normal,
        @ViewBuilder content: () -> Content
    ) {
        self.radius = radius
        self.interaction = interaction
        self.content = content()
    }

    var body: some View {
        GlassCard(level: .floating, radius: radius, interaction: interaction) { content }
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(XuechengTypography.buttonLabel.font)
            .tracking(XuechengTypography.buttonLabel.letterSpacing)
            .foregroundStyle(XuechengTheme.onGraphite(scheme))
            .padding(.horizontal, 18)
            .frame(minHeight: 48)
            .background(XuechengTheme.graphite(scheme), in: RoundedRectangle(cornerRadius: XuechengTheme.radius16, style: .continuous))
            .opacity(isEnabled ? (configuration.isPressed ? 0.9 : 1) : XuechengMotion.disabledOpacity)
            .scaleEffect(configuration.isPressed && !reduceMotion ? XuechengMotion.buttonPressedScale : 1)
            .animation(
                reduceMotion ? nil : (configuration.isPressed ? XuechengMotion.fastInteraction : XuechengMotion.releaseSpring),
                value: configuration.isPressed
            )
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(XuechengTypography.buttonLabel.font)
            .tracking(XuechengTypography.buttonLabel.letterSpacing)
            .foregroundStyle(XuechengTheme.primaryText(scheme))
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(XuechengTheme.mist(scheme).opacity(0.72), in: Capsule())
            .opacity(isEnabled ? (configuration.isPressed ? 0.82 : 1) : XuechengMotion.disabledOpacity)
            .scaleEffect(configuration.isPressed && !reduceMotion ? XuechengMotion.buttonPressedScale : 1)
            .animation(
                reduceMotion ? nil : (configuration.isPressed ? XuechengMotion.fastInteraction : XuechengMotion.releaseSpring),
                value: configuration.isPressed
            )
    }
}

struct XuechengQuietButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(isEnabled ? (configuration.isPressed ? 0.72 : 1) : XuechengMotion.disabledOpacity)
            .scaleEffect(configuration.isPressed && !reduceMotion ? XuechengMotion.buttonPressedScale : 1)
            .animation(
                reduceMotion ? nil : (configuration.isPressed ? XuechengMotion.fastInteraction : XuechengMotion.releaseSpring),
                value: configuration.isPressed
            )
    }
}

#Preview("Surface System") {
    VStack(spacing: 16) {
        NormalSurface { Text("Normal surface").padding(20) }
        FrostedSurface { Text("Frosted surface").padding(20) }
        FloatingSurface { Text("Floating surface").padding(20) }
    }
    .padding(24)
    .background(AmbientBackground())
}
