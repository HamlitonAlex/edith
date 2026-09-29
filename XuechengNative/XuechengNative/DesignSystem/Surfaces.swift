import SwiftUI

enum SurfaceLevel: Equatable {
    case normal
    case frosted
    case floating
}

struct GlassCard<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    let level: SurfaceLevel
    let radius: CGFloat
    let content: Content

    init(level: SurfaceLevel = .frosted, radius: CGFloat = XuechengTheme.radius28, @ViewBuilder content: () -> Content) {
        self.level = level
        self.radius = radius
        self.content = content()
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
    }

    private var shadow: XuechengTheme.ShadowToken {
        XuechengTheme.shadow(level == .floating ? .medium : .small, scheme: scheme)
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
            .background(materialBackground)
            .overlay {
                shape.strokeBorder(
                    level == .normal ? XuechengTheme.border(scheme).opacity(0.8) : XuechengTheme.glassEdge(scheme),
                    lineWidth: 0.7
                )
            }
            .shadow(color: level == .normal ? .clear : shadow.color, radius: shadow.radius, x: shadow.x, y: shadow.y)
    }
}

struct NormalSurface<Content: View>: View {
    let content: Content
    let radius: CGFloat

    init(radius: CGFloat = XuechengTheme.radius20, @ViewBuilder content: () -> Content) {
        self.radius = radius
        self.content = content()
    }

    var body: some View {
        GlassCard(level: .normal, radius: radius) { content }
    }
}

struct FrostedSurface<Content: View>: View {
    let content: Content
    let radius: CGFloat

    init(radius: CGFloat = XuechengTheme.radius28, @ViewBuilder content: () -> Content) {
        self.radius = radius
        self.content = content()
    }

    var body: some View {
        GlassCard(level: .frosted, radius: radius) { content }
    }
}

struct FloatingSurface<Content: View>: View {
    let content: Content
    let radius: CGFloat

    init(radius: CGFloat = XuechengTheme.radius28, @ViewBuilder content: () -> Content) {
        self.radius = radius
        self.content = content()
    }

    var body: some View {
        GlassCard(level: .floating, radius: radius) { content }
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.colorScheme) private var scheme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(XuechengTypography.buttonLabel.font)
            .tracking(XuechengTypography.buttonLabel.letterSpacing)
            .foregroundStyle(XuechengTheme.onGraphite(scheme))
            .padding(.horizontal, 18)
            .frame(minHeight: 48)
            .background(XuechengTheme.graphite(scheme), in: RoundedRectangle(cornerRadius: XuechengTheme.radius16, style: .continuous))
            .opacity(configuration.isPressed ? 0.84 : 1)
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.colorScheme) private var scheme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(XuechengTypography.buttonLabel.font)
            .tracking(XuechengTypography.buttonLabel.letterSpacing)
            .foregroundStyle(XuechengTheme.primaryText(scheme))
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(XuechengTheme.mist(scheme).opacity(0.72), in: Capsule())
            .opacity(configuration.isPressed ? 0.72 : 1)
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
