import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case home
    case conversation
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "首页"
        case .conversation: "对话"
        case .profile: "我的"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .conversation: "bubble.left.and.bubble.right"
        case .profile: "person.crop.circle"
        }
    }
}

struct FloatingGlassTabBar: View {
    @Environment(\.colorScheme) private var scheme
    @Binding var selection: AppTab

    var body: some View {
        FloatingSurface(radius: XuechengTheme.radius24) {
            HStack(spacing: 0) {
                ForEach(AppTab.allCases) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { selection = tab }
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: tab.symbol)
                                .font(.system(size: 19, weight: .regular, design: .default))
                                .frame(height: 22)
                            Text(tab.title)
                                .font(XuechengTheme.font(.meta))
                                .opacity(selection == tab ? 1 : 0)
                                .frame(height: 11)
                        }
                        .foregroundStyle(selection == tab ? XuechengTheme.primaryText(scheme) : XuechengTheme.secondaryText(scheme).opacity(0.82))
                        .frame(maxWidth: .infinity)
                        .frame(height: 58)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(tab.title)
                    .accessibilityAddTraits(selection == tab ? .isSelected : [])
                }
            }
            .padding(.horizontal, 10)
            .frame(height: 70)
        }
        .sensoryFeedback(.selection, trigger: selection)
    }
}

#Preview("Navigation · Light") {
    FloatingGlassTabBar(selection: .constant(.home))
        .padding(24)
        .background(AmbientBackground(mode: .light))
    .environment(\.colorScheme, .light)
}

#Preview("Navigation · Dark") {
    FloatingGlassTabBar(selection: .constant(.conversation))
        .padding(24)
        .background(AmbientBackground(mode: .dark))
        .environment(\.colorScheme, .dark)
}
