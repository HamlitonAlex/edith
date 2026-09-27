import SwiftUI

enum ProfileDestination: Hashable {
    case settings
}

struct AppRootView: View {
    @State private var showsSplash = true
    @State private var selectedTab: AppTab = .home
    @State private var profilePath: [ProfileDestination] = []

    private var showsFloatingNavigation: Bool {
        selectedTab != .profile || profilePath.isEmpty
    }

    var body: some View {
        Group {
            if showsSplash {
                SplashView()
                    .transition(.opacity)
            } else {
                TabView(selection: $selectedTab) {
                    NavigationStack {
                        HomeView(onDiscuss: { selectedTab = .conversation })
                    }
                    .tag(AppTab.home)

                    NavigationStack {
                        ConversationView()
                    }
                    .tag(AppTab.conversation)

                    NavigationStack(path: $profilePath) {
                        ProfileView()
                            .navigationDestination(for: ProfileDestination.self) { destination in
                                switch destination {
                                case .settings:
                                    SettingsView()
                                }
                            }
                    }
                    .tag(AppTab.profile)
                }
                .toolbar(.hidden, for: .tabBar)
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if showsFloatingNavigation {
                        FloatingGlassTabBar(selection: $selectedTab)
                            .padding(.horizontal, XuechengTheme.pagePadding)
                            .padding(.bottom, XuechengTheme.space8)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
                .animation(.easeInOut(duration: 0.2), value: showsFloatingNavigation)
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
