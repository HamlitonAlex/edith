import SwiftUI

struct AppRootView: View {
    @State private var showsSplash = true

    var body: some View {
        Group {
            if showsSplash {
                SplashView()
                    .transition(.opacity)
            } else {
                XuechengNavigation()
            }
        }
        .task {
            guard showsSplash else { return }
            try? await Task.sleep(for: .seconds(1.2))
            withAnimation(.easeInOut(duration: 0.3)) { showsSplash = false }
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
