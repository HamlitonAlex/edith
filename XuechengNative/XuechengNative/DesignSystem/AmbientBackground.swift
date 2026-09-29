import SwiftUI

struct AmbientBackground: View {
    @Environment(\.colorScheme) private var systemScheme
    var mode: Appearance = .system
    var isSplash = false

    private var scheme: ColorScheme {
        mode.colorScheme ?? systemScheme
    }

    var body: some View {
        ZStack {
            XuechengTheme.canvas(scheme)

            LinearGradient(
                colors: scheme == .dark
                    ? [XuechengTheme.ambientCanvasTopDark, isSplash ? XuechengTheme.splashCanvasMiddleDark : XuechengTheme.canvasDark, XuechengTheme.ambientCanvasBottomDark]
                    : isSplash
                        ? [XuechengTheme.splashCanvasTopLight, XuechengTheme.splashCanvasMiddleLight, XuechengTheme.splashCanvasBottomLight]
                        : [XuechengTheme.ambientCanvasTopLight, XuechengTheme.ambientCanvasMiddleLight, XuechengTheme.ambientCanvasBottomLight],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [
                    (scheme == .dark ? XuechengTheme.ambientCoolDark : XuechengTheme.ambientCoolLight).opacity(scheme == .dark ? 0.10 : 0.82),
                    .clear
                ],
                center: isSplash ? .top : .topTrailing,
                startRadius: 2,
                endRadius: 390
            )

            RadialGradient(
                colors: [
                    (scheme == .dark ? (isSplash ? XuechengTheme.splashEdgeDark : XuechengTheme.ambientWarmDark) : (isSplash ? XuechengTheme.splashEdgeLight : XuechengTheme.ambientWarmLight)).opacity(scheme == .dark ? 0.09 : 0.48),
                    .clear
                ],
                center: .bottomLeading,
                startRadius: 6,
                endRadius: 420
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
