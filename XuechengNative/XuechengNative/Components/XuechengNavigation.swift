import SwiftUI

enum TodayDestination: Hashable { case study, result, schedule }
enum PathDestination: Hashable { case capability(String) }
enum CompanionDestination: Hashable { case schedule }
enum MeDestination: Hashable { case settings, schedule }

// The floating navigation belongs to the shell, never to a page ScrollView.
struct XuechengNavigation: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
                TodayView(presenceIsActive: selectedTab == .today && todayPath.isEmpty)
                    .navigationDestination(for: TodayDestination.self) { destination in
                        switch destination {
                        case .study: StudySessionView(onFinish: { todayPath.append(.result) })
                        case .result: SessionResultView(onReturn: { todayPath.removeAll() })
                        case .schedule: ScheduleView()
                        }
                    }
                    .toolbar(.hidden, for: .tabBar)
            }
            .tag(AppTab.today)

            NavigationStack(path: $pathPath) {
                PathView()
                    .navigationDestination(for: PathDestination.self) { destination in
                        switch destination {
                        case let .capability(id): CapabilityDetailView(capabilityID: id)
                        }
                    }
                    .toolbar(.hidden, for: .tabBar)
            }
            .tag(AppTab.path)

            NavigationStack(path: $companionPath) {
                CompanionView(presenceIsActive: selectedTab == .companion && companionPath.isEmpty)
                    .navigationDestination(for: CompanionDestination.self) { destination in
                        switch destination {
                        case .schedule: ScheduleView()
                        }
                    }
                    .toolbar(.hidden, for: .tabBar)
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
                    .toolbar(.hidden, for: .tabBar)
            }
            .tag(AppTab.me)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if showsFloatingNavigation {
                FloatingGlassTabBar(selection: $selectedTab)
                    .padding(.horizontal, XuechengTheme.navigationHorizontalInset)
                    .padding(.bottom, XuechengTheme.navigationBottomInset)
                    .transition(
                        reduceMotion
                            ? .opacity
                            : .move(edge: .bottom).combined(with: .opacity)
                    )
            }
        }
        .animation(reduceMotion ? nil : XuechengMotion.standardTransition, value: showsFloatingNavigation)
    }
}
