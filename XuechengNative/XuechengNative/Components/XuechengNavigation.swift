import SwiftUI

enum TodayDestination: Hashable { case study, result, schedule }
enum PathDestination: Hashable { case capability(String) }
enum CompanionDestination: Hashable { case schedule }
enum MeDestination: Hashable { case settings, schedule }

// The floating navigation belongs to the shell, never to a page ScrollView.
struct XuechengNavigation: View {
    @State private var selectedTab: AppTab = .today
    @State private var todayPath: [TodayDestination] = []
    @State private var pathPath: [PathDestination] = []
    @State private var companionPath: [CompanionDestination] = []
    @State private var mePath: [MeDestination] = []

    private var showsFloatingNavigation: Bool {
        switch selectedTab {
        case .today: todayPath.isEmpty
        case .path: pathPath.isEmpty
        case .companion: companionPath.isEmpty
        case .me: mePath.isEmpty
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack(path: $todayPath) {
                TodayView()
                    .navigationDestination(for: TodayDestination.self) { destination in
                        switch destination {
                        case .study: StudySessionView(onFinish: { todayPath.append(.result) })
                        case .result: SessionResultView(onReturn: { todayPath.removeAll() })
                        case .schedule: ScheduleView()
                        }
                    }
            }
            .tag(AppTab.today)

            NavigationStack(path: $pathPath) {
                PathView()
                    .navigationDestination(for: PathDestination.self) { destination in
                        switch destination {
                        case let .capability(id): CapabilityDetailView(capabilityID: id)
                        }
                    }
            }
            .tag(AppTab.path)

            NavigationStack(path: $companionPath) {
                CompanionView()
                    .navigationDestination(for: CompanionDestination.self) { destination in
                        switch destination {
                        case .schedule: ScheduleView()
                        }
                    }
            }
            .tag(AppTab.companion)

            NavigationStack(path: $mePath) {
                MeView()
                    .navigationDestination(for: MeDestination.self) { destination in
                        switch destination {
                        case .settings: SettingsView()
                        case .schedule: ScheduleView()
                        }
                    }
            }
            .tag(AppTab.me)
        }
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if showsFloatingNavigation {
                FloatingGlassTabBar(selection: $selectedTab)
                    .padding(.horizontal, XuechengTheme.navigationHorizontalInset)
                    .padding(.bottom, XuechengTheme.navigationBottomInset)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showsFloatingNavigation)
    }
}
