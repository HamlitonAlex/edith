import SwiftUI

struct AppRootView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showsSplash = true

    var body: some View {
        Group {
            if showsSplash {
                SplashView()
                    .transition(
                        reduceMotion
                            ? .opacity
                            : .opacity.combined(with: .scale(scale: 0.985))
                    )
            } else {
                XuechengNavigation()
            }
        }
        .task {
            guard showsSplash else { return }
            try? await Task.sleep(for: .seconds(XuechengMotion.splashDisplaySeconds))
            withAnimation(reduceMotion ? nil : XuechengMotion.standardTransition) {
                showsSplash = false
            }
        }
    }
}

#Preview("App Shell · Light") {
    AppRootView()
        .preferredColorScheme(.light)
}

#Preview("App Shell · Dark") {
    AppRootView()
        .preferredColorScheme(.dark)
}
