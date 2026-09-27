import SwiftUI

struct AmbientBackground: View {
    @Environment(\.colorScheme) private var systemScheme
    var mode: Appearance = .system

    private var scheme: ColorScheme {
        mode.colorScheme ?? systemScheme
    }

    var body: some View {
        ZStack {
            XuechengTheme.canvas(scheme)

            LinearGradient(
                colors: scheme == .dark
                    ? [XuechengTheme.surfaceDark.opacity(0.40), XuechengTheme.canvasDark, XuechengTheme.charcoalDark]
                    : [XuechengTheme.surfaceLight, XuechengTheme.canvasLight.opacity(0.76), XuechengTheme.mistLight.opacity(0.76)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [
                    (scheme == .dark ? XuechengTheme.ambientCoolDark : Color.white).opacity(scheme == .dark ? 0.10 : 0.72),
                    .clear
                ],
                center: .topTrailing,
                startRadius: 2,
                endRadius: 540
            )

            RadialGradient(
                colors: [
                    (scheme == .dark ? XuechengTheme.ambientWarmDark : XuechengTheme.ambientWarmLight).opacity(scheme == .dark ? 0.055 : 0.30),
                    .clear
                ],
                center: .bottomLeading,
                startRadius: 6,
                endRadius: 480
            )

            RadialGradient(
                colors: [
                    (scheme == .dark ? XuechengTheme.ambientCoolDark : XuechengTheme.ambientCoolLight).opacity(scheme == .dark ? 0.07 : 0.12),
                    .clear
                ],
                center: .center,
                startRadius: 12,
                endRadius: 640
            )
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

#Preview("Ambient · Light") {
    AmbientBackground(mode: .light)
}

#Preview("Ambient · Dark") {
    AmbientBackground(mode: .dark)
}
